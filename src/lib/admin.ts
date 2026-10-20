// Owner test mode — v1 stand-in for real admin access.
//
// v1 has NO auth and no accounts, so there is no admin panel to log
// into. Until v2 lands (auth + Stripe, server-side entitlement), the
// owner unlocks the full Pro experience on their own device by typing
// the admin email (or the owner code) into the paywall coupon box.
// The flag lives in localStorage: device-local and cosmetic only — it
// is NOT security, and v2 must never trust it. It exists so Zayne can
// test the paid experience (full protocol, premium AI tier) for free.
//
// ADMIN_EMAIL is the canonical admin identity (Zayne, 2026-10-20):
// it is granted premium features as admin. When v2 auth ships, the
// server MUST grant admin + premium to any account whose verified
// email matches ADMIN_EMAIL (same pattern as World Chad Ranking's
// ADMIN_EMAILS), and this client-side stand-in gets deleted.

export const ADMIN_EMAIL = "zayneasad7@gmail.com";
export const OWNER_CODE = "ASCENDOWNER";

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
