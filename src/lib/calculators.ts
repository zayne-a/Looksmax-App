// Project Ascend — calculators toolbox.
// Pure functions only: no side effects, no React. All inputs are validated
// and results are rounded for display.

import type { QuizAnswers } from "./types";

export type CalcGender = "male" | "female";
export type AgeRange = QuizAnswers["ageRange"];
export type ActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "active"
  | "very-active";

export interface BmiResult {
  value: number;
  category: string;
  note: string;
}

export interface BodyFatResult {
  value: number;
  category: string;
  note: string;
}

export interface FfmiResult {
  value: number;
  adjusted: number;
  category: string;
  note: string;
}

export interface MacroGrams {
  protein: number;
  carbs: number;
  fat: number;
}

export interface TdeeResult {
  bmr: number;
  tdee: number;
  macros: MacroGrams;
  note: string;
}

/** Sane bounds used for input validation in both the library and the UI. */
export const INPUT_LIMITS = {
  ageYears: { min: 10, max: 100, label: "Age", unit: "years" },
  heightCm: { min: 120, max: 250, label: "Height", unit: "cm" },
  weightKg: { min: 30, max: 400, label: "Weight", unit: "kg" },
  waistCm: { min: 40, max: 200, label: "Waist", unit: "cm" },
  neckCm: { min: 20, max: 80, label: "Neck", unit: "cm" },
  hipCm: { min: 60, max: 200, label: "Hips", unit: "cm" },
  bodyFatPct: { min: 2, max: 70, label: "Body fat", unit: "%" },
} as const;

export type LimitKey = keyof typeof INPUT_LIMITS;

/** Activity level metadata shared by the calculator and the UI. */
export const ACTIVITY_LEVELS: {
  id: ActivityLevel;
  label: string;
  detail: string;
}[] = [
  { id: "sedentary", label: "Sedentary", detail: "Desk job, little to no exercise" },
  { id: "light", label: "Lightly active", detail: "Light exercise 1-3 days/week" },
  { id: "moderate", label: "Moderately active", detail: "Moderate exercise 3-5 days/week" },
  { id: "active", label: "Very active", detail: "Hard exercise 6-7 days/week" },
  { id: "very-active", label: "Extra active", detail: "Physical job plus daily training" },
];

const ACTIVITY_MULTIPLIER: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  "very-active": 1.9,
};

const AGE_MIDPOINT: Record<AgeRange, number> = {
  "18-24": 21,
  "25-34": 29,
  "35-44": 39,
  "45+": 50,
};

const round1 = (n: number): number => Math.round(n * 10) / 10;

function assertInRange(key: LimitKey, value: number): void {
  const l = INPUT_LIMITS[key];
  if (!Number.isFinite(value) || value < l.min || value > l.max) {
    throw new RangeError(
      `${l.label} must be a number between ${l.min} and ${l.max} ${l.unit}.`
    );
  }
}

// ---------------------------------------------------------------- BMI ----

export function bmi(heightCm: number, weightKg: number): BmiResult {
  assertInRange("heightCm", heightCm);
  assertInRange("weightKg", weightKg);
  const heightM = heightCm / 100;
  const value = round1(weightKg / (heightM * heightM));

  if (value < 18.5) {
    return {
      value,
      category: "Underweight",
      note: "Build lean mass with a small calorie surplus and 3-4 lifting sessions per week.",
    };
  }
  if (value < 25) {
    return {
      value,
      category: "Healthy range",
      note: "Hold here — recomposition (lift heavy, eat high protein) sharpens features without a cut.",
    };
  }
  if (value < 30) {
    return {
      value,
      category: "Overweight",
      note: "A slow cut of 300-500 kcal/day usually reveals more jawline and cheekbone definition.",
    };
  }
  return {
    value,
    category: "Obese",
    note: "Focus on a steady, sustainable cut — even 5-10% of bodyweight visibly slims the face.",
  };
}

// ---------------------------------------------------------- Body fat ----

function bodyFatCategory(gender: CalcGender, value: number): string {
  if (gender === "male") {
    if (value < 6) return "Essential";
    if (value < 14) return "Athletic";
    if (value < 18) return "Fitness";
    if (value < 25) return "Average";
    return "Obese";
  }
  if (value < 14) return "Essential";
  if (value < 21) return "Athletic";
  if (value < 25) return "Fitness";
  if (value < 32) return "Average";
  return "Obese";
}

function bodyFatNote(gender: CalcGender, category: string): string {
  const isMale = gender === "male";
  switch (category) {
    case "Essential":
      return "Essential-fat levels hurt hormones and health — treat this as a floor, not a target.";
    case "Athletic":
      return isMale
        ? "Peak facial-leanness range for most men — maintain it with a small deficit or recomposition."
        : "Peak facial-leanness range for most women — maintain it with consistent training.";
    case "Fitness":
      return "Lean and healthy — a short 4-6 week cut can bring out more definition.";
    case "Average":
      return isMale
        ? "Cutting 300-500 kcal/day toward 12-15% will noticeably sharpen the jawline."
        : "A slow cut toward the low 20s typically slims the face noticeably.";
    default:
      return "Prioritize a steady, sustainable cut — facial changes usually show up early.";
  }
}

/**
 * US Navy circumference method.
 * Male:   86.010 * log10(waist - neck) - 70.041 * log10(height) + 36.76
 * Female: 163.205 * log10(waist + hip - neck) - 97.684 * log10(height) - 78.387
 * Inputs are in cm; the Navy constants were calibrated on inches, so inputs
 * are converted before the formula is applied (cm values fed in directly
 * inflate the male result by ~6.5 points and the female by ~26.5).
 * hipCm is required for the female formula.
 */
export function navyBodyFat(
  gender: CalcGender,
  heightCm: number,
  waistCm: number,
  neckCm: number,
  hipCm?: number
): BodyFatResult {
  assertInRange("heightCm", heightCm);
  assertInRange("waistCm", waistCm);
  assertInRange("neckCm", neckCm);

  const toIn = (cm: number): number => cm / 2.54;
  const height = toIn(heightCm);
  const waist = toIn(waistCm);
  const neck = toIn(neckCm);

  let value: number;
  if (gender === "male") {
    if (waistCm <= neckCm) {
      throw new RangeError("Waist must be larger than neck for the male formula.");
    }
    value =
      86.01 * Math.log10(waist - neck) -
      70.041 * Math.log10(height) +
      36.76;
  } else {
    if (hipCm === undefined || !Number.isFinite(hipCm)) {
      throw new RangeError("Hip measurement is required for the female formula.");
    }
    assertInRange("hipCm", hipCm);
    if (waistCm + hipCm <= neckCm) {
      throw new RangeError("Waist plus hips must be larger than neck for the female formula.");
    }
    const hips = toIn(hipCm);
    value =
      163.205 * Math.log10(waist + hips - neck) -
      97.684 * Math.log10(height) -
      78.387;
  }

  const rounded = round1(value);
  const category = bodyFatCategory(gender, rounded);
  return { value: rounded, category, note: bodyFatNote(gender, category) };
}

// -------------------------------------------------------------- FFMI ----

function ffmiCategory(adjusted: number): string {
  if (adjusted < 18) return "Below average";
  if (adjusted < 20) return "Average";
  if (adjusted < 22) return "Above average";
  if (adjusted < 23) return "Excellent";
  if (adjusted < 25) return "Superior";
  return "Beyond natural range";
}

function ffmiNote(category: string): string {
  switch (category) {
    case "Below average":
      return "Biggest opportunity: lift 3-4x/week with a 200-300 kcal surplus and 2 g/kg protein.";
    case "Average":
      return "Solid base — progressive overload on compound lifts builds the frame from here.";
    case "Above average":
      return "Noticeably muscular — keep pushing; wider shoulders make the face look leaner by contrast.";
    case "Excellent":
      return "Top-tier natural development — protect it with consistent training volume.";
    case "Superior":
      return "Near the natural ceiling — cut slowly to keep the mass you built.";
    default:
      return "Adjusted FFMI above 25 is rarely reached naturally — double-check the body fat input.";
  }
}

/**
 * Fat-Free Mass Index. Raw FFMI = lean mass (kg) / height (m)^2.
 * Adjusted to a 1.80 m reference height: adjusted = raw + 6.1 * (1.8 - heightM).
 */
export function ffmi(
  heightCm: number,
  weightKg: number,
  bodyFatPct: number
): FfmiResult {
  assertInRange("heightCm", heightCm);
  assertInRange("weightKg", weightKg);
  assertInRange("bodyFatPct", bodyFatPct);

  const heightM = heightCm / 100;
  const leanMassKg = weightKg * (1 - bodyFatPct / 100);
  const value = round1(leanMassKg / (heightM * heightM));
  const adjusted = round1(value + 6.1 * (1.8 - heightM));
  const category = ffmiCategory(adjusted);
  return { value, adjusted, category, note: ffmiNote(category) };
}

// -------------------------------------------------------------- TDEE ----

/**
 * Mifflin-St Jeor BMR x activity multiplier, with macro targets:
 * protein 2 g/kg, fat 0.8 g/kg, remaining calories from carbs (4/4/9 kcal per g).
 */
export function tdee(
  gender: CalcGender,
  ageRange: AgeRange,
  heightCm: number,
  weightKg: number,
  activityLevel: ActivityLevel
): TdeeResult {
  assertInRange("heightCm", heightCm);
  assertInRange("weightKg", weightKg);

  const age = AGE_MIDPOINT[ageRange];
  const bmrRaw =
    10 * weightKg + 6.25 * heightCm - 5 * age + (gender === "male" ? 5 : -161);
  const bmr = Math.round(bmrRaw);
  const tdeeVal = Math.round(bmrRaw * ACTIVITY_MULTIPLIER[activityLevel]);

  const protein = Math.round(2 * weightKg);
  const fat = Math.round(0.8 * weightKg);
  const carbs = Math.max(0, Math.round((tdeeVal - protein * 4 - fat * 9) / 4));

  return {
    bmr,
    tdee: tdeeVal,
    macros: { protein, carbs, fat },
    note: "Eat near this number to maintain; 300-500 kcal under to cut, 200-300 over to lean bulk.",
  };
}

// ------------------------------------------------- BMR (all formulas) ----

export interface BmrInput {
  sex: CalcGender;
  age: number;
  weightKg: number;
  heightCm: number;
  bodyFatPct?: number;
}

export interface BmrAllResult {
  mifflin: number;
  harrisBenedict: number;
  katchMcArdle: number | null;
}

/**
 * Basal metabolic rate under three published formulas, rounded to whole kcal.
 * - Mifflin-St Jeor: the modern default for adults.
 * - Revised Harris-Benedict (Roza & Shizgal): the classic 1919 equation,
 *   revised in 1984.
 * - Katch-McArdle: driven by lean mass instead of total weight, so it needs
 *   a body fat percentage; null when none is supplied.
 */
export function bmrAll(input: BmrInput): BmrAllResult {
  const { sex, age, weightKg, heightCm, bodyFatPct } = input;
  assertInRange("ageYears", age);
  assertInRange("weightKg", weightKg);
  assertInRange("heightCm", heightCm);
  if (bodyFatPct !== undefined) assertInRange("bodyFatPct", bodyFatPct);

  const mifflin =
    10 * weightKg + 6.25 * heightCm - 5 * age + (sex === "male" ? 5 : -161);

  const harrisBenedict =
    sex === "male"
      ? 13.397 * weightKg + 4.799 * heightCm - 5.677 * age + 88.362
      : 9.247 * weightKg + 3.098 * heightCm - 4.33 * age + 447.593;

  const katchMcArdle =
    bodyFatPct === undefined
      ? null
      : 370 + 21.6 * (1 - bodyFatPct / 100) * weightKg;

  return {
    mifflin: Math.round(mifflin),
    harrisBenedict: Math.round(harrisBenedict),
    katchMcArdle: katchMcArdle === null ? null : Math.round(katchMcArdle),
  };
}

// ------------------------------------------- Calorie activity (6 tiers) ----

export type CalorieActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "active"
  | "intense"
  | "athlete";

/**
 * Six-tier activity scale used by the Calorie calculator. These multipliers
 * (and the tier wording) follow the calculator.net convention, which splits
 * the classic "moderate" band into 1.465 / 1.55 steps.
 */
export const CALORIE_ACTIVITY_LEVELS: {
  id: CalorieActivityLevel;
  label: string;
  detail: string;
  multiplier: number;
}[] = [
  { id: "sedentary", label: "Sedentary", detail: "Little or no exercise", multiplier: 1.2 },
  { id: "light", label: "Light", detail: "Exercise 1-3 days/week", multiplier: 1.375 },
  { id: "moderate", label: "Moderate", detail: "Exercise 4-5 days/week", multiplier: 1.465 },
  { id: "active", label: "Active", detail: "Daily exercise, or intense exercise 3-4 days/week", multiplier: 1.55 },
  { id: "intense", label: "Intense", detail: "Intense exercise 6-7 days/week", multiplier: 1.725 },
  { id: "athlete", label: "Athlete", detail: "Physical job plus training", multiplier: 1.9 },
];

export const CALORIE_ACTIVITY_MULTIPLIER: Record<CalorieActivityLevel, number> =
  {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.465,
    active: 1.55,
    intense: 1.725,
    athlete: 1.9,
  };

// ----------------------------------------------------- Calorie targets ----

export type CalorieGoalId =
  | "maintain"
  | "mildLoss"
  | "loss"
  | "extremeLoss"
  | "mildGain"
  | "gain"
  | "fastGain";

export interface CalorieTarget {
  id: CalorieGoalId;
  label: string;
  deltaKcal: number;
  /** Signed expected rate of change: negative for loss, positive for gain. */
  weeklyChangeKg: number;
  kcal: number;
  pctOfMaintenance: number;
  /** True when a loss target drops under the safe daily floor. */
  belowSafeFloor: boolean;
}

const CALORIE_GOALS: {
  id: CalorieGoalId;
  label: string;
  deltaKcal: number;
  weeklyChangeKg: number;
}[] = [
  { id: "maintain", label: "Maintain weight", deltaKcal: 0, weeklyChangeKg: 0 },
  { id: "mildLoss", label: "Mild weight loss", deltaKcal: -250, weeklyChangeKg: -0.25 },
  { id: "loss", label: "Weight loss", deltaKcal: -500, weeklyChangeKg: -0.5 },
  { id: "extremeLoss", label: "Extreme weight loss", deltaKcal: -1000, weeklyChangeKg: -1 },
  { id: "mildGain", label: "Mild weight gain", deltaKcal: 250, weeklyChangeKg: 0.25 },
  { id: "gain", label: "Weight gain", deltaKcal: 500, weeklyChangeKg: 0.5 },
  { id: "fastGain", label: "Fast weight gain", deltaKcal: 1000, weeklyChangeKg: 1 },
];

/** Safe daily calorie floors: men should not eat below 1500, women 1200. */
const SAFE_FLOOR_KCAL: Record<CalcGender, number> = { male: 1500, female: 1200 };

/**
 * The seven standard calorie targets around a maintenance number, from
 * extreme loss to fast gain, each with its share of maintenance and a flag
 * when a loss target falls below the safe floor for the given sex.
 */
export function calorieTargets(
  maintenanceKcal: number,
  sex: CalcGender
): CalorieTarget[] {
  if (!Number.isFinite(maintenanceKcal) || maintenanceKcal <= 0) {
    throw new RangeError("Maintenance calories must be a positive number.");
  }
  const floor = SAFE_FLOOR_KCAL[sex];
  return CALORIE_GOALS.map((g) => {
    const kcal = Math.round(maintenanceKcal + g.deltaKcal);
    return {
      id: g.id,
      label: g.label,
      deltaKcal: g.deltaKcal,
      weeklyChangeKg: g.weeklyChangeKg,
      kcal,
      pctOfMaintenance: Math.round((kcal / maintenanceKcal) * 100),
      belowSafeFloor: g.deltaKcal < 0 && kcal < floor,
    };
  });
}

// --------------------------------------------------------- Macro splits ----

export interface MacroSplit extends MacroGrams {
  proteinPct: number;
  carbsPct: number;
  fatPct: number;
}

export interface MacroSplits {
  moderate: MacroSplit;
  lowCarb: MacroSplit;
  highCarb: MacroSplit;
}

function macroSplit(
  kcal: number,
  proteinPct: number,
  carbsPct: number,
  fatPct: number
): MacroSplit {
  return {
    proteinPct,
    carbsPct,
    fatPct,
    protein: Math.round(((kcal * proteinPct) / 100) / 4),
    carbs: Math.round(((kcal * carbsPct) / 100) / 4),
    fat: Math.round(((kcal * fatPct) / 100) / 9),
  };
}

/**
 * Grams per day for the three standard macro distributions at a given
 * calorie level. Protein and carbs carry 4 kcal/g, fat 9 kcal/g.
 */
export function macrosFor(kcal: number): MacroSplits {
  if (!Number.isFinite(kcal) || kcal <= 0) {
    throw new RangeError("Calories must be a positive number.");
  }
  return {
    moderate: macroSplit(kcal, 30, 35, 35),
    lowCarb: macroSplit(kcal, 40, 20, 40),
    highCarb: macroSplit(kcal, 30, 50, 20),
  };
}

// -------------------------------------------------------------- Zigzag ----

export interface ZigzagResult {
  weeklyTotal: number;
  /** Two high days at maintenance (Mon & Thu), five equal low days. */
  scheduleA: number[];
  /** Alternating multipliers around the target, normalised to the week. */
  scheduleB: number[];
}

const ZIGZAG_MULTIPLIERS = [1.0, 0.92, 1.08, 0.96, 1.04, 0.92, 1.08];

/** Nudge one day by the rounding residual so the week sums exactly. */
function fixWeekTotal(days: number[], weeklyTotal: number, adjustIdx: number): void {
  const diff = weeklyTotal - days.reduce((a, b) => a + b, 0);
  if (diff !== 0) days[adjustIdx] += diff;
}

/**
 * Calorie cycling: two 7-day schedules (Mon-Sun) that average out to the
 * same weekly total as eating `targetDailyKcal` every day, so a cut or bulk
 * progresses identically while giving the week high and low days.
 */
export function zigzag(
  targetDailyKcal: number,
  maintenanceKcal: number
): ZigzagResult {
  if (!Number.isFinite(targetDailyKcal) || targetDailyKcal <= 0) {
    throw new RangeError("Target calories must be a positive number.");
  }
  if (!Number.isFinite(maintenanceKcal) || maintenanceKcal <= 0) {
    throw new RangeError("Maintenance calories must be a positive number.");
  }
  const weeklyTotal = Math.round(7 * targetDailyKcal);

  const high = Math.round(maintenanceKcal);
  const low = Math.round((weeklyTotal - 2 * high) / 5);
  const scheduleA = [high, low, low, high, low, low, low];
  fixWeekTotal(scheduleA, weeklyTotal, 1); // keep high days exactly at maintenance

  const scheduleB = ZIGZAG_MULTIPLIERS.map((m) =>
    Math.round(targetDailyKcal * m)
  );
  let largest = 0;
  scheduleB.forEach((d, i) => {
    if (d > scheduleB[largest]) largest = i;
  });
  fixWeekTotal(scheduleB, weeklyTotal, largest);

  return { weeklyTotal, scheduleA, scheduleB };
}

// --------------------------------------------------------- Ideal weight ----

export interface IdealWeightResult {
  hamwi: number;
  devine: number;
  robinson: number;
  miller: number;
  /** Weights at BMI 18.5 and 24.9 for this height. */
  healthyMinKg: number;
  healthyMaxKg: number;
}

/**
 * Ideal body weight from the four classic height-based formulas. Each starts
 * from a base weight at 5 ft (152.4 cm) and adds a fixed amount per inch
 * over 5 ft; results are in kg. Also returns the healthy BMI weight range
 * (18.5-24.9) for the height.
 */
export function idealWeight(heightCm: number, sex: CalcGender): IdealWeightResult {
  assertInRange("heightCm", heightCm);
  const overInches = heightCm / 2.54 - 60;
  const heightM = heightCm / 100;

  const base = {
    hamwi: sex === "male" ? 48 : 45.5,
    devine: sex === "male" ? 50 : 45.5,
    robinson: sex === "male" ? 52 : 49,
    miller: sex === "male" ? 56.2 : 53.1,
  };
  const perInch = {
    hamwi: sex === "male" ? 2.7 : 2.2,
    devine: 2.3,
    robinson: sex === "male" ? 1.9 : 1.7,
    miller: sex === "male" ? 1.41 : 1.36,
  };

  return {
    hamwi: round1(base.hamwi + perInch.hamwi * overInches),
    devine: round1(base.devine + perInch.devine * overInches),
    robinson: round1(base.robinson + perInch.robinson * overInches),
    miller: round1(base.miller + perInch.miller * overInches),
    healthyMinKg: round1(18.5 * heightM * heightM),
    healthyMaxKg: round1(24.9 * heightM * heightM),
  };
}

// ------------------------------------------------------- Lean body mass ----

export interface LeanBodyMassInput {
  sex: CalcGender;
  weightKg: number;
  heightCm: number;
}

export interface LeanBodyMassResult {
  boer: number;
  james: number;
  hume: number;
}

/**
 * Lean body mass (everything that is not fat) estimated from height and
 * weight alone, under the Boer, James, and Hume formulas. Results in kg.
 */
export function leanBodyMass(input: LeanBodyMassInput): LeanBodyMassResult {
  const { sex, weightKg, heightCm } = input;
  assertInRange("weightKg", weightKg);
  assertInRange("heightCm", heightCm);
  const ratio = weightKg / heightCm;

  const boer =
    sex === "male"
      ? 0.407 * weightKg + 0.267 * heightCm - 19.2
      : 0.252 * weightKg + 0.473 * heightCm - 48.3;
  const james =
    sex === "male"
      ? 1.1 * weightKg - 128 * ratio * ratio
      : 1.07 * weightKg - 148 * ratio * ratio;
  const hume =
    sex === "male"
      ? 0.3281 * weightKg + 0.33929 * heightCm - 29.5336
      : 0.29569 * weightKg + 0.41813 * heightCm - 43.2933;

  return { boer: round1(boer), james: round1(james), hume: round1(hume) };
}

// --------------------------------------------------------- Protein needs ----

export interface ProteinRange {
  min: number;
  max: number;
}

export interface ProteinNeedsResult {
  sedentary: ProteinRange;
  active: ProteinRange;
  buildMuscle: ProteinRange;
  loseFat: ProteinRange;
}

/**
 * Daily protein targets in grams by goal, scaled from evidence-based
 * per-kilogram intakes: 0.8 g/kg sedentary baseline (the RDA), 1.2-1.4 for
 * active people, 1.6-2.2 to build muscle, and 1.8-2.4 to protect muscle
 * while losing fat.
 */
export function proteinNeeds(weightKg: number): ProteinNeedsResult {
  assertInRange("weightKg", weightKg);
  const range = (lo: number, hi: number): ProteinRange => ({
    min: Math.round(lo * weightKg),
    max: Math.round(hi * weightKg),
  });
  return {
    sedentary: range(0.8, 0.8),
    active: range(1.2, 1.4),
    buildMuscle: range(1.6, 2.2),
    loseFat: range(1.8, 2.4),
  };
}
