// POST /api/plan — generates a personalized AscendPlan.
// Layer 3 (LLM orchestration): Gemini with strict JSON output, grounded in the
// KB via matched excerpts. Validates schema + safety; falls back to the pure
// template stub plan on any failure. The API key is read from env only and is
// never logged or echoed.

import { NextRequest, NextResponse } from "next/server";
import type {
  AscendPlan,
  PlanRequest,
  PlanResponse,
  PlanSection,
} from "@/lib/types";
import { buildStubPlan, getRelevantKbExcerpts } from "@/lib/kb";
import { extractProductTypes, topTriggerSources } from "@/lib/eval";

const PRIMARY_MODEL = "gemini-3.8-flash";
const FALLBACK_MODEL = "gemini-3.6-flash";

// Any mention of an EXCLUDED compound fails the safety filter.
const EXCLUDED_TERMS = [
  "aminophylline",
  "xanthigen",
  "ghk-cu",
  "ghku",
  "dsip",
  "finasteride",
  "steroid",
  "surgery",
  "rhinoplasty",
  "filler",
  "botox",
  "diagnos", // diagnosis / diagnosed / diagnostic
  "hormone",
  "testosterone",
  "melatonin",
];

// RX-ONLY categories: may be MENTIONED with "consult a dermatologist" framing,
// but any dosage/strength/frequency advice near the term fails the filter.
const RX_ONLY_TERMS = [
  "tretinoin",
  "isotretinoin",
  "hydrocortisone",
  "bimatoprost",
  "minoxidil",
];

const DOSAGE_PATTERN = /\d+\s*(mg|mcg|ml|%)/i;
const FREQUENCY_TERMS = [
  "daily",
  "nightly",
  "twice",
  "2x/week",
  "3x/week",
  "every other day",
  "once a day",
  "every night",
  "every morning",
  "per day",
  "per week",
  "weekly",
];

const WINDOW_CHARS = 120;

function collectText(plan: AscendPlan): string {
  const texts: string[] = [plan.headline, plan.scoreSummary, ...plan.disclaimers];
  for (const f of plan.priorityFixes) texts.push(f.title, f.why);
  for (const s of plan.sections) {
    texts.push(s.title, s.summary, s.whyForYou);
    for (const w of s.weeks) {
      texts.push(w.focus);
      for (const t of w.tasks) texts.push(t.title, t.detail, t.frequency);
    }
  }
  return texts.join("\n");
}

/**
 * Safety filter for generated plans. Returns true only if the plan is safe to
 * serve: no excluded compounds anywhere, and no dosage/frequency advice for
 * RX-ONLY categories.
 */
export function passesSafetyFilter(plan: AscendPlan): boolean {
  const lower = collectText(plan).toLowerCase();

  for (const term of EXCLUDED_TERMS) {
    const idx = lower.indexOf(term);
    if (idx !== -1) {
      const ctx = lower.slice(Math.max(0, idx - 60), idx + term.length + 60).replace(/\s+/g, " ");
      console.warn(`[plan] safety filter: excluded term "${term}" detected near: "...${ctx}..."`);
      return false;
    }
  }

  for (const term of RX_ONLY_TERMS) {
    let idx = lower.indexOf(term);
    while (idx !== -1) {
      const window = lower.slice(
        Math.max(0, idx - WINDOW_CHARS),
        idx + term.length + WINDOW_CHARS
      );
      if (
        DOSAGE_PATTERN.test(window) ||
        FREQUENCY_TERMS.some((f) => window.includes(f))
      ) {
        console.warn(
          `[plan] safety filter: dosage/frequency advice near RX term "${term}"`
        );
        return false;
      }
      idx = lower.indexOf(term, idx + term.length);
    }
  }

  return true;
}

// ---------- Plan JSON validation ----------

const SECTION_IDS = ["skin", "diet", "exercise", "style"] as const;

function isPlanSection(s: unknown): s is PlanSection {
  if (typeof s !== "object" || s === null) return false;
  const o = s as Record<string, unknown>;
  if (!SECTION_IDS.includes(o.id as (typeof SECTION_IDS)[number])) return false;
  if (typeof o.title !== "string" || typeof o.summary !== "string") return false;
  if (typeof o.whyForYou !== "string") return false;
  if (!Array.isArray(o.weeks) || o.weeks.length !== 4) return false;
  return o.weeks.every((w) => {
    if (typeof w !== "object" || w === null) return false;
    const wk = w as Record<string, unknown>;
    return (
      typeof wk.week === "number" &&
      typeof wk.focus === "string" &&
      Array.isArray(wk.tasks) &&
      wk.tasks.every((t) => {
        if (typeof t !== "object" || t === null) return false;
        const task = t as Record<string, unknown>;
        return (
          typeof task.title === "string" &&
          typeof task.detail === "string" &&
          typeof task.frequency === "string" &&
          // Personalization guardrail: every task must cite its trigger.
          typeof task.whyYou === "string" &&
          task.whyYou.trim().length > 0
        );
      })
    );
  });
}

function isValidPlan(p: unknown): p is AscendPlan {
  if (typeof p !== "object" || p === null) return false;
  const o = p as Record<string, unknown>;
  if (typeof o.headline !== "string" || typeof o.scoreSummary !== "string") return false;
  if (!Array.isArray(o.priorityFixes) || o.priorityFixes.length === 0) return false;
  for (const f of o.priorityFixes) {
    if (typeof f !== "object" || f === null) return false;
    const fix = f as Record<string, unknown>;
    if (
      typeof fix.title !== "string" ||
      typeof fix.why !== "string" ||
      !["high", "medium", "low"].includes(fix.impact as string) ||
      !["low", "medium", "high"].includes(fix.effort as string)
    )
      return false;
  }
  if (!Array.isArray(o.sections) || o.sections.length !== 4) return false;
  const ids = o.sections.map((s) => (s as { id?: string }).id).sort();
  if (JSON.stringify(ids) !== JSON.stringify([...SECTION_IDS].sort())) return false;
  if (!o.sections.every(isPlanSection)) return false;
  if (!Array.isArray(o.disclaimers) || o.disclaimers.length === 0) return false;
  if (!o.disclaimers.every((d) => typeof d === "string")) return false;
  return true;
}

// ---------- Gemini prompt ----------

const SYSTEM_PROMPT = `You are an evidence-based softmaxxing coach for the "Ascend" app. You write personalized, structured self-improvement plans grounded in the measurements and knowledge-base excerpts provided. No two users get the same plan: every recommendation must be driven by the user's actual inputs.

YOUR INPUT SIGNALS (cite these — never invent others):
- From the scan (measurements.skin): redness (0-100), texture (0-100), blemishCount, underEye darkness (0-100). From measurements: faceShape, facial thirds/fifths, symmetry, jaw ratios, overallScore.
- From the quiz: goalRanking (top goals, ranked 1-3 — goal #1 reorders the plan), skinType, routineLevel (none|basic|advanced), ageRange, sunExposure (outdoor|mixed|desk), budgetTier (budget|mid|premium).

DECISION RULES (apply them; the plan must visibly differ across users):
1. Blemishes high + oily skin signals → acne protocol leads: salicylic acid, lightweight gel moisturizer, strict AM/PM consistency; glow steps deferred to week 3+.
2. Redness high → barrier repair for the first 2 weeks (panthenol, azelaic acid); NO strong actives until redness settles.
3. Hyperpigmentation ranked #1 (or in the goal top) → vitamin C + azelaic/kojic acids + SPF 50+ PA++++ with reapplication discipline as the headline habit.
4. Dry + dull → hydration layering, richer moisturizer, exfoliation 1x/week max.
5. routineLevel "none" → 3-step starter (cleanser → moisturizer → SPF) for weeks 1-2 before ANY active is introduced.
6. routineLevel "advanced" → actives with proper sequencing (e.g. vitamin C AM, retinol PM, never layered together).
7. goalRanking reorders sections: the section matching goal #1 leads; priorityFixes ordered by ranked goals.
8. budgetTier adjusts product-TYPE framing (budget-friendly types vs premium types) — types only, never brands.

HARD CONSTRAINTS (non-negotiable):
1. Softmaxxing ONLY: skincare, hair, grooming, posture, fitness, nutrition, sleep, and style. No medical diagnoses of any kind.
2. Never recommend drugs, hormones, or surgery — no finasteride, minoxidil regimens, steroids, testosterone, fillers, botox, rhinoplasty, or any surgical specifics.
3. Prescription categories (tretinoin, isotretinoin, hydrocortisone, bimatoprost, minoxidil) may be MENTIONED only with "consult a dermatologist" language — never recommended directly, never with dosages, strengths, or frequencies. Use this framing when relevant: "Prescription treatments exist for [concern] and can be very effective, but they need a dermatologist's supervision. What we help with is everything around them — the routine, the habits, the tracking."
4. Never mention aminophylline, xanthigen, GHK-Cu, or DSIP under any circumstances. Never recommend melatonin; for sleep issues say "discuss with a doctor".
5. In disclaimers, never use the words diagnose/diagnosis/diagnostic — use "not medical advice" phrasing instead.
6. Supportive coach tone — encouraging, specific, never shaming. No leaderboards, no "mogging", no rating cruelty.
7. Every recommendation must be tied to the user's actual measurements or quiz answers. If a number supports the advice, cite it. EVERY task carries a "whyYou" field citing its specific trigger (e.g. "because your scan showed elevated redness (62/100)", "because you ranked de-tanning as your #1 goal", "because your routine level is 'none'").
8. Product TYPES only (e.g. "vitamin C serum", "gel moisturizer") — never brand names.
9. Output STRICT JSON matching the schema below. No markdown fences, no prose outside the JSON.

OUTPUT JSON SCHEMA:
{
  "headline": "string — personalized plan title",
  "scoreSummary": "string — summarizes their scan numbers and what they mean",
  "priorityFixes": [
    { "title": "string", "why": "string — tied to a measurement and ordered by ranked goals", "impact": "high|medium|low", "effort": "low|medium|high" }
  ],
  "sections": [
    {
      "id": "skin|diet|exercise|style",
      "title": "string",
      "summary": "string",
      "whyForYou": "string — explicitly tied to their measurements/quiz",
      "weeks": [
        { "week": 1, "focus": "string", "tasks": [ { "title": "string", "detail": "string", "frequency": "string — e.g. daily, 3x/week, once", "whyYou": "string — the specific trigger, non-empty, citing the signal" } ] }
      ]
    }
  ],
  "disclaimers": ["string — safety disclaimers, never using diagnose/diagnosis/diagnostic"]
}
Rules: exactly 4 sections with ids skin, diet, exercise, style; the section matching goal #1 leads. Each section has exactly 4 weeks. 3-5 priorityFixes ordered by impact and goal rank. 2-4 tasks per week; EVERY task has a non-empty whyYou. Include at least 3 disclaimers (general wellness, not medical advice; patch-test skincare; see a doctor for medical concerns).

FEW-SHOT EXAMPLES — different inputs must produce visibly different plans:
Example 1 — inputs: oily skin, blemishCount 14, routineLevel "none", goalRanking ["clear acne","glow","de-tan"]. Plan: acne protocol leads; weeks 1-2 are the 3-step starter ONLY; salicylic acid enters week 3; glow steps deferred.
- sample task: {"title": "Salicylic acid (BHA) cleanser 3 evenings/week", "detail": "Use the salicylic acid cleanser Monday, Wednesday, Friday nights instead of your regular cleanser; BHA gets inside oily pores and clears congestion.", "frequency": "3x/week", "whyYou": "because your scan showed elevated blemish activity (14 active blemishes) and your skin type is oily — salicylic acid is the workhorse here, introduced now that your basics are solid"}
Example 2 — inputs: dry skin, texture 72/100, ageRange "25-34", goalRanking ["glow","anti-aging"]. Plan: hydration layering leads — hyaluronic acid serum on damp skin, ceramide-rich cream moisturizer, lactic acid exfoliant 1x/week MAX.
- sample task: {"title": "Lactic acid exfoliant — 1x/week maximum", "detail": "A lactic acid (a gentle AHA) exfoliant one evening per week on clean dry skin — dry skin gets a strict ceiling, not a schedule.", "frequency": "1x/week", "whyYou": "because your scan showed rougher texture (72/100) — exfoliation smooths texture, but dry skin gets 1x/week max to protect the barrier"}
Example 3 — inputs: combination skin, goalRanking ["de-tan","even tone"], sunExposure "outdoor". Plan: de-tan protocol leads — vitamin C AM + azelaic/kojic PM + SPF 50+ PA++++ with reapplication discipline as the headline habit.
- sample task: {"title": "SPF 50+ PA++++ with reapplication discipline", "detail": "Two finger-lengths for face, ears, and neck every morning; reapply every 2-3 hours outdoors.", "frequency": "daily", "whyYou": "because you ranked de-tan as your #1 goal and you're outdoors most of the day — sunscreen is what stops new tanning; the brighteners only work on top of it"}`;

function buildUserMessage(req: PlanRequest, kbExcerpts: string): string {
  return [
    "## User measurements (deterministic scan)",
    JSON.stringify(req.measurements ?? { note: "no scan data provided" }, null, 2),
    "",
    "## Quiz answers",
    JSON.stringify(req.quiz, null, 2),
    "",
    "## Knowledge-base excerpts (ground every recommendation in these)",
    kbExcerpts,
    "",
    "Write the AscendPlan JSON now. Strict JSON only.",
  ].join("\n");
}

async function callGemini(
  model: string,
  apiKey: string,
  systemPrompt: string,
  userMessage: string
): Promise<Response> {
  // Key is passed as a query param per the Gemini API contract; it is never logged.
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userMessage }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.7,
        maxOutputTokens: 8192,
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

async function generateWithGemini(
  apiKey: string,
  req: PlanRequest
): Promise<{ plan: AscendPlan; source: "gemini" | "stub" }> {
  const kbExcerpts = getRelevantKbExcerpts(req.measurements, req.quiz);
  const userMessage = buildUserMessage(req, kbExcerpts);

  const models = [PRIMARY_MODEL, FALLBACK_MODEL];
  let lastError = "unknown error";

  for (const model of models) {
    try {
      const res = await callGemini(model, apiKey, SYSTEM_PROMPT, userMessage);
      if (!res.ok) {
        lastError = `${model} returned HTTP ${res.status}`;
        console.warn(`[plan] ${lastError}; trying next model`);
        continue;
      }
      const data: unknown = await res.json();
      const text = extractText(data);
      if (!text) {
        lastError = `${model} returned no text content`;
        console.warn(`[plan] ${lastError}; trying next model`);
        continue;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(cleanJson(text));
      } catch {
        lastError = `${model} returned invalid JSON`;
        console.warn(`[plan] ${lastError}; trying next model`);
        continue;
      }
      if (!isValidPlan(parsed)) {
        lastError = `${model} returned JSON failing schema validation`;
        console.warn(`[plan] ${lastError}; trying next model`);
        continue;
      }
      if (!passesSafetyFilter(parsed)) {
        lastError = `${model} output failed the safety filter`;
        console.warn(`[plan] ${lastError}; trying next model`);
        continue;
      }
      return { plan: parsed, source: "gemini" };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.warn(`[plan] ${model} call failed: ${lastError}`);
    }
  }

  console.warn(`[plan] all Gemini models failed (${lastError}); using stub plan`);
  return { plan: buildStubPlan(req.measurements, req.quiz), source: "stub" };
}

/** One-line diversity note per generated plan (personalization spec guardrail 4). */
function logDiversity(plan: AscendPlan): void {
  const types = extractProductTypes(plan);
  const triggers = topTriggerSources(plan).slice(0, 3);
  console.log(
    `[plan] diversity: ${types.length} product types; triggers: ${triggers.join(", ") || "n/a"}`
  );
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const planReq = body as PlanRequest;
    if (!planReq || typeof planReq !== "object" || !planReq.quiz) {
      return NextResponse.json(
        { error: "Missing required field: quiz" },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      const plan = buildStubPlan(planReq.measurements ?? null, planReq.quiz);
      logDiversity(plan);
      const res: PlanResponse = { plan, source: "stub" };
      return NextResponse.json(res);
    }

    const result = await generateWithGemini(apiKey, planReq);
    logDiversity(result.plan);
    const res: PlanResponse = { plan: result.plan, source: result.source };
    return NextResponse.json(res);
  } catch (err) {
    console.error("[plan] unexpected error:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: "Failed to generate plan" },
      { status: 500 }
    );
  }
}
