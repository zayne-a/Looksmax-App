// /api/weekly-plan — AI-personalised weekly plans (Zayne 2026-10-25).
//
// ADD-ON ONLY, by design: the automated 90-day plan is never touched,
// never rebuilt, and never replaced by this route. This route curates
// ONE calendar week at a time, on top of the automated week's tasks,
// and the automated week is the permanent fallback: if AI generation
// fails, is unsafe, or is unconfigured, the caller still gets a usable
// week and the week's generation slot is NOT consumed.
//
// Rules (Zayne):
// - Premium only. Tier is server-derived from the validated account,
//   exactly like /api/plan — the client-sent tier (there is none)
//   grants nothing. Free users never consume AI quota here either.
// - One AI week per calendar week (Monday, IST). The check is
//   server-side, against the weekly_plans table's (user_id,
//   week_start) unique pair, so it cannot be bypassed from the app.
//   Failed attempts never insert a row, so they never consume the slot.
// - Lengthy by construction: the AI writes a full day-by-day week
//   (7 days, every task with full detail + whyYou), not a chat reply.
//   maxTokens 8192, JSON-only output, strictly validated.
// - Safety: strict schema validation + a hard banned-term scan. A
//   failed check falls back to the automated week, never to a partial
//   or edited AI week.
// - Generation runs on the fallback provider chain (Groq / NVIDIA /
//   OpenRouter via completeWithFallback), NOT on the Gemini pool —
//   so weekly generation never competes with plan generation quota.

import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

import { completeWithFallback } from "@/lib/ai-providers";
import { getRelevantKbExcerpts } from "@/lib/kb";
import type { FaceMeasurements, QuizAnswers } from "@/lib/types";

// ---------- Weekly plan document (the saveable artifact) ----------

export interface WeeklyPlanTask {
  title: string;
  detail: string;
  whyYou: string;
}

export interface WeeklyPlanDay {
  day: string;
  focus: string;
  tasks: WeeklyPlanTask[];
}

export interface WeeklyPlanDoc {
  summary: string;
  deltas: string[];
  days: WeeklyPlanDay[];
}

// ---------- Week math (Monday, IST — no DST in IST) ----------

/** The Monday (YYYY-MM-DD) of the calendar week containing `d`. */
export function mondayIST(d: Date = new Date()): string {
  const ist = new Date(d.getTime() + 5.5 * 3600 * 1000);
  const back = (ist.getUTCDay() + 6) % 7; // days since Monday
  ist.setUTCDate(ist.getUTCDate() - back);
  return ist.toISOString().slice(0, 10);
}

function nextMondayIST(weekStart: string): string {
  const d = new Date(`${weekStart}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 7);
  return d.toISOString().slice(0, 10);
}

// ---------- Auth (same pattern as /api/plan) ----------

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

async function entitlementForToken(
  token: string
): Promise<{ userId: string; is_admin: boolean; is_premium: boolean } | null> {
  const admin = serviceClient();
  if (!admin) return null;
  try {
    const { data: userData } = await admin.auth.getUser(token);
    const uid = userData?.user?.id;
    if (!uid) return null;
    const { data: profile } = await admin
      .from("profiles")
      .select("is_admin, is_premium")
      .eq("id", uid)
      .single();
    if (!profile) return null;
    return {
      userId: uid,
      is_admin: Boolean(profile.is_admin),
      is_premium: Boolean(profile.is_premium),
    };
  } catch {
    return null;
  }
}

function bearer(req: NextRequest): string | null {
  const header = req.headers.get("authorization");
  return header?.startsWith("Bearer ") ? header.slice(7) : null;
}

// ---------- Validation + safety ----------

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isNonEmptyString(v: unknown, max: number): v is string {
  return typeof v === "string" && v.trim().length > 0 && v.length <= max;
}

/** Strict shape check: a weekly plan is 7 days, every task fully written. */
function isWeeklyPlanDoc(v: unknown): v is WeeklyPlanDoc {
  if (!isRecord(v)) return false;
  if (!isNonEmptyString(v.summary, 1000)) return false;
  if (
    !Array.isArray(v.deltas) ||
    v.deltas.some((d) => typeof d !== "string" || d.length > 500)
  )
    return false;
  if (!Array.isArray(v.days) || v.days.length !== 7) return false;
  for (const day of v.days) {
    if (!isRecord(day)) return false;
    if (!isNonEmptyString(day.day, 40)) return false;
    if (!isNonEmptyString(day.focus, 300)) return false;
    if (!Array.isArray(day.tasks) || day.tasks.length < 1) return false;
    if (day.tasks.length > 12) return false;
    for (const task of day.tasks) {
      if (!isRecord(task)) return false;
      if (!isNonEmptyString(task.title, 200)) return false;
      if (!isNonEmptyString(task.detail, 1000)) return false;
      if (!isNonEmptyString(task.whyYou, 500)) return false;
    }
  }
  return true;
}

// Hard bans only — the prompt + schema + KB grounding do the rest.
// A hit falls back to the automated week; it never edits AI output.
const BANNED_TERMS = ["diuretic", "laxative", "anabolic", "injectable"];

function passesWeeklySafety(doc: WeeklyPlanDoc): boolean {
  const text = JSON.stringify(doc).toLowerCase();
  return BANNED_TERMS.every((term) => !text.includes(term));
}

function extractJson(text: string): unknown | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as unknown;
  } catch {
    return null;
  }
}

// ---------- AI prompt ----------

const WEEKLY_SYSTEM_PROMPT = `You are Max, the coach inside the Mewmax app, curating ONE week of a user's 90-day looksmaxxing programme. You write a LENGTHY, complete week — a full document, not a chat reply.

Rules, all binding:
- Output JSON ONLY, no prose outside the JSON, in exactly this shape:
{"summary": "2-4 sentences: what this week is about and why, personalised to this user",
 "deltas": ["each real change vs the automated week, with its reason — only real changes, never invented ones"],
 "days": [{"day": "Monday", "focus": "the day's theme", "tasks": [{"title": "...", "detail": "full instructions", "whyYou": "why THIS user, citing their measurements, answers, or progress"}]}]}
- Exactly 7 days, Monday to Sunday, in order. Every day has a focus and 3-8 tasks.
- Ground every task in the automated week and the knowledge-base excerpts provided. Refine, reorder, progress, hold back, or reschedule those tasks — never invent new methods, products, or protocols.
- Every task carries full detail and a whyYou that cites THIS user's measurements, weekly answers, or last week's progress. Generic advice with no personal reason is a failure.
- If last week's progress shows missed sessions, repeat the base instead of progressing. If answers flag irritation, pain, or breakouts, pull back — never push through.
- Safety framing is fixed and never softened: habits, not promises — no bone change, no fat-loss, no overnight-result claims; never diuretics, laxatives, dehydration, detoxes, force, or DIY devices; jaw pain, clicking, or persistent symptoms go to a dentist/doctor, never to a harder protocol.
- Never mention dosages, strengths, or frequencies for actives or medicines. Never promise outcomes.`;

const SYNC_DEADLINE_MS = 60_000;

function buildUserBlock(input: {
  measurements: FaceMeasurements | null;
  quiz: QuizAnswers;
  answers: Record<string, unknown>;
  progress: Record<string, unknown> | null;
  automatedWeek: unknown;
  excerpts: string;
}): string {
  return [
    "## Measurements (latest scan)",
    JSON.stringify(input.measurements ?? null),
    "## Quiz answers",
    JSON.stringify(input.quiz),
    "## This week's answers (sleep, skin, soreness, skips, changes)",
    JSON.stringify(input.answers),
    "## Last week's progress (check-offs and logs)",
    JSON.stringify(input.progress ?? null),
    "## The automated week you are curating (refine this — do not replace its methods)",
    JSON.stringify(input.automatedWeek),
    "## Knowledge-base excerpts (ground every recommendation in these)",
    input.excerpts,
  ].join("\n");
}

// ---------- Handlers ----------

export async function GET(req: NextRequest): Promise<NextResponse> {
  const token = bearer(req);
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 401 });
  }
  const ent = await entitlementForToken(token);
  if (!ent || (!ent.is_premium && !ent.is_admin)) {
    return NextResponse.json({ error: "Premium only" }, { status: 403 });
  }
  const admin = serviceClient();
  if (!admin) {
    return NextResponse.json({ error: "Server unconfigured" }, { status: 500 });
  }
  const weekStart = mondayIST();
  const { data } = await admin
    .from("weekly_plans")
    .select("plan, source")
    .eq("user_id", ent.userId)
    .eq("week_start", weekStart)
    .maybeSingle();
  if (!data) {
    return NextResponse.json({
      plan: null,
      source: "none",
      weekStart,
      nextUnlock: nextMondayIST(weekStart),
    });
  }
  return NextResponse.json({
    plan: data.plan,
    source: data.source,
    weekStart,
    nextUnlock: nextMondayIST(weekStart),
  });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const token = bearer(req);
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 401 });
  }
  const ent = await entitlementForToken(token);
  if (!ent || (!ent.is_premium && !ent.is_admin)) {
    return NextResponse.json({ error: "Premium only" }, { status: 403 });
  }
  const admin = serviceClient();
  if (!admin) {
    return NextResponse.json({ error: "Server unconfigured" }, { status: 500 });
  }

  let body: unknown;
  try {
    body = (await req.json()) as unknown;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!isRecord(body)) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const answers = body.answers;
  const automatedWeek = body.automatedWeek;
  const measurements = (body.measurements ?? null) as FaceMeasurements | null;
  const quiz = body.quiz as QuizAnswers | undefined;
  const progress = (body.progress ?? null) as Record<string, unknown> | null;
  if (
    !isRecord(answers) ||
    !Array.isArray(automatedWeek) ||
    automatedWeek.length === 0 ||
    !quiz
  ) {
    return NextResponse.json(
      { error: "answers, automatedWeek, and quiz are required" },
      { status: 400 }
    );
  }

  const weekStart = mondayIST();
  const nextUnlock = nextMondayIST(weekStart);

  // Once-a-week gate: an existing row for this week ends the request.
  const { data: existing } = await admin
    .from("weekly_plans")
    .select("plan")
    .eq("user_id", ent.userId)
    .eq("week_start", weekStart)
    .maybeSingle();
  if (existing) {
    return NextResponse.json(
      {
        error: "This week's AI plan is already generated",
        nextUnlock,
        plan: existing.plan,
      },
      { status: 409 }
    );
  }

  // AI attempt: one lengthy, JSON-only generation on the fallback chain.
  let doc: WeeklyPlanDoc | null = null;
  try {
    const excerpts = getRelevantKbExcerpts(measurements, quiz);
    const res = await completeWithFallback({
      system: WEEKLY_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: buildUserBlock({
            measurements,
            quiz,
            answers,
            progress,
            automatedWeek,
            excerpts,
          }),
        },
      ],
      json: true,
      maxTokens: 8192,
      timeoutMs: 20_000,
      deadline: Date.now() + SYNC_DEADLINE_MS,
      maxAttempts: 8,
    });
    if (res) {
      const parsed = extractJson(res.text);
      if (isWeeklyPlanDoc(parsed) && passesWeeklySafety(parsed)) {
        doc = parsed;
      }
    }
  } catch {
    doc = null;
  }

  // Automated backup: AI failure, invalid output, or unsafe output all
  // land here. No row is inserted, so the week's slot stays open.
  if (!doc) {
    return NextResponse.json({
      plan: null,
      source: "automated",
      weekStart,
      nextUnlock,
      note: "AI curation is unavailable right now — your automated week stands. Your weekly generation is still available.",
    });
  }

  const { error: insertError } = await admin.from("weekly_plans").insert({
    user_id: ent.userId,
    week_start: weekStart,
    plan: doc,
    source: "ai",
  });
  if (insertError) {
    // Race: another generation landed first — return it, do not duplicate.
    const { data: raced } = await admin
      .from("weekly_plans")
      .select("plan")
      .eq("user_id", ent.userId)
      .eq("week_start", weekStart)
      .maybeSingle();
    if (raced) {
      return NextResponse.json(
        {
          error: "This week's AI plan is already generated",
          nextUnlock,
          plan: raced.plan,
        },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Could not save this week's plan" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    plan: doc,
    source: "ai",
    weekStart,
    nextUnlock,
  });
}
