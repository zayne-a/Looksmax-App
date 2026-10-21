// The complete protocol library for the dashboard's More tab (Zayne, 2026-10-21): EVERY step of the subscriber's protocol written out in full — all sections, all weeks, every task's description and why-you note — so the full scope of what Pro contains is visible in one place, below the 12-week journey roadmap.
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui";
import type { AscendPlan } from "@/lib/types";

/**
 * Every protocol step of the user's latest plan, numbered end to end
 * and grouped by section then week. Subscribers see each step's full
 * description + the personal why-you note. Free plans arrive with
 * locked steps stubbed server-side (real titles, no instructions) —
 * those render as locked rows, exactly like the plan page, so the
 * full scope is visible but the how-to never leaks. All sections
 * start expanded: the point of this library is abundance, with
 * collapse available per section.
 */
export default function ProtocolLibrary({
  plan,
  isPro,
}: {
  plan: AscendPlan | null;
  isPro: boolean;
}) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  // The plan arrives asynchronously (dashboard fetch) — when it first
  // lands, open every section: abundance is the point of this library.
  // Keyed on the headline so a swapped-in AI plan doesn't reset a
  // section the user deliberately collapsed.
  const openedForRef = useRef<string | null>(null);
  useEffect(() => {
    if (plan && openedForRef.current !== plan.headline) {
      openedForRef.current = plan.headline;
      setOpen(new Set(plan.sections.map((s) => s.id)));
    }
  }, [plan]);

  if (!plan) {
    return (
      <Card>
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-gold">
          Your complete protocol
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {isPro
            ? "Your full protocol — every step across Skin, Diet, Exercise and Style, written out in full — will live here once you've generated it."
            : "Every step of your protocol — all of them, with full descriptions — will live here once you've generated it."}
        </p>
        <Link
          href="/scan"
          className="mt-4 inline-block rounded-full border border-gold/50 bg-gold/15 px-5 py-2.5 text-sm font-bold text-gold-soft"
        >
          {isPro ? "Generate my protocol" : "Get my free scan"}
        </Link>
      </Card>
    );
  }

  const total = plan.sections.reduce(
    (n, s) => n + s.weeks.reduce((m, w) => m + w.tasks.length, 0),
    0
  );
  const lockedCount = plan.sections.reduce(
    (n, s) =>
      n + s.weeks.reduce((m, w) => m + w.tasks.filter((t) => t.locked).length, 0),
    0
  );

  let stepNo = 0;

  return (
    <Card>
      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-gold">
        Your complete protocol
      </p>
      <h2 className="font-display mt-2 text-2xl font-extrabold tracking-tight text-bone">
        All {total} protocols, in full
      </h2>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
        Every step of your 12-week protocol — Skin, Diet, Exercise and Style —
        written out in full with the reason it&apos;s in YOUR plan. This is the
        whole programme, not a preview.
        {plan.aiPending && (
          <span className="mt-1 block text-gold-soft">
            AI personalisation is still landing for this plan — descriptions
            deepen automatically when it completes.
          </span>
        )}
      </p>

      {/* EVERYTHING GENERATED — the full AI write-up, not just the steps */}
      <div className="mt-6 rounded-2xl border border-white/10 px-4 py-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gold">
          Your generated plan
        </p>
        <h3 className="font-display mt-2 text-xl font-extrabold tracking-tight text-bone">
          {plan.headline}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-bone/85">
          {plan.scoreSummary}
        </p>

        {plan.priorityFixes.length > 0 && (
          <div className="mt-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gold">
              Priority fixes
            </p>
            <div className="mt-3 space-y-3">
              {plan.priorityFixes.map((fix, i) => (
                <div key={fix.title} className="flex gap-3">
                  <span className="font-display flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-gold/40 bg-gold/10 text-[11px] font-extrabold text-gold-soft">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-bone">
                      {fix.title}
                      <span className="rounded-full bg-white/8 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                        Impact {fix.impact}
                      </span>
                      <span className="rounded-full bg-white/8 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                        Effort {fix.effort}
                      </span>
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-muted">
                      {fix.why}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-5 border-t border-white/[0.07] pt-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gold">
            Your {plan.projection.horizonWeeks}-week projection
          </p>
          <ul className="mt-3 space-y-2">
            {plan.projection.outcomes.map((o) => (
              <li
                key={o}
                className="flex gap-2 text-sm leading-relaxed text-bone/85"
              >
                <span className="mt-0.5 shrink-0 text-gold">✦</span>
                {o}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs leading-relaxed text-muted">
            {plan.projection.note}
          </p>
        </div>

        <div className="mt-5 border-t border-white/[0.07] pt-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gold">
            Foundations — your daily numbers
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
                Sleep
              </p>
              <p className="mt-1 text-sm font-bold text-bone">
                {plan.foundations.sleep.target}
              </p>
              <ul className="mt-2 space-y-1">
                {plan.foundations.sleep.rules.map((r) => (
                  <li key={r} className="text-xs leading-relaxed text-muted">
                    · {r}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
                Hydration
              </p>
              <p className="mt-1 text-sm font-bold text-bone">
                {plan.foundations.hydration.dailyMl.toLocaleString()} ml / day
              </p>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                {plan.foundations.hydration.detail}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
                Movement
              </p>
              <p className="mt-1 text-sm font-bold text-bone">
                {plan.foundations.movement.stepTarget}
              </p>
              <ul className="mt-2 space-y-1">
                {plan.foundations.movement.cues.map((c) => (
                  <li key={c} className="text-xs leading-relaxed text-muted">
                    · {c}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          {plan.foundations.nonNegotiables.length > 0 && (
            <p className="mt-3 text-xs leading-relaxed text-muted">
              <span className="font-semibold text-gold-soft">
                Non-negotiables:{" "}
              </span>
              {plan.foundations.nonNegotiables.join(" · ")}
            </p>
          )}
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {plan.sections.map((section) => {
          const sectionCount = section.weeks.reduce(
            (m, w) => m + w.tasks.length,
            0
          );
          const isOpen = open.has(section.id);
          return (
            <div
              key={section.id}
              className="overflow-hidden rounded-2xl border border-white/10"
            >
              <button
                onClick={() =>
                  setOpen((prev) => {
                    const next = new Set(prev);
                    if (next.has(section.id)) next.delete(section.id);
                    else next.add(section.id);
                    return next;
                  })
                }
                className="flex w-full items-center justify-between gap-3 bg-white/5 px-4 py-3.5 text-left"
                aria-expanded={isOpen}
              >
                <span>
                  <span className="font-display block text-base font-extrabold text-bone">
                    {section.title}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted">
                    {section.summary}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="rounded-full border border-gold/40 bg-gold/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-gold-soft">
                    {sectionCount} steps
                  </span>
                  <span className="text-muted">{isOpen ? "−" : "+"}</span>
                </span>
              </button>

              {isOpen && (
                <div className="space-y-6 px-4 py-4">
                  <p className="text-xs leading-relaxed text-muted">
                    {section.whyForYou}
                  </p>
                  {section.weeks.map((week) => (
                    <div key={week.week}>
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gold">
                        Week {week.week} — {week.focus}
                      </p>
                      <div className="mt-3 space-y-4">
                        {week.tasks.map((task) => {
                          stepNo += 1;
                          const n = stepNo;
                          return (
                            <div key={`${week.week}-${task.title}`} className="flex gap-3">
                              <span className="font-display flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/15 text-[11px] font-extrabold text-bone">
                                {n}
                              </span>
                              <div className="min-w-0">
                                <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-bone">
                                  {task.title}
                                  <span className="rounded-full bg-white/8 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                                    {task.frequency}
                                  </span>
                                  {task.locked && (
                                    <span className="rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gold-soft">
                                      Locked
                                    </span>
                                  )}
                                </p>
                                {task.locked ? (
                                  <p className="mt-1 text-xs leading-relaxed text-muted">
                                    Part of your protocol — unlock with Pro to
                                    see this step in full.
                                  </p>
                                ) : (
                                  <>
                                    <p className="mt-1 text-sm leading-relaxed text-bone/85">
                                      {task.detail}
                                    </p>
                                    {task.whyYou && (
                                      <p className="mt-1 text-xs leading-relaxed text-muted">
                                        <span className="font-semibold text-gold-soft">
                                          Why for you:{" "}
                                        </span>
                                        {task.whyYou}
                                      </p>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {plan.disclaimers.length > 0 && (
        <p className="mt-5 text-[11px] leading-relaxed text-muted/70">
          {plan.disclaimers.join(" ")}
        </p>
      )}

      {!isPro && lockedCount > 0 && (
        <div className="mt-6 rounded-2xl border border-gold/30 bg-gold/8 px-4 py-4">
          <p className="text-sm font-bold text-bone">
            {lockedCount} of your {total} steps are waiting in full
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            You can read every title above — Pro unlocks the complete
            instructions and the personal why-you note for every single step.
          </p>
          <Link
            href="/paywall"
            className="mt-3 inline-block rounded-full border border-gold/50 bg-gold/15 px-5 py-2.5 text-sm font-bold text-gold-soft"
          >
            Unlock every step with Pro
          </Link>
        </div>
      )}
    </Card>
  );
}
