"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useApp } from "@/lib/store";
import type { QuizAnswers } from "@/lib/types";
import {
  ACTIVITY_LEVELS,
  INPUT_LIMITS,
  bmi,
  ffmi,
  navyBodyFat,
  tdee,
  type ActivityLevel,
  type CalcGender,
  type LimitKey,
} from "@/lib/calculators";
import { CountUp, Reveal } from "@/components/motion";

// ------------------------------------------------------------ plumbing ----

type TabId = "bmi" | "bodyfat" | "ffmi" | "tdee";

const TABS: { id: TabId; label: string }[] = [
  { id: "bmi", label: "BMI" },
  { id: "bodyfat", label: "Body Fat" },
  { id: "ffmi", label: "FFMI" },
  { id: "tdee", label: "TDEE + Macros" },
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

// ---------------------------------------------------------------- page ----

export default function CalculatorsPage() {
  const { quiz } = useApp();
  const [tab, setTab] = useState<TabId>("bmi");
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
            Four free, evidence-based calculators for your climb: BMI, body fat
            percentage, FFMI, and daily calories with macros. They run on the
            same formulas coaches and researchers use — no sign-up, no
            guesswork. Your quiz answers prefill the inputs automatically.
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
        {tab === "bmi" && <BmiPanel quiz={quiz} />}
        {tab === "bodyfat" && (
          <BodyFatPanel quiz={quiz} onValidResult={setBodyFatSeed} />
        )}
        {tab === "ffmi" && <FfmiPanel quiz={quiz} bodyFatSeed={bodyFatSeed} />}
        {tab === "tdee" && <TdeePanel quiz={quiz} />}
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
            Your Ascend blueprint takes these numbers — plus your facial
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
