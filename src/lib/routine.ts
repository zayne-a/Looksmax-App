// Guided routine picks its focus task from open tasks only — server-side locked tasks (real titles, instructions stubbed out) are skipped.
import { isConsolidationStretch } from "./daily";
import type { AscendPlan, QuizAnswers } from "./types";

/**
 * Guided routines: the AM/PM skincare sequence as a playable,
 * step-by-step flow. Built deterministically from the subscriber's
 * plan + skin type — the steps are their routine, in order, with the
 * wait times that make actives work instead of clash.
 */

export interface RoutineStep {
  title: string;
  detail: string;
  timerSec?: number;
}

export function buildRoutine(
  plan: AscendPlan,
  quiz: QuizAnswers | null,
  kind: "am" | "pm",
  week: number
): RoutineStep[] {
  const skin = plan.sections.find((s) => s.id === "skin");
  // Same week read as todaysSections: the 4-week cycle during the
  // protocol, the plan's last (consolidation) week from journey
  // week 13 — the final stretch, days 85–90.
  const planWeek = isConsolidationStretch(week)
    ? Math.max(1, ...(skin?.weeks.map((w) => w.week) ?? [1]))
    : ((Math.max(1, week) - 1) % 4) + 1;
  const wk = skin?.weeks.find((w) => w.week === planWeek) ?? skin?.weeks[0];
  const focusTask =
    wk?.tasks.find((t) => !t.locked)?.title ?? "Your treatment step";
  const skinType = quiz?.skinType ?? "your skin type";

  if (kind === "am") {
    return [
      {
        title: "Gentle cleanse",
        detail: `Lukewarm water, fingertips only, 60 seconds. ${skinType === "oily" ? "A gel cleanser suits oily skin — no squeaky finish, that means stripped." : skinType === "dry" ? "A cream or milk cleanser — dry skin can't afford a foaming strip." : "A gentle low-pH cleanser — no scrubbing, ever."}`,
        timerSec: 60,
      },
      {
        title: "Pat dry — don't rub",
        detail:
          "Press the towel, leave the skin very slightly damp. Damp skin absorbs the next steps better and loses less water.",
      },
      {
        title: focusTask,
        detail:
          "Today's treatment focus from your protocol, applied to dry areas first. Pea-sized for the whole face is enough — more product is not more progress.",
      },
      {
        title: "Moisturise",
        detail:
          "Seal everything in while the skin is still slightly damp. Upward strokes, don't drag the skin down.",
      },
      {
        title: "SPF — two finger lengths",
        detail:
          "The single highest-leverage step in your whole plan. Two finger lengths for face and neck, every morning, rain or shine.",
      },
      {
        title: "Let it set",
        detail:
          "Two minutes before touching your face or heading out — SPF needs to form its film to protect at the labelled strength.",
        timerSec: 120,
      },
    ];
  }
  return [
    {
      title: "Cleanse the day off",
      detail:
        "SPF and the day come off first — 60 seconds, lukewarm. If you wore heavy SPF, cleanse twice, gently.",
      timerSec: 60,
    },
    {
      title: focusTask,
      detail:
        "Your protocol's treatment step goes on clean, dry skin at night — this is when actives do their deepest work.",
    },
    {
      title: "Wait for it to absorb",
      detail:
        "Give the treatment a minute before sealing it in — layering too fast dilutes it and can pill.",
      timerSec: 60,
    },
    {
      title: "Moisturise — richer than the morning",
      detail:
        "Night is repair time. A slightly richer layer than AM, and don't forget the neck.",
    },
    {
      title: "Hands off, pillowcase check",
      detail:
        "Done. Fresh pillowcase this week? It's in your non-negotiables for a reason — it touches your face for 8 hours.",
    },
  ];
}
