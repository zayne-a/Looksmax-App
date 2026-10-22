"use client";

import { ASCEND_PROGRAM_DAYS, daysUntilAscend } from "@/lib/psl";
import { buildScoreView } from "@/lib/score-view";
import type { FaceMeasurements } from "@/lib/types";

/**
 * The dashboard hero (Zayne, 2026-10-21 — modelled on the category
 * leader's home screen): the ascend countdown as one giant ring,
 * with the user's PSL and POTENTIAL as twin rings underneath that
 * never leave their sight. The gap between the two small rings is
 * the whole product.
 *
 * Days left derive from the REAL journey start (first saved scan or
 * plan) against the 90-day programme — the same mechanism as the
 * theatre, counting down as the user actually progresses.
 */

const MINT = "#5EEAD4";

function Ring({
  size,
  stroke,
  fraction,
  color,
  children,
}: {
  size: number;
  stroke: number;
  fraction: number;
  color: string;
  children: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="h-full w-full -rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - Math.min(1, Math.max(0, fraction)))}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {children}
      </div>
    </div>
  );
}

export default function AscendHero({
  measurements,
  journeyStartIso,
  streak,
}: {
  measurements: FaceMeasurements;
  journeyStartIso: string;
  streak: number;
}) {
  const start = new Date(journeyStartIso);
  const days = daysUntilAscend(start);
  // Twin rings show the DISPLAY values (lib/score-view): the template
  // 1–8 scale + template tier names, identical to the app.
  const view = buildScoreView(measurements);

  return (
    <section
      aria-label="Your ascension countdown"
      className="overflow-hidden rounded-3xl border border-white/10 bg-black px-5 py-6 text-white"
    >
      {streak > 0 && (
        <div className="flex justify-center">
          <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.14em] text-white/80">
            🔥 {streak} day streak
          </span>
        </div>
      )}

      <div className="mt-4 flex justify-center">
        <Ring size={208} stroke={7} fraction={days / ASCEND_PROGRAM_DAYS} color={MINT}>
          <span className="font-display text-6xl font-black leading-none">
            {days}
          </span>
          <span className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.28em] text-white/55">
            Days until you
          </span>
          <span
            className="font-display text-lg font-black uppercase tracking-[0.22em]"
            style={{ color: MINT }}
          >
            Ascend
          </span>
        </Ring>
      </div>

      <div className="mt-6 flex items-start justify-center gap-10">
        <div className="flex flex-col items-center">
          <Ring size={92} stroke={5} fraction={view.psl.fraction} color={MINT}>
            <span className="font-display text-2xl font-black">
              {view.psl.formatted}
            </span>
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/50">
              PSL
            </span>
          </Ring>
          <span className="mt-2 text-[11px] font-bold text-white/60">
            · {view.psl.verdict}
          </span>
        </div>
        <div className="flex flex-col items-center">
          <Ring size={92} stroke={5} fraction={view.potential.fraction} color="#FACC15">
            <span className="font-display text-2xl font-black">
              {view.potential.formatted}
            </span>
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/50">
              Potential
            </span>
          </Ring>
          <span className="mt-2 text-[11px] font-bold text-white/60">
            · {view.potential.verdict}
          </span>
        </div>
      </div>

      <p className="mx-auto mt-5 max-w-xs text-center text-xs leading-relaxed text-white/45">
        The yellow ring is where this protocol takes you. Show up daily and
        the black ring empties — that&apos;s the deal.
      </p>
    </section>
  );
}
