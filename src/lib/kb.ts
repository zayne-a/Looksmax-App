// Knowledge-base loaders + template plan builder for Project Ascend.
// The KB (data/kb/*.json) is the product's brain. buildStubPlan assembles a
// realistic plan PURELY from KB templates + rules (no LLM): it is the fallback
// and the no-API-key demo path. It must only ever emit SAFE items.

import type {
  AscendPlan,
  FaceMeasurements,
  PlanFoundations,
  PlanProjection,
  PlanSection,
  PlanTask,
  PlanWeek,
  PriorityFix,
  QuizAnswers,
} from "@/lib/types";

import faceShapesJson from "../../data/kb/face-shapes.json";
import skinProtocolsJson from "../../data/kb/skin-protocols.json";
import bodyProtocolsJson from "../../data/kb/body-protocols.json";
import metricActionsJson from "../../data/kb/metric-actions.json";
import skinFoundationsJson from "../../data/kb/skin-foundations.json";

// ---------- KB interfaces ----------

export interface HaircutRec {
  name: string;
  description: string;
  whyItWorks: string;
  maintenance: string;
}

export interface FaceShapeEntry {
  id: string;
  name: string;
  description: string;
  traits: string[];
  haircuts: HaircutRec[];
  beardNotes: string;
  glassesNotes: string;
}

export interface SkinProtocol {
  id: string;
  name: string;
  signs: string[];
  routine: { am: string[]; pm: string[] };
  weekly: string[];
  productTypes: string[];
  whatToAvoid: string[];
  timelineWeeks: number;
}

export interface BodyProtocol {
  id: string;
  name: string;
  calorieRule: string;
  macroSplit: { protein: string; carbs: string; fat: string };
  training: { daysPerWeek: number; split: string; focus: string };
  habits: string[];
}

export interface MetricAction {
  title: string;
  detail: string;
  impact: "high" | "medium" | "low";
  effort: "low" | "medium" | "high";
}

export interface MetricFinding {
  metric: string;
  condition: string;
  finding: string;
  actions: MetricAction[];
}

export interface RoutineTemplate {
  title: string;
  skinTypes?: string[];
  steps: string[];
}

export interface ActiveInfo {
  name: string;
  whatItDoes: string;
  bestFor: string;
  cautions: string;
}

export interface RxCategory {
  name: string;
  status: string;
  benefits: string;
  doctorNeeded: string;
}

export interface SkinFoundations {
  morningRoutine: RoutineTemplate;
  nightRoutine: RoutineTemplate;
  deTanProtocol: { title: string; principle: string; steps: string[] };
  actives: ActiveInfo[];
  depuffRitual: { title: string; steps: string[] };
  traditionalMask: {
    name: string;
    ingredients: string[];
    method: string;
    frequency: string;
    note: string;
  };
  skinNutrition: { title: string; points: string[] };
  hydration: { title: string; note: string };
  movement: { title: string; points: string[] };
  sleepHygiene: { title: string; points: string[] };
  supplements: {
    title: string;
    framing: string;
    caffeineNote: string;
    items: { name: string; note: string }[];
  };
  postureGrooming: {
    title: string;
    habits: { name: string; detail: string; caution: string }[];
  };
  indianSkinContext: { title: string; note: string };
  rxReference: RxCategory[];
  appFramingLine: string;
}

// ---------- Loaders ----------

export function getFaceShapes(): FaceShapeEntry[] {
  return faceShapesJson as FaceShapeEntry[];
}

export function getSkinProtocols(): SkinProtocol[] {
  return skinProtocolsJson as SkinProtocol[];
}

export function getBodyProtocols(): BodyProtocol[] {
  return bodyProtocolsJson as BodyProtocol[];
}

export function getMetricFindings(): MetricFinding[] {
  return metricActionsJson as MetricFinding[];
}

export function getSkinFoundations(): SkinFoundations {
  return skinFoundationsJson as SkinFoundations;
}

// ---------- Matching helpers ----------

function weight(v: "high" | "medium" | "low"): number {
  return v === "high" ? 3 : v === "medium" ? 2 : 1;
}

function actionScore(a: MetricAction): number {
  return weight(a.impact) * 2 + weight(a.effort);
}

const CONCERN_TO_PROTOCOL: Array<[RegExp, string]> = [
  [/acne|pimple|breakout|blemish|blackhead|whitehead/i, "acne"],
  [/redness|red |irritat|sensitive|rosacea/i, "redness"],
  [/dull|glow|tan|hyperpigment|dark mark|uneven|brighten/i, "dullness"],
  [/oil|shine|pore|sebum|greasy/i, "oiliness"],
  [/dry|flak|tight|dehydrat/i, "dryness"],
  [/eye|circle|puff|bag/i, "dark-circles"],
];

const SKIN_TYPE_TO_PROTOCOL: Record<string, string> = {
  oily: "oiliness",
  dry: "dryness",
  sensitive: "redness",
  combination: "oiliness",
  normal: "dullness",
  unknown: "dullness",
};

export function matchSkinProtocols(
  quiz: QuizAnswers,
  measurements: FaceMeasurements | null
): SkinProtocol[] {
  const all = getSkinProtocols();
  const ids: string[] = [];
  const push = (id: string) => {
    if (!ids.includes(id) && all.some((p) => p.id === id)) ids.push(id);
  };

  const haystack = [...quiz.skinConcerns, ...quiz.focus, ...quiz.goals].join(" ");
  for (const [re, id] of CONCERN_TO_PROTOCOL) {
    if (re.test(haystack)) push(id);
  }
  push(SKIN_TYPE_TO_PROTOCOL[quiz.skinType] ?? "dullness");

  if (measurements) {
    if (measurements.skin.blemishCount > 5) push("acne");
    if (measurements.skin.redness > 60) push("redness");
    if (measurements.skin.texture > 60) push("dullness");
    if (measurements.skin.underEye > 60) push("dark-circles");
  }

  return ids
    .slice(0, 3)
    .map((id) => all.find((p) => p.id === id))
    .filter((p): p is SkinProtocol => p !== undefined);
}

export interface MatchedFinding {
  finding: MetricFinding;
  actions: MetricAction[];
}

export function matchMetricFindings(
  measurements: FaceMeasurements | null,
  quiz: QuizAnswers
): MatchedFinding[] {
  const all = getMetricFindings();
  const byMetric = (m: string) => all.find((f) => f.metric === m);
  const matched: MatchedFinding[] = [];
  const add = (metric: string) => {
    const f = byMetric(metric);
    if (f && !matched.some((m) => m.finding.metric === metric)) {
      matched.push({ finding: f, actions: f.actions });
    }
  };

  if (measurements) {
    if (measurements.skin.redness > 60) add("skinRedness");
    if (measurements.skin.texture > 60) add("skinTexture");
    if (measurements.skin.underEye > 60) add("underEye");
    const thirds = [
      measurements.facialThirds.upper,
      measurements.facialThirds.mid,
      measurements.facialThirds.lower,
    ];
    if (thirds.some((t) => Math.abs(t - 1 / 3) > 0.06)) add("thirdsBalance");
    if (measurements.symmetryScore < 75) add("symmetry");
    if (measurements.jawToCheekbone < 0.9) add("jawToCheekbone");
  }

  const bf = estimateBodyFatPct(quiz);
  const bfThreshold = quiz.gender === "female" ? 28 : 20;
  if (bf !== null && bf > bfThreshold) add("bodyFat");

  if (quiz.sleepHours === "<6" || quiz.sleepHours === "6-7") add("sleep");
  if (quiz.dietQuality === "poor") add("diet");

  return matched;
}

export function matchBodyProtocol(quiz: QuizAnswers): BodyProtocol {
  const all = getBodyProtocols();
  const id = quiz.bodyGoal === "cut" || quiz.bodyGoal === "build" ? quiz.bodyGoal : "maintain";
  return all.find((p) => p.id === id) ?? all[1];
}

export function matchFaceShape(measurements: FaceMeasurements | null): FaceShapeEntry | null {
  if (!measurements || measurements.faceShape === "unknown") return null;
  return getFaceShapes().find((s) => s.id === measurements.faceShape) ?? null;
}

// ---------- Body math (estimates, clearly labeled) ----------

function ageMidpoint(ageRange: QuizAnswers["ageRange"]): number {
  switch (ageRange) {
    case "18-24":
      return 21;
    case "25-34":
      return 30;
    case "35-44":
      return 40;
    default:
      return 50;
  }
}

function activityMultiplier(exerciseFreq: string): number {
  if (exerciseFreq === "5+x") return 1.725;
  if (exerciseFreq === "3-4x") return 1.55;
  if (exerciseFreq === "1-2x") return 1.375;
  return 1.2;
}

/** Estimated TDEE via Mifflin-St Jeor. Returns null when height/weight are missing. */
export function estimateTdee(quiz: QuizAnswers): number | null {
  if (!quiz.heightCm || !quiz.weightKg) return null;
  const age = ageMidpoint(quiz.ageRange);
  const bmr =
    10 * quiz.weightKg +
    6.25 * quiz.heightCm -
    5 * age +
    (quiz.gender === "male" ? 5 : -161);
  return Math.round(bmr * activityMultiplier(quiz.exerciseFreq));
}

/**
 * Estimated body-fat %: US Navy method for males when waist+neck+height are
 * present, otherwise the Deurenberg BMI-based estimate. Returns null when the
 * inputs are missing.
 */
export function estimateBodyFatPct(quiz: QuizAnswers): number | null {
  if (!quiz.heightCm || !quiz.weightKg) return null;
  if (
    quiz.gender === "male" &&
    quiz.waistCm &&
    quiz.neckCm &&
    quiz.waistCm > quiz.neckCm
  ) {
    const log10 = (x: number) => Math.log10(x);
    const density =
      1.0324 -
      0.19077 * log10(quiz.waistCm - quiz.neckCm) +
      0.15456 * log10(quiz.heightCm);
    return Math.round((495 / density - 450) * 10) / 10;
  }
  const bmi = quiz.weightKg / Math.pow(quiz.heightCm / 100, 2);
  const bf =
    1.2 * bmi + 0.23 * ageMidpoint(quiz.ageRange) - (quiz.gender === "male" ? 10.8 : 0) - 5.4;
  return Math.round(bf * 10) / 10;
}

// ---------- Stub plan builder (SAFE items only — no RX mentions) ----------

function headlineFor(quiz: QuizAnswers): string {
  const bits = [...quiz.focus, ...quiz.goals]
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 2);
  const pretty = bits
    .map((b) => b.charAt(0).toUpperCase() + b.slice(1))
    .join(" and ");
  return pretty
    ? `Your Phase 1 Mewmax Protocol: ${pretty}`
    : "Your Phase 1 Mewmax Protocol";
}

function scoreSummaryFor(
  measurements: FaceMeasurements | null,
  quiz: QuizAnswers
): string {
  if (measurements && measurements.landmarksDetected) {
    const parts = [
      `Your scan scored ${measurements.overallScore}/100 overall.`,
      `Symmetry ${measurements.symmetryScore}/100, skin redness ${measurements.skin.redness}/100, texture ${measurements.skin.texture}/100, under-eye darkness ${measurements.skin.underEye}/100.`,
      `Facial thirds are ${[
        measurements.facialThirds.upper,
        measurements.facialThirds.mid,
        measurements.facialThirds.lower,
      ]
        .map((t) => Math.round(t * 100))
        .join(" / ")} (target: 33 / 33 / 33).`,
    ];
    if (measurements.faceShape !== "unknown") {
      parts.push(`Detected face shape: ${measurements.faceShape}.`);
    }
    parts.push(
      "Scores are anchored to your measurements, so the same photo always gives the same score."
    );
    return parts.join(" ");
  }
  const tdee = estimateTdee(quiz);
  const base = `No scan data was provided, so this plan is built from your quiz: ${quiz.ageRange}, ${quiz.skinType} skin, ${quiz.bodyGoal} body goal, ${quiz.sleepHours} hours of sleep, ${quiz.dietQuality} diet quality.`;
  return tdee
    ? `${base} Estimated daily energy expenditure: ~${tdee} kcal.`
    : base;
}

/** Rank of the earliest goalRanking goal mentioned in the text (0-based), or 99. */
function goalRankOf(text: string, quiz: QuizAnswers): number {
  const hay = text.toLowerCase();
  for (let i = 0; i < quiz.goalRanking.length; i++) {
    const words = quiz.goalRanking[i]
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter((w) => w.length > 3);
    if (words.some((w) => hay.includes(w))) return i;
  }
  return 99;
}

function priorityFixesFor(
  measurements: FaceMeasurements | null,
  quiz: QuizAnswers
): PriorityFix[] {
  const matched = matchMetricFindings(measurements, quiz);
  const scored: Array<{ action: MetricAction; finding: string }> = [];
  for (const m of matched) {
    for (const a of m.actions) scored.push({ action: a, finding: m.finding.finding });
  }
  // Guarantee a useful set even with sparse input: sleep and diet always apply.
  const fallback: Array<{ action: MetricAction; finding: string }> = [];
  const all = getMetricFindings();
  if (!matched.some((m) => m.finding.metric === "sleep")) {
    const f = all.find((x) => x.metric === "sleep");
    if (f) for (const a of f.actions.slice(0, 2)) fallback.push({ action: a, finding: f.finding });
  }
  if (!matched.some((m) => m.finding.metric === "diet")) {
    const f = all.find((x) => x.metric === "diet");
    if (f) for (const a of f.actions.slice(0, 1)) fallback.push({ action: a, finding: f.finding });
  }
  // Order by ranked goals first (goal #1's fixes lead), then impact × effort.
  const pool = [...scored, ...fallback]
    .map((item) => ({
      ...item,
      goalRank: goalRankOf(`${item.action.title} ${item.finding}`, quiz),
    }))
    .sort(
      (x, y) =>
        x.goalRank - y.goalRank || actionScore(y.action) - actionScore(x.action)
    );
  const seen = new Set<string>();
  const top: PriorityFix[] = [];
  for (const item of pool) {
    if (seen.has(item.action.title)) continue;
    seen.add(item.action.title);
    top.push({
      title: item.action.title,
      why: `${item.finding} ${item.action.detail}`,
      impact: item.action.impact,
      effort: item.action.effort,
    });
    if (top.length === 4) break;
  }
  return top;
}

// Every task cites its trigger via whyYou (personalization spec guardrail 1).
function task(
  title: string,
  detail: string,
  frequency: string,
  whyYou: string
): PlanTask {
  return { title, detail, frequency, whyYou };
}

/**
 * A task carrying a mewing/debloat method (Zayne 2026-10-25): full
 * detail for premium plans only. truncateForFree locks it for free
 * users even inside the free allowance, so free users see the
 * title + frequency as a teaser and premium users get the method.
 * The AI plan path grounds premium sections in these same methods
 * via the excerpts block in getRelevantKbExcerpts.
 */
function proTask(
  title: string,
  detail: string,
  frequency: string,
  whyYou: string
): PlanTask {
  return { title, detail, frequency, whyYou, proOnly: true };
}

function week(weekNo: number, focus: string, tasks: PlanTask[]): PlanWeek {
  return { week: weekNo, focus, tasks };
}

// ---------- Input signals + decision rules (personalization spec) ----------

interface SkinSignals {
  redness: number;
  texture: number;
  blemishes: number;
  underEye: number;
}

function skinSignals(m: FaceMeasurements | null): SkinSignals {
  const s = m?.skin;
  return {
    redness: s?.redness ?? 0,
    texture: s?.texture ?? 0,
    blemishes: s?.blemishCount ?? 0,
    underEye: s?.underEye ?? 0,
  };
}

function goalAt(quiz: QuizAnswers, i: number): string {
  return (quiz.goalRanking[i] ?? "").trim().toLowerCase();
}

type LeadProtocol =
  | "redness"
  | "acne"
  | "hyperpig"
  | "drydull"
  | "advanced"
  | "general";

/** The founder's decision matrix: scan + quiz signals → which protocol leads. */
function leadProtocol(s: SkinSignals, quiz: QuizAnswers): LeadProtocol {
  const topGoals = [goalAt(quiz, 0), goalAt(quiz, 1), goalAt(quiz, 2)].join(" ");
  if (s.redness >= 60) return "redness"; // barrier repair first, no strong actives
  if (
    s.blemishes >= 6 &&
    (quiz.skinType === "oily" || quiz.skinType === "combination")
  )
    return "acne";
  if (
    /de-?tan|\btan\b|hyperpigment|dark ?mark|uneven|even ?tone|brighten|pigment/.test(
      topGoals
    )
  )
    return "hyperpig";
  if (quiz.skinType === "dry" || (s.texture >= 60 && quiz.skinType !== "oily"))
    return "drydull";
  if (quiz.routineLevel === "advanced") return "advanced";
  return "general";
}

// ---------- whyYou trigger builders ----------

const whyScanRedness = (s: SkinSignals) =>
  `because your scan showed elevated redness (${s.redness}/100)`;
const whyScanBlemishes = (s: SkinSignals) =>
  `because your scan showed elevated blemish activity (${s.blemishes} active blemishes)`;
const whyScanTexture = (s: SkinSignals) =>
  `because your scan showed rougher texture (${s.texture}/100)`;
const whyGoalRank = (quiz: QuizAnswers, i: number) => {
  const g = (quiz.goalRanking[i] ?? "").trim();
  return g
    ? `because you ranked ${g} as your #${i + 1} goal`
    : "because it's one of your top goals";
};
const whyGoal1 = (quiz: QuizAnswers) => whyGoalRank(quiz, 0);
const whyRoutine = (quiz: QuizAnswers) =>
  `because your routine level is '${quiz.routineLevel}'`;
const whySkinType = (quiz: QuizAnswers) =>
  `because your skin type is ${quiz.skinType}`;
const whySun = (quiz: QuizAnswers) => {
  if (quiz.sunExposure === "outdoor")
    return "because you're outdoors most of the day";
  if (quiz.sunExposure === "mixed")
    return "because you get mixed indoor/outdoor sun exposure";
  return "because UV hits skin even indoors near windows";
};
const whySleep = (quiz: QuizAnswers) =>
  `because you sleep ${quiz.sleepHours} hours a night`;
const whyDietQ = (quiz: QuizAnswers) =>
  `because your diet quality is currently "${quiz.dietQuality}"`;
const whyExercise = (quiz: QuizAnswers) =>
  `because you currently train "${quiz.exerciseFreq}"`;
const whyBodyGoal = (quiz: QuizAnswers) =>
  `because your body goal is '${quiz.bodyGoal}'`;

function budgetLine(quiz: QuizAnswers): string {
  switch (quiz.budgetTier) {
    case "budget":
      return "You picked the budget tier, so this plan sticks to simple single-purpose product types (a basic cleanser, one moisturizer, one sunscreen) — they do the same work as expensive versions.";
    case "premium":
      return "You picked the premium tier, so you can use more refined product types (layered serum textures, richer formulas, mineral filters) — order and consistency still matter more than price.";
    default:
      return "You picked the mid tier, so this uses solid everyday product types — one good version of each step beats three fancy ones.";
  }
}

/** Skin section driven by the founder's decision matrix. Each protocol emits
 *  tasks whose whyYou cites the exact scan/quiz signal that triggered them. */
function buildSkinSection(
  quiz: QuizAnswers,
  measurements: FaceMeasurements | null,
  protocols: SkinProtocol[]
): PlanSection {
  const s = skinSignals(measurements);
  const mode = leadProtocol(s, quiz);
  // routineLevel "none" → 3-step starter weeks 1-2 before ANY active.
  const starter = quiz.routineLevel === "none" && mode !== "redness";
  switch (mode) {
    case "redness":
      return rednessSkinSection(quiz, s);
    case "acne":
      return acneSkinSection(quiz, s, starter);
    case "hyperpig":
      return hyperpigSkinSection(quiz, s, starter);
    case "drydull":
      return dryDullSkinSection(quiz, s, starter);
    case "advanced":
      return advancedSkinSection(quiz, s);
    default:
      return generalSkinSection(quiz, protocols);
  }
}

/** Redness high → barrier repair first 2 weeks; no strong actives until then. */
function rednessSkinSection(quiz: QuizAnswers, s: SkinSignals): PlanSection {
  return {
    id: "skin",
    title: "Skin",
    summary:
      "A 4-week barrier-repair routine: panthenol serum and ceramide moisturizer, gentle cleansing, mineral SPF 50 — actives only enter in week 3 once redness settles.",
    whyForYou: `${whyScanRedness(s)} — the barrier is compromised, so the first two weeks are repair-only: panthenol and ceramide, gentle cleansing, mineral SPF. No strong actives until the redness settles. ${budgetLine(quiz)}`,
    weeks: [
      week(1, "Repair the barrier first", [
        task(
          "Morning: gentle cleanse, panthenol serum, barrier moisturizer",
          "Lukewarm water, a fragrance-free gentle cleanser for 30 seconds, then a panthenol (vitamin B5) serum patted on, sealed with a ceramide-rich moisturizer.",
          "daily",
          `${whyScanRedness(s)} — panthenol and ceramide rebuild the barrier instead of attacking it.`
        ),
        task(
          "Mineral SPF 50 every morning",
          "Two finger-lengths of mineral sunscreen for face, ears, and neck. Mineral filters sit on top of reactive skin instead of sinking in like chemical filters.",
          "daily",
          `${whyScanRedness(s)} — chemical filters can sting reactive skin; ${whySun(quiz)}.`
        ),
        task(
          "No strong actives for two weeks",
          "No brightening treatments, no exfoliating acids, and no vitamin-A products until week 3. Actives on a broken barrier make redness worse, not better.",
          "daily",
          `${whyScanRedness(s)} — strong actives are paused while the barrier recovers.`
        ),
      ]),
      week(2, "Keep calming and watch for settling", [
        task(
          "Repeat the barrier routine",
          "Same gentle cleanse, panthenol serum, ceramide moisturizer, mineral SPF. Boring is the point.",
          "daily",
          `${whyScanRedness(s)} — the barrier needs repetition, not novelty.`
        ),
        task(
          "Cool-down after heat or sun",
          "A cold damp cloth or aloe gel for a few minutes after sun, workouts, or hot showers to bring the flush down.",
          "as needed",
          `${whyScanRedness(s)} — heat is a flare trigger; aloe calms without actives.`
        ),
        task(
          "Track redness settling",
          "Take a photo in the same light and compare to week 1. If the flush is clearly calmer, the barrier is recovering.",
          "once",
          `${whyScanRedness(s)} — we move to actives only once the barrier shows it.`
        ),
      ]),
      week(3, "Introduce azelaic acid gently", [
        task(
          "Azelaic acid 2 evenings per week",
          "A pea-sized amount of azelaic acid on clean dry skin at night, moisturizer on top. It calms redness and fades marks without the harshness of stronger acids.",
          "2x/week",
          `${whyScanRedness(s)} is settling — azelaic acid is the first active reactive skin usually tolerates.`
        ),
        task(
          "Keep the morning barrier routine",
          "Gentle cleanse, panthenol serum, ceramide moisturizer, mineral SPF — this backbone never leaves.",
          "daily",
          `${whyScanRedness(s)} — the barrier routine is permanent; actives are the add-on.`
        ),
        task(
          "Watch for stinging",
          "Mild tingling the first nights is normal; persistent burning means drop back to the barrier routine for another week.",
          "daily",
          `${whyScanRedness(s)} — the barrier tells you when it's ready; listen to it.`
        ),
      ]),
      week(4, "Evaluate and continue", [
        task(
          "Compare week 1 vs week 4 redness",
          "Same light, same angle. Redness protocols typically show visible change in 4-6 weeks.",
          "once",
          `${whyScanRedness(s)} — judge against this baseline, not day to day.`
        ),
        task(
          "Keep the routine boring",
          "Stay on the same products for the full timeline before changing anything.",
          "daily",
          `${whyScanRedness(s)} — consistency is what repairs barriers.`
        ),
        task(
          "Add one brightening active only if fully calm",
          "If redness is clearly down, one gentle brightening active can join in month two — still never stacked with azelaic acid on the same night.",
          "once",
          `${whyScanRedness(s)} has settled — this is the green light for the next step, not before.`
        ),
      ]),
    ],
  };
}

/** Blemishes high + oily signals → acne protocol first; glow deferred to week 3+. */
function acneSkinSection(
  quiz: QuizAnswers,
  s: SkinSignals,
  starter: boolean
): PlanSection {
  const starterWeeks: PlanWeek[] = [
    week(1, "Your 3-step starter — nothing fancy yet", [
      task(
        "Morning: gentle gel cleanser → lightweight gel moisturizer → sunscreen",
        "Lukewarm water, a gentle gel cleanser for 30 seconds, a thin layer of lightweight gel moisturizer, then SPF 50+ sunscreen (two finger-lengths for face, ears, neck).",
        "daily",
        `${whyRoutine(quiz)} — you start with just cleanse, moisturize, and protect for two weeks before any active is introduced.`
      ),
      task(
        "Night: gel cleanser → gel moisturizer",
        "Thorough gentle cleanse to remove sunscreen and the day's oil, then the gel moisturizer. No actives yet.",
        "daily",
        `${whyRoutine(quiz)} — consistency on the basics is the whole treatment for the first two weeks.`
      ),
      task(
        "Reapply sunscreen when outdoors",
        "Reapply every 2-3 hours in direct sun; add a cap in midday sun. UV darkens post-acne marks.",
        "daily",
        `${whyScanBlemishes(s)} — and ${whySun(quiz)}, so reapplication discipline stops marks from darkening.`
      ),
    ]),
    week(2, "Lock in the habit", [
      task(
        "Repeat the 3 steps without changes",
        "Same cleanser, same moisturizer, same sunscreen. Do not add products yet.",
        "daily",
        `${whyRoutine(quiz)} — two full weeks of basics before the first active.`
      ),
      task(
        "Wash pillowcases twice this week",
        "Fresh pillowcases reduce the bacteria load against breakout-prone skin.",
        "2x/week",
        `${whyScanBlemishes(s)} — fabric bacteria is a quiet breakout driver.`
      ),
      task(
        "No picking or squeezing",
        "Picking turns a 3-day spot into a 3-week mark. Ice a painful spot for a minute instead.",
        "daily",
        `${whyScanBlemishes(s)} — hands off is a treatment.`
      ),
    ]),
  ];

  const activeWeeks: PlanWeek[] = [
    week(starter ? 3 : 1, "Introduce your acne active", [
      task(
        "Salicylic acid (BHA) cleanser 3 evenings per week",
        "Use a salicylic acid cleanser on Monday, Wednesday, and Friday nights instead of your regular cleanser. BHA gets inside oily pores and clears congestion.",
        "3x/week",
        `${whyScanBlemishes(s)} and ${whySkinType(quiz)} — salicylic acid is the workhorse for oily, blemish-prone skin${starter ? ", introduced now that your basics are solid" : ", and your routine level can handle it from week 1"}.`
      ),
      task(
        "Benzoyl peroxide spot treatment on active spots",
        "A dot of benzoyl peroxide spot treatment on inflamed spots at night only — never all over the face.",
        "as needed",
        `${whyScanBlemishes(s)} — targeted treatment shrinks inflamed spots faster.`
      ),
      task(
        "Keep the gel moisturizer and sunscreen unchanged",
        "Lightweight gel moisturizer and SPF 50+ stay exactly as before — actives only work when the basics hold.",
        "daily",
        `${whyScanBlemishes(s)} — the basics are still the foundation; actives are the add-on.`
      ),
    ]),
    week(starter ? 4 : 2, "Assess and keep going", [
      task(
        "Clay mask 1x/week for congestion",
        "A clay mask on the T-zone once a week pulls out excess oil and congestion.",
        "1x/week",
        `${whySkinType(quiz)} and ${whyScanBlemishes(s)} — weekly oil control on top of the daily routine.`
      ),
      task(
        "Compare week 1 vs week 4 photos",
        "Same light, same angle. Acne protocols typically show visible change in 6-8 weeks.",
        "once",
        `${whyScanBlemishes(s)} — judge against this baseline.`
      ),
      task(
        "Defer glow steps to next month",
        "Hold off on brightening treatments until breakouts clearly calm — calming acne is the priority.",
        "once",
        `${whyScanBlemishes(s)} — glow steps wait until breakouts calm because the acne protocol comes first.`
      ),
    ]),
  ];

  const nonStarterEarly: PlanWeek[] = starter
    ? []
    : [
        week(1, "Lock the basics and start the active", [
          task(
            "Morning: gel cleanser → gel moisturizer → sunscreen",
            "Gentle gel cleanser 30 seconds, lightweight gel moisturizer, SPF 50+ sunscreen (two finger-lengths for face, ears, neck).",
            "daily",
            `${whyScanBlemishes(s)} and ${whySkinType(quiz)} — the non-negotiable base for oily, blemish-prone skin.`
          ),
          task(
            "Salicylic acid (BHA) cleanser 3 evenings per week",
            "Use the salicylic acid cleanser Monday, Wednesday, Friday nights instead of your regular cleanser.",
            "3x/week",
            `${whyScanBlemishes(s)} and ${whySkinType(quiz)} — ${whyRoutine(quiz)}, so the active starts in week 1.`
          ),
          task(
            "Wash pillowcases twice this week",
            "Fresh pillowcases reduce the bacteria load against breakout-prone skin.",
            "2x/week",
            `${whyScanBlemishes(s)} — fabric bacteria is a quiet breakout driver.`
          ),
        ]),
        week(2, "Add the spot treatment", [
          task(
            "Benzoyl peroxide spot treatment on active spots",
            "A dot of benzoyl peroxide spot treatment on inflamed spots at night only — never all over the face.",
            "as needed",
            `${whyScanBlemishes(s)} — targeted treatment shrinks inflamed spots faster.`
          ),
          task(
            "Keep the AM/PM routine strict",
            "Same cleanser, gel moisturizer, sunscreen every day. Strict consistency is the acne protocol.",
            "daily",
            `${whyScanBlemishes(s)} — the acne protocol runs on consistency, not product count.`
          ),
          task(
            "No picking or squeezing",
            "Picking turns a 3-day spot into a 3-week mark. Ice a painful spot for a minute instead.",
            "daily",
            `${whyScanBlemishes(s)} — hands off is a treatment.`
          ),
        ]),
      ];

  const weeks = starter
    ? [...starterWeeks, ...activeWeeks]
    : [...nonStarterEarly, ...activeWeeks];

  return {
    id: "skin",
    title: "Skin",
    summary:
      "A 4-week acne protocol: strict AM/PM consistency, salicylic acid, lightweight gel moisturizer, SPF 50+ — glow steps deferred until breakouts calm.",
    whyForYou: `${whyScanBlemishes(s)} and ${whySkinType(quiz)} — the plan leads with the acne protocol: strict AM/PM consistency, salicylic acid, and a lightweight gel moisturizer that won't clog. Glow steps are deferred until breakouts calm. ${budgetLine(quiz)}`,
    weeks,
  };
}

/** Hyperpigmentation ranked top → vitamin C + azelaic/kojic + SPF 50+ PA++++. */
function hyperpigSkinSection(
  quiz: QuizAnswers,
  s: SkinSignals,
  starter: boolean
): PlanSection {
  const coreWeeks: PlanWeek[] = [
    week(starter ? 3 : 1, "Sun discipline first — the headline habit", [
      task(
        "Vitamin C serum (10-15%) every morning",
        "2-3 drops of vitamin C serum on clean dry skin, then moisturizer, then sunscreen. Vitamin C fades tan and dark marks and boosts your sunscreen.",
        "daily",
        `${whyGoal1(quiz)} — vitamin C is the lead brightening active for your top goal.`
      ),
      task(
        "SPF 50+ PA++++ with reapplication discipline",
        "Two finger-lengths of SPF 50+ PA++++ sunscreen for face, ears, and neck every morning. This is the headline habit of your whole plan.",
        "daily",
        `${whyGoal1(quiz)} — and ${whySun(quiz)}, so sunscreen is what stops new tanning; the brighteners only work on top of it.`
      ),
      task(
        "Reapply every 2-3 hours outdoors",
        "Keep the sunscreen in your bag. Reapplication is the difference between fading and re-tanning.",
        "daily",
        `${whyGoal1(quiz)} — ${whySun(quiz)}, so this is non-negotiable.`
      ),
    ]),
    week(starter ? 4 : 2, "Add the evening brightening pair", [
      task(
        "Azelaic acid on alternate evenings",
        "A pea-sized amount of azelaic acid on clean dry skin at night, moisturizer on top. It fades dark marks and is gentle enough for regular use.",
        "3x/week",
        `${whyGoal1(quiz)} — your second brightening active joins once the sun habit is locked.`
      ),
      task(
        "Kojic acid serum 2 evenings per week",
        "On the evenings you skip azelaic acid, use a kojic acid serum — it blocks the enzyme that makes melanin.",
        "2x/week",
        `${whyGoal1(quiz)} — kojic acid targets the tan at its source.`
      ),
      task(
        "Keep mornings unchanged",
        "Vitamin C + moisturizer + SPF every morning — the evening actives layer on top of the sun habit, not instead of it.",
        "daily",
        `${whyGoal1(quiz)} — the morning trio is permanent.`
      ),
    ]),
  ];

  const fullWeeks: PlanWeek[] = [
    ...coreWeeks,
    week(3, "Layer the tan-fading routine", [
      task(
        "Alpha arbutin on stubborn dark marks",
        "A dot of alpha arbutin serum on individual dark marks at night — it releases brightening power slowly and safely.",
        "daily",
        `${whyGoal1(quiz)} — arbutin is for the marks that fade slowest.`
      ),
      task(
        "Weekly brightening mask",
        "The haldi-besan-curd mask once this week (1 tsp turmeric, 2 tbsp gram flour, 1-2 tbsp curd; 10-15 minutes, then rinse). Patch-test first.",
        "1x/week",
        `${whyGoal1(quiz)} — a traditional brightening mask supports the actives.`
      ),
      task(
        "Track sun triggers",
        "Note which days you got the most sun against how your tan looks — remove the biggest exposure.",
        "daily",
        `${whyGoal1(quiz)} — what gets measured gets managed.`
      ),
    ]),
    week(4, "Evaluate the fade", [
      task(
        "Compare week 1 vs week 4 photos",
        "Same light, same angle. De-tan protocols typically show visible change in 6-8 weeks with strict sun discipline.",
        "once",
        `${whyGoal1(quiz)} — judge the fade against this baseline.`
      ),
      task(
        "Keep vitamin C + SPF as the forever pair",
        "These two never leave your routine — they are the engine of the whole protocol.",
        "daily",
        `${whyGoal1(quiz)} — the headline habits become permanent.`
      ),
      task(
        "Never stack all three brighteners in one night",
        "Azelaic acid, kojic acid, and arbutin rotate — more is not better; irritation darkens skin.",
        "daily",
        `${whyGoal1(quiz)} — overdoing brighteners backfires into more pigmentation.`
      ),
    ]),
  ];

  const starterLead: PlanWeek[] = starter
    ? [
        week(1, "Your 3-step starter — nothing fancy yet", [
          task(
            "Morning: gentle cleanser → moisturizer → sunscreen",
            "Lukewarm water, a gentle cleanser for 30 seconds, a light moisturizer, then SPF 50+ PA++++ sunscreen (two finger-lengths for face, ears, neck).",
            "daily",
            `${whyRoutine(quiz)} — you start with just cleanse, moisturize, and protect for two weeks before any brightening active.`
          ),
          task(
            "Night: cleanser → moisturizer",
            "Thorough gentle cleanse, then moisturizer. No actives yet.",
            "daily",
            `${whyRoutine(quiz)} — the basics must hold before brighteners join.`
          ),
          task(
            "Reapply sunscreen when outdoors",
            "Reapply every 2-3 hours in direct sun. This habit starts now because it's the whole de-tan game.",
            "daily",
            `${whyGoal1(quiz)} — ${whySun(quiz)}, so reapplication starts from day one.`
          ),
        ]),
        week(2, "Lock in the habit", [
          task(
            "Repeat the 3 steps without changes",
            "Same cleanser, same moisturizer, same sunscreen. Do not add products yet.",
            "daily",
            `${whyRoutine(quiz)} — two full weeks of basics before the first brightening active.`
          ),
          task(
            "Wash pillowcases twice this week",
            "Fresh pillowcases keep the routine clean.",
            "2x/week",
            `${whyGoal1(quiz)} — small hygiene wins compound into clearer, brighter skin.`
          ),
          task(
            "Audit your current products",
            "Remove anything harsh or heavily fragranced — brightening actives need a calm base.",
            "once",
            `${whyGoal1(quiz)} — the actives coming in week 3 need a calm base.`
          ),
        ]),
      ]
    : [];

  return {
    id: "skin",
    title: "Skin",
    summary:
      "A 4-week de-tan protocol: vitamin C every morning, azelaic and kojic acids in the evening, SPF 50+ PA++++ with reapplication discipline as the headline habit.",
    whyForYou: `${whyGoal1(quiz)} — the plan leads with the de-tan protocol: vitamin C every morning, azelaic and kojic acids in the evening, and SPF 50+ PA++++ with reapplication discipline as the headline habit, because UV is what keeps tan and dark marks from fading. ${budgetLine(quiz)}`,
    weeks: [...starterLead, ...fullWeeks],
  };
}

/** Dry + dull → hydration layering, richer moisturizer, exfoliation 1x/week max. */
function dryDullSkinSection(
  quiz: QuizAnswers,
  s: SkinSignals,
  starter: boolean
): PlanSection {
  const leadWeeks: PlanWeek[] = starter
    ? [
        week(1, "Your 3-step starter — nothing fancy yet", [
          task(
            "Morning: gentle cleanser → cream moisturizer → sunscreen",
            "Lukewarm water, a gentle non-foaming cleanser for 30 seconds, a ceramide-rich cream moisturizer, then SPF 50+ sunscreen (two finger-lengths for face, ears, neck).",
            "daily",
            `${whyRoutine(quiz)} — you start with just cleanse, moisturize, and protect for two weeks before any active.`
          ),
          task(
            "Night: cleanser → cream moisturizer",
            "Gentle cleanse, then the cream moisturizer on slightly damp skin. No actives yet.",
            "daily",
            `${whyRoutine(quiz)} — hydration basics first; dry skin needs the foundation before anything else.`
          ),
          task(
            "Drink water steadily through the day",
            "Keep a bottle visible and sip all day.",
            "daily",
            `${whySkinType(quiz)} — internal hydration supports the routine from the inside.`
          ),
        ]),
        week(2, "Lock in the habit", [
          task(
            "Repeat the 3 steps without changes",
            "Same cleanser, same cream moisturizer, same sunscreen. Do not add products yet.",
            "daily",
            `${whyRoutine(quiz)} — two full weeks of basics before hydration layering begins.`
          ),
          task(
            "Wash pillowcases twice this week",
            "Fresh pillowcases keep the routine clean.",
            "2x/week",
            `${whySkinType(quiz)} — small hygiene wins compound.`
          ),
          task(
            "Switch to lukewarm water only",
            "Hot water strips the oils dry skin can't afford to lose.",
            "daily",
            `${whySkinType(quiz)} — hot water is a dryness multiplier.`
          ),
        ]),
      ]
    : [];

  return {
    id: "skin",
    title: "Skin",
    summary:
      "A 4-week hydration protocol: hyaluronic acid serum on damp skin, ceramide-rich cream moisturizer, vitamin C for glow, and gentle exfoliation capped at once a week.",
    whyForYou: `${whySkinType(quiz)} and ${whyScanTexture(s)} — the plan leads with hydration layering: hyaluronic acid serum on damp skin, a ceramide-rich cream moisturizer, and gentle exfoliation capped at once a week, because dry skin can't glow when it's thirsty. ${budgetLine(quiz)}`,
    weeks: [
      ...leadWeeks,
      week(starter ? 3 : 1, "Hydration layering basics", [
        task(
          "Hyaluronic acid serum on damp skin",
          "After cleansing, while skin is still damp, press in a hyaluronic acid serum — it pulls water into the skin.",
          "daily",
          `${whySkinType(quiz)} and ${whyScanTexture(s)} — hydration first, because dry skin can't glow when it's thirsty.`
        ),
        task(
          "Ceramide-rich cream moisturizer with glycerin",
          "Seal the serum with a richer cream moisturizer containing ceramides and glycerin — the seal is what keeps the water in.",
          "daily",
          `${whySkinType(quiz)} — a richer cream is the fix for tight, dry skin.`
        ),
        task(
          "SPF 50 every morning",
          "Two finger-lengths for face, ears, and neck. UV dries and dulls on top of everything else.",
          "daily",
          `${whySun(quiz)} — sunscreen protects the hydration work.`
        ),
      ]),
      week(starter ? 4 : 2, "Gentle glow introduction", [
        task(
          "Vitamin C serum in the AM for brightness",
          "2-3 drops of vitamin C serum under your moisturizer in the morning.",
          "daily",
          `${whyGoal1(quiz)} — vitamin C adds the glow on top of the hydration base.`
        ),
        task(
          "Lactic acid exfoliant — 1x/week maximum",
          "A lactic acid (a gentle AHA) exfoliant one evening per week on clean dry skin — dry skin gets a strict ceiling, not a schedule.",
          "1x/week",
          `${whyScanTexture(s)} — exfoliation smooths texture, but dry skin gets 1x/week max to protect the barrier.`
        ),
        task(
          "Overnight hydrating mask 1x/week",
          "A hydrating sleeping mask instead of your night cream once this week — an extra drink of water for the skin.",
          "1x/week",
          `${whySkinType(quiz)} — deep hydration nights for dry skin.`
        ),
      ]),
      week(3, "Deep hydration", [
        task(
          "Keep the hydration sandwich",
          "Damp skin → hyaluronic acid serum → cream moisturizer, every morning and night.",
          "daily",
          `${whySkinType(quiz)} — the sandwich is the whole strategy.`
        ),
        task(
          "Drink water steadily through the day",
          "Keep a bottle visible and sip all day — hydration layering works from both sides.",
          "daily",
          `${whySkinType(quiz)} — internal hydration supports the routine.`
        ),
        task(
          "Keep exfoliation at the 1x/week ceiling",
          "Do not increase exfoliation even if skin feels smooth — the ceiling protects the barrier.",
          "1x/week",
          `${whySkinType(quiz)} — the 1x/week max is a hard rule for dry skin.`
        ),
      ]),
      week(4, "Evaluate the glow", [
        task(
          "Compare week 1 vs week 4 photos",
          "Same light, same angle. Hydration changes show in 2-4 weeks.",
          "once",
          `${whyScanTexture(s)} — judge the glow against this baseline.`
        ),
        task(
          "Keep the hydration sandwich permanent",
          "Damp skin → hyaluronic acid serum → cream moisturizer — this order never changes.",
          "daily",
          `${whySkinType(quiz)} — the sandwich is the long-term system.`
        ),
        task(
          "Stay boring with actives",
          "Vitamin C stays; nothing stronger joins without a reason.",
          "daily",
          `${whySkinType(quiz)} — dry skin rewards restraint.`
        ),
      ]),
    ],
  };
}

/** routineLevel "advanced" → actives with sequencing (vitamin C AM, retinol PM). */
function advancedSkinSection(quiz: QuizAnswers, s: SkinSignals): PlanSection {
  return {
    id: "skin",
    title: "Skin",
    summary:
      "A 4-week advanced protocol: vitamin C in the AM, retinol in the PM (never layered), niacinamide for tone, one AHA night per week.",
    whyForYou: `${whyRoutine(quiz)} — you get the full active sequencing protocol: vitamin C in the AM, retinol in the PM (never layered together), niacinamide for tone, and one AHA night per week. ${whyGoal1(quiz)}, so the plan is built for maintenance and steady glow. ${budgetLine(quiz)}`,
    weeks: [
      week(1, "Sequencing rules", [
        task(
          "Vitamin C serum every AM",
          "2-3 drops of vitamin C serum on clean dry skin every morning, then moisturizer, then SPF 50+ PA++++.",
          "daily",
          `${whyRoutine(quiz)} — your AM active is vitamin C, every morning without exception.`
        ),
        task(
          "Retinol (a vitamin-A retinoid) 2 PMs per week",
          "A pea-sized retinol serum on clean dry skin on two non-consecutive nights, moisturizer on top. Never on the same night as any acid.",
          "2x/week",
          `${whyRoutine(quiz)} — retinol is your PM active, introduced at 2x/week to build tolerance.`
        ),
        task(
          "Never layer vitamin C and retinol together",
          "AM active and PM active stay in their lanes — layering them causes irritation, not faster results.",
          "daily",
          `${whyRoutine(quiz)} — sequencing is what makes an advanced routine work instead of backfiring.`
        ),
      ]),
      week(2, "Add tone and texture", [
        task(
          "Niacinamide serum in the AM routine",
          "A niacinamide serum after vitamin C in the morning — it refines pores and evens tone.",
          "daily",
          `${whyRoutine(quiz)} — niacinamide layers safely under vitamin C for tone.`
        ),
        task(
          "Glycolic acid (AHA) exfoliant 1 PM per week",
          "One evening per week, a glycolic acid exfoliant instead of retinol — never both on the same night.",
          "1x/week",
          `${whyRoutine(quiz)} — one AHA night per week keeps texture smooth without overloading.`
        ),
        task(
          "SPF 50+ PA++++ daily — non-negotiable with actives",
          "Actives make skin more sun-sensitive; the sunscreen is part of the protocol, not optional.",
          "daily",
          `${whyRoutine(quiz)} — and ${whySun(quiz)}, so actives without sunscreen cause more damage than no actives.`
        ),
      ]),
      week(3, "Push and polish", [
        task(
          "Increase retinol to 3x/week if no irritation",
          "If skin is calm, add a third retinol night. If there's flaking, stay at 2x/week.",
          "3x/week",
          `${whyRoutine(quiz)} — progression is earned by tolerance, not scheduled.`
        ),
        proTask(
          "Morning debloat ritual",
          "Cold water splash or an ice cube in a thin cloth for 30-60 seconds, then 5 minutes of light gua sha strokes — centre of the face outward along jawline, cheekbones, and brow, then down the sides of the neck — after moisturizer. This moves temporary water only: visible for hours, not permanent.",
          "daily",
          `${whyGoal1(quiz)} — the morning debloat ritual adds visible sharpness for your maintenance goal.`
        ),
        proTask(
          "Sodium check at dinner, potassium in the day",
          "Restaurant food, sauces, and instant noodles load sodium that shows up as a puffy face by morning. Keep dinner sodium moderate, and get potassium in daily (banana, coconut water, yogurt, leafy greens) — it's the counterweight that keeps fluid balance level.",
          "daily",
          `${whyGoal1(quiz)} — less water held overnight means the debloat ritual starts ahead, not behind.`
        ),
        proTask(
          "Sleep head-up for a leaner morning face",
          "Sleep with your head slightly elevated (an extra pillow works) and protect the full night's sleep — lying flat pools fluid in the face, and a short night shows up as puff no morning ritual fully undoes.",
          "daily",
          `${whySleep(quiz)} — tonight's sleep position and length decide tomorrow morning's face.`
        ),
        task(
          "Audit: at most one active per evening",
          "Each PM gets exactly one: retinol OR glycolic acid OR nothing. Check the week before adding.",
          "1x/week",
          `${whyRoutine(quiz)} — the audit keeps an advanced routine from becoming an overloaded one.`
        ),
      ]),
      week(4, "Evaluate and sustain", [
        task(
          "Compare week 1 vs week 4 photos",
          "Same light, same angle.",
          "once",
          `${whyGoal1(quiz)} — judge the maintenance glow against this baseline.`
        ),
        task(
          "Keep the AM/PM sequence permanent",
          "Vitamin C mornings, retinol nights, niacinamide layered in — this is the long-term system.",
          "daily",
          `${whyRoutine(quiz)} — the sequence is the product.`
        ),
        task(
          "Re-scan for progress",
          "New scan numbers in month two show what the routine actually moved.",
          "once",
          `${whyGoal1(quiz)} — measured progress beats mirror guesses.`
        ),
      ]),
    ],
  };
}

/** Fallback for users who don't match a specific protocol — still input-driven. */
function generalSkinSection(
  quiz: QuizAnswers,
  protocols: SkinProtocol[]
): PlanSection {
  const primary = protocols[0];
  const primaryName = primary ? primary.name : "your skin";
  return {
    id: "skin",
    title: "Skin",
    summary: `A 4-week ${primaryName.toLowerCase()} routine: cleanse, vitamin C, moisturize, SPF 50+ PA++++ in the morning; cleanse, treatment, moisturize at night.`,
    whyForYou: `This routine targets ${primaryName.toLowerCase()} — matched from your quiz answers${quiz.skinConcerns.length ? ` (your concerns: ${quiz.skinConcerns.slice(0, 3).join(", ")})` : ""}. ${whyGoal1(quiz)}, so the plan is ordered around it. ${budgetLine(quiz)}`,
    weeks: [
      week(1, "Lock in the non-negotiable basics", [
        task(
          "Morning: cleanse, vitamin C, moisturize, sunscreen",
          "Gentle cleanser (30-60 seconds, lukewarm water), then 2-3 drops of vitamin C serum 10-15% on clean dry skin, a lightweight moisturizer if needed, then SPF 50+ PA++++ — two finger-lengths for face, ears, and neck.",
          "daily",
          `${whyGoal1(quiz)} — the morning trio is the base every protocol builds on; ${whySun(quiz)}.`
        ),
        task(
          "Night: cleanse and moisturize",
          "Thorough gentle cleanse to remove sunscreen and pollutants, then moisturizer. Double cleanse on sweaty or long outdoor days.",
          "daily",
          `${whySkinType(quiz)} — a clean, moisturized base is what lets treatments work.`
        ),
        task(
          "Reapply sunscreen outdoors",
          "Reapply every 2-3 hours when outdoors or near windows; add a cap or hat and sunglasses in midday sun.",
          "daily",
          `${whySun(quiz)} — UV is the top driver of dullness and tanning.`
        ),
      ]),
      week(2, "Introduce your treatment step", [
        task(
          "Add an evening treatment 3x/week",
          `Use the treatment your protocol calls for 3 evenings per week on clean, dry skin — start slowly and build up. ${primary ? `Avoid: ${primary.whatToAvoid.slice(0, 2).join("; ")}.` : ""}`,
          "3x/week",
          `${whyGoal1(quiz)} — the treatment targets your top goal directly.`
        ),
        task(
          "Wash pillowcases",
          "Fresh pillowcases twice this week — fabric bacteria worsens breakouts and congestion.",
          "2x/week",
          `${whySkinType(quiz)} — small hygiene wins compound.`
        ),
        task(
          "Morning depuff ritual",
          "Ice wrapped in a thin cloth for 30-60 seconds, then 5 minutes of light upward facial massage along jawline, cheekbones, and brow. Finish with moisturizer.",
          "daily",
          `${whyGoal1(quiz)} — depuffing sharpens the face for the day.`
        ),
      ]),
      week(3, "Refine and protect the barrier", [
        task(
          "Weekly brightening mask",
          "Do the haldi-besan-curd brightening mask once this week (1 tsp turmeric, 2 tbsp gram flour, 1-2 tbsp curd; 10-15 minutes, then rinse). Patch-test first; skip if skin is very sensitive.",
          "1x/week",
          `${whyGoal1(quiz)} — a weekly mask supports the routine's brightening work.`
        ),
        task(
          "Audit your routine",
          `Introduce at most one new product per week. ${primary ? `Your protocol warns against: ${primary.whatToAvoid.slice(0, 2).join("; ")}.` : ""}`,
          "once",
          `${whySkinType(quiz)} — restraint protects the barrier.`
        ),
        task(
          "Track triggers",
          "Note flare-ups against sleep, diet, heat, and stress for two weeks so you can remove the biggest trigger.",
          "daily",
          `${whySleep(quiz)} and ${whyDietQ(quiz)} — triggers hide in lifestyle.`
        ),
      ]),
      week(4, "Evaluate and sustain", [
        task(
          "Compare week 1 vs week 4",
          `Take photos in the same light and compare. ${primary ? `Visible change for ${primaryName.toLowerCase()} typically takes ${primary.timelineWeeks} weeks` : "Visible change typically takes 4-8 weeks"} — judge progress against the timeline, not day to day.`,
          "once",
          `${whyGoal1(quiz)} — judge against this baseline, not the mirror.`
        ),
        task(
          "Keep the routine boring",
          "The routine that works is the one you keep. Stay on the same products for the full timeline before changing anything.",
          "daily",
          `${whyGoal1(quiz)} — consistency is the treatment.`
        ),
        task(
          "Keep the guardrails",
          "Sunscreen daily, no picking or squeezing spots, lukewarm water only, and moisturizer even on oily days.",
          "daily",
          `${whySkinType(quiz)} — guardrails keep the routine safe long-term.`
        ),
      ]),
    ],
  };
}

function buildDietSection(
  quiz: QuizAnswers,
  protocol: BodyProtocol,
  foundations: SkinFoundations
): PlanSection {
  const tdee = estimateTdee(quiz);
  const targetLine = tdee
    ? `Your estimated energy expenditure is ~${tdee} kcal/day; the ${protocol.name.toLowerCase()} rule is ${protocol.calorieRule}.`
    : `The ${protocol.name.toLowerCase()} rule is ${protocol.calorieRule}.`;
  const proteinLine =
    quiz.weightKg != null
      ? (() => {
          const perKg =
            protocol.id === "cut" ? 2.1 : protocol.id === "build" ? 2.0 : 1.8;
          return `At ${quiz.weightKg} kg that is roughly ${Math.round(quiz.weightKg * perKg)} g of protein per day (${protocol.macroSplit.protein}).`;
        })()
      : `Protein target: ${protocol.macroSplit.protein}.`;

  return {
    id: "diet",
    title: "Diet",
    summary: `A ${protocol.name.toLowerCase()} nutrition plan: protein-anchored meals, sugar control for skin, steady hydration, and habits that compound over 4 weeks.`,
    whyForYou: `${targetLine} ${proteinLine} Your diet quality is currently "${quiz.dietQuality}", so the first wins come from structure, not restriction.`,
    weeks: [
      week(1, "Set targets and anchor on protein", [
        task(
          "Calculate your daily targets",
          `${targetLine} Write the number down where you will see it every morning.`,
          "once",
          `${whyBodyGoal(quiz)} — the targets are built from your weight and activity.`
        ),
        task(
          "Build protein-anchored meals",
          `${proteinLine} Put a palm-sized protein portion, vegetables, and a whole carb at every meal.`,
          "daily",
          `${whyBodyGoal(quiz)} — protein is the anchor of every ${protocol.id} plan.`
        ),
        task(
          "Cut liquid calories",
          "Drop sugary drinks and juices this week — they do not satisfy hunger and spike breakouts.",
          "daily",
          `${whyDietQ(quiz)} — liquid calories are the easiest first cut.`
        ),
      ]),
      week(2, "Stabilize blood sugar for skin and energy", [
        task(
          "Walk after meals",
          "A 10-15 minute walk after your biggest meal blunts the blood-sugar spike that aggravates breakouts.",
          "daily",
          `${whyDietQ(quiz)} — post-meal walks blunt the sugar spikes that aggravate breakouts.`
        ),
        task(
          "Add fermented food and fiber",
          "One serving of curd or yogurt plus fiber-rich vegetables or legumes daily — gut health is closely tied to skin clarity.",
          "daily",
          `${whyGoal1(quiz)} — gut health is closely tied to skin clarity.`
        ),
        task(
          "Halve added sugar",
          "Cut added sugar in snacks and drinks by half. Sugar spikes are a direct breakout and dullness trigger.",
          "daily",
          `${whyDietQ(quiz)} — added sugar is the biggest controllable diet lever.`
        ),
      ]),
      week(3, "Hydrate with intent", [
        task(
          "Drink water steadily through the day",
          `${foundations.hydration.note}`,
          "daily",
          `${whyDietQ(quiz)} — steady hydration beats chugging.`
        ),
        task(
          "Keep caffeine moderate",
          "No more than about 400 mg of caffeine per day from all sources, and none after noon if your sleep suffers.",
          "daily",
          `${whySleep(quiz)} — caffeine after noon wrecks sleep, and bad sleep wrecks skin.`
        ),
        task(
          "Front-load fruit",
          "Eat fruit daily for antioxidants, which support collagen and brightness from the inside.",
          "daily",
          `${whyGoal1(quiz)} — fruit feeds the glow from the inside.`
        ),
      ]),
      week(4, "Review and adjust", [
        task(
          "Check the weekly weight average",
          "Weigh 3-4 mornings and compare the average to week 1. Adjust portions up or down by about 10% based on the trend, not a single reading.",
          "once",
          `${whyBodyGoal(quiz)} — the trend tells you whether to adjust.`
        ),
        task(
          "Lock in your 80/20",
          "Keep 80% of meals whole and minimally processed; leave 20% flexible so the plan survives real life.",
          "daily",
          `${whyDietQ(quiz)} — flexible plans survive real life.`
        ),
        task(
          "Keep the skin foods",
          "Protein-rich meals, fiber, fruit, and fermented foods stay — they feed both body composition and skin.",
          "daily",
          `${whyGoal1(quiz)} — these foods feed both body and skin.`
        ),
      ]),
    ],
  };
}

function buildExerciseSection(
  quiz: QuizAnswers,
  protocol: BodyProtocol,
  _foundations: SkinFoundations
): PlanSection {
  return {
    id: "exercise",
    title: "Exercise",
    summary: `${protocol.training.daysPerWeek} training days per week on a ${protocol.training.split} — strength for structure, walking and cardio for leanness, posture work for presence.`,
    whyForYou: `You currently train "${quiz.exerciseFreq}". The plan meets you there: ${protocol.training.focus}`,
    weeks: [
      week(1, "Build the base habit", [
        task(
          "Walk 10,000 steps",
          "Daily walking is the lowest-effort lever for fat loss and skin circulation. Break it into chunks if needed.",
          "daily",
          `${whyExercise(quiz)} — walking is the lowest-effort lever from where you are now.`
        ),
        task(
          "Two full-body strength sessions",
          "Squat, hinge, push, pull, and carry — learn the movements with light loads and clean form.",
          "2x/week",
          `${whyBodyGoal(quiz)} and ${whyExercise(quiz)} — strength is the base of the plan.`
        ),
        task(
          "Chin tucks and wall angels",
          "Chin tucks: pull the chin straight back, hold 5 seconds, 10 reps. Wall angels: back against a wall, arms W to Y, 2 sets of 10. Daily for head and shoulder posture.",
          "daily",
          `${whyExercise(quiz)} — posture changes how your face reads in photos.`
        ),
      ]),
      week(2, "Add structure", [
        task(
          `Train ${protocol.training.daysPerWeek}x on the ${protocol.training.split}`,
          protocol.training.focus,
          `${protocol.training.daysPerWeek}x/week`,
          `${whyBodyGoal(quiz)} — ${protocol.training.focus}`
        ),
        task(
          "Add one cardio session",
          "20-30 minutes of steady cardio — brisk walk, cycle, or swim — for blood flow and stress reduction.",
          "1x/week",
          `${whyBodyGoal(quiz)} — cardio supports circulation and leanness.`
        ),
        task(
          "Sleep 7-9 hours",
          "Short sleep raises hunger hormones and cortisol, which stalls fat loss and dulls skin. Fixed wake time, even on weekends.",
          "daily",
          `${whySleep(quiz)} — short sleep stalls fat loss and dulls skin.`
        ),
        proTask(
          "The long debloat: body fat, not water tricks",
          "Morning rituals move temporary water for hours; lasting facial leanness follows overall body fat over weeks and months — training plus diet consistency, judged by monthly photos, not daily mirror checks. Never use diuretics, laxatives, dehydration, or detoxes to chase it: they cost health and the puff comes back.",
          "weekly",
          "because the debloat chapters separate water (hours) from fat (months) — this is the months half, and it is the only one that lasts."
        ),
      ]),
      week(3, "Push progression", [
        task(
          "Progressive overload",
          "Add a little weight or a rep to each main lift versus last week. Track it — progression is the whole program.",
          `${protocol.training.daysPerWeek}x/week`,
          `${whyBodyGoal(quiz)} — progression is the whole program.`
        ),
        task(
          "Two cardio sessions",
          "Cardio 3-5x/week total supports circulation and leanness; keep two easy sessions this week.",
          "2x/week",
          `${whyExercise(quiz)} — building from your current base.`
        ),
        task(
          "Posture check-in",
          "Film a short side-profile video and compare head position to week 1. Forward head makes facial proportions read worse than they are.",
          "once",
          `${whyExercise(quiz)} — posture changes the facial read; check the delta.`
        ),
      ]),
      week(4, "Consolidate", [
        task(
          "Deload week",
          "Cut volume roughly in half, keep the same movements. Recovery is when the adaptation happens.",
          `${protocol.training.daysPerWeek}x/week`,
          `${whyExercise(quiz)} — recovery is when the adaptation happens.`
        ),
        task(
          "Review adherence",
          "Count how many sessions and walks you actually did. Aim to beat it next month — consistency beats intensity.",
          "once",
          `${whyExercise(quiz)} — consistency beats intensity; count the proof.`
        ),
        task(
          "Plan the next block",
          "Repeat the 4-week structure with slightly heavier loads. The program works by compounding.",
          "once",
          `${whyBodyGoal(quiz)} — the program compounds.`
        ),
      ]),
    ],
  };
}

function buildStyleSection(
  measurements: FaceMeasurements | null,
  _quiz: QuizAnswers,
  foundations: SkinFoundations
): PlanSection {
  const shape = matchFaceShape(measurements);
  const topCuts = shape ? shape.haircuts.slice(0, 2) : [];
  const groomingHabits = foundations.postureGrooming.habits;

  const cutLines = topCuts.map(
    (c) => `${c.name}: ${c.description} Why it works for you — ${c.whyItWorks} Maintenance: ${c.maintenance}.`
  );
  const cutSummary = shape
    ? `For your ${shape.name.toLowerCase()} face shape (${shape.description})`
    : "For your face";

  const eyebrow = groomingHabits.find((h) => h.name === "Eyebrow shaping");
  const mouthTape = groomingHabits.find((h) => h.name === "Mouth tape for nasal breathing");
  const tongue = groomingHabits.find((h) => h.name === "Tongue posture exercises");

  return {
    id: "style",
    title: "Style",
    summary: `${cutSummary}: a flattering haircut, deliberate facial-hair shaping, brow grooming, and posture — the fastest visible wins.`,
    whyForYou: shape
      ? `Your detected face shape is ${shape.name}. ${cutSummary}, the plan prioritizes: ${topCuts.map((c) => c.name).join(" or ")}. ${shape.beardNotes}`
      : "Haircut and grooming recommendations are general here since no face-shape scan was provided — get the cut that adds structure where your face needs it.",
    weeks: [
      week(1, "Get the cut", [
        task(
          "Book the haircut",
          topCuts.length
            ? `Show your barber these references: ${cutLines.join(" ")}`
            : "Ask your barber for a cut that adds structure and suits your face shape; bring reference photos.",
          "once",
          shape
            ? `because your detected face shape is ${shape.name} — this cut is chosen for it.`
            : "because a deliberate cut is the fastest visible win."
        ),
        task(
          "Clean up the brows",
          eyebrow ? `${eyebrow.detail} ${eyebrow.caution}` : "Clean up stray brow hairs conservatively.",
          "once",
          "because groomed brows sharpen the whole face — a 10-minute win."
        ),
        task(
          "Fix your photo baseline",
          "Take front and side photos in natural light, neutral expression, camera at eye level. This is your week-1 reference.",
          "once",
          "because progress is measured against this baseline."
        ),
      ]),
      week(2, "Shape the facial hair", [
        task(
          "Define the beard or go clean",
          shape
            ? shape.beardNotes
            : "Keep facial hair deliberate: clean lines, maintained neckline, and a shape that suits your jaw.",
          "2x/week",
          shape
            ? `because your detected face shape is ${shape.name} — facial hair should flatter it.`
            : "because deliberate facial hair reads intentional."
        ),
        proTask(
          "Mewing (tongue posture)",
          tongue
            ? `${tongue.detail} Include the back third of the tongue, suctioned up — not just the tip — and keep teeth lightly together, never clenched. ${tongue.caution}`
            : "Rest the whole tongue flat against the roof of the mouth — back third included — with lips sealed, teeth lightly together (never clenched), breathing through the nose. Presented as a habit, not a promised outcome — no posture exercise reshapes bone in adults.",
          "daily",
          "because mewing is simply correct tongue resting posture — a free daily habit worth making your default, with honest expectations."
        ),
        proTask(
          "Morning debloat before photos",
          "Ice and 5 minutes of upward facial massage before any photo or event — this debloats: it moves temporary water, so it's visible for hours, not permanent.",
          "as needed",
          "because debloating sharpens photos — as needed before events."
        ),
        proTask(
          "Palate posture — the full mechanics",
          "Rest the whole tongue flat against the roof of the mouth with the back third suctioned up in a light seal — not just the tip — lips sealed, teeth lightly together (never clenched), breathing through the nose. The common errors are tip-only contact, clenched teeth, and hard mewing (pushing with force): force never helps and risks jaw pain and TMJ trouble. Stop with jaw pain or clicking and see a dentist. A habit, never a promise — no posture exercise reshapes adult bone.",
          "daily",
          "because correct resting posture is the mewing method itself — the back-third seal is what makes it real, and the no-force rule is what keeps it safe."
        ),
        proTask(
          "Chew properly: harder foods, both sides",
          "Swap one soft item per meal for something chewier — raw vegetables, crusty bread, nuts, tougher meats — and chew slowly on both sides until food is well broken down. This trains jaw-muscle use and chewing habit, not bone: it will not widen a palate or advance a jaw. Stop with jaw pain or clicking. Never chew ice, bones, bottle caps, or objects — they crack teeth. With TMJ symptoms, braces, or restorations, check with your dentist first.",
          "daily",
          "because chewing is the jaw-training method from the mewing chapters — muscle and habit, done inside normal meals, never as a stunt."
        ),
      ]),
      week(3, "Glasses and grooming audit", [
        task(
          "Check your frames",
          shape
            ? shape.glassesNotes
            : "Try frames that contrast your face shape: angular faces suit round frames, round faces suit angular frames.",
          "once",
          shape
            ? `because your detected face shape is ${shape.name} — frames should contrast it.`
            : "because frames should contrast your face shape."
        ),
        proTask(
          "Nasal breathing at night",
          mouthTape
            ? `${mouthTape.detail} ${mouthTape.caution}`
            : "Practice breathing through the nose at night for better sleep quality.",
          "daily",
          `${whySleep(_quiz)} — nasal breathing improves sleep quality.`
        ),
        proTask(
          "Clear a blocked nose before you chase posture",
          "Chronic congestion makes nose breathing — and therefore resting tongue posture — impossible, so fix the airway first: daily saline rinse and treating allergies. If congestion, mouth breathing, or snoring persist, see an ENT; unrefreshed waking deserves a sleep-apnea assessment. Never tape a blocked nose shut.",
          "daily",
          "because the airway chapters are clear — posture follows breathing, not the other way round."
        ),
        task(
          "Wardrobe fit check",
          "One well-fitting outfit beats five average ones. Check shoulder seams, sleeve length, and trouser break.",
          "once",
          "because fit beats quantity — one well-fitting outfit."
        ),
      ]),
      week(4, "Review the visible change", [
        task(
          "Retake baseline photos",
          "Same light, same angle, same expression as week 1. Compare hair, skin, and posture side by side.",
          "once",
          "because week-1 photos are the comparison point."
        ),
        task(
          "Maintain the cut",
          topCuts.length
            ? `Re-trim on schedule: ${topCuts[0].maintenance}`
            : "Re-trim every 3-4 weeks to keep the shape intentional.",
          "once",
          "because a good cut only stays good with maintenance."
        ),
        task(
          "Keep the daily habits",
          "Posture work, tongue posture, and brow maintenance stay in the routine — they cost minutes and compound.",
          "daily",
          "because these cost minutes and compound."
        ),
      ]),
    ],
  };
}

const STUB_DISCLAIMERS = [
  "This plan is general wellness and grooming guidance, not medical advice. It doesn't replace seeing a doctor about any condition.",
  "Skincare actives can irritate — introduce one new product at a time and patch-test first. If irritation persists, stop use and see a dermatologist.",
  "Nutrition and training targets are estimates. If you have a medical condition, are pregnant, or take medication, check with a doctor before changing diet or exercise.",
  "Supplements are optional and discussed with a doctor first — especially if pregnant, nursing, or on medication.",
  "Results vary by consistency, genetics, and starting point. Re-scan in 4 weeks to measure real change.",
];

/** The section matching goal #1 leads the plan (personalization spec). */
function leadSectionId(quiz: QuizAnswers): PlanSection["id"] | null {
  const g = goalAt(quiz, 0);
  if (!g) return null;
  if (
    /acne|pimple|blemish|skin|glow|tan|dull|redness|pigment|tone|dark ?mark|eye|circle|oil|dry|aging|brighten|breakout/.test(
      g
    )
  )
    return "skin";
  if (/weight|fat|cut|diet|nutrition|protein|food|lean/.test(g)) return "diet";
  if (/muscle|strength|build|gym|cardio|exercise|athletic|fit/.test(g))
    return "exercise";
  if (/hair|hairstyle|beard|style|jawline|glasses|face/.test(g)) return "style";
  return null;
}

/** Build a realistic plan purely from KB templates + rules. SAFE items only. */
export function buildStubPlan(
  measurements: FaceMeasurements | null,
  quiz: QuizAnswers
): AscendPlan {
  const foundations = getSkinFoundations();
  const skinProtocols = matchSkinProtocols(quiz, measurements);
  const bodyProtocol = matchBodyProtocol(quiz);

  const skinSection = buildSkinSection(quiz, measurements, skinProtocols);
  const dietSection = buildDietSection(quiz, bodyProtocol, foundations);
  const exerciseSection = buildExerciseSection(quiz, bodyProtocol, foundations);
  const styleSection = buildStyleSection(measurements, quiz, foundations);

  // goalRanking reorders sections: the section matching goal #1 leads.
  const ordered: PlanSection[] = [
    skinSection,
    dietSection,
    exerciseSection,
    styleSection,
  ];
  const lead = leadSectionId(quiz);
  if (lead) {
    const i = ordered.findIndex((s) => s.id === lead);
    if (i > 0) {
      const [sec] = ordered.splice(i, 1);
      ordered.unshift(sec);
    }
  }

  return {
    headline: headlineFor(quiz),
    scoreSummary: scoreSummaryFor(measurements, quiz),
    priorityFixes: priorityFixesFor(measurements, quiz),
    projection: buildProjection(measurements, quiz),
    foundations: buildFoundations(measurements, quiz),
    sections: ordered,
    disclaimers: [...STUB_DISCLAIMERS],
  };
}

/**
 * Deterministic Vitals layer — the same foundations in EVERY plan (free
 * template and premium AI alike), never AI-generated. Universal
 * looksmaxxing vitals, parameterised only by the user's own numbers:
 * hydration from bodyweight, sleep ramp from their current band, step
 * target from their activity, SPF from their sun exposure, pillowcase
 * cadence from their breakout count.
 */
export function buildFoundations(
  measurements: FaceMeasurements | null,
  quiz: QuizAnswers
): PlanFoundations {
  // Hydration: ~35 ml per kg bodyweight, rounded to the nearest 50 ml.
  const weightKg = quiz.weightKg ?? 70;
  const dailyMl = Math.round((weightKg * 35) / 50) * 50;

  // Sleep: fixed structure for everyone; the ramp line reflects their
  // current sleep band. Framed as looks — repair happens at night.
  const sleepRules: string[] = [];
  if (quiz.sleepHours === "<6" || quiz.sleepHours === "6-7") {
    sleepRules.push(
      `You run on ${quiz.sleepHours}h now — move bedtime 20 minutes earlier every 4 days until you clear 7h`
    );
  } else {
    sleepRules.push(
      "Protect the full window — skin repair and growth hormone peak in the first sleep cycles"
    );
  }
  sleepRules.push(
    "Fixed wake time, 7 days a week — the anchor everything else hangs on",
    "Screens off for the last 60 minutes — charge the phone outside the bedroom",
    "Cool, dark room: blackout curtains, no standby LEDs in line of sight"
  );

  // Movement: step target scaled to their current activity level.
  const sedentary =
    quiz.exerciseFreq === "never" || quiz.exerciseFreq === "1-2x";
  const stepTarget = sedentary ? "8,000 steps/day" : "10,000 steps/day";
  const cues = [
    sedentary
      ? "Week 1 floor is 6,000 steps — hit it daily before chasing 8,000"
      : "Two 10-minute walks after meals count toward the target",
    "Posture default: shoulders down and back, chin level, ribs stacked over hips",
    "On camera: chin slightly down, jaw pushed 2 cm forward — kills the double-chin shadow",
  ];

  // Non-negotiables: the daily floor, tightened by their signals.
  const spf =
    quiz.sunExposure === "outdoor"
      ? "SPF 50+ PA++++ every morning — two finger-lengths, reapply every 2–3h outdoors"
      : quiz.sunExposure === "desk"
        ? "SPF 30+ every morning — one application covers a desk day"
        : "SPF 50+ PA++++ every morning — two finger-lengths: face, ears, neck";
  const activeBreakouts =
    !!measurements?.landmarksDetected && measurements.skin.blemishCount >= 8;
  const nonNegotiables = [
    spf,
    activeBreakouts
      ? "Pillowcase swap every 2 days while breakouts are active — oil and bacteria reset nightly"
      : "Pillowcase change 2×/week — midweek and weekend",
    "Hands off your face — no touching, picking, or leaning on palms",
    "Oral care 2×/day: brush, floss, tongue scrape — breath and teeth read on camera",
    "Grooming floor: nails trimmed, brows tidy, lips never cracked (balm in pocket)",
  ];

  return {
    sleep: {
      target: "7–9h · fixed wake time, 7 days a week",
      rules: sleepRules,
    },
    hydration: {
      dailyMl,
      detail: `≈35 ml per kg of your bodyweight. Front-load half (${Math.round(dailyMl / 100) * 50} ml) before noon; keep the bottle in sight, not in a bag.`,
    },
    movement: { stepTarget, cues },
    nonNegotiables,
  };
}

/**
 * Stub projection: realistic, data-derived outcomes for the user's horizon.
 * Same honesty rules as the LLM path — fat math from their own calorie
 * numbers (deficit × days ÷ 7700), skin shifts as ranges, habit milestones.
 * No miracles, no guarantees, no fixed-horizon transformation promises.
 */
function buildProjection(
  measurements: FaceMeasurements | null,
  quiz: QuizAnswers
): PlanProjection {
  const horizonWeeks =
    quiz.timelineWeeks && quiz.timelineWeeks > 0 ? quiz.timelineWeeks : 12;
  const outcomes: string[] = [];

  const tdee = estimateTdee(quiz);
  if (quiz.bodyGoal === "cut") {
    const kg = ((500 * 7 * horizonWeeks) / 7700).toFixed(1);
    outcomes.push(
      tdee
        ? `≈${kg} kg fat loss at a 500 kcal/day deficit from your ${tdee} kcal maintenance`
        : `≈${kg} kg fat loss at a steady 500 kcal/day deficit`
    );
  } else if (quiz.bodyGoal === "build") {
    const kg = ((300 * 7 * horizonWeeks) / 7700 / 2).toFixed(1);
    outcomes.push(
      `≈${kg} kg of lean-gain potential at a +300 kcal/day surplus with progressive training`
    );
  } else {
    outcomes.push(
      "Weight held steady while the measurements move — recomposition, not scale change"
    );
  }

  if (measurements && measurements.landmarksDetected) {
    const s = measurements.skin;
    if (s.blemishCount >= 8) {
      outcomes.push(
        `Blemish count trending down from ${s.blemishCount} — visibly fewer active breakouts by week ${Math.min(4, horizonWeeks)}`
      );
    } else if (s.redness >= 55) {
      outcomes.push(
        `Redness (${Math.round(s.redness)}/100) visibly calmer — most of the shift lands by weeks 3–4`
      );
    } else if (s.texture >= 55) {
      outcomes.push(
        `Texture (${Math.round(s.texture)}/100) visibly smoother — on camera and to the touch by week ${Math.min(4, horizonWeeks)}`
      );
    } else {
      outcomes.push(
        "Skin barrier stable and consistent — the base every later phase builds on"
      );
    }
  }

  outcomes.push(
    quiz.routineLevel === "advanced"
      ? "Actives sequenced without an irritation setback — logged daily"
      : "AM/PM routine on autopilot by day 14 — 7 straight days without a missed morning"
  );

  const top = quiz.goalRanking[0] ?? quiz.goals[0];
  if (top) {
    outcomes.push(
      `First measured progress on your #1 goal (${top}) — checked at your week-${Math.min(4, horizonWeeks)} re-scan`
    );
  }

  return {
    horizonWeeks,
    outcomes: outcomes.slice(0, 5),
    note: "Realistically achievable with consistent adherence — not a guarantee. This is Phase 1 of your 12-week protocol; Phases 2 and 3 build on these numbers.",
  };
}

// ---------- LLM context: compact KB excerpts ----------

/** Compact, relevant KB excerpts to ground the LLM (Layer 3 retrieval). */
export function getRelevantKbExcerpts(
  measurements: FaceMeasurements | null,
  quiz: QuizAnswers
): string {
  const foundations = getSkinFoundations();
  const lines: string[] = [];

  const skinProtocols = matchSkinProtocols(quiz, measurements);
  lines.push("## Matched skin protocols");
  for (const p of skinProtocols) {
    lines.push(
      `- ${p.name}: AM [${p.routine.am.join(" | ")}] / PM [${p.routine.pm.join(" | ")}] / Weekly [${p.weekly.join(" | ")}] / Avoid [${p.whatToAvoid.join(" | ")}] / Timeline ${p.timelineWeeks} weeks`
    );
  }

  // Mewing & debloat methods (Zayne 2026-10-25): the premium plan
  // AI grounds its sections in these. Kept compact and placed
  // early so it survives the 6000-char slice on section calls.
  // Framing is fixed: habit, not promise — never bone change,
  // fat loss, or overnight results; never diuretics, dehydration,
  // force, or DIY devices.
  lines.push(
    "## Mewing & debloat methods — use in premium plans (locked for free users)"
  );
  lines.push(
    "- Mewing (tongue posture): whole tongue on the palate, back third suctioned up lightly, lips sealed, teeth lightly together, nose breathing; never force, never clench."
  );
  lines.push(
    "- Palate posture mechanics: tip-only contact, clenched teeth, and hard mewing are the errors; stop at jaw pain/clicking, see a dentist."
  );
  lines.push(
    "- Chewing: harder foods in normal meals, chewed slowly on both sides; trains jaw-muscle use and habit, not bone; never ice, bones, or objects; TMJ/braces/restorations check with a dentist first."
  );
  lines.push(
    "- Nasal breathing + clear airway: saline rinse and allergy care first; persistent congestion, mouth breathing, or snoring go to an ENT; never tape a blocked nose shut."
  );
  lines.push(
    "- Morning debloat ritual: cold splash or ice in cloth 30-60s, then 5 minutes light gua sha outward along jawline, cheekbones, brow, down the neck; moves temporary water for hours only."
  );
  lines.push(
    "- Debloat before photos: ice + 5 minutes upward facial massage as needed; visible for hours, not permanent."
  );
  lines.push(
    "- Sodium/potassium: moderate dinner sodium, potassium daily (banana, coconut water, yogurt, leafy greens); sleep head-up so fluid does not pool overnight."
  );
  lines.push(
    "- Long debloat: lasting facial leanness follows overall body fat over weeks/months via training + diet; never diuretics, laxatives, dehydration, or detoxes."
  );

  lines.push("## Core routines");
  lines.push(`- Morning (${foundations.morningRoutine.title}): ${foundations.morningRoutine.steps.join(" | ")}`);
  lines.push(`- Night (${foundations.nightRoutine.title}): ${foundations.nightRoutine.steps.join(" | ")}`);
  lines.push(`- De-tan: ${foundations.deTanProtocol.principle} ${foundations.deTanProtocol.steps.join(" ")}`);

  lines.push("## Actives reference");
  for (const a of foundations.actives) {
    lines.push(`- ${a.name}: ${a.whatItDoes} Best for: ${a.bestFor}. Caution: ${a.cautions}`);
  }

  const body = matchBodyProtocol(quiz);
  lines.push("## Body protocol");
  lines.push(
    `- ${body.name}: calories ${body.calorieRule}; macros protein ${body.macroSplit.protein}, carbs ${body.macroSplit.carbs}, fat ${body.macroSplit.fat}; training ${body.training.daysPerWeek}x/week ${body.training.split} — ${body.training.focus}; habits: ${body.habits.join(" | ")}`
  );

  const shape = matchFaceShape(measurements);
  if (shape) {
    lines.push("## Face shape styling");
    lines.push(`- ${shape.name}: ${shape.description}`);
    for (const c of shape.haircuts.slice(0, 3)) {
      lines.push(`  - Haircut "${c.name}": ${c.description} Why: ${c.whyItWorks}`);
    }
    lines.push(`- Beard: ${shape.beardNotes}`);
    lines.push(`- Glasses: ${shape.glassesNotes}`);
  }

  const findings = matchMetricFindings(measurements, quiz);
  if (findings.length) {
    lines.push("## Prioritized findings (impact x effort)");
    for (const m of findings) {
      const top = m.actions.slice(0, 2).map((a) => `${a.title} [impact:${a.impact}, effort:${a.effort}]`).join("; ");
      lines.push(`- ${m.finding.finding} Actions: ${top}`);
    }
  }

  lines.push("## Lifestyle context");
  lines.push(`- Skin nutrition: ${foundations.skinNutrition.points.join(" | ")}`);
  lines.push(`- Hydration: ${foundations.hydration.note}`);
  lines.push(`- Movement: ${foundations.movement.points.join(" | ")}`);
  lines.push(`- Sleep: ${foundations.sleepHygiene.points.join(" | ")}`);
  lines.push(`- Indian skin context: ${foundations.indianSkinContext.note}`);

  lines.push("## Prescription reference (LLM context ONLY — never recommend; mention only with 'consult a dermatologist' language, never with dosage/strength/frequency)");
  for (const r of foundations.rxReference) {
    lines.push(`- ${r.name}: ${r.status} Benefits: ${r.benefits} Doctor needed: ${r.doctorNeeded}`);
  }
  lines.push(`Framing line to use if relevant: "${foundations.appFramingLine}"`);

  return lines.join("\n");
}

// Re-exported for tests/debugging; not part of the public contract.
export const _internal = { matchSkinProtocols, matchMetricFindings, matchBodyProtocol };
