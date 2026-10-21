// todaysSections filters out server-side locked tasks (locked: true — real titles, instructions stubbed out) so a free-tier saved plan can never surface a locked step as a daily protocol task.
import type { AscendPlan, PlanTask, QuizAnswers } from "./types";
import { tdee, type ActivityLevel } from "./calculators";

/**
 * The daily layer: streaks, the rotating 3-question ritual, today's
 * tasks from the subscriber's own plan, and their personal targets.
 * Everything here is deterministic — the AI coach (Stage 3) reads this
 * data, it never invents it.
 */

/** Local day key (YYYY-MM-DD) in the user's timezone. */
export function dayKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function shiftDay(key: string, delta: number): string {
  const d = new Date(`${key}T12:00:00`);
  d.setDate(d.getDate() + delta);
  return dayKey(d);
}

/** Habit key that marks a streak-freeze day inside a daily log. */
export const FREEZE_KEY = "__freeze";

/**
 * Streak freeze state: one protected rest day per rolling week.
 * A freeze can save a streak only when exactly yesterday is missing
 * and the day before it was active — it patches a single gap, it
 * doesn't resurrect a dead streak.
 */
export function freezeState(
  logs: { day: string; habits: Record<string, boolean> }[],
  activeDays: Set<string>,
  today: string = dayKey()
): { canFreeze: boolean; gapDay: string | null; usedThisWeek: boolean } {
  const usedThisWeek = logs.some(
    (l) => l.habits?.[FREEZE_KEY] && l.day >= shiftDay(today, -6)
  );
  const yesterday = shiftDay(today, -1);
  const dayBefore = shiftDay(today, -2);
  const canFreeze =
    !usedThisWeek && !activeDays.has(yesterday) && activeDays.has(dayBefore);
  return { canFreeze, gapDay: canFreeze ? yesterday : null, usedThisWeek };
}

/**
 * Current streak: consecutive active days ending today — or yesterday
 * (the streak is still alive until today ends). Active = a daily log,
 * a check-in, or a scan on that day.
 */
export function currentStreak(
  activeDays: Set<string>,
  today: string = dayKey()
): number {
  let cursor = activeDays.has(today) ? today : shiftDay(today, -1);
  if (!activeDays.has(cursor)) return 0;
  let streak = 0;
  while (activeDays.has(cursor)) {
    streak += 1;
    cursor = shiftDay(cursor, -1);
  }
  return streak;
}

// ---------- The daily 3 questions ----------

export interface DailyQuestion {
  id: string;
  pillar: string;
  question: string;
  chips: string[];
}

/** Question sets rotate daily; each set is one pillar's check on the
 *  subscriber's actual plan habits. Answers are short chips — 20
 *  seconds, not a form. */
export const DAILY_QUESTION_SETS: DailyQuestion[][] = [
  [
    { id: "am_routine", pillar: "Skin", question: "Did you run your full AM routine — cleanser, moisturiser, SPF?", chips: ["Full routine", "Partially", "Skipped"] },
    { id: "spf_reapply", pillar: "Skin", question: "If you were outdoors, did you reapply SPF?", chips: ["Yes", "Wasn't outdoors", "No"] },
    { id: "face_touch", pillar: "Skin", question: "Hands off your face today?", chips: ["Mostly clean", "Touched a few times", "Picked at it"] },
  ],
  [
    { id: "protein_hit", pillar: "Diet", question: "Did you hit your protein target today?", chips: ["Hit it", "Close", "Missed"] },
    { id: "calorie_track", pillar: "Diet", question: "How did calories land against your target?", chips: ["On target", "Over", "Under"] },
    { id: "water_track", pillar: "Diet", question: "Water — how close to your daily target?", chips: ["Hit it", "About half", "Way under"] },
  ],
  [
    { id: "sleep_hours", pillar: "Sleep", question: "How long did you sleep last night?", chips: ["8h+", "7–8h", "6–7h", "Under 6h"] },
    { id: "screens_off", pillar: "Sleep", question: "Screens off 30 minutes before bed?", chips: ["Yes", "No"] },
    { id: "wake_consistent", pillar: "Sleep", question: "Wake time within an hour of your usual?", chips: ["Yes", "No"] },
  ],
  [
    { id: "trained", pillar: "Training", question: "Training or step target today?", chips: ["Both", "One of them", "Neither"] },
    { id: "posture", pillar: "Training", question: "Posture check — shoulders back, chin level when you caught yourself?", chips: ["Mostly", "Sometimes", "Slouched a lot"] },
    { id: "energy", pillar: "Training", question: "Energy and confidence today?", chips: ["High", "Steady", "Low"] },
  ],
  [
    { id: "pm_routine", pillar: "Skin", question: "PM routine done — cleanser, treatment, moisturiser?", chips: ["Done", "Partially", "Skipped"] },
    { id: "new_breakout", pillar: "Skin", question: "Any new breakouts or irritation today?", chips: ["None", "New breakout", "Irritation"] },
    { id: "pillowcase", pillar: "Skin", question: "Pillowcase fresh this week?", chips: ["Fresh", "Due a change"] },
  ],
  [
    { id: "meals_clean", pillar: "Diet", question: "Meals mostly whole foods today?", chips: ["Mostly", "Mixed", "Mostly processed"] },
    { id: "sugar_drinks", pillar: "Diet", question: "Sugary drinks today?", chips: ["None", "One", "Several"] },
    { id: "late_eating", pillar: "Diet", question: "Eating cut off 2–3 hours before bed?", chips: ["Yes", "No"] },
  ],
  [
    { id: "grooming", pillar: "Style", question: "Grooming on point today — hair, nails, brows?", chips: ["Sharp", "Average", "Neglected"] },
    { id: "outfit_intent", pillar: "Style", question: "Did your outfit follow your plan's fit formulas?", chips: ["Yes", "Mostly", "Didn't think about it"] },
    { id: "mirror_check", pillar: "Mindset", question: "Honest mirror check: how do you rate today's presence?", chips: ["Strong", "Okay", "Off day"] },
  ],
];

/** The 3 questions for a given day — deterministic rotation. */
export function questionsForDay(key: string = dayKey()): DailyQuestion[] {
  const start = new Date(`${key}T12:00:00`).getTime();
  const dayOfYear = Math.floor(
    (start - new Date(new Date(key).getFullYear(), 0, 0).getTime()) / 86_400_000
  );
  return DAILY_QUESTION_SETS[dayOfYear % DAILY_QUESTION_SETS.length];
}

// ---------- Today's tasks from the plan ----------

export interface TodaySection {
  sectionId: string;
  sectionTitle: string;
  focus: string;
  tasks: PlanTask[];
}

/** The plan's 4-week cycle repeats across the 12-week journey until the
 *  next phase is generated, so journey week N reads plan week
 *  ((N-1) mod 4) + 1. */
export function todaysSections(
  plan: AscendPlan,
  journeyWeekNumber: number
): TodaySection[] {
  const planWeek = ((Math.max(1, journeyWeekNumber) - 1) % 4) + 1;
  return plan.sections
    .map((s): TodaySection | null => {
      const wk = s.weeks.find((w) => w.week === planWeek) ?? s.weeks[0];
      if (!wk) return null;
      return {
        sectionId: s.id as string,
        sectionTitle: s.title,
        focus: wk.focus,
        // Free-tier plans carry server-side locked tasks past the free
        // allowance (real titles, instructions stubbed out) — never
        // surface them as daily protocol tasks.
        tasks: wk.tasks.filter((t) => !t.locked),
      };
    })
    .filter((x): x is TodaySection => x !== null);
}

/** Stable key for a task inside a day's habit log. */
export function taskKey(sectionId: string, title: string): string {
  return `${sectionId}:${title}`;
}

// ---------- Personal targets ----------

export interface PersonalTargets {
  maintenanceKcal: number;
  targetKcal: number;
  proteinG: number;
  carbsG: number;
  waterMl: number;
  goalNote: string;
}

const ACTIVITY_BY_FREQ: Record<string, ActivityLevel> = {
  never: "sedentary",
  "1-2x": "light",
  "3-4x": "moderate",
  "5+x": "moderate",
};

/** Targets computed with the same engine that powers the calculators
 *  and the plan — the trackers never disagree with the protocol. */
export function personalTargets(
  quiz: QuizAnswers | null,
  waterMlFromPlan: number | null
): PersonalTargets | null {
  if (!quiz || !quiz.weightKg || !quiz.heightCm) return null;
  try {
    const activity = ACTIVITY_BY_FREQ[quiz.exerciseFreq] ?? "moderate";
    const res = tdee(
      quiz.gender === "female" ? "female" : "male",
      quiz.ageRange,
      quiz.heightCm,
      quiz.weightKg,
      activity
    );
    const delta =
      quiz.bodyGoal === "cut" ? -300 : quiz.bodyGoal === "build" ? 250 : 0;
    const targetKcal = res.tdee + delta;
    const proteinG = res.macros.protein;
    const fatG = res.macros.fat;
    const carbsG = Math.max(
      0,
      Math.round((targetKcal - proteinG * 4 - fatG * 9) / 4)
    );
    return {
      maintenanceKcal: res.tdee,
      targetKcal,
      proteinG,
      carbsG,
      waterMl: waterMlFromPlan ?? Math.round(quiz.weightKg * 35),
      goalNote:
        quiz.bodyGoal === "cut"
          ? `Cutting: ${Math.abs(delta)} under your ${res.tdee} maintenance. Protein stays high (${proteinG}g) to protect muscle — carbs are the dial that moves.`
          : quiz.bodyGoal === "build"
            ? `Building: ${delta} over your ${res.tdee} maintenance, protein at ${proteinG}g. A small surplus, not a free-for-all.`
            : `Maintaining at ~${res.tdee} kcal, protein ${proteinG}g. Consistency is the whole game at maintenance.`,
    };
  } catch {
    return null;
  }
}
