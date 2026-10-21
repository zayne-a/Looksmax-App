// The subscriber weekly-plan view for the dashboard: full task lists per section for the selected plan week (stepper defaults to the current journey week), expandable sections, frequency chips and why-you notes. Server-side locked placeholders from free-tier plans are filtered out and never render as tasks.
"use client";

import { useState } from "react";
import { Card } from "@/components/ui";
import type { AscendPlan } from "@/lib/types";

/**
 * The subscriber's FULL weekly plan, inside the dashboard (Zayne,
 * 2026-10-20): every section's complete task list for the selected
 * plan week — title, detail, frequency and the why-you note — not just
 * today's checklist slice. Weeks 1–4 are the plan's phase cycle; the
 * stepper defaults to the week the journey is actually on. Locked
 * placeholder tasks from free-tier plans never render here.
 */
export default function WeeklyPlan({
  plan,
  journeyWeek,
}: {
  plan: AscendPlan;
  journeyWeek: number;
}) {
  const maxWeek = Math.max(
    1,
    ...plan.sections.map((s) => Math.max(0, ...s.weeks.map((w) => w.week)))
  );
  const currentPlanWeek = ((Math.max(1, journeyWeek) - 1) % maxWeek) + 1;
  const [week, setWeek] = useState(currentPlanWeek);
  const [open, setOpen] = useState<string | null>(
    plan.sections[0]?.id ?? null
  );

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-gold">
            Your weekly plan
          </p>
          <p className="mt-1 text-xs text-muted">
            The full week, every section — you&apos;re on journey week{" "}
            {journeyWeek}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeek((w) => Math.max(1, w - 1))}
            disabled={week <= 1}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-bone transition disabled:opacity-30"
            aria-label="Previous week"
          >
            ‹
          </button>
          <span className="min-w-20 text-center font-display text-sm font-extrabold text-bone">
            Week {week} of {maxWeek}
          </span>
          <button
            onClick={() => setWeek((w) => Math.min(maxWeek, w + 1))}
            disabled={week >= maxWeek}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-bone transition disabled:opacity-30"
            aria-label="Next week"
          >
            ›
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {plan.sections.map((section) => {
          const wk =
            section.weeks.find((w) => w.week === week) ?? section.weeks[0];
          if (!wk) return null;
          const tasks = wk.tasks.filter(
            (t) => t.title !== "Pro protocol step"
          );
          const isOpen = open === section.id;
          return (
            <div
              key={section.id}
              className="overflow-hidden rounded-2xl border border-white/10"
            >
              <button
                onClick={() => setOpen(isOpen ? null : section.id)}
                className="flex w-full items-center justify-between gap-3 bg-white/[0.03] px-4 py-3 text-left"
              >
                <div className="min-w-0">
                  <p className="font-display text-base font-extrabold text-bone">
                    {section.title}
                  </p>
                  <p className="truncate text-xs text-muted">{wk.focus}</p>
                </div>
                <span className="shrink-0 text-xs font-bold text-gold-soft">
                  {tasks.length} steps {isOpen ? "▲" : "▼"}
                </span>
              </button>
              {isOpen && (
                <div className="divide-y divide-white/[0.06]">
                  {tasks.map((t, i) => (
                    <div key={i} className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-bold text-bone">
                          {t.title}
                        </p>
                        <span className="rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gold-soft">
                          {t.frequency}
                        </span>
                      </div>
                      <p className="mt-1 text-sm leading-relaxed text-muted">
                        {t.detail}
                      </p>
                      {t.whyYou && (
                        <p className="mt-1 text-xs leading-relaxed text-gold-soft/80">
                          Why you: {t.whyYou}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
