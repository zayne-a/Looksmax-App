import type { Checkin } from "./account";

/**
 * Weekly check-in model + the deterministic adjustments engine.
 *
 * The check-in is the retention loop's heartbeat: five quick answers,
 * and the plan visibly reacts. Adjustments are rule-based (never
 * AI-written) so they're instant, consistent, and safe — the same
 * philosophy as the Foundations layer.
 */

export interface CheckinAnswers {
  adherence: "most" | "some" | "barely";
  skinReaction: "calm" | "irritation" | "worse";
  sleepQuality: "great" | "okay" | "poor";
  weightTrend: "down" | "same" | "up";
}

export const CHECKIN_QUESTIONS: {
  key: keyof CheckinAnswers;
  label: string;
  options: { value: string; label: string }[];
}[] = [
  {
    key: "adherence",
    label: "How much of the routine did you actually follow?",
    options: [
      { value: "most", label: "Most days" },
      { value: "some", label: "Some days" },
      { value: "barely", label: "Barely" },
    ],
  },
  {
    key: "skinReaction",
    label: "How did your skin react this week?",
    options: [
      { value: "calm", label: "Calm / improving" },
      { value: "irritation", label: "Some irritation" },
      { value: "worse", label: "Breakouts worse" },
    ],
  },
  {
    key: "sleepQuality",
    label: "Sleep this week?",
    options: [
      { value: "great", label: "Great" },
      { value: "okay", label: "Okay" },
      { value: "poor", label: "Poor" },
    ],
  },
  {
    key: "weightTrend",
    label: "Weight trend (morning, same conditions)?",
    options: [
      { value: "down", label: "Down" },
      { value: "same", label: "Same" },
      { value: "up", label: "Up" },
    ],
  },
];

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** A check-in is due when none exists for the current journey week
 *  (approximated by: the latest is 7+ days old, or there is none). */
export function checkinDue(latest: Checkin | null, now = new Date()): boolean {
  if (!latest) return true;
  return now.getTime() - new Date(latest.created_at).getTime() >= WEEK_MS;
}

/** A progress scan is due on the same weekly cadence. */
export function scanDue(
  latestScanAt: string | null,
  now = new Date()
): boolean {
  if (!latestScanAt) return true;
  return now.getTime() - new Date(latestScanAt).getTime() >= WEEK_MS;
}

export interface Adjustment {
  priority: number;
  title: string;
  detail: string;
}

/**
 * The adaptive layer: turn this week's answers (+ scan movement) into at
 * most 3 concrete adjustments. Priority: skin safety first, then the
 * bottleneck (adherence/sleep), then body trend, then momentum.
 */
export function computeAdjustments(input: {
  answers: CheckinAnswers;
  scoreDelta: number | null;
  bodyGoal: string | null;
}): Adjustment[] {
  const { answers, scoreDelta, bodyGoal } = input;
  const out: Adjustment[] = [];

  if (answers.skinReaction === "worse") {
    out.push({
      priority: 0,
      title: "Barrier first this week",
      detail:
        "Breakouts worsened — pause strong actives for 3–4 nights. PM is cleanser + moisturiser only; keep SPF in the AM. Reintroduce one active at a time once skin settles for 2 straight days.",
    });
  } else if (answers.skinReaction === "irritation") {
    out.push({
      priority: 0,
      title: "Dial back one notch",
      detail:
        "Irritation is information, not failure: drop your strongest active to every other night and add a moisturiser buffer before it. If it persists a second week, the weekly review will swap it out.",
    });
  }

  if (answers.adherence === "barely") {
    out.push({
      priority: 1,
      title: "Simplify to the non-negotiables",
      detail:
        "A routine you skip beats nobody. This week it's only: cleanser, moisturiser, SPF in the morning; cleanser + moisturiser at night. Everything else is bonus. Consistency compounds — intensity can return next week.",
    });
  } else if (answers.adherence === "some") {
    out.push({
      priority: 1,
      title: "Anchor the routine to an existing habit",
      detail:
        "Partial weeks usually fail at the same step. Attach the routine to something you never skip — brushing your teeth — and put the products where you'll see them, not in a cabinet.",
    });
  }

  if (answers.sleepQuality === "poor") {
    out.push({
      priority: 2,
      title: "Sleep is this week's bottleneck",
      detail:
        "Poor sleep blunts everything else in the protocol. Fixed wake time for 7 days (weekends included), screens off 30 minutes before bed, no caffeine after 2 PM. Track it again next check-in.",
    });
  }

  if (bodyGoal === "cut" || bodyGoal === "build") {
    const target = bodyGoal === "cut" ? "down" : "up";
    if (answers.weightTrend !== target && answers.weightTrend !== "same") {
      out.push({
        priority: 3,
        title: "Adjust the calorie dial by ~150",
        detail:
          bodyGoal === "cut"
            ? "Weight moved the wrong way this week: trim ~150 kcal/day (usually the evening snack or the liquid calories) and keep protein exactly where it is. One variable at a time."
            : "Weight moved the wrong way this week: add ~150 kcal/day to a meal you already eat — a bigger breakfast portion or a post-training shake. Keep protein exactly where it is.",
      });
    } else if (answers.weightTrend === target) {
      out.push({
        priority: 3,
        title: "Body trend is on target",
        detail:
          "The scale moved the way your goal needs. No calorie changes — changing a working variable is how plateaus are born.",
      });
    }
  }

  if (scoreDelta !== null && scoreDelta >= 1) {
    out.push({
      priority: 4,
      title: `Progress confirmed: +${scoreDelta.toFixed(1)} on your score`,
      detail:
        "Your latest scan improved on the previous one. Hold the current course — the next phase builds on exactly this momentum.",
    });
  } else if (scoreDelta !== null && scoreDelta <= -1) {
    out.push({
      priority: 4,
      title: "Score dipped — read it correctly",
      detail:
        "One scan is noise (lighting, angle, a bad night's sleep all move it). Don't rebuild the routine off a single dip; the trend across your next two scans is the signal.",
    });
  }

  const sorted = out.sort((a, b) => a.priority - b.priority).slice(0, 3);
  if (sorted.length === 0) {
    sorted.push({
      priority: 9,
      title: "No changes needed",
      detail:
        "Adherence, skin, sleep and trend are all where they should be. Bank the week, keep the streak — this is what the protocol working looks like.",
    });
  }
  return sorted;
}
