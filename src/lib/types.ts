# PlanRequest.tier is documented as advisory-only: /api/plan ignores it and derives the tier from the validated account (audit fix, 2026-10-20).
// Shared types for Project Ascend (AI looksmaxxing app MVP v1)
// These contracts are shared across pages, the API route, and the knowledge base.

export type AgeRange = "18-24" | "25-34" | "35-44" | "45+";

export interface QuizAnswers {
  ratingStyle: "psl" | "standard";
  gender: "male" | "female";
  ageRange: "18-24" | "25-34" | "35-44" | "45+";
  focus: string[]; // improvement areas, e.g. "skin", "jawline", "hairstyle"
  goalRanking: string[]; // top goals ranked 1-3, drives plan ordering
  selfRating: number; // 1-10
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

export interface FaceMeasurements {
  facialThirds: { upper: number; mid: number; lower: number }; // proportions summing to ~1
  fifths: number[]; // 5 horizontal proportions summing to ~1
  canthalTiltDeg: number; // degrees, positive = upturned
  jawToCheekbone: number; // ratio
  fwhr: number; // facial width-to-height ratio
  symmetryScore: number; // 0-100
  goldenRatioScore: number; // 0-100 composite vs ideal proportions
  overallScore: number; // 0-100 deterministic composite (anchored, never LLM vibes)
  faceShape: "oval" | "round" | "square" | "oblong" | "heart" | "diamond" | "unknown";
  skin: SkinMetrics;
  landmarksDetected: boolean;
  notes: string[]; // e.g. warnings about photo quality
}

// ---- Plan JSON (Layer-3 output schema) ----

export interface PlanTask {
  title: string;
  detail: string;
  frequency: string; // e.g. "daily", "3x/week", "once"
  whyYou: string; // cites the specific measurement/answer that triggered this task
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
