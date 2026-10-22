// Header rewritten to v2 reality (audited 2026-10-20): owner test mode is a client-side cosmetic only; server entitlement is account-derived and the APIs ignore client assertions. Real premium testing = sign in with the admin account (signup trigger grants is_admin + is_premium).
// Owner test mode — a CLIENT-SIDE COSMETIC only (v2 reality, audited
// 2026-10-20). Accounts and server-side entitlement have shipped: the
// signup trigger grants is_admin + is_premium to ADMIN_EMAIL, and the
// plan/coach APIs derive entitlement from the account — they ignore
// anything the client asserts. Typing the admin email or the owner
// code into the paywall coupon box sets a localStorage flag that lifts
// client-side veils on THIS device so the owner can eyeball the Pro
// layout without signing in. It unlocks nothing on the server: for a
// real premium test (AI curation, coach), sign in with the admin
// account. Never treat this flag as security anywhere.

export const ADMIN_EMAIL = "zayneasad7@gmail.com";
export const OWNER_CODE = "ASCENDOWNER";

/**
 * THE owner admins (Zayne's rule, 2026-10-22): these two emails get
 * is_admin + is_premium — every plan free, full panel access — and
 * they manage the Pro grant list (/admin/users → /api/admin/pro).
 * This is the ONE app-side source of truth; the SQL side hardcodes
 * the same two emails because SQL cannot import this constant:
 * see supabase/migrations/2026-10-22-admin-pro-grants.sql (profiles
 * INSERT trigger + backfill). Keep the two lists in step.
 */
export const OWNER_ADMIN_EMAILS = [
  "cerxemm@gmail.com",
  "zayneasad7@gmail.com",
] as const;

/** True when the input is one of the two owner admin emails. */
export function isOwnerAdminEmail(input: string): boolean {
  return (OWNER_ADMIN_EMAILS as readonly string[]).includes(
    input.trim().toLowerCase()
  );
}

/** True when a paywall-box entry is the admin email or the owner code. */
export function isOwnerCredential(input: string): boolean {
  const v = input.trim().toLowerCase();
  return v === ADMIN_EMAIL || v === OWNER_CODE.toLowerCase();
}

const KEY = "ascend_owner_test";

export function isOwnerTestMode(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setOwnerTestMode(on: boolean): void {
  try {
    if (on) window.localStorage.setItem(KEY, "1");
    else window.localStorage.removeItem(KEY);
  } catch {
    // storage unavailable (private mode etc.) — test mode just won't stick
  }
}
