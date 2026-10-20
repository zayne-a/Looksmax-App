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
