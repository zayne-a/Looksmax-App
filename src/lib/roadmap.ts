import type { AscendPlan } from "./types";
import {
  FREEZE_KEY,
  dayKey,
  shiftDay,
  taskKey,
  todaysSections,
  type TodaySection,
} from "./daily";
import {
  JOURNEY_PHASES,
  phaseState,
  type JourneyPhase,
} from "./journey";

/**
 * "Your Protocol" — the subscriber roadmap derivations (Zayne,
 * 2026-10-21). Everything here is a pure function of records the app
 * already keeps — the plan, daily_logs, the active-day set (logs +
 * check-ins + scans), the check-in count and the saved-plan list.
 * No parallel progress store: the roadmap reads the same truth the
 * Today home, streak and calendar already read.
 *
 * Model:
 * - Weeks are calendar windows anchored on the journey-start day
 *   (the account's first saved scan/plan, the same anchor the
 *   dashboard uses). Week N covers start + (N-1)*7 … start + N*7 - 1.
 *   (The journey's phase gates use journeyWeek()'s exact-instant
 *   math; the two can disagree by a few hours on a boundary morning —
 *   the roadmap follows calendar days, which is what users see.)
 * - A day's plan is todaysSections(plan, week) — the exact task set
 *   the Today home asks for that week, so roadmap days can never
 *   disagree with Today. Server-side locked tasks never appear
 *   (todaysSections filters them), so nothing locked can leak here.
 * - A day is DONE when every one of its tasks is ticked in that
 *   day's log — or the day carries a streak freeze (a sanctioned
 *   rest day: it counts as done, 1/week, and keeps the streak).
 * - A week is COMPLETE at 7/7 done days. A done day always has a
 *   log, so a complete week has the streak kept through it by
 *   construction; streakKept is still reported per week for the
 *   outcome line (an incomplete week shows where the streak broke).
 * - The OPEN week is the earliest week that has started, is not
 *   complete, and whose phase gate has passed. Every later week is
 *   locked until it becomes the open week and is finished — you
 *   cannot skip ahead, and a lapsed week holds the road (its past
 *   days stay self-reportable in the roadmap, so it can always be
 *   finished; nothing bricks).
 * - Weeks 5–8 / 9–12 sit behind their phase gate: the phase must be
 *   unlocked by the journey rules (its week arrived + its check-ins
 *   done) AND a plan must exist that was generated in that phase's
 *   window (a saved plan created on/after the phase's first week) —
 *   until then they render as locked phase entries.
 */

export type RoadmapWeekState = "complete" | "open" | "locked" | "phase-locked";

export interface RoadmapDay {
  /** YYYY-MM-DD (user-local). */
  day: string;
  weekday: string;
  dateLabel: string;
  isToday: boolean;
  isYesterday: boolean;
  isFuture: boolean;
  /** The day carries a streak freeze — a sanctioned rest day. */
  frozen: boolean;
  doneCount: number;
  totalCount: number;
  /** All of the day's tasks ticked, or frozen. */
  complete: boolean;
  /** Any record at all that day (log / check-in / scan / freeze). */
  hasRecord: boolean;
}

export interface RoadmapWeek {
  week: number;
  phase: JourneyPhase;
  state: RoadmapWeekState;
  startDay: string;
  endDay: string;
  rangeLabel: string;
  /** The week's task sections — the same slice Today shows. */
  sections: TodaySection[];
  /** Section focuses for this week, in section order. */
  focuses: string[];
  /** Day rows — built for complete and open weeks only. */
  days: RoadmapDay[];
  daysDone: number;
  streakKept: boolean;
  lockReason: string | null;
}

export interface RoadmapInput {
  plan: AscendPlan;
  /** ISO timestamp of the journey start (first scan/plan), or null. */
  journeyStartIso: string | null;
  /** Daily logs (any superset window covering the journey). */
  logs: { day: string; habits: Record<string, boolean> }[];
  /** Days with any activity: log, check-in or scan. */
  activeDays: Set<string>;
  /** Total weekly check-ins done. */
  checkins: number;
  /** created_at of every saved plan (phase-plan detection). */
  planCreatedAts: string[];
  /** The user's chosen horizon: 4 | 8 | 12. */
  timelineWeeks: number;
  /** Today, as a day key. */
  today: string;
}

const DAY_MS = 86_400_000;

function fmtDay(key: string, opts: Intl.DateTimeFormatOptions): string {
  try {
    return new Date(`${key}T12:00:00`).toLocaleDateString(undefined, opts);
  } catch {
    return key;
  }
}

export function buildRoadmap(input: RoadmapInput): RoadmapWeek[] {
  const {
    plan,
    journeyStartIso,
    logs,
    activeDays,
    checkins,
    planCreatedAts,
    today,
  } = input;
  if (!journeyStartIso) return [];
  const startMs = new Date(journeyStartIso).getTime();
  if (Number.isNaN(startMs)) return [];

  const span = Math.min(12, Math.max(1, Math.round(input.timelineWeeks || 12)));
  const startDay = dayKey(new Date(startMs));
  const logByDay = new Map(logs.map((l) => [l.day, l]));
  // Calendar week we are in today (1-based, uncapped) — the anchor
  // for "has this week's window started".
  const dayIndexToday = Math.round(
    (new Date(`${today}T12:00:00`).getTime() -
      new Date(`${startDay}T12:00:00`).getTime()) /
      DAY_MS
  );
  const calWeek = Math.max(1, Math.floor(dayIndexToday / 7) + 1);
  const yesterday = shiftDay(today, -1);

  const phaseFor = (week: number): JourneyPhase =>
    JOURNEY_PHASES[Math.min(2, Math.floor((week - 1) / 4))];

  /** A phase's plan exists when a saved plan was generated inside
   *  that phase's window (created on/after its first week's start). */
  const phasePlanExists = (phase: JourneyPhase): boolean => {
    if (phase.n === 1) return true;
    const windowStart = startMs + (phase.unlockWeek - 1) * 7 * DAY_MS;
    return planCreatedAts.some((ts) => {
      const t = new Date(ts).getTime();
      return !Number.isNaN(t) && t >= windowStart;
    });
  };

  const phaseGatePassed = (week: number): boolean => {
    const phase = phaseFor(week);
    if (phase.n === 1) return true;
    return (
      phaseState(phase, calWeek, checkins) !== "locked" &&
      phasePlanExists(phase)
    );
  };

  const phaseLockReason = (week: number): string => {
    const phase = phaseFor(week);
    if (checkins < phase.checkinsRequired) {
      return `Unlocks at week ${phase.unlockWeek} with ${phase.checkinsRequired} weekly check-ins (${Math.min(checkins, phase.checkinsRequired)}/${phase.checkinsRequired} done) — Phase ${phase.n} is generated from your check-ins and progress scans.`;
    }
    if (!phasePlanExists(phase)) {
      return `Your Phase ${phase.n} plan hasn't been generated yet — it's written from your check-ins and progress scans when its week arrives.`;
    }
    return `Opens at week ${phase.unlockWeek}.`;
  };

  // First pass: per-week day completion (needs no state decisions).
  interface WeekCore {
    days: RoadmapDay[];
    daysDone: number;
    complete: boolean;
    streakKept: boolean;
    sections: TodaySection[];
  }
  const cores = new Map<number, WeekCore>();
  for (let week = 1; week <= span; week++) {
    const sections = todaysSections(plan, week);
    const total = sections.reduce((n, s) => n + s.tasks.length, 0);
    const days: RoadmapDay[] = [];
    for (let i = 0; i < 7; i++) {
      const day = shiftDay(startDay, (week - 1) * 7 + i);
      const log = logByDay.get(day);
      const habits = log?.habits ?? {};
      const frozen = Boolean(habits[FREEZE_KEY]);
      const doneCount = sections.reduce(
        (n, s) =>
          n + s.tasks.filter((t) => habits[taskKey(s.sectionId, t.title)]).length,
        0
      );
      days.push({
        day,
        weekday: fmtDay(day, { weekday: "short" }),
        dateLabel: fmtDay(day, { day: "numeric", month: "short" }),
        isToday: day === today,
        isYesterday: day === yesterday,
        isFuture: day > today,
        frozen,
        doneCount,
        totalCount: total,
        complete: frozen || (total > 0 && doneCount >= total),
        hasRecord: activeDays.has(day) || Boolean(log),
      });
    }
    cores.set(week, {
      days,
      daysDone: days.filter((d) => d.complete).length,
      complete: days.every((d) => d.complete),
      streakKept: days.every((d) => d.hasRecord || d.frozen),
      sections,
    });
  }

  // Second pass: states. The open week is the earliest started,
  // phase-unlocked, incomplete week; only one week is ever open.
  let openWeek: number | null = null;
  for (let week = 1; week <= span; week++) {
    const core = cores.get(week)!;
    const started = week <= calWeek;
    if (started && !core.complete && phaseGatePassed(week)) {
      openWeek = week;
      break;
    }
  }

  const weeks: RoadmapWeek[] = [];
  for (let week = 1; week <= span; week++) {
    const core = cores.get(week)!;
    const phase = phaseFor(week);
    const startDayW = shiftDay(startDay, (week - 1) * 7);
    const endDayW = shiftDay(startDay, week * 7 - 1);
    let state: RoadmapWeekState;
    let lockReason: string | null = null;
    if (!phaseGatePassed(week) && week > 4) {
      state = "phase-locked";
      lockReason = phaseLockReason(week);
    } else if (core.complete) {
      state = "complete";
    } else if (week === openWeek) {
      state = "open";
    } else {
      state = "locked";
      lockReason =
        openWeek !== null && week > openWeek
          ? `Finish week ${openWeek} — every day done, streak alive — to unlock this week.`
          : `Opens ${fmtDay(startDayW, { day: "numeric", month: "short" })} — finish the week before it first.`;
    }
    weeks.push({
      week,
      phase,
      state,
      startDay: startDayW,
      endDay: endDayW,
      rangeLabel: `${fmtDay(startDayW, { day: "numeric", month: "short" })} – ${fmtDay(endDayW, { day: "numeric", month: "short" })}`,
      sections: core.sections,
      focuses: core.sections.map((s) => s.focus).filter(Boolean),
      days: state === "complete" || state === "open" ? core.days : [],
      daysDone: core.daysDone,
      streakKept: core.streakKept,
      lockReason,
    });
  }
  return weeks;
}

/** The span the roadmap shows: the quiz's chosen timeline when a
 *  quiz is resolvable (0 = no deadline → the full 12), else the
 *  plan's own projection horizon. */
export function roadmapSpanWeeks(
  timelineWeeks: number | null | undefined,
  projectionHorizon: number | null | undefined
): number {
  if (timelineWeeks === 4 || timelineWeeks === 8 || timelineWeeks === 12) {
    return timelineWeeks;
  }
  if (timelineWeeks === 0) return 12;
  if (
    projectionHorizon === 4 ||
    projectionHorizon === 8 ||
    projectionHorizon === 12
  ) {
    return projectionHorizon;
  }
  return 12;
}
