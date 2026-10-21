/**
 * The PSL layer (Zayne, 2026-10-21) — the community's native language
 * laid over our measurements: a PSL score /10, a tier label, a
 * POTENTIAL score, and per-region scores for the results deck.
 *
 * Everything here is a deterministic mapping from the measurements we
 * already compute — no new claims about the face. The mapping is
 * deliberately strict (community calibration: an average face is a
 * 4–5, not a 7) so the score stays credible instead of flattering.
 * POTENTIAL is an estimate of where the same face lands if the
 * improvable reads (skin condition, under-eye, texture) reach strong
 * levels — habits move it, bone structure doesn't, and the copy says
 * so wherever the number is shown.
 */
import type { FaceMeasurements } from "./types";

export interface PslTier {
  label: string;
  /** Inclusive lower bound of the band, on the PSL /10 scale. */
  min: number;
}

export const PSL_TIERS: PslTier[] = [
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

/** Overall 0–100 → PSL /10. Strict curve: 50 → 3.7, 60 → 4.7,
 *  71 → 5.9, 80 → 6.8, 90 → 7.9. */
export function pslScore(m: FaceMeasurements): number {
  return round1(clamp((m.overallScore - 15) / 9.5, 0.5, 9.9));
}

export function pslTier(score: number): PslTier {
  let tier = PSL_TIERS[0];
  for (const t of PSL_TIERS) if (score >= t.min) tier = t;
  return tier;
}

/** How much headroom the improvable reads leave on the table (0–1.6
 *  PSL points). Skin reads are "lower is better" except under-eye is
 *  stored as a darkness score (higher = darker). */
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

/** Closeness of a measured value to an ideal band, 0–100. */
function closeness(value: number, idealLo: number, idealHi: number, spread: number): number {
  if (value >= idealLo && value <= idealHi) return 100;
  const d = value < idealLo ? idealLo - value : value - idealHi;
  return clamp(100 - (d / spread) * 100, 0, 100);
}

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

/** The ascend countdown: our programme is 12 weeks = 84 days. The
 *  finish date and days-left derive from the journey start, exactly
 *  like the mechanism this mirrors — never a random date. */
export const ASCEND_PROGRAM_DAYS = 84;

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
