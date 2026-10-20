"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Eyebrow } from "@/components/ui";
import { Reveal } from "@/components/motion";
import { getSupabase } from "@/lib/supabase";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // The recovery email link lands here with a recovery session in the
  // URL — supabase-js picks it up automatically; we just check it did.
  useEffect(() => {
    const sb = getSupabase();
    if (!sb) {
      setReady(false);
      return;
    }
    let cancelled = false;
    void sb.auth.getSession().then(({ data }) => {
      if (!cancelled) setReady(Boolean(data.session));
    });
    const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
      if (!cancelled && (event === "PASSWORD_RECOVERY" || session)) {
        setReady(true);
      }
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const sb = getSupabase();
    if (!sb) return;
    setError(null);
    if (password.length < 8) {
      setError("Use at least 8 characters for your new password.");
      return;
    }
    setBusy(true);
    const { error: err } = await sb.auth.updateUser({ password });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    router.push("/dashboard");
  };

  return (
    <div className="mx-auto max-w-md px-4 py-14 sm:px-6 sm:py-20">
      <Reveal>
        <div className="text-center">
          <Eyebrow>Account recovery</Eyebrow>
          <h1 className="font-display mt-4 text-4xl font-extrabold tracking-tight">
            Set a new <span className="gold-text">password</span>
          </h1>
        </div>
      </Reveal>
      <Reveal delay={0.08} className="mt-8">
        <Card>
          {ready === null ? (
            <p className="text-sm text-muted">Checking your reset link…</p>
          ) : !ready ? (
            <p className="text-sm leading-relaxed text-muted">
              This reset link is invalid or has expired. Request a fresh
              one from the{" "}
              <a href="/login" className="font-bold text-gold-soft underline">
                log in page
              </a>{" "}
              (Forgot your password?).
            </p>
          ) : (
            <form onSubmit={onSubmit} className="space-y-3">
              {error && (
                <p className="rounded-2xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm font-semibold text-red-200">
                  {error}
                </p>
              )}
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="New password (8+ characters)"
                aria-label="New password"
                autoComplete="new-password"
                className="input-premium w-full"
              />
              <Button type="submit" className="w-full py-3.5" disabled={busy}>
                {busy ? "Saving…" : "Save new password"}
              </Button>
            </form>
          )}
        </Card>
      </Reveal>
    </div>
  );
}
