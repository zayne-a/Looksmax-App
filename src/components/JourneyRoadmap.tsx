"use client";

import {
  JOURNEY_PHASES,
  journeyWeek,
  phaseState,
  type JourneyPhase,
} from "@/lib/journey";
import { Reveal } from "@/components/motion";

/**
 * The 12-week journey roadmap: Phase 1 in hand, Phases 2–3 visibly
 * ahead — locked not as a paywall trick but because they're generated
 * from the user's own response data (check-ins + progress scans) when
 * their week arrives.
 */
export default function JourneyRoadmap({
  startedAt,
  checkins,
}: {
  startedAt: string | null;
  checkins: number;
}) {
  const week = journeyWeek(startedAt);
  const journeyDone = week !== null && week > 12;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-gold">
            The journey
          </p>
          <h2 className="font-display mt-1.5 text-2xl font-extrabold text-bone sm:text-3xl">
            Your 12-week protocol
          </h2>
        </div>
        <span className="rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-xs font-bold text-gold-soft">
          {journeyDone
            ? "Journey complete — maintenance mode"
            : week
              ? `You are in week ${week} of 12`
              : "Week 1 of 12 starts with your plan"}
        </span>
      </div>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
        Phase 1 is yours in full, right now. Phases 2 and 3 are generated
        later — from your weekly check-ins and progress scans — so they
        fit the person you&apos;re becoming, not the person who started.
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {JOURNEY_PHASES.map((phase) => (
          <PhaseCard
            key={phase.n}
            phase={phase}
            week={week}
            checkins={checkins}
          />
        ))}
      </div>
    </div>
  );
}

function PhaseCard({
  phase,
  week,
  checkins,
}: {
  phase: JourneyPhase;
  week: number | null;
  checkins: number;
}) {
  const state = phaseState(phase, week, checkins);
  const weekInPhase =
    week !== null && state === "active"
      ? Math.min(4, week - phase.unlockWeek + 1)
      : null;

  return (
    <Reveal>
      <div
        className={`h-full rounded-3xl border p-5 ${
          state === "active"
            ? "border-gold/50 bg-gold/[0.07] shadow-[0_0_40px_-14px_rgba(227,185,78,0.55)]"
            : state === "complete"
              ? "border-white/12 bg-white/[0.03]"
              : "border-white/10 bg-white/[0.02]"
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-gold">
            Phase {phase.n} · {phase.weeksLabel}
          </p>
          {state === "active" ? (
            <span className="rounded-full bg-gold px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-ink">
              {weekInPhase ? `Week ${weekInPhase} of 4` : "Active"}
            </span>
          ) : state === "complete" ? (
            <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-muted">
              Complete
            </span>
          ) : (
            <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-muted">
              Locked
            </span>
          )}
        </div>

        <h3 className="font-display mt-2 text-xl font-extrabold text-bone">
          {phase.name}
        </h3>
        <p className="mt-1 text-sm font-medium leading-snug text-gold-soft">
          {phase.tagline}
        </p>

        <ul className="mt-4 space-y-2">
          {phase.inside.map((item) => (
            <li
              key={item}
              className={`flex gap-2 text-[13px] leading-relaxed ${
                state === "locked" ? "text-muted/80" : "text-muted"
              }`}
            >
              <span aria-hidden className="mt-0.5 shrink-0 text-gold">
                {state === "complete" ? "✓" : state === "active" ? "•" : "🔒"}
              </span>
              {item}
            </li>
          ))}
        </ul>

        {state === "locked" && (
          <p className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs leading-relaxed text-muted">
            Unlocks at week {phase.unlockWeek} with {phase.checkinsRequired}{" "}
            weekly check-ins ({Math.min(checkins, phase.checkinsRequired)}/
            {phase.checkinsRequired} done). Your Phase {phase.n} is written
            from your check-ins and progress scans when it opens — it
            doesn&apos;t exist yet, for anyone.
          </p>
        )}
      </div>
    </Reveal>
  );
}
