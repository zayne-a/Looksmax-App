"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui";
import type { AscendPlan } from "@/lib/types";
import type { DailyLog } from "@/lib/account";
import { taskKey } from "@/lib/daily";
import {
  buildRoadmap,
  type RoadmapDay,
  type RoadmapWeek,
} from "@/lib/roadmap";

/**
 * "Your Protocol" — the subscriber's whole journey in one place
 * (Zayne, 2026-10-21): a timeline across the weeks they chose, one
 * week open at a time. The open week lays out all 7 days with each
 * day's overall plan (the same tasks Today asks for); the next week
 * unlocks only when every day of the current one is done and the
 * streak survived it. Weeks in a later phase stay locked until that
 * phase's plan has been generated from the user's check-ins.
 *
 * All state is derived by lib/roadmap from the plan + daily_logs +
 * active days — this component only renders it and writes task ticks
 * back through the dashboard's saveDay (the same write path the
 * Today home uses). Server-side locked tasks never reach this
 * component: the day sections come from todaysSections, which
 * filters locked tasks out.
 */
export default function ProtocolRoadmap({
  plan,
  journeyStart,
  logs,
  activeDays,
  checkins,
  planCreatedAts,
  timelineWeeks,
  todayKey,
  onSaveDay,
}: {
  plan: AscendPlan;
  journeyStart: string | null;
  logs: DailyLog[];
  activeDays: Set<string>;
  checkins: number;
  planCreatedAts: string[];
  timelineWeeks: number;
  todayKey: string | null;
  onSaveDay: (
    day: string,
    patch: Partial<{ habits: Record<string, boolean> }>
  ) => Promise<void>;
}) {
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null);

  const weeks = useMemo(() => {
    if (!todayKey) return [];
    return buildRoadmap({
      plan,
      journeyStartIso: journeyStart,
      logs,
      activeDays,
      checkins,
      planCreatedAts,
      timelineWeeks,
      today: todayKey,
    });
  }, [
    plan,
    journeyStart,
    logs,
    activeDays,
    checkins,
    planCreatedAts,
    timelineWeeks,
    todayKey,
  ]);

  if (!todayKey) return null;

  const openWeek = weeks.find((w) => w.state === "open");
  const doneWeeks = weeks.filter((w) => w.state === "complete").length;

  return (
    <Card>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-gold">
            Your Protocol
          </p>
          <h3 className="font-display mt-1.5 text-2xl font-extrabold text-bone">
            The roadmap — one week at a time
          </h3>
          <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted">
            Your whole {weeks.length}-week journey, day by day. Only one
            week is open: finish every day and keep the streak alive to
            unlock the next.
          </p>
        </div>
        <span className="rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-xs font-bold text-gold-soft">
          {doneWeeks}/{weeks.length} weeks complete
          {openWeek ? ` · Week ${openWeek.week} open` : ""}
        </span>
      </div>

      <div className="relative mt-7">
        <div
          aria-hidden
          className="absolute bottom-3 left-[13px] top-3 w-px bg-white/10"
        />
        <div className="space-y-7">
          {weeks.map((w) => (
            <WeekNode
              key={w.week}
              week={w}
              todayKey={todayKey}
              logs={logs}
              expanded={expandedWeek === w.week}
              onToggleExpand={() =>
                setExpandedWeek((cur) => (cur === w.week ? null : w.week))
              }
              onSaveDay={onSaveDay}
            />
          ))}
        </div>
      </div>
    </Card>
  );
}

function WeekNode({
  week,
  todayKey,
  logs,
  expanded,
  onToggleExpand,
  onSaveDay,
}: {
  week: RoadmapWeek;
  todayKey: string;
  logs: DailyLog[];
  expanded: boolean;
  onToggleExpand: () => void;
  onSaveDay: (
    day: string,
    patch: Partial<{ habits: Record<string, boolean> }>
  ) => Promise<void>;
}) {
  const { state } = week;
  const nodeCls =
    state === "complete"
      ? "border-gold bg-gold text-ink"
      : state === "open"
        ? "border-gold/70 bg-gold/15 text-gold-soft"
        : "border-white/15 bg-white/[0.03] text-muted";
  const nodeIcon = state === "complete" ? "✓" : state === "open" ? "◉" : "🔒";

  // Streak so far in the open week: every day before today has a
  // record (today is still in play).
  const pastDays = week.days.filter((d) => d.day < todayKey);
  const streakAlive =
    pastDays.length === 0 ||
    pastDays.every((d) => d.hasRecord || d.frozen);

  return (
    <div className="relative pl-10">
      <span
        aria-hidden
        className={`absolute left-0 top-0.5 flex h-7 w-7 items-center justify-center rounded-full border text-[12px] font-extrabold ${nodeCls}`}
      >
        {nodeIcon}
      </span>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <h4 className="font-display text-lg font-extrabold text-bone">
          Week {week.week}
        </h4>
        <span className="text-xs font-semibold text-muted">
          {week.rangeLabel}
        </span>
        <span className="rounded-full border border-white/12 bg-white/[0.04] px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted">
          Phase {week.phase.n} · {week.phase.name}
        </span>
        {state === "complete" && (
          <span className="rounded-full border border-gold/40 bg-gold/10 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-gold-soft">
            Complete
          </span>
        )}
        {state === "open" && (
          <span className="rounded-full bg-gold px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-ink">
            Open now
          </span>
        )}
        {(state === "locked" || state === "phase-locked") && (
          <span className="rounded-full border border-white/12 bg-white/[0.04] px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted">
            Locked
          </span>
        )}
      </div>

      {week.focuses.length > 0 && state !== "phase-locked" && (
        <p className="mt-1 line-clamp-2 text-[13px] font-medium leading-snug text-muted">
          {week.focuses.join(" · ")}
        </p>
      )}

      {state === "complete" && (
        <>
          <p className="mt-1.5 text-sm font-semibold text-gold-soft">
            7/7 days done · streak kept 🔥
          </p>
          <button
            onClick={onToggleExpand}
            className="mt-2 text-xs font-bold text-gold-soft underline underline-offset-2 hover:text-gold"
          >
            {expanded ? "Hide the week ▲" : "See the week ▼"}
          </button>
          {expanded && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {week.days.map((d) => (
                <DayCard
                  key={d.day}
                  day={d}
                  week={week}
                  logs={logs}
                  editable={false}
                  onSaveDay={onSaveDay}
                />
              ))}
            </div>
          )}
        </>
      )}

      {state === "open" && (
        <>
          <p className="mt-1.5 text-sm font-semibold text-bone">
            {week.daysDone}/7 days done
            {streakAlive ? (
              <span className="text-gold-soft"> · streak alive 🔥</span>
            ) : (
              <span className="text-red-300">
                {" "}
                · streak broke this week — a freeze or finishing the
                missed day is the way back
              </span>
            )}
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {week.days.map((d) => (
              <DayCard
                key={d.day}
                day={d}
                week={week}
                logs={logs}
                editable={!d.isFuture}
                onSaveDay={onSaveDay}
              />
            ))}
          </div>
        </>
      )}

      {(state === "locked" || state === "phase-locked") && (
        <div className="mt-2.5 rounded-2xl border border-white/[0.08] bg-white/[0.02] px-4 py-3">
          {state === "phase-locked" && (
            <>
              <p className="text-sm font-semibold text-gold-soft">
                {week.phase.tagline}
              </p>
              <ul className="mt-2 space-y-1.5">
                {week.phase.inside.map((item) => (
                  <li
                    key={item}
                    className="flex gap-2 text-[13px] leading-relaxed text-muted/85"
                  >
                    <span aria-hidden className="mt-0.5 shrink-0">
                      🔒
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </>
          )}
          {week.lockReason && (
            <p
              className={`text-xs leading-relaxed text-muted ${state === "phase-locked" ? "mt-3" : ""}`}
            >
              {week.lockReason}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function DayCard({
  day,
  week,
  logs,
  editable,
  onSaveDay,
}: {
  day: RoadmapDay;
  week: RoadmapWeek;
  logs: DailyLog[];
  editable: boolean;
  onSaveDay: (
    day: string,
    patch: Partial<{ habits: Record<string, boolean> }>
  ) => Promise<void>;
}) {
  const log = logs.find((l) => l.day === day.day);
  const habits = log?.habits ?? {};
  const canTick = editable && !day.frozen;

  const status = day.frozen
    ? { label: "❄ Streak freeze", cls: "border-sky-300/40 bg-sky-300/10 text-sky-200" }
    : day.complete
      ? { label: "Done ✓", cls: "border-gold/40 bg-gold/10 text-gold-soft" }
      : day.isToday
        ? { label: "Today", cls: "bg-gold text-ink border-gold" }
        : day.isYesterday
          ? { label: "Make-up — until tonight", cls: "border-gold/40 bg-gold/10 text-gold-soft" }
          : day.isFuture
            ? { label: "Upcoming", cls: "border-white/12 bg-white/[0.04] text-muted" }
            : day.doneCount > 0
              ? { label: `${day.doneCount}/${day.totalCount} done`, cls: "border-white/12 bg-white/[0.04] text-muted" }
              : { label: "Missed", cls: "border-white/12 bg-white/[0.04] text-muted" };

  return (
    <div
      className={`rounded-2xl border p-4 ${
        day.isToday
          ? "border-gold/40 bg-gold/[0.04]"
          : "border-white/[0.08] bg-white/[0.02]"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-display text-sm font-extrabold text-bone">
          {day.weekday} <span className="font-semibold text-muted">· {day.dateLabel}</span>
        </p>
        <span
          className={`rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.1em] ${status.cls}`}
        >
          {status.label}
        </span>
      </div>

      {day.frozen ? (
        <p className="mt-3 text-[13px] leading-relaxed text-sky-200/85">
          Rest day, protected by your streak freeze — it counts as done
          and the streak stays alive.
        </p>
      ) : (
        <div className="mt-3 space-y-3.5">
          {week.sections.map((s) => (
            <div key={s.sectionId}>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-gold">
                {s.sectionTitle}
              </p>
              <ul className="mt-1.5 space-y-1.5">
                {s.tasks.map((t) => {
                  const key = taskKey(s.sectionId, t.title);
                  const done = Boolean(habits[key]);
                  const row = (
                    <>
                      <span
                        aria-hidden
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-[11px] font-extrabold ${
                          done
                            ? "border-gold bg-gold text-ink"
                            : "border-white/25 text-transparent"
                        }`}
                      >
                        ✓
                      </span>
                      <span className="min-w-0">
                        <span
                          className={`block text-[13px] font-bold leading-snug ${
                            done ? "text-gold-soft" : "text-bone"
                          }`}
                        >
                          {t.title}
                        </span>
                        <span className="block text-[11px] text-muted">
                          {t.frequency}
                        </span>
                      </span>
                    </>
                  );
                  return (
                    <li key={key}>
                      {canTick ? (
                        <button
                          onClick={() =>
                            void onSaveDay(day.day, {
                              habits: { [key]: !done },
                            })
                          }
                          className={`flex w-full items-start gap-2.5 rounded-lg border px-2.5 py-2 text-left transition ${
                            done
                              ? "border-gold/40 bg-gold/[0.08]"
                              : "border-white/[0.08] bg-white/[0.02] hover:border-gold/30"
                          }`}
                        >
                          {row}
                        </button>
                      ) : (
                        <div className="flex items-start gap-2.5 px-2.5 py-1">
                          {row}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
