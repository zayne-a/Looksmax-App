// PlanRequest.tier is documented as advisory-only: /api/plan ignores it and derives the tier from the validated account (audit fix, 2026-10-20).
// Shared types for Project Ascend (AI looksmaxxing app MVP v1)
// These contracts are shared across pages, the API route, and the knowledge base.

export type AgeRange = "18-24" | "25-34" | "35-44" | "45+";

export interface QuizAnswers {
  ratingStyle: "psl" | "standard";
  gender: "male" | "female";
  ageRange: "18-24" | "25-34" | "35-44" | "45+";
  focus: string[]; // improvement areas, e.g. "skin", "jawline", "hairstyle"
  goalRanking: string[]; // top goals ranked 1-3, drives plan ordering
  selfRating: number; // 1-8 — the PSL scale (there is no 10)
  goals: string[]; // e.g. "clearer skin", "leaner face"
  skinType: "oily" | "dry" | "combination" | "sensitive" | "normal" | "unknown";
  skinConcerns: string[];
  routineLevel: "none" | "basic" | "advanced" | "unknown"; // current skincare routine level
  budgetTier: "budget" | "mid" | "premium" | "unknown"; // product budget tier
  sunExposure: "outdoor" | "mixed" | "desk" | "unknown"; // daily sun/lifestyle exposure
  bodyGoal: "cut" | "maintain" | "build" | "unknown";
  heightCm?: number;
  weightKg?: number;
  waistCm?: number;
  neckCm?: number;
  sleepHours: string; // e.g. "<6", "6-7", "7-8", "8+"
  dietQuality: string; // e.g. "poor", "average", "good"
  exerciseFreq: string; // e.g. "never", "1-2x", "3-4x", "5+x"
  motivation: string;
  /** How soon the user wants results: 4 | 8 | 12 weeks, or 0 = no deadline. */
  timelineWeeks: 4 | 8 | 12 | 0;
}

export interface SkinMetrics {
  redness: number; // 0-100, higher = more redness
  texture: number; // 0-100, higher = rougher texture
  blemishCount: number; // estimated count
  underEye: number; // 0-100, higher = darker under-eyes
}

/** Frontal metrics added by scoring engine v2 (2026-10-22) — every one
 *  computed from the same 478 landmarks v1 already captured, per the
 *  benchmark table in research_notes/psl-scoring/psl-scoring-spec.md.
 *  Raw values only; all scoring lives in lib/psl.ts. */
export interface FrontalMetricsV2 {
  /** F1 — interpupillary distance ÷ bizygomatic width. */
  esr: number;
  /** Intercanthal distance ÷ bizygomatic width. */
  intercanthalRatio: number;
  /** F13 — intercanthal distance ÷ one eye width ("one-eye test"). */
  oneEyeRatio: number;
  /** F7 — total face height (mesh top → chin) ÷ bizygomatic width. */
  totalHeightWidth: number;
  /** F10 — interpupillary distance ÷ (glabella → upper lip). */
  midfaceRatio: number;
  /** F21 (Pallett) — eye-line → mouth vertical distance ÷ face length. */
  eyeMouthRatio: number;
  /** F9 — chin height ÷ philtrum length. */
  chinPhiltrumRatio: number;
  /** F11 — mouth width ÷ alar (nose) width. */
  mouthNoseRatio: number;
  /** F15 — lower ÷ upper vermilion height. */
  lipRatio: number;
  /** F14 — eye width ÷ fissure height. */
  eyeAspectRatio: number;
  /** F12 — brow→eye vertical distance ÷ eye width (lower = lower-set). */
  browSetedness: number;
  /** F17 — brow line angle vs horizontal, degrees (outer end higher = +). */
  browTiltDeg: number;
  /** F18 — bitemporal width ÷ bizygomatic width. */
  bitemporalRatio: number;
  /** F6 — cheekbone height within the eye-line→nose-base span, 0..1
   *  (1 = cheekbone at eye level; higher-set scores better). */
  cheekboneSetedness: number;
  /** F5 — frontal jaw angle at the jaw corner, degrees. */
  jawFrontalAngleDeg: number;
}

/** Side-profile metrics (spec §2.2 subset S1/S3/S5/S10) — present ONLY
 *  when the side capture passed the confidence gate in lib/face.ts.
 *  Absent/null means "not measured", never an estimate. */
export interface SideMetricsV2 {
  /** S1 — gonial angle, degrees. */
  gonialAngleDeg: number;
  /** S3 — mandibular plane angle vs horizontal, degrees. */
  mandibularPlaneDeg: number;
  /** S5 — facial convexity at the nose tip (glabella–tip–chin), degrees. */
  convexityGlabellaDeg: number;
  /** S10 — total facial convexity at the subnasale, degrees. */
  totalConvexityDeg: number;
}

export interface FaceMeasurements {
  facialThirds: { upper: number; mid: number; lower: number }; // proportions summing to ~1
  fifths: number[]; // 5 horizontal proportions summing to ~1
  canthalTiltDeg: number; // degrees, positive = upturned
  jawToCheekbone: number; // ratio (F8 bigonial ÷ bizygomatic in v2 terms)
  /** v2: TRUE FWHR — bizygomatic width ÷ (glabella → upper lip).
   *  v1 rows hold the legacy faceW ÷ full-face-height ratio (~0.7);
   *  the two are different quantities and must never be compared. */
  fwhr: number;
  symmetryScore: number; // 0-100
  /** Legacy field name, kept so stored rows and their readers stay
   *  valid. v1: the φ golden-ratio composite (removed in v2 — the
   *  1.618 target is debunked). v2: the Harmony bucket score 0–100,
   *  stamped by lib/psl.ts when the scan is finalised. */
  goldenRatioScore: number;
  overallScore: number; // 0-100 deterministic composite (anchored, never LLM vibes)
  faceShape: "oval" | "round" | "square" | "oblong" | "heart" | "diamond" | "unknown";
  skin: SkinMetrics;
  landmarksDetected: boolean;
  notes: string[]; // e.g. warnings about photo quality
  /** Scoring engine version. Absent = v1 scan: its numbers are kept
   *  exactly as recorded (history is never rescored). 2 = v2. */
  engineVersion?: 2;
  /** From the quiz; drives the sex-specific bands in v2 scoring. */
  gender?: "male" | "female";
  /** v2 frontal metrics (present on v2 scans only). */
  frontal?: FrontalMetricsV2;
  /** v2 side metrics — null/absent when the side gate didn't pass. */
  side?: SideMetricsV2 | null;
}

// ---- Plan JSON (Layer-3 output schema) ----

export interface PlanTask {
  title: string;
  detail: string;
  frequency: string; // e.g. "daily", "3x/week", "once"
  whyYou: string; // cites the specific measurement/answer that triggered this task
  /** Free-tier marker set server-side by /api/plan's truncateForFree:
   *  a locked task ships its REAL title + frequency only — detail and
   *  whyYou are stubbed out before the response leaves the server.
   *  Renderers show it as a locked row; it is never a doable task.
   *  Absent (undefined) on every task of a premium plan. */
  locked?: boolean;
  /** Premium-only method (Zayne 2026-10-25): mewing/debloat method
   *  tasks carry this flag. truncateForFree locks them for free
   *  users even inside the free allowance, so the methods are
   *  teasers (title + frequency) for free users and full
   *  instructions for premium users. Absent on ordinary tasks. */
  proOnly?: boolean;
}

export interface PlanWeek {
  week: number;
  focus: string;
  tasks: PlanTask[];
}

export interface PlanSection {
  id: "skin" | "diet" | "exercise" | "style";
  title: string;
  summary: string;
  whyForYou: string; // tied to the user's actual numbers
  weeks: PlanWeek[];
}

export interface PriorityFix {
  title: string;
  why: string;
  impact: "high" | "medium" | "low";
  effort: "low" | "medium" | "high";
}

/**
 * The temptation hook: what is REALISTICALLY achievable by the user's chosen
 * horizon, derived from their own numbers (fat math, skin readings,
 * milestones). No miracles, no guaranteed outcomes, no fixed short-horizon
 * transformation promises.
 */
export interface PlanProjection {
  horizonWeeks: number; // the user's timeline (4 | 8 | 12; no deadline → 12)
  outcomes: string[]; // 3-5 realistic, data-derived outcomes
  note: string; // honest framing — achievable with consistency, not guaranteed
}

/**
 * Deterministic Vitals layer — present in EVERY plan, never AI-generated.
 * Universal looksmaxxing foundations, parameterised only by the user's own
 * numbers (hydration from bodyweight, SPF from sun exposure, step target
 * from current activity). Built by lib/kb.ts `buildFoundations` and merged
 * into premium AI plans unchanged.
 */
export interface PlanFoundations {
  sleep: {
    target: string; // e.g. "7–9h · fixed wake time, 7 days a week"
    rules: string[]; // terse directives, personalised to their current sleep
  };
  hydration: {
    dailyMl: number; // ~35 ml per kg bodyweight
    detail: string;
  };
  movement: {
    stepTarget: string; // e.g. "10,000 steps/day"
    cues: string[]; // posture / presence cues
  };
  nonNegotiables: string[]; // daily SPF, pillowcase, hands-off-face, oral care…
}

export interface AscendPlan {
  headline: string;
  scoreSummary: string;
  priorityFixes: PriorityFix[];
  projection: PlanProjection;
  foundations: PlanFoundations;
  /** True while AI deep-curation is still generating in the background;
   *  a plan carrying the flag is the full deterministic protocol. The
   *  flag disappears when the curated version replaces the plan. */
  aiPending?: boolean;
  sections: PlanSection[];
  disclaimers: string[];
}

export interface PlanRequest {
  measurements: FaceMeasurements | null;
  quiz: QuizAnswers;
  /**
   * Generation tier — ADVISORY ONLY. The /api/plan route ignores this
   * value and derives the tier server-side from the caller's validated
   * account entitlement (audited 2026-10-20: trusting the client-sent
   * tier made premium free to anyone). The field stays in the payload
   * shape for logging/debugging; it grants nothing.
   */
  tier?: "free" | "premium";
  /** Id of the already-saved scan this plan belongs to, so a plan whose
   *  AI generation finishes in the background can be filed correctly. */
  scanId?: string | null;
  /** True when this generation is a user-requested CHANGE to an
   *  existing plan for the same scan (Zayne, 2026-10-21: users may
   *  change a built plan, at most twice). The route enforces the cap
   *  server-side by counting the caller's plan rows for the scan. */
  changeOfPlan?: boolean;
}

export interface PlanResponse {
  plan: AscendPlan;
  source: "gemini" | "stub";
  /** The tier the server actually served (derived from the account's
   *  entitlement when a session token was sent). */
  tier?: "free" | "premium";
  /** True when the served plan is the deterministic protocol while its
   *  AI deep-curation finishes in the background (account holders get
   *  the curated version in their dashboard when it lands). */
  aiPending?: boolean;
}
