"use client";

import { useEffect, useRef, useState } from "react";
import {
  ASCEND_PROGRAM_DAYS,
  ascendByDate,
  formatAscendDate,
} from "@/lib/psl";

/**
 * The analysis theatre (Zayne, 2026-10-21 — the PSL mechanism):
 * after the scan, a staged analysis sequence with a climbing
 * percentage, landing on the commitment device — the countdown ring
 * and the ascend-by date. Both derive from the REAL programme: our
 * 12-week protocol = 84 days from today. Nothing here is decoration
 * pretending to be computation — the measurement already happened on
 * device; this is the reveal, paced like one.
 */

const MINT = "#5EEAD4";

const STEPS = [
  "Measuring facial symmetry",
  "Reading skin condition",
  "Calculating your PSL rating",
  "Projecting your potential",
  "Building your 12-week protocol",
];

export default function AscendTheatre({
  measured,
  psl,
  tier,
  onDone,
}: {
  measured: boolean;
  psl: number | null;
  tier: string | null;
  onDone: () => void;
}) {
  const [pct, setPct] = useState(0);
  const [showRing, setShowRing] = useState(false);
  const doneRef = useRef(false);

  useEffect(() => {
    const t0 = performance.now();
    const DURATION = 2600;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / DURATION);
      // Ease-out climb, like a real analysis finishing tasks.
      setPct(Math.round((1 - Math.pow(1 - p, 3)) * 100));
      if (p < 1) raf = requestAnimationFrame(tick);
      else setShowRing(true);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (!showRing || doneRef.current) return;
    const id = setTimeout(() => {
      doneRef.current = true;
      onDone();
    }, 2100);
    return () => clearTimeout(id);
  }, [showRing, onDone]);

  const activeStep = Math.min(
    STEPS.length - 1,
    Math.floor((pct / 100) * STEPS.length)
  );
  const today = new Date();
  const by = ascendByDate(today);
  const R = 84;
  const CIRC = 2 * Math.PI * R;

  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-black px-6"
      role="status"
      aria-label="Analysing your scan"
      onClick={() => {
        if (showRing && !doneRef.current) {
          doneRef.current = true;
          onDone();
        }
      }}
    >
      {!showRing ? (
        <div className="w-full max-w-xs">
          <p className="text-center font-display text-lg font-extrabold text-white">
            {measured ? "Analysing your face" : "Building your plan"}
          </p>
          <div className="mt-8 space-y-3.5">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-3">
                <span
                  className="flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-black"
                  style={{
                    borderColor:
                      i < activeStep
                        ? MINT
                        : i === activeStep
                          ? MINT
                          : "rgba(255,255,255,0.2)",
                    color:
                      i <= activeStep ? MINT : "rgba(255,255,255,0.35)",
                    background:
                      i < activeStep ? "rgba(94,234,212,0.12)" : "transparent",
                  }}
                >
                  {i < activeStep ? "✓" : i + 1}
                </span>
                <span
                  className="text-sm font-semibold"
                  style={{
                    color:
                      i <= activeStep ? "#fff" : "rgba(255,255,255,0.35)",
                  }}
                >
                  {s}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-10">
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full transition-[width] duration-100"
                style={{
                  width: `${pct}%`,
                  background: `linear-gradient(90deg, #2DD4BF, ${MINT})`,
                }}
              />
            </div>
            <p
              className="mt-4 text-center font-display text-4xl font-black"
              style={{ color: MINT }}
            >
              {pct}%
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center text-center">
          <div className="relative h-52 w-52">
            <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90">
              <circle
                cx="100"
                cy="100"
                r={R}
                fill="none"
                stroke="rgba(255,255,255,0.08)"
                strokeWidth="6"
              />
              <circle
                cx="100"
                cy="100"
                r={R}
                fill="none"
                stroke={MINT}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={CIRC}
                strokeDashoffset={CIRC * 0.06}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-display text-6xl font-black text-white">
                {ASCEND_PROGRAM_DAYS}
              </span>
              <span className="mt-1 text-[11px] font-bold uppercase tracking-[0.28em] text-white/60">
                Days until you
              </span>
              <span
                className="font-display text-xl font-black uppercase tracking-[0.2em]"
                style={{ color: MINT }}
              >
                Ascend
              </span>
            </div>
          </div>
          {measured && psl != null && (
            <p className="mt-7 text-sm font-semibold text-white/85">
              Your PSL rating is in —{" "}
              <span style={{ color: MINT }}>
                {psl.toFixed(1)} · {tier}
              </span>
            </p>
          )}
          <p className="mt-2 max-w-[260px] text-sm leading-relaxed text-white/55">
            Your 12-week protocol is ready. Ascend by{" "}
            <span className="font-bold text-white">
              {formatAscendDate(by)}
            </span>
            .
          </p>
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-white/35">
            Opening your results…
          </p>
        </div>
      )}
    </div>
  );
}
