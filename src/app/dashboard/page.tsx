// Tonight (2026-10-20): a Guides Library card joins the Today tab (browse-all + quick chips), and the FaceBreakdown renders in Progress from the latest scan (only when landmarks were actually measured — never for quiz-only scans). Nothing removed; presentation of existing data only, per Zayne.
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card, Eyebrow } from "@/components/ui";
import { Reveal } from "@/components/motion";
import { useApp } from "@/lib/store";
import JourneyRoadmap from "@/components/JourneyRoadmap";
import ProtocolLibrary from "@/components/ProtocolLibrary";
import ScanHistory from "@/components/ScanHistory";
import ProtocolRoadmap from "@/components/ProtocolRoadmap";
import { roadmapSpanWeeks } from "@/lib/roadmap";
import WeeklyCheckin from "@/components/WeeklyCheckin";
import CoachReview from "@/components/CoachReview";
import TodayHome from "@/components/TodayHome";
import WeeklyPlan from "@/components/WeeklyPlan";
import FaceBreakdown from "@/components/FaceBreakdown";
import { GUIDES } from "@/lib/guides";
import AppNav, { type AppTab } from "@/components/AppNav";
import TrackCalendar from "@/components/TrackCalendar";
import MeasurementDay from "@/components/MeasurementDay";
import ProgressPhotos from "@/components/ProgressPhotos";
import MyShelf from "@/components/MyShelf";
import { supabaseConfigured } from "@/lib/supabase";
import {
  deleteMySavedData,
  fetchActivePlanId,
  listCheckins,
  listDailyLogs,
  listPlans,
  listScans,
  saveDailyLog,
  setActivePlanId,
  type Checkin,
  type DailyLog,
  type SavedPlan,
  type SavedScan,
} from "@/lib/account";
import {
  currentStreak,
  dayKey,
  freezeState,
  FREEZE_KEY,
  shiftDay,
} from "@/lib/daily";
import { journeyWeek } from "@/lib/journey";
import { downloadMilestoneCard } from "@/lib/share-image";
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
  // Plan version history: the reverted-to plan version id, or null
  // when the active plan simply follows the latest (default).
  const [activePlanIdPref, setActivePlanIdPref] = useState<string | null>(null);
  const [checkins, setCheckins] = useState<Checkin[] | null>(null);
  const [dailyLogs, setDailyLogs] = useState<DailyLog[]>([]);
  const [confirmingWipe, setConfirmingWipe] = useState(false);
  // Clock reads in an effect only (Next prerender rule). These hooks sit
  // ABOVE the early returns below — hooks after a conditional return
  // change the hook count between renders and crash a cold load of
  // /dashboard with an existing session (audit fix, 2026-10-20).
  const [todayKey, setTodayKey] = useState<string | null>(null);
  useEffect(() => {
    setTodayKey(dayKey());
  }, []);
  const [tab, setTab] = useState<AppTab>("today");

  // Deep links from the app nav on other pages: /dashboard?tab=progress
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t === "progress" || t === "records" || t === "more" || t === "today") {
      setTab(t);
    }
  }, []);
  const [wiped, setWiped] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const [s, p, c, logs, pref] = await Promise.all([
      listScans(50),
      listPlans(50),
      listCheckins(52),
      listDailyLogs(92),
      fetchActivePlanId(),
    ]);
    setScans(s);
    setPlans(p);
    setCheckins(c);
    setDailyLogs(logs);
    setActivePlanIdPref(pref);
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
      setActivePlanIdPref(null);
      setWiped(true);
    }
    setConfirmingWipe(false);
  };

  // Revert to a saved plan version: re-selects that version as the
  // active plan everywhere. No row is created, changed or deleted,
  // and nothing is regenerated — zero AI cost.
  const onRevert = async (saved: SavedPlan) => {
    const ok = await setActivePlanId(saved.id);
    if (ok) setActivePlanIdPref(saved.id);
  };

  /** Daily-log writes (today from the Today home, yesterday for a
   *  streak freeze): merge the patch into that day's row and reflect. */
  const saveDay = async (
    day: string,
    patch: Partial<{
      answers: Record<string, string>;
      habits: Record<string, boolean>;
      water_ml: number;
      calories: number | null;
      weight_kg: number | null;
    }>
  ) => {
    const row = await saveDailyLog(day, patch);
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
  // The active plan: the version the user reverted to, when that
  // version is among the loaded plans — otherwise the latest plan,
  // exactly as before. Users who never revert never set a preference,
  // so this is plans[0] for them, unchanged.
  const activePlan =
    (activePlanIdPref
      ? plans?.find((p) => p.id === activePlanIdPref)
      : undefined) ?? plans?.[0];
  // Version groups for Records: plans sharing a scan are versions of
  // one plan (the original + its changes). Groups keep first-appearance
  // order — newest activity first, exactly as the flat list sorted —
  // while versions inside a group run oldest → newest so the history
  // reads in order. Plans without a linked scan are their own group.
  const planGroups: { key: string; versions: SavedPlan[] }[] = [];
  for (const p of plans ?? []) {
    const key = p.scan_id ?? `unlinked-${p.id}`;
    const g = planGroups.find((x) => x.key === key);
    if (g) g.versions.push(p);
    else planGroups.push({ key, versions: [p] });
  }
  for (const g of planGroups) {
    g.versions = [...g.versions].sort((a, b) =>
      a.created_at < b.created_at ? -1 : 1
    );
  }
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
  const journeyStartIso =
    [...(scans ?? []), ...(plans ?? [])]
      .map((x) => x.created_at)
      .sort()[0] ?? null;
  const weekNum = journeyWeek(journeyStartIso);
  // The roadmap spans the weeks the user chose in their quiz
  // (resolved through the same quiz the Today home reads).
  const roadmapQuiz =
    (activePlan?.scan_id
      ? scans?.find((s) => s.id === activePlan.scan_id)?.quiz
      : null) ??
    latest?.quiz ??
    null;
  const timelineSpan = roadmapSpanWeeks(
    roadmapQuiz?.timelineWeeks,
    activePlan?.plan.projection.horizonWeeks
  );
  const streakNum = currentStreak(activeDaysSet);
  const freeze = todayKey
    ? freezeState(dailyLogs, activeDaysSet, todayKey)
    : { canFreeze: false, gapDay: null, usedThisWeek: false };
  const daysActive7 = todayKey
    ? dailyLogs.filter((l) => l.day >= shiftDay(todayKey, -6)).length
    : 0;
  const milestoneHeadline =
    latestDelta !== null && latestDelta > 0
      ? `Score up ${latestDelta.toFixed(1)} — the protocol is working`
      : streakNum >= 7
        ? `${streakNum} days on fire`
        : null;
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
    <div className="mx-auto max-w-4xl px-4 pb-28 pt-2 sm:px-6 sm:pb-12">
      {/* APP BAR — the shell's status + view switcher */}
      <div className="sticky top-0 z-30 -mx-4 border-b border-white/10 bg-[#0d0b08]/95 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <p className="font-display text-lg font-extrabold tracking-tight text-bone">
            Ascend{" "}
            <span className="text-gold">
              · {tab === "today" ? "Today" : tab === "progress" ? "Progress" : tab === "records" ? "Records" : "More"}
            </span>
          </p>
          <div className="flex items-center gap-2">
            {streakNum > 0 && (
              <span className="rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs font-extrabold text-gold-soft">
                🔥 {streakNum}
              </span>
            )}
            <span className={`rounded-full border px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.14em] ${isPro ? "border-gold/50 bg-gold/15 text-gold-soft" : "border-white/15 bg-white/5 text-muted"}`}>
              {isPro ? "Pro" : "Free"}
            </span>
          </div>
        </div>
        <div className="mt-3 flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {(["today", "progress", "records", "more"] as AppTab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`min-h-[44px] shrink-0 rounded-full px-4 py-2 text-sm font-bold capitalize transition ${tab === t ? "bg-gold text-ink" : "border border-white/12 text-muted hover:text-bone"}`}
            >
              {t}
            </button>
          ))}
          <Link
            href="/coach"
            className="flex min-h-[44px] shrink-0 items-center rounded-full border border-gold/40 bg-gold/10 px-4 py-2 text-sm font-bold text-gold-soft transition hover:bg-gold/20"
          >
            ✦ Coach
          </Link>
        </div>
      </div>

      {tab === "today" && (
        <>
      {!isPro && (
        <Reveal delay={0.05} className="mt-8">
          <Card glow>
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h2 className="font-display text-xl font-extrabold text-bone">
                  Unlock the full protocol
                </h2>
                <p className="mt-1 max-w-md text-sm leading-relaxed text-muted">
                  Pro unlocks every step of your plan in full, switches on
                  the deep-curated AI plan, and keeps unlimited rescans.
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
      {activePlan &&
        (isPro ? (
          <Reveal delay={0.055} className="mt-10">
            <TodayHome
              score={latest?.overall_score ?? null}
              scoreDelta={latestDelta}
              plan={activePlan.plan}
              quiz={
                (activePlan.scan_id
                  ? scans?.find((s) => s.id === activePlan.scan_id)?.quiz
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
              onSaveDay={saveDay}
              freeze={freeze}
              onFreeze={() => {
                if (freeze.gapDay) {
                  void saveDay(freeze.gapDay, {
                    habits: { [FREEZE_KEY]: true },
                  });
                }
              }}
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

      {/* WEEKLY PLAN — the subscriber's full week, here in the dashboard
          alongside everything else (Zayne, 2026-10-20) */}
      {isPro && activePlan && (
        <Reveal delay={0.06} className="mt-6">
          <WeeklyPlan plan={activePlan.plan} journeyWeek={weekNum ?? 1} />
        </Reveal>
      )}

      {/* YOUR PROTOCOL — the roadmap: the whole journey in one place,
          one week open at a time (Zayne, 2026-10-21). Subscribers see
          the live roadmap; free users get the locked teaser, never
          roadmap data. */}
      {isPro && activePlan ? (
        <Reveal delay={0.065} className="mt-6">
          <ProtocolRoadmap
            plan={activePlan.plan}
            journeyStart={journeyStartIso}
            logs={dailyLogs}
            activeDays={activeDaysSet}
            checkins={checkins?.length ?? 0}
            planCreatedAts={(plans ?? []).map((p) => p.created_at)}
            timelineWeeks={timelineSpan}
            todayKey={todayKey}
            onSaveDay={saveDay}
          />
        </Reveal>
      ) : isPro ? (
        <Reveal delay={0.065} className="mt-6">
          <Card>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-gold">
              Your Protocol · the roadmap
            </p>
            <h2 className="font-display mt-2 text-2xl font-extrabold text-bone">
              Your roadmap starts with your plan
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
              Generate your personalised protocol and this page lays it
              out week by week, day by day — one week open at a time,
              the next unlocking when every day is finished and the
              streak survives.
            </p>
            <Button href="/quiz" className="mt-4 px-7 py-3">
              Start free scan
            </Button>
          </Card>
        </Reveal>
      ) : (
        <Reveal delay={0.065} className="mt-6">
          <Card>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-gold">
              Your Protocol · Pro
            </p>
            <h2 className="font-display mt-2 text-2xl font-extrabold text-bone">
              Your whole journey, one week at a time
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
              Subscribers get a roadmap across the weeks they chose:
              the open week laid out day by day — every day&apos;s plan
              in one place — with the next week locked until every day
              is finished and the streak survives. No skipping ahead;
              the road opens as you walk it.
            </p>
            <Button href="/paywall" className="mt-4 px-7 py-3">
              Unlock the roadmap
            </Button>
          </Card>
        </Reveal>
      )}

      {/* GUIDES LIBRARY — the clear general layer, one tap from home */}
      <Reveal delay={0.065} className="mt-6">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-gold">
                The Guides Library
              </p>
              <p className="mt-1 max-w-md text-sm leading-relaxed text-muted">
                Every topic, explained clearly in one place — no fluff
                research to dig through.
              </p>
            </div>
            <Button href="/guides" variant="ghost" className="px-5 py-2.5 text-sm">
              Browse all guides
            </Button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {GUIDES.slice(0, 6).map((g) => (
              <Link
                key={g.slug}
                href={`/guides/${g.slug}`}
                className="rounded-full border border-white/12 px-3.5 py-1.5 text-xs font-bold text-muted transition hover:border-gold/40 hover:text-gold-soft"
              >
                {g.title}
              </Link>
            ))}
          </div>
        </Card>
      </Reveal>

        </>
      )}

      {tab === "progress" && (
        <>
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
          week={weekNum}
          streak={streakNum}
          daysActive={daysActive7}
        />
      </Reveal>

      {/* FACE BREAKDOWN — trait by trait, from the latest scan */}
      {latest?.measurements?.landmarksDetected && (
        <Reveal delay={0.075} className="mt-6">
          <FaceBreakdown measurements={latest.measurements} />
        </Reveal>
      )}

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

      {/* MEASUREMENT DAY + PROGRESS PHOTOS + SHELF (subscriber) */}
      {isPro && (
        <>
          <Reveal delay={0.08} className="mt-6">
            <MeasurementDay scans={scans ?? []} todayKey={todayKey} />
          </Reveal>
          <Reveal delay={0.08} className="mt-6">
            <ProgressPhotos scans={scans ?? []} />
          </Reveal>

        </>
      )}

      {/* SCAN HISTORY — every scan + rescan with photo and full read */}
      {(scans?.length ?? 0) > 0 && (
        <Reveal delay={0.08} className="mt-6">
          <ScanHistory scans={scans ?? []} />
        </Reveal>
      )}

      {/* MILESTONE — celebration + shareable card (subscriber) */}
      {isPro && milestoneHeadline && (
        <Reveal delay={0.08} className="mt-6">
          <Card glow>
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-gold">
                  Milestone
                </p>
                <h3 className="font-display mt-1.5 text-2xl font-extrabold text-bone">
                  {milestoneHeadline}
                </h3>
                <p className="mt-1 max-w-md text-sm leading-relaxed text-muted">
                  Moments like this are the proof the system works. Keep the
                  card — future you will want the before/after.
                </p>
              </div>
              <Button
                onClick={() =>
                  downloadMilestoneCard({
                    headline: milestoneHeadline,
                    score: latest?.overall_score ?? null,
                    delta: latestDelta,
                    streak: streakNum,
                    week: weekNum,
                  })
                }
                className="shrink-0 px-6 py-3"
              >
                Download milestone card
              </Button>
            </div>
          </Card>
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

        </>
      )}

      {tab === "records" && (
        <>
      {/* ACHIEVEMENTS — the badge shelf (subscriber interface) */}
      {isPro && (
        <Reveal delay={0.08} className="mt-6">
          <Achievements items={achievements} />
        </Reveal>
      )}

<Reveal delay={0.08} className="mt-6">
            <MyShelf
              plan={activePlan?.plan ?? null}
              quiz={latest?.quiz ?? null}
              todayKey={todayKey}
            />
          </Reveal>
      {/* SAVED PLANS — version history: every version kept, and any
          version can be made the active plan again (revert) */}
      <Reveal delay={0.1} className="mt-10">
        <h2 className="font-display text-2xl font-extrabold text-bone">
          Your plans
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
          Every version of your plan is kept here — the original and each
          change. Reverting makes a saved version your active plan again:
          nothing is deleted, and nothing is regenerated.
        </p>
        <div className="mt-4 space-y-6">
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
            planGroups.map((g) => {
              const groupScan = g.versions[0]?.scan_id
                ? (scans ?? []).find((s) => s.id === g.versions[0].scan_id)
                : undefined;
              return (
                <div key={g.key}>
                  {g.versions.length > 1 && (
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.22em] text-gold">
                      Version history
                      {groupScan
                        ? ` · scan of ${fmtDate(groupScan.created_at)}`
                        : ""}
                    </p>
                  )}
                  <div className="space-y-3">
                    {g.versions.map((p, vi) => {
                      const linked = p.scan_id
                        ? (scans ?? []).find((s) => s.id === p.scan_id)
                        : undefined;
                      const isActive = p.id === activePlan?.id;
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
                              {p.tier === "premium"
                                ? "Deep-curated (Pro)"
                                : "Standard"}
                              {p.plan.aiPending && (
                                <span className="ml-2 inline-block rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gold-soft">
                                  AI personalisation in progress
                                </span>
                              )}
                            </p>
                            <p className="mt-1.5 flex flex-wrap gap-1.5">
                              <span className="inline-block rounded-full border border-white/12 bg-white/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted">
                                {vi === 0 ? "Original" : `Change ${vi}`}
                              </span>
                              {isActive && (
                                <span className="inline-block rounded-full border border-gold/50 bg-gold/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gold-soft">
                                  Active plan
                                </span>
                              )}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-wrap items-center gap-2">
                            {!isActive && (
                              <Button
                                onClick={() => void onRevert(p)}
                                variant="ghost"
                                className="px-5 py-2.5 text-sm"
                              >
                                Revert to this version
                              </Button>
                            )}
                            {linked?.quiz ? (
                              <Button
                                onClick={() => openPlan(p)}
                                className="px-6 py-2.5 text-sm"
                              >
                                Open plan
                              </Button>
                            ) : (
                              <span className="text-xs text-muted">
                                Reopen via a new scan
                              </span>
                            )}
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Reveal>

        </>
      )}

      {tab === "more" && (
        <>
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

      {/* FULL PROTOCOL LIBRARY — every step, in full (Zayne, 2026-10-21) */}
      <Reveal delay={0.11} className="mt-12">
        <ProtocolLibrary plan={activePlan?.plan ?? null} isPro={isPro} />
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
        </>
      )}

      <AppNav active={tab} onNavigate={setTab} />
    </div>
  );
}
