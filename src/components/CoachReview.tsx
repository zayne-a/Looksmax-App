"use client";

import { Button, Card } from "@/components/ui";
import type { Checkin } from "@/lib/account";
import { answersOf, buildCoachReview } from "@/lib/checkin";
import { downloadWeeklyReport } from "@/lib/share-image";

/**
 * The weekly Coach Review card: what improved, what slipped, and the
 * one move that matters most — the recurring "someone is watching my
 * progress" value that a one-time plan can't give. Deterministic: it's
 * computed from the user's check-ins and scans, never AI flattery.
 */
export default function CoachReview({
  checkins,
  scoreDelta,
  latestScore,
  previousScore,
  bodyGoal,
  week = null,
  streak = 0,
  daysActive = 0,
}: {
  checkins: Checkin[];
  scoreDelta: number | null;
  latestScore: number | null;
  previousScore: number | null;
  bodyGoal: string | null;
  week?: number | null;
  streak?: number;
  daysActive?: number;
}) {
  const latest = checkins[0] ? answersOf(checkins[0]) : null;
  const previous = checkins[1] ? answersOf(checkins[1]) : null;
  const review = buildCoachReview({
    latest,
    previous,
    scoreDelta,
    latestScore,
    previousScore,
    bodyGoal,
  });
  const hasData = latest !== null || scoreDelta !== null;

  return (
    <Card>
      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-gold">
        Coach review
      </p>
      <h2 className="font-display mt-1.5 text-2xl font-extrabold text-bone">
        {hasData ? "Your week, reviewed" : "Your first review is coming"}
      </h2>
      {!hasData && (
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
          After your first check-in and progress scan, this is where your
          coach reads the week back to you: what improved, what slipped,
          and the one move that matters most next.
        </p>
      )}

      {hasData && (
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-gold-soft">
              What improved
            </p>
            <ul className="mt-2.5 space-y-2">
              {review.improved.map((line) => (
                <li
                  key={line}
                  className="flex gap-2 text-sm leading-relaxed text-bone"
                >
                  <span aria-hidden className="mt-0.5 shrink-0 text-gold">
                    ▲
                  </span>
                  {line}
                </li>
              ))}
              {review.improved.length === 0 && (
                <li className="text-sm text-muted">
                  Nothing banked yet this week — the next check-in changes that.
                </li>
              )}
            </ul>
          </div>
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-red-300">
              What slipped
            </p>
            <ul className="mt-2.5 space-y-2">
              {review.slipped.map((line) => (
                <li
                  key={line}
                  className="flex gap-2 text-sm leading-relaxed text-bone"
                >
                  <span aria-hidden className="mt-0.5 shrink-0 text-red-300">
                    ▼
                  </span>
                  {line}
                </li>
              ))}
              {review.slipped.length === 0 && (
                <li className="text-sm text-muted">
                  Nothing slipped. Clean weeks are how phases get earned.
                </li>
              )}
            </ul>
          </div>
        </div>
      )}

      <div className="mt-5 rounded-2xl border border-gold/25 bg-gold/[0.07] px-4 py-3.5">
        <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-gold">
          Your #1 move this week
        </p>
        <p className="mt-1.5 font-display text-lg font-extrabold text-bone">
          {review.topMove.title}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          {review.topMove.detail}
        </p>
      </div>

      {hasData && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted">
            {daysActive} active day{daysActive === 1 ? "" : "s"} this week
            {streak > 0 ? ` · 🔥 ${streak}-day streak` : ""}
            {week ? ` · Week ${week} of 12` : ""}
          </p>
          <Button
            onClick={() =>
              downloadWeeklyReport({
                week,
                improved: review.improved,
                slipped: review.slipped,
                topMoveTitle: review.topMove.title,
                topMoveDetail: review.topMove.detail,
                daysActive,
                streak,
              })
            }
            variant="ghost"
            className="px-5 py-2.5 text-sm"
          >
            Download weekly report card
          </Button>
        </div>
      )}
    </Card>
  );
}
