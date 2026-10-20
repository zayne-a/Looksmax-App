"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui";
import type { Checkin, DailyLog, SavedScan } from "@/lib/account";
import { currentStreak, dayKey, DAILY_QUESTION_SETS } from "@/lib/daily";

const QUESTION_TEXT: Record<string, string> = Object.fromEntries(
  DAILY_QUESTION_SETS.flat().map((q) => [q.id, q.question])
);

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * The record calendar: every tracked day in one view — daily logs
 * (gold), check-ins (ring), scans (diamond), and the days that make
 * up the current streak (flame). Click a day to read its record.
 */
export default function TrackCalendar({
  logs,
  checkins,
  scans,
}: {
  logs: DailyLog[];
  checkins: Checkin[];
  scans: SavedScan[];
}) {
  const today = dayKey();
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<string>(today);

  const { logByDay, checkinDays, scanByDay, activeDays, streakDays } =
    useMemo(() => {
      const logByDay = new Map(logs.map((l) => [l.day, l]));
      const checkinDays = new Set(
        checkins.map((c) => dayKey(new Date(c.created_at)))
      );
      const scanByDay = new Map<string, SavedScan>();
      for (const s of scans) {
        const k = dayKey(new Date(s.created_at));
        if (!scanByDay.has(k)) scanByDay.set(k, s);
      }
      const activeDays = new Set<string>([
        ...logByDay.keys(),
        ...checkinDays,
        ...scanByDay.keys(),
      ]);
      const streakDays = new Set<string>();
      let streak = currentStreak(activeDays, today);
      let cursor = activeDays.has(today) ? today : null;
      if (!cursor && streak > 0) {
        // streak ended yesterday
        const y = new Date();
        y.setDate(y.getDate() - 1);
        cursor = dayKey(y);
      }
      while (cursor && streak > 0) {
        streakDays.add(cursor);
        streak -= 1;
        const d = new Date(`${cursor}T12:00:00`);
        d.setDate(d.getDate() - 1);
        cursor = dayKey(d);
      }
      return { logByDay, checkinDays, scanByDay, activeDays, streakDays };
    }, [logs, checkins, scans, today]);

  const view = new Date();
  view.setDate(1);
  view.setMonth(view.getMonth() + offset);
  const year = view.getFullYear();
  const month = view.getMonth();
  const firstWeekday = (view.getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const canGoForward = offset < 0;

  const sel = logByDay.get(selected);
  const selScan = scanByDay.get(selected);
  const selHabitsDone = sel
    ? Object.values(sel.habits).filter(Boolean).length
    : 0;

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-gold">
            Your record
          </p>
          <h3 className="font-display mt-1.5 text-2xl font-extrabold text-bone">
            {MONTHS[month]} {year}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setOffset((o) => o - 1)}
            className="rounded-full border border-white/12 px-3 py-1.5 text-sm text-muted transition hover:border-gold/40 hover:text-bone"
            aria-label="Previous month"
          >
            ←
          </button>
          <button
            onClick={() => canGoForward && setOffset((o) => o + 1)}
            disabled={!canGoForward}
            className="rounded-full border border-white/12 px-3 py-1.5 text-sm text-muted transition enabled:hover:border-gold/40 enabled:hover:text-bone disabled:opacity-30"
            aria-label="Next month"
          >
            →
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[11px] font-bold uppercase tracking-wider text-muted">
        {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
          <div key={d} className="py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: firstWeekday }).map((_, i) => (
          <div key={`blank-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const dayNum = i + 1;
          const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
          const hasLog = logByDay.has(key);
          const hasCheckin = checkinDays.has(key);
          const hasScan = scanByDay.has(key);
          const isFuture = key > today;
          const isSelected = selected === key;
          return (
            <button
              key={key}
              disabled={isFuture}
              onClick={() => setSelected(key)}
              className={`relative flex aspect-square flex-col items-center justify-center rounded-xl border text-sm transition ${
                isSelected
                  ? "border-gold bg-gold/10 text-bone"
                  : key === today
                    ? "border-gold/50 text-bone"
                    : "border-transparent text-muted hover:border-white/15"
              } ${isFuture ? "opacity-25" : ""}`}
            >
              <span className="font-semibold">{dayNum}</span>
              <span className="mt-0.5 flex h-3 items-center gap-0.5 text-[9px]">
                {streakDays.has(key) && <span aria-label="streak day">🔥</span>}
                {hasLog && <span className="text-gold">●</span>}
                {hasScan && <span className="text-gold-soft">◆</span>}
                {hasCheckin && <span className="text-bone/70">○</span>}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] text-muted">
        🔥 streak day · <span className="text-gold">●</span> daily log ·{" "}
        <span className="text-gold-soft">◆</span> scan · ○ weekly check-in
      </p>

      {/* Selected day record */}
      <div className="mt-4 rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3.5">
        <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-gold">
          {selected === today ? "Today" : selected}
        </p>
        {selScan && selScan.overall_score != null && (
          <p className="mt-1.5 text-sm text-bone">
            ◆ Scan — overall{" "}
            <span className="font-bold text-gold-soft">
              {selScan.overall_score.toFixed(0)}/100
            </span>
          </p>
        )}
        {checkinDays.has(selected) && (
          <p className="mt-1 text-sm text-bone">○ Weekly check-in banked</p>
        )}
        {sel ? (
          <div className="mt-1.5 space-y-1 text-sm text-muted">
            {selHabitsDone > 0 && (
              <p>✓ {selHabitsDone} protocol habits completed</p>
            )}
            {sel.water_ml > 0 && <p>Water: {(sel.water_ml / 1000).toFixed(2)} L</p>}
            {sel.calories !== null && <p>Calories: {sel.calories} kcal</p>}
            {sel.weight_kg !== null && <p>Weight: {sel.weight_kg} kg</p>}
            {Object.entries(sel.answers).map(([id, value]) => (
              <p key={id}>
                <span className="text-bone/80">
                  {QUESTION_TEXT[id] ?? id}:
                </span>{" "}
                {value}
              </p>
            ))}
          </div>
        ) : (
          !selScan &&
          !checkinDays.has(selected) && (
            <p className="mt-1.5 text-sm text-muted">
              Nothing tracked this day yet.
            </p>
          )
        )}
      </div>
    </Card>
  );
}
