// Change my plan (Zayne, 2026-10-21): a built plan can be changed —
// the user retunes the three levers the engine actually consumes
// (body goal, training frequency, timeline) and the plan rebuilds from
// the same scan. At most TWO changes per plan; the count is enforced
// server-side in /api/plan, this card just shows what's left.
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui";
import { countPlansForScan } from "@/lib/account";
import type { QuizAnswers } from "@/lib/types";

const MAX_CHANGES = 1;

function Lever<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { v: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted">
        {label}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.v}
            onClick={() => onChange(o.v)}
            className={`rounded-full px-3.5 py-2 text-xs font-bold transition ${
              value === o.v
                ? "border border-gold/60 bg-gold/15 text-gold-soft"
                : "border border-white/15 bg-white/5 text-muted"
            }`}
            aria-pressed={value === o.v}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ChangePlan({
  quiz,
  savedScanId,
  onApply,
}: {
  quiz: QuizAnswers;
  savedScanId: string;
  onApply: (adjusted: QuizAnswers) => void;
}) {
  const [left, setLeft] = useState<number | null>(null);
  const [bodyGoal, setBodyGoal] = useState<QuizAnswers["bodyGoal"]>(
    quiz.bodyGoal
  );
  const [exerciseFreq, setExerciseFreq] = useState(quiz.exerciseFreq);
  const [timeline, setTimeline] = useState<QuizAnswers["timelineWeeks"]>(
    quiz.timelineWeeks
  );

  useEffect(() => {
    let alive = true;
    void countPlansForScan(savedScanId).then((n) => {
      if (alive) setLeft(Math.max(0, MAX_CHANGES - Math.max(0, n - 1)));
    });
    return () => {
      alive = false;
    };
  }, [savedScanId]);

  const changed =
    bodyGoal !== quiz.bodyGoal ||
    exerciseFreq !== quiz.exerciseFreq ||
    timeline !== quiz.timelineWeeks;

  return (
    <Card>
      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-gold">
        Change my plan
      </p>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Life changed since this protocol was built? Retune it — the plan
        rebuilds from this same scan with your new settings. Every plan
        includes{" "}
        <span className="font-bold text-bone">1 free change</span>; further
        changes are a paid add-on.
        {left != null &&
          (left > 0 ? (
            <>
              {" "}
              Your <span className="font-bold text-bone">free change</span>{" "}
              is still available on this plan.
            </>
          ) : (
            <> You&apos;ve used the free change on this plan.</>
          ))}
      </p>

      {left != null && left <= 0 ? (
        <p className="mt-4 text-sm leading-relaxed text-muted">
          Extra changes open as a paid add-on when payments launch. A{" "}
          <Link href="/scan" className="font-semibold text-gold-soft">
            fresh scan
          </Link>{" "}
          starts a new plan — with a free change of its own, and readings
          based on where your face is now.
        </p>
      ) : (
        <>
          <div className="mt-5 space-y-5">
            <Lever
              label="Body goal"
              value={bodyGoal}
              onChange={setBodyGoal}
              options={[
                { v: "cut", label: "Lean out (cut)" },
                { v: "maintain", label: "Maintain" },
                { v: "build", label: "Build (gain)" },
                { v: "unknown", label: "Not set" },
              ]}
            />
            <Lever
              label="Training frequency"
              value={exerciseFreq}
              onChange={setExerciseFreq}
              options={[
                { v: "never", label: "Not training yet" },
                { v: "1-2x", label: "1–2× / week" },
                { v: "3-4x", label: "3–4× / week" },
                { v: "5+x", label: "5+× / week" },
              ]}
            />
            <Lever
              label="Timeline"
              value={String(timeline)}
              onChange={(v) =>
                setTimeline(Number(v) as QuizAnswers["timelineWeeks"])
              }
              options={[
                { v: "4", label: "4 weeks" },
                { v: "8", label: "8 weeks" },
                { v: "12", label: "12 weeks" },
                { v: "0", label: "No deadline" },
              ]}
            />
          </div>
          <button
            disabled={!changed}
            onClick={() =>
              onApply({
                ...quiz,
                bodyGoal,
                exerciseFreq,
                timelineWeeks: timeline,
              })
            }
            className="mt-6 rounded-full border border-gold/50 bg-gold/15 px-6 py-3 text-sm font-bold text-gold-soft transition disabled:cursor-not-allowed disabled:opacity-40"
          >
            {changed ? "Apply change & rebuild my plan" : "Pick a new setting first"}
          </button>
          <p className="mt-3 text-xs leading-relaxed text-muted">
            Rebuilding keeps this scan and everything in your history — only
            the protocol is regenerated. Your previous version stays in your
            saved plans.
            {left === 1 && (
              <>
                {" "}
                <span className="font-semibold text-bone">
                  Applying spends the 1 free change on this plan.
                </span>
              </>
            )}
          </p>
        </>
      )}
    </Card>
  );
}
