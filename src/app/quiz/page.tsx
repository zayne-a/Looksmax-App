"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useApp } from "@/lib/store";
import type { QuizAnswers } from "@/lib/types";
import { IMAGES } from "@/lib/images";
import { Button, Card, ProgressBar } from "@/components/ui";

const TOTAL_STEPS = 14;

/** Non-input theater step right after gender: the mission/promise screen. */
const MISSION_STEP = 2;

const FOCUS_OPTIONS = [
  { key: "skin", label: "Skin" },
  { key: "jawline", label: "Jawline" },
  { key: "hairstyle", label: "Hairstyle" },
  { key: "beard", label: "Beard / grooming" },
  { key: "eyes", label: "Eyes" },
  { key: "body", label: "Body" },
  { key: "posture", label: "Posture" },
  { key: "harmony", label: "Overall harmony" },
] as const;

const MAX_RANKED_GOALS = 3;

const SKIN_TYPES = ["oily", "dry", "combination", "sensitive", "normal"] as const;

const SKIN_CONCERNS = [
  { key: "acne", label: "Acne / breakouts" },
  { key: "redness", label: "Redness" },
  { key: "dullness", label: "Dullness" },
  { key: "oiliness", label: "Oiliness" },
  { key: "dryness", label: "Dryness" },
  { key: "dark-circles", label: "Dark circles" },
  { key: "large-pores", label: "Large pores" },
] as const;

const ROUTINE_OPTIONS = [
  {
    key: "none",
    title: "None",
    sub: "I don't have a routine",
  },
  {
    key: "basic",
    title: "Basic",
    sub: "Cleanser + moisturizer, that's it",
  },
  {
    key: "advanced",
    title: "Advanced",
    sub: "I already use actives like vitamin C or retinol",
  },
] as const;

const BUDGET_OPTIONS = [
  {
    key: "budget",
    title: "Budget",
    sub: "Affordable drugstore types",
  },
  {
    key: "mid",
    title: "Mid",
    sub: "Happy to spend a bit more",
  },
  {
    key: "premium",
    title: "Premium",
    sub: "Best-in-class, price no object",
  },
] as const;

const SUN_OPTIONS = [
  { key: "outdoor", label: "Mostly outdoors" },
  { key: "mixed", label: "Mixed" },
  { key: "desk", label: "Mostly indoors (desk)" },
] as const;

const SLEEP_OPTIONS = ["<6", "6-7", "7-8", "8+"] as const;
const DIET_OPTIONS = [
  { key: "poor", label: "Poor", sub: "mostly processed food" },
  { key: "average", label: "Average", sub: "a mix of good and bad" },
  { key: "good", label: "Good", sub: "mostly whole foods" },
] as const;
const EXERCISE_OPTIONS = ["never", "1-2x", "3-4x", "5+x"] as const;
const BODY_GOALS = ["cut", "maintain", "build"] as const;

const TIMELINE_OPTIONS = [
  { weeks: 4, title: "4 weeks", sub: "An event is coming — move fast" },
  { weeks: 8, title: "8 weeks", sub: "Steady, serious progress" },
  { weeks: 12, title: "12 weeks", sub: "The full transformation" },
  { weeks: 0, title: "No deadline", sub: "Build the habit, no clock" },
] as const;

const MOTIVATIONS = [
  "Look better in photos",
  "Boost everyday confidence",
  "Dating appeal",
  "Be the best version of myself",
] as const;

const COACH_LINES = [
  "Let's set the rules — your scale, your call.",
  "This tunes your reference ranges.",
  "Before we build — one thing to know.",
  "Quick one — this shapes your plan's priorities.",
  "Pick every area you want to level up.",
  "Order what matters most — your plan follows this list.",
  "Honest baseline. No judgment, just a starting point.",
  "Your skin protocol starts here.",
  "Where are you starting from? No judgment.",
  "This tunes your calorie and training targets.",
  "Small habits, big face gains.",
  "This keeps your product list realistic.",
  "Almost there — this one's for the hard days.",
  "Last one — this paces your whole protocol.",
];

const FOCUS_TO_GOAL: Record<string, string> = {
  skin: "clearer skin",
  jawline: "sharper jawline",
  hairstyle: "better hairstyle",
  beard: "better grooming",
  eyes: "brighter eyes",
  body: "better physique",
  posture: "better posture",
  harmony: "overall facial harmony",
};

const stepVariants = {
  enter: (dir: number) => ({ opacity: 0, x: 56 * dir }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: -56 * dir }),
};

function StepHeading({
  title,
  sub,
}: {
  title: string;
  sub?: string;
}) {
  return (
    <div className="mb-6">
      <h2 className="font-display text-[1.7rem] sm:text-3xl font-extrabold tracking-tight leading-tight text-bone">
        {title}
      </h2>
      {sub && <p className="mt-2 text-sm leading-relaxed text-muted">{sub}</p>}
    </div>
  );
}

function Chip({
  selected,
  onToggle,
  children,
}: {
  selected: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <motion.button
      type="button"
      onClick={onToggle}
      whileTap={{ scale: 0.95 }}
      aria-pressed={selected}
      className={`rounded-full border px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${
        selected
          ? "border-gold bg-gold/15 text-gold-soft shadow-[0_0_16px_-4px_rgba(227,185,78,0.5)]"
          : "border-white/15 bg-ink-3 text-muted hover:border-white/30 hover:text-bone"
      }`}
    >
      {children}
    </motion.button>
  );
}

function OptionCard({
  selected,
  onSelect,
  title,
  sub,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  sub?: string;
}) {
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      whileTap={{ scale: 0.98 }}
      aria-pressed={selected}
      className={`w-full rounded-2xl border p-5 text-left transition-all duration-200 ${
        selected
          ? "border-gold bg-gold/10 shadow-[0_0_24px_-8px_rgba(227,185,78,0.55)]"
          : "border-white/10 bg-ink-2 hover:border-gold/40 hover:bg-ink-3"
      }`}
    >
      <p className="text-base font-bold text-bone">{title}</p>
      {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
    </motion.button>
  );
}

/** Gender step card: large horizontal card, model portrait on the left
 *  (circular crop for male, rounded-rectangle for female), title + subline,
 *  gold treatment when selected. */
function GenderCard({
  selected,
  onSelect,
  img,
  imgShape,
  imgAlt,
  title,
  sub,
}: {
  selected: boolean;
  onSelect: () => void;
  img: string;
  imgShape: string;
  imgAlt: string;
  title: string;
  sub: string;
}) {
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      whileTap={{ scale: 0.98 }}
      aria-pressed={selected}
      className={`flex w-full items-center gap-4 rounded-3xl border p-4 text-left transition-all duration-200 sm:gap-5 sm:p-5 ${
        selected
          ? "border-gold bg-gold/10 shadow-[0_0_36px_-8px_rgba(227,185,78,0.6)]"
          : "border-white/10 bg-ink-2 hover:border-gold/40 hover:bg-ink-3"
      }`}
    >
      <span
        className={`relative shrink-0 overflow-hidden ring-1 ring-white/15 ${imgShape}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={img}
          alt={imgAlt}
          className="h-full w-full object-cover"
          loading="eager"
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-bold text-bone">{title}</span>
        <span className="mt-0.5 block text-sm leading-snug text-muted">
          {sub}
        </span>
      </span>
      {selected && (
        <svg
          width="22"
          height="22"
          viewBox="0 0 18 18"
          fill="none"
          aria-hidden
          className="shrink-0"
        >
          <circle cx="9" cy="9" r="8" fill="#e3b94e" />
          <path
            d="M5.8 9.3l2.2 2.2 4.2-4.8"
            stroke="#12100a"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </motion.button>
  );
}

/* ------------------------------------------------------------------ */
/* Mission interstitial — pure theater, no input collected. Full-      */
/* screen near-black; the three lines stagger in, then the gold        */
/* Continue pill fades in toward the bottom. Counts as a normal step   */
/* in the progress bar.                                                */
/* ------------------------------------------------------------------ */

const MISSION_EASE = [0.22, 1, 0.36, 1] as const;

function MissionScreen({
  step,
  onContinue,
  onBack,
}: {
  step: number;
  onContinue: () => void;
  onBack: () => void;
}) {
  return (
    <div className="relative mx-auto flex min-h-[88vh] w-full max-w-xl flex-col px-4 py-8 sm:px-6 sm:py-12">
      {/* Soft gold aura behind the promise line */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold/10 blur-[100px]"
      />

      <div className="relative">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-gold">
            Your profile
          </p>
          <p className="text-xs font-semibold text-muted tabular-nums">
            {step + 1} / {TOTAL_STEPS}
          </p>
        </div>
        <ProgressBar percent={((step + 1) / TOTAL_STEPS) * 100} />
      </div>

      <div className="relative flex flex-1 flex-col items-center justify-center py-14 text-center">
        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.7, ease: MISSION_EASE }}
          className="text-lg font-medium text-bone/85 sm:text-xl"
        >
          Our mission is simple.
        </motion.p>
        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.05, duration: 0.7, ease: MISSION_EASE }}
          className="mt-3 text-lg font-medium text-muted sm:text-xl"
        >
          To help you become…
        </motion.p>
        <motion.h2
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.85, duration: 0.85, ease: MISSION_EASE }}
          className="font-display mt-5 max-w-md text-4xl font-extrabold leading-[1.12] tracking-tight text-bone sm:text-5xl"
        >
          the <span className="gold-text">most attractive</span> version of
          yourself.
        </motion.h2>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 2.7, duration: 0.7, ease: MISSION_EASE }}
        className="relative mx-auto w-full max-w-sm"
      >
        <Button onClick={onContinue} className="w-full px-8 py-4 text-base">
          Continue
        </Button>
        <button
          type="button"
          onClick={onBack}
          className="mt-4 block w-full text-center text-xs font-medium text-muted/70 transition-colors hover:text-muted"
        >
          Back
        </button>
      </motion.div>
    </div>
  );
}

export default function QuizPage() {
  const router = useRouter();
  const { setQuiz } = useApp();

  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [ratingStyle, setRatingStyle] = useState<"psl" | "standard" | null>(null);
  const [gender, setGender] = useState<"male" | "female" | null>(null);
  const [ageRange, setAgeRange] = useState<QuizAnswers["ageRange"] | null>(null);
  const [focus, setFocus] = useState<string[]>([]);
  const [goalRanking, setGoalRanking] = useState<string[]>([]); // ordered by rank
  const [selfRating, setSelfRating] = useState(5);
  const [skinType, setSkinType] = useState<QuizAnswers["skinType"]>("unknown");
  const [skinConcerns, setSkinConcerns] = useState<string[]>([]);
  const [routineLevel, setRoutineLevel] =
    useState<QuizAnswers["routineLevel"]>("unknown");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [bodyGoal, setBodyGoal] = useState<QuizAnswers["bodyGoal"]>("unknown");
  const [sleepHours, setSleepHours] = useState<string | null>(null);
  const [dietQuality, setDietQuality] = useState<string | null>(null);
  const [exerciseFreq, setExerciseFreq] = useState<string | null>(null);
  const [sunExposure, setSunExposure] =
    useState<QuizAnswers["sunExposure"]>("unknown");
  const [budgetTier, setBudgetTier] =
    useState<QuizAnswers["budgetTier"]>("unknown");
  const [motivation, setMotivation] = useState<string | null>(null);
  const [timelineWeeks, setTimelineWeeks] =
    useState<QuizAnswers["timelineWeeks"] | null>(null);

  const toggle = (arr: string[], key: string) =>
    arr.includes(key) ? arr.filter((k) => k !== key) : [...arr, key];

  // Rank/unrank a goal: tapping an unranked chip assigns the next rank (1, 2, 3);
  // tapping a ranked chip removes it and ranks above it shift down.
  const toggleRank = (key: string) => {
    setGoalRanking((prev) =>
      prev.includes(key)
        ? prev.filter((k) => k !== key)
        : prev.length < MAX_RANKED_GOALS
          ? [...prev, key]
          : prev
    );
  };

  // Keep goalRanking consistent if a focus area is deselected on the way back.
  const toggleFocus = (key: string) => {
    setFocus((prev) => toggle(prev, key));
    setGoalRanking((prev) => prev.filter((k) => k !== key));
  };

  const stepValid = (): boolean => {
    switch (step) {
      case 0:
        return ratingStyle !== null;
      case 1:
        return gender !== null;
      case 2:
        return true; // mission interstitial — no input to validate
      case 3:
        return ageRange !== null;
      case 4:
        return focus.length > 0;
      case 5:
        return goalRanking.length > 0;
      case 6:
        return true; // slider always has a value
      case 7:
        return skinType !== "unknown";
      case 8:
        return routineLevel !== "unknown";
      case 9:
        return bodyGoal !== "unknown";
      case 10:
        return (
          sleepHours !== null &&
          dietQuality !== null &&
          exerciseFreq !== null &&
          sunExposure !== "unknown"
        );
      case 11:
        return budgetTier !== "unknown";
      case 12:
        return motivation !== null;
      case 13:
        return timelineWeeks !== null;
      default:
        return false;
    }
  };

  const finish = () => {
    const heightNum = height.trim() === "" ? undefined : Number(height);
    const weightNum = weight.trim() === "" ? undefined : Number(weight);
    const goals = Array.from(
      new Set([
        ...focus.map((f) => FOCUS_TO_GOAL[f] ?? f),
        ...skinConcerns.map(
          (c) => SKIN_CONCERNS.find((s) => s.key === c)?.label.toLowerCase() ?? c
        ),
      ])
    );
    const answers: QuizAnswers = {
      ratingStyle: ratingStyle!,
      gender: gender!,
      ageRange: ageRange!,
      focus,
      goalRanking,
      selfRating,
      goals,
      skinType,
      skinConcerns,
      routineLevel,
      budgetTier,
      sunExposure,
      bodyGoal,
      sleepHours: sleepHours!,
      dietQuality: dietQuality!,
      exerciseFreq: exerciseFreq!,
      motivation: motivation!,
      timelineWeeks: timelineWeeks!,
      ...(Number.isFinite(heightNum) && heightNum! > 0 ? { heightCm: heightNum } : {}),
      ...(Number.isFinite(weightNum) && weightNum! > 0 ? { weightKg: weightNum } : {}),
    };
    setQuiz(answers);
    router.push("/scan");
  };

  const next = () => {
    if (!stepValid()) return;
    if (step === TOTAL_STEPS - 1) finish();
    else {
      setDirection(1);
      setStep((s) => s + 1);
    }
  };

  const back = () => {
    setDirection(-1);
    setStep((s) => Math.max(0, s - 1));
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <div className="space-y-3">
            <StepHeading
              title="How should we score you?"
              sub="Pick the rating scale you trust. This is your language for the whole journey."
            />
            <OptionCard
              selected={ratingStyle === "psl"}
              onSelect={() => setRatingStyle("psl")}
              title="PSL scale"
              sub="The looksmaxxing-native 1–9 scale. 5 is average, 6+ is above."
            />
            <OptionCard
              selected={ratingStyle === "standard"}
              onSelect={() => setRatingStyle("standard")}
              title="Standard 1–100"
              sub="A familiar 0–100 score, anchored to real facial geometry."
            />
          </div>
        );
      case 1:
        return (
          <div className="space-y-3">
            <StepHeading
              title="Which best describes you?"
              sub="This tunes your reference ranges so your numbers mean something."
            />
            <GenderCard
              selected={gender === "male"}
              onSelect={() => setGender("male")}
              img={IMAGES.genderMale}
              imgShape="h-20 w-20 rounded-full"
              imgAlt="Male model portrait"
              title="Male"
              sub="Show me the best plan."
            />
            <GenderCard
              selected={gender === "female"}
              onSelect={() => setGender("female")}
              img={IMAGES.genderFemale}
              imgShape="h-20 w-16 rounded-2xl"
              imgAlt="Female model portrait"
              title="Female"
              sub="Personalize my glow-up."
            />
          </div>
        );
      case 3:
        return (
          <div className="space-y-4">
            <StepHeading title="Your age range" />
            <div className="grid grid-cols-2 gap-3">
              {(["18-24", "25-34", "35-44", "45+"] as const).map((a) => (
                <motion.button
                  key={a}
                  type="button"
                  onClick={() => setAgeRange(a)}
                  whileTap={{ scale: 0.95 }}
                  className={`rounded-2xl border p-4 text-center font-bold transition-all duration-200 ${
                    ageRange === a
                      ? "border-gold bg-gold/10 text-gold-soft shadow-[0_0_20px_-6px_rgba(227,185,78,0.5)]"
                      : "border-white/10 bg-ink-2 text-muted hover:border-white/25 hover:text-bone"
                  }`}
                >
                  {a}
                </motion.button>
              ))}
            </div>
          </div>
        );
      case 4:
        return (
          <div className="space-y-4">
            <StepHeading
              title="What do you want to level up?"
              sub="Pick as many as apply — your plan attacks these first."
            />
            <div className="flex flex-wrap gap-2.5">
              {FOCUS_OPTIONS.map((f) => (
                <Chip
                  key={f.key}
                  selected={focus.includes(f.key)}
                  onToggle={() => toggleFocus(f.key)}
                >
                  {f.label}
                </Chip>
              ))}
            </div>
          </div>
        );
      case 5: {
        const selectedFocus = FOCUS_OPTIONS.filter((f) => focus.includes(f.key));
        return (
          <div className="space-y-4">
            <StepHeading
              title="Rank your top 3 goals"
              sub="Tap the areas you picked in the order they matter most — #1 is your top priority. Tap again to remove a rank."
            />
            <div className="flex flex-wrap gap-2.5">
              {selectedFocus.map((f) => {
                const rank = goalRanking.indexOf(f.key);
                const selected = rank !== -1;
                return (
                  <motion.button
                    key={f.key}
                    type="button"
                    onClick={() => toggleRank(f.key)}
                    whileTap={{ scale: 0.95 }}
                    aria-pressed={selected}
                    className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${
                      selected
                        ? "border-gold bg-gold/15 text-gold-soft shadow-[0_0_16px_-4px_rgba(227,185,78,0.5)]"
                        : "border-white/15 bg-ink-3 text-muted hover:border-white/30 hover:text-bone"
                    }`}
                  >
                    {selected && (
                      <span className="gold-text flex h-5 w-5 items-center justify-center rounded-full bg-gold/20 text-xs font-extrabold">
                        {rank + 1}
                      </span>
                    )}
                    {f.label}
                  </motion.button>
                );
              })}
            </div>
            <p className="text-xs text-muted">
              {goalRanking.length === 0
                ? "Rank at least 1 goal to continue — 3 is ideal."
                : goalRanking.length < MAX_RANKED_GOALS
                  ? `Ranked ${goalRanking.length} of ${MAX_RANKED_GOALS} — or continue now.`
                  : "All 3 ranked — nice, priorities locked in."}
            </p>
          </div>
        );
      }
      case 6:
        return (
          <div className="space-y-6">
            <StepHeading
              title="Rate yourself right now"
              sub="Be honest — this is your baseline, not your verdict. You'll beat it."
            />
            <div className="text-center">
              <AnimatePresence mode="popLayout">
                <motion.p
                  key={selfRating}
                  initial={{ opacity: 0, y: 8, scale: 0.92 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.92 }}
                  transition={{ duration: 0.18 }}
                  className="gold-text font-display text-7xl font-extrabold tabular-nums"
                >
                  {selfRating}
                </motion.p>
              </AnimatePresence>
              <p className="mt-1 text-sm text-muted">out of 10</p>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              step={1}
              value={selfRating}
              onChange={(e) => setSelfRating(Number(e.target.value))}
              className="slider-gold w-full"
              style={
                {
                  "--fill": `${((selfRating - 1) / 9) * 100}%`,
                } as CSSProperties
              }
              aria-label="Self rating from 1 to 10"
            />
            <div className="flex justify-between text-xs text-muted">
              <span>1 — starting out</span>
              <span>10 — already there</span>
            </div>
          </div>
        );
      case 7:
        return (
          <div className="space-y-6">
            <StepHeading title="Your skin" sub="Your skin protocol is built on this." />
            <div>
              <p className="mb-3 text-sm font-bold text-bone">Skin type</p>
              <div className="flex flex-wrap gap-2.5">
                {SKIN_TYPES.map((t) => (
                  <Chip
                    key={t}
                    selected={skinType === t}
                    onToggle={() => setSkinType(t)}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-3 text-sm font-bold text-bone">
                Skin concerns <span className="font-normal text-muted">(optional)</span>
              </p>
              <div className="flex flex-wrap gap-2.5">
                {SKIN_CONCERNS.map((c) => (
                  <Chip
                    key={c.key}
                    selected={skinConcerns.includes(c.key)}
                    onToggle={() => setSkinConcerns((p) => toggle(p, c.key))}
                  >
                    {c.label}
                  </Chip>
                ))}
              </div>
            </div>
          </div>
        );
      case 8:
        return (
          <div className="space-y-3">
            <StepHeading
              title="What's your current routine?"
              sub="So your plan starts where you are — not from scratch."
            />
            <div className="space-y-2.5">
              {ROUTINE_OPTIONS.map((r) => (
                <OptionCard
                  key={r.key}
                  selected={routineLevel === r.key}
                  onSelect={() => setRoutineLevel(r.key)}
                  title={r.title}
                  sub={r.sub}
                />
              ))}
            </div>
          </div>
        );
      case 9:
        return (
          <div className="space-y-6">
            <StepHeading
              title="Your body"
              sub="This tunes your calorie and training targets."
            />
            <div>
              <p className="mb-3 text-sm font-bold text-bone">
                Body goal <span className="font-normal text-muted">(required)</span>
              </p>
              <div className="flex flex-wrap gap-2.5">
                {BODY_GOALS.map((g) => (
                  <Chip
                    key={g}
                    selected={bodyGoal === g}
                    onToggle={() => setBodyGoal(g)}
                  >
                    {g === "cut"
                      ? "Cut (lean down)"
                      : g === "build"
                        ? "Build (gain muscle)"
                        : "Maintain"}
                  </Chip>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="height" className="mb-2 block text-sm text-muted">
                  Height (cm) <span className="text-muted/60">optional</span>
                </label>
                <input
                  id="height"
                  type="number"
                  inputMode="numeric"
                  min={100}
                  max={250}
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  placeholder="175"
                  className="input-premium"
                />
              </div>
              <div>
                <label htmlFor="weight" className="mb-2 block text-sm text-muted">
                  Weight (kg) <span className="text-muted/60">optional</span>
                </label>
                <input
                  id="weight"
                  type="number"
                  inputMode="numeric"
                  min={30}
                  max={300}
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="70"
                  className="input-premium"
                />
              </div>
            </div>
            <p className="text-xs text-muted">
              Used only to personalize your calorie and training guidance.
            </p>
          </div>
        );
      case 10:
        return (
          <div className="space-y-6">
            <StepHeading
              title="Your lifestyle"
              sub="The unsexy stuff that quietly runs your face."
            />
            <div>
              <p className="mb-3 text-sm font-bold text-bone">Sleep per night</p>
              <div className="flex flex-wrap gap-2.5">
                {SLEEP_OPTIONS.map((s) => (
                  <Chip
                    key={s}
                    selected={sleepHours === s}
                    onToggle={() => setSleepHours(s)}
                  >
                    {s === "<6" ? "Under 6h" : `${s} hours`}
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-3 text-sm font-bold text-bone">Diet quality</p>
              <div className="space-y-2.5">
                {DIET_OPTIONS.map((d) => (
                  <OptionCard
                    key={d.key}
                    selected={dietQuality === d.key}
                    onSelect={() => setDietQuality(d.key)}
                    title={d.label}
                    sub={d.sub}
                  />
                ))}
              </div>
            </div>
            <div>
              <p className="mb-3 text-sm font-bold text-bone">
                Exercise <span className="font-normal text-muted">per week</span>
              </p>
              <div className="flex flex-wrap gap-2.5">
                {EXERCISE_OPTIONS.map((e) => (
                  <Chip
                    key={e}
                    selected={exerciseFreq === e}
                    onToggle={() => setExerciseFreq(e)}
                  >
                    {e === "never" ? "Never" : `${e} sessions`}
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-3 text-sm font-bold text-bone">
                Daily sun exposure <span className="font-normal text-muted">(SPF planning)</span>
              </p>
              <div className="flex flex-wrap gap-2.5">
                {SUN_OPTIONS.map((s) => (
                  <Chip
                    key={s.key}
                    selected={sunExposure === s.key}
                    onToggle={() => setSunExposure(s.key)}
                  >
                    {s.label}
                  </Chip>
                ))}
              </div>
            </div>
          </div>
        );
      case 11:
        return (
          <div className="space-y-3">
            <StepHeading
              title="What's your product budget?"
              sub="So every recommendation is one you'd actually buy."
            />
            <div className="space-y-2.5">
              {BUDGET_OPTIONS.map((b) => (
                <OptionCard
                  key={b.key}
                  selected={budgetTier === b.key}
                  onSelect={() => setBudgetTier(b.key)}
                  title={b.title}
                  sub={b.sub}
                />
              ))}
            </div>
          </div>
        );
      case 12:
        return (
          <div className="space-y-3">
            <StepHeading
              title="What drives you?"
              sub="Pick the one that hits hardest. We'll remind you of it."
            />
            <div className="space-y-2.5">
              {MOTIVATIONS.map((m) => (
                <OptionCard
                  key={m}
                  selected={motivation === m}
                  onSelect={() => setMotivation(m)}
                  title={m}
                />
              ))}
            </div>
          </div>
        );
      case 13:
        return (
          <div className="space-y-3">
            <StepHeading
              title="How soon do you want to see results?"
              sub="Your projection and every checkpoint are paced to this horizon — realistic, not promised."
            />
            <div className="space-y-2.5">
              {TIMELINE_OPTIONS.map((t) => (
                <OptionCard
                  key={t.weeks}
                  selected={timelineWeeks === t.weeks}
                  onSelect={() =>
                    setTimelineWeeks(t.weeks as QuizAnswers["timelineWeeks"])
                  }
                  title={t.title}
                  sub={t.sub}
                />
              ))}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  // Mission interstitial gets its own full-screen layout (theater, no
  // card chrome); the standard layout resumes on the next step.
  if (step === MISSION_STEP) {
    return <MissionScreen step={step} onContinue={next} onBack={back} />;
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-8 sm:px-6 sm:py-12">
      {/* Funnel progress */}
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-gold">
          Your profile
        </p>
        <p className="text-xs font-semibold text-muted tabular-nums">
          {step + 1} / {TOTAL_STEPS}
        </p>
      </div>
      <ProgressBar percent={((step + 1) / TOTAL_STEPS) * 100} className="mb-3" />
      <AnimatePresence mode="wait">
        <motion.p
          key={step}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="mb-6 text-[13px] font-medium text-gold-soft/90"
        >
          {COACH_LINES[step]}
        </motion.p>
      </AnimatePresence>

      <Card glow={step === TOTAL_STEPS - 1}>
        <div className="relative overflow-hidden">
          <AnimatePresence
            mode="wait"
            custom={direction}
            initial={false}
          >
            <motion.div
              key={step}
              custom={direction}
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            >
              {renderStep()}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-8 flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            onClick={back}
            disabled={step === 0}
            className="px-6 py-3"
          >
            Back
          </Button>
          <Button
            onClick={next}
            disabled={!stepValid()}
            className="px-8 py-3 text-[15px]"
          >
            {step === TOTAL_STEPS - 1 ? "Build my plan" : "Continue"}
            <span aria-hidden>→</span>
          </Button>
        </div>
      </Card>

      <p className="mt-6 text-center text-xs text-muted/70">
        Your answers power your plan — nothing is shared, ever.
      </p>
    </div>
  );
}
