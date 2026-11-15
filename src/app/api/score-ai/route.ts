// AI soft-scoring endpoint — slice 1 of the PSL blend (2026-11-14).
//
// The blend (Zayne's design, 50/50 adopted 2026-11-14 23:03 IST): PSL
// = G + A on the /8 scale — GEOMETRY decides 4 points, AI decides 4.
// Geometry keeps the bone — Harmony, Dimorphism, Definition stay
// deterministic, measured from the face mesh in the app. The AI scores
// the soft stuff geometry gets wrong: skin quality, eye area as it
// looks, hair/framing, overall impression, and photo quality as a
// confidence signal. The AI NEVER gives an overall PSL and NEVER
// offers a free-form opinion: it scores named criteria against the PSL
// framework and explains each in one line. If a criterion cannot be
// judged from the photo, it returns null for it — never invented.
//
// Merge (proved in ~/workspace/psl-accuracy-harness/blend_test.mjs,
// NOT wired into the app yet):
//   G = clamp(4.0 + (B − 68) / 12.5, 0.5, 7.9) / 2, where B is the
//     bone-only weighted mean (0.40·H + 0.20·Dim + 0.25·Def) / 0.85.
//     G is exactly half the geometry-only PSL the current engine
//     would give for the bone alone — same anchor (68), same slope
//     (12.5) — so the geometry half inherits the existing calibration
//     (average face: B ≈ 68 → G ≈ 2.0).
//   A = mean of the AI's non-null scores / 25. Pro mode: 4 region
//     scores + 4 face criteria (8 signals). Free mode: 4 face
//     criteria only (no regions). photoQuality never enters A (it is
//     a confidence signal, not a face score). Each AI score is 0–100
//     with 50 = average, so the mean maps linearly to 0–4 with 2.0 at
//     average. softComposite (returned here) is the mean of the 4
//     face criteria — the free-mode A numerator, and half the pro
//     numerator.
//   RE-CENTRING (slice 2): the model scores generously — run-6 raw
//     centre 82.6/100, not 50 — so mean A came out 3.33 and the blend
//     inflated every face ~+1.0 PSL. Every face score is shifted down
//     by RECENTER_SHIFT (25) at parse time, so the AI half centres at
//     2.0/4 on an average face (fit: 17 run-6 face-modes, target mean
//     A = geometry mean − mean G = 2.30, shift 24.8 → rounded to 25).
//     The response carries rawMean (mean of the raw scores) so the
//     shift can be re-fit from production data later. photoQuality is
//     NOT re-centred (confidence signal, not a face score).
//   PSL = clamp(G + A, 0.5, 7.9). The pixel Misc term is RETIRED under
//     50/50 — the AI owns the soft layer entirely. The merge runs
//     SERVER-SIDE here (slice 2): the caller sends the geometry
//     buckets (harmony/dimorphism/definition) and this route returns
//     blendedPsl + gPart + aPart alongside the AI scores, so there is
//     one source of truth for the blend. The harness cross-checks the
//     route's blendedPsl against its own merge on every call.
//     FALLBACK: if the AI call fails, the caller returns 2G — the
//     bone-only PSL — because with no AI there is no soft layer to
//     fall back to.
//
// REGIONS (Zayne 2026-11-14, overrides the geometry region reads): the
// AI ALSO decides the four deck region scores — Eyes, Midface, Lower
// Third, Upper Third — because geometry does them wrong. The AI's
// region scores are FINAL: no geometry blending or override. The
// geometry region scores are deliberately NOT sent in the prompt, so
// the AI judges the regions fresh from the photo instead of being
// anchored to the wrong numbers. GATING (Zayne 2026-11-14, corrected
// 22:56 IST): the AI covers whatever the user can SEE (whatever is
// unblurred). Free users DO get the AI call — for the headline they
// see (the Misc term feeding PSL + Potential). ONLY region scoring is
// Pro-only, because free users never see the regions (locked/blurred).
// The request takes `includeRegions` (default true): false = free mode
// (5 soft criteria only, regions: null), true = pro mode (criteria +
// the 4 region scores). The caller (slice 2) passes the flag from the
// user's tier.
//
// POTENTIAL (Zayne 2026-11-14, corrected 23:00 IST): the AI gives
// Potential (0–8 scale + one-line reason) DERIVED FROM THE SCORES —
// the region scores + soft criteria + supplied geometry measurements —
// NOT a separate holistic judgment from the photo. The derivation is
// structured (slice 2): the model shows its working — currentEstimate
// (its read of the CURRENT level from the scores) + headroom (the
// realistic gain from fixing what is fixable, 0–2.0). The value is
// ANCHORED to the displayed score: value = blended PSL + headroom,
// so Potential always means "your PSL could reach X" relative to the
// PSL the user actually sees (the model's currentEstimate is advisory
// only). When the blend cannot be computed (no geometry buckets in
// the request), the value falls back to currentEstimate + headroom.
// Either way the route recomputes the value from the components, so
// it can never contradict its reason again (slice 1: "little room
// left" + 7.7). The reason must name the specific improvements that
// make up the headroom. Potential is unblurred for everyone, so it is
// returned in BOTH modes. In free mode the derivation uses the soft
// criteria + geometry (no regions exist in that call).
//
// Failure is explicit and fast: a 20s hard timeout per Gemini attempt,
// a 55s overall deadline, and a 503 { ok: false, error:
// "ai_unavailable" } when every attempt fails — the caller then falls
// back to geometry-only. The route never blocks a scan on AI.
// (The timeout was 10s in the first draft: vision calls through this
// egress path usually take 10–20s, and with 10s EVERY call in the
// harness deadlined — 4/4 at a 25s deadline, 3/3 at 55s. 20s keeps a
// hard cap on any single call while letting real attempts land.)
//
// Auth/entitlement (slice 2): ENFORCED. Same pattern as
// /api/weekly-plan and /api/plan — Bearer token → Supabase
// admin.auth.getUser → profiles (is_admin, is_premium). No token or
// an invalid token → 401. The free/pro mode comes from the SERVER
// tier, not the client flag: regions are scored only when the caller
// is premium/admin AND did not explicitly ask for free mode. A free
// user sending includeRegions=true still gets regions: null. A valid
// session with NO profile row (e.g. an anonymous/guest session) is
// treated as free, not rejected — free users are entitled to this
// endpoint; only an invalid token gets a 401.

import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

// Scoring ladder: full Flash first (scoring quality matters here —
// Flash-Lite is a last resort only, and the response names the model
// actually used so a Lite fallback is visible, never silent). 3.6
// LEADS: a trivial text probe of 3.8 hung past 30s while 3.6 answered
// in ~15s, so 3.8 is escalation only, not the first attempt.
const FLASH_LEAD = "gemini-3.6-flash";
const FLASH_ALT = "gemini-3.8-flash";
const LITE_MODEL = "gemini-3.5-flash-lite";

// Hard timeout per Gemini attempt; overall deadline for the route.
// Attempts are 25s: a trivial TEXT probe of gemini-3.6-flash took ~15s
// through this egress path (and 3.8 hung past 30s), so 10s — and then
// 20s — timeouts killed every vision call in the harness. 25s still
// hard-caps any single call. Deadline is 55s (maxDuration 60): ~2
// full attempts + the Lite fallback fit inside it. 5 keys max on
// Flash: fast failures (403s from dead pool keys) cost <1s each, so
// more keys get a chance without blowing the deadline.
const ATTEMPT_TIMEOUT_MS = 25_000;
const OVERALL_DEADLINE_MS = 55_000;
const MAX_FLASH_KEYS = 5;
const KEY_COOLDOWN_MS = 60_000;

// Base64 photo cap (~3 MB of image). Harness photos are ≤ 460 KB.
const MAX_PHOTO_CHARS = 4_000_000;

// Re-centring shift (slice 2): points subtracted from every AI face
// score at parse time. Fit on run-6 (17 face-modes, raw centre 82.6,
// target mean A 2.30 → shift 24.8, rounded to 25). Re-fit from
// production rawMean data when real scans exist — never guess.
const RECENTER_SHIFT = 25;

// Sanity bound on the AI's Potential headroom: no face realistically
// gains more than 2.0 PSL from looksmaxxing. Only binds on
// inconsistent outputs (slice 1: headroom up to 2.3 while the reason
// said "little room left").
const HEADROOM_MAX = 2.0;

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

/** Round to 2 decimals — kills float artefacts like 3.9000000000000004. */
const round2 = (v: number) => Math.round(v * 100) / 100;

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

type CriterionName =
  | "skinQuality"
  | "eyeArea"
  | "hairFraming"
  | "overallImpression"
  | "photoQuality";

const CRITERIA: CriterionName[] = [
  "skinQuality",
  "eyeArea",
  "hairFraming",
  "overallImpression",
  "photoQuality",
];

/** The four face criteria that enter the soft composite. photoQuality
 *  is a confidence signal only — a bad photo must not lower the face
 *  score. */
const FACE_CRITERIA: CriterionName[] = [
  "skinQuality",
  "eyeArea",
  "hairFraming",
  "overallImpression",
];

// NOTE (slice 4 A/B): the audit's §4d offered "face-only text OR drop
// overallImpression from the A mean". The A/B re-ran both: the
// exclusion's SD benefit was ~0.02 (negligible) while it cost ordering
// (Spearman 0.82 → 0.78), so the exclusion was NOT kept — the face-only
// criterion text (item 4 below) is the fix, and overallImpression stays
// in the mean as a face criterion. Do not re-add the exclusion without
// a fresh A/B showing it helps.

type CriterionScore = { score: number | null; reason: string };
type Criteria = Record<CriterionName, CriterionScore>;

type RegionName = "eyes" | "midface" | "lowerThird" | "upperThird";

const REGION_NAMES: RegionName[] = [
  "eyes",
  "midface",
  "lowerThird",
  "upperThird",
];

type Regions = Record<RegionName, CriterionScore>;

/** Potential, 0–8 scale (same as PSL), derived by the AI from the
 *  scores — never a separate photo judgment. The model shows its
 *  working: value = currentEstimate + headroom. The route recomputes
 *  the value from the components when both are present, so the value
 *  can never contradict the reason. */
type Potential = {
  value: number | null;
  reason: string;
  currentEstimate: number | null;
  headroom: number | null;
};

// Prompt version: v1 = the original prompt (pre-slice-4); v2 = the
// hardened prompt below (PSL fix slice 4, audit §4d). Returned in
// every success response so a score's prompt is provable from the
// response itself — and so a deploy can be verified by polling for
// the new version instead of guessing from behaviour.
const PROMPT_VERSION = 2;

const SYSTEM_PROMPT = [
  "You are a looksmaxxing face analyst scoring ONLY soft criteria against the PSL framework.",
  "You do NOT give an overall attractiveness score, a PSL, or a free-form opinion.",
  "Score each named criterion 0-100, where 50 is average for a young adult male face.",
  // PSL fix slice 4 (audit §4d): the FACE gets scored, not the photo.
  // The old instruction ("Judge ONLY what you can see in this photo")
  // let lighting, smoothing and framing move the scores — the same
  // face scored 1.5 PSL apart across two photos.
  "Judge the underlying FACE, not this photo. Two photos of the same face must receive the same scores. Ignore lighting, image quality, digital smoothing or filters, background, clothing, and the person's momentary expression.",
  "Most faces score between 35 and 65 on any criterion. Above 80 means exceptional — rarer than 1 in 20. Do not score generously.",
  "If a criterion cannot be judged (for example hair not visible), return null for its score and say why in the reason. NEVER invent detail you cannot see.",
  "Keep each reason to one short sentence.",
].join(" ");

function buildUserText(
  geometry: Record<string, unknown> | null,
  includeRegions: boolean
): string {
  const lines: string[] = [
    "Score ONLY these 5 soft criteria for the face in this photo, as strict JSON:",
    "",
    // Per-criterion ignore lists (slice 4): each criterion names what
    // the model must NOT let move it.
    "1. skinQuality — skin clarity, texture, acne, redness, evenness of tone. Discount digital smoothing or filters — score the skin you can actually see, not the filter.",
    "2. eyeArea — the eye area as it looks: eyelid exposure, under-eye darkness or bags, eye shape impression, hunter vs tired read. Ignore shadows and lighting — score the eye area itself, not the light falling on it.",
    "3. hairFraming — hairline, hair fullness, how the hair frames the face. Judge the hair itself, not the styling or the light. Null if hair is not visible.",
    "4. overallImpression — the face as a whole: how the features read together as a FACE — bone, balance, harmony. NOT expression, NOT presence, NOT the photo. This is a soft-criterion read of the whole face, NOT an overall attractiveness score.",
    "5. photoQuality — how well this photo serves scoring: lighting, angle, sharpness, framing. This is a confidence signal, not a face score. If photoQuality is below 60, pull every face score toward 50 in proportion to how far below 60 it is — a bad photo must never produce extreme face scores.",
  ];
  // Geometry FIRST (slice 4): the Potential paragraph below refers to
  // "the geometry measurements above" — the old code appended the
  // geometry JSON AFTER that paragraph, so "above" was a lie.
  if (geometry) {
    lines.push(
      "",
      "Geometry already measured this face (do NOT re-score bone structure — it is already exact):",
      JSON.stringify(geometry)
    );
  }
  if (includeRegions) {
    lines.push(
      "",
      "ALSO score the 4 face regions below. These are the deck scores the user sees — judge each region fresh from the photo, as a whole, on the same 0-100 scale (50 = average):",
      "",
      "6. eyes — the eye region as a whole: eye shape, spacing, tilt, brow position, how the eyes read together.",
      "7. midface — the middle third: cheekbone prominence, midface length and compactness, balance from under-eye to mouth.",
      "8. lowerThird — jaw, chin, lips, lower-face balance and definition.",
      "9. upperThird — forehead proportion, hairline, temple width, brow line.",
      "",
      "LAST — Potential, derived FROM THE SCORES you have just produced (regions + soft criteria) plus the geometry measurements above — do NOT re-judge the photo independently for Potential. Show your working in three steps: (1) currentEstimate — your read of this face's CURRENT level on the 0–8 scale, from the scores (near the geometry PSL, raised by strong soft scores, lowered by weak ones); (2) headroom — the REALISTIC gain on the 0–8 scale from fixing what is fixable (0 when the scores are already high — little room left means SMALL headroom, never more than 2.0; larger only when strong bone pairs with weak soft scores); (3) value = currentEstimate + headroom. Your one-line reason MUST name the specific improvements that make up the headroom (for example 'clearing acne + better hair framing'), and MUST be consistent with the headroom size — if you say little room is left, the headroom must be small.",
      "",
      "Return exactly this shape, nothing else:",
      '{ "skinQuality": { "score": 0-100 or null, "reason": "..." }, "eyeArea": { "score": ..., "reason": "..." }, "hairFraming": { "score": ..., "reason": "..." }, "overallImpression": { "score": ..., "reason": "..." }, "photoQuality": { "score": ..., "reason": "..." }, "regions": { "eyes": { "score": ..., "reason": "..." }, "midface": { "score": ..., "reason": "..." }, "lowerThird": { "score": ..., "reason": "..." }, "upperThird": { "score": ..., "reason": "..." } }, "potential": { "value": 0-8 or null, "reason": "...", "currentEstimate": 0-8 or null, "headroom": 0-2 or null } }'
    );
  } else {
    lines.push(
      "",
      "LAST — Potential, derived FROM THE SCORES you have just produced (soft criteria) plus the geometry measurements above — do NOT re-judge the photo independently for Potential. Show your working in three steps: (1) currentEstimate — your read of this face's CURRENT level on the 0–8 scale, from the scores (near the geometry PSL, raised by strong soft scores, lowered by weak ones); (2) headroom — the REALISTIC gain on the 0–8 scale from fixing what is fixable (0 when the scores are already high — little room left means SMALL headroom, never more than 2.0; larger only when strong bone pairs with weak soft scores); (3) value = currentEstimate + headroom. Your one-line reason MUST name the specific improvements that make up the headroom (for example 'clearing acne + better hair framing'), and MUST be consistent with the headroom size — if you say little room is left, the headroom must be small.",
      "",
      "Return exactly this shape, nothing else:",
      '{ "skinQuality": { "score": 0-100 or null, "reason": "..." }, "eyeArea": { "score": ..., "reason": "..." }, "hairFraming": { "score": ..., "reason": "..." }, "overallImpression": { "score": ..., "reason": "..." }, "photoQuality": { "score": ..., "reason": "..." }, "potential": { "value": 0-8 or null, "reason": "...", "currentEstimate": 0-8 or null, "headroom": 0-2 or null } }'
    );
  }
  return lines.join("\n");
}

async function callGemini(
  model: string,
  apiKey: string,
  photoBase64: string,
  mimeType: string,
  userText: string,
  timeoutMs: number
): Promise<Response> {
  // Key is passed as a query param per the Gemini API contract; it is never logged.
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType, data: photoBase64 } },
            { text: userText },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        // Low temperature: scoring must be stable, not creative.
        temperature: 0.2,
        // 9 scored items with reasons in pro mode (5 criteria + 4
        // regions); 5 in free mode.
        maxOutputTokens: 1536,
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

/** Parse one { score, reason } entry. Null score WITH a reason
 *  ("hair not visible") is a real answer, not a failure. Face scores
 *  are RE-CENTRED (RECENTER_SHIFT) at parse time — the model scores
 *  generously (run-6 raw centre 82.6, not 50). photoQuality passes
 *  recenter=false: it is a confidence signal, not a face score. */
function parseEntry(entry: unknown, recenter = true): CriterionScore {
  let score: number | null = null;
  let reason = "";
  if (typeof entry === "object" && entry !== null) {
    const s = (entry as { score?: unknown }).score;
    const r = (entry as { reason?: unknown }).reason;
    if (s === null) score = null;
    else if (typeof s === "number" && Number.isFinite(s)) {
      const clamped = clamp(s, 0, 100);
      score = recenter
        ? clamp(clamped - RECENTER_SHIFT, 0, 100)
        : clamped;
    }
    if (typeof r === "string") reason = r.slice(0, 200);
  }
  return { score, reason };
}

/**
 * Validate the model's JSON into Criteria (+ Regions when requested,
 * + Potential always). Returns null when the payload is unparseable or
 * contains NO valid criterion at all — a model failure, not a score.
 * Regions are parsed only when includeRegions; a missing/empty regions
 * object in pro mode does NOT fail the call (the criteria still stand
 * — the caller keeps geometry regions for that scan). Potential is
 * parsed in both modes; a missing one comes back null with an empty
 * reason rather than failing the call. rawMean is the mean of the RAW
 * (pre-re-centring) scores that enter A — the drift signal for future
 * re-fits of RECENTER_SHIFT.
 */
function parseScoring(
  rawText: string,
  includeRegions: boolean
): {
  criteria: Criteria;
  regions: Regions | null;
  potential: Potential;
  rawMean: number | null;
} | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleanJson(rawText));
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const obj = parsed as Record<string, unknown>;
  const criteria = {} as Criteria;
  let valid = 0;
  for (const name of CRITERIA) {
    const entry = parseEntry(obj[name], name !== "photoQuality");
    if (entry.score !== null || entry.reason.length > 0) valid += 1;
    criteria[name] = entry;
  }
  if (valid === 0) return null;
  let regions: Regions | null = null;
  const robj =
    typeof obj.regions === "object" && obj.regions !== null
      ? (obj.regions as Record<string, unknown>)
      : {};
  if (includeRegions) {
    regions = {} as Regions;
    for (const name of REGION_NAMES) {
      regions[name] = parseEntry(robj[name]);
    }
  }
  // rawMean: mean of the raw scores that enter A (face criteria +
  // regions when present; photoQuality excluded). Read from the raw
  // JSON — parseEntry already re-centred the parsed copies.
  const rawVals: number[] = [];
  const rawScoreOf = (e: unknown): number | null => {
    if (typeof e !== "object" || e === null) return null;
    const s = (e as { score?: unknown }).score;
    return typeof s === "number" && Number.isFinite(s) ? s : null;
  };
  for (const name of FACE_CRITERIA) {
    const s = rawScoreOf(obj[name]);
    if (s !== null) rawVals.push(s);
  }
  if (includeRegions) {
    for (const name of REGION_NAMES) {
      const s = rawScoreOf(robj[name]);
      if (s !== null) rawVals.push(s);
    }
  }
  const rawMean =
    rawVals.length > 0
      ? rawVals.reduce((a, b) => a + b, 0) / rawVals.length
      : null;
  let potential: Potential = {
    value: null,
    reason: "",
    currentEstimate: null,
    headroom: null,
  };
  const p = obj.potential;
  if (typeof p === "object" && p !== null) {
    const v = (p as { value?: unknown }).value;
    const r = (p as { reason?: unknown }).reason;
    const ce = (p as { currentEstimate?: unknown }).currentEstimate;
    const hr = (p as { headroom?: unknown }).headroom;
    // Parse only — the value is anchored in anchorPotential() (which
    // needs the blended PSL, computed after the merge). The model's
    // stated value survives only when neither anchor is available.
    potential = {
      value:
        typeof v === "number" && Number.isFinite(v)
          ? round2(clamp(v, 0, 8))
          : null,
      reason: typeof r === "string" ? r.slice(0, 200) : "",
      currentEstimate:
        typeof ce === "number" && Number.isFinite(ce)
          ? round2(clamp(ce, 0, 8))
          : null,
      headroom:
        typeof hr === "number" && Number.isFinite(hr)
          ? round2(clamp(hr, 0, HEADROOM_MAX))
          : null,
    };
  }
  return { criteria, regions, potential, rawMean };
}

/** Mean of the non-null FACE criteria. Null when all four are null. */
function softCompositeOf(criteria: Criteria): number | null {
  const scores = FACE_CRITERIA.map((n) => criteria[n].score).filter(
    (s): s is number => s !== null
  );
  if (scores.length === 0) return null;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

// ---------- 50/50 merge (server-side, single source of truth) ----------

/** The geometry half G from the bone buckets (0–100). Null when any
 *  bucket is missing — the caller must send harmony/dimorphism/
 *  definition for the blend. Same anchor (68) and slope (12.5) as
 *  the geometry engine; this function READS the buckets, it never
 *  re-scores anything. */
function gPartOf(geometry: Record<string, unknown> | null): number | null {
  if (!geometry) return null;
  const h = geometry.harmony;
  const d = geometry.dimorphism;
  const def = geometry.definition;
  if (
    typeof h !== "number" ||
    typeof d !== "number" ||
    typeof def !== "number"
  ) {
    return null;
  }
  const boneMean = (0.4 * h + 0.2 * d + 0.25 * def) / 0.85;
  return clamp(4.0 + (boneMean - 68) / 12.5, 0.5, 7.9) / 2;
}

/** The AI half A: mean of the non-null re-centred scores / 25. Pro:
 *  4 regions + 4 face criteria. Free: 4 face criteria. Null when no
 *  score exists. photoQuality never enters A. The native client's
 *  aiHalf() in faceScore.ts MUST mirror this list exactly — it
 *  re-derives A from the stored criteria. */
function aPartOf(criteria: Criteria, regions: Regions | null): number | null {
  const vals: number[] = [];
  for (const n of FACE_CRITERIA) {
    const s = criteria[n].score;
    if (s !== null) vals.push(s);
  }
  if (regions) {
    for (const n of REGION_NAMES) {
      const s = regions[n].score;
      if (s !== null) vals.push(s);
    }
  }
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length / 25;
}

interface Blend {
  gPart: number | null;
  aPart: number | null;
  blendedPsl: number | null;
}

/** The 50/50 merge. blendedPsl is null when the geometry buckets
 *  are missing (old caller) or the AI scored nothing. */
function mergeBlend(
  geometry: Record<string, unknown> | null,
  criteria: Criteria,
  regions: Regions | null
): Blend {
  const gPart = gPartOf(geometry);
  const aPart = aPartOf(criteria, regions);
  const blendedPsl =
    gPart !== null && aPart !== null
      ? round2(clamp(gPart + aPart, 0.5, 7.9))
      : null;
  return {
    gPart: gPart === null ? null : round2(gPart),
    aPart: aPart === null ? null : round2(aPart),
    blendedPsl,
  };
}

/**
 * Anchor Potential to the displayed score. Precedence:
 *   1. blended PSL + headroom (the normal path — Potential means
 *      "your PSL could reach X" relative to the PSL shown).
 *   2. currentEstimate + headroom (no geometry buckets in the
 *      request, so no blend exists).
 *   3. The model's stated value, as parsed (no components at all).
 * The headroom is always the AI's own determination from the
 * scores; only the base changes. The reason is the model's own.
 */
function anchorPotential(potential: Potential, blendedPsl: number | null): Potential {
  const { value, reason, currentEstimate, headroom } = potential;
  if (blendedPsl !== null && headroom !== null) {
    return {
      value: round2(clamp(blendedPsl + headroom, 0, 8)),
      reason,
      currentEstimate,
      headroom,
    };
  }
  if (currentEstimate !== null && headroom !== null) {
    return {
      value: round2(clamp(currentEstimate + headroom, 0, 8)),
      reason,
      currentEstimate,
      headroom,
    };
  }
  return potential;
}

type Attempt =
  | {
      ok: true;
      model: string;
      criteria: Criteria;
      regions: Regions | null;
      potential: Potential;
      rawMean: number | null;
    }
  | {
      ok: false;
      quota: boolean;
      fatal: boolean;
      timedOut: boolean;
      error: string;
    };

/**
 * One Gemini attempt: one model, one key, hard timeout. A quota error
 * (429) or a permission error (403) abandons the key — both are
 * key-level. A 503 / timeout / malformed response abandons the
 * attempt only (the next model or key may still answer).
 */
async function tryAttempt(
  model: string,
  apiKey: string,
  photoBase64: string,
  mimeType: string,
  userText: string,
  includeRegions: boolean,
  timeoutMs: number
): Promise<Attempt> {
  try {
    const res = await callGemini(
      model,
      apiKey,
      photoBase64,
      mimeType,
      userText,
      timeoutMs
    );
    const body = await res.text();
    if (!res.ok) {
      return {
        ok: false,
        quota: isQuotaError(res.status, body),
        fatal: isPermissionError(res.status),
        timedOut: false,
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
        error: "empty gemini reply",
      };
    }
    const parsed = parseScoring(text, includeRegions);
    if (parsed === null) {
      return {
        ok: false,
        quota: false,
        fatal: false,
        timedOut: false,
        error: "unparseable criteria",
      };
    }
    return {
      ok: true,
      model,
      criteria: parsed.criteria,
      regions: parsed.regions,
      potential: parsed.potential,
      rawMean: parsed.rawMean,
    };
  } catch (err) {
    if (isTimeoutError(err)) {
      return {
        ok: false,
        quota: false,
        fatal: false,
        timedOut: true,
        error: "timeout",
      };
    }
    return {
      ok: false,
      quota: false,
      fatal: false,
      timedOut: false,
      error: "fetch failed",
    };
  }
}

// ---------- Auth (same pattern as /api/weekly-plan and /api/plan) ----------

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
    // No profile row (e.g. an anonymous/guest session whose row was
    // never created) is a FREE user, not an error: free users are
    // entitled to this endpoint (free mode), and the tier check
    // below still keeps regions Pro-only. Only an invalid token
    // (no user above) rejects. This differs from /api/weekly-plan
    // deliberately — that route is premium-only, this one is not.
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

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  const deadline = startedAt + OVERALL_DEADLINE_MS;

  // Auth first: no token or an invalid token never reaches Gemini.
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
      { ok: false, error: "unauthorized", detail: "invalid token or no profile" },
      { status: 401 }
    );
  }
  const isPro = ent.is_premium || ent.is_admin;

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
  const photo = b.photo;
  if (typeof photo !== "string" || photo.length === 0) {
    return NextResponse.json(
      { ok: false, error: "bad_request", detail: "photo (base64) is required" },
      { status: 400 }
    );
  }
  if (photo.length > MAX_PHOTO_CHARS) {
    return NextResponse.json(
      { ok: false, error: "bad_request", detail: "photo too large" },
      { status: 400 }
    );
  }
  const mimeType =
    typeof b.mimeType === "string" &&
    ["image/jpeg", "image/png", "image/webp"].includes(b.mimeType)
      ? b.mimeType
      : "image/jpeg";
  const geometry =
    typeof b.geometry === "object" && b.geometry !== null
      ? (b.geometry as Record<string, unknown>)
      : null;
  // Mode comes from the SERVER tier, not the client flag: regions are
  // scored only for premium/admin callers. A premium caller may still
  // ask for free mode (includeRegions=false); a free caller asking for
  // regions gets free mode regardless — the flag can only narrow.
  const includeRegions = isPro && b.includeRegions !== false;

  const keys = getApiKeys();
  if (keys.length === 0) {
    return NextResponse.json(
      { ok: false, error: "ai_unavailable", detail: "no gemini keys configured" },
      { status: 503 }
    );
  }

  const userText = buildUserText(geometry, includeRegions);
  const now = Date.now();
  const keyOrder = orderedKeyIndexes(keys.length, now);

  // Flash first: up to MAX_FLASH_KEYS keys × (3.6 → 3.8). A quota
  // error (429) or permission error (403) on a key abandons that key
  // for the whole request — both are key-level. Two consecutive quota
  // errors mean the Flash bucket is blown pool-wide for this minute
  // (the keys share few projects — proven in the harness, where every
  // key 429'd at once), so the loop stops burning Flash attempts and
  // falls through to Lite, which has its own quota bucket. A model
  // that times out twice in a row is skipped for the rest of the
  // request. Nothing starts past the deadline.
  let lastError = "no attempt made";
  let sawFlashQuota = false;
  let consecutiveQuota = 0;
  let flashQuotaBlown = false;
  const modelTimeouts = new Map<string, number>();
  const skippedModels = new Set<string>();
  const flashKeys = keyOrder.slice(0, MAX_FLASH_KEYS);
  for (const ki of flashKeys) {
    if (flashQuotaBlown) break;
    const models = [FLASH_LEAD, FLASH_ALT].filter(
      (m) => !skippedModels.has(m)
    );
    for (const model of models) {
      const remaining = deadline - Date.now();
      if (remaining < 1_000) {
        return NextResponse.json(
          { ok: false, error: "ai_unavailable", detail: "deadline reached" },
          { status: 503 }
        );
      }
      const attempt = await tryAttempt(
        model,
        keys[ki],
        photo,
        mimeType,
        userText,
        includeRegions,
        Math.min(ATTEMPT_TIMEOUT_MS, remaining)
      );
      if (attempt.ok) {
        const blend = mergeBlend(geometry, attempt.criteria, attempt.regions);
        return successResponse(
          attempt.model,
          attempt.criteria,
          attempt.regions,
          anchorPotential(attempt.potential, blend.blendedPsl),
          blend,
          attempt.rawMean,
          Date.now() - startedAt
        );
      }
      lastError = attempt.error;
      if (attempt.timedOut) {
        const n = (modelTimeouts.get(model) ?? 0) + 1;
        modelTimeouts.set(model, n);
        if (n >= 2) skippedModels.add(model);
      }
      if (attempt.quota) {
        sawFlashQuota = true;
        consecutiveQuota += 1;
        keyCooldowns.set(ki, Date.now() + KEY_COOLDOWN_MS);
        if (consecutiveQuota >= 2) flashQuotaBlown = true;
        break; // key-level failure — next key (or Lite, if blown).
      }
      consecutiveQuota = 0;
      if (attempt.fatal) {
        keyCooldowns.set(ki, Date.now() + KEY_COOLDOWN_MS);
        break; // key-level failure — next key.
      }
    }
  }

  // Last resort: Flash-Lite on the first available key — only when
  // Flash failed everywhere (quota or capacity). The response names
  // the model, so a Lite fallback is visible, never silent.
  if (Date.now() < deadline - 1_000) {
    const liteKey = keyOrder.find((ki) => !isKeyCoolingDown(ki, Date.now())) ?? keyOrder[0];
    const attempt = await tryAttempt(
      LITE_MODEL,
      keys[liteKey],
      photo,
      mimeType,
      userText,
      includeRegions,
      Math.min(ATTEMPT_TIMEOUT_MS, deadline - Date.now())
    );
    if (attempt.ok) {
      const blend = mergeBlend(geometry, attempt.criteria, attempt.regions);
      return successResponse(
        attempt.model,
        attempt.criteria,
        attempt.regions,
        anchorPotential(attempt.potential, blend.blendedPsl),
        blend,
        attempt.rawMean,
        Date.now() - startedAt
      );
    }
    lastError = attempt.error;
    if (attempt.quota || attempt.fatal)
      keyCooldowns.set(liteKey, Date.now() + KEY_COOLDOWN_MS);
  }

  return NextResponse.json(
    {
      ok: false,
      error: "ai_unavailable",
      detail: sawFlashQuota
        ? `flash quota exhausted; lite also failed (${lastError})`
        : lastError,
    },
    { status: 503 }
  );
}

function successResponse(
  model: string,
  criteria: Criteria,
  regions: Regions | null,
  potential: Potential,
  blend: Blend,
  rawMean: number | null,
  latencyMs: number
) {
  return NextResponse.json({
    ok: true,
    model,
    // Which prompt scored this photo (slice 4) — provenance, and the
    // deploy check: poll until this reads the new version.
    promptVersion: PROMPT_VERSION,
    criteria,
    regions,
    potential,
    // The 50/50 merge, computed server-side (single source of truth).
    blendedPsl: blend.blendedPsl,
    gPart: blend.gPart,
    aPart: blend.aPart,
    softComposite: softCompositeOf(criteria),
    photoQuality: criteria.photoQuality.score,
    // Calibration transparency: the raw (pre-re-centring) mean and the
    // shift applied, so drift can be spotted from production data.
    rawMean,
    recenterShift: RECENTER_SHIFT,
    latencyMs,
  });
}
