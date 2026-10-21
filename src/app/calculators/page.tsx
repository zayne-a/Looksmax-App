"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useApp } from "@/lib/store";
import type { QuizAnswers } from "@/lib/types";
import {
  ACTIVITY_LEVELS,
  CALORIE_ACTIVITY_LEVELS,
  CALORIE_ACTIVITY_MULTIPLIER,
  INPUT_LIMITS,
  bmi,
  bmrAll,
  calorieTargets,
  ffmi,
  idealWeight,
  leanBodyMass,
  macrosFor,
  navyBodyFat,
  proteinNeeds,
  tdee,
  zigzag,
  type ActivityLevel,
  type CalcGender,
  type CalorieActivityLevel,
  type CalorieGoalId,
  type LimitKey,
} from "@/lib/calculators";
import { CountUp, Reveal } from "@/components/motion";

// ------------------------------------------------------------ plumbing ----

type TabId =
  | "calorie"
  | "bmi"
  | "bodyfat"
  | "ffmi"
  | "tdee"
  | "ideal"
  | "leanmass"
  | "protein";

const TABS: { id: TabId; label: string }[] = [
  { id: "calorie", label: "Calories" },
  { id: "bmi", label: "BMI" },
  { id: "bodyfat", label: "Body Fat" },
  { id: "ffmi", label: "FFMI" },
  { id: "tdee", label: "TDEE + Macros" },
  { id: "ideal", label: "Ideal Weight" },
  { id: "leanmass", label: "Lean Mass" },
  { id: "protein", label: "Protein" },
];

interface NumFieldState {
  raw: string;
  setRaw: (v: string) => void;
  value: number;
  error: string | null;
}

/** String-backed numeric field with range validation against INPUT_LIMITS. */
function useNumField(initial: number | undefined, key: LimitKey): NumFieldState {
  const [raw, setRaw] = useState(initial === undefined ? "" : String(initial));
  const limits = INPUT_LIMITS[key];

  const value = useMemo(() => {
    if (raw.trim() === "") return NaN;
    return Number(raw);
  }, [raw]);

  const error = useMemo<string | null>(() => {
    if (raw.trim() === "") return `Enter your ${limits.label.toLowerCase()}.`;
    if (!Number.isFinite(value)) return "Enter a valid number.";
    if (value < limits.min || value > limits.max) {
      return `${limits.label} must be between ${limits.min} and ${limits.max} ${limits.unit}.`;
    }
    return null;
  }, [raw, value, limits]);

  return { raw, setRaw, value, error };
}

function Field({
  label,
  unit,
  field,
  hint,
  testId,
}: {
  label: string;
  unit: string;
  field: NumFieldState;
  hint?: string;
  testId?: string;
}) {
  return (
    <div>
      <label
        htmlFor={testId}
        className="block text-sm font-medium text-bone/90"
      >
        {label} <span className="font-normal text-muted">({unit})</span>
      </label>
      <input
        id={testId}
        value={field.raw}
        onChange={(e) => field.setRaw(e.target.value)}
        inputMode="decimal"
        autoComplete="off"
        placeholder="—"
        className={`mt-1.5 w-full rounded-xl border bg-ink-3 px-4 py-3 text-lg text-bone outline-none transition placeholder:text-muted/50 focus:border-gold ${
          field.error ? "border-red-500/60" : "border-white/10"
        }`}
      />
      {field.error ? (
        <p className="mt-1 text-xs text-red-400">{field.error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <span className="block text-sm font-medium text-bone/90">{label}</span>
      <div role="radiogroup" aria-label={label} className="mt-1.5 flex gap-2">
        {options.map((o) => {
          const active = value === o.value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(o.value)}
              className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                active
                  ? "border-gold bg-gold/15 text-gold-soft"
                  : "border-white/10 bg-ink-3 text-muted hover:text-bone"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; detail?: string }[];
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-bone/90">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full appearance-none rounded-xl border border-white/10 bg-ink-3 px-4 py-3 text-bone outline-none transition focus:border-gold"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-ink-3">
            {o.detail ? `${o.label} — ${o.detail}` : o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function badgeClass(category: string): string {
  const c = category.toLowerCase();
  if (c.includes("obese") || c.includes("beyond"))
    return "border-red-500/40 bg-red-500/15 text-red-300";
  if (c.includes("underweight") || c.includes("below"))
    return "border-amber-500/40 bg-amber-500/15 text-amber-300";
  if (
    c.includes("healthy") ||
    c.includes("athletic") ||
    c.includes("excellent") ||
    c.includes("superior") ||
    c.includes("above")
  )
    return "border-emerald-500/40 bg-emerald-500/15 text-emerald-300";
  return "border-gold/40 bg-gold/10 text-gold-soft";
}

function ResultShell({
  badge,
  note,
  children,
}: {
  badge: string;
  note: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gold/25 bg-gradient-to-b from-gold/[0.07] to-transparent p-6 text-center">
      <span
        className={`inline-block rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider ${badgeClass(
          badge
        )}`}
      >
        {badge}
      </span>
      <div className="mt-3">{children}</div>
      <p className="mt-4 text-sm leading-relaxed text-bone/80">{note}</p>
    </div>
  );
}

function Meaning({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-ink-2 p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-gold-soft">
        What it means for looksmaxxing
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-bone/80">{children}</p>
    </div>
  );
}

function FormulaNote({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs leading-relaxed text-muted">
      <span className="font-semibold text-bone/60">Method: </span>
      {children}
    </p>
  );
}

function Panel({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-bone">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">{intro}</p>
      </div>
      {children}
    </section>
  );
}

// ------------------------------------------------------------- panels ----

function BmiPanel({ quiz }: { quiz: QuizAnswers | null }) {
  const height = useNumField(quiz?.heightCm, "heightCm");
  const weight = useNumField(quiz?.weightKg, "weightKg");

  const result = useMemo(() => {
    if (height.error || weight.error) return null;
    try {
      return bmi(height.value, weight.value);
    } catch {
      return null;
    }
  }, [height.value, height.error, weight.value, weight.error]);

  return (
    <Panel
      title="BMI Calculator"
      intro="Body Mass Index is the simplest screening metric in fitness: your weight relative to your height. It cannot tell muscle from fat, so treat it as a rough compass rather than a verdict — but it sets the starting point for every cut, bulk, or recomposition."
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Height" unit="cm" field={height} testId="bmi-height" hint="e.g. 178" />
        <Field label="Weight" unit="kg" field={weight} testId="bmi-weight" hint="e.g. 75" />
      </div>
      {result ? (
        <ResultShell badge={result.category} note={result.note}>
          <p className="text-5xl font-extrabold tracking-tight">
            <CountUp
              key={result.value}
              value={result.value}
              decimals={1}
              duration={0.7}
              className="gold-text"
            />
          </p>
          <p className="mt-1 text-sm text-muted">Body Mass Index</p>
        </ResultShell>
      ) : (
        <p className="rounded-2xl border border-dashed border-white/15 p-6 text-center text-sm text-muted">
          Enter your height and weight to see your BMI.
        </p>
      )}
      <Meaning>
        For looksmaxxing, BMI tells you which direction to move: above 25 usually
        means a cut will sharpen the jawline and cheekbones; below 18.5 usually
        means building muscle will fill out the face and frame. The real detail
        comes from body fat percentage — check the next tab.
      </Meaning>
      <FormulaNote>
        Weight (kg) divided by height (m) squared. Categories follow WHO cutoffs:
        under 18.5 underweight, 18.5-24.9 healthy, 25-29.9 overweight, 30+ obese.
      </FormulaNote>
    </Panel>
  );
}

function BodyFatPanel({
  quiz,
  onValidResult,
}: {
  quiz: QuizAnswers | null;
  onValidResult: (pct: string) => void;
}) {
  const [gender, setGender] = useState<CalcGender>(quiz?.gender ?? "male");
  const height = useNumField(quiz?.heightCm, "heightCm");
  const waist = useNumField(quiz?.waistCm, "waistCm");
  const neck = useNumField(quiz?.neckCm, "neckCm");
  const hips = useNumField(undefined, "hipCm");

  const result = useMemo(() => {
    if (height.error || waist.error || neck.error) return null;
    if (gender === "female" && hips.error) return null;
    try {
      return navyBodyFat(
        gender,
        height.value,
        waist.value,
        neck.value,
        gender === "female" ? hips.value : undefined
      );
    } catch {
      return null;
    }
  }, [
    gender,
    height.value,
    height.error,
    waist.value,
    waist.error,
    neck.value,
    neck.error,
    hips.value,
    hips.error,
  ]);

  useEffect(() => {
    if (result) onValidResult(result.value.toFixed(1));
  }, [result, onValidResult]);

  return (
    <Panel
      title="Body Fat % Calculator"
      intro="The US Navy body fat method estimates body fat percentage from simple tape measurements — height, waist, and neck (plus hips for women). It is not as precise as a DEXA scan, but it lands within a few percentage points and is the best free method you can do at home with a tape measure."
    >
      <Segmented
        label="Gender"
        options={[
          { value: "male", label: "Male" },
          { value: "female", label: "Female" },
        ]}
        value={gender}
        onChange={setGender}
      />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Height" unit="cm" field={height} testId="bf-height" />
        <Field
          label="Waist"
          unit="cm"
          field={waist}
          testId="bf-waist"
          hint="At the navel, relaxed — don't suck in"
        />
        <Field
          label="Neck"
          unit="cm"
          field={neck}
          testId="bf-neck"
          hint="Just below the Adam's apple"
        />
        {gender === "female" && (
          <Field
            label="Hips"
            unit="cm"
            field={hips}
            testId="bf-hips"
            hint="At the widest point"
          />
        )}
      </div>
      {result ? (
        <ResultShell badge={result.category} note={result.note}>
          <p className="text-5xl font-extrabold tracking-tight">
            <CountUp
              key={result.value}
              value={result.value}
              decimals={1}
              duration={0.7}
              suffix="%"
              className="gold-text"
            />
          </p>
          <p className="mt-1 text-sm text-muted">Estimated body fat</p>
        </ResultShell>
      ) : (
        <p className="rounded-2xl border border-dashed border-white/15 p-6 text-center text-sm text-muted">
          Enter your measurements to estimate body fat.
        </p>
      )}
      <Meaning>
        This is the number that decides facial leanness. Most men see the jawline
        sharpen around 15% body fat and get a chiseled look at 10-12%; most women
        see a slimmer face in the low 20s. Going too low tanks hormones and skin
        quality — the goal is lean, not starved.
      </Meaning>
      <FormulaNote>
        US Navy circumference method — validated within roughly 3-4% of
        hydrostatic (underwater) weighing. Measure in the morning, before eating,
        for consistency.
      </FormulaNote>
    </Panel>
  );
}

function FfmiPanel({
  quiz,
  bodyFatSeed,
}: {
  quiz: QuizAnswers | null;
  bodyFatSeed: string;
}) {
  const height = useNumField(quiz?.heightCm, "heightCm");
  const weight = useNumField(quiz?.weightKg, "weightKg");
  const bodyFat = useNumField(
    bodyFatSeed ? Number(bodyFatSeed) : undefined,
    "bodyFatPct"
  );

  // Pull in the Navy result from the Body Fat tab when it becomes available.
  useEffect(() => {
    if (bodyFatSeed && bodyFat.raw === "") bodyFat.setRaw(bodyFatSeed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bodyFatSeed]);

  const result = useMemo(() => {
    if (height.error || weight.error || bodyFat.error) return null;
    try {
      return ffmi(height.value, weight.value, bodyFat.value);
    } catch {
      return null;
    }
  }, [
    height.value,
    height.error,
    weight.value,
    weight.error,
    bodyFat.value,
    bodyFat.error,
  ]);

  return (
    <Panel
      title="FFMI Calculator"
      intro="The Fat-Free Mass Index measures how much muscle you carry for your height — the single best number for judging whether you still have natural room to grow, or whether adding size is even the right lever for your look."
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Height" unit="cm" field={height} testId="ffmi-height" />
        <Field label="Weight" unit="kg" field={weight} testId="ffmi-weight" />
      </div>
      <Field
        label="Body fat"
        unit="%"
        field={bodyFat}
        testId="ffmi-bodyfat"
        hint={
          bodyFatSeed
            ? `Prefilled from your Body Fat tab result (${bodyFatSeed}%) — edit if needed`
            : "Use your result from the Body Fat tab, or a DEXA estimate"
        }
      />
      {result ? (
        <ResultShell badge={result.category} note={result.note}>
          <p className="text-5xl font-extrabold tracking-tight">
            <CountUp
              key={result.adjusted}
              value={result.adjusted}
              decimals={1}
              duration={0.7}
              className="gold-text"
            />
          </p>
          <p className="mt-1 text-sm text-muted">
            Adjusted FFMI · raw {result.value.toFixed(1)} (1.80 m reference)
          </p>
        </ResultShell>
      ) : (
        <p className="rounded-2xl border border-dashed border-white/15 p-6 text-center text-sm text-muted">
          Enter height, weight, and body fat to compute your FFMI.
        </p>
      )}
      <Meaning>
        A higher FFMI means a wider frame — thicker neck, capped shoulders, and
        traps that make the face look smaller and more angular by contrast. Neck
        training alone can add visible width under the jawline within weeks.
      </Meaning>
      <FormulaNote>
        FFMI = lean mass (kg) divided by height (m) squared, adjusted to a 1.80 m
        reference height (Kouri et al.). Adjusted values above 25 are rarely seen
        without enhancement.
      </FormulaNote>
    </Panel>
  );
}

function TdeePanel({ quiz }: { quiz: QuizAnswers | null }) {
  const [gender, setGender] = useState<CalcGender>(quiz?.gender ?? "male");
  const [ageRange, setAgeRange] = useState<string>(quiz?.ageRange ?? "18-24");
  const [activity, setActivity] = useState<ActivityLevel>("moderate");
  const height = useNumField(quiz?.heightCm, "heightCm");
  const weight = useNumField(quiz?.weightKg, "weightKg");

  const result = useMemo(() => {
    if (height.error || weight.error) return null;
    try {
      return tdee(
        gender,
        ageRange as QuizAnswers["ageRange"],
        height.value,
        weight.value,
        activity
      );
    } catch {
      return null;
    }
  }, [gender, ageRange, height.value, height.error, weight.value, weight.error, activity]);

  const goalHint =
    quiz?.bodyGoal === "cut"
      ? "For your cut goal: eat roughly 300-500 kcal below this number."
      : quiz?.bodyGoal === "build"
        ? "For your build goal: eat roughly 200-300 kcal above this number."
        : quiz?.bodyGoal === "maintain"
          ? "For your maintain goal: eat at this number and let training do the work."
          : null;

  return (
    <Panel
      title="TDEE + Macros Calculator"
      intro="Total Daily Energy Expenditure is the calories you burn in a day — your basal metabolic rate plus everything you do. Every successful cut or lean bulk starts here: eat below it to lose fat, above it to gain muscle."
    >
      <Segmented
        label="Gender"
        options={[
          { value: "male", label: "Male" },
          { value: "female", label: "Female" },
        ]}
        value={gender}
        onChange={setGender}
      />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Height" unit="cm" field={height} testId="tdee-height" />
        <Field label="Weight" unit="kg" field={weight} testId="tdee-weight" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Select
          label="Age range"
          value={ageRange}
          onChange={setAgeRange}
          options={[
            { value: "18-24", label: "18-24" },
            { value: "25-34", label: "25-34" },
            { value: "35-44", label: "35-44" },
            { value: "45+", label: "45+" },
          ]}
        />
        <Select
          label="Activity level"
          value={activity}
          onChange={(v) => setActivity(v as ActivityLevel)}
          options={ACTIVITY_LEVELS.map((a) => ({
            value: a.id,
            label: a.label,
            detail: a.detail,
          }))}
        />
      </div>
      {result ? (
        <ResultShell badge="Daily target" note={result.note}>
          <p className="text-5xl font-extrabold tracking-tight">
            <CountUp
              key={result.tdee}
              value={result.tdee}
              duration={0.7}
              className="gold-text"
            />
            <span className="text-xl font-semibold text-muted"> kcal</span>
          </p>
          <p className="mt-1 text-sm text-muted">
            per day · BMR {result.bmr.toLocaleString("en-US")} kcal
          </p>
          <div className="mt-5 grid grid-cols-3 gap-2 text-left">
            {(
              [
                { label: "Protein", g: result.macros.protein, kcal: result.macros.protein * 4 },
                { label: "Carbs", g: result.macros.carbs, kcal: result.macros.carbs * 4 },
                { label: "Fat", g: result.macros.fat, kcal: result.macros.fat * 9 },
              ] as const
            ).map((m) => (
              <div
                key={m.label}
                className="rounded-xl border border-white/10 bg-ink-3/70 p-3"
              >
                <p className="text-xs uppercase tracking-wider text-muted">
                  {m.label}
                </p>
                <p className="mt-1 text-xl font-bold text-bone">
                  <CountUp
                    key={m.g}
                    value={m.g}
                    duration={0.6}
                  />
                  <span className="text-sm font-medium text-muted"> g</span>
                </p>
                <p className="text-xs text-muted">{m.kcal} kcal</p>
              </div>
            ))}
          </div>
          {goalHint && (
            <p className="mt-4 text-sm font-medium text-gold-soft">{goalHint}</p>
          )}
        </ResultShell>
      ) : (
        <p className="rounded-2xl border border-dashed border-white/15 p-6 text-center text-sm text-muted">
          Enter your stats to compute calories and macros.
        </p>
      )}
      <Meaning>
        Protein is the looksmaxxing macro: 2 g per kilogram preserves muscle while
        you cut, which is what keeps the face defined instead of gaunt. Fill the
        rest with carbs around training and enough fat to keep hormones — and
        skin — healthy.
      </Meaning>
      <FormulaNote>
        Mifflin-St Jeor basal metabolic rate multiplied by your activity level.
        Macros: protein 2 g/kg, fat 0.8 g/kg, remaining calories from carbs
        (4/4/9 kcal per gram).
      </FormulaNote>
    </Panel>
  );
}

type MacroTab = "moderate" | "lowCarb" | "highCarb";

const MACRO_TABS: { id: MacroTab; label: string; detail: string }[] = [
  { id: "moderate", label: "Moderate", detail: "30 / 35 / 35" },
  { id: "lowCarb", label: "Low-carb", detail: "40 / 20 / 40" },
  { id: "highCarb", label: "High-carb", detail: "30 / 50 / 20" },
];

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function rateText(weeklyChangeKg: number): string {
  if (weeklyChangeKg === 0) return "Hold steady";
  const mag = Math.abs(weeklyChangeKg);
  return weeklyChangeKg < 0
    ? `Lose ~${mag} kg/week`
    : `Gain ~${mag} kg/week`;
}

function ZigzagTable({
  title,
  caption,
  days,
  weeklyTotal,
}: {
  title: string;
  caption: string;
  days: number[];
  weeklyTotal: number;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-ink-3/70 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-bone">{title}</p>
        <p className="text-xs text-muted">
          Week total{" "}
          <span className="font-semibold text-bone/80">
            {weeklyTotal.toLocaleString("en-US")} kcal
          </span>
        </p>
      </div>
      <p className="mt-0.5 text-xs text-muted">{caption}</p>
      <div className="mt-3 grid grid-cols-7 gap-1">
        {days.map((d, i) => (
          <div key={i} className="text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
              {DAY_LABELS[i]}
            </p>
            <p className="mt-1 text-[13px] font-bold leading-tight text-bone">
              {d.toLocaleString("en-US")}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function CaloriePanel({
  quiz,
  bodyFatSeed,
  onGoBodyFat,
}: {
  quiz: QuizAnswers | null;
  bodyFatSeed: string;
  onGoBodyFat: () => void;
}) {
  const [gender, setGender] = useState<CalcGender>(quiz?.gender ?? "male");
  const [activity, setActivity] = useState<CalorieActivityLevel>("moderate");
  const [goal, setGoal] = useState<CalorieGoalId>(
    quiz?.bodyGoal === "cut"
      ? "loss"
      : quiz?.bodyGoal === "build"
        ? "gain"
        : "maintain"
  );
  const [macroTab, setMacroTab] = useState<MacroTab>("moderate");
  const age = useNumField(undefined, "ageYears");
  const height = useNumField(quiz?.heightCm, "heightCm");
  const weight = useNumField(quiz?.weightKg, "weightKg");
  const bodyFat = useNumField(
    bodyFatSeed ? Number(bodyFatSeed) : undefined,
    "bodyFatPct"
  );

  // Optional field: an empty body fat is valid (Mifflin-St Jeor is used
  // instead), so suppress the "required" error while the box is untouched.
  const bodyFatDisplay: NumFieldState = {
    ...bodyFat,
    error: bodyFat.raw.trim() === "" ? null : bodyFat.error,
  };

  // Prefill body fat from the Body Fat tab result when it becomes available.
  useEffect(() => {
    if (bodyFatSeed && bodyFat.raw === "") bodyFat.setRaw(bodyFatSeed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bodyFatSeed]);

  const result = useMemo(() => {
    if (age.error || height.error || weight.error) return null;
    const hasBodyFat = bodyFat.raw.trim() !== "";
    if (hasBodyFat && bodyFat.error) return null;
    try {
      const bmr = bmrAll({
        sex: gender,
        age: age.value,
        weightKg: weight.value,
        heightCm: height.value,
        bodyFatPct: hasBodyFat ? bodyFat.value : undefined,
      });
      const usedBmr = bmr.katchMcArdle ?? bmr.mifflin;
      const maintenance = Math.round(
        usedBmr * CALORIE_ACTIVITY_MULTIPLIER[activity]
      );
      return {
        bmr,
        usedBmr,
        method:
          bmr.katchMcArdle !== null
            ? "Katch-McArdle"
            : "Mifflin-St Jeor",
        maintenance,
        targets: calorieTargets(maintenance, gender),
      };
    } catch {
      return null;
    }
  }, [
    gender,
    activity,
    age.value,
    age.error,
    height.value,
    height.error,
    weight.value,
    weight.error,
    bodyFat.value,
    bodyFat.error,
    bodyFat.raw,
  ]);

  const selected =
    result?.targets.find((t) => t.id === goal) ?? result?.targets[0] ?? null;
  const splits = selected ? macrosFor(selected.kcal) : null;
  const cycling =
    selected && result && selected.id !== "maintain"
      ? zigzag(selected.kcal, result.maintenance)
      : null;

  return (
    <Panel
      title="Calorie Calculator"
      intro="Your daily calorie budget, built properly: basal metabolic rate from the equation that fits you, scaled by how active you really are, then mapped to seven goal targets — with macro splits and calorie-cycling schedules for the goal you pick."
    >
      <Segmented
        label="Gender"
        options={[
          { value: "male", label: "Male" },
          { value: "female", label: "Female" },
        ]}
        value={gender}
        onChange={setGender}
      />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Age" unit="years" field={age} testId="cal-age" hint="e.g. 25" />
        <Field label="Height" unit="cm" field={height} testId="cal-height" hint="e.g. 178" />
        <Field label="Weight" unit="kg" field={weight} testId="cal-weight" hint="e.g. 75" />
        <Field
          label="Body fat (optional)"
          unit="%"
          field={bodyFatDisplay}
          testId="cal-bodyfat"
          hint="Entered? BMR uses Katch-McArdle instead"
        />
      </div>
      <p className="-mt-2 text-xs text-muted">
        Don&rsquo;t know your body fat?{" "}
        <button
          type="button"
          onClick={onGoBodyFat}
          className="font-semibold text-gold-soft underline decoration-gold/40 underline-offset-2 transition hover:text-gold"
        >
          Use the Body Fat calculator below
        </button>
        .
      </p>
      <Select
        label="Activity level"
        value={activity}
        onChange={(v) => setActivity(v as CalorieActivityLevel)}
        options={CALORIE_ACTIVITY_LEVELS.map((a) => ({
          value: a.id,
          label: `${a.label} (×${a.multiplier})`,
          detail: a.detail,
        }))}
      />
      {result && selected ? (
        <>
          <div className="rounded-2xl border border-gold/25 bg-gradient-to-b from-gold/[0.07] to-transparent p-6">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-4xl font-extrabold tracking-tight">
                  <CountUp
                    key={result.usedBmr}
                    value={result.usedBmr}
                    duration={0.7}
                    className="gold-text"
                  />
                </p>
                <p className="mt-1 text-sm text-muted">
                  BMR (kcal/day) · {result.method}
                </p>
              </div>
              <div>
                <p className="text-4xl font-extrabold tracking-tight">
                  <CountUp
                    key={result.maintenance}
                    value={result.maintenance}
                    duration={0.7}
                    className="gold-text"
                  />
                </p>
                <p className="mt-1 text-sm text-muted">
                  Maintenance (kcal/day)
                </p>
              </div>
            </div>
            <p className="mt-4 text-center text-sm leading-relaxed text-bone/80">
              {result.method === "Katch-McArdle"
                ? "Because you entered a body fat %, your BMR comes from the Katch-McArdle equation, which is driven by lean mass and is usually the most accurate of the three."
                : `Mifflin-St Jeor is the default — the most accurate general equation. For comparison, Harris-Benedict puts your BMR at ${result.bmr.harrisBenedict.toLocaleString("en-US")} kcal. Add a body fat % above to switch to Katch-McArdle.`}
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gold-soft">
              Pick your goal
            </h3>
            <div className="mt-2 space-y-2">
              {result.targets.map((t) => {
                const active = t.id === selected.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setGoal(t.id)}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition ${
                      active
                        ? "border-gold bg-gold/10"
                        : "border-white/10 bg-ink-3 hover:border-gold/40"
                    }`}
                  >
                    <span>
                      <span
                        className={`block text-sm font-semibold ${
                          active ? "text-gold-soft" : "text-bone"
                        }`}
                      >
                        {t.label}
                      </span>
                      <span className="block text-xs text-muted">
                        {rateText(t.weeklyChangeKg)} · {t.pctOfMaintenance}% of
                        maintenance
                      </span>
                      {t.belowSafeFloor && (
                        <span className="mt-1 block text-xs font-medium text-amber-300">
                          Below the safe minimum — don&rsquo;t go lower than
                          this.
                        </span>
                      )}
                    </span>
                    <span className="text-right">
                      <span className="block text-xl font-bold text-bone">
                        {t.kcal.toLocaleString("en-US")}
                      </span>
                      <span className="block text-xs text-muted">kcal/day</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {splits && (
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-gold-soft">
                Macros for {selected.label.toLowerCase()} —{" "}
                {selected.kcal.toLocaleString("en-US")} kcal
              </h3>
              <div
                role="radiogroup"
                aria-label="Macro split"
                className="mt-2 flex gap-2"
              >
                {MACRO_TABS.map((mt) => {
                  const active = macroTab === mt.id;
                  return (
                    <button
                      key={mt.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setMacroTab(mt.id)}
                      className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                        active
                          ? "border-gold bg-gold/15 text-gold-soft"
                          : "border-white/10 bg-ink-3 text-muted hover:text-bone"
                      }`}
                    >
                      {mt.label}
                      <span className="block text-[11px] font-normal opacity-70">
                        P/C/F {mt.detail}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-left">
                {(
                  [
                    {
                      label: "Protein",
                      g: splits[macroTab].protein,
                      kcal: splits[macroTab].protein * 4,
                      pct: splits[macroTab].proteinPct,
                    },
                    {
                      label: "Carbs",
                      g: splits[macroTab].carbs,
                      kcal: splits[macroTab].carbs * 4,
                      pct: splits[macroTab].carbsPct,
                    },
                    {
                      label: "Fat",
                      g: splits[macroTab].fat,
                      kcal: splits[macroTab].fat * 9,
                      pct: splits[macroTab].fatPct,
                    },
                  ] as const
                ).map((m) => (
                  <div
                    key={m.label}
                    className="rounded-xl border border-white/10 bg-ink-3/70 p-3"
                  >
                    <p className="text-xs uppercase tracking-wider text-muted">
                      {m.label} · {m.pct}%
                    </p>
                    <p className="mt-1 text-xl font-bold text-bone">
                      <CountUp key={m.g} value={m.g} duration={0.6} />
                      <span className="text-sm font-medium text-muted"> g</span>
                    </p>
                    <p className="text-xs text-muted">{m.kcal} kcal</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {cycling && (
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-gold-soft">
                Zigzag schedules — same week, varied days
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                Calorie cycling averages out to exactly your target across the
                week, so progress is identical — high days just land where
                they help most (hard training days, social meals).
              </p>
              <div className="mt-3 space-y-3">
                <ZigzagTable
                  title="Schedule A — 2 high / 5 low"
                  caption="High days at full maintenance (Mon & Thu — move them to your hardest training days); the other five days split what's left."
                  days={cycling.scheduleA}
                  weeklyTotal={cycling.weeklyTotal}
                />
                <ZigzagTable
                  title="Schedule B — alternating"
                  caption="Daily calories swing gently around your target: full days, lighter days, and slightly higher days in rotation."
                  days={cycling.scheduleB}
                  weeklyTotal={cycling.weeklyTotal}
                />
              </div>
            </div>
          )}
        </>
      ) : (
        <p className="rounded-2xl border border-dashed border-white/15 p-6 text-center text-sm text-muted">
          Enter your age, height, and weight to see your calories.
        </p>
      )}
      <Meaning>
        This is the number your whole plan hangs on. Cutting too hard crashes
        testosterone, sleep, and skin quality — you end up smaller but worse
        looking. The mild targets above lose fat at the fastest rate that
        still protects muscle, which is what actually sharpens the face.
      </Meaning>
      <FormulaNote>
        BMR by Mifflin-St Jeor (or Katch-McArdle when body fat % is entered;
        Harris-Benedict shown for comparison), multiplied by a six-tier
        activity factor. Targets step in 250 kcal increments; loss targets are
        flagged under the safe floors of 1,500 kcal (men) and 1,200 kcal
        (women).
      </FormulaNote>
    </Panel>
  );
}

function IdealWeightPanel({ quiz }: { quiz: QuizAnswers | null }) {
  const [gender, setGender] = useState<CalcGender>(quiz?.gender ?? "male");
  const height = useNumField(quiz?.heightCm, "heightCm");

  const result = useMemo(() => {
    if (height.error) return null;
    try {
      return idealWeight(height.value, gender);
    } catch {
      return null;
    }
  }, [height.value, height.error, gender]);

  const formulas = result
    ? [
        { label: "Hamwi", kg: result.hamwi },
        { label: "Devine", kg: result.devine },
        { label: "Robinson", kg: result.robinson },
        { label: "Miller", kg: result.miller },
      ]
    : [];

  return (
    <Panel
      title="Ideal Weight Calculator"
      intro="Four classic medical formulas estimate the weight that suits your height, each from a base weight at 5 feet plus a fixed amount per inch above it. They disagree a little — that spread is the honest answer: a range, not a single magic number."
    >
      <Segmented
        label="Gender"
        options={[
          { value: "male", label: "Male" },
          { value: "female", label: "Female" },
        ]}
        value={gender}
        onChange={setGender}
      />
      <Field label="Height" unit="cm" field={height} testId="iw-height" hint="e.g. 178" />
      {result ? (
        <ResultShell
          badge="Ideal weight"
          note={`The four formulas cluster between ${Math.min(
            ...formulas.map((x) => x.kg)
          ).toFixed(1)} and ${Math.max(...formulas.map((x) => x.kg)).toFixed(
            1
          )} kg. For your height, the healthy BMI range runs ${result.healthyMinKg.toFixed(
            1
          )}–${result.healthyMaxKg.toFixed(1)} kg.`}
        >
          <div className="grid grid-cols-2 gap-2 text-left sm:grid-cols-4">
            {formulas.map((x) => (
              <div
                key={x.label}
                className="rounded-xl border border-white/10 bg-ink-3/70 p-3 text-center"
              >
                <p className="text-xs uppercase tracking-wider text-muted">
                  {x.label}
                </p>
                <p className="mt-1 text-xl font-bold text-bone">
                  <CountUp
                    key={x.kg}
                    value={x.kg}
                    decimals={1}
                    duration={0.6}
                  />
                  <span className="text-sm font-medium text-muted"> kg</span>
                </p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-sm text-muted">
            Healthy BMI range: {result.healthyMinKg.toFixed(1)} –{" "}
            {result.healthyMaxKg.toFixed(1)} kg
          </p>
        </ResultShell>
      ) : (
        <p className="rounded-2xl border border-dashed border-white/15 p-6 text-center text-sm text-muted">
          Enter your height to see your ideal weight range.
        </p>
      )}
      <Meaning>
        Treat the top of the formula range as a lean-muscular target and the
        bottom as a slim target. Where you look best inside it depends on how
        much muscle you carry — the same weight looks completely different at
        12% body fat than at 20%.
      </Meaning>
      <FormulaNote>
        Hamwi (1964), Devine (1974), Robinson (1983), and Miller (1983)
        formulas, converted to kilograms. Healthy range = BMI 18.5–24.9 at
        your height.
      </FormulaNote>
    </Panel>
  );
}

function LeanMassPanel({ quiz }: { quiz: QuizAnswers | null }) {
  const [gender, setGender] = useState<CalcGender>(quiz?.gender ?? "male");
  const height = useNumField(quiz?.heightCm, "heightCm");
  const weight = useNumField(quiz?.weightKg, "weightKg");

  const result = useMemo(() => {
    if (height.error || weight.error) return null;
    try {
      return leanBodyMass({
        sex: gender,
        weightKg: weight.value,
        heightCm: height.value,
      });
    } catch {
      return null;
    }
  }, [gender, height.value, height.error, weight.value, weight.error]);

  const estimates = result
    ? [
        { label: "Boer", kg: result.boer },
        { label: "James", kg: result.james },
        { label: "Hume", kg: result.hume },
      ]
    : [];
  const average = result
    ? (result.boer + result.james + result.hume) / 3
    : 0;

  return (
    <Panel
      title="Lean Body Mass Calculator"
      intro="Lean body mass is everything in you that isn't fat — muscle, bone, organs, water. Three validated formulas estimate it from just height and weight, so you can sanity-check any body fat reading and set a realistic muscle-building target."
    >
      <Segmented
        label="Gender"
        options={[
          { value: "male", label: "Male" },
          { value: "female", label: "Female" },
        ]}
        value={gender}
        onChange={setGender}
      />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Height" unit="cm" field={height} testId="lbm-height" />
        <Field label="Weight" unit="kg" field={weight} testId="lbm-weight" />
      </div>
      {result ? (
        <ResultShell
          badge="Lean body mass"
          note={`Averaging the three formulas: about ${average.toFixed(
            1
          )} kg of lean mass — roughly ${Math.round(
            (average / weight.value) * 100
          )}% of your total weight. The spread between formulas is normal; each was fitted on a different population.`}
        >
          <div className="grid grid-cols-3 gap-2 text-left">
            {estimates.map((x) => (
              <div
                key={x.label}
                className="rounded-xl border border-white/10 bg-ink-3/70 p-3 text-center"
              >
                <p className="text-xs uppercase tracking-wider text-muted">
                  {x.label}
                </p>
                <p className="mt-1 text-xl font-bold text-bone">
                  <CountUp
                    key={x.kg}
                    value={x.kg}
                    decimals={1}
                    duration={0.6}
                  />
                  <span className="text-sm font-medium text-muted"> kg</span>
                </p>
              </div>
            ))}
          </div>
        </ResultShell>
      ) : (
        <p className="rounded-2xl border border-dashed border-white/15 p-6 text-center text-sm text-muted">
          Enter your height and weight to estimate lean body mass.
        </p>
      )}
      <Meaning>
        Lean mass is the asset a cut is supposed to protect. If your weight
        drops but lean mass drops with it, the face gets gaunt, not sharp.
        Track this alongside body fat %: fat down, lean mass flat (or up) is
        the recomposition signature.
      </Meaning>
      <FormulaNote>
        Boer (1984), James (1976), and Hume (1966) lean-mass equations, fitted
        against hydrostatic weighing and isotope dilution studies.
      </FormulaNote>
    </Panel>
  );
}

function ProteinPanel({ quiz }: { quiz: QuizAnswers | null }) {
  const weight = useNumField(quiz?.weightKg, "weightKg");

  const result = useMemo(() => {
    if (weight.error) return null;
    try {
      return proteinNeeds(weight.value);
    } catch {
      return null;
    }
  }, [weight.value, weight.error]);

  const rows = result
    ? [
        {
          label: "Sedentary",
          detail: "0.8 g/kg — the minimum to avoid deficiency",
          range: result.sedentary,
        },
        {
          label: "Active",
          detail: "1.2–1.4 g/kg — training a few days a week",
          range: result.active,
        },
        {
          label: "Build muscle",
          detail: "1.6–2.2 g/kg — surplus or recomposition",
          range: result.buildMuscle,
        },
        {
          label: "Lose fat",
          detail: "1.8–2.4 g/kg — protects muscle in a deficit",
          range: result.loseFat,
        },
      ]
    : [];

  return (
    <Panel
      title="Protein Intake Calculator"
      intro="How much protein you actually need depends on what you're asking your body to do. These targets scale the evidence-based per-kilogram intakes to your weight — the losing-fat target runs highest, because protein is what stands between a cut and muscle loss."
    >
      <Field label="Weight" unit="kg" field={weight} testId="pro-weight" hint="e.g. 75" />
      {result ? (
        <ResultShell
          badge="Daily protein"
          note="Spread it across 3-4 meals — muscle protein synthesis responds best to roughly 0.4 g/kg per meal. Whole foods first; a shake is just a convenient way to close the gap."
        >
          <div className="space-y-2 text-left">
            {rows.map((r) => (
              <div
                key={r.label}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-ink-3/70 px-4 py-3"
              >
                <span>
                  <span className="block text-sm font-semibold text-bone">
                    {r.label}
                  </span>
                  <span className="block text-xs text-muted">{r.detail}</span>
                </span>
                <span className="whitespace-nowrap text-lg font-bold text-bone">
                  {r.range.min === r.range.max
                    ? `${r.range.min}`
                    : `${r.range.min}–${r.range.max}`}
                  <span className="text-sm font-medium text-muted"> g/day</span>
                </span>
              </div>
            ))}
          </div>
        </ResultShell>
      ) : (
        <p className="rounded-2xl border border-dashed border-white/15 p-6 text-center text-sm text-muted">
          Enter your weight to see your protein targets.
        </p>
      )}
      <Meaning>
        Protein is the highest-leverage number in this whole toolbox for
        looks: it preserves the muscle that keeps your jawline and frame
        defined while fat comes off, and it supports skin, hair, and nail
        quality. When in doubt, aim for the build-muscle band.
      </Meaning>
      <FormulaNote>
        Sedentary 0.8 g/kg (the RDA); active 1.2–1.4 g/kg; muscle gain
        1.6–2.2 g/kg; fat loss 1.8–2.4 g/kg — the ranges used in ISSN and
        Morton et al. position stands.
      </FormulaNote>
    </Panel>
  );
}

// ---------------------------------------------------------------- page ----

export default function CalculatorsPage() {
  const { quiz } = useApp();
  const [tab, setTab] = useState<TabId>("calorie");
  const [bodyFatSeed, setBodyFatSeed] = useState("");

  return (
    <div className="mx-auto max-w-3xl px-4 pb-20 pt-10 sm:pt-14">
      {/* Header */}
      <Reveal>
        <header>
          <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-gold">
            Tools
          </p>
          <h1 className="font-display mt-2 text-4xl font-extrabold tracking-tight text-bone sm:text-5xl">
            The <span className="gold-text">Toolbox</span>
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">
            Eight free, evidence-based calculators for your climb: daily
            calories with goal targets, BMI, body fat percentage, FFMI, TDEE
            with macros, ideal weight, lean body mass, and protein intake.
            They run on the same formulas coaches and researchers use — no
            sign-up, no guesswork. Your quiz answers prefill the inputs
            automatically.
          </p>
        </header>
      </Reveal>

      {/* Tabs */}
      <Reveal delay={0.08}>
        <nav
          role="tablist"
          aria-label="Calculators"
          className="mt-8 flex gap-2 overflow-x-auto pb-1"
        >
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.id)}
                className={`whitespace-nowrap rounded-full border px-5 py-2.5 text-sm font-bold transition-all ${
                  active
                    ? "border-gold bg-gold text-ink shadow-[0_0_20px_-4px_rgba(227,185,78,0.6)]"
                    : "border-white/10 bg-ink-2 text-muted hover:border-gold/40 hover:text-bone"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </nav>
      </Reveal>

      {/* Panels */}
      <div className="mt-8" key={tab} role="tabpanel">
        {tab === "calorie" && (
          <CaloriePanel
            quiz={quiz}
            bodyFatSeed={bodyFatSeed}
            onGoBodyFat={() => setTab("bodyfat")}
          />
        )}
        {tab === "bmi" && <BmiPanel quiz={quiz} />}
        {tab === "bodyfat" && (
          <BodyFatPanel quiz={quiz} onValidResult={setBodyFatSeed} />
        )}
        {tab === "ffmi" && <FfmiPanel quiz={quiz} bodyFatSeed={bodyFatSeed} />}
        {tab === "tdee" && <TdeePanel quiz={quiz} />}
        {tab === "ideal" && <IdealWeightPanel quiz={quiz} />}
        {tab === "leanmass" && <LeanMassPanel quiz={quiz} />}
        {tab === "protein" && <ProteinPanel quiz={quiz} />}
      </div>

      {/* Disclaimer */}
      <p className="mt-10 text-xs leading-relaxed text-muted/70">
        Estimates are for guidance only and are not medical advice. Tape-measure
        methods carry a few percentage points of error — track trends over weeks,
        not single readings.
      </p>

      {/* CTA */}
      <Reveal className="mt-8">
        <div className="card-premium lift rounded-3xl border-gold/30 bg-gradient-to-br from-gold/[0.12] via-ink-2 to-ink-2 p-8 text-center">
          <h2 className="font-display text-2xl font-extrabold text-bone sm:text-3xl">
            Numbers are the start.{" "}
            <span className="gold-text">Your plan is next.</span>
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted">
            Your Mewmax blueprint takes these numbers — plus your facial
            measurements — and turns them into a week-by-week protocol for
            skin, diet, exercise, and style.
          </p>
          <Link
            href="/quiz"
            className="btn-gold mt-6 inline-block rounded-full px-8 py-3.5 text-base font-bold"
          >
            Get your full AI plan →
          </Link>
        </div>
      </Reveal>
    </div>
  );
}
