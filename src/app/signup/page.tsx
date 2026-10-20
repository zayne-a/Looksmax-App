"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card, Eyebrow } from "@/components/ui";
import { Reveal } from "@/components/motion";
import { getSupabase, supabaseConfigured } from "@/lib/supabase";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const sb = getSupabase();
    if (!sb) return;
    setError(null);
    if (password.length < 8) {
      setError("Use at least 8 characters for your password.");
      return;
    }
    if (password !== confirm) {
      setError("Those passwords don't match.");
      return;
    }
    setBusy(true);
    const { data, error: err } = await sb.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/login?confirmed=1`,
      },
    });
    setBusy(false);
    if (err) {
      if (/already registered/i.test(err.message)) {
        setError("That email already has an account — log in instead.");
      } else {
        setError(err.message);
      }
      return;
    }
    // With email confirmation on, signUp returns no session: verify first.
    if (data.session) {
      router.push("/dashboard");
      return;
    }
    setSentTo(email.trim());
  };

  return (
    <div className="mx-auto max-w-md px-4 py-14 sm:px-6 sm:py-20">
      <Reveal>
        <div className="text-center">
          <Eyebrow>Your account</Eyebrow>
          <h1 className="font-display mt-4 text-4xl font-extrabold tracking-tight">
            Save every scan. <span className="gold-text">Watch the climb.</span>
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            An account saves your measurements, scores and plans so you
            can leave and come back — your photos are still measured
            on-device and never uploaded.
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
          ) : sentTo ? (
            <div className="text-center">
              <p className="font-display text-xl font-extrabold text-bone">
                Check your email
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                We sent a verification link to{" "}
                <span className="font-bold text-bone">{sentTo}</span>.
                Verify your email, then log in — nobody gets in
                unverified, including us. Your scans and plans will save
                to this account from then on.
              </p>
              <Button href="/login" className="mt-5 px-8 py-3">
                Go to log in
              </Button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-3">
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
                placeholder="Password (8+ characters)"
                aria-label="Password"
                autoComplete="new-password"
                className="input-premium w-full"
              />
              <input
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Confirm password"
                aria-label="Confirm password"
                autoComplete="new-password"
                className="input-premium w-full"
              />
              <Button type="submit" className="w-full py-3.5" disabled={busy}>
                {busy ? "Creating…" : "Create free account"}
              </Button>
              <p className="text-center text-xs leading-relaxed text-muted">
                Free forever for your first scan and scores. We email you
                once to verify — no spam, ever.
              </p>
            </form>
          )}
        </Card>
      </Reveal>
      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-bold text-gold-soft underline-offset-2 hover:underline"
        >
          Log in
        </Link>
      </p>
    </div>
  );
}
