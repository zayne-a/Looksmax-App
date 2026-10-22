"use client";

import { useEffect, useState, type ReactNode } from "react";
import { getSupabase } from "@/lib/supabase";
import NotFoundExperience from "@/components/NotFoundExperience";

/**
 * AdminGate + AdminChecking — the invisible-admin gate (2026-10-22,
 * owner's rule). Supabase sessions in this app live in localStorage
 * (plain supabase-js browser client — no SSR cookies), so the
 * server cannot know who is asking when it ships the page shell.
 * The gate therefore runs client-side:
 *
 *   checking → AdminChecking: a neutral brand loader with NO copy —
 *              nothing on screen confirms an admin area exists.
 *   denied   → NotFoundExperience: byte-for-byte the app's real 404
 *              (src/app/not-found.tsx renders the same component),
 *              for signed-out visitors and non-admin accounts alike.
 *   ready    → children, with the session token. The probe is a real
 *              admin API call (GET /api/admin/pro), which itself
 *              re-checks is_admin server-side and answers 404 to
 *              anyone else — this gate is presentation; the APIs are
 *              the security.
 *
 * The owner's path stays flawless: sign in via /login as usual,
 * then open any /admin URL — the stored session passes the probe
 * and the panel renders.
 */

export function AdminChecking() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center px-4">
      <p className="animate-pulse font-display text-2xl font-extrabold tracking-tight">
        <span className="gold-text">MEWMAX</span>
      </p>
    </div>
  );
}

type GateState = "checking" | "denied" | "ready";

export default function AdminGate({
  children,
}: {
  children: (token: string) => ReactNode;
}) {
  const [state, setState] = useState<GateState>("checking");
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void (async () => {
      const sb = getSupabase();
      const tok = sb
        ? ((await sb.auth.getSession()).data.session?.access_token ?? null)
        : null;
      if (!tok) {
        if (live) setState("denied");
        return;
      }
      try {
        const res = await fetch("/api/admin/pro", {
          headers: { Authorization: `Bearer ${tok}` },
        });
        if (!live) return;
        if (!res.ok) {
          setState("denied");
          return;
        }
        setToken(tok);
        setState("ready");
      } catch {
        if (live) setState("denied");
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  if (state === "checking") return <AdminChecking />;
  if (state === "denied" || !token) return <NotFoundExperience />;
  return <>{children(token)}</>;
}
