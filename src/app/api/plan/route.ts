// AUDIT FIX (2026-10-20) — BLOCKER: tier is now server-derived ONLY; the client-sent tier is ignored, so premium requires a validated premium/admin account (tokenless/garbage-token requests are free). Free plans are truncated server-side by truncateForFree (first 3 tasks per section real, the rest locked placeholders) so locked protocol content never ships behind the client blur. aiPending now means exactly "a background swap was scheduled" for a real account.
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
// PREMIUM: part-by-part AI generation — the 4 protocol sections plus a
// small frame call, all in parallel across the key pool, each part
// falling back to the deterministic engine's version of that part. The
// deterministic Foundations (vitals) block and projection are built by
// the KB and merged into premium plans unchanged — the AI never writes
// or rewrites them. Premium runs against a hard synchronous deadline:
// if no AI part has landed by then, the deterministic plan is served
// flagged aiPending and generation completes in the background via
// after(), replacing the saved plan when it lands.

import { NextRequest, NextResponse, after } from "next/server";
import { createClient } from "@supabase/supabase-js";
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

/** Premium requests can finish generating in the background (after())
 *  when the synchronous budget runs out — allow the function the room. */
export const maxDuration = 300;

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

/** Per-attempt timeouts for the part-by-part premium calls. A hung
 *  upstream request is worthless to wait on — abort it and fail over. */
const SECTION_ATTEMPT_TIMEOUT_MS = 25_000;
const FRAME_ATTEMPT_TIMEOUT_MS = 15_000;

/** Synchronous premium budget: a subscriber's request never waits longer
 *  than this for AI. Past it, the deterministic plan is served flagged
 *  aiPending and generation finishes in the background. */
const SYNC_DEADLINE_MS = 60_000;

/** Background budget for the after() completion of an aiPending plan. */
const BG_DEADLINE_MS = 240_000;

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
  return passesSafetyText(collectText(plan));
}

/** The same checks over raw text — used to vet individual AI-generated
 *  parts (one section, the frame) before they are merged into a plan. */
function passesSafetyText(raw: string): boolean {
  const lower = raw.toLowerCase();

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

function userDataBlock(req: PlanRequest, kbExcerpts: string): string {
  return [
    "## User measurements (deterministic scan)",
    JSON.stringify(req.measurements ?? { note: "no scan data provided" }, null, 2),
    "",
    "## Quiz answers",
    JSON.stringify(req.quiz, null, 2),
    "",
    "## Knowledge-base excerpts (ground every recommendation in these)",
    kbExcerpts,
  ].join("\n");
}

function buildSectionMessage(
  req: PlanRequest,
  kbExcerpts: string,
  draft: PlanSection
): string {
  return [
    userDataBlock(req, kbExcerpts),
    "",
    `## Section to write: "${draft.id}"`,
    "",
    "## Deterministic draft of this section (deepen it: sharpen every task with the user's own numbers, add quantities and week-over-week progressions, cut anything that could belong to anyone; keep exactly 4 weeks, 2-4 tasks per week)",
    JSON.stringify(draft, null, 2),
    "",
    "Write the section JSON now. Strict JSON only: the single section object, nothing else.",
  ].join("\n");
}

function buildFrameMessage(
  req: PlanRequest,
  kbExcerpts: string,
  draft: AscendPlan
): string {
  return [
    userDataBlock(req, kbExcerpts),
    "",
    "## Deterministic draft frame (sharpen it: numbers first, zero filler; keep the fixes ordered by the user's ranked goals)",
    JSON.stringify(
      {
        headline: draft.headline,
        scoreSummary: draft.scoreSummary,
        priorityFixes: draft.priorityFixes,
      },
      null,
      2
    ),
    "",
    "Write the frame JSON now. Strict JSON only: headline, scoreSummary, priorityFixes, nothing else.",
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
  | { ok: true; text: string }
  | { ok: false; quota: boolean; capacity: boolean; error: string };

/**
 * Try one key across the model chain (primary → fallback) and return the
 * raw response text. A quota/rate-limit response abandons the key
 * immediately (both models share its quota); a timeout does the same —
 * trying the fallback model on a hung key would just burn more time.
 * A 503 marks the attempt as a capacity failure (the model is melting,
 * not the key), which the pool counts toward its circuit breaker.
 * `deadline` is an absolute epoch-ms cap: no attempt starts past it and
 * every attempt's timeout is clamped to the time remaining.
 */
async function tryKeyRaw(
  apiKey: string,
  systemPrompt: string,
  userMessage: string,
  timeoutMs: number,
  deadline: number
): Promise<KeyAttempt> {
  const models = [PRIMARY_MODEL, FALLBACK_MODEL];
  let lastError = "unknown error";
  let capacity = false;

  for (const model of models) {
    const remaining = deadline - Date.now();
    if (remaining < 1_000) {
      return { ok: false, quota: false, capacity, error: "deadline reached" };
    }
    try {
      const res = await callGemini(
        model,
        apiKey,
        systemPrompt,
        userMessage,
        Math.min(timeoutMs, remaining)
      );
      if (!res.ok) {
        // Peek at the body only to detect quota exhaustion; never log it.
        const body = await res.text().catch(() => "");
        if (isQuotaError(res.status, body)) {
          return {
            ok: false,
            quota: true,
            capacity,
            error: `${model} returned HTTP ${res.status} (quota/rate limit)`,
          };
        }
        if (res.status === 503) capacity = true;
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
      return { ok: true, text };
    } catch (err) {
      if (isTimeoutError(err)) {
        const error = `${model} timed out`;
        console.warn(`[plan] ${error}; abandoning key, failing over`);
        return { ok: false, quota: true, capacity, error };
      }
      lastError = err instanceof Error ? err.message : String(err);
      console.warn(`[plan] ${model} call failed: ${lastError}`);
    }
  }

  return { ok: false, quota: false, capacity, error: lastError };
}

/**
 * Run one generation job through the key pool and parse its output.
 * Keys are tried in rotation order until one yields output that `parse`
 * accepts, the deadline passes, or the capacity circuit breaker trips:
 * 3 keys in a row reporting Google-side 503s means a capacity storm, in
 * which more keys will not help — the job aborts and the caller falls
 * back fast instead of stacking timeouts for minutes.
 */
async function runPoolText<T>(
  systemPrompt: string,
  userMessage: string,
  timeoutMs: number,
  deadline: number,
  parse: (text: string) => T | null
): Promise<T | null> {
  const keys = getApiKeys();
  if (keys.length === 0) return null;
  const order = orderedKeyIndexes(keys.length, Date.now());
  let capacityStreak = 0;

  for (const keyIndex of order) {
    if (Date.now() >= deadline) break;
    const attempt = await tryKeyRaw(
      keys[keyIndex],
      systemPrompt,
      userMessage,
      timeoutMs,
      deadline
    );
    if (attempt.ok) {
      const parsed = parse(attempt.text);
      if (parsed !== null) return parsed;
      console.warn("[plan] output failed validation; trying next key");
      capacityStreak = 0;
      continue;
    }
    if (attempt.quota) {
      keyCooldowns.set(keyIndex, Date.now() + KEY_COOLDOWN_MS);
      console.warn(
        `[plan] key #${keyIndex + 1} hit quota/rate limit; cooling down ${KEY_COOLDOWN_MS / 1000}s, failing over to next key`
      );
    }
    if (attempt.capacity) {
      capacityStreak += 1;
      if (capacityStreak >= 3) {
        console.warn(
          "[plan] capacity circuit breaker: 3 keys in a row hit 503s; aborting job"
        );
        break;
      }
    } else {
      capacityStreak = 0;
    }
  }

  console.warn("[plan] generation job exhausted all keys");
  return null;
}

// ---------- Premium generation: parallel, part by part ----------
//
// Premium plans are generated PART BY PART, in parallel: one call per
// protocol section plus one small "frame" call (headline, score summary,
// priority fixes). A single monolithic call had to emit the entire plan
// JSON at once — slow, prone to truncation against the output-token cap,
// and any validation failure restarted it from zero. Part-by-part calls
// are individually fast, run concurrently across the key pool, and fail
// independently: a failed part falls back to the deterministic engine's
// version of that same part, never to a lesser whole plan. Foundations
// and the projection always come from the KB engine unchanged.

const SECTION_MODE_SUFFIX = `

SECTION MODE — OUTPUT CONTRACT FOR THIS CALL:
Return ONLY the single section object as strict JSON: {"id", "title", "summary", "whyForYou", "weeks": [{"week", "focus", "tasks": [{"title", "detail", "frequency", "whyYou"}]}]}. No other fields, no markdown fences, no prose.
Apply every rule above to THIS section: saturate it with the user's own numbers (at least 2-3 specific data points), terse imperative protocol voice, quantities in every task detail, week-over-week progression, at least one "Checkpoint —" line in a week's focus, hard rules as "RULE —" tasks with frequency "always", and a specific whyYou on EVERY task citing its concrete trigger. Exactly 4 weeks, 2-4 tasks per week.`;

const FRAME_MODE_SUFFIX = `

FRAME MODE — OUTPUT CONTRACT FOR THIS CALL:
Return ONLY this frame object as strict JSON: {"headline": string, "scoreSummary": string, "priorityFixes": [{"title", "why", "impact": "high|medium|low", "effort": "low|medium|high"}]}. No other fields, no markdown fences, no prose.
Apply every rule above: the headline names the protocol like a product (never a full sentence, never a transformation promise); scoreSummary is at most 2 sentences, numbers first, zero encouragement padding; 3-5 priorityFixes ordered by the user's ranked goals, each "why" citing a concrete measurement or answer.`;

interface PlanFrame {
  headline: string;
  scoreSummary: string;
  priorityFixes: AscendPlan["priorityFixes"];
}

function isValidFrame(x: unknown): x is PlanFrame {
  if (typeof x !== "object" || x === null) return false;
  const o = x as Record<string, unknown>;
  if (typeof o.headline !== "string" || o.headline.trim().length === 0) return false;
  if (typeof o.scoreSummary !== "string" || o.scoreSummary.trim().length === 0) return false;
  if (!Array.isArray(o.priorityFixes) || o.priorityFixes.length < 3 || o.priorityFixes.length > 5) return false;
  return o.priorityFixes.every((f) => {
    if (typeof f !== "object" || f === null) return false;
    const fix = f as Record<string, unknown>;
    return (
      typeof fix.title === "string" &&
      typeof fix.why === "string" &&
      ["high", "medium", "low"].includes(fix.impact as string) &&
      ["low", "medium", "high"].includes(fix.effort as string)
    );
  });
}

function parseJsonLoose(text: string): unknown {
  try {
    return JSON.parse(cleanJson(text));
  } catch {
    return null;
  }
}

/** Generate ONE protocol section with the AI, or null on any failure. */
async function generateSection(
  req: PlanRequest,
  kbExcerpts: string,
  draft: PlanSection,
  deadline: number
): Promise<PlanSection | null> {
  return runPoolText(
    SYSTEM_PROMPT + SECTION_MODE_SUFFIX,
    buildSectionMessage(req, kbExcerpts, draft),
    SECTION_ATTEMPT_TIMEOUT_MS,
    deadline,
    (text) => {
      const parsed = parseJsonLoose(text);
      if (!isPlanSection(parsed) || parsed.id !== draft.id) return null;
      const sectionText = [
        parsed.title,
        parsed.summary,
        parsed.whyForYou,
        ...parsed.weeks.flatMap((w) => [
          w.focus,
          ...w.tasks.flatMap((t) => [t.title, t.detail, t.frequency]),
        ]),
      ].join("\n");
      return passesSafetyText(sectionText) ? parsed : null;
    }
  );
}

/** Generate the plan frame (headline, summary, fixes), or null. */
async function generateFrame(
  req: PlanRequest,
  kbExcerpts: string,
  draft: AscendPlan,
  deadline: number
): Promise<PlanFrame | null> {
  return runPoolText(
    SYSTEM_PROMPT + FRAME_MODE_SUFFIX,
    buildFrameMessage(req, kbExcerpts, draft),
    FRAME_ATTEMPT_TIMEOUT_MS,
    deadline,
    (text) => {
      const parsed = parseJsonLoose(text);
      if (!isValidFrame(parsed)) return null;
      const frameText = [
        parsed.headline,
        parsed.scoreSummary,
        ...parsed.priorityFixes.flatMap((f) => [f.title, f.why]),
      ].join("\n");
      return passesSafetyText(frameText) ? parsed : null;
    }
  );
}

/**
 * Assemble a premium plan: deterministic engine output as the chassis
 * (foundations, projection, disclaimers, section order by ranked goals),
 * with every part the AI successfully generates swapped in. `source` is
 * "gemini" when at least one part came from the AI; "stub" when nothing
 * landed before the deadline (the caller then flags the plan aiPending
 * and, for account holders, finishes the job in the background).
 */
async function generatePremiumPlan(
  req: PlanRequest,
  deadline: number
): Promise<{ plan: AscendPlan; source: "gemini" | "stub" }> {
  const stub = buildStubPlan(req.measurements ?? null, req.quiz);
  if (getApiKeys().length === 0) return { plan: stub, source: "stub" };
  const kbExcerpts = getRelevantKbExcerpts(req.measurements, req.quiz);

  const [frame, ...aiSections] = await Promise.all([
    generateFrame(req, kbExcerpts, stub, deadline),
    ...stub.sections.map((draft) =>
      generateSection(req, kbExcerpts, draft, deadline)
    ),
  ]);

  const aiById = new Map<string, PlanSection>();
  for (const s of aiSections) if (s) aiById.set(s.id, s);
  if (aiById.size === 0 && !frame) {
    console.warn(
      "[plan] premium part-by-part generation produced nothing; serving deterministic plan"
    );
    return { plan: stub, source: "stub" };
  }

  const plan: AscendPlan = {
    ...stub,
    sections: stub.sections.map((draft) => aiById.get(draft.id) ?? draft),
    ...(frame
      ? {
          headline: frame.headline,
          scoreSummary: frame.scoreSummary,
          priorityFixes: frame.priorityFixes,
        }
      : {}),
  };
  if (!passesSafetyFilter(plan)) {
    console.warn(
      "[plan] merged premium plan failed the safety filter; serving deterministic plan"
    );
    return { plan: stub, source: "stub" };
  }
  console.log(
    `[plan] premium plan assembled: ${aiById.size}/4 AI sections${frame ? " + AI frame" : ""}`
  );
  return { plan, source: "gemini" };
}

/** One-line diversity note per generated plan (personalization spec guardrail 4). */
function logDiversity(plan: AscendPlan): void {
  const types = extractProductTypes(plan);
  const triggers = topTriggerSources(plan).slice(0, 3);
  console.log(
    `[plan] diversity: ${types.length} product types; triggers: ${triggers.join(", ") || "n/a"}`
  );
}

/** Service-role Supabase client (bypasses RLS). Null when unconfigured. */
function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

/** Resolve a Supabase access token to the account's id + entitlement
 *  flags. Returns null on any problem (unconfigured, bad token) so
 *  generation never breaks because of auth — the caller falls back to
 *  the client tier. */
async function entitlementForToken(
  token: string,
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

/** Free-preview allowance: the first 3 tasks per protocol section ship
 *  in full; everything past that is replaced with a locked placeholder
 *  BEFORE the response leaves the server (audit fix, 2026-10-20 — the
 *  earlier build shipped the full protocol and only blurred it in the
 *  browser, so the "locked" content was readable in the network tab).
 *  Mirrors FREE_TASKS_PER_SECTION on the plan page exactly: earliest
 *  weeks first, budget spent per section. Placeholders keep the task
 *  shape (and frequency) so the page renders the same full-size locked
 *  layout — with nothing real behind the blur. */
const FREE_TASKS_PER_SECTION = 3;

function truncateForFree(plan: AscendPlan): AscendPlan {
  return {
    ...plan,
    sections: plan.sections.map((section) => {
      let budget = FREE_TASKS_PER_SECTION;
      return {
        ...section,
        weeks: section.weeks.map((week) => {
          if (budget <= 0) {
            return {
              ...week,
              focus: "Pro protocol",
              tasks: week.tasks.map((t) => ({
                title: "Pro protocol step",
                detail:
                  "This step is part of the full Ascend Pro protocol.",
                frequency: t.frequency,
                whyYou: "",
              })),
            };
          }
          const shown = week.tasks.slice(0, budget);
          const rest = week.tasks.slice(budget).map((t) => ({
            title: "Pro protocol step",
            detail: "This step is part of the full Ascend Pro protocol.",
            frequency: t.frequency,
            whyYou: "",
          }));
          budget -= shown.length;
          return { ...week, tasks: [...shown, ...rest] };
        }),
      };
    }),
  };
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

    // Generation tier — SERVER-DERIVED ONLY (audit fix, 2026-10-20).
    // The client-sent tier is ignored entirely: premium requires a
    // validated Supabase session whose profile is premium or admin.
    // Tokenless and invalid-token requests are free, full stop — the
    // earlier build trusted the body's tier field, which made the
    // premium AI pipeline (and the shared Gemini quota) free to anyone.
    let tier: "free" | "premium" = "free";
    let uid: string | null = null;
    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const ent = await entitlementForToken(authHeader.slice(7));
      if (ent) {
        tier = ent.is_premium || ent.is_admin ? "premium" : "free";
        uid = ent.userId;
      }
    }

    // FREE tier: ZERO AI calls. The deterministic template engine is the
    // free product — protocol selection, every number, the projection and
    // the foundations are all computed from the user's own data, and
    // non-subscribers never consume Gemini quota. Locked protocol content
    // is truncated server-side (see truncateForFree) — it never ships.
    if (tier === "free") {
      const plan = truncateForFree(
        buildStubPlan(planReq.measurements ?? null, planReq.quiz)
      );
      logDiversity(plan);
      const res: PlanResponse = { plan, source: "stub", tier };
      return NextResponse.json(res);
    }

    // PREMIUM tier: two-pass AI curation. With no keys configured it
    // degrades to the same deterministic plan as free.
    if (getApiKeys().length === 0) {
      const plan = buildStubPlan(planReq.measurements ?? null, planReq.quiz);
      logDiversity(plan);
      const res: PlanResponse = { plan, source: "stub", tier };
      return NextResponse.json(res);
    }

    const result = await generatePremiumPlan(
      planReq,
      Date.now() + SYNC_DEADLINE_MS
    );
    logDiversity(result.plan);
    if (result.source === "gemini") {
      const res: PlanResponse = { plan: result.plan, source: "gemini", tier };
      return NextResponse.json(res);
    }

    // The AI didn't land inside the sync deadline (usually a Google
    // capacity spell). The subscriber still gets the complete
    // deterministic protocol NOW, flagged aiPending. With an account,
    // the plan is saved server-side and generation keeps running in the
    // background via after() — the deep-curated version replaces the
    // saved plan in their dashboard when it lands.
    const pendingPlan: AscendPlan = { ...result.plan, aiPending: true };
    let scheduled = false;
    const admin = uid ? serviceClient() : null;
    if (uid && admin) {
      const { data: row } = await admin
        .from("plans")
        .insert({
          user_id: uid,
          scan_id: planReq.scanId ?? null,
          tier,
          plan: pendingPlan,
        })
        .select("id")
        .single();
      if (row) {
        scheduled = true;
        const rowId = (row as { id: string }).id;
        after(async () => {
          try {
            const retry = await generatePremiumPlan(
              planReq,
              Date.now() + BG_DEADLINE_MS
            );
            // Success swaps in the curated plan; failure clears the
            // pending flag so the dashboard never promises forever.
            const finalPlan =
              retry.source === "gemini" ? retry.plan : result.plan;
            await admin
              .from("plans")
              .update({ plan: finalPlan })
              .eq("id", rowId);
          } catch {
            /* the saved deterministic protocol stands on its own */
          }
        });
      }
    }
    // Premium now implies a validated account (uid is always set in
    // this branch), so the pending state is exactly "a background swap
    // was scheduled" — never an unbacked promise to an anonymous caller.
    const deliverPending = scheduled;
    const res: PlanResponse = {
      plan: deliverPending ? pendingPlan : result.plan,
      source: "stub",
      tier,
      aiPending: deliverPending,
    };
    return NextResponse.json(res);
  } catch (err) {
    console.error("[plan] unexpected error:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: "Failed to generate plan" },
      { status: 500 }
    );
  }
}
