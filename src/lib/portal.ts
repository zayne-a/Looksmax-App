import type { SupabaseClient, User } from "@supabase/supabase-js";

// Creator Portal data layer (2026-10-22) — mirror of the reference
// app's creator portal: Discord-login creators connect TikTok /
// Instagram accounts, verify with a demographics recording, submit
// videos (views LOCK at submission), and earn the view ladder.
// Schema: supabase/migrations/2026-10-22-creator-portal.sql.
// RLS is own-rows-only; privileged transitions (approvals, referral
// qualification) happen server-side in /api/admin/portal.

export type Platform = "tiktok" | "instagram";
export type Tier = "BASIC" | "ELITE";
export type ReviewStatus = "pending" | "approved" | "rejected";

export interface CreatorProfile {
  id: string;
  discord_id: string | null;
  discord_username: string | null;
  discord_avatar_url: string | null;
  referral_code: string;
  referred_by: string | null;
  created_at: string;
}

export interface ConnectedAccount {
  id: string;
  creator_id: string;
  platform: Platform;
  handle: string;
  profile_url: string;
  status: ReviewStatus;
  tier: Tier | null;
  created_at: string;
  updated_at: string;
}

export interface VerificationRequest {
  id: string;
  creator_id: string;
  account_id: string;
  recording_url: string | null;
  storage_path: string | null;
  status: ReviewStatus;
  created_at: string;
}

export interface VideoSubmission {
  id: string;
  creator_id: string;
  account_id: string;
  video_url: string;
  posted_at: string;
  locked_views: number;
  status: ReviewStatus;
  month: string; // YYYY-MM of submission
  earned_cents: number | null;
  tier_at_approval: Tier | null;
  created_at: string;
}

export interface PayoutMethod {
  id: string;
  creator_id: string;
  type: "paypal" | "cashapp" | "crypto" | "bank";
  details: Record<string, string>;
  created_at: string;
  updated_at: string;
}

export interface Referral {
  id: string;
  referrer_id: string;
  invitee_id: string;
  status: "in_progress" | "qualified";
  qualified_at: string | null;
  created_at: string;
}

export interface ReferralFriend {
  invitee_id: string;
  discord_username: string | null;
  discord_avatar_url: string | null;
  status: "in_progress" | "qualified";
  created_at: string;
}

export interface LeaderboardRow {
  creator_id: string;
  discord_username: string | null;
  discord_avatar_url: string | null;
  earnings_cents: number;
  posts: number;
  views: number;
}

/** One ladder rung: reaching `views` adds `cents`, cumulatively. */
export interface LadderRung {
  views: number;
  cents: number;
}

export const LADDERS: Record<Tier, LadderRung[]> = {
  BASIC: [
    { views: 40_000, cents: 2_000 },
    { views: 500_000, cents: 3_000 },
    { views: 1_000_000, cents: 5_000 },
  ],
  ELITE: [
    { views: 40_000, cents: 2_000 },
    { views: 100_000, cents: 3_000 },
    { views: 500_000, cents: 10_000 },
    { views: 1_000_000, cents: 15_000 },
  ],
};

export const TIER1_COUNTRIES =
  "US, Canada, UK, Australia, Germany, France, Netherlands, Sweden, Denmark, Switzerland, New Zealand, Poland, Italy";

export const REFERRAL_BONUS_CENTS = 2_000; // $20

/** Ladder earnings for a locked view count at a tier (mirrors the
 *  SQL portal_ladder_cents — one math, two homes). */
export function ladderCents(views: number, tier: Tier | null | undefined): number {
  const rungs = LADDERS[tier === "ELITE" ? "ELITE" : "BASIC"];
  return rungs.reduce((sum, r) => (views >= r.views ? sum + r.cents : sum), 0);
}

/** What an approved submission earned: the amount frozen at approval
 *  when present, otherwise the ladder projection. */
export function submissionEarnedCents(s: VideoSubmission): number {
  if (typeof s.earned_cents === "number") return s.earned_cents;
  return ladderCents(s.locked_views, s.tier_at_approval);
}

/** Projected earnings for a still-pending submission at the account's
 *  current tier (BASIC until a tier is assigned). */
export function submissionProjectedCents(
  s: VideoSubmission,
  accountTier: Tier | null | undefined
): number {
  return ladderCents(s.locked_views, accountTier ?? "BASIC");
}

export function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function formatViews(n: number): string {
  return n.toLocaleString("en-US");
}

/** YYYY-MM for a date (local time) — the payout-month key. */
export function monthKey(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  return `${y}-${m}`;
}

export function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, (m ?? 1) - 1, 1);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

/** Month filter options: All-Time + the current month and the 11
 *  before it (the reference portal lists All-Time, then months). */
export function monthOptions(now = new Date()): { value: string; label: string }[] {
  const opts = [{ value: "all", label: "All-Time" }];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = monthKey(d);
    opts.push({ value: key, label: monthLabel(key) });
  }
  return opts;
}

export function inMonth(createdAt: string, filter: string): boolean {
  if (filter === "all") return true;
  return monthKey(new Date(createdAt)) === filter;
}

/** 8 hex chars, upper-case — the referral code shape (?ref=FAB0B2CF). */
export function generateReferralCode(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

const REF_STORAGE_KEY = "mewmax_ref_code";

/** Persist an invite code from ?ref= before the Discord round-trip. */
export function captureRefFromUrl(): void {
  try {
    const code = new URLSearchParams(window.location.search).get("ref");
    if (code && /^[0-9a-fA-F]{8}$/.test(code.trim())) {
      window.localStorage.setItem(REF_STORAGE_KEY, code.trim().toUpperCase());
    }
  } catch {
    // storage unavailable — referral capture is best-effort
  }
}

export function storedRefCode(): string | null {
  try {
    return window.localStorage.getItem(REF_STORAGE_KEY);
  } catch {
    return null;
  }
}

interface DiscordIdentity {
  discordId: string | null;
  username: string | null;
  avatarUrl: string | null;
}

/** Pull the Discord identity out of a Supabase user (Discord OAuth
 *  metadata lands in user_metadata + identities[].identity_data). */
export function discordIdentity(user: User): DiscordIdentity {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const ident = user.identities?.find((i) => i.provider === "discord");
  const idata = (ident?.identity_data ?? {}) as Record<string, unknown>;
  const str = (...vals: unknown[]): string | null => {
    for (const v of vals) {
      if (typeof v === "string" && v.trim()) return v;
    }
    return null;
  };
  return {
    discordId: str(idata.provider_id, idata.sub, meta.provider_id, meta.sub),
    username: str(
      idata.user_name,
      idata.full_name,
      idata.name,
      meta.user_name,
      meta.full_name,
      meta.name,
      user.email
    ),
    avatarUrl: str(idata.avatar_url, idata.picture, meta.avatar_url, meta.picture),
  };
}

/**
 * Load the caller's creator profile, creating it on first login:
 * Discord identity + a fresh referral code + the stored ?ref=
 * referrer (resolved through the portal_resolve_referral RPC, since
 * creator_profiles is own-row-only under RLS). Also files the
 * referrals row for the referrer. Returns null when the portal
 * tables are unreachable (migration not applied yet).
 */
export async function ensureCreatorProfile(
  sb: SupabaseClient,
  user: User
): Promise<CreatorProfile | null> {
  const { data: existing, error } = await sb
    .from("creator_profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (error) return null;
  if (existing) return existing as CreatorProfile;

  const identity = discordIdentity(user);
  let referredBy: string | null = null;
  const refCode = storedRefCode();
  if (refCode) {
    const { data } = await sb.rpc("portal_resolve_referral", { p_code: refCode });
    if (typeof data === "string" && data !== user.id) referredBy = data;
  }

  const row = {
    id: user.id,
    discord_id: identity.discordId,
    discord_username: identity.username,
    discord_avatar_url: identity.avatarUrl,
    referral_code: generateReferralCode(),
    referred_by: referredBy,
  };
  const { data: created, error: insertError } = await sb
    .from("creator_profiles")
    .insert(row)
    .select("*")
    .single();
  if (insertError || !created) {
    // Lost a race (double mount / second tab) or a referral-code
    // collision — re-read; the row should be there.
    const { data: retry } = await sb
      .from("creator_profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    return (retry as CreatorProfile | null) ?? null;
  }
  const profile = created as CreatorProfile;

  if (referredBy) {
    // Best-effort: a duplicate (unique invitee) is fine to ignore.
    await sb.from("referrals").insert({
      referrer_id: referredBy,
      invitee_id: user.id,
      status: "in_progress",
    });
  }
  return profile;
}

export async function loadAccounts(
  sb: SupabaseClient,
  creatorId: string
): Promise<ConnectedAccount[]> {
  const { data } = await sb
    .from("connected_accounts")
    .select("*")
    .eq("creator_id", creatorId)
    .order("created_at", { ascending: true });
  return (data as ConnectedAccount[] | null) ?? [];
}

export async function loadSubmissions(
  sb: SupabaseClient,
  creatorId: string
): Promise<VideoSubmission[]> {
  const { data } = await sb
    .from("video_submissions")
    .select("*")
    .eq("creator_id", creatorId)
    .order("created_at", { ascending: false });
  return (data as VideoSubmission[] | null) ?? [];
}

export const RECORDINGS_BUCKET = "verification-recordings";
