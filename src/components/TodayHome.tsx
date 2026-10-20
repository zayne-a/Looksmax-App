"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button, Card } from "@/components/ui";
import type { AscendPlan, QuizAnswers } from "@/lib/types";
import type { DailyLog } from "@/lib/account";
import {
  currentStreak,
  dayKey,
  personalTargets,
  questionsForDay,
  taskKey,
  todaysSections,
} from "@/lib/daily";
import { journeyWeek } from "@/lib/journey";

/**
 * The subscriber's daily home: streak, today's protocol as an
 * interactive checklist, the daily 3 questions, and the plan-driven
 * trackers (water / calories / weight). Everything writes into the
 * day's log — which is what the streak, calendar, adjustments and the
 * AI coach all read.
 */
export default function TodayHome({
  plan,
  quiz,
  journeyStart,
  logs,
  activeDays,
  onSaveToday,
}: {
  plan: AscendPlan;
  quiz: QuizAnswers | null;
  journeyStart: string | null;
  logs: DailyLog[];
  activeDays: Set<string>;
  onSaveToday: (
    patch: Partial<{
      answers: Record<string, string>;
      habits: Record<string, boolean>;
      water_ml: number;
      calories: number | null;
      weight_kg: number | null;
    }>
  ) => Promise<void>;
}) {
  const today = dayKey();
  const todayLog = logs.find((l) => l.day === today) ?? null;
  const week = journeyWeek(journeyStart) ?? 1;
  const streak = currentStreak(activeDays, today);
  const sections = useMemo(() => todaysSections(plan, week), [plan, week]);
  const targets = useMemo(
    () => personalTargets(quiz, plan.foundations.hydration.dailyMl),
    [quiz, plan]
  );

  const habits = todayLog?.habits ?? {};
  const totalTasks = sections.reduce((n, s) => n + s.tasks.length, 0);
  const doneTasks = sections.reduce(
    (n, s) =>
      n + s.tasks.filter((t) => habits[taskKey(s.sectionId, t.title)]).length,
    0
  );

  const questions = questionsForDay(today);
  const answers = todayLog?.answers ?? {};
  const answeredAll = questions.every((q) => answers[q.id]);

  const [calInput, setCalInput] = useState("");
  const [weightInput, setWeightInput] = useState("");

  const toggleTask = (sectionId: string, title: string) => {
    const key = taskKey(sectionId, title);
    void onSaveToday({ habits: { [key]: !habits[key] } });
  };

  const answer = (id: string, value: string) => {
    void onSaveToday({ answers: { [id]: value } });
  };

  const water = todayLog?.water_ml ?? 0;
  const waterGoal = targets?.waterMl ?? 2500;
  const waterPct = Math.min(100, Math.round((water / waterGoal) * 100));

  return (
    <div className="space-y-6">
      {/* STREAK STRIP */}
      <Card glow>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className={`flex h-14 w-14 items-center justify-center rounded-2xl border text-2xl ${
                streak > 0
                  ? "border-gold/50 bg-gold/15 shadow-[0_0_24px_-6px_rgba(227,185,78,0.7)]"
                  : "border-white/10 bg-white/[0.03]"
              }`}
              aria-hidden
            >
              🔥
            </div>
            <div>
              <p className="font-display text-2xl font-extrabold leading-none text-bone">
                {streak} day{streak === 1 ? "" : "s"}
                <span className="ml-2 text-sm font-bold text-gold-soft">
                  streak
                </span>
              </p>
              <p className="mt-1 text-xs text-muted">
                {streak > 0
                  ? "Keep it alive: one check, one answer, or one scan today."
                  : "Start today: tick one habit below and the fire lights."}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-gold">
              Week {week} of 12
            </p>
            <p className="mt-1 text-xs text-muted">
              {doneTasks}/{totalTasks} of today's protocol done
            </p>
            <div className="mt-2 h-1.5 w-36 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gold transition-all"
                style={{
                  width: `${totalTasks ? (doneTasks / totalTasks) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* TODAY'S PROTOCOL — interactive checklist */}
      <Card>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-gold">
              Today&apos;s protocol
            </p>
            <h3 className="font-display mt-1.5 text-2xl font-extrabold text-bone">
              Week {((week - 1) % 4) + 1} focus, in your hands
            </h3>
          </div>
          <p className="text-xs text-muted">
            From your saved plan — tick as you do them
          </p>
        </div>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          {sections.map((s) => (
            <div
              key={s.sectionId}
              className="rounded-2xl border border-white/8 bg-white/[0.02] p-4"
            >
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-gold">
                {s.sectionTitle}
              </p>
              <p className="mt-1 text-[13px] font-medium leading-snug text-muted">
                {s.focus}
              </p>
              <ul className="mt-3 space-y-2">
                {s.tasks.map((t) => {
                  const key = taskKey(s.sectionId, t.title);
                  const done = Boolean(habits[key]);
                  return (
                    <li key={key}>
                      <button
                        onClick={() => toggleTask(s.sectionId, t.title)}
                        className={`flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                          done
                            ? "border-gold/40 bg-gold/[0.08]"
                            : "border-white/8 bg-white/[0.02] hover:border-gold/30"
                        }`}
                      >
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
                        <span>
                          <span
                            className={`block text-sm font-bold leading-snug ${
                              done ? "text-gold-soft" : "text-bone"
                            }`}
                          >
                            {t.title}
                          </span>
                          <span className="mt-0.5 block text-xs leading-relaxed text-muted">
                            {t.frequency}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </Card>

      {/* DAILY 3 QUESTIONS */}
      <Card>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-gold">
              Daily check · {questions[0]?.pillar ?? "Today"}
            </p>
            <h3 className="font-display mt-1.5 text-2xl font-extrabold text-bone">
              Today&apos;s 3 questions
            </h3>
          </div>
          {answeredAll ? (
            <span className="rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs font-bold text-gold-soft">
              Banked ✓ — your coach has them
            </span>
          ) : (
            <Link
              href="/coach"
              className="text-xs font-bold text-gold-soft underline underline-offset-2 hover:text-gold"
            >
              Or answer with your coach →
            </Link>
          )}
        </div>
        <div className="mt-5 space-y-5">
          {questions.map((q) => (
            <div key={q.id}>
              <p className="text-sm font-bold text-bone">{q.question}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {q.chips.map((chip) => {
                  const selected = answers[q.id] === chip;
                  return (
                    <button
                      key={chip}
                      onClick={() => answer(q.id, chip)}
                      className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                        selected
                          ? "border-gold bg-gold/15 text-gold-soft"
                          : "border-white/12 bg-white/[0.03] text-muted hover:border-gold/40 hover:text-bone"
                      }`}
                    >
                      {chip}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* TRACKERS — set from their plan */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-gold">
            Water
          </p>
          <p className="font-display mt-2 text-3xl font-extrabold text-bone">
            {(water / 1000).toFixed(2)}
            <span className="text-base text-muted"> / {(waterGoal / 1000).toFixed(1)} L</span>
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gold transition-all"
              style={{ width: `${waterPct}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted">
            Your plan&apos;s target: 35ml per kg, from your Foundations.
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              onClick={() => void onSaveToday({ water_ml: water + 250 })}
              variant="ghost"
              className="px-4 py-2 text-sm"
            >
              + Glass (250ml)
            </Button>
            {water > 0 && (
              <Button
                onClick={() =>
                  void onSaveToday({ water_ml: Math.max(0, water - 250) })
                }
                variant="ghost"
                className="px-4 py-2 text-sm"
              >
                − Undo
              </Button>
            )}
          </div>
        </Card>

        <Card>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-gold">
            Calories
          </p>
          <p className="font-display mt-2 text-3xl font-extrabold text-bone">
            {todayLog?.calories ?? "—"}
            <span className="text-base text-muted">
              {" "}
              / {targets ? targets.targetKcal : "—"} kcal
            </span>
          </p>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            {targets
              ? targets.goalNote
              : "Log a scan with your stats to set your personal target."}
          </p>
          {targets && (
            <p className="mt-1 text-xs text-muted">
              Protein {targets.proteinG}g · Carbs ~{targets.carbsG}g
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <input
              value={calInput}
              onChange={(e) => setCalInput(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="Today's total kcal"
              inputMode="numeric"
              className="w-full min-w-0 rounded-xl border border-white/12 bg-white/[0.03] px-3 py-2 text-sm text-bone placeholder:text-muted/60"
            />
            <Button
              onClick={() => {
                const v = parseInt(calInput, 10);
                if (!Number.isNaN(v)) {
                  void onSaveToday({ calories: v });
                  setCalInput("");
                }
              }}
              variant="ghost"
              className="shrink-0 px-4 py-2 text-sm"
            >
              Log
            </Button>
          </div>
        </Card>

        <Card>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-gold">
            Weight
          </p>
          <p className="font-display mt-2 text-3xl font-extrabold text-bone">
            {todayLog?.weight_kg ?? "—"}
            <span className="text-base text-muted"> kg</span>
          </p>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            Morning, same conditions. The trend across weeks is the signal —
            single days are noise.
          </p>
          <div className="mt-3 flex gap-2">
            <input
              value={weightInput}
              onChange={(e) =>
                setWeightInput(e.target.value.replace(/[^0-9.]/g, ""))
              }
              placeholder="e.g. 79.4"
              inputMode="decimal"
              className="w-full min-w-0 rounded-xl border border-white/12 bg-white/[0.03] px-3 py-2 text-sm text-bone placeholder:text-muted/60"
            />
            <Button
              onClick={() => {
                const v = parseFloat(weightInput);
                if (!Number.isNaN(v) && v > 20 && v < 400) {
                  void onSaveToday({ weight_kg: v });
                  setWeightInput("");
                }
              }}
              variant="ghost"
              className="shrink-0 px-4 py-2 text-sm"
            >
              Log
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
