"use client";

import { useEffect, useRef, useState } from "react";
import type { RoutineStep } from "@/lib/routine";

/**
 * The guided routine player: one step at a time, big and calm, with
 * real wait-time timers. Finishing the routine ticks today's skin
 * tasks in the daily log (via onComplete).
 */
export default function GuidedRoutine({
  kind,
  steps,
  onClose,
  onComplete,
}: {
  kind: "am" | "pm";
  steps: RoutineStep[];
  onClose: () => void;
  onComplete: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const step = steps[idx];

  useEffect(() => {
    setRemaining(null);
    if (timerRef.current) clearInterval(timerRef.current);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [idx]);

  const startTimer = (sec: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setRemaining(sec);
    timerRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r === null || r <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
  };

  const next = () => {
    if (idx + 1 >= steps.length) {
      setDone(true);
      onComplete();
    } else {
      setIdx(idx + 1);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/90 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-gold/25 bg-[#14100c] p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-gold">
            {kind === "am" ? "Morning routine" : "Evening routine"}
          </p>
          <button
            onClick={onClose}
            className="rounded-full border border-white/15 px-3 py-1 text-xs font-bold text-muted transition hover:text-bone"
          >
            Exit
          </button>
        </div>

        {!done ? (
          <>
            <div className="mt-4 flex gap-1.5">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 flex-1 rounded-full ${i <= idx ? "bg-gold" : "bg-white/12"}`}
                />
              ))}
            </div>
            <p className="mt-2 text-xs text-muted">
              Step {idx + 1} of {steps.length}
            </p>
            <h3 className="font-display mt-4 text-3xl font-extrabold leading-tight text-bone">
              {step.title}
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              {step.detail}
            </p>

            {step.timerSec && (
              <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-center">
                <p className="font-display text-4xl font-extrabold tabular-nums text-bone">
                  {remaining === null
                    ? `${Math.floor(step.timerSec / 60)}:${String(step.timerSec % 60).padStart(2, "0")}`
                    : `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`}
                </p>
                {remaining === null ? (
                  <button
                    onClick={() => startTimer(step.timerSec!)}
                    className="mt-2.5 rounded-full border border-gold/40 bg-gold/10 px-5 py-2 text-sm font-bold text-gold-soft transition hover:bg-gold/20"
                  >
                    Start timer
                  </button>
                ) : remaining > 0 ? (
                  <p className="mt-2 text-xs font-semibold text-gold-soft">
                    Running… use the time, don&apos;t rush it
                  </p>
                ) : (
                  <p className="mt-2 text-xs font-bold text-gold-soft">
                    Time — nicely done
                  </p>
                )}
              </div>
            )}

            <div className="mt-6 flex gap-2">
              {idx > 0 && (
                <button
                  onClick={() => setIdx(idx - 1)}
                  className="rounded-full border border-white/15 px-5 py-3 text-sm font-bold text-muted transition hover:text-bone"
                >
                  Back
                </button>
              )}
              <button
                onClick={next}
                className="flex-1 rounded-full bg-gold px-5 py-3 text-sm font-extrabold text-ink transition hover:brightness-110"
              >
                {idx + 1 >= steps.length ? "Finish routine ✓" : "Done — next step"}
              </button>
            </div>
          </>
        ) : (
          <div className="py-8 text-center">
            <p className="text-4xl" aria-hidden>
              ✦
            </p>
            <h3 className="font-display mt-3 text-2xl font-extrabold text-bone">
              Routine complete
            </h3>
            <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted">
              Ticked off in today&apos;s log. This — repeated daily — is
              the entire secret. There isn&apos;t another one.
            </p>
            <button
              onClick={onClose}
              className="mt-5 rounded-full bg-gold px-7 py-3 text-sm font-extrabold text-ink transition hover:brightness-110"
            >
              Back to today
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
