/**
 * The PSL layer — the community's native language laid over our
 * measurements: a PSL score /10, a tier label, a POTENTIAL score, and
 * per-region scores for the results deck.
 *
 * ENGINE v2 (2026-10-22) — deterministic, benchmark-driven, NO AI
 * anywhere near the number (owner rule: the same face must produce
 * the same score on every scan; a stochastic judge breaks that by
 * design). Built to research_notes/psl-scoring/psl-scoring-spec.md,
 * reconciled against the canonical looksmax.org "Complete Guide to
 * PSL Ratings" thread (population anchor: PSL 4/8 = the median,
 * SD = 1 — the thread's standard-deviation ladder) and checked
 * against maxxing.me, pslscale.net and looksmaxxing.guide (conflicts
 * resolved for the thread; logged in the v2 delivery report).
 *
 * How v2 works:
 *  - Every frontal metric from lib/face.ts is scored against its
 *    researched Tier-1 band with a Gaussian falloff centred on the
 *    band (σ ≈ the band's half-width — the community formula's
 *    halving deduction ladder, smoothed). The Tier-1 bands are
 *    ELITE bands: pslscale's per-tier chart shows even PSL-5 faces
 *    sitting outside several of them, which is exactly what makes
 *    the population anchor below hold. Sex-specific bands where the
 *    research gives them.
 *  - Metrics combine into the formula's four buckets:
 *    composite C = 0.40·Harmony + 0.20·Dimorphism + 0.25·Definition
 *    + 0.15·Misc ("bodyfat factors" honestly renamed Definition —
 *    it measures how visible the bone reads in this photo).
 *  - Calibration is anchored, not sloped:
 *    PSL8 = clamp(4.0 + (C − 68)/12.5, 0.5, 8.0); display /10 = ×1.25.
 *    (Cap 8.0 since 2026-11-15 — Zayne: an 8 gets 8; was 7.9.)
 *    (Anchor 68 since 2026-11-14 — was 50; see the pslScore note.)
 *    A population-typical face lands at C ≈ 50 → PSL 5.0/10 (MTN).
 *  - Side metrics are EXCLUDED from scoring (policy (a), 2026-11-15
 *    face-score audit §4g): the side angles score ~0 for real faces
 *    (suspected definition mismatch vs their bands) and whether a
 *    side photo exists at all moved the headline by ~1.5 PSL — a
 *    binary, not a measurement. The side photo is still collected
 *    and the side reads still appear as DISPLAY cards in the detail
 *    deck, but no side term joins the buckets or the region scores.
 *    Re-introduction needs a proven side-angle audit + a bounded-
 *    influence rule (audit §4g policy (b)).
 *
 * Re-synced 2026-11-15 to the native engine (anchor 68, re-fit
 * bands, side exclusion, 6-card deck reads): this file and the
 * native src/lib/psl.ts now score identically for the same
 * measurements. The 50/50 blend (geometry slope 8, the AI half,
 * the misfit-gated resolution) lives in /api/score-ai, not here.
 *
 * v1 scans (no engineVersion) keep their original numbers forever:
 * the legacy mapping below is preserved verbatim and history is
 * never rescored.
 */
import type { FaceMeasurements, FrontalMetricsV2, SideMetricsV2 } from "./types";

/** Optional deck-read fields the native measurement seam produces
 *  (native lib/faceMath.ts) and stored native scans carry in their
 *  frontal / side JSON. Web lib/types.ts doesn't declare them (the
 *  web measurement seam never computes them), so the deck reads
 *  below go through this structural extension — never estimated,
 *  absent = the card skips, exactly as native guards it. */
interface FrontalDeckFields {
  eyelidExposureRatio?: number;
  noseWidthRatio?: number;
  ramusFrontalRatio?: number;
  foreheadTaperRatio?: number;
}
interface SideDeckFields {
  ramusHeightRatio?: number;
  foreheadSlopeDeg?: number;
}
/** Slice-2 pixel raws (native measure pipeline) — same story. */
interface DetailPixelRaws {
  browCoverage?: number;
  lashCoverage?: number;
  hairlineRecedeRatio?: number;
  hairLightFraction?: number;
  hairlineDensityCoverage?: number;
  neckWidthRatio?: number | null;
  hyoidSkinFraction?: number | null;
}

export interface PslTier {
  label: string;
  /** Inclusive lower bound of the band, on the PSL /10 scale. */
  min: number;
}

/** v2 tier thresholds: the community's 0–8 boundaries converted ×1.25
 *  (spec §5.5): LTN 1.5/8→1.9, MTN 3.0→3.75, HTN 4.5→5.6, Chadlite
 *  5.5→6.9, Chad 6.0→7.5, True Adam 7.75→9.7. Cross-checked against
 *  the canonical thread's worked examples (Holland 4.5/8 = HTN edge,
 *  Depp 6/8 = Chad edge, Gandy/O'Pry 7.5/8 < True Adam). */
export const PSL_TIERS: PslTier[] = [
  { label: "Sub-3", min: 0 },
  { label: "Low-Tier Normie", min: 1.9 },
  { label: "Mid-Tier Normie", min: 3.75 },
  { label: "High-Tier Normie", min: 5.6 },
  { label: "Chadlite", min: 6.9 },
  { label: "Chad", min: 7.5 },
  { label: "True Adam", min: 9.7 },
];

/** The v1 thresholds, kept so v1 scans keep the tier label they were
 *  recorded with. */
const LEGACY_TIERS: PslTier[] = [
  { label: "Sub-3", min: 0 },
  { label: "Low-Tier Normie", min: 2.5 },
  { label: "Mid-Tier Normie", min: 3.5 },
  { label: "High-Tier Normie", min: 4.5 },
  { label: "Chadlite", min: 5.5 },
  { label: "Chad", min: 6.5 },
  { label: "True Adam", min: 8.5 },
];

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));
const round1 = (v: number) => Math.round(v * 10) / 10;

export function isV2(m: FaceMeasurements): boolean {
  return m.engineVersion === 2 && !!m.frontal;
}

function tierFrom(table: PslTier[], score: number): PslTier {
  let tier = table[0];
  for (const t of table) if (score >= t.min) tier = t;
  return tier;
}

/** Tier for a /10 score under the CURRENT (v2) thresholds. */
export function pslTier(score: number): PslTier {
  return tierFrom(PSL_TIERS, score);
}

/** Alias matching the spec's name for the tier lookup. */
export const tierForPsl = pslTier;

/** Tier for a score belonging to a specific scan — v1 scans resolve
 *  against the v1 thresholds they were recorded under. */
export function tierForMeasurements(m: FaceMeasurements, score: number): PslTier {
  return isV2(m) ? tierFrom(PSL_TIERS, score) : tierFrom(LEGACY_TIERS, score);
}

// ---------------------------------------------------------------------------
// Legacy v1 mapping — preserved verbatim. Do not "fix" anything here:
// v1 scans display exactly the numbers they were recorded with.
// ---------------------------------------------------------------------------

/** Overall 0–100 → PSL /10. Strict curve: 50 → 3.7, 60 → 4.7,
 *  71 → 5.9, 80 → 6.8, 90 → 7.9. */
function pslScoreV1(m: FaceMeasurements): number {
  return round1(clamp((m.overallScore - 15) / 9.5, 0.5, 9.9));
}

/** Closeness of a measured value to an ideal band, 0–100. */
function closeness(value: number, idealLo: number, idealHi: number, spread: number): number {
  if (value >= idealLo && value <= idealHi) return 100;
  const d = value < idealLo ? idealLo - value : value - idealHi;
  return clamp(100 - (d / spread) * 100, 0, 100);
}

// ---------------------------------------------------------------------------
// v2 scoring core
// ---------------------------------------------------------------------------

type Sex = "male" | "female";

interface Band {
  lo: number;
  hi: number;
  /** Gaussian σ on the low side of the band centre / high side.
   *  ≈ the band half-width per the formula's halving ladder; the
   *  two sides differ where the sources punish one direction harder
   *  (canthal tilt's negative side, FWHR above the band). */
  sLo: number;
  sHi: number;
}

/** Sex-specific band; unknown gender gets the blended (midpoint) band
 *  so the score stays deterministic and unbiased either way. */
function band(
  gender: Sex | undefined,
  m: [number, number, number, number],
  f: [number, number, number, number]
): Band {
  const pick = (a: [number, number, number, number]): Band => ({
    lo: a[0],
    hi: a[1],
    sLo: a[2],
    sHi: a[3],
  });
  if (gender === "male") return pick(m);
  if (gender === "female") return pick(f);
  return {
    lo: (m[0] + f[0]) / 2,
    hi: (m[1] + f[1]) / 2,
    sLo: (m[2] + f[2]) / 2,
    sHi: (m[3] + f[3]) / 2,
  };
}

/** Gaussian falloff centred on the band's midpoint: 100 at the
 *  ideal centre, ≈61 at the band edge, halving-ladder decay beyond
 *  (spec §5.2). Asymmetric σ where the sources punish one side. */
function bandScore(value: number, b: Band): number {
  const c = (b.lo + b.hi) / 2;
  const d = value - c;
  const s = d < 0 ? b.sLo : b.sHi;
  return 100 * Math.exp(-0.5 * (d / s) * (d / s));
}

/** One-sided saturating score (F6 cheekbone setedness: at/above the
 *  threshold is full marks, below falls off Gaussian). */
function saturatingScore(value: number, threshold: number, sigma: number): number {
  if (value >= threshold) return 100;
  const d = threshold - value;
  return 100 * Math.exp(-0.5 * (d / sigma) * (d / sigma));
}

/** One-sided ceiling score (F12 male brow setedness: at/below the
 *  ceiling is full marks, above falls off Gaussian). */
function ceilingScore(value: number, ceiling: number, sigma: number): number {
  if (value <= ceiling) return 100;
  const d = value - ceiling;
  return 100 * Math.exp(-0.5 * (d / sigma) * (d / sigma));
}

export interface ScoreBreakdownV2 {
  /** Per-metric scores 0–100, keyed by metric id. */
  metrics: Record<string, number>;
  /** Per-third proportion scores 0–100. */
  thirds: { upper: number; mid: number; lower: number };
  buckets: {
    harmony: number;
    dimorphism: number;
    definition: number;
    misc: number;
  };
  /** The 0–100 composite C. */
  composite: number;
  /** True when side metrics passed the gate. Display reads only —
   *  side metrics NEVER join the buckets or region scores (policy
   *  (a), 2026-11-15 audit §4g). Used by the detail-deck notes to
   *  say whether a card's read came from the side photo. */
  sideAvailable: boolean;
}

function weightedMean(entries: [number, number][]): number {
  let num = 0;
  let den = 0;
  for (const [score, w] of entries) {
    num += score * w;
    den += w;
  }
  return den > 0 ? num / den : 0;
}

/** The skin-quality composite (shared by v1's Misc deck and v2's Misc
 *  bucket — the skin suite itself is unchanged from v1). */
export function skinQualityScore(m: FaceMeasurements): number {
  const s = m.skin;
  return (
    100 -
    (clamp(s.redness, 0, 100) * 0.3 +
      clamp(s.texture, 0, 100) * 0.3 +
      clamp(s.underEye, 0, 100) * 0.2 +
      clamp(s.blemishCount * 4, 0, 100) * 0.2)
  );
}

/** Full v2 breakdown for a v2 scan; null for v1 scans. Pure and
 *  deterministic — same measurements in, same numbers out, always. */
export function scoreBreakdownV2(m: FaceMeasurements): ScoreBreakdownV2 | null {
  if (!isV2(m) || !m.frontal) return null;
  const f = m.frontal;
  const g = m.gender;

  // Per-third proportion scores: Gaussian around 1/3, σ = 0.035 (the
  // formula's Tier-1 allows ≤1–3% deviation; pslscale's tiers run
  // 3–6% dev at PSL 4 to <3% at PSL 5). σ widened 2026-11-15
  // (0.022 → 0.035, PSL re-fit): the old σ was narrower than the
  // landmark noise on the thirds (hairline/chin placement moves a
  // third by ~3%), so the TikTok PSL-7 face scored 30.6 on thirds
  // with a genuinely balanced face. The ideal is unchanged.
  const thirdScore = (v: number): number => {
    const d = v - 1 / 3;
    return 100 * Math.exp(-0.5 * (d / 0.035) * (d / 0.035));
  };
  const thirds = {
    upper: thirdScore(m.facialThirds.upper),
    mid: thirdScore(m.facialThirds.mid),
    lower: thirdScore(m.facialThirds.lower),
  };

  const metrics: Record<string, number> = {
    // F1 ESR — the heaviest frontal metric in the formula. σ widened
    // 2026-11-15 (0.017 → 0.028, PSL re-fit): the old σ was narrower
    // than the landmark noise on the eye-spacing ratio, so elite
    // faces a hair outside the band scored ~38.
    esr: bandScore(f.esr, band(g, [0.443, 0.477, 0.028, 0.028], [0.45, 0.479, 0.028, 0.028])),
    // F2 thirds (mean of the three per-third scores).
    thirds: (thirds.upper + thirds.mid + thirds.lower) / 3,
    // F3 canthal tilt — asymmetric: the low/negative side falls ~2×
    // faster than the high side (spec: negative tilt punished ~2×).
    // Re-fit 2026-11-15 (audit V1): σLo was 1.15°, narrower than the
    // ±3° pose noise on the tilt measurement — the TikTok PSL-7 face
    // measured 2.72° and scored 0.2 on a genuinely positive tilt.
    // Band widened and σLo raised to the noise floor (2.4°) both
    // sexes; the asymmetry (low side punished harder) is kept.
    tilt: bandScore(m.canthalTiltDeg, band(g, [4, 9, 2.4, 2.4], [5, 10, 2.4, 2.6])),
    // F4 true FWHR — scored in Dimorphism (spec pick), never "higher
    // is better" past the band. σ widened 2026-11-14 (0.10/0.07 →
    // 0.14): the old σHi 0.07 made the term binary — 7 of 9 real faces
    // measured 2.10–2.33 and scored 0–21. Population SD ≈ 0.14–0.16
    // (Lefevre et al.); the band itself is unchanged. Re-fit
    // 2026-11-15: σHi 0.14 → 0.28 (asymmetric — width above the band
    // punished less): the band conflates bone width with bloat, and
    // wide-boned elite faces (TikTok PSL 7: FWHR 2.34, scored 3.6)
    // were zeroed for bone, not fat. Bloat is still read separately
    // (the bloat composite below), so wide + lean no longer reads
    // as wide + bloated.
    fwhr: bandScore(m.fwhr, band(g, [1.9, 2.06, 0.14, 0.28], [1.9, 2.06, 0.14, 0.28])),
    // F7 total height ÷ width — replaces the debunked φ target.
    // σ widened 2026-11-14 (0.03 → 0.08): Farkas SDs (face height
    // ±8mm, bizygomatic ±6mm) put the ratio SD at ≈0.08, not 0.03;
    // the old σ zeroed the term for 8 of 9 real faces. The
    // measurement now uses hairline→chin (faceMath faceHFull), which
    // is what this band describes. Band centres unchanged. σ widened
    // again 2026-11-15 (0.08 → 0.12, PSL re-fit): the TikTok PSL-7
    // face measured 1.19 and scored 12.2 — the band still punished
    // a long elite face harder than the measurement noise justifies.
    totalHW: bandScore(f.totalHeightWidth, band(g, [1.33, 1.38, 0.12, 0.12], [1.29, 1.33, 0.12, 0.12])),
    // F8 bigonial ÷ bizygomatic. Recentered 2026-11-14 (+0.06 both
    // sexes): the band was written for the SKELETAL ratio, but the
    // mesh measures SKIN jaw width (gonion points sit on the masseter),
    // which runs ~0.95 on real faces — 9 of 9 measured 0.94–0.97 and
    // scored 9–44 against the old centre 0.885. σ 0.04 → 0.03.
    bigonial: bandScore(m.jawToCheekbone, band(g, [0.92, 0.97, 0.03, 0.03], [0.89, 0.94, 0.03, 0.03])),
    // F6 cheekbone setedness — one-directional, saturating. σ widened
    // 2026-11-14 (0.07 → 0.12): the old σ made it a cliff (0.67 → 2,
    // 0.81 → 100) across the middle of the real range (median ≈0.73).
    // Threshold lowered 2026-11-15 (0.81 → 0.75, PSL re-fit): the
    // real range centres ≈0.73, so 0.81 sat above the median face —
    // the threshold now marks genuinely high setedness, not the
    // top of the population.
    cheek: saturatingScore(f.cheekboneSetedness, 0.75, 0.12),
    // F5 jaw frontal angle is NOT scored: the spec allows dropping it
    // if it proves unstable on reference geometry, and it does — the
    // frontal angle (vertex at the gonion, arms to the jaw corner and
    // the chin) measures ~21–32° on real faces, and the corner angle
    // ~134–148°, so NEITHER matches any cephalometric gonial band and
    // the term would be structurally ~0 for everyone (the same
    // dead-term failure as the v1 FWHR bug, which the calibration
    // fixtures caught). An earlier draft of this note claimed
    // ~100–115°; ground-truth measurement on 2026-11-14 proved that
    // range was never true for this landmark triple. The raw angle is
    // still measured and stored in frontal.jawFrontalAngleDeg; its
    // Harmony weight moved to F8/symmetry, its Definition weight
    // to F8/F6 — exactly the redistribution the spec prescribes. The
    // gonial card below follows the same rule: no side photo, no
    // gonial score (the old frontal fallback scored this angle
    // against a 102–112° band and read 0 for every face).
    // F9 chin-to-philtrum.
    chinPhiltrum: bandScore(f.chinPhiltrumRatio, band(g, [2.05, 2.55, 0.26, 0.26], [2.0, 2.5, 0.26, 0.26])),
    // F10 midface ratio. σ widened 2026-11-15 (0.045/0.055 → 0.06,
    // PSL re-fit): narrower than the landmark noise on the ratio.
    midface: bandScore(f.midfaceRatio, band(g, [0.93, 1.01, 0.06, 0.06], [1.0, 1.1, 0.06, 0.06])),
    // F11 mouth ÷ nose width. σ widened 2026-11-15 (0.08 → 0.12,
    // PSL re-fit): the TikTok PSL-7 face measured 1.31 and scored
    // 17.9 — the band punished a narrow mouth harder than the
    // measurement noise justifies.
    mouthNose: bandScore(f.mouthNoseRatio, band(g, [1.38, 1.53, 0.12, 0.12], [1.45, 1.67, 0.12, 0.12])),
    // F12 brow setedness (low-confidence band per spec — implemented
    // as brow→eye distance ÷ eye width and flagged there).
    browSete:
      g === "female"
        ? bandScore(f.browSetedness, { lo: 0.4, hi: 0.85, sLo: 0.16, sHi: 0.16 })
        : g === "male"
          ? ceilingScore(f.browSetedness, 0.66, 0.12)
          : bandScore(f.browSetedness, { lo: 0.4, hi: 0.755, sLo: 0.14, sHi: 0.14 }),
    // F13 one-eye spacing test. Recentered 2026-11-14 (1.00 → 1.10):
    // the "one eye" rule is an idealisation — real intercanthal/eye
    // width runs ≈1.10 (Farkas: intercanthal ~33mm, fissure ~30mm),
    // and 9 of 9 real faces measured 1.16–1.28, scoring 0–3 against
    // the old centre. σ unchanged. σ widened 2026-11-15 (0.06 → 0.09,
    // PSL re-fit): still narrower than the landmark noise on the
    // intercanthal/eye-width ratio.
    oneEye: bandScore(f.oneEyeRatio, band(g, [1.05, 1.15, 0.09, 0.09], [1.05, 1.15, 0.09, 0.09])),
    // F14 eye aspect ratio. σ widened 2026-11-15 (0.42 → 0.60, PSL
    // re-fit): the TikTok PSL-7 face measured 3.96 and scored 19.3
    // — a narrow hunter-eye fissure punished as a defect.
    eyeAspect: bandScore(f.eyeAspectRatio, band(g, [2.8, 3.6, 0.60, 0.60], [2.5, 3.3, 0.60, 0.60])),
    // F21 eye–mouth distance (Pallett optimum 0.36 — peer-reviewed).
    eyeMouth: bandScore(f.eyeMouthRatio, band(g, [0.36, 0.36, 0.025, 0.025], [0.36, 0.36, 0.025, 0.025])),
    // F22 symmetry — the measured mirror score itself.
    symmetry: m.symmetryScore,
    // F15 lower ÷ upper lip ratio.
    lipRatio: bandScore(f.lipRatio, band(g, [1.4, 2.0, 0.32, 0.32], [1.4, 2.0, 0.32, 0.32])),
    // F17 brow tilt.
    browTilt: bandScore(f.browTiltDeg, band(g, [5, 13, 4, 4], [11, 19, 4, 4])),
    // F18 bitemporal width. σ widened 2026-11-15 (0.06 → 0.08, PSL
    // re-fit): narrower than the landmark noise on the ratio.
    bitemporal: bandScore(f.bitemporalRatio, band(g, [0.84, 0.95, 0.08, 0.08], [0.79, 0.92, 0.08, 0.08])),
  };

  // Side metrics — only when the gate passed (m.side present).
  // DISPLAY READS ONLY since 2026-11-15 (policy (a), audit §4g):
  // they feed the detail-deck cards below (maxilla / mandible /
  // ramus / forehead slope / gonial card) and NEVER join the
  // buckets or the region scores. Absent = the frontal proxies
  // below, never estimated.
  const side = m.side ?? null;
  if (side) {
    metrics.gonial = bandScore(side.gonialAngleDeg, band(g, [112, 123, 5.5, 5.5], [114, 126, 6, 6]));
    metrics.mandPlane = bandScore(side.mandibularPlaneDeg, band(g, [15, 22, 4, 4], [15, 23, 4.5, 4.5]));
    metrics.convG = bandScore(side.convexityGlabellaDeg, band(g, [168, 176, 4, 4], [168, 176, 4, 4]));
    metrics.totalConv = bandScore(side.totalConvexityDeg, band(g, [137, 148, 5.5, 5.5], [137, 148, 5.5, 5.5]));
  }

  // ---- 6-card deck reads (slice 1) — DISPLAY ONLY. None of these
  // join the buckets below: the headline PSL and the region
  // composites are frozen, so a new detail read can never move an
  // existing user's headline score. Bands for the new geometry are
  // initial judgments (documented per metric), not researched
  // ideals — they calibrate with real scan distributions.
  // fd/sd read the optional deck fields through the structural
  // extension above (stored native scans carry them; web-measured
  // scans don't — absent = the card skips).
  const fd = f as FrontalMetricsV2 & FrontalDeckFields;
  const sd = side as (SideMetricsV2 & SideDeckFields) | null;
  const underEyeScore = 100 - clamp(m.skin.underEye, 0, 100);
  // Eyelid exposure — DIRECTION FIX 2026-11-15 (PSL re-fit): the old
  // band [0.45, 0.6] REWARDED high lid exposure, the opposite of the
  // PSL reading — minimal exposure (deep-set hunter eyes) is the
  // ideal, high exposure is the failo. The TikTok PSL-7 face
  // (0.317, hunter eyes the AI praised) scored 3.4. Now a ceiling:
  // at/below 0.35 is full marks, above falls off (0.45 → ~61,
  // 0.60 → ~4). Display-only, as before — never joins a bucket.
  const eyelid =
    typeof fd.eyelidExposureRatio === "number"
      ? ceilingScore(fd.eyelidExposureRatio, 0.35, 0.1)
      : null;
  const noseWidth =
    typeof fd.noseWidthRatio === "number"
      // Recentered 2026-11-14 (0.18–0.22 → 0.23–0.29): the old band
      // encoded the neoclassical "one fifth" canon, but real alar
      // width ÷ bizygomatic runs ≈0.26 (Farkas: ~36mm ÷ ~137mm) and
      // 9 of 9 real faces — including the PSL-8 morph — measured
      // 0.28–0.32 and scored 0–4. Centre 0.26, σ unchanged.
      ? bandScore(fd.noseWidthRatio, { lo: 0.23, hi: 0.29, sLo: 0.03, sHi: 0.03 })
      : null;
  // Orbital depth: deep-set read from brow position + fissure shape
  // (low-set brow + narrow fissure = deep-set). A side-plane
  // refinement was considered and dropped: no bandable side signal
  // exists in the profile chain without inventing one.
  const orbital = weightedMean([
    [metrics.browSete, 1],
    [metrics.eyeAspect, 1],
  ]);
  // Maxilla: profile convexity when a side capture passed (straighter
  // profile = more projected midface), else under-eye support +
  // cheekbone height — both real midface-projection signals.
  const maxilla = side
    ? metrics.totalConv
    : weightedMean([
        [underEyeScore, 1],
        [metrics.cheek, 1],
      ]);
  // Mandible: jaw width + chin balance, plus the side gonial angle
  // when it exists.
  const mandiblePool: [number, number][] = [
    [metrics.bigonial, 3],
    [metrics.chinPhiltrum, 1],
  ];
  if (side) mandiblePool.push([metrics.gonial, 4]);
  const mandible = weightedMean(mandiblePool);
  // Ramus: side height ratio when gated, else the frontal
  // corner-to-chin shadow.
  const ramus =
    sd && typeof sd.ramusHeightRatio === "number"
      ? bandScore(sd.ramusHeightRatio, { lo: 0.35, hi: 0.45, sLo: 0.05, sHi: 0.05 })
      : typeof fd.ramusFrontalRatio === "number"
        ? bandScore(fd.ramusFrontalRatio, { lo: 0.16, hi: 0.22, sLo: 0.03, sHi: 0.03 })
        : null;
  // Forehead slope: side angle (upright = better) when gated, else
  // the frontal taper proxy — weak, flagged in the card note.
  const foreheadSlope =
    sd && typeof sd.foreheadSlopeDeg === "number"
      ? ceilingScore(sd.foreheadSlopeDeg, 12, 8)
      : typeof fd.foreheadTaperRatio === "number"
        ? bandScore(fd.foreheadTaperRatio, { lo: 0.78, hi: 0.88, sLo: 0.04, sHi: 0.04 })
        : null;
  // Gonial card: the side cephalometric band when gated, else NULL —
  // a frontal photo cannot measure the gonial angle (see the F5 note:
  // the frontal angle is ~21–32°, the corner angle ~134–148°, neither
  // is a gonial angle). The old frontal fallback scored the frontal
  // angle against a 102–112° band and read 0 for every face. The card
  // is omitted from the detail deck when null (ramus pattern).
  const gonialCard = side ? metrics.gonial : null;
  // Bone mass + bloat: composites of measured reads, never direct
  // measurements — the notes say so. Bloat is the one inverted
  // read: it grows ONLY with width BEYOND the ideal band (raw
  // widths, not banded scores — banded scores peak AT the ideal,
  // so 100 − fullness would call an ideal-width face maximally
  // bloated). Narrow faces read as no bloat, correctly.
  const boneMass = weightedMean([
    [metrics.cheek, 2],
    [metrics.bigonial, 2],
    [metrics.browSete, 1],
  ]);
  const jawBand = band(g, [0.92, 0.97, 0.03, 0.03], [0.89, 0.94, 0.03, 0.03]);
  const jawExcess = clamp(
    (m.jawToCheekbone - (jawBand.lo + jawBand.hi) / 2) / 0.06,
    0,
    1
  );
  const fwhrExcess = clamp((m.fwhr - 1.98) / 0.12, 0, 1);
  const bloat =
    100 - weightedMean([[jawExcess * 100, 2], [fwhrExcess * 100, 1]]);

  if (eyelid !== null) metrics.eyelid = eyelid;
  if (noseWidth !== null) metrics.noseWidth = noseWidth;
  metrics.underEye = underEyeScore;
  metrics.orbital = orbital;
  metrics.maxilla = maxilla;
  metrics.mandible = mandible;
  if (ramus !== null) metrics.ramus = ramus;
  if (foreheadSlope !== null) metrics.foreheadSlope = foreheadSlope;
  if (gonialCard !== null) metrics.gonialCard = gonialCard;
  metrics.boneMass = boneMass;
  metrics.bloat = bloat;

  // ---- 6-card deck pixel reads (slice 2) — DISPLAY ONLY, same
  // freeze as slice 1: none join the buckets. Mappings are initial
  // judgments, documented per read; they calibrate with real scans.
  const dp = (m as FaceMeasurements & { detailPixels?: DetailPixelRaws | null })
    .detailPixels ?? null;
  if (dp) {
    if (typeof dp.browCoverage === "number") {
      metrics.browDensity = clamp(dp.browCoverage * 125, 0, 100);
    }
    if (typeof dp.lashCoverage === "number") {
      // Lash bands are mostly skin with a dark line: dense lashes
      // cover ~half the band. Weakest signal in the set.
      metrics.lashDensity = clamp(dp.lashCoverage * 200, 0, 100);
    }
    if (typeof dp.hairlineRecedeRatio === "number") {
      const rec = clamp(dp.hairlineRecedeRatio, 0, 1);
      metrics.hairRecede = 100 - clamp((rec / 0.5) * 100, 0, 100);
      // Frontal-only Norwood: the crown is unseen, so the stage caps
      // at 4 — a frontal photo cannot stage 5–7 honestly.
      const stage = rec < 0.05 ? 1 : rec < 0.15 ? 2 : rec < 0.3 ? 3 : 4;
      metrics.norwood = 100 - (stage - 1) * 20;
    }
    if (typeof dp.hairLightFraction === "number") {
      metrics.hairThinning = 100 - clamp(dp.hairLightFraction, 0, 1) * 100;
    }
    if (typeof dp.hairlineDensityCoverage === "number") {
      metrics.hairlineDensity = clamp((dp.hairlineDensityCoverage / 0.8) * 100, 0, 100);
    }
    if (typeof dp.neckWidthRatio === "number") {
      metrics.neckWidth = bandScore(dp.neckWidthRatio, { lo: 0.65, hi: 0.85, sLo: 0.07, sHi: 0.07 });
    }
    if (typeof dp.hyoidSkinFraction === "number") {
      metrics.hyoid = 100 - clamp(dp.hyoidSkinFraction, 0, 1) * 100;
    }
  }

  // ---- Buckets (spec §5.3; weights renormalised over what's in) ----
  const harmonyPool: [number, number][] = [
    [metrics.esr, 7],
    [metrics.thirds, 6],
    [metrics.tilt, 6],
    [metrics.cheek, 5],
    [metrics.symmetry, 6],
    [metrics.totalHW, 3],
    [metrics.bigonial, 6],
    [metrics.chinPhiltrum, 2.5],
    [metrics.midface, 2],
    [metrics.mouthNose, 2],
    [metrics.browSete, 2],
    [metrics.oneEye, 2],
    [metrics.eyeAspect, 2],
    [metrics.eyeMouth, 2],
    [metrics.lipRatio, 1.5],
    [metrics.browTilt, 1.2],
    [metrics.bitemporal, 1],
  ];
  // No side terms in any pool (policy (a), audit §4g): side angles
  // score ~0 for real faces and their presence/absence alone moved
  // G by ~0.76. The side reads live in the detail deck only.
  const harmony = weightedMean(harmonyPool);

  // Dimorphism: the same features re-scored against the user's OWN
  // sex bands — relative-to-sex is what the formula's table is.
  const dimorphismPool: [number, number][] = [
    [metrics.tilt, 1],
    [metrics.fwhr, 1],
    [metrics.bigonial, 1],
    [metrics.browSete, 1],
    [metrics.midface, 0.75],
    [metrics.chinPhiltrum, 0.75],
    [metrics.browTilt, 0.6],
    [metrics.lipRatio, 0.5],
  ];
  const dimorphism = weightedMean(dimorphismPool);

  // Definition (the formula's "bodyfat factors", honestly named):
  // how visible the bone structure reads in this photo. (F5's share
  // lives here as extra F8/F6 weight — see the F5 note above.)
  const definitionPool: [number, number][] = [
    [metrics.bigonial, 1],
    [metrics.cheek, 1],
  ];
  const definition = weightedMean(definitionPool);

  // Misc: skin quality + the formula's dark-circles item, minus a
  // gross-asymmetry penalty (the formula deducts it here too).
  const miscBase =
    0.7 * skinQualityScore(m) + 0.3 * (100 - clamp(m.skin.underEye, 0, 100));
  const asymPenalty = clamp((72 - m.symmetryScore) * 0.6, 0, 18);
  const misc = clamp(miscBase - asymPenalty, 0, 100);

  const composite =
    0.4 * harmony + 0.2 * dimorphism + 0.25 * definition + 0.15 * misc;

  return {
    metrics,
    thirds,
    buckets: { harmony, dimorphism, definition, misc },
    composite,
    sideAvailable: !!side,
  };
}

// ---------- Hybrid v5 geometry helpers (2026-11-15) ----------
// The hybrid assembly (score-ai route v5 + the native blend.ts mirror)
// weighs MEASURED bone + harmony with the AI's soft reads. These
// helpers are the geometry half of that assembly. They MUST mirror
// the native client's src/lib/blend.ts and the harness
// (~/workspace/psl-accuracy-harness/validate_hybrid_v5.mjs) exactly —
// the harness cross-checks all three on every validation face.

/** The bone composite B from the three buckets: the same weighted
 *  mean the geometry-only PSL anchors on (0.40·H + 0.20·Dim +
 *  0.25·Def) / 0.85. B is the hybrid's bone input — except when fat
 *  is present (AI leanness < 50), where the AI's visible-bone read
 *  governs instead (geometry reads fat width as bone; see the
 *  route's visible-bone rule). */
export function boneCompositeOf(buckets: {
  harmony: number;
  dimorphism: number;
  definition: number;
}): number {
  return (
    (0.4 * buckets.harmony +
      0.2 * buckets.dimorphism +
      0.25 * buckets.definition) /
    0.85
  );
}

/** The mis-fit signal from the metric scores: elite bone structure
 *  (high bigonial/chinPhiltrum/cheek/symmetry/browSete) with
 *  punished proportions (low tilt/thirds/totalHW/fwhr/esr/midface)
 *  means the bands are mis-fitting an elite face — the TikTok
 *  signature (structure 94.7, proportions 48.9, misfit 1.0). The
 *  same formula the 50/50 blend's geometryConfidence used. */
export function misfitFromMetrics(
  metricScores: Record<string, number | null | undefined>
): number {
  const mean = (keys: string[]): number => {
    const vals = keys
      .map((k) => metricScores[k])
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    return vals.length > 0
      ? vals.reduce((a, b) => a + b, 0) / vals.length
      : 0;
  };
  const struct = mean([
    "bigonial",
    "chinPhiltrum",
    "cheek",
    "symmetry",
    "browSete",
  ]);
  const prop = mean(["tilt", "thirds", "totalHW", "fwhr", "esr", "midface"]);
  const gap = struct - prop;
  return (
    clamp((gap - 15) / 25, 0, 1) * clamp((struct - 80) / 10, 0, 1)
  );
}

/** The harmony pool restricted to NON-proportion metrics, weighted
 *  by the same weights as scoreBreakdownV2's harmony pool. The
 *  proportion metrics (esr, thirds, tilt, totalHW, midface,
 *  mouthNose, oneEye, eyeAspect) are the ones whose bands punish
 *  elite faces; the structure metrics (cheek, symmetry, bigonial,
 *  chinPhiltrum, browSete, eyeMouth, lipRatio, browTilt,
 *  bitemporal) stay reliable. Null when no structure metric is
 *  present. */
export function harmonyStructureOf(
  metricScores: Record<string, number | null | undefined>
): number | null {
  const pool: [string, number][] = [
    ["cheek", 5],
    ["symmetry", 6],
    ["bigonial", 6],
    ["chinPhiltrum", 2.5],
    ["browSete", 2],
    ["eyeMouth", 2],
    ["lipRatio", 1.5],
    ["browTilt", 1.2],
    ["bitemporal", 1],
  ];
  let acc = 0;
  let wSum = 0;
  for (const [key, w] of pool) {
    const v = metricScores[key];
    if (typeof v === "number" && Number.isFinite(v)) {
      acc += w * v;
      wSum += w;
    }
  }
  return wSum > 0 ? acc / wSum : null;
}

/** The mis-fit-corrected Harmony: H_fixed = (1−misfit)·H +
 *  misfit·H_struct. When the bands fit (misfit 0 — every ordinary
 *  face), H_fixed IS H. When they mis-fit an elite face (misfit
 *  1.0 — TikTok), the punished proportion metrics drop out and the
 *  structure metrics carry Harmony (TikTok: 68.3 → 89.7). The
 *  hybrid's harmony input. */
export function harmonyFixedOf(
  metricScores: Record<string, number | null | undefined>,
  harmony: number
): number {
  const struct = harmonyStructureOf(metricScores);
  if (struct === null) return harmony;
  const misfit = misfitFromMetrics(metricScores);
  return (1 - misfit) * harmony + misfit * struct;
}

/** Stamp a v2 scan's summary fields from the breakdown (the scan flow
 *  calls this once skin is merged): overallScore = composite C,
 *  goldenRatioScore = Harmony (the legacy field's v2 meaning — see
 *  lib/types.ts). No-op for v1 measurements. */
export function applyScoringV2(m: FaceMeasurements): FaceMeasurements {
  const b = scoreBreakdownV2(m);
  if (!b) return m;
  return {
    ...m,
    overallScore: round1(b.composite),
    goldenRatioScore: round1(b.buckets.harmony),
  };
}

// ---------------------------------------------------------------------------
// Headline score + potential
// ---------------------------------------------------------------------------

/** PSL /10 for a scan. v2: the anchored map on the composite.
 *  v1: the legacy mapping, untouched.
 *
 *  Anchor recalibrated 2026-11-14 (50 → 68): the v2 metric fixes
 *  removed the dead terms that were silently dragging every
 *  composite down ~18 points (totalHW/oneEye/bitemporal scored
 *  0 for nearly every real face). With honest bands (σ ≈ population
 *  SD) a typical face now composites ≈70, not ≈50 — the old anchor
 *  would have scored the average man 7/10. The new anchor 68 is the
 *  median composite of 9 ground-truth faces (70.4) minus ~2 points
 *  for typical real-world skin (the harness holds skin perfect; real
 *  Misc runs ~73 not 100). Slope unchanged (12.5 C per PSL8): the
 *  composite SD across real faces is ≈10, giving a PSL SD ≈1.0, in
 *  line with the scale. Residual uncertainty ≈ ±0.3 PSL — the anchor
 *  rests on 9 faces, not a population sample; recalibrate against a
 *  larger scan set when one exists. */
export function pslScore(m: FaceMeasurements): number {
  if (isV2(m)) {
    const b = scoreBreakdownV2(m);
    if (b) {
      const psl8 = clamp(4.0 + (b.composite - 68) / 12.5, 0.5, 8.0);
      return round1(psl8 * 1.25);
    }
  }
  return pslScoreV1(m);
}

/** How much headroom the improvable reads leave on the table (0–1.6
 *  PSL points). Skin reads are "lower is better" except under-eye is
 *  stored as a darkness score (higher = darker). Unchanged from v1 —
 *  the spec keeps POTENTIAL exactly as it is (skin headroom only:
 *  habits move it, bone structure doesn't). */
export function pslPotential(m: FaceMeasurements): number {
  const s = m.skin;
  const deficit =
    clamp(s.redness / 100, 0, 1) * 0.45 +
    clamp(s.texture / 100, 0, 1) * 0.35 +
    clamp(s.underEye / 100, 0, 1) * 0.4 +
    clamp(s.blemishCount / 20, 0, 1) * 0.3;
  const headroom = clamp(deficit, 0.15, 1.6);
  return round1(clamp(pslScore(m) + headroom, 0.5, 9.9));
}

/** One-word verdict for a region score /10. Blunt on purpose —
 *  this is the community's register, not a participation trophy. */
export function regionVerdict(score10: number): string {
  if (score10 < 4) return "Failo";
  if (score10 < 5.5) return "Weak";
  if (score10 < 7) return "Average";
  if (score10 < 8.5) return "Good";
  return "Elite";
}

// ---------------------------------------------------------------------------
// Region decks
// ---------------------------------------------------------------------------

export interface RegionScore {
  key: "eyes" | "midface" | "lowerThird" | "upperThird";
  label: string;
  /** 0–10, one decimal. */
  score: number;
  note: string;
}

/** Per-region reads for the results deck — each a blend of the real
 *  measurements that describe that third of the face. */
export function regionScores(m: FaceMeasurements): RegionScore[] {
  if (isV2(m)) {
    const b = scoreBreakdownV2(m);
    if (b) return regionScoresV2(m, b);
  }
  return regionScoresV1(m);
}

function regionScoresV2(m: FaceMeasurements, b: ScoreBreakdownV2): RegionScore[] {
  const x = b.metrics;
  const to10 = (v: number) => round1(clamp(v / 10, 0, 10));
  const eyes = weightedMean([
    [x.esr, 7],
    [x.tilt, 6],
    [x.eyeAspect, 2],
    [x.browSete, 2],
    [x.oneEye, 2],
  ]);
  const midface = weightedMean([
    [x.midface, 2],
    [b.thirds.mid, 2],
    [x.fwhr, 5],
    [x.cheek, 5],
  ]);
  const lowerPool: [number, number][] = [
    [x.bigonial, 5],
    [x.chinPhiltrum, 2.5],
    [x.lipRatio, 1.5],
    [b.thirds.lower, 2],
  ];
  // Frontal-only (policy (a), audit §4g): the side gonial angle
  // no longer joins the Lower Third region score. The gonial read
  // survives as a detail-deck card when a side photo passed.
  const lowerThird = weightedMean(lowerPool);
  const upperThird = weightedMean([
    [b.thirds.upper, 2],
    [x.bitemporal, 1],
    [x.browTilt, 1.2],
  ]);
  void m;
  return [
    {
      key: "eyes",
      label: "Eyes",
      score: to10(eyes),
      note: "Spacing, tilt, eye shape and brow position — pure geometry. Skin moved to the Misc deck, where it's counted once.",
    },
    {
      key: "midface",
      label: "Midface",
      score: to10(midface),
      note: "Midface ratio, width-to-height and cheekbone height through the middle third — mostly structure, read honestly.",
    },
    {
      key: "lowerThird",
      label: "Lower Third",
      score: to10(lowerThird),
      note: "Jaw width, chin-to-philtrum and lip balance — body composition changes how it reads.",
    },
    {
      key: "upperThird",
      label: "Upper Third",
      score: to10(upperThird),
      note: "Forehead proportion (hairline estimated), temple width and the brow line.",
    },
  ];
}

function regionScoresV1(m: FaceMeasurements): RegionScore[] {
  const tilt = closeness(m.canthalTiltDeg, 3, 8, 10);
  const eyes = (tilt * 0.55 + (100 - m.skin.underEye) * 0.45) / 10;

  const midThird = closeness(m.facialThirds.mid, 0.31, 0.36, 0.12);
  const fwhr = closeness(m.fwhr, 1.85, 2.05, 0.5);
  const midface = (midThird * 0.5 + fwhr * 0.5) / 10;

  const jaw = closeness(m.jawToCheekbone, 0.84, 0.95, 0.25);
  const lowerThird = (jaw * 0.7 + closeness(m.facialThirds.lower, 0.31, 0.36, 0.12) * 0.3) / 10;

  const upper = closeness(m.facialThirds.upper, 0.31, 0.36, 0.12);
  const foreheadSkin = 100 - (m.skin.redness * 0.5 + m.skin.texture * 0.5);
  const upperThird = (upper * 0.6 + foreheadSkin * 0.4) / 10;

  return [
    {
      key: "eyes",
      label: "Eyes",
      score: round1(clamp(eyes, 0, 10)),
      note: "Canthal tilt and the under-eye area — sleep and skin move this fastest.",
    },
    {
      key: "midface",
      label: "Midface",
      score: round1(clamp(midface, 0, 10)),
      note: "Proportions through the middle third — mostly structure, read honestly.",
    },
    {
      key: "lowerThird",
      label: "Lower Third",
      score: round1(clamp(lowerThird, 0, 10)),
      note: "Jaw-to-cheekbone relationship — body composition changes how it reads.",
    },
    {
      key: "upperThird",
      label: "Upper Third",
      score: round1(clamp(upperThird, 0, 10)),
      note: "Forehead proportion and skin quality across the upper face.",
    },
  ];
}

export interface MiscScore {
  label: string;
  /** 0–10, one decimal. */
  score: number;
  note: string;
}

/** The second results deck ("Miscellaneous" in the reference app) —
 *  six more reads, every one computed from measurements we actually
 *  take. Nothing here is a borrowed label over an unmeasured trait:
 *  no neck width, no bone mass — we don't measure those, so they
 *  don't appear. */
export function miscScores(m: FaceMeasurements): MiscScore[] {
  if (isV2(m)) {
    const b = scoreBreakdownV2(m);
    if (b) return miscScoresV2(m, b);
  }
  return miscScoresV1(m);
}

function miscScoresV2(m: FaceMeasurements, b: ScoreBreakdownV2): MiscScore[] {
  const x = b.metrics;
  const to10 = (v: number) => round1(clamp(v / 10, 0, 10));
  // His Misc list (Zayne 2026-10-25), in his order. Neck Width lands
  // with the slice-2 pixel work, between Symmetry and Bloat.
  return [
    {
      label: "Skin",
      score: to10(skinQualityScore(m)),
      note: "Redness, texture, under-eye and blemishes, combined. The fastest-moving number you own.",
    },
    {
      label: "Harmony",
      score: to10(b.buckets.harmony),
      note: "Every measured ratio scored against its researched ideal band, combined — the community's harmony read, computed from your landmarks.",
    },
    {
      label: "Symmetry",
      score: to10(m.symmetryScore),
      note: "Left-right mirror match across 16 landmark pairs. Sleep, posture and camera angle all move it.",
    },
    ...(typeof x.neckWidth === "number"
      ? [
          {
            label: "Neck Width",
            score: to10(x.neckWidth),
            note: "Neck skin span against face width — collars and long hair move it.",
          },
        ]
      : []),
    {
      label: "Bloat",
      score: to10(x.bloat),
      note: "Width beyond the ideal band, inverted — lean reads high, excess width reads low. Width-based: bone widens it too, so read it with Jaw Width.",
    },
    {
      label: "Bone Mass",
      score: to10(x.boneMass),
      note: "Bone-prominence composite from cheekbones, jaw width and brow set — a computed composite, not a scan of bone.",
    },
  ];
}

function miscScoresV1(m: FaceMeasurements): MiscScore[] {
  const s = m.skin;
  const skinQuality =
    100 -
    (clamp(s.redness, 0, 100) * 0.3 +
      clamp(s.texture, 0, 100) * 0.3 +
      clamp(s.underEye, 0, 100) * 0.2 +
      clamp(s.blemishCount * 4, 0, 100) * 0.2);
  const fifthsDev =
    m.fifths.reduce((acc, f) => acc + Math.abs(f - 0.2), 0) / m.fifths.length;
  const eyeSpacing = clamp(100 - (fifthsDev / 0.08) * 100, 0, 100);
  const thirdsDev =
    (Math.abs(m.facialThirds.upper - 1 / 3) +
      Math.abs(m.facialThirds.mid - 1 / 3) +
      Math.abs(m.facialThirds.lower - 1 / 3)) /
    3;
  const proportions = clamp(100 - (thirdsDev / 0.1) * 100, 0, 100);
  const jaw = closeness(m.jawToCheekbone, 0.84, 0.95, 0.25);

  const to10 = (v: number) => round1(clamp(v / 10, 0, 10));
  return [
    {
      label: "Skin",
      score: to10(skinQuality),
      note: "Redness, texture, under-eye and blemishes, combined. The fastest-moving number you own.",
    },
    {
      label: "Harmony",
      score: to10(m.goldenRatioScore),
      note: "How closely your proportions track the classical ratios, as one composite.",
    },
    {
      label: "Symmetry",
      score: to10(m.symmetryScore),
      note: "Left-right mirror match across 478 landmarks. Sleep, posture and camera angle all move it.",
    },
    {
      label: "Jawline",
      score: to10(jaw),
      note: "Jaw width against cheekbone width — leanness changes how hard this reads.",
    },
    {
      label: "Eye Spacing",
      score: to10(eyeSpacing),
      note: "Your horizontal fifths against the one-eye-width ideal the community measures by.",
    },
    {
      label: "Proportions",
      score: to10(proportions),
      note: "How evenly your face splits into its three thirds. Structure — read honestly, trained around.",
    },
  ];
}

export interface RegionDetailScore {
  label: string;
  /** 0–10, one decimal — same scale as RegionScore/MiscScore. */
  score: number;
  note: string;
}

export interface RegionDetails {
  key: RegionScore["key"];
  label: string;
  metrics: RegionDetailScore[];
}

/** Per-region DETAIL reads for the results deck's region pages —
 *  the individual measured traits behind each region composite,
 *  grouped the way the reference deck pages them (Eyes / Midface /
 *  Lower Third / Upper Third). Every entry is a metric the engine
 *  actually scores; traits we don't measure (hair staging, lash
 *  density) never appear as borrowed labels. Side metrics join the
 *  Lower Third page only when the side gate passed — absent means
 *  renormalised out, never estimated. */
export function regionDetailScores(m: FaceMeasurements): RegionDetails[] {
  if (isV2(m)) {
    const b = scoreBreakdownV2(m);
    if (b) return regionDetailScoresV2(b);
  }
  return regionDetailScoresV1(m);
}

function regionDetailScoresV2(b: ScoreBreakdownV2): RegionDetails[] {
  const x = b.metrics;
  const to10 = (v: number) => round1(clamp(v / 10, 0, 10));
  // His 6-card lists (Zayne 2026-10-25), in his order. Slots whose
  // measurement lands in slice 2 (pixel) are absent until then —
  // a card never renders without a computed value, and old scans
  // whose stored frontal lacks a new field skip that card rather
  // than showing an estimate (history is never rescored).
  const eyes: RegionDetailScore[] = [
    {
      label: "Orbital Depth",
      score: to10(x.orbital),
      note: "Deep-set read from brow position + fissure shape — a derived read, not a depth scan.",
    },
    {
      label: "Canthal Tilt",
      score: to10(x.tilt),
      note: "The upward angle of the eye line — positive tilt reads sharper.",
    },
    ...(typeof x.browDensity === "number"
      ? [
          {
            label: "Eyebrow Density",
            score: to10(x.browDensity),
            note: "Dark-pixel coverage of the brow boxes — measured from the photo, not the brow shape.",
          },
        ]
      : []),
    ...(typeof x.lashDensity === "number"
      ? [
          {
            label: "Eyelash Density",
            score: to10(x.lashDensity),
            note: "Dark-pixel coverage of the lash bands — the weakest read in the set, a few pixels tall.",
          },
        ]
      : []),
    ...(typeof x.eyelid === "number"
      ? [
          {
            label: "Eyelid Exposure",
            score: to10(x.eyelid),
            note: "How much lid sits over the iris — measured from iris centre vs fissure height.",
          },
        ]
      : []),
    {
      label: "Under Eye Health",
      score: to10(x.underEye),
      note: "Under-eye darkness and hollowing — sleep moves this fastest.",
    },
  ];
  const midface: RegionDetailScore[] = [
    {
      label: "Cheekbones",
      score: to10(x.cheek),
      note: "How high the cheekbones sit — height, not size.",
    },
    {
      label: "Maxilla",
      score: to10(x.maxilla),
      note: b.sideAvailable
        ? "Midface projection from your side profile — straighter reads more forward-grown."
        : "Midface-projection read from under-eye support + cheekbone height (side photo refines it).",
    },
    ...(typeof x.noseWidth === "number"
      ? [
          {
            label: "Nose",
            score: to10(x.noseWidth),
            note: "Nose width against face width — about a quarter of face width reads balanced.",
          },
        ]
      : []),
    {
      label: "IPD",
      score: to10(x.esr),
      note: "Interpupillary distance against face width — the heaviest-weighted frontal read in the formula.",
    },
    {
      label: "FWHR",
      score: to10(x.fwhr),
      note: "Face width against midface height — breadth through the middle of the face.",
    },
    {
      label: "Compactness",
      score: to10(x.midface),
      note: "The middle segment's length against its ideal — compact reads younger.",
    },
  ];
  const lower: RegionDetailScore[] = [
    {
      label: "Lips",
      score: to10(x.lipRatio),
      note: "Lower lip against upper lip — fullness in proportion, not size.",
    },
    {
      label: "Mandible",
      score: to10(x.mandible),
      note: "Jaw definition from width + chin balance (side angle joins it when a side photo passes).",
    },
    ...(typeof x.gonialCard === "number"
      ? [
          {
            label: "Gonial Angle",
            score: to10(x.gonialCard),
            note: "The jaw angle from your side photo — sharper reads more defined.",
          },
        ]
      : []),
    ...(typeof x.ramus === "number"
      ? [
          {
            label: "Ramus",
            score: to10(x.ramus),
            note: b.sideAvailable
              ? "Ramus height from your side photo — taller reads stronger."
              : "Ramus read from lower-face height — a side photo refines it to the true ramus.",
          },
        ]
      : []),
    ...(typeof x.hyoid === "number"
      ? [
          {
            label: "Hyoid Tightness",
            score: to10(x.hyoid),
            note: "Submental skin fill from your side photo — less fill reads tighter. Beards break this read.",
          },
        ]
      : []),
    {
      label: "Jaw Width",
      score: to10(x.bigonial),
      note: "Jaw width against cheekbone width — leanness changes how hard it reads.",
    },
  ];
  const upper: RegionDetailScore[] = [
    ...(typeof x.norwood === "number"
      ? [
          {
            label: "Norwood Stage",
            score: to10(x.norwood),
            note: "Hairline recession staged 1–4 from the front photo — the crown is unseen, so stages 5–7 are never claimed.",
          },
        ]
      : []),
    {
      label: "Forehead Prop.",
      score: to10(b.thirds.upper),
      note: "The upper third's share of total face height — hairline estimated.",
    },
    ...(typeof x.hairRecede === "number"
      ? [
          {
            label: "Hairline Recede",
            score: to10(x.hairRecede),
            note: "Temple hairline against the centre forelock — the continuous version of the Norwood read.",
          },
        ]
      : []),
    ...(typeof x.hairThinning === "number"
      ? [
          {
            label: "Hair Thinning",
            score: to10(x.hairThinning),
            note: "Scalp show-through in the hair zone — light hair reads thinner than it is.",
          },
        ]
      : []),
    ...(typeof x.hairlineDensity === "number"
      ? [
          {
            label: "Hairline Density",
            score: to10(x.hairlineDensity),
            note: "Dark-pixel coverage right on the hairline edge — a full edge reads dense.",
          },
        ]
      : []),
    ...(typeof x.foreheadSlope === "number"
      ? [
          {
            label: "Forehead Slope",
            score: to10(x.foreheadSlope),
            note: b.sideAvailable
              ? "Forehead inclination from your side photo — upright reads better."
              : "Forehead-slope read from frontal taper — weak proxy, a side photo refines it.",
          },
        ]
      : []),
  ];
  return [
    { key: "eyes", label: "Eyes", metrics: eyes },
    { key: "midface", label: "Midface", metrics: midface },
    { key: "lowerThird", label: "Lower Third", metrics: lower },
    { key: "upperThird", label: "Upper Third", metrics: upper },
  ];
}

function regionDetailScoresV1(m: FaceMeasurements): RegionDetails[] {
  const d = (v: number) => round1(clamp(v / 10, 0, 10));
  return [
    {
      key: "eyes",
      label: "Eyes",
      metrics: [
        {
          label: "Canthal Tilt",
          score: d(closeness(m.canthalTiltDeg, 3, 8, 10)),
          note: "The upward angle of the eye line — positive tilt reads sharper.",
        },
        {
          label: "Under-Eye",
          score: d(100 - m.skin.underEye),
          note: "Under-eye darkness and hollowing — sleep moves this fastest.",
        },
      ],
    },
    {
      key: "midface",
      label: "Midface",
      metrics: [
        {
          label: "Mid Third",
          score: d(closeness(m.facialThirds.mid, 0.31, 0.36, 0.12)),
          note: "The middle third's share of total face height.",
        },
        {
          label: "FWHR",
          score: d(closeness(m.fwhr, 1.85, 2.05, 0.5)),
          note: "Face width against midface height — breadth through the middle of the face.",
        },
      ],
    },
    {
      key: "lowerThird",
      label: "Lower Third",
      metrics: [
        {
          label: "Jaw Width",
          score: d(closeness(m.jawToCheekbone, 0.84, 0.95, 0.25)),
          note: "Jaw width against cheekbone width — body composition changes how it reads.",
        },
        {
          label: "Lower Third",
          score: d(closeness(m.facialThirds.lower, 0.31, 0.36, 0.12)),
          note: "The lower third's share of total face height.",
        },
      ],
    },
    {
      key: "upperThird",
      label: "Upper Third",
      metrics: [
        {
          label: "Upper Third",
          score: d(closeness(m.facialThirds.upper, 0.31, 0.36, 0.12)),
          note: "The upper third's share of total face height.",
        },
        {
          label: "Forehead Skin",
          score: d(100 - (m.skin.redness * 0.5 + m.skin.texture * 0.5)),
          note: "Redness and texture across the forehead.",
        },
      ],
    },
  ];
}

/** The ascend countdown: our programme is 90 days (Zayne, 2026-10-22
 *  — aligned with the category leader and the native app). The 90
 *  days are the 12 protocol weeks (84 days) plus a final 6-day
 *  consolidation stretch (days 85–90) that runs the plan's own
 *  consolidation week — see todaysSections in daily.ts. The finish
 *  date and days-left derive from the journey start, exactly like
 *  the mechanism this mirrors — never a random date. */
export const ASCEND_PROGRAM_DAYS = 90;

export function ascendByDate(start: Date): Date {
  const d = new Date(start);
  d.setDate(d.getDate() + ASCEND_PROGRAM_DAYS);
  return d;
}

export function daysUntilAscend(start: Date, now: Date = new Date()): number {
  const msLeft = ascendByDate(start).getTime() - now.getTime();
  return clamp(Math.ceil(msLeft / (24 * 60 * 60 * 1000)), 0, ASCEND_PROGRAM_DAYS);
}

export function formatAscendDate(d: Date, locale = "en-US"): string {
  return d.toLocaleDateString(locale, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
