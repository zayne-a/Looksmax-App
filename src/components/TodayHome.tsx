// App-style status hero + tiles: score RING (SVG progress circle of the latest score, delta chip vs previous scan), week/stage line, streak and today-progress bar in one dense header. Calorie tile is MyFitnessPal-style: the big number is kcal REMAINING (goal - logged) with the Goal - Logged equation, a progress bar, the goal note, and protein/carb dials from the plan-derived targets.
"use client";

import { useEffect, useMemo, useState } from "react";
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
import { buildRoutine } from "@/lib/routine";
import GuidedRoutine from "@/components/GuidedRoutine";

/**
 * The subscriber's daily home: streak, today's protocol as an
 * interactive checklist, the daily 3 questions, and the plan-driven
 * trackers (water / calories / weight). Everything writes into the
 * day's log — which is what the streak, calendar, adjustments and the
 * AI coach all read.
 */
export default function TodayHome({
  score,
  scoreDelta,
  plan,
  quiz,
  journeyStart,
  logs,
  activeDays,
  onSaveDay,
  freeze,
  onFreeze,
}: {
  score: number | null;
  scoreDelta: number | null;
  plan: AscendPlan;
  quiz: QuizAnswers | null;
  journeyStart: string | null;
  logs: DailyLog[];
  activeDays: Set<string>;
  onSaveDay: (
    day: string,
    patch: Partial<{
      answers: Record<string, string>;
      habits: Record<string, boolean>;
      water_ml: number;
      calories: number | null;
      weight_kg: number | null;
    }>
  ) => Promise<void>;
  freeze: { canFreeze: boolean; gapDay: string | null; usedThisWeek: boolean };
  onFreeze: () => void;
}) {
  // "Today" is set in an effect: reading the clock during render
  // breaks Next's prerender of client components.
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => {
    setToday(dayKey());
  }, []);
  const todayLog = today ? (logs.find((l) => l.day === today) ?? null) : null;
  const week = journeyWeek(journeyStart) ?? 1;
  const streak = today ? currentStreak(activeDays, today) : 0;
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

  const questions = today ? questionsForDay(today) : [];
  const answers = todayLog?.answers ?? {};
  const answeredAll = questions.every((q) => answers[q.id]);

  const [calInput, setCalInput] = useState("");
  const [weightInput, setWeightInput] = useState("");
  const [routineKind, setRoutineKind] = useState<"am" | "pm" | null>(null);

  const saveToday = (
    patch: Partial<{
      answers: Record<string, string>;
      habits: Record<string, boolean>;
      water_ml: number;
      calories: number | null;
      weight_kg: number | null;
    }>
  ) => (today ? onSaveDay(today, patch) : Promise.resolve());

  const toggleTask = (sectionId: string, title: string) => {
    const key = taskKey(sectionId, title);
    void saveToday({ habits: { [key]: !habits[key] } });
  };

  const answer = (id: string, value: string) => {
    void saveToday({ answers: { [id]: value } });
  };

  if (!today) return null;

  const completeRoutine = () => {
    const skin = sections.find((s) => s.sectionId === "skin");
    if (!skin) return;
    const patch: Record<string, boolean> = {};
    for (const t of skin.tasks) patch[taskKey(skin.sectionId, t.title)] = true;
    void saveToday({ habits: patch });
  };

  const water = todayLog?.water_ml ?? 0;
  const waterGoal = targets?.waterMl ?? 2500;
  const waterPct = Math.min(100, Math.round((water / waterGoal) * 100));

  return (
    <div className="space-y-6">
      {/* STATUS HERO — score ring, streak, week: the app's home face */}
      <Card glow>
        <div className="flex items-center gap-4 sm:gap-5">
          <div className="relative h-[78px] w-[78px] shrink-0 sm:h-[92px] sm:w-[92px]">
            <svg viewBox="0 0 92 92" className="h-full w-full -rotate-90">
              <circle cx="46" cy="46" r="40" fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth="8" />
              <circle
                cx="46"
                cy="46"
                r="40"
                fill="none"
                stroke="#e3b94e"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 40}`}
                strokeDashoffset={`${2 * Math.PI * 40 * (1 - (score ?? 0) / 100)}`}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-display text-[22px] font-extrabold leading-none text-bone sm:text-[26px]">
                {score !== null ? Math.round(score) : "—"}
              </span>
              <span className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-muted">
                Score
              </span>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-display text-xl font-extrabold leading-none text-bone">
                Week {week} <span className="text-sm font-bold text-muted">of 12</span>
              </p>
              {scoreDelta !== null && scoreDelta !== 0 && (
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${
                    scoreDelta > 0
                      ? "bg-gold/15 text-gold-soft"
                      : "bg-red-300/10 text-red-300"
                  }`}
                >
                  {scoreDelta > 0 ? "▲ +" : "▼ "}
                  {scoreDelta.toFixed(1)} vs last scan
                </span>
              )}
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-sm font-bold text-bone">
              <span aria-hidden>🔥</span> {streak} day{streak === 1 ? "" : "s"} streak
              <span className="font-normal text-muted">
                · {doneTasks}/{totalTasks} of today&apos;s protocol done
              </span>
            </p>
            <div className="mt-2.5 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gold transition-all"
                style={{
                  width: `${totalTasks ? (doneTasks / totalTasks) * 100 : 0}%`,
                }}
              />
            </div>
            <p className="mt-2 text-xs text-muted">
              {streak > 0
                ? "Keep it alive: one check, one answer, or one scan today."
                : "Start today: tick one habit below and the fire lights."}
            </p>
              {freeze.canFreeze && (
                <button
                  onClick={onFreeze}
                  className="mt-2.5 rounded-full border border-sky-300/40 bg-sky-300/10 px-3.5 py-1.5 text-xs font-bold text-sky-200 transition hover:bg-sky-300/20"
                >
                  ❄ Save it with a streak freeze — yesterday counts as a
                  rest day (1/week)
                </button>
              )}
              {!freeze.canFreeze && freeze.usedThisWeek && (
                <p className="mt-2 text-[11px] font-semibold text-sky-200/80">
                  ❄ Streak freeze used this week
                </p>
              )}
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
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => setRoutineKind("am")}
            className="rounded-full border border-gold/40 bg-gold/10 px-5 py-2.5 text-sm font-bold text-gold-soft transition hover:bg-gold/20"
          >
            ▶ Guided AM routine
          </button>
          <button
            onClick={() => setRoutineKind("pm")}
            className="rounded-full border border-white/15 bg-white/[0.03] px-5 py-2.5 text-sm font-bold text-bone transition hover:border-gold/40"
          >
            ▶ Guided PM routine
          </button>
          <span className="self-center text-xs text-muted">
            Step-by-step, with the wait times that make actives work
          </span>
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
                        className={`flex min-h-[48px] w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
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
                      className={`min-h-[44px] rounded-full border px-4 py-2 text-sm font-semibold transition ${
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
              onClick={() => void saveToday({ water_ml: water + 250 })}
              variant="ghost"
              className="px-4 py-2 text-sm"
            >
              + Glass (250ml)
            </Button>
            {water > 0 && (
              <Button
                onClick={() =>
                  void saveToday({ water_ml: Math.max(0, water - 250) })
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
            Calories {targets ? (quiz?.bodyGoal === "cut" ? "· cutting" : quiz?.bodyGoal === "build" ? "· building" : "· maintaining") : ""}
          </p>
          {targets ? (
            <>
              <p className="font-display mt-2 text-[34px] font-extrabold leading-none text-bone">
                {todayLog?.calories != null
                  ? Math.max(0, targets.targetKcal - todayLog.calories).toLocaleString()
                  : targets.targetKcal.toLocaleString()}
                <span className="ml-1.5 text-sm font-bold text-muted">
                  kcal {todayLog?.calories != null ? "remaining" : "goal"}
                </span>
              </p>
              <p className="mt-2 text-xs tabular-nums text-muted">
                Goal {targets.targetKcal.toLocaleString()}
                {todayLog?.calories != null &&
                  ` − Logged ${todayLog.calories.toLocaleString()}`}
              </p>
              <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gold transition-all"
                  style={{
                    width: `${Math.min(100, ((todayLog?.calories ?? 0) / targets.targetKcal) * 100)}%`,
                  }}
                />
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                {targets.goalNote}
              </p>
              <p className="mt-1 text-xs font-semibold text-bone/80">
                Protein {targets.proteinG}g · Carbs ~{targets.carbsG}g — your dials
              </p>
            </>
          ) : (
            <p className="mt-2 text-xs leading-relaxed text-muted">
              Log a scan with your stats to set your personal target.
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
                  void saveToday({ calories: v });
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
                  void saveToday({ weight_kg: v });
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

      {routineKind && (
        <GuidedRoutine
          kind={routineKind}
          steps={buildRoutine(plan, quiz, routineKind, week)}
          onClose={() => setRoutineKind(null)}
          onComplete={completeRoutine}
        />
      )}
    </div>
  );
}
