// AUDIT FIX: deleteMySavedData also clears the device-local stores (progress photos, shelf, journey start) — the wipe now matches the privacy promise on both sides of the wire.
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
  return data as SavedScan[];
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

/** Privacy promise, working version: wipe the user's saved data. */
export async function deleteMySavedData(): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const userId = await currentUserId();
  if (!userId) return false;
  const plans = await sb.from("plans").delete().eq("user_id", userId);
  if (plans.error) return false;
  const checkins = await sb.from("checkins").delete().eq("user_id", userId);
  if (checkins.error) return false;
  const logs = await sb.from("daily_logs").delete().eq("user_id", userId);
  if (logs.error) return false;
  const chats = await sb.from("chat_messages").delete().eq("user_id", userId);
  if (chats.error) return false;
  const scans = await sb.from("scans").delete().eq("user_id", userId);
  if (scans.error) return false;
  // Device-local data goes too (audit fix): progress photos, the shelf
  // and the journey-start marker live only in this browser's storage —
  // a wipe that left them behind would not be the privacy promise.
  try {
    localStorage.removeItem("ascend_progress_photos");
    localStorage.removeItem("ascend_shelf");
    localStorage.removeItem("ascend_journey_start");
  } catch {
    /* storage unavailable — server data is already gone */
  }
  return true;
}
