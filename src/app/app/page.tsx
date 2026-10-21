"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";

/**
 * The app door (Zayne, 2026-10-21). The native shell (psl-android)
 * opens HERE, never at the marketing homepage:
 *  - signed-in user  -> straight to their dashboard (their rings,
 *    their countdown, no funnel re-run)
 *  - everyone else   -> the persuasion onboarding at /start
 * Black while it decides — the app's splash is just the app's colour.
 */
export default function AppEntryPage() {
  const router = useRouter();

  useEffect(() => {
    let live = true;
    (async () => {
      const sb = getSupabase();
      if (!sb) {
        router.replace("/start");
        return;
      }
      const { data } = await sb.auth.getSession();
      if (!live) return;
      router.replace(data.session ? "/dashboard" : "/start");
    })();
    return () => {
      live = false;
    };
  }, [router]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black">
      <p className="font-display text-sm font-black uppercase tracking-[0.35em] text-white/50">
        Mewmax
      </p>
    </div>
  );
}
