"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card, Eyebrow } from "@/components/ui";
import { Reveal } from "@/components/motion";
import { getSupabase, supabaseConfigured } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("confirmed") === "1") {
      setNotice("Email verified — log in to open your account.");
    }
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const sb = getSupabase();
    if (!sb) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const { error: err } = await sb.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (err) {
      if (/email not confirmed/i.test(err.message)) {
        setError(
          "Your email isn't verified yet. Open the confirmation link in your inbox first — then log in.",
        );
      } else if (/invalid login credentials/i.test(err.message)) {
        setError("That email/password pair doesn't match. Try again, or reset your password below.");
      } else {
        setError(err.message);
      }
      return;
    }
    router.push("/dashboard");
  };

  const onForgot = async () => {
    const sb = getSupabase();
    if (!sb) return;
    if (!email.trim()) {
      setError("Enter your email above first, then tap forgot password.");
      return;
    }
    setError(null);
    const { error: err } = await sb.auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo: `${window.location.origin}/reset-password` },
    );
    if (err) setError(err.message);
    else setNotice("Password reset email sent — check your inbox.");
  };

  return (
    <div className="mx-auto max-w-md px-4 py-14 sm:px-6 sm:py-20">
      <Reveal>
        <div className="text-center">
          <Eyebrow>Welcome back</Eyebrow>
          <h1 className="font-display mt-4 text-4xl font-extrabold tracking-tight">
            Log in to <span className="gold-text">Mewmax</span>
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Your scans, scores and plans live in your account — pick up
            right where you left off.
          </p>
        </div>
      </Reveal>
      <Reveal delay={0.08} className="mt-8">
        <Card>
          {!supabaseConfigured() ? (
            <p className="text-sm leading-relaxed text-muted">
              Accounts are launching in a moment — your free scan works
              without one, and nothing you measure is stored anywhere.
            </p>
          ) : (
            <form onSubmit={onSubmit} className="space-y-3">
              {notice && (
                <p className="rounded-2xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm font-semibold text-gold-soft">
                  {notice}
                </p>
              )}
              {error && (
                <p className="rounded-2xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm font-semibold text-red-200">
                  {error}
                </p>
              )}
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                aria-label="Email"
                autoComplete="email"
                className="input-premium w-full"
              />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                aria-label="Password"
                autoComplete="current-password"
                className="input-premium w-full"
              />
              <Button type="submit" className="w-full py-3.5" disabled={busy}>
                {busy ? "Logging in…" : "Log in"}
              </Button>
              <button
                type="button"
                onClick={onForgot}
                className="w-full text-center text-sm font-semibold text-muted transition hover:text-gold-soft"
              >
                Forgot your password?
              </button>
            </form>
          )}
        </Card>
      </Reveal>
      <p className="mt-6 text-center text-sm text-muted">
        New here?{" "}
        <Link
          href="/signup"
          className="font-bold text-gold-soft underline-offset-2 hover:underline"
        >
          Create your free account
        </Link>
      </p>
    </div>
  );
}
