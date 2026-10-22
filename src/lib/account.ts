import { getSupabase } from "./supabase";
import type { AscendPlan, FaceMeasurements, QuizAnswers } from "./types";

// Account data layer (Supabase). Everything here is best-effort: when
// Supabase isn't configured or nobody is logged in, saves no-op and
// lists return empty — the account-free funnel never breaks.
// RLS guarantees users only ever touch their own rows; photos are
// never uploaded (measurement is on-device by design).

export interface Profile {
  id: string;
  email: string;
  is_admin: boolean;
  is_premium: boolean;
  created_at: string;
}

export interface SavedScan {
  id: string;
  created_at: string;
  overall_score: number | null;
  measurements: FaceMeasurements;
  quiz: QuizAnswers | null;
}

export interface Checkin {
  id: string;
  created_at: string;
  week: number;
  adherence: string;
  skin_reaction: string;
  sleep_quality: string;
  weight_trend: string;
}

export interface DailyLog {
  id: string;
  day: string; // YYYY-MM-DD (user-local)
  answers: Record<string, string>;
  habits: Record<string, boolean>;
  water_ml: number;
  calories: number | null;
  weight_kg: number | null;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface SavedPlan {
  id: string;
  created_at: string;
  tier: string;
  scan_id: string | null;
  plan: AscendPlan;
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb
    .from("profiles")
    .select("id, email, is_admin, is_premium, created_at")
    .eq("id", userId)
    .single();
  if (error || !data) return null;
  return data as Profile;
}

async function currentUserId(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session?.user?.id ?? null;
}

/** Persist a completed scan for the logged-in user. Returns the row id. */
export async function saveScan(
  measurements: FaceMeasurements,
  quiz: QuizAnswers | null,
): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const userId = await currentUserId();
  if (!userId) return null;
  const { data, error } = await sb
    .from("scans")
    .insert({
      user_id: userId,
      overall_score: measurements.overallScore,
      measurements,
      quiz,
    })
    .select("id")
    .single();
  if (error || !data) return null;
  return (data as { id: string }).id;
}

/** How many plan rows exist for one scan (own rows only, via RLS).
 *  The first is the original plan; every row beyond it is a plan
 *  change. Powers the "free change left" counter (Zayne: 1 free
 *  change per plan; further changes are a paid add-on). */
export async function countPlansForScan(scanId: string): Promise<number> {
  const sb = getSupabase();
  if (!sb) return 0;
  const { count, error } = await sb
    .from("plans")
    .select("id", { count: "exact", head: true })
    .eq("scan_id", scanId);
  if (error || count == null) return 0;
  return count;
}

/** Persist a generated plan for the logged-in user. Returns the row id. */
export async function savePlan(
  plan: AscendPlan,
  tier: string,
  scanId: string | null,
): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const userId = await currentUserId();
  if (!userId) return null;
  const { data, error } = await sb
    .from("plans")
    .insert({ user_id: userId, scan_id: scanId, tier, plan })
    .select("id")
    .single();
  if (error || !data) return null;
  return (data as { id: string }).id;
}

export async function listScans(limit = 24): Promise<SavedScan[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const userId = await currentUserId();
  if (!userId) return [];
  const { data, error } = await sb
    .from("scans")
    .select("id, created_at, overall_score, measurements, quiz")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return (data as SavedScan[]).map((s) => ({
    ...s,
    measurements: normaliseMeasurements(s.measurements),
  }));
}

/** Fill any missing sub-objects on a saved measurements row so one
 *  partial/legacy row can never white-screen a page (found 2026-10-21:
 *  a stub row without `skin` crashed /plan on `m.skin.redness`).
 *  Complete rows pass through untouched. A row that was never really
 *  measured keeps landmarksDetected falsy, so reads treat it as
 *  quiz-only. */
export function normaliseMeasurements(
  raw: FaceMeasurements | null | undefined
): FaceMeasurements {
  const m = (raw ?? {}) as Partial<FaceMeasurements>;
  return {
    facialThirds: m.facialThirds ?? { upper: 1 / 3, mid: 1 / 3, lower: 1 / 3 },
    fifths: m.fifths ?? [0.2, 0.2, 0.2, 0.2, 0.2],
    canthalTiltDeg: m.canthalTiltDeg ?? 0,
    jawToCheekbone: m.jawToCheekbone ?? 0,
    fwhr: m.fwhr ?? 0,
    symmetryScore: m.symmetryScore ?? 0,
    goldenRatioScore: m.goldenRatioScore ?? 0,
    overallScore: m.overallScore ?? 0,
    faceShape: m.faceShape ?? "unknown",
    skin: m.skin ?? { redness: 0, texture: 0, blemishCount: 0, underEye: 0 },
    landmarksDetected: m.landmarksDetected ?? false,
    notes: m.notes ?? [],
    // v2 fields — pass through verbatim when present; v1 rows simply
    // don't have them (absent engineVersion = v1 scan, numbers kept).
    ...(m.engineVersion === 2 ? { engineVersion: 2 as const } : {}),
    ...(m.gender === "male" || m.gender === "female"
      ? { gender: m.gender }
      : {}),
    ...(m.frontal && typeof m.frontal === "object"
      ? { frontal: m.frontal }
      : {}),
    side:
      m.side && typeof m.side === "object" ? m.side : null,
  };
}

export async function listPlans(limit = 24): Promise<SavedPlan[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const userId = await currentUserId();
  if (!userId) return [];
  const { data, error } = await sb
    .from("plans")
    .select("id, created_at, tier, scan_id, plan")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data as SavedPlan[];
}

/* ---- Active plan version (plan history / revert, 2026-10-21) ----
 * Every generated plan is its own row in `plans`; the "active" plan
 * is the latest by created_at UNLESS the user reverted to an earlier
 * version. The choice persists in profiles.active_plan_id (migration
 * supabase/migrations/2026-10-21-active-plan-id.sql). Until that
 * migration is applied the column doesn't exist and every query here
 * errors — the preference then falls back to device-local storage so
 * revert still works end-to-end on this device. All functions are
 * best-effort: any failure resolves to "follow the latest plan",
 * which is the pre-revert behaviour. */

const ACTIVE_PLAN_LS_KEY = "ascend_active_plan_id";

function localActivePlanId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_PLAN_LS_KEY);
  } catch {
    return null;
  }
}

function setLocalActivePlanId(planId: string | null): boolean {
  try {
    if (planId) localStorage.setItem(ACTIVE_PLAN_LS_KEY, planId);
    else localStorage.removeItem(ACTIVE_PLAN_LS_KEY);
    return true;
  } catch {
    return false;
  }
}

/** The user's reverted-to plan version id, or null = latest plan. */
export async function fetchActivePlanId(): Promise<string | null> {
  const sb = getSupabase();
  if (sb) {
    const userId = await currentUserId();
    if (userId) {
      const { data, error } = await sb
        .from("profiles")
        .select("active_plan_id")
        .eq("id", userId)
        .single();
      if (!error && data) {
        const dbValue = (data as { active_plan_id?: string | null })
          .active_plan_id;
        // A device-local choice made before the migration landed is
        // still honoured until a DB value exists.
        return dbValue ?? localActivePlanId();
      }
      // Column missing (pre-migration) or read failed → local fallback.
    }
  }
  return localActivePlanId();
}

/** Persist the active plan version (null = follow the latest plan).
 *  Returns true when the choice was stored somewhere durable
 *  (account row, or this device until the migration lands). */
export async function setActivePlanId(planId: string | null): Promise<boolean> {
  const sb = getSupabase();
  if (sb) {
    const userId = await currentUserId();
    if (userId) {
      const { error } = await sb
        .from("profiles")
        .update({ active_plan_id: planId })
        .eq("id", userId);
      if (!error) {
        setLocalActivePlanId(planId);
        return true;
      }
      // Pre-migration: the update errors on the unknown column —
      // fall through to the device-local store.
    }
  }
  return setLocalActivePlanId(planId);
}

/** Persist a weekly check-in. Returns the row id. */
export async function saveCheckin(input: {
  week: number;
  adherence: string;
  skin_reaction: string;
  sleep_quality: string;
  weight_trend: string;
}): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const userId = await currentUserId();
  if (!userId) return null;
  const { data, error } = await sb
    .from("checkins")
    .insert({ user_id: userId, ...input })
    .select("id")
    .single();
  if (error || !data) return null;
  return (data as { id: string }).id;
}

export async function listCheckins(limit = 52): Promise<Checkin[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const userId = await currentUserId();
  if (!userId) return [];
  const { data, error } = await sb
    .from("checkins")
    .select("id, created_at, week, adherence, skin_reaction, sleep_quality, weight_trend")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data as Checkin[];
}

/** Merge a patch into today's (or a given day's) daily log, creating it
 *  if needed. One row per user per day — the streak/calendar source. */
export async function saveDailyLog(
  day: string,
  patch: Partial<{
    answers: Record<string, string>;
    habits: Record<string, boolean>;
    water_ml: number;
    calories: number | null;
    weight_kg: number | null;
  }>
): Promise<DailyLog | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const userId = await currentUserId();
  if (!userId) return null;
  const { data: existing } = await sb
    .from("daily_logs")
    .select("*")
    .eq("user_id", userId)
    .eq("day", day)
    .maybeSingle();
  const base = (existing as DailyLog | null) ?? {
    answers: {},
    habits: {},
    water_ml: 0,
    calories: null,
    weight_kg: null,
  };
  const merged: Record<string, unknown> = {
    user_id: userId,
    day,
    answers: { ...base.answers, ...(patch.answers ?? {}) },
    habits: { ...base.habits, ...(patch.habits ?? {}) },
    water_ml: patch.water_ml ?? base.water_ml,
    calories: patch.calories !== undefined ? patch.calories : base.calories,
    weight_kg: patch.weight_kg !== undefined ? patch.weight_kg : base.weight_kg,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await sb
    .from("daily_logs")
    .upsert(merged, { onConflict: "user_id,day" })
    .select("*")
    .single();
  if (error || !data) return null;
  return data as DailyLog;
}

export async function listDailyLogs(limit = 92): Promise<DailyLog[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const userId = await currentUserId();
  if (!userId) return [];
  const { data, error } = await sb
    .from("daily_logs")
    .select("*")
    .eq("user_id", userId)
    .order("day", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data as DailyLog[];
}

export async function saveChatMessage(
  role: "user" | "assistant",
  content: string
): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const userId = await currentUserId();
  if (!userId) return;
  await sb.from("chat_messages").insert({ user_id: userId, role, content });
}

export async function listChatMessages(limit = 60): Promise<ChatMessage[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const userId = await currentUserId();
  if (!userId) return [];
  const { data, error } = await sb
    .from("chat_messages")
    .select("id, role, content, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return (data as ChatMessage[]).reverse();
}


