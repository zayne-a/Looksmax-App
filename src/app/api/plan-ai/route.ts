// AI-designed daily tasks — slice 3 of the PSL blend (2026-11-15).
//
// After the results, ALL daily tasks are designed by the AI from the
// blend results (Zayne 2026-11-14 22:44 IST): the per-region blend
// scores drive them, WEAKEST FIXABLE REGION FIRST. This route takes
// the already-scored blend (region scores + soft criteria + geometry
// measurements + Potential + quiz answers) and returns structured
// daily tasks mapped to the 5 plan sections (skin, diet, exercise,
// style, sleep) — each task with a title, detail, frequency, and a
// why tied to the specific score/reason it addresses. Sleep joined
// the section set 2026-11-15 (Zayne: sleep is a full aspect of
// the personalised plan, not one task buried in Exercise).
//
// AI SUGGESTIONS ARE FREE (Zayne 2026-11-14 22:46 IST, explicit
// override): the AI's looksmaxxing suggestions are NOT constrained
// to the verified method library and are NOT vetted against it — the
// whole point is the app does not need to hand-pick and add
// everything to the library first. Do NOT add a library guardrail.
// The only bound is safety: no drugs, steroids, surgery, or medical
// procedures — daily habits only. That is a safety floor, not a
// library constraint, and it does not limit WHICH methods the AI
// may suggest.
//
// WEAKEST FIXABLE FIRST: the model ranks the scored signals by
// weakness × fixability. Skin, eye area, hair/framing, and the
// lower third (via body fat) are fixable by daily tasks; midface
// length and upper-third proportions are bone — no task moves them,
// so they rank last for task design (they may still inform style /
// hair-framing tasks). The route validates the trace server-side:
// at least one task must address the weakest fixable signal, or the
// attempt fails and the ladder retries.
//
// NO PHOTO: this route never sees the face — the blend results ARE
// the analysis of the picture. The caller sends them; the model
// designs from the scores, and must cite only the scores it was
// given (never invented scores, never promised outcomes).
//
// TIER: Pro-only (server-side, like /api/weekly-plan). Free users
// never get AI-designed tasks — they keep the instant KB plan
// exactly as today. No token → 401; valid token but not premium /
// admin → 403. The native client gates on isPremium too, but the
// server is the authority.
//
// LANGUAGE (Zayne, 2026-11-15): the caller sends `language` (the
// English language name, same as /api/support) and the tasks are
// designed IN that language — titles, details, frequencies,
// whyYou, summaries. JSON keys, section ids and `addresses`
// values stay English (they are programmatic). Absent or
// unrecognised → English, exactly as before.
//
// DAILY MODE (Zayne, 2026-11-15 — the nightly build): `mode:
// "daily"` designs TOMORROW in full detail from the persona — the
// night audit (done/missed, weakest section), the scan, the
// check-ins, adherence, and the protocol pool (the user's own
// protocol tasks, sent by the client). The AI checks the RESOURCES
// against the PERSONA: protocols first (select/adapt/extend), the
// KB excerpts + scraped method library as grounding, and beyond
// the protocols where it helps — with a named source per
// beyond-protocol task. Web sourcing is the model's knowledge of
// real published methods, named per task — there is NO live web
// search wired (Gemini search grounding is paid; the no-paid-APIs
// rule forbids it). The day is GUIDED: ordered, timed, exact —
// not a suggestion list. Every task carries a payoff line (what
// you get if you keep it up) and the hard exclusions from the
// persona's attributes (bald/shaved → no hair tasks; no beard →
// no beard tasks; no glasses → no frames task). Daily mode leads
// with Flash-Lite (500 RPD — the daily workhorse) and falls back
// to Flash; weekly mode is unchanged (Flash leads, Lite falls
// back). One call per user per night, cached per day client-side.
//
// Failure is explicit and fast: a 25s hard timeout per Gemini
// attempt, a 55s overall deadline, and a 503 { ok: false, error:
// "ai_unavailable" } when every attempt fails — the caller keeps the
// instant KB plan. The route never blocks a routine on AI.

import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

import {
  coachMethodsPromptBlock,
  retrieveCoachMethods,
} from "@/lib/coach-methods";
import { getRelevantKbExcerpts } from "@/lib/kb";
import type { QuizAnswers } from "@/lib/types";

export const maxDuration = 60;

// Scoring ladder: 3.6 LEADS, Lite is the fallback. 3.8 is NOT in
// this route's ladder — it has hung past 30s on EVERY probe in
// this project (slice 1, and again 2026-11-15), so including it
// only burns the 55s deadline on hangs. Lite is the proven
// fallback here: it answered the full plan prompt in ~5s with a
// complete 4-section plan while 3.6 503'd on it. The response
// names the model actually used, so a Lite plan is visible,
// never silent.
const FLASH_LEAD = "gemini-3.6-flash";
const LITE_MODEL = "gemini-3.5-flash-lite";

// Hard timeout per Gemini attempt; overall deadline for the route.
// Same numbers as /api/score-ai: text calls through this egress
// path run ~15s, so 25s hard-caps any single call while letting
// real attempts land. Deadline is 55s (maxDuration 60).
const ATTEMPT_TIMEOUT_MS = 25_000;
const OVERALL_DEADLINE_MS = 55_000;
const MAX_FLASH_KEYS = 5;
const KEY_COOLDOWN_MS = 60_000;

// Task-count bounds: the prompt asks 3–4 tasks per section (12–16
// total). Fewer than 8 total tasks is not a plan — the attempt
// fails and the ladder retries.
const MIN_TASKS_PER_SECTION = 1;
const MIN_TASKS_TOTAL = 10;

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

/** keyIndex → cooldown-until (epoch ms). Module-level: persists across
 *  requests in a warm serverless instance. */
const keyCooldowns = new Map<number, number>();

/** Round-robin cursor: consecutive requests start from different keys. */
let keyCursor = 0;

function getApiKeys(): string[] {
  const pool = (process.env.GEMINI_API_KEYS ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter((k) => k.length > 0);
  if (pool.length > 0) return pool;
  const single = process.env.GEMINI_API_KEY?.trim();
  return single ? [single] : [];
}

function isKeyCoolingDown(index: number, now: number): boolean {
  const until = keyCooldowns.get(index);
  return until !== undefined && until > now;
}

/**
 * Key indexes in the order this request should try them: round-robin
 * from the cursor, skipping keys in cooldown — unless EVERY key is
 * cooling down, in which case all keys are returned in rotation order.
 */
function orderedKeyIndexes(count: number, now: number): number[] {
  const start = keyCursor % count;
  keyCursor += 1;
  const rotated = Array.from({ length: count }, (_, i) => (start + i) % count);
  const available = rotated.filter((i) => !isKeyCoolingDown(i, now));
  return available.length > 0 ? available : rotated;
}

/**
 * Quota / rate-limit signals: HTTP 429, or a RESOURCE_EXHAUSTED body.
 * HTTP 503 is deliberately NOT a quota signal: Google returns 503
 * UNAVAILABLE for per-MODEL high demand, which says nothing about the
 * key's quota — another model on the same key is usually healthy.
 */
function isQuotaError(status: number, body: string): boolean {
  if (status === 429) return true;
  return body.includes("RESOURCE_EXHAUSTED");
}

/**
 * Permission signals: HTTP 403. This is KEY-level (invalid/revoked
 * key, API not enabled, key restrictions) — trying another model on
 * the same key is futile, so a 403 abandons the key like a quota
 * error does. (Proven in the harness: several pool keys 403 while
 * others answer fine — the pool has dead keys in it.)
 */
function isPermissionError(status: number): boolean {
  return status === 403;
}

function isTimeoutError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const name = (err as { name?: unknown }).name;
  return name === "TimeoutError" || name === "AbortError";
}

/**
 * Model-unavailable signals: HTTP 503. Google returns 503
 * UNAVAILABLE for per-MODEL high demand — capacity is per-model,
 * not per-key, so retrying the SAME model on another key is futile.
 * A 503 skips the model for the rest of the request (the ladder
 * moves to the next model instead of burning the deadline on the
 * same overloaded one). Proven 2026-11-15: 3.6-flash 503'd the
 * full plan prompt on consecutive attempts while answering a short
 * probe fine — and Lite answered the same prompt in ~5s.
 */
function isUnavailableError(status: number): boolean {
  return status === 503;
}

// ---------- Signals ----------

type SectionId = "skin" | "diet" | "exercise" | "style" | "sleep";

const SECTION_IDS: SectionId[] = ["skin", "diet", "exercise", "style", "sleep"];

const SECTION_TITLES: Record<SectionId, string> = {
  skin: "Skin",
  diet: "Diet",
  exercise: "Exercise",
  style: "Style",
  sleep: "Sleep",
};

/** The 8 scored signals the tasks can address (4 AI region scores +
 *  4 face criteria — the same signals /api/score-ai returns).
 *  photoQuality is a confidence signal, never a task target. */
type SignalKey =
  | "eyes"
  | "midface"
  | "lowerThird"
  | "upperThird"
  | "skinQuality"
  | "eyeArea"
  | "hairFraming"
  | "overallImpression";

const SIGNAL_KEYS: SignalKey[] = [
  "eyes",
  "midface",
  "lowerThird",
  "upperThird",
  "skinQuality",
  "eyeArea",
  "hairFraming",
  "overallImpression",
];

/**
 * Fixability: which signals daily tasks can actually move.
 * - fixable: skin, eye area (sleep / under-eye care), hair/framing,
 *   lower third (body fat via diet + exercise, jaw work), overall
 *   impression (grooming / style), eyes (brows, sleep).
 * - bone: midface length and upper-third proportions are structure
 *   — no daily task moves them. They rank last for task design, and
 *   may only inform style / hair-framing tasks.
 */
const FIXABLE: Record<SignalKey, boolean> = {
  eyes: true,
  midface: false,
  lowerThird: true,
  upperThird: false,
  skinQuality: true,
  eyeArea: true,
  hairFraming: true,
  overallImpression: true,
};

type ScoredSignal = { score: number | null; reason: string };

type BlendInput = {
  criteria: Partial<Record<SignalKey, ScoredSignal>> & {
    photoQuality?: ScoredSignal;
  };
  regions: Partial<Record<SignalKey, ScoredSignal>> | null;
  potential: {
    value: number | null;
    reason: string;
    headroom: number | null;
  } | null;
  blendedPsl: number | null;
  gPart: number | null;
  aPart: number | null;
};

/** All 8 signals with their scores, merged from criteria + regions.
 *  A signal with no score (null — the AI could not judge it) is
 *  absent from the map: no task may target an unscored signal. */
function signalScores(blend: BlendInput): Map<SignalKey, ScoredSignal> {
  const out = new Map<SignalKey, ScoredSignal>();
  const take = (key: SignalKey, entry: ScoredSignal | undefined) => {
    if (!entry) return;
    if (typeof entry.score === "number" && Number.isFinite(entry.score)) {
      out.set(key, {
        score: clamp(entry.score, 0, 100),
        reason: typeof entry.reason === "string" ? entry.reason : "",
      });
    }
  };
  take("skinQuality", blend.criteria.skinQuality);
  take("eyeArea", blend.criteria.eyeArea);
  take("hairFraming", blend.criteria.hairFraming);
  take("overallImpression", blend.criteria.overallImpression);
  if (blend.regions) {
    take("eyes", blend.regions.eyes);
    take("midface", blend.regions.midface);
    take("lowerThird", blend.regions.lowerThird);
    take("upperThird", blend.regions.upperThird);
  }
  return out;
}

/** The weakest FIXABLE signal — the one the tasks must lead with.
 *  Null when no fixable signal was scored (a degenerate blend). */
function weakestFixable(scores: Map<SignalKey, ScoredSignal>): SignalKey | null {
  let weakest: SignalKey | null = null;
  let lowest = Infinity;
  for (const [key, entry] of scores) {
    if (!FIXABLE[key]) continue;
    const s = entry.score;
    if (s !== null && s < lowest) {
      lowest = s;
      weakest = key;
    }
  }
  return weakest;
}

// ---------- Response shape ----------

interface AiTask {
  title: string;
  detail: string;
  frequency: string;
  whyYou: string;
  /** The signal this task addresses — one of the 8 keys, or
   *  "general" for a task that serves the whole face (e.g. sleep). */
  addresses: SignalKey | "general";
  /** Daily mode only: the consistency payoff — what the user gets
   *  if they keep this task up for 2–4 weeks. Absent on weekly
   *  plans (the client fills those from its payoff map). */
  payoff?: string;
  /** Daily mode only: the named source for a task that came from
   *  beyond the protocols (a method name / guide). Protocol tasks
   *  carry no source. */
  source?: string;
}

/** The nightly build's persona context (mode "daily" only) — the
 *  client sends this as `day`. Every field is optional at parse
 *  time: a partial context degrades the prompt, never 400s. */
interface DayContextInput {
  journeyDay: number | null;
  journeyWeek: number | null;
  phase: string | null;
  adherenceOverall: number | null;
  adherencePerSection: Partial<Record<SectionId, number>>;
  yesterdayMissed: { sectionId: string; title: string }[];
  yesterdayTasks: string[];
  weakestSection: SectionId | null;
  checkin: {
    adherence: string | null;
    skinReaction: string | null;
    sleepQuality: string | null;
    weightTrend: string | null;
    createdAt: string | null;
  } | null;
  daysSinceScan: number | null;
  auditDone: number | null;
  auditTotal: number | null;
  auditMissedBySection: Partial<Record<SectionId, number>>;
}

/** One protocol-pool entry (mode "daily" only) — the client's
 *  flattened effective-plan tasks, the grounded base the AI draws
 *  from first. */
interface ProtocolPoolEntryInput {
  sectionId: SectionId;
  title: string;
  detail: string;
  frequency: string;
  requiresHair: boolean;
  requiresBeard: boolean;
  requiresGlasses: boolean;
}

interface AiSection {
  id: SectionId;
  title: string;
  summary: string;
  whyForYou: string;
  tasks: AiTask[];
}

const SYSTEM_PROMPT = [
  "You are a looksmaxxing coach designing a daily task plan from a face analysis.",
  "You design from the SCORES you are given — never invent scores, never re-judge the face, never promise outcomes.",
  "Your suggestions are FREE: recommend any looksmaxxing method that fits the scores — you are not limited to any list.",
  "Safety floor only: suggest daily habits — no drugs, steroids, surgery, or medical procedures.",
  "Every task must say WHY it exists, tied to the specific score and reason it addresses.",
  "Keep titles short (under 10 words), details concrete (what to do, how much, when), frequencies real (daily, 3x/week, weekly).",
].join(" ");

// Daily mode (the nightly build): one guided day, designed by
// matching the RESOURCES (protocols, KB, method library, web
// knowledge) against the PERSONA (scan, audit, check-ins,
// adherence, goals, attributes). Protocols first, whatever helps
// wins — but every task is grounded, timed, exact, and honest
// about its source.
const DAILY_SYSTEM_PROMPT = [
  "You are a looksmaxxing coach designing ONE guided day — tomorrow — for a specific user.",
  "You design from the PERSONA you are given (their scan scores, last night's audit, check-ins, adherence, goals, attributes) and the RESOURCES listed (their protocols, KB excerpts, retrieved methods).",
  "Match resources against the persona: a resource that does not fit this user never makes the day. Never invent scores, never re-judge the face, never promise outcomes.",
  "Protocols first: select, adapt and extend the user's own protocol tasks before anything else. Beyond the protocols is allowed where it helps — a real method from the retrieved library or your knowledge of real published methods — and every beyond-protocol task names its source.",
  "Safety floor only: suggest daily habits — no drugs, steroids, surgery, or medical procedures, and no prescription-only recommendations.",
  "The day is GUIDED, not a suggestion list: ordered, timed, exact — what to do, when, in what order.",
  "Every task says WHY it exists (tied to a specific score, audit fact, or check-in) and what you GET if you keep it up (the payoff line).",
  "Keep titles short (under 10 words), details concrete (what to do, how much, when), frequencies real (daily, 3x/week, weekly).",
].join(" ");

// Daily output budget: ~15 tasks with detail + why + payoff.
// 3072 leaves headroom over the ~2200 a full daily design runs;
// the weekly 4096 stays for the weekly design.
const DAILY_MAX_TOKENS = 3072;
// The protocol pool is capped so a long plan can't bloat the
// prompt — the effective plan dedupes to ~50 entries anyway.
const MAX_PROTOCOL_ENTRIES = 80;

/**
 * Reply language (Zayne, 2026-10-24 — same whitelist as
 * /api/support): the native app sends the language the user
 * picked in its language selector, and the value is accepted
 * ONLY as an exact (case-insensitive) match against this list
 * of canonical English names; anything else is ignored and the
 * plan is designed in English. Raw user input is never
 * interpolated into a prompt: the name that reaches the prompt
 * always comes from this list.
 */
const PLAN_LANGUAGES = [
  "English",
  "Chinese",
  "Hindi",
  "Spanish",
  "French",
  "German",
  "Russian",
  "Portuguese",
  "Italian",
  "Romanian",
  "Azerbaijani",
  "Arabic",
  "Bengali",
  "Urdu",
  "Indonesian",
  "Japanese",
  "Turkish",
  "Korean",
  "Vietnamese",
  "Persian",
  "Swahili",
  "Marathi",
  "Tamil",
  "Telugu",
  "Polish",
  "Ukrainian",
  "Dutch",
  "Thai",
] as const;

/** The accepted non-English design language for this request, or
 *  null for English / anything unrecognised (English needs no
 *  directive). */
function sanitisePlanLanguage(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const wanted = raw.trim().toLowerCase();
  if (!wanted) return null;
  const match = PLAN_LANGUAGES.find((l) => l.toLowerCase() === wanted);
  return match && match !== "English" ? match : null;
}

function buildUserText(
  blend: BlendInput,
  geometry: Record<string, unknown> | null,
  quiz: Record<string, unknown> | null,
  steer: string | null,
  planLanguage: string | null
): string {
  const scores = signalScores(blend);
  const lines: string[] = [
    "Design the daily task plan for this face. The scores below are the full analysis — design ONLY from them.",
    "",
    "SCORED SIGNALS (0–100, 50 = average; lower = weaker and more urgent):",
  ];
  for (const key of SIGNAL_KEYS) {
    const entry = scores.get(key);
    if (entry) {
      lines.push(
        `- ${key}: ${entry.score}/100 — "${entry.reason}"${FIXABLE[key] ? "" : " [BONE — not fixable by tasks]"}`
      );
    } else {
      lines.push(`- ${key}: not scored — do NOT design tasks for it.`);
    }
  }
  lines.push(
    "",
    `Blended PSL: ${blend.blendedPsl ?? "unknown"}/8 (geometry half ${blend.gPart ?? "?"}, AI half ${blend.aPart ?? "?"})`,
    blend.potential
      ? `Potential: ${blend.potential.value ?? "unknown"}/8 — ${blend.potential.reason}`
      : "Potential: unknown"
  );
  if (geometry) {
    lines.push("", "GEOMETRY (already measured, do not re-score):", JSON.stringify(geometry));
  }
  if (quiz) {
    lines.push("", "USER CONTEXT (quiz answers — respect them, e.g. skin type, budget, body goal):", JSON.stringify(quiz));
  }
  if (steer) {
    // Slice 4 — Coach customise: the user steered this rebuild
    // ("more focus on skin", "less diet"). Honour the steer by
    // shifting task emphasis as asked. The weakest-fixable-first
    // order still stands UNLESS the user explicitly overrides the
    // priority ("make X the priority", "focus on X first") — only
    // then may the priority array lead with the steered signal.
    // Even when steered away from the weakest fixable signal, keep
    // at least one task addressing it (and say why in its whyYou):
    // the plan never drops the thing that needs the most work.
    lines.push(
      "",
      `USER STEER — the user asked for this change to the plan: "${steer}".`,
      "Honour it: shift task emphasis as asked (more/fewer tasks for the named area). Weakest-fixable-first still stands unless the user explicitly overrides the priority. Always keep at least one task addressing the weakest fixable signal, even when steered away from it."
    );
  }
  if (planLanguage) {
    // LANGUAGE (Zayne, 2026-11-15): every user-facing string in
    // the plan is written in the user's language. The JSON shape,
    // the section ids and the `addresses` values stay English —
    // they are programmatic, and the client validates them.
    lines.push(
      "",
      `LANGUAGE: Write ALL user-facing text in ${planLanguage} — section titles, summaries, whyForYou, and every task's title, detail, frequency and whyYou. Keep the JSON keys, the section ids ("skin", "diet", "exercise", "style", "sleep"), and the "addresses" values in English exactly as specified. Frequencies must be real ${planLanguage} words (the ${planLanguage} word for daily, 3x/week, weekly).`
    );
  }
  lines.push(
    "",
    "RULES:",
    "1. WEAKEST FIXABLE FIRST: rank the fixable signals by weakness, and design the plan around them — the weakest fixable signal gets the most task attention, and the first tasks in each section address it. Bone signals (midface, upperThird) rank LAST for task design — they may only inform style / hair-framing tasks, never head the plan.",
    "2. 3–4 tasks per section, 5 sections: skin, diet, exercise, style, sleep. Every section gets tasks; a section whose signals are strong still gets maintenance tasks.",
    "3. Each task: title, detail (concrete — what, how much, when), frequency (daily / 3x/week / weekly / once), whyYou (tied to the SPECIFIC score and reason it addresses — quote the score), addresses (the signal key it targets, or \"general\").",
    "4. Order the sections by the priority of the signals they address — the section tackling the weakest fixable signal leads.",
    "5. Return a \"priority\" array: the scored signals ranked weakest-fixable-first (fixable signals first by score ascending, then bone signals by score ascending).",
    "6. The sleep section designs wind-down, fixed-wake-time, and caffeine-cut-off tasks from the user's quiz.sleepHours and the eyeArea signal (under-eye darkness) — sleep is the lever that moves under-eyes, so its tasks address eyeArea or \"general\".",
    "",
    "Return exactly this shape, nothing else:",
    '{ "sections": [ { "id": "skin" | "diet" | "exercise" | "style" | "sleep", "title": "...", "summary": "...", "whyForYou": "...", "tasks": [ { "title": "...", "detail": "...", "frequency": "daily", "whyYou": "...", "addresses": "skinQuality" } ] } ], "priority": ["skinQuality", "lowerThird", ...] }'
  );
  return lines.join("\n");
}

/**
 * Daily mode (the nightly build): tomorrow's guided programme,
 * designed by matching the RESOURCES against the PERSONA. The
 * protocol pool is the grounded base (select/adapt/extend first);
 * the KB excerpts + retrieved methods ground the vocabulary; the
 * persona (audit, check-ins, adherence, attributes) filters and
 * drives the day. Exported for the harness (the route's own
 * prompt is unit-testable without a live call).
 */
export function buildDailyUserText(
  blend: BlendInput,
  geometry: Record<string, unknown> | null,
  quiz: Record<string, unknown> | null,
  day: DayContextInput | null,
  protocols: ProtocolPoolEntryInput[],
  planLanguage: string | null
): string {
  const scores = signalScores(blend);
  const dayLabel =
    day?.journeyDay !== null && day?.journeyDay !== undefined
      ? `day ${day.journeyDay} of their 90-day programme (week ${day.journeyWeek ?? "?"}, ${day.phase ?? "Foundation"} phase)`
      : "a day of their 90-day programme";
  const lines: string[] = [
    `Design TOMORROW's guided daily programme for this user — ${dayLabel}. The scores below are the full analysis — design ONLY from them.`,
    "",
    "SCORED SIGNALS (0–100, 50 = average; lower = weaker and more urgent):",
  ];
  for (const key of SIGNAL_KEYS) {
    const entry = scores.get(key);
    if (entry) {
      lines.push(
        `- ${key}: ${entry.score}/100 — "${entry.reason}"${FIXABLE[key] ? "" : " [BONE — not fixable by tasks]"}`
      );
    } else {
      lines.push(`- ${key}: not scored — do NOT design tasks for it.`);
    }
  }
  lines.push(
    "",
    `Blended PSL: ${blend.blendedPsl ?? "unknown"}/8 (geometry half ${blend.gPart ?? "?"}, AI half ${blend.aPart ?? "?"})`,
    blend.potential
      ? `Potential: ${blend.potential.value ?? "unknown"}/8 — ${blend.potential.reason}`
      : "Potential: unknown"
  );
  if (geometry) {
    lines.push("", "GEOMETRY (already measured, do not re-score):", JSON.stringify(geometry));
  }
  if (quiz) {
    lines.push("", "USER CONTEXT (quiz answers — respect them, e.g. skin type, budget, body goal):", JSON.stringify(quiz));
  }
  if (day) {
    const pct = (v: number | null) =>
      v === null ? "unknown" : `${Math.round(v * 100)}%`;
    lines.push("", "PERSONA — this user's state (the filter and the driver):");
    lines.push(
      `- Adherence (last 7 days): ${pct(day.adherenceOverall)} overall.` +
        (Object.keys(day.adherencePerSection).length > 0
          ? ` Per section: ${Object.entries(day.adherencePerSection)
              .map(([s, v]) => `${s} ${pct(v)}`)
              .join(", ")}.`
          : "")
    );
    if (day.auditDone !== null && day.auditTotal !== null) {
      lines.push(
        `- Yesterday's audit: ${day.auditDone}/${day.auditTotal} tasks done.` +
          (Object.keys(day.auditMissedBySection).length > 0
            ? ` Missed by section: ${Object.entries(day.auditMissedBySection)
                .map(([s, n]) => `${s} ${n}`)
                .join(", ")}.`
            : "")
      );
    }
    if (day.yesterdayMissed.length > 0) {
      lines.push(
        `- Yesterday's MISSED tasks (tomorrow's focus — resurface with a fresh angle, not the same words): ${day.yesterdayMissed
          .map((m) => `[${m.sectionId}] ${m.title}`)
          .join("; ")}`
      );
    }
    if (day.weakestSection) {
      lines.push(`- Weakest section (lowest adherence): ${day.weakestSection} — it leads tomorrow.`);
    }
    if (day.checkin) {
      const c = day.checkin;
      lines.push(
        `- Latest check-in${c.createdAt ? ` (${c.createdAt.slice(0, 10)})` : ""}: routine followed ${c.adherence ?? "unknown"}, skin reaction ${c.skinReaction ?? "unknown"}, sleep ${c.sleepQuality ?? "unknown"}, weight trend ${c.weightTrend ?? "unknown"}.`
      );
    }
    if (day.daysSinceScan !== null) {
      lines.push(`- Days since the latest scan: ${day.daysSinceScan}.`);
    }
  }
  if (day && day.yesterdayTasks.length > 0) {
    lines.push(
      "",
      `YESTERDAY'S TASKS (vary them — do not repeat yesterday verbatim; the morning anchor titles may stay, but change the detail/angle or rotate the non-anchor tasks): ${day.yesterdayTasks.join(" | ")}`
    );
  }
  if (protocols.length > 0) {
    lines.push(
      "",
      "PROTOCOLS — the user's own protocol tasks (the grounded base: SELECT, ADAPT and EXTEND from these first — do not invent from nothing while a protocol task fits):"
    );
    for (const p of protocols) {
      const reqs = [
        p.requiresHair ? "needs hair" : "",
        p.requiresBeard ? "needs beard" : "",
        p.requiresGlasses ? "needs glasses" : "",
      ]
        .filter(Boolean)
        .join(", ");
      lines.push(
        `- [${p.sectionId}] ${p.title} (${p.frequency}): ${p.detail}${reqs ? ` {${reqs}}` : ""}`
      );
    }
  }
  // KB excerpts (null measurements — the scan's scores are already
  // in the prompt above; the excerpts ground vocabulary and
  // constraints). Best-effort: an odd quiz shape skips the block
  // rather than failing the build. The excerpts are GENERAL — the
  // HARD EXCLUSIONS below override any hair/beard/glasses lines
  // in them.
  if (quiz) {
    try {
      const excerpts = getRelevantKbExcerpts(
        null,
        quiz as unknown as QuizAnswers
      );
      if (excerpts.trim().length > 0) {
        lines.push("", "KB EXCERPTS (matched protocols — vocabulary and constraints):", excerpts);
      }
    } catch {
      // Skip the block; the protocols above still ground the day.
    }
  }
  // Scraped methods, retrieved by what the persona needs most
  // (weakest signal + weakest section + missed tasks).
  const weakest = weakestFixable(scores);
  const methodQuery = [
    weakest ?? "",
    day?.weakestSection ?? "",
    ...(day?.yesterdayMissed.map((m) => m.title) ?? []),
  ]
    .filter(Boolean)
    .join(" ");
  if (methodQuery.trim().length > 0) {
    try {
      const methods = retrieveCoachMethods(methodQuery, 6);
      const block = coachMethodsPromptBlock(methods);
      if (block.trim().length > 0) {
        lines.push("", block);
      }
    } catch {
      // Skip the block; the day still builds.
    }
  }
  // HARD EXCLUSIONS — the persona's attributes (Zayne 2026-11-15:
  // personalisation means EXCLUDING what doesn't apply). These
  // override the protocols, the KB excerpts, and the methods.
  const exclusions: string[] = [];
  const hairStatus = typeof quiz?.hairStatus === "string" ? quiz.hairStatus : "unknown";
  const beardStatus = typeof quiz?.beardStatus === "string" ? quiz.beardStatus : "unknown";
  const wearsGlasses = typeof quiz?.wearsGlasses === "string" ? quiz.wearsGlasses : "unknown";
  const gender = typeof quiz?.gender === "string" ? quiz.gender : "unknown";
  if (hairStatus === "bald" || hairStatus === "shaved") {
    exclusions.push(
      "NO HAIR TASKS: this user has no hair to cut or style — never assign haircut, styling, or hair-product tasks. Scalp care is fine."
    );
  }
  if (gender === "female" || beardStatus === "none") {
    exclusions.push(
      "NO BEARD TASKS: this user has no beard — never assign beard shaping, trimming, or beard-product tasks."
    );
  }
  if (wearsGlasses === "no") {
    exclusions.push(
      "NO GLASSES TASKS: this user does not wear glasses — never assign frames or glasses-care tasks."
    );
  }
  if (exclusions.length > 0) {
    lines.push("", "HARD EXCLUSIONS (absolute — these override everything above):");
    for (const e of exclusions) lines.push(`- ${e}`);
  }
  if (planLanguage) {
    lines.push(
      "",
      `LANGUAGE: Write ALL user-facing text in ${planLanguage} — section titles, summaries, whyForYou, and every task's title, detail, frequency, whyYou and payoff. Keep the JSON keys, the section ids ("skin", "diet", "exercise", "style", "sleep"), and the "addresses" values in English exactly as specified. Frequencies must be real ${planLanguage} words (the ${planLanguage} word for daily, 3x/week, weekly).`
    );
  }
  lines.push(
    "",
    "RULES:",
    "1. PROTOCOLS FIRST, WHATEVER HELPS: select, adapt and extend the PROTOCOLS above first — most of tomorrow comes from them. Where no protocol task fits what the persona needs, go beyond: a real method from the retrieved library or your knowledge of real published methods — never an invented method — and name its source in the task's \"source\" field.",
    "2. GUIDED, TIMED, EXACT: the day reads as a timed programme, not a suggestion list — skin 7:00, style 7:45, diet 12:30, exercise 18:00, sleep 22:00. Order the tasks within each section by when to do them, and make each task exact (what to do, how much, when).",
    "3. PERSONALISE FROM THE AUDIT: yesterday's missed tasks resurface with a fresh angle (new detail, new framing — not the same words); the weakest section leads the day; tasks the user completed progress (more load, more depth, more reps).",
    "4. PERSONALISE FROM THE CHECK-IN: skin reaction irritation/worse → gentler actives, drop the harsh step; poor sleep → the sleep section leads and wind-down gets the detail; weight trend up/down → the diet tasks re-target to the body goal.",
    "5. PERSONALISE FROM ADHERENCE: low adherence (under 70%) → fewer, easier tasks (3 per section, the essentials); high adherence (70%+) → progress (4 per section, deeper work).",
    "6. FULLY DETAILED: every task has concrete detail + a whyYou tied to a SPECIFIC score, audit fact, or check-in (quote it) + a payoff line — what the user gets if they keep this task up for 2–4 weeks, grounded in the task and their state.",
    "7. ANCHOR STABILITY: the morning anchor tasks (the AM routine) keep the SAME titles every day — vary their detail, never their titles. Non-anchor tasks rotate and vary.",
    "8. HARD EXCLUSIONS: never assign a task the exclusions above rule out — a task that cannot apply to this user must not appear, in any section.",
    "9. SAFETY FLOOR: daily habits only — no drugs, steroids, surgery, medical procedures, no prescription-only recommendations.",
    "10. WEAKEST FIXABLE FIRST: at least one task addresses the weakest fixable signal, and the section tackling it leads.",
    "11. 3–4 tasks per section, 5 sections: skin, diet, exercise, style, sleep. Every section gets tasks; a section whose signals are strong still gets maintenance tasks.",
    "",
    "Return exactly this shape, nothing else:",
    '{ "sections": [ { "id": "skin" | "diet" | "exercise" | "style" | "sleep", "title": "...", "summary": "...", "whyForYou": "...", "tasks": [ { "title": "...", "detail": "...", "frequency": "daily", "whyYou": "...", "addresses": "skinQuality", "payoff": "...", "source": "..." } ] } ], "priority": ["skinQuality", "lowerThird", ...] }',
    "The \"source\" field is for beyond-protocol tasks only — omit it (or leave it empty) for protocol tasks."
  );
  return lines.join("\n");
}

// ---------- Gemini ----------

async function callGemini(
  model: string,
  apiKey: string,
  userText: string,
  timeoutMs: number,
  opts?: { systemPrompt?: string; maxOutputTokens?: number }
): Promise<Response> {
  // Key is passed as a query param per the Gemini API contract; it is never logged.
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: opts?.systemPrompt ?? SYSTEM_PROMPT }],
      },
      contents: [{ role: "user", parts: [{ text: userText }] }],
      generationConfig: {
        responseMimeType: "application/json",
        // Low temperature: task design must stay grounded in the
        // scores, not creative. 0.3 (not 0.2) — task wording needs
        // a little variety across faces.
        temperature: 0.3,
        // 5 sections × 3–4 tasks with detail + why. 2048 was NOT
        // enough: the morph-1 proof hit MAX_TOKENS at 2044 and the
        // JSON truncated mid-task (unparseable). A full 4-section
        // plan ran ~1800–2600 tokens; the 5th section (sleep,
        // 2026-11-15) adds ~450–650, so 4096 leaves real headroom.
        // Daily mode passes a smaller budget (3072).
        maxOutputTokens: opts?.maxOutputTokens ?? 4096,
      },
    }),
  });
}

/** Strip markdown code fences if the model wraps the JSON despite responseMimeType. */
function cleanJson(text: string): string {
  const t = text.trim();
  const m = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return m && m[1] ? m[1] : t;
}

function extractText(data: unknown): string | null {
  if (typeof data !== "object" || data === null) return null;
  const candidates = (data as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  const content = (candidates[0] as { content?: unknown }).content;
  if (typeof content !== "object" || content === null) return null;
  const parts = (content as { parts?: unknown }).parts;
  if (!Array.isArray(parts) || parts.length === 0) return null;
  const text = (parts[0] as { text?: unknown }).text;
  return typeof text === "string" ? text : null;
}

function cleanStr(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length > 0 ? s.slice(0, max) : null;
}

/**
 * Validate the model's JSON into sections + priority. Returns null
 * when the payload is unparseable, misses a section, has too few
 * tasks, or — the trace check — when NO task addresses the weakest
 * fixable signal. A null here fails the attempt and the ladder
 * retries with another model/key: a plan that ignores the weakest
 * region is not a plan, it is a miss.
 */
/** Exported for the harness (the route's validation is
 *  unit-testable without a live call). */
export function parsePlan(
  rawText: string,
  weakest: SignalKey | null
): { sections: AiSection[]; priority: SignalKey[] } | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleanJson(rawText));
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const obj = parsed as Record<string, unknown>;
  const rawSections = obj.sections;
  if (!Array.isArray(rawSections)) return null;

  const sections: AiSection[] = [];
  const seen = new Set<string>();
  let totalTasks = 0;
  let weakestAddressed = weakest === null;
  for (const raw of rawSections) {
    if (typeof raw !== "object" || raw === null) return null;
    const s = raw as Record<string, unknown>;
    const id = s.id;
    if (
      typeof id !== "string" ||
      !SECTION_IDS.includes(id as SectionId) ||
      seen.has(id)
    ) {
      return null;
    }
    seen.add(id);
    const title =
      cleanStr(s.title, 40) ?? SECTION_TITLES[id as SectionId];
    const summary = cleanStr(s.summary, 300) ?? "";
    const whyForYou = cleanStr(s.whyForYou, 300) ?? "";
    const rawTasks = s.tasks;
    if (!Array.isArray(rawTasks) || rawTasks.length < MIN_TASKS_PER_SECTION) {
      return null;
    }
    const tasks: AiTask[] = [];
    for (const rawTask of rawTasks) {
      if (typeof rawTask !== "object" || rawTask === null) return null;
      const tk = rawTask as Record<string, unknown>;
      const taskTitle = cleanStr(tk.title, 120);
      const detail = cleanStr(tk.detail, 400);
      const frequency = cleanStr(tk.frequency, 40);
      const whyYou = cleanStr(tk.whyYou, 300);
      const addresses = tk.addresses;
      const addressesOk =
        addresses === "general" ||
        (typeof addresses === "string" &&
          SIGNAL_KEYS.includes(addresses as SignalKey));
      if (!taskTitle || !detail || !frequency || !whyYou || !addressesOk) {
        return null;
      }
      if (weakest !== null && addresses === weakest) weakestAddressed = true;
      // Daily mode: the payoff + source pass through when present
      // (optional — weekly plans don't carry them, and the client
      // fills a missing payoff from its own map).
      const payoff = cleanStr(tk.payoff, 300);
      const source = cleanStr(tk.source, 120);
      tasks.push({
        title: taskTitle,
        detail,
        frequency,
        whyYou,
        addresses: addresses as SignalKey | "general",
        ...(payoff ? { payoff } : {}),
        ...(source ? { source } : {}),
      });
    }
    totalTasks += tasks.length;
    sections.push({ id: id as SectionId, title, summary, whyForYou, tasks });
  }
  // All 5 sections, enough tasks, and the weakest fixable signal
  // must be addressed by at least one task.
  if (seen.size !== 5 || totalTasks < MIN_TASKS_TOTAL) return null;
  if (!weakestAddressed) return null;

  const rawPriority = obj.priority;
  const priority: SignalKey[] = [];
  if (Array.isArray(rawPriority)) {
    for (const p of rawPriority) {
      if (
        typeof p === "string" &&
        SIGNAL_KEYS.includes(p as SignalKey) &&
        !priority.includes(p as SignalKey)
      ) {
        priority.push(p as SignalKey);
      }
    }
  }
  return { sections, priority };
}

type Attempt =
  | {
      ok: true;
      model: string;
      sections: AiSection[];
      priority: SignalKey[];
    }
  | {
      ok: false;
      quota: boolean;
      fatal: boolean;
      timedOut: boolean;
      unavailable: boolean;
      error: string;
    };

/**
 * One Gemini attempt: one model, one key, hard timeout. A quota error
 * (429) or a permission error (403) abandons the key — both are
 * key-level. A 503 abandons the MODEL (per-model capacity — another
 * key on the same model will 503 too). A timeout / malformed
 * response abandons the attempt only (the next model or key may
 * still answer).
 */
async function tryAttempt(
  model: string,
  apiKey: string,
  userText: string,
  weakest: SignalKey | null,
  timeoutMs: number,
  geminiOpts?: { systemPrompt?: string; maxOutputTokens?: number }
): Promise<Attempt> {
  try {
    const res = await callGemini(
      model,
      apiKey,
      userText,
      timeoutMs,
      geminiOpts
    );
    const body = await res.text();
    if (!res.ok) {
      return {
        ok: false,
        quota: isQuotaError(res.status, body),
        fatal: isPermissionError(res.status),
        timedOut: false,
        unavailable: isUnavailableError(res.status),
        error: `gemini ${res.status}`,
      };
    }
    let data: unknown;
    try {
      data = JSON.parse(body);
    } catch {
      return {
        ok: false,
        quota: false,
        fatal: false,
        timedOut: false,
        unavailable: false,
        error: "bad gemini json",
      };
    }
    const text = extractText(data);
    if (text === null) {
      return {
        ok: false,
        quota: false,
        fatal: false,
        timedOut: false,
        unavailable: false,
        error: "empty gemini reply",
      };
    }
    const parsed = parsePlan(text, weakest);
    if (parsed === null) {
      return {
        ok: false,
        quota: false,
        fatal: false,
        timedOut: false,
        unavailable: false,
        error: "unparseable plan (shape, task count, or weakest-signal trace)",
      };
    }
    return {
      ok: true,
      model,
      sections: parsed.sections,
      priority: parsed.priority,
    };
  } catch (err) {
    if (isTimeoutError(err)) {
      return {
        ok: false,
        quota: false,
        fatal: false,
        timedOut: true,
        unavailable: false,
        error: "timeout",
      };
    }
    return {
      ok: false,
      quota: false,
      fatal: false,
      timedOut: false,
      unavailable: false,
      error: "fetch failed",
    };
  }
}

type LadderResult =
  | {
      ok: true;
      model: string;
      sections: AiSection[];
      priority: SignalKey[];
    }
  | {
      ok: false;
      lastError: string;
      sawLeadQuota: boolean;
      deadlineHit: boolean;
    };

/**
 * The model ladder, shared by both modes: the LEAD model gets up
 * to MAX_FLASH_KEYS keys (a quota error (429) or permission error
 * (403) on a key abandons that key for the whole request — both
 * are key-level; two consecutive quota errors mean the lead
 * bucket is blown pool-wide for this minute — the keys share few
 * projects, proven in the slice-1 harness — so the loop stops
 * burning lead attempts and falls through). The FALLBACK model
 * gets one attempt on the first available key. A 503 abandons the
 * MODEL for the rest of the request (per-model capacity — another
 * key on the same model 503s too). A model that times out twice
 * in a row is skipped for the rest of the request. Nothing starts
 * past the deadline.
 *
 * Weekly leads with Flash (quality) and falls back to Lite;
 * daily leads with Lite (500 RPD — the daily workhorse) and
 * falls back to Flash. The response names the model actually
 * used, so a fallback is visible, never silent.
 */
async function runLadder(
  leadModel: string,
  fallbackModel: string,
  userText: string,
  weakest: SignalKey | null,
  keys: string[],
  keyOrder: number[],
  deadline: number,
  geminiOpts?: { systemPrompt?: string; maxOutputTokens?: number }
): Promise<LadderResult> {
  let lastError = "no attempt made";
  let sawLeadQuota = false;
  let consecutiveQuota = 0;
  let leadQuotaBlown = false;
  const modelTimeouts = new Map<string, number>();
  const skippedModels = new Set<string>();
  const unavailableModels = new Set<string>();
  const leadKeys = keyOrder.slice(0, MAX_FLASH_KEYS);
  for (const ki of leadKeys) {
    if (leadQuotaBlown) break;
    const models = [leadModel].filter(
      (m) => !skippedModels.has(m) && !unavailableModels.has(m)
    );
    for (const model of models) {
      const remaining = deadline - Date.now();
      if (remaining < 1_000) {
        return { ok: false, lastError, sawLeadQuota, deadlineHit: true };
      }
      const attempt = await tryAttempt(
        model,
        keys[ki],
        userText,
        weakest,
        Math.min(ATTEMPT_TIMEOUT_MS, remaining),
        geminiOpts
      );
      if (attempt.ok) {
        return {
          ok: true,
          model: attempt.model,
          sections: attempt.sections,
          priority: attempt.priority,
        };
      }
      lastError = attempt.error;
      if (attempt.timedOut) {
        const n = (modelTimeouts.get(model) ?? 0) + 1;
        modelTimeouts.set(model, n);
        if (n >= 2) skippedModels.add(model);
      }
      if (attempt.unavailable) {
        // Per-model capacity — no point trying this model on
        // another key; the loop moves on (and the fallback gets
        // its turn).
        unavailableModels.add(model);
      }
      if (attempt.quota) {
        sawLeadQuota = true;
        consecutiveQuota += 1;
        keyCooldowns.set(ki, Date.now() + KEY_COOLDOWN_MS);
        if (consecutiveQuota >= 2) leadQuotaBlown = true;
        break; // key-level failure — next key (or fallback, if blown).
      }
      consecutiveQuota = 0;
      if (attempt.fatal) {
        keyCooldowns.set(ki, Date.now() + KEY_COOLDOWN_MS);
        break; // key-level failure — next key.
      }
    }
  }

  // Fallback: one attempt on the first available key.
  if (Date.now() < deadline - 1_000) {
    const fallbackKey =
      keyOrder.find((ki) => !isKeyCoolingDown(ki, Date.now())) ?? keyOrder[0];
    const attempt = await tryAttempt(
      fallbackModel,
      keys[fallbackKey],
      userText,
      weakest,
      Math.min(ATTEMPT_TIMEOUT_MS, deadline - Date.now()),
      geminiOpts
    );
    if (attempt.ok) {
      return {
        ok: true,
        model: attempt.model,
        sections: attempt.sections,
        priority: attempt.priority,
      };
    }
    lastError = attempt.error;
    if (attempt.quota || attempt.fatal) {
      keyCooldowns.set(fallbackKey, Date.now() + KEY_COOLDOWN_MS);
    }
  }
  return { ok: false, lastError, sawLeadQuota, deadlineHit: false };
}

// ---------- Auth (same pattern as /api/weekly-plan and /api/score-ai) ----------

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
    // No profile row is a FREE user (like /api/score-ai) — and free
    // users are NOT entitled here, so the 403 below catches them.
    if (!profile) {
      return { userId: uid, is_admin: false, is_premium: false };
    }
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

// ---------- Request parsing ----------

function parseScored(entry: unknown): ScoredSignal | undefined {
  if (typeof entry !== "object" || entry === null) return undefined;
  const e = entry as Record<string, unknown>;
  const score =
    typeof e.score === "number" && Number.isFinite(e.score)
      ? clamp(e.score, 0, 100)
      : null;
  const reason = typeof e.reason === "string" ? e.reason.slice(0, 200) : "";
  // A null score WITH a reason is a real answer ("hair not visible")
  // — keep the entry so the prompt can say "not scored".
  if (score === null && reason.length === 0) return undefined;
  return { score, reason };
}

function parseBlend(b: Record<string, unknown>): BlendInput | null {
  const blend = b.blend;
  if (typeof blend !== "object" || blend === null) return null;
  const bl = blend as Record<string, unknown>;
  const criteriaRaw =
    typeof bl.criteria === "object" && bl.criteria !== null
      ? (bl.criteria as Record<string, unknown>)
      : null;
  if (!criteriaRaw) return null;
  const criteria: BlendInput["criteria"] = {};
  for (const key of [
    "skinQuality",
    "eyeArea",
    "hairFraming",
    "overallImpression",
    "photoQuality",
  ] as const) {
    const entry = parseScored(criteriaRaw[key]);
    if (entry) criteria[key] = entry;
  }
  // At least one face criterion must be scored, or there is nothing
  // to design from.
  const faceScored = [
    "skinQuality",
    "eyeArea",
    "hairFraming",
    "overallImpression",
  ].some(
    (k) =>
      criteria[k as keyof typeof criteria]?.score !== null &&
      criteria[k as keyof typeof criteria]?.score !== undefined
  );
  if (!faceScored) return null;

  let regions: BlendInput["regions"] = null;
  const regionsRaw = bl.regions;
  if (typeof regionsRaw === "object" && regionsRaw !== null) {
    regions = {};
    const rr = regionsRaw as Record<string, unknown>;
    for (const key of ["eyes", "midface", "lowerThird", "upperThird"] as const) {
      const entry = parseScored(rr[key]);
      if (entry) regions[key] = entry;
    }
  }
  let potential: BlendInput["potential"] = null;
  const pRaw = bl.potential;
  if (typeof pRaw === "object" && pRaw !== null) {
    const p = pRaw as Record<string, unknown>;
    potential = {
      value:
        typeof p.value === "number" && Number.isFinite(p.value)
          ? clamp(p.value, 0, 8)
          : null,
      reason: typeof p.reason === "string" ? p.reason.slice(0, 200) : "",
      headroom:
        typeof p.headroom === "number" && Number.isFinite(p.headroom)
          ? clamp(p.headroom, 0, 2)
          : null,
    };
  }
  const num = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) ? v : null;
  return {
    criteria,
    regions,
    potential,
    blendedPsl: num(bl.blendedPsl),
    gPart: num(bl.gPart),
    aPart: num(bl.aPart),
  };
}

/** Daily mode: parse the persona context (`day`). Defensive —
 *  every field is optional; a malformed `day` degrades the prompt
 *  (the persona block is omitted) instead of 400ing the build. */
function parseDayContext(raw: unknown): DayContextInput | null {
  if (typeof raw !== "object" || raw === null) return null;
  const d = raw as Record<string, unknown>;
  const num = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) ? v : null;
  const str = (v: unknown, max: number): string | null =>
    typeof v === "string" && v.trim().length > 0
      ? v.trim().slice(0, max)
      : null;
  const perSection = (v: unknown): Partial<Record<SectionId, number>> => {
    const out: Partial<Record<SectionId, number>> = {};
    if (typeof v !== "object" || v === null) return out;
    const rec = v as Record<string, unknown>;
    for (const id of SECTION_IDS) {
      const n = num(rec[id]);
      if (n !== null) out[id] = clamp(n, 0, 1);
    }
    return out;
  };
  const adherenceRaw =
    typeof d.adherence === "object" && d.adherence !== null
      ? (d.adherence as Record<string, unknown>)
      : null;
  const missedRaw = Array.isArray(d.yesterdayMissed) ? d.yesterdayMissed : [];
  const yesterdayMissed: { sectionId: string; title: string }[] = [];
  for (const m of missedRaw.slice(0, 20)) {
    if (typeof m !== "object" || m === null) continue;
    const mm = m as Record<string, unknown>;
    const sectionId = str(mm.sectionId, 20);
    const title = str(mm.title, 120);
    if (sectionId && title) yesterdayMissed.push({ sectionId, title });
  }
  const yesterdayTasks = Array.isArray(d.yesterdayTasks)
    ? d.yesterdayTasks
        .filter((t): t is string => typeof t === "string")
        .map((t) => t.slice(0, 120))
        .slice(0, 30)
    : [];
  const checkinRaw =
    typeof d.checkin === "object" && d.checkin !== null
      ? (d.checkin as Record<string, unknown>)
      : null;
  const auditRaw =
    typeof d.audit === "object" && d.audit !== null
      ? (d.audit as Record<string, unknown>)
      : null;
  const auditMissed: Partial<Record<SectionId, number>> = {};
  if (typeof auditRaw?.missedBySection === "object" && auditRaw.missedBySection !== null) {
    const rec = auditRaw.missedBySection as Record<string, unknown>;
    for (const id of SECTION_IDS) {
      const n = num(rec[id]);
      if (n !== null) auditMissed[id] = Math.max(0, Math.floor(n));
    }
  }
  const weakestSection = str(d.weakestSection, 20);
  return {
    journeyDay: num(d.journeyDay),
    journeyWeek: num(d.journeyWeek),
    phase: str(d.phase, 30),
    adherenceOverall:
      adherenceRaw !== null ? num(adherenceRaw.overall) : null,
    adherencePerSection: perSection(adherenceRaw?.perSection),
    yesterdayMissed,
    yesterdayTasks,
    weakestSection:
      weakestSection && SECTION_IDS.includes(weakestSection as SectionId)
        ? (weakestSection as SectionId)
        : null,
    checkin: checkinRaw
      ? {
          adherence: str(checkinRaw.adherence, 20),
          skinReaction: str(checkinRaw.skinReaction, 20),
          sleepQuality: str(checkinRaw.sleepQuality, 20),
          weightTrend: str(checkinRaw.weightTrend, 20),
          createdAt: str(checkinRaw.createdAt, 30),
        }
      : null,
    daysSinceScan: num(d.daysSinceScan),
    auditDone: auditRaw ? num(auditRaw.done) : null,
    auditTotal: auditRaw ? num(auditRaw.total) : null,
    auditMissedBySection: auditMissed,
  };
}

/** Daily mode: parse the protocol pool (`protocols`). Invalid
 *  entries are skipped, not fatal — the pool degrades. Capped so
 *  a long plan can't bloat the prompt. */
function parseProtocolPool(raw: unknown): ProtocolPoolEntryInput[] {
  if (!Array.isArray(raw)) return [];
  const out: ProtocolPoolEntryInput[] = [];
  for (const entry of raw.slice(0, MAX_PROTOCOL_ENTRIES)) {
    if (typeof entry !== "object" || entry === null) continue;
    const e = entry as Record<string, unknown>;
    const sectionId = e.sectionId;
    const title =
      typeof e.title === "string" && e.title.trim().length > 0
        ? e.title.trim().slice(0, 120)
        : null;
    const detail =
      typeof e.detail === "string" ? e.detail.trim().slice(0, 400) : "";
    const frequency =
      typeof e.frequency === "string" && e.frequency.trim().length > 0
        ? e.frequency.trim().slice(0, 40)
        : "daily";
    if (
      typeof sectionId !== "string" ||
      !SECTION_IDS.includes(sectionId as SectionId) ||
      !title
    ) {
      continue;
    }
    out.push({
      sectionId: sectionId as SectionId,
      title,
      detail,
      frequency,
      requiresHair: e.requiresHair === true,
      requiresBeard: e.requiresBeard === true,
      requiresGlasses: e.requiresGlasses === true,
    });
  }
  return out;
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  const deadline = startedAt + OVERALL_DEADLINE_MS;

  // Auth first: no token or an invalid token never reaches Gemini.
  // Pro-only: a valid free session gets a 403, not a plan.
  const token = bearer(req);
  if (!token) {
    return NextResponse.json(
      { ok: false, error: "unauthorized", detail: "missing bearer token" },
      { status: 401 }
    );
  }
  const ent = await entitlementForToken(token);
  if (!ent) {
    return NextResponse.json(
      { ok: false, error: "unauthorized", detail: "invalid token" },
      { status: 401 }
    );
  }
  if (!ent.is_premium && !ent.is_admin) {
    return NextResponse.json(
      { ok: false, error: "premium_required", detail: "AI-designed tasks are Pro only" },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "bad_request", detail: "body is not JSON" },
      { status: 400 }
    );
  }
  const b = (typeof body === "object" && body !== null ? body : {}) as Record<
    string,
    unknown
  >;
  const blend = parseBlend(b);
  if (!blend) {
    return NextResponse.json(
      {
        ok: false,
        error: "bad_request",
        detail: "blend (criteria + regions + potential) is required, with at least one scored face criterion",
      },
      { status: 400 }
    );
  }
  const geometry =
    typeof b.geometry === "object" && b.geometry !== null
      ? (b.geometry as Record<string, unknown>)
      : null;
  const quiz =
    typeof b.quiz === "object" && b.quiz !== null
      ? (b.quiz as Record<string, unknown>)
      : null;
  // Slice 4 — Coach customise: an optional user steer for this
  // rebuild ("more focus on skin"). Free text, capped — it goes
  // into the prompt verbatim, so it is length-bounded like the
  // other prompt inputs. Absent on the first design.
  const steer =
    typeof b.steer === "string" && b.steer.trim().length > 0
      ? b.steer.trim().slice(0, 200)
      : null;
  // The design language (whitelisted; null = English).
  const planLanguage = sanitisePlanLanguage(b.language);
  // DAILY MODE (the nightly build): mode "daily" designs
  // TOMORROW from the persona + the protocol pool. Absent or
  // anything else = the weekly design, exactly as before.
  const isDaily = b.mode === "daily";
  const day = isDaily ? parseDayContext(b.day) : null;
  const protocols = isDaily ? parseProtocolPool(b.protocols) : [];

  const scores = signalScores(blend);
  const weakest = weakestFixable(scores);

  const keys = getApiKeys();
  if (keys.length === 0) {
    return NextResponse.json(
      { ok: false, error: "ai_unavailable", detail: "no gemini keys configured" },
      { status: 503 }
    );
  }

  const userText = isDaily
    ? buildDailyUserText(
        blend,
        geometry,
        quiz,
        day,
        protocols,
        planLanguage
      )
    : buildUserText(blend, geometry, quiz, steer, planLanguage);
  const now = Date.now();
  const keyOrder = orderedKeyIndexes(keys.length, now);

  // The ladder: weekly leads with Flash (quality) and falls back
  // to Lite; daily leads with Lite (500 RPD — the daily
  // workhorse) and falls back to Flash. Daily also passes its
  // own system prompt + output budget.
  const geminiOpts = isDaily
    ? { systemPrompt: DAILY_SYSTEM_PROMPT, maxOutputTokens: DAILY_MAX_TOKENS }
    : undefined;
  const result = isDaily
    ? await runLadder(
        LITE_MODEL,
        FLASH_LEAD,
        userText,
        weakest,
        keys,
        keyOrder,
        deadline,
        geminiOpts
      )
    : await runLadder(
        FLASH_LEAD,
        LITE_MODEL,
        userText,
        weakest,
        keys,
        keyOrder,
        deadline,
        geminiOpts
      );
  if (result.ok) {
    return NextResponse.json({
      ok: true,
      mode: isDaily ? "daily" : "weekly",
      model: result.model,
      sections: result.sections,
      priority: result.priority,
      weakestFixable: weakest,
      steer,
      language: planLanguage ?? "English",
      latencyMs: Date.now() - startedAt,
    });
  }

  return NextResponse.json(
    {
      ok: false,
      error: "ai_unavailable",
      detail: result.deadlineHit
        ? `deadline reached (last attempt: ${result.lastError})`
        : result.sawLeadQuota
          ? `${isDaily ? "lite" : "flash"} quota exhausted; ${isDaily ? "flash" : "lite"} also failed (${result.lastError})`
          : result.lastError,
    },
    { status: 503 }
  );
}
