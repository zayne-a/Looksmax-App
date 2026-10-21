/**
 * Creator template score logic — the label/colour tables the
 * reference app's template builders use, extracted from its client
 * bundle (2026-10-22) so our creator tools speak exactly the same
 * language as the decks in the app.
 *
 * Scores on the templates run 1–8 (one decimal), unlike the in-app
 * PSL /10 scale in src/lib/psl.ts.
 */

export type Gender = "male" | "female";

/** Tier label for a score card (PSL / POTENTIAL). */
export function scoreTierLabel(score: number, gender: Gender): string {
  if (gender === "male") {
    if (score >= 7.5) return "True Adam";
    if (score >= 6) return "Chad";
    if (score >= 5.5) return "Chadlite";
    if (score >= 5) return "High-Tier Normie";
    if (score >= 4) return "Mid-Tier Normie";
    if (score >= 3) return "Low-Tier Normie";
    return "Sub-3";
  }
  if (score >= 7.5) return "True Eve";
  if (score >= 6) return "Stacy";
  if (score >= 5.5) return "Stacylite";
  if (score >= 5) return "High-Tier Becky";
  if (score >= 4) return "Mid-Tier Becky";
  if (score >= 3) return "Low-Tier Becky";
  return "Sub-3";
}

/** Verdict label for a region card (EYES / MIDFACE / thirds). */
export function regionLabel(score: number): string {
  if (score >= 7) return "Excellent";
  if (score >= 6) return "Good";
  if (score >= 4) return "Average";
  if (score >= 2) return "Below Avg";
  return "Poor";
}

/** Progress-bar fill for a 1–8 score: (score − 1) / 7, clamped. */
export function barFraction(score: number): number {
  return Math.min(1, Math.max(0, (score - 1) / 7));
}

/** Bar / number colour for a 1–8 score. */
export function barColor(score: number): string {
  if (score >= 7) return "#75fff1";
  if (score >= 6) return "#39FF14";
  if (score >= 4.5) return "#FFFF00";
  if (score >= 3) return "#FF8C00";
  return "#FF0000";
}

/**
 * Countdown-ring colour for the Ascend template, as a step function
 * of progress q = (90 − days) / 90 — the reference maps q onto its
 * 1–8 scale (q·7 + 1) and bands it red → orange → yellow → lime →
 * green → mint as the deadline closes in.
 */
export function ringColor(progress: number): string {
  const f = progress * 7 + 1;
  if (f >= 7.5) return "#75fff1";
  if (f >= 6) return "hsl(120, 60%, 50%)";
  if (f >= 5.5) return "hsl(80, 79%, 62%)";
  if (f >= 5) return "hsl(60, 79%, 62%)";
  if (f >= 4) return "hsl(26, 89%, 47%)";
  return "hsl(0, 79%, 72%)";
}

/** His number format: integers bare, otherwise one decimal. */
export function formatRating(v: number): string {
  return v % 1 === 0 ? v.toFixed(0) : v.toFixed(1);
}

export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
