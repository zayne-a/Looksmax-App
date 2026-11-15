// AI scoring endpoint — hybrid v5 (2026-11-15).
//
// THE HYBRID (Zayne's design, approved 2026-11-15 18:14 IST — SUPERSEDES
// the 50/50 blend of 2026-11-14/15): the AI produces the final PSL
// score; geometry is ONE SIGNAL the AI's judgment is weighed with.
//   - Geometry measures BONE + HARMONY (deterministic, from the face
//     mesh): the bone composite B and the mis-fit-corrected Harmony
//     (H_fixed — the bands punish elite proportions, so when the
//     mis-fit signal fires the structure metrics carry Harmony).
//   - The AI judges LEANNESS (new — this is what prices fat), SKIN,
//     EYE AREA, HAIR. The AI also reads boneStructure + harmony as
//     cross-checks; its bone read governs when fat is present (the
//     visible-bone rule — geometry reads fat width as bone).
//   - The assembly weighs them (bone .25, lean .20, harmony .20,
//     skin .15, eye .10, hair .10), translates the raw onto the /8
//     scale with a FROZEN linear calibration, and applies a sanity
//     bound (geometry-anchored, catastrophic-error prevention only).
//   - EVERYTHING matters, including fat. A 2 earns a 2 and a 7.9
//     earns a 7.9 — the face earns its number from what the AI sees
//     and what the measurements show. No PSL floor (only the 0.5
//     scale bound); Potential stays banded 5–7.5.
//
// WHY NOT 50/50 ANY MORE (v5 final report, agent b2b420a4): the AI
// half reversed the geometry verdict on the fat-face tie (geometry
// said Zayne wins +0.46, the AI said the fat face wins +1.34); the
// AI's bone numbers cap at ~74 no matter the prompt (its words track
// the measurements but its numbers don't); NOTHING priced fatness
// (bloat was display-only, the v4 prompt had zero fat/lean language,
// OI read width as dimorphism); and the centre inflated (~5.8 blend
// for average faces). The hybrid fixes all four: geometry owns bone,
// the AI owns leanness, the calibration translates the AI's
// compressed idiom onto the real scale.
//
// THE CALIBRATION (FROZEN 2026-11-15 — never refit, never tuned):
//   final = -17.5796 + 0.3340 * raw
// Fitted ONCE on the two anchors Zayne set, using the MEAN temp-0 raw
// per anchor (3 runs each, production config: temperature 0 + sex-aware
// prompt): the fat face (mean raw 58.62 -> 2.0 — fat + BAD bones,
// bigonial 49.9 / mandible 57.9) and the TikTok chad (mean raw 75.68
// -> 7.7, the MIDDLE of the 7.5–7.9 chad range — the AI decides where
// in the range a chad lands from what it sees). The calibration is a
// TRANSLATION, not a forcing function:
// it maps the AI's compressed 0–100 idiom onto the /8 scale the same
// way the v4 divisor did. Validation (harness validate_hybrid_v5.mjs):
// anchors 2/2, morph-8 7.87 (chad range), Zayne separates from the
// fat face by ~3 PSL. The full validation set + coefficients are
// documented in ~/workspace/psl-accuracy-harness/hybrid_v5_spec.json.
//
// THE SANITY BOUND (Zayne 2026-11-15: "dont throw chad at 2 even by
// mistake"): the final stays within a band the geometry supports.
// floor = max(2G - 3.0, B>=85 ? 5.0 : B>=75 ? 4.0); cap = min(2G +
// 3.0, B<=65 ? 5.5). Elite measured bone can never produce a bottom
// score; weak bone can never produce an elite score. The bound ONLY
// blocks catastrophic errors — it never steers a score (verified
// slack on all 11 validation faces: it fires on none of them).
// Adversarial proof (harness): TikTok geometry + AI-all-30 -> 4.00;
// morph-8 geometry + AI-all-30 -> 5.00; ba-before geometry +
// AI-all-95 -> 5.50.
//
// THE VISIBLE-BONE RULE: when AI leanness < 50 AND the AI's
// boneStructure < geometry B, bone = the AI's bone read. Geometry
// reads fat width as bone (landmarks sit on the skin surface) and
// the B composite dilutes a weak jaw behind Harmony/Dimorphism (the
// fat face: B 71.1 hides bigonial 49.9 + mandible 57.9; the AI sees
// the weak jaw: bone 58). This is NOT double-counting fat: leanness
// prices "how much fat there is"; the bone input prices "how much
// bone is visible". A fat face with a strong visible jaw keeps its
// geometry bone (the AI's read would be high and min() wouldn't bite).
//
// THE PROMPT (v5 — teaches WHAT to look at, never WHAT SCORE to
// give; Zayne: "AI should use its intelligence, not biased"): the
// criteria definitions + the rarity ladder teach the scale's meaning
// (what 90 means, what 30 means); the AI decides the numbers from
// what it sees. No pre-decided scores, no anchor faces named, no
// geometry signal dictating the answer (the v5b bone anchor — "start
// from the measured bone scores" — was REJECTED for exactly that
// reason; the v5a prompt, without it, is the validated one).
//
// FLASH ONLY (Zayne: "AI should never fail"): the scoring ladder is
// Flash-only — gemini-3.6-flash lead, gemini-3.8-flash escalation,
// across pool keys. NO Lite fallback anywhere in the scoring path:
// Lite-vs-Flash is a model lottery (TikTok 7.11 on Lite vs 5.82 on
// Flash — the 7.11 was a Lite artifact, not a real score). On Flash
// failure the route retries Flash on another key; if every Flash
// attempt fails the route returns 503 ai_unavailable and the client
// shows a LOUD failure state with retry — never a disguised fallback,
// never a geometry-only score presented as a blend (the 04:09 silent
// failure must never recur).
//
// SIDE PHOTO: the scan captures a side photo; the route accepts it
// (optional `sidePhoto` base64) and sends it to the AI as a second
// image. The side reads (jaw/chin projection, forehead slope, neck,
// submental) fold into bone/leanness/harmony as named side reads in
// the criteria. Side criteria are UNTESTED in the harness (no side
// photos exist there) — they validate on-device later; the flow is
// wired now. When no side photo is sent, the prompt says so and the
// AI judges from the front photo + measurements.
//
// REGIONS (Zayne 2026-11-14): the AI ALSO decides the four deck
// region scores — Eyes, Midface, Lower Third, Upper Third — judged
// fresh from the photo (the geometry region scores are deliberately
// NOT sent). GATING: regions are Pro-only (free users never see
// them). The request takes `includeRegions` (default true): false =
// free mode (criteria only, regions: null), true = pro mode. The mode
// comes from the SERVER tier, not the client flag.
//
// POTENTIAL (Zayne 2026-11-14, corrected 23:00 IST): derived FROM
// THE SCORES (structured: currentEstimate + headroom, anchored to
// the blended PSL), banded 5–7.5 by clampPotential (Zayne
// 2026-11-15: Potential ALWAYS lands 5–7.5, above the score — it
// boosts confidence). Unblurred for everyone, returned in both modes.
//
// LEGACY FIELDS: gPart/aPart are still computed the OLD 50/50 way
// (geometry half + AI mean/25) and returned for plan-ai + old
// clients that display them — they are NOT the hybrid halves and do
// NOT enter blendedPsl under v5. overallImpression is NO LONGER
// scored (its role is replaced by harmony + boneStructure);
// plan-ai tolerates its absence (its take() skips missing criteria).
//
// Auth/entitlement (slice 2): ENFORCED. Bearer token → Supabase
// admin.auth.getUser → profiles (is_admin, is_premium). No token or
// an invalid token → 401. Regions are scored only when the caller is
// premium/admin AND did not explicitly ask for free mode. A valid
// session with NO profile row (e.g. an anonymous/guest session) is
// treated as free, not rejected.

import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import {
  boneCompositeOf,
  harmonyFixedOf,
  misfitFromMetrics,
} from "../../../lib/psl";

export const maxDuration = 60;

// Scoring ladder: FLASH ONLY. 3.6 LEADS (a trivial text probe of 3.8
// hung past 30s while 3.6 answered in ~15s, so 3.8 is escalation
// only). NO Lite fallback — Lite-vs-Flash is a model lottery (TikTok
// 7.11 Lite vs 5.82 Flash) and a Lite score is not a real score.
const FLASH_LEAD = "gemini-3.6-flash";
const FLASH_ALT = "gemini-3.8-flash";

// Hard timeout per Gemini attempt; overall deadline for the route.
// Attempts are 25s: vision calls through this egress path usually
// take 10–20s. Deadline is 55s (maxDuration 60). 8 keys max on
// Flash: fast failures (403s from dead pool keys, 429s from blown
// per-project buckets) cost <1s each, so more keys get a chance
// without blowing the deadline — and different keys live on
// different projects, so one project's blown bucket must not stop
// the ladder (the old "2 consecutive quota errors stop Flash" rule
// is gone: every key gets its attempt).
const ATTEMPT_TIMEOUT_MS = 25_000;
const OVERALL_DEADLINE_MS = 55_000;
const MAX_FLASH_KEYS = 8;
const KEY_COOLDOWN_MS = 60_000;

// Base64 photo cap (~3 MB of image). Harness photos are ≤ 460 KB.
// Applies to the front photo AND the side photo separately.
const MAX_PHOTO_CHARS = 4_000_000;

// Re-centring shift: 0 under v5 — the v5 criteria are NOT re-centred
// at parse time. The FROZEN CALIBRATION below is the translation
// (it maps the AI's compressed idiom onto the /8 scale); a shift
// would double-translate. The constant stays so the response keeps
// reporting the shift applied (0) for drift transparency.
const RECENTER_SHIFT = 0;

// Sanity bound on the AI's Potential headroom: no face realistically
// gains more than 2.0 PSL from looksmaxxing.
const HEADROOM_MAX = 2.0;

// Scoring temperature: 0 (greedy decoding). Proven 2026-11-15: temp 0
// tightens repeats (TikTok Δ0.16 across two Flash runs at 0, vs Δ0.61
// at 0.2) — scoring must be stable, not creative. The fat face's
// temp-0 pair is Δ0.37 (marginal — bone-through-fat is inherently
// uncertain); the face-score median (3 captures) stabilises the
// displayed score.
const SCORING_TEMPERATURE = 0;

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

/** Round to 2 decimals — kills float artefacts like 3.9000000000000004. */
const round2 = (v: number) => Math.round(v * 100) / 100;

// ---------- HYBRID v5 ASSEMBLY (FROZEN 2026-11-15) ----------
// Weights: structure (bone + lean + harmony = 65%) dominates because
// PSL is a bone-first scale; soft traits (35%) refine, never carry.
// The weights are the design's one human-chosen piece — VALIDATED by
// the test, not fitted to targets. The calibration is fitted ONCE on
// the two anchors (fat mean raw 58.62 -> 2.0, TikTok mean raw 75.68
// -> 7.7) and then FROZEN — never refit, never tuned. See
// hybrid_v5_spec.json.
const HYBRID_WEIGHTS = {
  bone: 0.25,
  lean: 0.2,
  harm: 0.2,
  skin: 0.15,
  eye: 0.1,
  hair: 0.1,
} as const;
const CALIBRATION_INTERCEPT = -17.5796;
const CALIBRATION_SLOPE = 0.3340;
// Visible-bone rule: leanness below this means fat is present.
const FAT_LEAN_THRESHOLD = 50;
// Sanity bound (catastrophic-error prevention only — see header).
const BOUND_TWO_G_WINDOW = 3.0;
const BOUND_ELITE_BONE = 85;
const BOUND_ELITE_FLOOR = 5.0;
const BOUND_STRONG_BONE = 75;
const BOUND_STRONG_FLOOR = 4.0;
const BOUND_WEAK_BONE = 65;
const BOUND_WEAK_CAP = 5.5;

// POTENTIAL BAND (Zayne 2026-11-15): Potential ALWAYS lands between
// 5 and 7.5 — it boosts confidence. It also stays above the PSL
// score. Edge: a face already at 7.5+ cannot be both above its score
// and at-or-under the cap, so Potential equals the score there
// ("you're already at your potential").
const POTENTIAL_MIN = 5;
const POTENTIAL_MAX = 7.5;
const POTENTIAL_MARGIN = 0.1;

/** Band a computed Potential value into [5, 7.5] and above `score`
 *  (null when no score base exists — band only, no margin). */
function clampPotential(value: number, score: number | null): number {
  if (score !== null && score >= POTENTIAL_MAX) return round2(score);
  const lo =
    score === null
      ? POTENTIAL_MIN
      : Math.max(POTENTIAL_MIN, round2(score + POTENTIAL_MARGIN));
  return round2(clamp(value, lo, POTENTIAL_MAX));
}

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
 * error does.
 */
function isPermissionError(status: number): boolean {
  return status === 403;
}

function isTimeoutError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const name = (err as { name?: unknown }).name;
  return name === "TimeoutError" || name === "AbortError";
}

// v5 criteria: the AI scores bone + leanness + harmony + the three
// soft criteria + photoQuality. overallImpression is GONE (v4) —
// its role is replaced by harmony + boneStructure.
type CriterionName =
  | "boneStructure"
  | "facialLeanness"
  | "harmony"
  | "skinQuality"
  | "eyeArea"
  | "hairFraming"
  | "photoQuality";

const CRITERIA: CriterionName[] = [
  "boneStructure",
  "facialLeanness",
  "harmony",
  "skinQuality",
  "eyeArea",
  "hairFraming",
  "photoQuality",
];

/** The AI criteria that enter the hybrid raw as SOFT inputs
 *  (leanness + skin + eye + hair). Bone + harmony come from
 *  GEOMETRY (B + H_fixed); the AI's boneStructure/harmony reads are
 *  cross-checks — boneStructure governs only under the visible-bone
 *  rule (fat present). The assembly needs >= 2 of these 4 non-null,
 *  else the call fails (loud, never a disguised fallback). */
const SOFT_CRITERIA: CriterionName[] = [
  "facialLeanness",
  "skinQuality",
  "eyeArea",
  "hairFraming",
];

/** The face criteria that enter the LEGACY AI half A (kept for
 *  plan-ai + old clients — NOT the hybrid): skin, eyes, hair ONLY.
 *  overallImpression is excluded (re-fit 2026-11-15 — it
 *  double-counts bone) and no longer scored at all under v5. */
const A_CRITERIA: CriterionName[] = [
  "skinQuality",
  "eyeArea",
  "hairFraming",
];

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
// hardened prompt (PSL fix slice 4); v3 = the top-end discrimination
// prompt (re-fit 2026-11-15 — FAILED its A/B, inflated every face);
// v4 = the corrected ladder (re-fit 2026-11-15 — the 50/50 prompt);
// v5 = the HYBRID prompt (2026-11-15): the AI holds the ranking
// criteria and matches the scan against them — bone + leanness +
// harmony + soft criteria, side photo when provided, geometry as
// ONE signal. Returned in every success response so a score's prompt
// is provable from the response itself.
const PROMPT_VERSION = 5;

const SYSTEM_PROMPT = [
  "You are the final PSL judge for MewMax. You hold the ranking criteria and you match this face against them.",
  "Score the FACE, not the photograph. Judge the underlying face — two photos of the same face must receive the same scores. Ignore lighting, image quality, digital smoothing or filters, background, clothing, and the person's momentary expression.",
  "Use the FULL 0-100 scale. 50 is average. Most faces you will ever see score 40-65 on any criterion. 70 means clearly above average — a real strength. 80 means striking — immediately noticeable, rarer than 1 in 20. 90 means elite — near-flawless, rarer than 1 in 100. 95+ means the best you have ever seen. Score against the whole population, not against other good-looking faces: a merely handsome face scores 65-75, not 85+. If you score every good face 90, your scores say nothing — spread them.",
  "If a criterion cannot be judged (for example hair not visible), return null for its score and say why in the reason. NEVER invent detail you cannot see.",
  "Keep each reason to one short sentence.",
].join(" ");

function buildUserText(
  geometry: Record<string, unknown> | null,
  includeRegions: boolean,
  hasSide: boolean,
  gender: string | null
): string {
  const sideLine = hasSide
    ? "A side-profile photo is also attached — use it for the side reads named in each criterion."
    : "No side photo is provided — judge from the front photo and the measurements, and say where a side photo would have helped.";
  // Sex-aware scoring (2026-11-15): the v5a prompt is male-anchored —
  // boneStructure judges "jaw width and definition", which penalises
  // women for a normal feminine jaw (the harness female face scored
  // bone 56 and landed at 3.27 despite good cheekbones). When the
  // subject's sex is known (the client sends it in the geometry
  // payload), the prompt says so and the bone criterion is judged
  // against that sex's norms. Leanness/harmony/skin/eye/hair are
  // judged the same way for both sexes.
  const sexLine =
    gender === "female"
      ? "\nThe subject is FEMALE. Score against female norms: boneStructure judges cheekbone prominence, jaw definition and chin shape relative to female faces — a softer jaw is normal for a woman, not weak bone. Judge the bone she has, not a masculine jaw she was never meant to have."
      : gender === "male"
        ? "\nThe subject is MALE. Score against male norms."
        : "";
  const boneCriterion =
    gender === "female"
      ? "1. boneStructure — the bone you can see: cheekbone prominence, jaw definition, chin shape and projection, brow shape. From the side photo (when provided): jaw and chin projection, forehead slope.\n   90+ = sharp, well-defined bone on every read — prominent cheekbones, defined jaw, projected chin — genuinely rare. 70 = clearly strong bone for a woman. 50 = average bone, nothing stands out. 30 = weak or recessed bone throughout. Below 30 = very weak bone."
      : "1. boneStructure — the bone you can see: jaw width and definition, cheekbone prominence, brow and chin projection. From the side photo (when provided): jaw and chin projection, forehead slope.\n   90+ = sharp, wide, projected bone on every read — genuinely rare. 70 = clearly strong bone. 50 = average bone, nothing stands out. 30 = weak or recessed bone throughout. Below 30 = very weak bone.";
  const lines: string[] = [
    "You are judging ONE face against the MewMax ranking criteria. You score the criteria below; your scores are weighed with the measured bone and harmony into the final score — the face earns its number from what you see and what the measurements show." +
      sexLine,
    "",
    "BONE THROUGH FAT — READ THIS",
    "You cannot see bone directly, and neither can the measurements. The geometry numbers below come from 478 facial landmarks measured on the SKIN surface, so every width includes soft tissue: a wide jaw can be bone or fat. Decide what the widths are made of from what you SEE in the photo: wide + sharp jawline = bone; wide + soft jawline = fat over bone. The leanness criterion is where fat is priced. The bone criterion is where the bone you can actually see is priced.",
    "",
    "Score each criterion 0–100 (50 = average). Reason first, then the score; the score must match the description.",
    "",
    boneCriterion,
    "",
    "2. facialLeanness — how much fat the face carries and how it hides the bone: jawline sharpness, cheek hollowing versus fullness, neck definition, submental fullness, overall facial fat. From the side photo (when provided): neck definition, the submental area, the jawline under the ear.",
    "   90+ = razor jawline, hollow cheeks, defined neck — very lean. 70 = lean, jawline sharp, cheeks defined. 50 = average fullness, jawline visible but soft. 30 = jawline buried, cheeks full, neck undefined — clearly carrying facial fat. Below 30 = heavy facial fat, bone hidden.",
    "",
    "3. harmony — how the features read together: proportions, balance, symmetry as they appear. From the side photo (when provided): nose profile — dorsal shape and projection.",
    "   90+ = striking balance, everything in proportion. 70 = clearly harmonious. 50 = average balance. 30 = visibly mismatched proportions.",
    "",
    "4. skinQuality — skin clarity, texture, acne, redness, tone evenness. Discount digital smoothing or filters — score the skin you can actually see, not the filter.",
    "   90+ = flawless skin, rare. 70 = clear, even skin. 50 = average skin, minor flaws. 30 = visible acne, redness, or uneven tone throughout.",
    "",
    "5. eyeArea — eyelids, under-eye, eye shape. Ignore shadows and lighting — score the eye area itself, not the light falling on it.",
    "   90+ = striking eyes, rare. 70 = clearly good eyes. 50 = average eyes. 30 = heavy lids, dark under-eye, or weak eye shape.",
    "",
    "6. hairFraming — hairline, hair fullness, how the hair frames the face. Judge the hair itself, not the styling or the light. If the photo shows no hair, return null.",
    "   90+ = excellent framing, rare. 70 = clearly good framing. 50 = average. 30 = receding, thin, or badly framing hair.",
    "",
    "7. photoQuality — how well this photo serves scoring: lighting, angle, sharpness, framing. This is a confidence signal, not a face score. A low photoQuality means MORE nulls, not lower scores — a bad photo must never produce extreme face scores.",
  ];
  if (geometry) {
    lines.push(
      "",
      "GEOMETRY IS ONE SIGNAL",
      "The measurements below are one witness, not the verdict. Where your eyes and the numbers disagree, say so in the reason: weigh your eyes more for soft tissue, the numbers more for proportions. The bloat number in the measurements is width excess, NOT a fat measurement — do not read it as leanness.",
      "",
      "GEOMETRY SIGNAL (landmark measurements, 0–100 band scores unless noted):",
      JSON.stringify(geometry)
    );
  }
  if (includeRegions) {
    lines.push(
      "",
      "ALSO score the 4 face regions below. These are the deck scores the user sees — judge each region fresh from the photo, as a whole, on the same 0-100 scale (50 = average):",
      "",
      "8. eyes — the eye region as a whole: eye shape, spacing, tilt, brow position, how the eyes read together.",
      "9. midface — the middle third: cheekbone prominence, midface length and compactness, balance from under-eye to mouth.",
      "10. lowerThird — jaw, chin, lips, lower-face balance and definition.",
      "11. upperThird — forehead proportion, hairline, temple width, brow line.",
      "",
      "LAST — Potential, derived FROM THE SCORES you have just produced (regions + criteria) plus the geometry measurements above — do NOT re-judge the photo independently for Potential. Show your working in three steps: (1) currentEstimate — your read of this face's CURRENT level on the 0–8 scale, from the scores (near the geometry PSL, raised by strong soft scores, lowered by weak ones); (2) headroom — the REALISTIC gain on the 0–8 scale from fixing what is fixable (0 when the scores are already high — little room left means SMALL headroom, never more than 2.0; larger only when strong bone pairs with weak soft scores); (3) value = currentEstimate + headroom. Your one-line reason MUST name the specific improvements that make up the headroom (for example 'clearing acne + better hair framing'), and MUST be consistent with the headroom size — if you say little room is left, the headroom must be small.",
      "",
      "PHOTOS: one front photo is attached. " + sideLine,
      "",
      "Return exactly this shape, nothing else. Write the reason FIRST, then the score — describe what you see before you score it, and make the score match the description:",
      '{ "boneStructure": { "reason": "...", "score": 0-100 or null }, "facialLeanness": { "reason": "...", "score": ... }, "harmony": { "reason": "...", "score": ... }, "skinQuality": { "reason": "...", "score": ... }, "eyeArea": { "reason": "...", "score": ... }, "hairFraming": { "reason": "...", "score": ... }, "photoQuality": { "reason": "...", "score": ... }, "regions": { "eyes": { "reason": "...", "score": ... }, "midface": { "reason": "...", "score": ... }, "lowerThird": { "reason": "...", "score": ... }, "upperThird": { "reason": "...", "score": ... } }, "potential": { "value": 0-8 or null, "reason": "...", "currentEstimate": 0-8 or null, "headroom": 0-2 or null } }'
    );
  } else {
    lines.push(
      "",
      "LAST — Potential, derived FROM THE SCORES you have just produced (criteria) plus the geometry measurements above — do NOT re-judge the photo independently for Potential. Show your working in three steps: (1) currentEstimate — your read of this face's CURRENT level on the 0–8 scale, from the scores (near the geometry PSL, raised by strong soft scores, lowered by weak ones); (2) headroom — the REALISTIC gain on the 0–8 scale from fixing what is fixable (0 when the scores are already high — little room left means SMALL headroom, never more than 2.0; larger only when strong bone pairs with weak soft scores); (3) value = currentEstimate + headroom. Your one-line reason MUST name the specific improvements that make up the headroom (for example 'clearing acne + better hair framing'), and MUST be consistent with the headroom size — if you say little room is left, the headroom must be small.",
      "",
      "PHOTOS: one front photo is attached. " + sideLine,
      "",
      "Return exactly this shape, nothing else. Write the reason FIRST, then the score — describe what you see before you score it, and make the score match the description:",
      '{ "boneStructure": { "reason": "...", "score": 0-100 or null }, "facialLeanness": { "reason": "...", "score": ... }, "harmony": { "reason": "...", "score": ... }, "skinQuality": { "reason": "...", "score": ... }, "eyeArea": { "reason": "...", "score": ... }, "hairFraming": { "reason": "...", "score": ... }, "photoQuality": { "reason": "...", "score": ... }, "potential": { "value": 0-8 or null, "reason": "...", "currentEstimate": 0-8 or null, "headroom": 0-2 or null } }'
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
  timeoutMs: number,
  sidePhoto?: { base64: string; mimeType: string } | null
): Promise<Response> {
  // Key is passed as a query param per the Gemini API contract; it is never logged.
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const parts: unknown[] = [{ inlineData: { mimeType, data: photoBase64 } }];
  if (sidePhoto) {
    parts.push({
      inlineData: { mimeType: sidePhoto.mimeType, data: sidePhoto.base64 },
    });
  }
  parts.push({ text: userText });
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: SCORING_TEMPERATURE,
        // 11 scored items with reasons in pro mode (7 criteria + 4
        // regions); 7 in free mode.
        maxOutputTokens: 2048,
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
 *  ("hair not visible") is a real answer, not a failure. v5 scores
 *  are NOT re-centred (RECENTER_SHIFT is 0 — the frozen calibration
 *  is the translation, not a shift). */
function parseEntry(entry: unknown): CriterionScore {
  let score: number | null = null;
  let reason = "";
  if (typeof entry === "object" && entry !== null) {
    const s = (entry as { score?: unknown }).score;
    const r = (entry as { reason?: unknown }).reason;
    if (s === null) score = null;
    else if (typeof s === "number" && Number.isFinite(s)) {
      score = clamp(clamp(s, 0, 100) - RECENTER_SHIFT, 0, 100);
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
 * object in pro mode does NOT fail the call (the criteria still stand).
 * Potential is parsed in both modes; a missing one comes back null
 * with an empty reason rather than failing the call. rawMean is the
 * mean of the RAW scores of all six face criteria — the drift signal
 * for the AI's centre (the calibration translates the centre, so a
 * drifting rawMean is the early warning that the translation no
 * longer matches the model).
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
    const entry = parseEntry(obj[name]);
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
  const rawVals: number[] = [];
  const rawScoreOf = (e: unknown): number | null => {
    if (typeof e !== "object" || e === null) return null;
    const s = (e as { score?: unknown }).score;
    return typeof s === "number" && Number.isFinite(s) ? s : null;
  };
  for (const name of CRITERIA) {
    if (name === "photoQuality") continue;
    const s = rawScoreOf(obj[name]);
    if (s !== null) rawVals.push(s);
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

/** Mean of the non-null AI face criteria (all six). Null when all
 *  are null. Informational — the full AI read. */
function softCompositeOf(criteria: Criteria): number | null {
  const scores = CRITERIA.filter((n) => n !== "photoQuality")
    .map((n) => criteria[n].score)
    .filter((s): s is number => s !== null);
  if (scores.length === 0) return null;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

// ---------- Hybrid v5 assembly (server-side, single source of truth) ----------

export interface HybridBreakdown {
  bone: number;
  boneSource: "geometry" | "ai-visible";
  harmony: number;
  harmonyFixed: number;
  misfit: number;
  leanness: number | null;
  raw: number;
  calibrated: number;
  boundApplied: boolean;
  boundFloor: number;
  boundCap: number;
}

export interface HybridResult {
  blendedPsl: number | null;
  hybrid: HybridBreakdown | null;
}

/** The geometry half G from the bone buckets (0–100). LEGACY — kept
 *  for plan-ai + old clients that display the halves. Null when any
 *  bucket is missing. Same anchor (68) and slope 8 as the geometry
 *  engine. Does NOT enter blendedPsl under v5. */
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
  const boneMean = boneCompositeOf({
    harmony: h,
    dimorphism: d,
    definition: def,
  });
  return clamp(4.0 + (boneMean - 68) / 8, 0.5, 8.0) / 2;
}

/** The LEGACY AI half A: mean of the non-null scores / 25. Pro: 4
 *  regions + 3 face criteria (skin/eye/hair). Free: 3 face criteria.
 *  Kept for plan-ai + old clients. Does NOT enter blendedPsl under
 *  v5. The native client's aiHalf() in faceScore.ts MUST mirror this
 *  list exactly for legacy re-derivation of old v4 scans. */
function aPartOf(criteria: Criteria, regions: Regions | null): number | null {
  const vals: number[] = [];
  for (const n of A_CRITERIA) {
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

/** The sanity bound from the geometry bone B (deterministic anchor).
 *  floor = max(2G - 3.0, B>=85 ? 5.0 : B>=75 ? 4.0);
 *  cap = min(2G + 3.0, B<=65 ? 5.5).
 *  Catastrophic-error prevention ONLY — verified slack on all 11
 *  validation faces. The native client's hybridFinal() in blend.ts
 *  MUST mirror this exactly. */
function sanityBound(
  bone: number,
  calibrated: number
): { final: number; boundApplied: boolean; floor: number; cap: number } {
  const twoG = clamp(4.0 + (bone - 68) / 8, 0.5, 8.0);
  let floor = twoG - BOUND_TWO_G_WINDOW;
  let cap = twoG + BOUND_TWO_G_WINDOW;
  if (bone >= BOUND_ELITE_BONE) floor = Math.max(floor, BOUND_ELITE_FLOOR);
  else if (bone >= BOUND_STRONG_BONE)
    floor = Math.max(floor, BOUND_STRONG_FLOOR);
  if (bone <= BOUND_WEAK_BONE) cap = Math.min(cap, BOUND_WEAK_CAP);
  const final = clamp(calibrated, floor, cap);
  return { final, boundApplied: final !== calibrated, floor, cap };
}

/** The hybrid assembly. Inputs: the geometry payload (buckets +
 *  metricScores, sent by the client) and the AI's v5 criteria.
 *  Returns null when the geometry buckets are missing (old caller)
 *  or fewer than 2 of the 4 soft AI criteria are non-null (not
 *  enough evidence — the call fails loud, never a disguised
 *  fallback). The native client's hybridFinal() in blend.ts MUST
 *  mirror this exactly — the harness cross-checks the two. */
function assembleHybrid(
  geometry: Record<string, unknown> | null,
  criteria: Criteria
): HybridResult {
  if (!geometry) return { blendedPsl: null, hybrid: null };
  const h = geometry.harmony;
  const d = geometry.dimorphism;
  const def = geometry.definition;
  if (
    typeof h !== "number" ||
    typeof d !== "number" ||
    typeof def !== "number"
  ) {
    return { blendedPsl: null, hybrid: null };
  }
  const bone = boneCompositeOf({ harmony: h, dimorphism: d, definition: def });
  // metricScores (sent by the v5 client) drive H_fixed + misfit.
  // Old clients don't send them: H_fixed falls back to H and misfit
  // to the client's own misfit field (or 0).
  const metricScores =
    typeof geometry.metricScores === "object" &&
    geometry.metricScores !== null
      ? (geometry.metricScores as Record<string, number>)
      : null;
  const misfit =
    metricScores !== null
      ? misfitFromMetrics(metricScores)
      : clamp(
          typeof geometry.misfit === "number" ? geometry.misfit : 0,
          0,
          1
        );
  const harmonyFixed =
    metricScores !== null ? harmonyFixedOf(metricScores, h) : h;
  const lean = criteria.facialLeanness.score;
  const skin = criteria.skinQuality.score;
  const eye = criteria.eyeArea.score;
  const hair = criteria.hairFraming.score;
  const aiBone = criteria.boneStructure.score;
  const softPresent = [lean, skin, eye, hair].filter(
    (s): s is number => s !== null
  ).length;
  if (softPresent < 2) return { blendedPsl: null, hybrid: null };
  // Visible-bone rule: fat present (lean < 50) and the AI sees
  // weaker bone than the geometry measures -> the AI's visible-bone
  // read governs (geometry reads fat width as bone).
  let boneIn = bone;
  let boneSource: "geometry" | "ai-visible" = "geometry";
  if (lean !== null && lean < FAT_LEAN_THRESHOLD && aiBone !== null && aiBone < bone) {
    boneIn = aiBone;
    boneSource = "ai-visible";
  }
  const terms: [number, number | null][] = [
    [HYBRID_WEIGHTS.bone, boneIn],
    [HYBRID_WEIGHTS.lean, lean],
    [HYBRID_WEIGHTS.harm, harmonyFixed],
    [HYBRID_WEIGHTS.skin, skin],
    [HYBRID_WEIGHTS.eye, eye],
    [HYBRID_WEIGHTS.hair, hair],
  ];
  let acc = 0;
  let wSum = 0;
  for (const [w, v] of terms) {
    if (v !== null) {
      acc += w * v;
      wSum += w;
    }
  }
  const raw = acc / wSum;
  const calibrated = CALIBRATION_INTERCEPT + CALIBRATION_SLOPE * raw;
  const bound = sanityBound(bone, calibrated);
  const blendedPsl = round2(clamp(bound.final, 0.5, 8.0));
  return {
    blendedPsl,
    hybrid: {
      bone: round2(bone),
      boneSource,
      harmony: round2(h),
      harmonyFixed: round2(harmonyFixed),
      misfit: round2(misfit),
      leanness: lean,
      raw: round2(raw),
      calibrated: round2(calibrated),
      boundApplied: bound.boundApplied,
      boundFloor: round2(bound.floor),
      boundCap: round2(bound.cap),
    },
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
 * The anchored value is banded by clampPotential (Zayne 2026-11-15:
 * Potential ALWAYS lands 5–7.5, above the score).
 */
function anchorPotential(potential: Potential, blendedPsl: number | null): Potential {
  const { value, reason, currentEstimate, headroom } = potential;
  if (blendedPsl !== null && headroom !== null) {
    return {
      value: clampPotential(blendedPsl + headroom, blendedPsl),
      reason,
      currentEstimate,
      headroom,
    };
  }
  if (currentEstimate !== null && headroom !== null) {
    return {
      value: clampPotential(currentEstimate + headroom, currentEstimate),
      reason,
      currentEstimate,
      headroom,
    };
  }
  return value === null
    ? potential
    : { value: clampPotential(value, null), reason, currentEstimate, headroom };
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
  timeoutMs: number,
  sidePhoto?: { base64: string; mimeType: string } | null
): Promise<Attempt> {
  try {
    const res = await callGemini(
      model,
      apiKey,
      photoBase64,
      mimeType,
      userText,
      timeoutMs,
      sidePhoto
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
    // (no user above) rejects.
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
  // Optional side photo (base64): sent to the AI as a second image
  // for the side reads. Oversize side photos are dropped, not
  // rejected — the front photo still scores.
  let sidePhoto: { base64: string; mimeType: string } | null = null;
  if (typeof b.sidePhoto === "string" && b.sidePhoto.length > 0) {
    if (b.sidePhoto.length <= MAX_PHOTO_CHARS) {
      const sideMime =
        typeof b.sideMimeType === "string" &&
        ["image/jpeg", "image/png", "image/webp"].includes(b.sideMimeType)
          ? b.sideMimeType
          : "image/jpeg";
      sidePhoto = { base64: b.sidePhoto, mimeType: sideMime };
    }
  }
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

  const gender =
    typeof geometry?.gender === "string" &&
    (geometry.gender === "male" || geometry.gender === "female")
      ? geometry.gender
      : null;
  const userText = buildUserText(geometry, includeRegions, sidePhoto !== null, gender);
  const now = Date.now();
  const keyOrder = orderedKeyIndexes(keys.length, now);

  // FLASH ONLY: up to MAX_FLASH_KEYS keys × (3.6 → 3.8). A quota
  // error (429) or permission error (403) on a key abandons that key
  // for the whole request — both are key-level — but the ladder keeps
  // going to the next key: keys live on different projects, so one
  // project's blown bucket must not stop the ladder. A model that
  // times out twice in a row is skipped for the rest of the request.
  // Nothing starts past the deadline. There is NO Lite fallback: a
  // Lite score is not a real score, and a failed Flash ladder fails
  // LOUD (503 ai_unavailable) so the client shows a visible failure
  // with retry instead of a disguised fallback.
  let lastError = "no attempt made";
  let sawFlashQuota = false;
  const modelTimeouts = new Map<string, number>();
  const skippedModels = new Set<string>();
  const flashKeys = keyOrder.slice(0, MAX_FLASH_KEYS);
  for (const ki of flashKeys) {
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
        Math.min(ATTEMPT_TIMEOUT_MS, remaining),
        sidePhoto
      );
      if (attempt.ok) {
        const hybrid = assembleHybrid(geometry, attempt.criteria);
        const gPart = gPartOf(geometry);
        const aPart = aPartOf(attempt.criteria, attempt.regions);
        return successResponse(
          attempt.model,
          attempt.criteria,
          attempt.regions,
          anchorPotential(attempt.potential, hybrid.blendedPsl),
          hybrid,
          gPart,
          aPart,
          attempt.rawMean,
          sidePhoto !== null,
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
        keyCooldowns.set(ki, Date.now() + KEY_COOLDOWN_MS);
        break; // key-level failure — next key.
      }
      if (attempt.fatal) {
        keyCooldowns.set(ki, Date.now() + KEY_COOLDOWN_MS);
        break; // key-level failure — next key.
      }
    }
  }

  return NextResponse.json(
    {
      ok: false,
      error: "ai_unavailable",
      detail: sawFlashQuota
        ? `flash quota exhausted on every key tried (${lastError})`
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
  hybrid: HybridResult,
  gPart: number | null,
  aPart: number | null,
  rawMean: number | null,
  sidePhotoUsed: boolean,
  latencyMs: number
) {
  return NextResponse.json({
    ok: true,
    model,
    // Which prompt scored this photo — provenance, and the deploy
    // check: poll until this reads the new version.
    promptVersion: PROMPT_VERSION,
    criteria,
    regions,
    potential,
    // The hybrid v5 assembly, computed server-side (single source of
    // truth). blendedPsl IS the hybrid final.
    blendedPsl: hybrid.blendedPsl,
    hybrid: hybrid.hybrid,
    // Legacy 50/50 halves (plan-ai + old clients) — NOT the hybrid
    // halves, do not use them to re-derive blendedPsl under v5.
    gPart: gPart === null ? null : round2(gPart),
    aPart: aPart === null ? null : round2(aPart),
    softComposite: softCompositeOf(criteria),
    photoQuality: criteria.photoQuality.score,
    sidePhotoUsed,
    // Calibration transparency: the raw (pre-calibration) mean of the
    // AI criteria and the shift applied (0 under v5), so drift can be
    // spotted from production data.
    rawMean,
    recenterShift: RECENTER_SHIFT,
    latencyMs,
  });
}
