// AUDIT FIX: a phase reads "complete" only when its check-ins were actually done; a lapsed window with unmet check-ins stays "locked" — time passing alone earns nothing, per the file’s own rule.
/**
 * The journey model (retention core) for the 90-day ascend programme.
 *
 * Ascend is not a one-time protocol dump: Phase 1 (weeks 1–4) ships in
 * full with the first plan, and Phases 2 and 3 unlock later — gated on
 * BOTH time and weekly check-ins, because those phases are generated
 * from how the user actually responded (progress scans, irritation,
 * adherence, weight trend), not pre-written for everyone. The phased
 * protocol spans 12 weeks (84 days); Phase 3 then carries a final
 * consolidation stretch (days 85–90, inside journey week 13) that runs
 * the plan's own consolidation week to the ascend date — so the
 * programme is 90 days end to end (ASCEND_PROGRAM_DAYS in psl.ts).
 */

export interface JourneyPhase {
  n: 1 | 2 | 3;
  name: string;
  weeksLabel: string;
  /** First week of the phase (1-based). */
  unlockWeek: number;
  /** Last journey week inside the phase (1-based). Phase 3 runs to
   *  week 13 because the final consolidation stretch (days 85–90)
   *  belongs to it. */
  endWeek: number;
  /** Weekly check-ins required before the phase can unlock. */
  checkinsRequired: number;
  tagline: string;
  /** Preview of what's inside — categories, never the full content. */
  inside: string[];
}

export const JOURNEY_PHASES: JourneyPhase[] = [
  {
    n: 1,
    name: "Foundation",
    weeksLabel: "Weeks 1–4",
    unlockWeek: 1,
    endWeek: 4,
    checkinsRequired: 0,
    tagline: "Rebuild the base — barrier, basics, baselines.",
    inside: [
      "Your full 4-week protocol — the plan on this page",
      "Foundations locked in: sleep, hydration, steps, SPF",
      "Baseline scan + measurements on record",
    ],
  },
  {
    n: 2,
    name: "Intensify",
    weeksLabel: "Weeks 5–8",
    unlockWeek: 5,
    endWeek: 8,
    checkinsRequired: 4,
    tagline: "Built from your Phase 1 response — not pre-written.",
    inside: [
      "Brightening + active upgrades, unlocked once your barrier is proven",
      "Progressive overload block — loads and volume step up",
      "Calorie + protein re-target from your actual weight trend",
      "Progress-scan review: the plan re-aims at whatever is lagging",
    ],
  },
  {
    n: 3,
    name: "Consolidate",
    weeksLabel: "Weeks 9–12 + final stretch",
    unlockWeek: 9,
    endWeek: 13,
    checkinsRequired: 8,
    tagline: "Keep the gains — and finish the transformation arc.",
    inside: [
      "Maintenance dosing — the minimum routine that holds your results",
      "Event & photo prep: skin, hair and fit finishing protocol",
      "Final comparison scan + full score-journey review",
      "Days 85–90: the final consolidation stretch — this phase's maintenance week runs to your ascend date (day 90)",
      "Next-cycle goals set from your data: cut, bulk, or hold",
    ],
  },
];

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Current journey week (1-based, uncapped) from a start date, or null
 *  when the journey hasn't started. */
export function journeyWeek(
  startedAt: string | Date | null,
  now: Date = new Date()
): number | null {
  if (!startedAt) return null;
  const start = new Date(startedAt).getTime();
  if (Number.isNaN(start)) return null;
  return Math.max(1, Math.floor((now.getTime() - start) / WEEK_MS) + 1);
}

export type PhaseState = "complete" | "active" | "locked";

/** A phase unlocks when its week arrives AND its check-ins are done —
 *  both conditions are the product: time passing alone earns nothing. */
export function phaseState(
  phase: JourneyPhase,
  week: number | null,
  checkins: number
): PhaseState {
  if (week === null) return phase.n === 1 ? "active" : "locked";
  const phaseEnd = phase.endWeek;
  // "Complete" must be earned, not aged into (audit fix): a phase whose
  // check-ins were never done was never unlocked, so a lapsed window
  // reads "locked", not "complete" — time passing alone earns nothing.
  if (week > phaseEnd) {
    return checkins >= phase.checkinsRequired ? "complete" : "locked";
  }
  if (
    week >= phase.unlockWeek &&
    checkins >= phase.checkinsRequired
  ) {
    return "active";
  }
  return "locked";
}

const JOURNEY_START_KEY = "ascend_journey_start";

/** Device-local journey start (the plan page often runs pre-signup).
 *  Account holders also get a server-side start from their first saved
 *  scan/plan — the dashboard prefers that. Browser-only. */
export function getOrStartJourneyStart(): string {
  if (typeof window === "undefined") return new Date().toISOString();
  try {
    const existing = window.localStorage.getItem(JOURNEY_START_KEY);
    if (existing) return existing;
    const now = new Date().toISOString();
    window.localStorage.setItem(JOURNEY_START_KEY, now);
    return now;
  } catch {
    return new Date().toISOString();
  }
}

export function readJourneyStart(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(JOURNEY_START_KEY);
  } catch {
    return null;
  }
}
