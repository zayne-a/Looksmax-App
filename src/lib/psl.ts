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
 *    PSL8 = clamp(4.0 + (C − 50)/12.5, 0.5, 7.9); display /10 = ×1.25.
 *    A population-typical face lands at C ≈ 50 → PSL 5.0/10 (MTN).
 *  - Side metrics join only when the side capture passed the
 *    confidence gate in lib/face.ts; otherwise weights renormalise.
 *
 * v1 scans (no engineVersion) keep their original numbers forever:
 * the legacy mapping below is preserved verbatim and history is
 * never rescored.
 */
import type { FaceMeasurements } from "./types";

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
  /** True when side metrics passed the gate and joined the pools. */
  sideIncluded: boolean;
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

  // Per-third proportion scores: Gaussian around 1/3, σ = 0.022 (the
  // formula's Tier-1 allows ≤1–3% deviation; pslscale's tiers run
  // 3–6% dev at PSL 4 to <3% at PSL 5).
  const thirdScore = (v: number): number => {
    const d = v - 1 / 3;
    return 100 * Math.exp(-0.5 * (d / 0.022) * (d / 0.022));
  };
  const thirds = {
    upper: thirdScore(m.facialThirds.upper),
    mid: thirdScore(m.facialThirds.mid),
    lower: thirdScore(m.facialThirds.lower),
  };

  const metrics: Record<string, number> = {
    // F1 ESR — the heaviest frontal metric in the formula.
    esr: bandScore(f.esr, band(g, [0.443, 0.477, 0.017, 0.017], [0.45, 0.479, 0.017, 0.017])),
    // F2 thirds (mean of the three per-third scores).
    thirds: (thirds.upper + thirds.mid + thirds.lower) / 3,
    // F3 canthal tilt — asymmetric: the low/negative side falls ~2×
    // faster than the high side (spec: negative tilt punished ~2×).
    tilt: bandScore(m.canthalTiltDeg, band(g, [5, 8.5, 1.15, 2.4], [6, 9.5, 1.25, 2.6])),
    // F4 true FWHR — scored in Dimorphism (spec pick), never "higher
    // is better" past the band; above-band falls faster (Geniole).
    fwhr: bandScore(m.fwhr, band(g, [1.9, 2.06, 0.1, 0.07], [1.9, 2.06, 0.1, 0.07])),
    // F7 total height ÷ width — replaces the debunked φ target.
    totalHW: bandScore(f.totalHeightWidth, band(g, [1.33, 1.38, 0.03, 0.03], [1.29, 1.33, 0.03, 0.03])),
    // F8 bigonial ÷ bizygomatic.
    bigonial: bandScore(m.jawToCheekbone, band(g, [0.85, 0.92, 0.04, 0.04], [0.82, 0.89, 0.04, 0.04])),
    // F6 cheekbone setedness — one-directional, saturating.
    cheek: saturatingScore(f.cheekboneSetedness, 0.81, 0.07),
    // F5 jaw frontal angle is NOT scored: the spec allows dropping it
    // if it proves unstable on reference geometry, and it does — in
    // frontal projection the angle (ramus→corner→chin) sits at
    // ~100–115° for every plausible face because the chin vector is
    // mostly horizontal, so the formula's 84–95° cephalometric band
    // is unreachable and the term would be structurally ~0 for
    // everyone (the same dead-term failure as the v1 FWHR bug, which
    // the calibration fixtures caught). The raw angle is still
    // measured and stored in frontal.jawFrontalAngleDeg; its
    // Harmony weight moved to F8/symmetry, its Definition weight
    // to F8/F6 — exactly the redistribution the spec prescribes.
    // F9 chin-to-philtrum.
    chinPhiltrum: bandScore(f.chinPhiltrumRatio, band(g, [2.05, 2.55, 0.26, 0.26], [2.0, 2.5, 0.26, 0.26])),
    // F10 midface ratio.
    midface: bandScore(f.midfaceRatio, band(g, [0.93, 1.01, 0.045, 0.045], [1.0, 1.1, 0.055, 0.055])),
    // F11 mouth ÷ nose width.
    mouthNose: bandScore(f.mouthNoseRatio, band(g, [1.38, 1.53, 0.08, 0.08], [1.45, 1.67, 0.08, 0.08])),
    // F12 brow setedness (low-confidence band per spec — implemented
    // as brow→eye distance ÷ eye width and flagged there).
    browSete:
      g === "female"
        ? bandScore(f.browSetedness, { lo: 0.4, hi: 0.85, sLo: 0.16, sHi: 0.16 })
        : g === "male"
          ? ceilingScore(f.browSetedness, 0.66, 0.12)
          : bandScore(f.browSetedness, { lo: 0.4, hi: 0.755, sLo: 0.14, sHi: 0.14 }),
    // F13 one-eye spacing test.
    oneEye: bandScore(f.oneEyeRatio, band(g, [0.95, 1.05, 0.06, 0.06], [0.95, 1.05, 0.06, 0.06])),
    // F14 eye aspect ratio.
    eyeAspect: bandScore(f.eyeAspectRatio, band(g, [2.8, 3.6, 0.42, 0.42], [2.5, 3.3, 0.42, 0.42])),
    // F21 eye–mouth distance (Pallett optimum 0.36 — peer-reviewed).
    eyeMouth: bandScore(f.eyeMouthRatio, band(g, [0.36, 0.36, 0.025, 0.025], [0.36, 0.36, 0.025, 0.025])),
    // F22 symmetry — the measured mirror score itself.
    symmetry: m.symmetryScore,
    // F15 lower ÷ upper lip ratio.
    lipRatio: bandScore(f.lipRatio, band(g, [1.4, 2.0, 0.32, 0.32], [1.4, 2.0, 0.32, 0.32])),
    // F17 brow tilt.
    browTilt: bandScore(f.browTiltDeg, band(g, [5, 13, 4, 4], [11, 19, 4, 4])),
    // F18 bitemporal width.
    bitemporal: bandScore(f.bitemporalRatio, band(g, [0.84, 0.95, 0.06, 0.06], [0.79, 0.92, 0.06, 0.06])),
  };

  // Side metrics — only when the gate passed (m.side present). They
  // join the pools at their printed weights; absent = renormalised
  // out, never estimated.
  const side = m.side ?? null;
  if (side) {
    metrics.gonial = bandScore(side.gonialAngleDeg, band(g, [112, 123, 5.5, 5.5], [114, 126, 6, 6]));
    metrics.mandPlane = bandScore(side.mandibularPlaneDeg, band(g, [15, 22, 4, 4], [15, 23, 4.5, 4.5]));
    metrics.convG = bandScore(side.convexityGlabellaDeg, band(g, [168, 176, 4, 4], [168, 176, 4, 4]));
    metrics.totalConv = bandScore(side.totalConvexityDeg, band(g, [137, 148, 5.5, 5.5], [137, 148, 5.5, 5.5]));
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
  if (side) {
    harmonyPool.push(
      [metrics.gonial, 8],
      [metrics.mandPlane, 2.5],
      [metrics.convG, 2],
      [metrics.totalConv, 1.5]
    );
  }
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
  if (side) dimorphismPool.push([metrics.gonial, 1]);
  const dimorphism = weightedMean(dimorphismPool);

  // Definition (the formula's "bodyfat factors", honestly named):
  // how visible the bone structure reads in this photo. (F5's share
  // lives here as extra F8/F6 weight — see the F5 note above.)
  const definitionPool: [number, number][] = [
    [metrics.bigonial, 1],
    [metrics.cheek, 1],
  ];
  if (side) definitionPool.push([metrics.gonial, 1.25]);
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
    sideIncluded: !!side,
  };
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
 *  v1: the legacy mapping, untouched. */
export function pslScore(m: FaceMeasurements): number {
  if (isV2(m)) {
    const b = scoreBreakdownV2(m);
    if (b) {
      const psl8 = clamp(4.0 + (b.composite - 50) / 12.5, 0.5, 7.9);
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
  if (b.sideIncluded) lowerPool.push([x.gonial, 6]);
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
  const jawlinePool: [number, number][] = [[x.bigonial, 3]];
  if (b.sideIncluded) jawlinePool.push([x.gonial, 8]);
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
    {
      label: "Jawline",
      score: to10(weightedMean(jawlinePool)),
      note: "Jaw width against the cheekbones — leanness changes how hard this reads.",
    },
    {
      label: "Eye Spacing",
      score: to10(x.esr),
      note: "Interpupillary distance against face width — the heaviest-weighted frontal metric in the community formula.",
    },
    {
      label: "Proportions",
      score: to10(x.thirds),
      note: "How evenly your face splits into its three thirds, hairline estimated. Structure — read honestly, trained around.",
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

export function formatAscendDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
