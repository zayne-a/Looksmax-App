"use client";

import { useMemo, useState } from "react";
import { Button, Card } from "@/components/ui";
import { saveCheckin, type Checkin } from "@/lib/account";
import {
  CHECKIN_QUESTIONS,
  checkinDue,
  computeAdjustments,
  scanDue,
  type CheckinAnswers,
} from "@/lib/checkin";
import { journeyWeek } from "@/lib/journey";

/**
 * The weekly loop on the dashboard: a 60-second check-in, the plan's
 * adaptive adjustments in response, and the weekly progress-scan
 * prompt. Check-ins are also what unlock Phases 2 and 3 — the count
 * feeds the journey roadmap above.
 */
export default function WeeklyCheckin({
  checkins,
  journeyStart,
  scoreDelta,
  bodyGoal,
  latestScanAt,
  onSaved,
}: {
  checkins: Checkin[];
  journeyStart: string | null;
  scoreDelta: number | null;
  bodyGoal: string | null;
  latestScanAt: string | null;
  onSaved: (c: Checkin) => void;
}) {
  const latest = checkins[0] ?? null;
  const due = checkinDue(latest);
  const week = journeyWeek(journeyStart) ?? 1;

  const [answers, setAnswers] = useState<Partial<CheckinAnswers>>({});
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState<CheckinAnswers | null>(null);

  const answeredCount = CHECKIN_QUESTIONS.filter(
    (q) => answers[q.key]
  ).length;
  const complete = answeredCount === CHECKIN_QUESTIONS.length;

  const shownAnswers: CheckinAnswers | null = justSaved
    ? justSaved
    : latest
      ? {
          adherence: latest.adherence as CheckinAnswers["adherence"],
          skinReaction: latest.skin_reaction as CheckinAnswers["skinReaction"],
          sleepQuality: latest.sleep_quality as CheckinAnswers["sleepQuality"],
          weightTrend: latest.weight_trend as CheckinAnswers["weightTrend"],
        }
      : null;

  const adjustments = useMemo(
    () =>
      shownAnswers
        ? computeAdjustments({ answers: shownAnswers, scoreDelta, bodyGoal })
        : [],
    [shownAnswers, scoreDelta, bodyGoal]
  );

  const submit = async () => {
    if (!complete || saving) return;
    setSaving(true);
    const full = answers as CheckinAnswers;
    const id = await saveCheckin({
      week,
      adherence: full.adherence,
      skin_reaction: full.skinReaction,
      sleep_quality: full.sleepQuality,
      weight_trend: full.weightTrend,
    });
    setSaving(false);
    if (id) {
      onSaved({
        id,
        created_at: new Date().toISOString(),
        week,
        adherence: full.adherence,
        skin_reaction: full.skinReaction,
        sleep_quality: full.sleepQuality,
        weight_trend: full.weightTrend,
      });
      setJustSaved(full);
    }
  };

  const daysUntilNext = latest
    ? Math.max(
        0,
        7 -
          Math.floor(
            (Date.now() - new Date(latest.created_at).getTime()) / 86_400_000
          )
      )
    : 0;

  return (
    <Card glow>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-gold">
            Week {week} · The loop
          </p>
          <h2 className="font-display mt-1.5 text-2xl font-extrabold text-bone">
            Weekly check-in
          </h2>
        </div>
        <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-bold text-muted">
          {checkins.length} check-in{checkins.length === 1 ? "" : "s"} banked
        </span>
      </div>

      {due && !justSaved ? (
        <>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
            Sixty seconds, four answers — and your protocol adjusts itself
            to how your week actually went. Check-ins are also what unlock
            your next phase.
          </p>
          <div className="mt-5 space-y-5">
            {CHECKIN_QUESTIONS.map((q) => (
              <div key={q.key}>
                <p className="text-sm font-bold text-bone">{q.label}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {q.options.map((opt) => {
                    const selected = answers[q.key] === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() =>
                          setAnswers((a) => ({ ...a, [q.key]: opt.value }))
                        }
                        className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                          selected
                            ? "border-gold bg-gold/15 text-gold-soft"
                            : "border-white/12 bg-white/[0.03] text-muted hover:border-gold/40 hover:text-bone"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6">
            <Button
              onClick={submit}
              disabled={!complete || saving}
              className="px-7 py-3 text-sm disabled:opacity-40"
            >
              {saving
                ? "Saving…"
                : complete
                  ? "Save check-in — adjust my week"
                  : `Answer ${CHECKIN_QUESTIONS.length - answeredCount} more`}
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {justSaved
              ? "Saved. Here's how your protocol responds this week:"
              : `Last check-in banked. Next one in ~${daysUntilNext} day${daysUntilNext === 1 ? "" : "s"} — here's what your latest answers changed:`}
          </p>
          <ul className="mt-4 space-y-3">
            {adjustments.map((adj) => (
              <li
                key={adj.title}
                className="rounded-2xl border border-gold/20 bg-gold/[0.06] px-4 py-3"
              >
                <p className="text-sm font-bold text-bone">{adj.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted">
                  {adj.detail}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="mt-5 border-t border-white/8 pt-4">
        {scanDue(latestScanAt) ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm leading-relaxed text-muted">
              <span className="font-bold text-gold-soft">
                Weekly progress scan due.
              </span>{" "}
              Rescan in the same light as your baseline so the score
              movement is real — it feeds your next adjustments.
            </p>
            <Button href="/scan" className="shrink-0 px-5 py-2.5 text-sm">
              Progress scan
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted">
            ✓ Progress scan done this week — the next one unlocks with your
            next check-in.
          </p>
        )}
      </div>
    </Card>
  );
}
