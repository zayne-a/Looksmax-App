/**
 * scoreView (web) — the ONE place measurement -> DISPLAY values are
 * computed for the web app. Mirrors the native app's
 * src/lib/scoreView.ts function-for-function, so the same scan shows
 * the IDENTICAL numeral + tier on the web, in the app, and on a
 * creator card (owner: "score same as template").
 *
 * The engine (src/lib/psl.ts) scores on its internal /10 ladder, but
 * the product speaks the community's PSL scale — till 8, never /10
 * ("10 is just myth; keep as template as it is"). The ladder tables
 * live in src/lib/creator-tiers.ts, the extracted reference tables;
 * this layer reads them, it never edits them.
 *
 * Engine v2 (2026-10-22): RAW presentation, exactly as the native
 * view. For v2 scans the display value IS the engine's PSL8 —
 * clamp(4.0 + (C − 50)/12.5, 0.5, 7.9), one decimal — and the tier
 * name is read off the template ladder at that displayed number.
 * POTENTIAL keeps the engine's headroom over PSL, expressed on the
 * 8-scale. (An earlier web build converted v2 through tier anchors
 * and inflated the numerals — e.g. the reference face showed 4.0
 * where the raw score is 3.0. That conversion is gone for v2.)
 *
 * Engine v1: scans recorded under the legacy engine keep converting
 * through the v1 tier-floor anchors below — the same values as the
 * native app's creatorTiers DISPLAY_ANCHORS — so their stored
 * numbers keep their recorded meaning.
 *
 * NOTE: the imports below carry .ts extensions on purpose — the
 * Node fixture suite (tests/psl-v2.test.mts) loads this module
 * directly, and tsconfig sets allowImportingTsExtensions so the
 * app build accepts them. Don't strip the extensions.
 */
import {
  barFraction,
  formatRating,
  regionLabel,
  scoreTierLabel,
  type Gender,
} from "./creator-tiers.ts";
import {
  isV2,
  miscScores,
  pslPotential,
  pslScore,
  regionScores,
  scoreBreakdownV2,
} from "./psl.ts";
import type { FaceMeasurements } from "./types.ts";

const round1 = (v: number) => Math.round(v * 10) / 10;

const clampNum = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

/** The v2 engine's PSL8 for a scan — under the owner's scale rule
 *  this IS the display value (presented till 8, never /10). Computed
 *  straight from the v2 composite, exactly as lib/psl.ts anchors it.
 *  Null when the payload isn't v2-scorable. */
function psl8Of(m: FaceMeasurements): number | null {
  const b = scoreBreakdownV2(m);
  if (!b) return null;
  return clampNum(4.0 + (b.composite - 50) / 12.5, 0.5, 7.9);
}

function piecewise(
  anchors: [number, number][],
  v: number
): number {
  const a = anchors;
  if (v <= a[0][0]) return a[0][1];
  for (let i = 1; i < a.length; i++) {
    if (v <= a[i][0]) {
      const [x0, y0] = a[i - 1];
      const [x1, y1] = a[i];
      return round1(y0 + ((v - x0) / (x1 - x0)) * (y1 - y0));
    }
  }
  return a[a.length - 1][1];
}

/** v1 engine PSL (/10) -> template display score (1–8) anchors,
 *  piecewise-linear through the v1 TIER floors so the tier name is
 *  identical on both scales at every boundary:
 *    /10 2.5 = LTN floor       -> 3.0 (template LTN floor)
 *    /10 3.5 = MTN floor       -> 4.0
 *    /10 4.5 = HTN floor       -> 5.0
 *    /10 5.5 = Chadlite floor  -> 5.5
 *    /10 6.5 = Chad floor      -> 6.0
 *    /10 8.5 = True Adam floor -> 7.5 (template True Adam/Eve floor)
 *  Engine floor 0.5 -> 1.0; engine cap 9.9 -> 8.0.
 *  v1 ONLY — v2 displays raw PSL8 (see psl8Of). */
const DISPLAY_ANCHORS: [number, number][] = [
  [0.5, 1.0],
  [2.5, 3.0],
  [3.5, 4.0],
  [4.5, 5.0],
  [5.5, 5.5],
  [6.5, 6.0],
  [8.5, 7.5],
  [9.9, 8.0],
];

/** v1 engine PSL (/10) -> template display score (1–8, one decimal). */
export function toDisplayScore(psl10: number): number {
  return piecewise(DISPLAY_ANCHORS, psl10);
}

/** Region / misc reads (/10, no tier ladder to align) -> 1–8 linear.
 *  Same formula as the native creatorTiers regionDisplayScore. */
export function regionDisplayScore(score10: number): number {
  return round1(Math.min(8, Math.max(1, 1 + (score10 / 10) * 7)));
}

export interface ScoreCardView {
  /** Card label, e.g. "PSL" / "Eyes". */
  label: string;
  /** Region key when the card is a region (React key + identity). */
  key?: string;
  /** Display score on the 1–8 template scale, one decimal. */
  display: number;
  /** His number format: integers bare, else one decimal. */
  formatted: string;
  /** Tier name for headline cards; verdict word for region/misc. */
  verdict: string;
  /** Bar/ring fill 0..1 (template barFraction). */
  fraction: number;
  note?: string;
}

export interface ScoreView {
  psl: ScoreCardView;
  potential: ScoreCardView;
  /** Eyes / Midface / Lower Third / Upper Third. */
  regions: ScoreCardView[];
  /** Skin / Harmony / Symmetry / Jawline / Eye Spacing / Proportions. */
  misc: ScoreCardView[];
}

/**
 * The full display view for one scan. Gender resolves like the
 * native view: the scan's own stamped gender wins, then the
 * caller's, then "male" (the naming v1 scans were recorded with).
 */
export function buildScoreView(
  m: FaceMeasurements,
  gender?: Gender
): ScoreView {
  const effGender: Gender = m.gender ?? gender ?? "male";
  const eff: FaceMeasurements = m.gender ? m : { ...m, gender: effGender };
  const v2 = isV2(eff);

  const psl10 = pslScore(eff);
  const potential10 = pslPotential(eff);

  // Headline display values. v2: PSL8 IS the display (owner's scale
  // rule — till 8, never /10); POTENTIAL keeps the engine's headroom
  // over PSL, expressed on the 8-scale. v1: the legacy template
  // conversion, untouched.
  const psl8 = v2 ? psl8Of(eff) : null;
  const pslDisplay = psl8 !== null ? round1(psl8) : toDisplayScore(psl10);
  const potentialDisplay =
    psl8 !== null
      ? round1(clampNum(psl8 + (potential10 - psl10) / 1.25, 0.5, 8))
      : toDisplayScore(potential10);

  const headline = (label: string, display: number): ScoreCardView => {
    return {
      label,
      display,
      formatted: formatRating(display),
      verdict: scoreTierLabel(display, effGender),
      fraction: barFraction(display),
    };
  };

  const read = (
    label: string,
    score10: number,
    note: string,
    key?: string
  ): ScoreCardView => {
    const display = regionDisplayScore(score10);
    return {
      label,
      key,
      display,
      formatted: formatRating(display),
      verdict: regionLabel(display),
      fraction: barFraction(display),
      note,
    };
  };

  return {
    psl: headline("PSL", pslDisplay),
    potential: headline("POTENTIAL", potentialDisplay),
    regions: regionScores(eff).map((r) => read(r.label, r.score, r.note, r.key)),
    misc: miscScores(eff).map((s) => read(s.label, s.score, s.note)),
  };
}
