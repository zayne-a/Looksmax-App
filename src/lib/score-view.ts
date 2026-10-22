/**
 * scoreView (web) — the ONE place measurement -> DISPLAY values are
 * computed for the web app. Mirrors the native app's
 * src/lib/scoreView.ts and the display-scale section of its
 * creatorTiers.ts, value for value, so the same scan shows the
 * IDENTICAL numeral + tier on the web, in the app, and on a creator
 * card.
 *
 * Why a display scale: the engine (src/lib/psl.ts) scores on its
 * internal /10 ladder, but the product speaks the community's PSL
 * scale — 1–8, the template's scale (owner: "till 8 not 10 — 10 is
 * just myth; keep as template as it is"). The ladder tables live in
 * src/lib/creator-tiers.ts, the extracted reference tables; this
 * layer reads them, it never edits them.
 *
 * The conversion is piecewise-linear through the TIER FLOORS, so
 * the tier NAME the engine assigns a score is the tier name the
 * template ladder gives the displayed number, at every boundary.
 * Only the numeral's dialect changes — never the tier, never the
 * engine, never a stored row.
 *
 * Engine-aware, like the native view: v2 scans convert through the
 * v2 tier floors (lib/psl.ts PSL_TIERS); v1 scans keep converting
 * through the v1 floors they were recorded under.
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
} from "./psl.ts";
import type { FaceMeasurements } from "./types.ts";

const round1 = (v: number) => Math.round(v * 10) / 10;

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
 *  Engine floor 0.5 -> 1.0; engine cap 9.9 -> 8.0. */
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

/** v2 engine PSL (/10) -> template display score (1–8) anchors,
 *  piecewise-linear through the v2 TIER floors so the tier name is
 *  identical on both scales at every boundary:
 *    /10 1.9  = LTN floor       -> 3.0 (template LTN floor)
 *    /10 3.75 = MTN floor       -> 4.0
 *    /10 5.6  = HTN floor       -> 5.0
 *    /10 6.9  = Chadlite floor  -> 5.5
 *    /10 7.5  = Chad floor      -> 6.0
 *    /10 9.7  = True Adam floor -> 7.5 (template True Adam/Eve floor)
 *  Engine floor 0.5 -> 1.0; engine cap 9.9 -> 8.0. */
const DISPLAY_ANCHORS_V2: [number, number][] = [
  [0.5, 1.0],
  [1.9, 3.0],
  [3.75, 4.0],
  [5.6, 5.0],
  [6.9, 5.5],
  [7.5, 6.0],
  [9.7, 7.5],
  [9.9, 8.0],
];

/** v2 engine PSL (/10) -> template display score (1–8, one decimal). */
export function toDisplayScoreV2(psl10: number): number {
  return piecewise(DISPLAY_ANCHORS_V2, psl10);
}

/** Region / misc reads (/10, no tier ladder to align) -> 1–8 linear. */
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
  const toDisplay = isV2(m) ? toDisplayScoreV2 : toDisplayScore;

  const headline = (label: string, engine10: number): ScoreCardView => {
    const display = toDisplay(engine10);
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
    psl: headline("PSL", pslScore(m)),
    potential: headline("POTENTIAL", pslPotential(m)),
    regions: regionScores(m).map((r) => read(r.label, r.score, r.note, r.key)),
    misc: miscScores(m).map((s) => read(s.label, s.score, s.note)),
  };
}
