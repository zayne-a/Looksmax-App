// POST /api/plan — generates a personalized AscendPlan.
// Layer 3 (LLM orchestration): Gemini with strict JSON output, grounded in the
// KB via matched excerpts. Validates schema + safety; falls back to the pure
// template stub plan on any failure. API keys are read from env only (a pool
// via GEMINI_API_KEYS, or a single GEMINI_API_KEY) and are never logged or
// echoed. Keys that hit quota/rate limits cool down for 60s while the pool
// fails over to the next key. Each Gemini attempt is capped at 20s — a
// timeout abandons the key (cooldown + failover) exactly like a quota hit,
// so one hung upstream call can't stall plan generation.
// Generation is two-tier. FREE: zero AI calls, ever — the deterministic
// template engine (buildStubPlan) IS the free product, assembled entirely
// from the user's own data; non-subscribers never consume Gemini quota.
// PREMIUM: two-pass AI curation (standard draft + ONE deep-curation
// refinement pass at a 45s per-attempt timeout; the draft is served if
// refinement fails in any way). The deterministic Foundations (vitals)
// block is built by the KB and merged into premium plans unchanged —
// the AI never writes or rewrites it.

import { NextRequest, NextResponse } from "next/server";
import type {
  AscendPlan,
  PlanRequest,
  PlanResponse,
  PlanSection,
} from "@/lib/types";
import { buildFoundations, buildStubPlan, getRelevantKbExcerpts } from "@/lib/kb";
import { extractProductTypes, topTriggerSources } from "@/lib/eval";

const PRIMARY_MODEL = "gemini-3.8-flash";
const FALLBACK_MODEL = "gemini-3.6-flash";

// ---------- Gemini key pool with failover ----------
//
// Keys come from GEMINI_API_KEYS (comma-separated pool). If that is
// unset/empty, a lone GEMINI_API_KEY is used as a one-key pool. A key that
// returns HTTP 429 or a RESOURCE_EXHAUSTED error cools down for
// KEY_COOLDOWN_MS and the request fails over to the next key; each request
// starts from a rotating offset so quota burn spreads across the pool.
// Only key INDEXES are ever logged — never key material.

const KEY_COOLDOWN_MS = 60_000;

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
 * Key indexes in the order this request should try them: round-robin from
 * the cursor, skipping keys in cooldown — unless EVERY key is cooling down,
 * in which case all keys are returned in rotation order (try anyway).
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
 * UNAVAILABLE for per-MODEL high demand ("this model is currently
 * experiencing high demand"), which says nothing about the key's quota —
 * the fallback model on the same key is usually healthy, so a 503 falls
 * through to the next model like any other failure. (Verified live:
 * gemini-3.8-flash 503ing on every key while gemini-3.6-flash answered
 * normally on the same key.)
 */
function isQuotaError(status: number, body: string): boolean {
  if (status === 429) return true;
  return body.includes("RESOURCE_EXHAUSTED");
}

/** Per-attempt timeout for a single Gemini call. A hung upstream request is
 *  worthless to wait on — abort it and fail over instead. */
const ATTEMPT_TIMEOUT_MS = 20_000;

/** Premium refinement attempts get a longer leash: the curation pass is
 *  worth more than the seconds it costs, and its failure still serves the
 *  standard draft, so a slow refinement can never hurt the user. */
const PREMIUM_ATTEMPT_TIMEOUT_MS = 45_000;

/** True when a fetch rejection is our own timeout (or a manual abort). */
function isTimeoutError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const name = (err as { name?: unknown }).name;
  return name === "TimeoutError" || name === "AbortError";
}

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
  // Projection block: realistic outcomes for the user's chosen horizon.
  const proj = o.projection as Record<string, unknown> | undefined;
  if (!proj || typeof proj !== "object") return false;
  if (typeof proj.horizonWeeks !== "number" || proj.horizonWeeks <= 0) return false;
  if (!Array.isArray(proj.outcomes) || proj.outcomes.length < 2) return false;
  if (
    !proj.outcomes.every(
      (s) => typeof s === "string" && (s as string).trim().length > 0
    )
  )
    return false;
  if (typeof proj.note !== "string" || proj.note.trim().length === 0) return false;
  if (!Array.isArray(o.disclaimers) || o.disclaimers.length === 0) return false;
  if (!o.disclaimers.every((d) => typeof d === "string")) return false;
  return true;
}

// ---------- Gemini prompt ----------

const SYSTEM_PROMPT = `You are an evidence-based softmaxxing coach for the "Ascend" app. You write personalized, structured self-improvement plans grounded in the measurements and knowledge-base excerpts provided. No two users get the same plan: every recommendation must be driven by the user's actual inputs. Scope is holistic — face, skin, body, sleep, hydration, presence: the user is being looksmaxxed end-to-end, never handed "skincare plus weight loss".

VOICE & FORMAT — THIS READS LIKE A PAID PROTOCOL, NEVER A CHATBOT ANSWER:
- NO chatbot tells: no greetings ("Great question", "Let's dive in"), no motivation filler ("you've got this", "you're on your way"), no hedging paragraphs, no "it's important to remember / note that", no meta commentary about the plan itself. Open with substance, end with substance.
- Imperative coach voice. Terse directives, not essays. Every task detail is AT MOST 2 short sentences and MUST carry specifics — never vibes: quantities, percentages, grams, minutes, sets×reps, exact days, product types WITH strengths (e.g. "Vitamin C serum 10–15%, 3 drops, AM, before moisturiser").
- Vague advice is BANNED: "eat healthy", "exercise regularly", "stay hydrated", "get more sleep", or "use sunscreen" without amount/frequency fail the plan. Every instruction must be countable.
- Diet = numbers only: kcal target, protein grams/day, meal timing. Exercise = sets × reps, rest seconds, week-over-week progression. Style = concrete formulas: fits, colours, exact items ("tapered trousers, no break; monochrome top half") — never "dress better".
- Structure each section as a named protocol, not an essay: the section summary is ONE directive line ("Cut inflammation first. Brighten second."). Weekly focuses PROGRESS — Week 1 introduce → Week 2 build → Week 3 intensify → Week 4 consolidate — and each focus says what changes that week.
- Every section carries at least one measurable CHECKPOINT written into the relevant week's focus, prefixed "Checkpoint —" (e.g. "Checkpoint — by day 14: no new breakouts for 3 straight days", "Checkpoint — by day 21: waist −1 cm at the same morning weigh-in").
- Hard rules are their own tasks: title starts "RULE —", frequency "always", detail states the rule flatly ("Never layer a retinoid with benzoyl peroxide in the same routine. Alternate nights."). Safety framing uses the same crisp rule-card style ("RULE — Tretinoin is prescription-only. Dermatologist first; this protocol builds everything around it.").
- scoreSummary: 2 sentences maximum, numbers first, zero encouragement padding. Headline: name the protocol like a product ("Barrier Reset — Phase 1"), never a full sentence, never a transformation promise.

PERSONALISATION SATURATION — EVERY SECTION MUST EARN ITS PLACE:
- Each of the 4 sections must visibly use at least 2–3 of THIS user's specific data points. Generic filler that could be pasted into anyone's plan is a failed plan.
- Data points to draw from: measured canthal tilt (degrees), facial thirds (%), jaw:cheekbone ratio, fWHR, symmetry score, golden-ratio score, measured face shape BY NAME, skin readings (redness / texture / under-eye numbers, blemish count), body stats (maintenance kcal computed from their height/weight/age, protein grams from their bodyweight), ranked goals IN THEIR ORDER, budget tier (product framing), routine level, sun exposure, and their timeline (checkpoints paced to their horizon).
- Style section: hairstyle and facial-hair picks MUST name the measured face shape ("for your square face shape…") and cite at least one measured ratio.
- Diet section: state their actual maintenance kcal number and protein gram target, computed from their stats — never a generic range.
- A chatbot could not produce these numbers. If a section reads like it could, rewrite it until it can't.

PHASED JOURNEY — NO SHORT-HORIZON MIRACLES:
- This plan is PHASE 1 (weeks 1–4) of a 12-week, 3-phase protocol. The week-by-week detail covers Phase 1 only.
- "30-day transformation" framing is BANNED everywhere — headline, summaries, tasks, projection. Never promise a total transformation inside Phase 1 or any fixed short window.
- Phase 2 (weeks 5–8) and Phase 3 (weeks 9–12) sit on the user's roadmap. Reference them by name when a step deliberately defers ("brightening actives land in Phase 2, once the barrier is rebuilt in Phase 1").

YOUR INPUT SIGNALS (cite these — never invent others):
- From the scan (measurements.skin): redness (0-100), texture (0-100), blemishCount, underEye darkness (0-100). From measurements: faceShape, facial thirds/fifths, symmetry, jaw ratios, overallScore.
- From the quiz: goalRanking (top goals, ranked 1-3 — goal #1 reorders the plan), skinType, routineLevel (none|basic|advanced), ageRange, sunExposure (outdoor|mixed|desk), budgetTier (budget|mid|premium), timelineWeeks (4|8|12, or 0 = no deadline → project over 12).

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
6. Direct coach voice — respectful, never shaming, zero motivation filler (see VOICE & FORMAT). No leaderboards, no "mogging", no rating cruelty.
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
  "projection": {
    "horizonWeeks": "number — the user's timelineWeeks (4, 8 or 12; no deadline → 12)",
    "outcomes": ["string — realistically achievable by the horizon, derived from THIS user's data", "3-5 items"],
    "note": "string — one honest line: achievable with consistency, not a guarantee; names this as Phase 1 of the 12-week protocol"
  },
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
PROJECTION RULES: outcomes are COMPUTED from the user's numbers, never wished. Fat change = daily kcal deficit (or surplus) × horizon days ÷ 7700, stated as "≈X kg". Skin outcomes are visible-change ranges tied to their readings ("redness visibly calmer — most of the shift by weeks 3–4"). Add habit/skill milestones (routine adherence streaks, first re-scan comparison). No miracles, no guaranteed numbers, no "transformation" language — every outcome is framed as realistically achievable with consistency.

FEW-SHOT EXAMPLES — different inputs must produce visibly different plans, saturated with the user's own numbers:
Example 1 — inputs: oily skin, blemishCount 14, routineLevel "none", 80 kg / 178 cm, square face shape, jaw:cheekbone ratio 0.94, symmetry 81, goalRanking ["clear acne","glow","de-tan"]. Plan: acne protocol leads; weeks 1-2 are the 3-step starter ONLY; salicylic acid enters week 3; glow steps deferred. Diet runs HIS numbers; style names HIS shape:
- sample task: {"title": "Salicylic acid 2% cleanser — Mon/Wed/Fri PM", "detail": "Swap your PM cleanser for salicylic acid 2% on Mon, Wed, Fri nights. Massage 60 seconds, rinse lukewarm, moisturise within 3 minutes.", "frequency": "3x/week", "whyYou": "because your scan showed elevated blemish activity (14 active blemishes) and your skin type is oily — salicylic acid is the workhorse here, introduced now that your basics are solid"}
- sample task: {"title": "Maintenance ≈2,720 kcal — eat 2,450 in Phase 1", "detail": "Computed from 80 kg / 178 cm: maintenance ≈2,720 kcal, so Phase 1 runs a ~270 kcal deficit. Protein 150 g/day (≈1.9 g/kg) — anchor every meal to a protein source first.", "frequency": "daily", "whyYou": "because your stats (80 kg, 178 cm) set maintenance at ≈2,720 kcal — this target is computed from your body, not a template"}
- sample task: {"title": "Short textured crop, tapered sides — for your square face shape", "detail": "Your jaw:cheekbone ratio is 0.94 and symmetry 81 — keep volume on top, nothing hanging over the forehead line. Ask for texture on top, 0.5 taper on the sides.", "frequency": "once", "whyYou": "because your measured face shape is square with a jaw:cheekbone ratio of 0.94 — the cut keeps the jaw the widest point"}
Example 2 — inputs: dry skin, texture 72/100, ageRange "25-34", canthal tilt +3.5°, facial thirds 31/34/35, goalRanking ["glow","anti-aging"]. Plan: hydration layering leads — hyaluronic acid serum on damp skin, ceramide-rich cream moisturizer, lactic acid exfoliant 1x/week MAX. Style cites his geometry:
- sample task: {"title": "Lactic acid 5% — 1x/week maximum", "detail": "Pea-sized amount, one PM per week, on fully dry skin. Hard ceiling: never 2x/week on dry skin.", "frequency": "1x/week", "whyYou": "because your scan showed rougher texture (72/100) — exfoliation smooths texture, but dry skin gets 1x/week max to protect the barrier"}
- sample task: {"title": "Volume on top, soft fringe — balanced against a 35% lower third", "detail": "Your thirds run 31/34/35 with a +3.5° canthal tilt — height on top balances the longer lower third. Nothing slicked flat to the skull.", "frequency": "once", "whyYou": "because your measured facial thirds are 31/34/35 — the lower third runs long, so the style adds height, not width"}
Example 3 — inputs: combination skin, pigmentation 66/100, goalRanking ["de-tan","even tone"], sunExposure "outdoor", budgetTier "mid", timelineWeeks 8. Plan: de-tan protocol leads — vitamin C AM + azelaic/kojic PM + SPF 50+ PA++++ with reapplication discipline as the headline habit. Mid-tier product types only; checkpoints paced to his 8-week horizon:
- sample task: {"title": "SPF 50+ PA++++ — daily, with reapplication", "detail": "Two finger-lengths: face, ears, neck, every AM before you leave. Reapply every 2–3 hours outdoors — no exceptions on high-UV days.", "frequency": "daily", "whyYou": "because you ranked de-tan as your #1 goal and you're outdoors most of the day — sunscreen is what stops new tanning; the brighteners only work on top of it"}
- sample task: {"title": "Vitamin C serum 10–15% — 3 drops, AM", "detail": "Three drops on dry skin after cleansing, before moisturiser. Mid-tier types only — the molecule matters, not the label.", "frequency": "daily", "whyYou": "because your pigmentation reading is elevated (66/100) and de-tan is your #1 goal — vitamin C is the AM brightener paired with your PM azelaic acid"}`;

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
  userMessage: string,
  timeoutMs: number
): Promise<Response> {
  // Key is passed as a query param per the Gemini API contract; it is never logged.
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
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

type KeyAttempt =
  | { ok: true; plan: AscendPlan }
  | { ok: false; quota: boolean; error: string };

/**
 * Try one key across the model chain (primary → fallback). A quota/rate-limit
 * response abandons the key immediately (both models share its quota); other
 * failures fall through to the next model as before.
 */
async function tryKeyWithModels(
  apiKey: string,
  systemPrompt: string,
  userMessage: string,
  timeoutMs: number
): Promise<KeyAttempt> {
  const models = [PRIMARY_MODEL, FALLBACK_MODEL];
  let lastError = "unknown error";

  for (const model of models) {
    try {
      const res = await callGemini(model, apiKey, systemPrompt, userMessage, timeoutMs);
      if (!res.ok) {
        // Peek at the body only to detect quota exhaustion; never log it.
        const body = await res.text().catch(() => "");
        if (isQuotaError(res.status, body)) {
          return {
            ok: false,
            quota: true,
            error: `${model} returned HTTP ${res.status} (quota/rate limit)`,
          };
        }
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
      return { ok: true, plan: parsed };
    } catch (err) {
      // A timed-out (hung) call poisons the key for this request: abandon it
      // immediately and let the pool fail over, exactly like a quota hit.
      // Trying the fallback model on the same hung key would just burn
      // another 20s.
      if (isTimeoutError(err)) {
        const error = `${model} timed out after ${timeoutMs / 1000}s`;
        console.warn(`[plan] ${error}; abandoning key, failing over`);
        return { ok: false, quota: true, error };
      }
      lastError = err instanceof Error ? err.message : String(err);
      console.warn(`[plan] ${model} call failed: ${lastError}`);
    }
  }

  return { ok: false, quota: false, error: lastError };
}

/**
 * Run one generation pass through the key pool: keys in rotation order,
 * each tried across the model chain with the given per-attempt timeout.
 * Returns the first valid, safety-checked plan, or null when every
 * key/model failed.
 */
async function runPool(
  systemPrompt: string,
  userMessage: string,
  timeoutMs: number
): Promise<AscendPlan | null> {
  const keys = getApiKeys();
  const order = orderedKeyIndexes(keys.length, Date.now());
  let lastError = "unknown error";

  for (const keyIndex of order) {
    const attempt = await tryKeyWithModels(
      keys[keyIndex],
      systemPrompt,
      userMessage,
      timeoutMs
    );
    if (attempt.ok) return attempt.plan;
    lastError = attempt.error;
    if (attempt.quota) {
      keyCooldowns.set(keyIndex, Date.now() + KEY_COOLDOWN_MS);
      console.warn(
        `[plan] key #${keyIndex + 1} hit quota/rate limit; cooling down ${KEY_COOLDOWN_MS / 1000}s, failing over to next key`
      );
    }
  }

  console.warn(`[plan] generation pass exhausted all keys (${lastError})`);
  return null;
}

// ---------- Premium deep-curation pass ----------
//
// Premium tier runs ONE refinement pass over the standard draft: a second
// Gemini call (same pool/failover, longer per-attempt timeout) that audits
// the draft against the user's actual signals. The refined output passes
// the same schema validation + safety filter as any draft; on ANY failure
// the standard draft is served — premium is never worse than free.

const REFINEMENT_SYSTEM_PROMPT = `You are the senior curation editor for the "Ascend" app. You receive a DRAFT personalized plan (JSON) plus the user's measurements and quiz answers. Your job is a deep-curation pass — return a tightened, deepened version of the SAME plan. Output STRICT JSON matching the exact same AscendPlan schema as the draft (headline, scoreSummary, priorityFixes, sections with id/title/summary/whyForYou/weeks[{week, focus, tasks[{title, detail, frequency, whyYou}]}], disclaimers). No markdown fences, no prose outside the JSON.

CURATION CHECKLIST (apply every item):
1. TRIGGER CHECK: every task must carry a specific "whyYou" citing the user's actual measurement or quiz answer that triggered it. Rewrite any vague, generic, or missing whyYou so it names the concrete signal (a number, a ranked goal, a routine level, a lifestyle answer).
2. GOAL ORDERING: reorder sections so the section matching the user's #1 ranked goal leads, then #2, then the rest. Reorder priorityFixes the same way. Keep all 4 sections (ids: skin, diet, exercise, style), exactly 4 weeks per section, 2-4 tasks per week.
3. DEEPEN SPECIFICITY: make week-by-week tasks more concrete — quantities (amounts, minutes, sets/reps, two-finger lengths of SPF), week-over-week progressions (what is added or increased in weeks 2, 3 and 4), and substitutions (a swap for each key step when the primary isn't available or doesn't suit the user).
4. DELETE FILLER: remove or sharpen any task that could appear in anyone's plan unchanged. If a task doesn't depend on THIS user's signals, rewrite it until it does.
5. Keep the headline and scoreSummary accurate to the user's numbers; sharpen them if they read generic.
6. VOICE ENFORCEMENT: the plan must read like a paid protocol, never a chatbot answer. Strip greetings, motivation filler ("you've got this"), hedging ("it's important to remember"), and any meta commentary about the plan. Rewrite into terse imperative directives: every task detail ≤ 2 short sentences carrying specifics (quantities, percentages, grams, minutes, sets×reps, exact days, product strengths). Ban vague advice ("eat healthy", "exercise regularly"). Section summaries are ONE directive line. Confirm every section has a measurable "Checkpoint —" line in one week's focus and that hard rules stand alone as "RULE —" tasks (frequency "always").
7. SATURATION & PROJECTION AUDIT: every section must visibly cite at least 2–3 of THIS user's specific data points — measured degrees/percentages/ratios, skin-signal readings, their maintenance kcal and protein grams, their face shape by name, their ranked goals in their order, their budget tier, their timeline. Rewrite any section that could belong to anyone else. Audit the projection: horizon matches their timelineWeeks; outcomes are derived from their numbers (fat math: daily kcal change × horizon days ÷ 7700); framing stays "realistically achievable" — delete miracles, guarantees, and any 30-day-transformation language anywhere in the plan. The plan must read throughout as Phase 1 of the 12-week phased protocol.
8. FOUNDATIONS: the plan object you receive has NO "foundations" field and you must NOT add one — the deterministic vitals block (sleep, hydration, movement, non-negotiables) is built outside this pass and merged in afterwards, unchanged.

HARD CONSTRAINTS (identical to drafting — violating any of these fails the pass):
- Softmaxxing ONLY: skincare, hair, grooming, posture, fitness, nutrition, sleep, and style. No medical diagnoses of any kind.
- Never recommend drugs, hormones, or surgery — no finasteride, minoxidil regimens, steroids, testosterone, fillers, botox, rhinoplasty, or any surgical specifics.
- Prescription categories (tretinoin, isotretinoin, hydrocortisone, bimatoprost, minoxidil) may be MENTIONED only with "consult a dermatologist" framing — never recommended directly, never with dosages, strengths, or frequencies.
- Never mention aminophylline, xanthigen, GHK-Cu, or DSIP under any circumstances. Never recommend melatonin; for sleep issues say "discuss with a doctor".
- In disclaimers, never use the words diagnose/diagnosis/diagnostic — use "not medical advice" phrasing instead. Keep at least 3 disclaimers.
- Product TYPES only (e.g. "vitamin C serum") — never brand names.
- Direct coach voice — respectful, never shaming, zero motivation filler.`;

function buildRefinementMessage(req: PlanRequest, draft: AscendPlan): string {
  return [
    "## User measurements (deterministic scan)",
    JSON.stringify(req.measurements ?? { note: "no scan data provided" }, null, 2),
    "",
    "## Quiz answers",
    JSON.stringify(req.quiz, null, 2),
    "",
    "## Draft plan to curate (JSON)",
    JSON.stringify(draft, null, 2),
    "",
    "Apply the full curation checklist and return the refined AscendPlan JSON now. Strict JSON only.",
  ].join("\n");
}

async function generateWithGemini(
  req: PlanRequest
): Promise<{ plan: AscendPlan; source: "gemini" | "stub" }> {
  const kbExcerpts = getRelevantKbExcerpts(req.measurements, req.quiz);
  const userMessage = buildUserMessage(req, kbExcerpts);

  // Pass 1 — standard generation.
  const draft = await runPool(SYSTEM_PROMPT, userMessage, ATTEMPT_TIMEOUT_MS);
  if (!draft) {
    console.warn("[plan] standard generation failed on all keys; using stub plan");
    return { plan: buildStubPlan(req.measurements, req.quiz), source: "stub" };
  }

  // Pass 2 — deep-curation refinement. Any failure serves the draft:
  // premium is never worse than the standard generation.
  const refined = await runPool(
    REFINEMENT_SYSTEM_PROMPT,
    buildRefinementMessage(req, draft),
    PREMIUM_ATTEMPT_TIMEOUT_MS
  );
  if (refined) {
    console.log("[plan] premium refinement pass applied");
  } else {
    console.warn("[plan] premium refinement failed; serving standard draft");
  }

  // Foundations are deterministic — built by the KB, merged in unchanged.
  // The AI may rewrite protocol sections; it never touches the vitals.
  const aiPlan = refined ?? draft;
  return { plan: withFoundations(aiPlan, req), source: "gemini" };
}

/** Merge the deterministic Foundations block into an AI-generated plan. */
function withFoundations(plan: AscendPlan, req: PlanRequest): AscendPlan {
  return {
    ...plan,
    foundations: buildFoundations(req.measurements ?? null, req.quiz),
  };
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

    // Generation tier. v1 has no auth, so the client-sent value is accepted
    // as-is and the plan page always sends "free". v2: NEVER trust this
    // value — derive the tier server-side from the user's subscription
    // entitlement instead.
    const tier: "free" | "premium" =
      planReq.tier === "premium" ? "premium" : "free";

    // FREE tier: ZERO AI calls. The deterministic template engine is the
    // free product — protocol selection, every number, the projection and
    // the foundations are all computed from the user's own data, and
    // non-subscribers never consume Gemini quota.
    if (tier === "free") {
      const plan = buildStubPlan(planReq.measurements ?? null, planReq.quiz);
      logDiversity(plan);
      const res: PlanResponse = { plan, source: "stub" };
      return NextResponse.json(res);
    }

    // PREMIUM tier: two-pass AI curation. With no keys configured it
    // degrades to the same deterministic plan as free.
    if (getApiKeys().length === 0) {
      const plan = buildStubPlan(planReq.measurements ?? null, planReq.quiz);
      logDiversity(plan);
      const res: PlanResponse = { plan, source: "stub" };
      return NextResponse.json(res);
    }

    const result = await generateWithGemini(planReq);
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
