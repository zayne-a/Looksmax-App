"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card, Eyebrow } from "@/components/ui";
import { Reveal } from "@/components/motion";
import { useApp } from "@/lib/store";
import JourneyRoadmap from "@/components/JourneyRoadmap";
import WeeklyCheckin from "@/components/WeeklyCheckin";
import CoachReview from "@/components/CoachReview";
import TodayHome from "@/components/TodayHome";
import TrackCalendar from "@/components/TrackCalendar";
import { supabaseConfigured } from "@/lib/supabase";
import {
  deleteMySavedData,
  listCheckins,
  listDailyLogs,
  listPlans,
  listScans,
  saveDailyLog,
  type Checkin,
  type DailyLog,
  type SavedPlan,
  type SavedScan,
} from "@/lib/account";
import { currentStreak, dayKey } from "@/lib/daily";
import { computeAchievements } from "@/lib/achievements";
import Achievements from "@/components/Achievements";

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function DashboardPage() {
  const router = useRouter();
  const {
    user,
    profile,
    setPlan,
    setMeasurements,
    setQuiz,
    setSavedScanId,
    signOut,
  } = useApp();
  const [scans, setScans] = useState<SavedScan[] | null>(null);
  const [plans, setPlans] = useState<SavedPlan[] | null>(null);
  const [checkins, setCheckins] = useState<Checkin[] | null>(null);
  const [dailyLogs, setDailyLogs] = useState<DailyLog[]>([]);
  const [confirmingWipe, setConfirmingWipe] = useState(false);
  const [wiped, setWiped] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const [s, p, c, logs] = await Promise.all([
      listScans(50),
      listPlans(50),
      listCheckins(52),
      listDailyLogs(92),
    ]);
    setScans(s);
    setPlans(p);
    setCheckins(c);
    setDailyLogs(logs);
  }, [user]);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  // Reopen a saved plan: the plan page needs plan + quiz + measurements
  // in the store; the linked scan carries all three.
  const openPlan = (saved: SavedPlan) => {
    const scan = saved.scan_id
      ? (scans ?? []).find((s) => s.id === saved.scan_id)
      : undefined;
    if (scan) {
      setMeasurements(scan.measurements);
      if (scan.quiz) setQuiz(scan.quiz);
      setSavedScanId(scan.id);
    }
    setPlan(saved.plan);
    router.push("/plan");
  };

  const onWipe = async () => {
    const ok = await deleteMySavedData();
    if (ok) {
      setScans([]);
      setPlans([]);
      setCheckins([]);
      setDailyLogs([]);
      setWiped(true);
    }
    setConfirmingWipe(false);
  };

  /** Today-home writes: merge into today's daily log and reflect it. */
  const saveToday = async (
    patch: Partial<{
      answers: Record<string, string>;
      habits: Record<string, boolean>;
      water_ml: number;
      calories: number | null;
      weight_kg: number | null;
    }>
  ) => {
    const row = await saveDailyLog(dayKey(), patch);
    if (row) {
      setDailyLogs((prev) =>
        [row, ...prev.filter((l) => l.day !== row.day)].sort((a, b) =>
          a.day < b.day ? 1 : -1
        )
      );
    }
  };

  const onSignOut = async () => {
    await signOut();
    router.push("/");
  };

  if (!supabaseConfigured()) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center sm:px-6">
        <Eyebrow>Dashboard</Eyebrow>
        <h1 className="font-display mt-3 text-3xl font-extrabold tracking-tight">
          Accounts are launching in a moment
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Until then your scans and plans live only in this tab — your
          free scan works fully without an account.
        </p>
        <Button href="/quiz" className="mt-6 px-8 py-3">
          Start free scan
        </Button>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center sm:px-6">
        <Eyebrow>Dashboard</Eyebrow>
        <h1 className="font-display mt-3 text-3xl font-extrabold tracking-tight">
          Log in to see your journey
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Your saved scans, scores and plans are tied to your account.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button href="/login" className="px-8 py-3">
            Log in
          </Button>
          <Button href="/signup" variant="ghost" className="px-8 py-3">
            Create account
          </Button>
        </div>
      </div>
    );
  }

  const isPro = Boolean(profile?.is_premium || profile?.is_admin);
  const latest = scans?.[0];
  const previous = scans?.[1];
  const latestDelta =
    latest?.overall_score != null && previous?.overall_score != null
      ? latest.overall_score - previous.overall_score
      : null;
  const activeDaysSet = new Set([
    ...dailyLogs.map((l) => l.day),
    ...(checkins ?? []).map((c) => dayKey(new Date(c.created_at))),
    ...(scans ?? []).map((s) => dayKey(new Date(s.created_at))),
  ]);
  const firstScan = scans?.[scans.length - 1];
  const achievements = computeAchievements({
    scans: scans?.length ?? 0,
    plans: plans?.length ?? 0,
    checkins: checkins?.length ?? 0,
    loggedDays: dailyLogs.length,
    streak: currentStreak(activeDaysSet),
    scoreClimbed: Boolean(
      latest?.overall_score != null &&
        firstScan?.overall_score != null &&
        firstScan !== latest &&
        latest.overall_score > firstScan.overall_score
    ),
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
      <Reveal>
        <Eyebrow>Your account</Eyebrow>
        <h1 className="font-display mt-3 break-all text-3xl font-extrabold tracking-tight sm:text-4xl">
          {user.email}
        </h1>
        <div className="mt-3 flex flex-wrap gap-2">
          {profile?.is_admin && (
            <span className="rounded-full border border-gold/50 bg-gold/15 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.14em] text-gold-soft">
              Admin
            </span>
          )}
          {isPro ? (
            <span className="rounded-full border border-gold/50 bg-gold/15 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.14em] text-gold-soft">
              Ascend Pro — active
            </span>
          ) : (
            <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted">
              Free plan
            </span>
          )}
          {profile?.created_at && (
            <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold text-muted">
              Member since {fmtDate(profile.created_at)}
            </span>
          )}
        </div>
      </Reveal>

      {!isPro && (
        <Reveal delay={0.05} className="mt-8">
          <Card glow>
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h2 className="font-display text-xl font-extrabold text-bone">
                  Unlock the full protocol
                </h2>
                <p className="mt-1 max-w-md text-sm leading-relaxed text-muted">
                  Pro unblurs every step of your plan, switches on the
                  deep-curated AI plan, and keeps unlimited rescans.
                  Monthly and Yearly start with a 3-day free trial.
                </p>
              </div>
              <Button href="/paywall" className="shrink-0 px-7 py-3">
                See plans
              </Button>
            </div>
          </Card>
        </Reveal>
      )}

      {/* TODAY HOME — the subscriber's daily interface */}
      {plans?.[0] &&
        (isPro ? (
          <Reveal delay={0.055} className="mt-10">
            <TodayHome
              plan={plans[0].plan}
              quiz={
                (plans[0].scan_id
                  ? scans?.find((s) => s.id === plans[0].scan_id)?.quiz
                  : null) ??
                latest?.quiz ??
                null
              }
              journeyStart={
                [...(scans ?? []), ...(plans ?? [])]
                  .map((x) => x.created_at)
                  .sort()[0] ?? null
              }
              logs={dailyLogs}
              activeDays={activeDaysSet}
              onSaveToday={saveToday}
            />
          </Reveal>
        ) : (
          <Reveal delay={0.055} className="mt-10">
            <Card>
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-gold">
                The Today home · Pro
              </p>
              <h2 className="font-display mt-2 text-2xl font-extrabold text-bone">
                Your protocol, as a daily app — not a document
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
                Subscribers open Ascend to a 🔥 streak, today&apos;s
                protocol as a tappable checklist, the daily 3 questions,
                water and calorie trackers set from their own plan, and a
                calendar of every tracked day. That daily loop is where
                the 12 weeks actually happen.
              </p>
              <Button href="/paywall" className="mt-4 px-7 py-3">
                Start the journey
              </Button>
            </Card>
          </Reveal>
        ))}

      {/* WEEKLY LOOP — check-in, adaptive adjustments, progress scan */}
      <Reveal delay={0.06} className="mt-10">
        <WeeklyCheckin
          checkins={checkins ?? []}
          journeyStart={
            [...(scans ?? []), ...(plans ?? [])]
              .map((x) => x.created_at)
              .sort()[0] ?? null
          }
          scoreDelta={latestDelta}
          bodyGoal={(latest?.quiz?.bodyGoal as string | undefined) ?? null}
          latestScanAt={latest?.created_at ?? null}
          onSaved={(c) => setCheckins((prev) => [c, ...(prev ?? [])])}
        />
      </Reveal>

      {/* COACH REVIEW — the weekly read-back of the loop's data */}
      <Reveal delay={0.07} className="mt-6">
        <CoachReview
          checkins={checkins ?? []}
          scoreDelta={latestDelta}
          latestScore={latest?.overall_score ?? null}
          previousScore={previous?.overall_score ?? null}
          bodyGoal={(latest?.quiz?.bodyGoal as string | undefined) ?? null}
        />
      </Reveal>

      {/* RECORD CALENDAR — every tracked day (subscriber interface) */}
      {isPro && (
        <Reveal delay={0.075} className="mt-6">
          <TrackCalendar
            logs={dailyLogs}
            checkins={checkins ?? []}
            scans={scans ?? []}
          />
        </Reveal>
      )}

      {/* ACHIEVEMENTS — the badge shelf (subscriber interface) */}
      {isPro && (
        <Reveal delay={0.08} className="mt-6">
          <Achievements items={achievements} />
        </Reveal>
      )}

      {/* SCORE JOURNEY */}
      <Reveal delay={0.08} className="mt-10">
        <div className="flex items-end justify-between gap-3">
          <h2 className="font-display text-2xl font-extrabold text-bone">
            Your scans
          </h2>
          <Button href="/scan" variant="ghost" className="px-5 py-2.5 text-sm">
            New scan
          </Button>
        </div>
        {latest?.overall_score != null && (
          <p className="mt-2 text-sm text-muted">
            Latest score{" "}
            <span className="font-display text-xl font-extrabold text-gold-soft">
              {Math.round(latest.overall_score)}
            </span>
            {latestDelta != null && latestDelta !== 0 && (
              <span
                className={
                  latestDelta > 0 ? "font-bold text-gold-soft" : "font-bold text-red-300"
                }
              >
                {" "}
                ({latestDelta > 0 ? "+" : ""}
                {latestDelta.toFixed(1)} since your previous scan)
              </span>
            )}
          </p>
        )}
        <div className="mt-4 space-y-3">
          {scans === null ? (
            <p className="text-sm text-muted">Loading your scans…</p>
          ) : scans.length === 0 ? (
            <Card>
              <p className="text-sm leading-relaxed text-muted">
                No saved scans yet. Take a scan while logged in and it
                will appear here — come back any time, on any device, and
                your numbers are waiting.
              </p>
              <Button href="/quiz" className="mt-4 px-6 py-3 text-sm">
                Start the quiz
              </Button>
            </Card>
          ) : (
            scans.map((s) => (
              <Card key={s.id} className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-display text-lg font-extrabold text-bone">
                    {s.overall_score != null
                      ? `${Math.round(s.overall_score)} / 100`
                      : "Quiz-only plan"}
                  </p>
                  <p className="text-xs text-muted">{fmtDate(s.created_at)}</p>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-muted">
                  {s.measurements?.landmarksDetected
                    ? "Face scan"
                    : "Quiz only"}
                </span>
              </Card>
            ))
          )}
        </div>
      </Reveal>

      {/* SAVED PLANS */}
      <Reveal delay={0.1} className="mt-10">
        <h2 className="font-display text-2xl font-extrabold text-bone">
          Your plans
        </h2>
        <div className="mt-4 space-y-3">
          {plans === null ? (
            <p className="text-sm text-muted">Loading your plans…</p>
          ) : plans.length === 0 ? (
            <Card>
              <p className="text-sm leading-relaxed text-muted">
                No saved plans yet — your first generated plan will be
                stored here automatically.
              </p>
            </Card>
          ) : (
            plans.map((p) => {
              const linked = p.scan_id
                ? (scans ?? []).find((s) => s.id === p.scan_id)
                : undefined;
              return (
                <Card
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <p className="truncate font-display text-lg font-extrabold text-bone">
                      {p.plan.headline || "Your Ascend plan"}
                    </p>
                    <p className="text-xs text-muted">
                      {fmtDate(p.created_at)} ·{" "}
                      {p.tier === "premium" ? "Deep-curated (Pro)" : "Standard"}
                      {p.plan.aiPending && (
                        <span className="ml-2 inline-block rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gold-soft">
                          AI personalisation in progress
                        </span>
                      )}
                    </p>
                  </div>
                  {linked?.quiz ? (
                    <Button
                      onClick={() => openPlan(p)}
                      className="shrink-0 px-6 py-2.5 text-sm"
                    >
                      Open plan
                    </Button>
                  ) : (
                    <span className="text-xs text-muted">
                      Reopen via a new scan
                    </span>
                  )}
                </Card>
              );
            })
          )}
        </div>
      </Reveal>

      {/* JOURNEY — starts at the account's first saved scan/plan */}
      <Reveal delay={0.1} className="mt-12">
        <JourneyRoadmap
          startedAt={
            [...(scans ?? []), ...(plans ?? [])]
              .map((x) => x.created_at)
              .sort()[0] ?? null
          }
          checkins={checkins?.length ?? 0}
        />
      </Reveal>

      {/* ACCOUNT ACTIONS */}
      <Reveal delay={0.12} className="mt-12">
        <Card>
          <div className="flex flex-wrap gap-3">
            <Button onClick={onSignOut} variant="ghost" className="px-6 py-3 text-sm">
              Sign out
            </Button>
            {confirmingWipe ? (
              <>
                <Button onClick={onWipe} className="px-6 py-3 text-sm">
                  Yes — delete my scans &amp; plans
                </Button>
                <Button
                  onClick={() => setConfirmingWipe(false)}
                  variant="ghost"
                  className="px-6 py-3 text-sm"
                >
                  Keep them
                </Button>
              </>
            ) : (
              <Button
                onClick={() => setConfirmingWipe(true)}
                variant="ghost"
                className="px-6 py-3 text-sm"
              >
                Delete my saved data
              </Button>
            )}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted">
            {wiped
              ? "Done — your saved scans and plans are deleted. Your photos were never uploaded, so there is nothing else to erase."
              : "Your photos are measured on your device and never uploaded. Deleting removes your saved measurements, scores and plans from our database — the privacy promise, with a working button."}
          </p>
          <p className="mt-2 text-xs text-muted">
            Questions about your account?{" "}
            <Link href="/paywall" className="font-semibold text-gold-soft">
              See Pro plans
            </Link>
          </p>
        </Card>
      </Reveal>
    </div>
  );
}
