"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useAppSettings } from "@/lib/use-settings";
import { getSupabase } from "@/lib/supabase";

/**
 * AppSettingsGate — the web consumer of the maintenance +
 * announcement settings (2026-10-22, /admin/settings).
 *
 * Maintenance ON: every app surface is replaced by the owner's
 * maintenance message — EXCEPT the auth pages and /admin itself
 * (the owner must always be able to sign in and reach the switch),
 * and except signed-in admins, who keep the full site so they can
 * work while it's down. The check is cosmetic by nature (the data
 * APIs keep their own auth); it is a real, enforced presentation
 * gate on every web surface, which is what maintenance mode is.
 *
 * Announcement ON: a banner with the owner's text renders at the
 * very top of the home page (and nowhere else, as specified).
 */

/** Routes that stay reachable during maintenance. */
const EXEMPT_PREFIXES = [
  "/login",
  "/signup",
  "/reset-password",
  "/auth",
  "/admin",
];

function isExempt(pathname: string | null): boolean {
  if (!pathname) return false;
  return EXEMPT_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

export default function AppSettingsGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const settings = useAppSettings();
  const [isAdmin, setIsAdmin] = useState(false);

  // Only pay for the admin lookup while maintenance is actually on.
  useEffect(() => {
    if (!settings.maintenance.on) return;
    let live = true;
    void (async () => {
      const sb = getSupabase();
      if (!sb) return;
      const { data } = await sb.auth.getSession();
      const uid = data.session?.user?.id;
      if (!uid) return;
      const { data: profile } = await sb
        .from("profiles")
        .select("is_admin")
        .eq("id", uid)
        .single();
      if (live && profile?.is_admin === true) setIsAdmin(true);
    })();
    return () => {
      live = false;
    };
  }, [settings.maintenance.on]);

  const blocked =
    settings.maintenance.on && !isAdmin && !isExempt(pathname);

  if (blocked) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-ink px-4">
        <div className="w-full max-w-md text-center">
          <p className="font-display text-3xl font-extrabold tracking-tight">
            <span className="gold-text">MEWMAX</span>
          </p>
          <h1 className="mt-6 font-display text-2xl font-extrabold text-bone">
            Down for maintenance
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            {settings.maintenance.message}
          </p>
          <p className="mt-6 text-xs text-muted">
            Admin?{" "}
            <a
              href="/login"
              className="font-semibold text-gold hover:underline"
            >
              Sign in
            </a>{" "}
            — admins keep full access while maintenance is on.
          </p>
        </div>
      </main>
    );
  }

  const showBanner =
    pathname === "/" &&
    settings.announcement.on &&
    settings.announcement.text.trim().length > 0;

  return (
    <>
      {showBanner && (
        <div className="border-b border-gold/25 bg-gold/10 px-4 py-2.5 text-center">
          <p className="text-sm font-semibold text-gold-soft">
            {settings.announcement.text}
          </p>
        </div>
      )}
      {children}
    </>
  );
}
