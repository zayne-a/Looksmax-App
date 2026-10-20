// Personalization eval gate (founder spec, anti-generic guardrail 3).
// Builds plans for 5 archetype users via buildStubPlan and checks the
// pairwise Jaccard overlap of recommended product types. evaluateArchetypeDiversity
// THROWS (so the script exits non-zero) if any pair overlaps > 70%.

import type {
  AscendPlan,
  FaceMeasurements,
  QuizAnswers,
  SkinMetrics,
} from "@/lib/types";
import { buildStubPlan } from "@/lib/kb";

/** Distinctive product-type keywords collected from task titles/details. */
export const PRODUCT_TYPES = [
  "vitamin c",
  "retinol",
  "retinoid",
  "niacinamide",
  "salicylic acid",
  "bha",
  "azelaic acid",
  "kojic acid",
  "arbutin",
  "glycolic acid",
  "lactic acid",
  "aha",
  "benzoyl peroxide",
  "hyaluronic acid",
  "ceramide",
  "glycerin",
  "panthenol",
  "aloe",
  "peptide",
  "clay mask",
  "exfoliant",
  "serum",
  "toner",
  "gel moisturizer",
  "cream",
  "moisturizer",
  "cleanser",
  "mineral sunscreen",
  "sunscreen",
  "spf",
  "gua sha",
];

/** Collect the distinct product-type keywords mentioned in a plan's tasks. */
export function extractProductTypes(plan: AscendPlan): string[] {
  const text = plan.sections
    .flatMap((s) => s.weeks)
    .flatMap((w) => w.tasks)
    .map((t) => `${t.title} ${t.detail}`)
    .join("\n")
    .toLowerCase();
  return PRODUCT_TYPES.filter((kw) => text.includes(kw)).sort();
}

const TRIGGER_PATTERNS: Array<[RegExp, string]> = [
  [/scan showed elevated redness/, "scan-redness"],
  [/scan showed elevated blemish/, "scan-blemishes"],
  [/scan showed rougher texture/, "scan-texture"],
  [/scan showed under-eye/, "scan-undereye"],
  [/ranked .* #1 goal/, "goalRanking#1"],
  [/ranked .* #\d goal/, "goalRanking"],
  [/routine level/, "routineLevel"],
  [/skin type/, "skinType"],
  [/budget tier/, "budgetTier"],
  [/outdoors most of the day|sun exposure/, "sunExposure"],
  [/sleep \S+ hours/, "sleep"],
  [/diet quality/, "diet"],
  [/train "|body goal/, "exercise"],
  [/face shape/, "faceShape"],
];

/** Top trigger sources cited across a plan's whyYou strings, by frequency. */
export function topTriggerSources(plan: AscendPlan): string[] {
  const texts = plan.sections
    .flatMap((s) => s.weeks)
    .flatMap((w) => w.tasks)
    .map((t) => t.whyYou ?? "");
  const counts = new Map<string, number>();
  for (const text of texts) {
    for (const [re, label] of TRIGGER_PATTERNS) {
      if (re.test(text)) counts.set(label, (counts.get(label) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label]) => label);
}

// ---------- Archetype fixtures ----------

function quizBase(overrides: Partial<QuizAnswers>): QuizAnswers {
  return {
    ratingStyle: "psl",
    gender: "male",
    ageRange: "18-24",
    focus: ["skin"],
    goalRanking: [],
    selfRating: 6,
    goals: [],
    skinType: "unknown",
    skinConcerns: [],
    routineLevel: "unknown",
    budgetTier: "mid",
    sunExposure: "mixed",
    bodyGoal: "maintain",
    heightCm: 175,
    weightKg: 70,
    waistCm: 80,
    neckCm: 38,
    sleepHours: "7-8",
    dietQuality: "average",
    exerciseFreq: "1-2x",
    motivation: "look better",
    ...overrides,
  };
}

function measBase(skin: Partial<SkinMetrics>): FaceMeasurements {
  return {
    facialThirds: { upper: 0.34, mid: 0.33, lower: 0.33 },
    fifths: [0.2, 0.2, 0.2, 0.2, 0.2],
    canthalTiltDeg: 4,
    jawToCheekbone: 0.92,
    fwhr: 1.9,
    symmetryScore: 82,
    goldenRatioScore: 78,
    overallScore: 76,
    faceShape: "oval",
    skin: {
      redness: 25,
      texture: 40,
      blemishCount: 2,
      underEye: 30,
      ...skin,
    },
    landmarksDetected: true,
    notes: [],
  };
}

interface Archetype {
  name: string;
  measurements: FaceMeasurements;
  quiz: QuizAnswers;
}

function archetypes(): Archetype[] {
  return [
    {
      name: "oily-acne beginner",
      measurements: measBase({
        redness: 40,
        texture: 55,
        blemishCount: 14,
        underEye: 30,
      }),
      quiz: quizBase({
        skinType: "oily",
        skinConcerns: ["acne", "oily skin"],
        routineLevel: "none",
        goalRanking: ["clear acne", "glow", "de-tan"],
        budgetTier: "budget",
      }),
    },
    {
      name: "dry-dull 30s",
      measurements: measBase({
        redness: 25,
        texture: 72,
        blemishCount: 1,
        underEye: 45,
      }),
      quiz: quizBase({
        ageRange: "25-34",
        skinType: "dry",
        skinConcerns: ["dullness"],
        routineLevel: "basic",
        goalRanking: ["glow", "anti-aging"],
        sunExposure: "desk",
      }),
    },
    {
      name: "hyperpigmentation-focused",
      measurements: measBase({
        redness: 30,
        texture: 45,
        blemishCount: 2,
        underEye: 35,
      }),
      quiz: quizBase({
        skinType: "combination",
        skinConcerns: ["dark marks", "uneven tone"],
        routineLevel: "basic",
        goalRanking: ["de-tan", "even tone"],
        sunExposure: "outdoor",
      }),
    },
    {
      name: "sensitive-redness",
      measurements: measBase({
        redness: 68,
        texture: 50,
        blemishCount: 2,
        underEye: 30,
      }),
      quiz: quizBase({
        skinType: "sensitive",
        skinConcerns: ["redness"],
        routineLevel: "basic",
        goalRanking: ["calm redness"],
      }),
    },
    {
      name: "advanced maintenance",
      measurements: measBase({
        redness: 20,
        texture: 30,
        blemishCount: 1,
        underEye: 25,
      }),
      quiz: quizBase({
        skinType: "normal",
        routineLevel: "advanced",
        goalRanking: ["maintain", "glow"],
        budgetTier: "premium",
      }),
    },
  ];
}

// ---------- The gate ----------

function jaccard(a: string[], b: string[]): number {
  const sa = new Set(a);
  const sb = new Set(b);
  let inter = 0;
  for (const x of sa) if (sb.has(x)) inter++;
  const union = sa.size + sb.size - inter;
  return union === 0 ? 0 : inter / union;
}

/**
 * Build stub plans for the 5 archetypes and fail if any pair's product-type
 * overlap exceeds 70%. Logs the full overlap matrix and per-plan sets.
 */
export function evaluateArchetypeDiversity(): void {
  const archs = archetypes();
  const sets = archs.map((a) => ({
    name: a.name,
    types: extractProductTypes(buildStubPlan(a.measurements, a.quiz)),
  }));

  console.log("=== Archetype product-type sets ===");
  for (const s of sets) {
    console.log(`- ${s.name} (${s.types.length}): ${s.types.join(", ")}`);
  }

  console.log("\n=== Pairwise Jaccard overlap matrix ===");
  const names = sets.map((s) => s.name);
  const header = ["".padEnd(24), ...names.map((n) => n.slice(0, 18).padEnd(18))].join(
    " "
  );
  console.log(header);
  let worst = 0;
  let worstPair = "";
  for (let i = 0; i < sets.length; i++) {
    const row = [names[i].slice(0, 24).padEnd(24)];
    for (let j = 0; j < sets.length; j++) {
      const v = jaccard(sets[i].types, sets[j].types);
      row.push((i === j ? "—" : `${Math.round(v * 100)}%`).padEnd(18));
      if (i !== j && v > worst) {
        worst = v;
        worstPair = `${sets[i].name} × ${sets[j].name}`;
      }
    }
    console.log(row.join(" "));
  }

  console.log(
    `\nWorst pairwise overlap: ${worstPair} = ${Math.round(worst * 100)}% (gate: >70% fails)`
  );
  if (worst > 0.7) {
    throw new Error(
      `Personalization gate FAILED: ${worstPair} overlap ${Math.round(
        worst * 100
      )}% exceeds 70%. Plans are too generic — see matrix above.`
    );
  }
}
