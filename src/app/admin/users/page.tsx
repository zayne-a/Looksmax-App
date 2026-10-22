"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button, Card, Eyebrow } from "@/components/ui";
import { getSupabase } from "@/lib/supabase";
import { OWNER_ADMIN_EMAILS } from "@/lib/admin";

/**
 * /admin/users — owner admins + Pro grants (2026-10-22, Zayne's
 * rule). The two owner emails are locked rows: they always hold
 * is_admin + is_premium (every plan free, full panel access) and can
 * never be revoked. Below them, any admin can grant Pro to another
 * email — it applies immediately when the account exists, or
 * automatically at signup when it doesn't (the profiles INSERT
 * trigger reads public.pro_grants).
 *
 * Everything talks to /api/admin/pro with the session's Bearer
 * token; the server re-checks is_admin on every call, so this page's
 * gate is only cosmetic (same pattern as /admin/content).
 */

type Gate = "loading" | "denied" | "ready";

interface Grant {
  email: string;
  granted_by: string | null;
  created_at: string;
}

const labelCls =
  "mb-1.5 block text-[11px] font-bold uppercase tracking-[0.22em] text-gold";

const pillCls =
  "rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 font-bold uppercase tracking-widest text-gold-soft";

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function AdminUsersPage() {
  const [gate, setGate] = useState<Gate>("loading");
  const [token, setToken] = useState<string | null>(null);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyEmail, setBusyEmail] = useState<string | null>(null);

  const load = useCallback(async (tok: string) => {
    try {
      const res = await fetch("/api/admin/pro", {
        headers: { Authorization: `Bearer ${tok}` },
      });
      if (!res.ok) return false;
      const json = (await res.json()) as { grants?: Grant[] };
      setGrants(Array.isArray(json.grants) ? json.grants : []);
      return true;
    } catch {
      return false;
    }
  }, []);

  // Gate: same pattern as /admin/content — session token, then a
  // probe load; a 403 lands on "Admins only".
  useEffect(() => {
    let live = true;
    void (async () => {
      const sb = getSupabase();
      if (!sb) {
        if (live) setGate("denied");
        return;
      }
      const { data } = await sb.auth.getSession();
      const tok = data.session?.access_token ?? null;
      if (!tok) {
        if (live) setGate("denied");
        return;
      }
      const ok = await load(tok);
      if (!live) return;
      if (!ok) {
        setGate("denied");
        return;
      }
      setToken(tok);
      setGate("ready");
    })();
    return () => {
      live = false;
    };
  }, [load]);

  const grant = async () => {
    if (!token) return;
    const value = email.trim();
    if (!value) {
      setStatus("Enter an email address first.");
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/admin/pro", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email: value }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        appliedNow?: boolean;
        alreadyOwner?: boolean;
      };
      if (!res.ok) {
        setStatus(json.error ?? "Grant failed — try again.");
        return;
      }
      setEmail("");
      setStatus(
        json.alreadyOwner
          ? "That email is an owner admin — it already has every plan free."
          : json.appliedNow
            ? "Pro granted — it's live on their account now."
            : "Grant saved — Pro switches on automatically when they sign up with this email."
      );
      await load(token);
    } catch {
      setStatus("Grant failed — check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (g: Grant) => {
    if (!token) return;
    if (
      !window.confirm(
        `Revoke Pro for ${g.email}? Their account drops back to the free plan.`
      )
    ) {
      return;
    }
    setBusyEmail(g.email);
    setStatus(null);
    try {
      const res = await fetch("/api/admin/pro", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email: g.email }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!res.ok) {
        setStatus(json.error ?? "Revoke failed — try again.");
        return;
      }
      setStatus(`Pro revoked for ${g.email}.`);
      await load(token);
    } catch {
      setStatus("Revoke failed — check your connection and try again.");
    } finally {
      setBusyEmail(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-12 sm:py-16">
      <Eyebrow>Users &amp; Pro · admin</Eyebrow>
      <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-bone sm:text-4xl">
        Admins &amp; Pro grants
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
        The two owner accounts below run everything — every plan free,
        full panel access, impossible to revoke. Grant Pro to any
        other email and it lands instantly, or automatically the
        moment they sign up.{" "}
        <Link href="/admin/content" className="font-semibold text-gold hover:underline">
          All content →
        </Link>{" "}
        <Link href="/admin/portal" className="font-semibold text-gold hover:underline">
          Portal review queues →
        </Link>
      </p>

      {gate === "loading" && (
        <Card className="mt-10">
          <p className="text-sm text-muted">Checking your admin access…</p>
        </Card>
      )}

      {gate === "denied" && (
        <Card className="mt-10">
          <p className="font-display text-lg font-bold text-bone">Admins only</p>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            This console is restricted to the site owner&apos;s admin
            account. If that&apos;s you, sign in with the admin email
            and reload this page.
          </p>
          <Button href="/login" className="mt-5">
            Sign in
          </Button>
        </Card>
      )}

      {gate === "ready" && token && (
        <>
          {/* Owner admins — locked rows */}
          <h2 className="mt-10 font-display text-xl font-extrabold text-bone">
            Owner admins
          </h2>
          <div className="mt-4 space-y-3">
            {OWNER_ADMIN_EMAILS.map((owner) => (
              <Card key={owner} className="!p-4">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-sm font-bold text-bone">
                      {owner}
                    </p>
                    <p className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-muted">
                      <span className={pillCls}>Owner admin</span>
                      <span className="rounded-full border border-white/15 bg-white/[0.05] px-2 py-0.5 font-bold uppercase tracking-widest text-bone">
                        All plans free
                      </span>
                      <span className="rounded-full border border-white/15 bg-white/[0.05] px-2 py-0.5 font-bold uppercase tracking-widest text-bone">
                        Full access
                      </span>
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] font-bold uppercase tracking-widest text-muted">
                    🔒 Locked
                  </span>
                </div>
              </Card>
            ))}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted">
            Owner admins keep admin + Pro permanently — there is no
            revoke for these two accounts, here or anywhere else.
          </p>

          {/* Grant form */}
          <h2 className="mt-10 font-display text-xl font-extrabold text-bone">
            Grant Pro
          </h2>
          <Card className="mt-4">
            <label className="block">
              <span className={labelCls}>Email address</span>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void grant();
                }}
                type="email"
                maxLength={254}
                className="input-premium w-full"
                placeholder="someone@example.com"
              />
            </label>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              If they already have an account, Pro switches on right
              now. If not, the grant waits and applies automatically
              when they sign up with this exact email.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-4">
              <Button
                onClick={() => void grant()}
                disabled={busy}
                className="px-6 py-2.5 text-xs"
              >
                {busy ? "Granting…" : "Grant Pro"}
              </Button>
              {status && (
                <span className="text-xs font-semibold text-gold-soft">
                  {status}
                </span>
              )}
            </div>
          </Card>

          {/* Grants list */}
          <h2 className="mt-10 font-display text-xl font-extrabold text-bone">
            Pro grants ({grants.length})
          </h2>
          {grants.length === 0 ? (
            <Card className="mt-4">
              <p className="font-display text-lg font-bold text-bone">
                No grants yet
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Nobody has been granted Pro yet. Add an email above —
                owners are already covered and never appear here.
              </p>
            </Card>
          ) : (
            <div className="mt-4 space-y-3">
              {grants.map((g) => (
                <Card key={g.email} className="!p-4">
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display text-sm font-bold text-bone">
                        {g.email}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted">
                        {g.granted_by
                          ? `Granted by ${g.granted_by}`
                          : "Granted"}
                        {g.created_at ? ` · ${formatDate(g.created_at)}` : ""}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      onClick={() => void revoke(g)}
                      disabled={busyEmail !== null}
                      className="shrink-0 px-4 py-2 text-xs"
                    >
                      {busyEmail === g.email ? "Revoking…" : "Revoke"}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
