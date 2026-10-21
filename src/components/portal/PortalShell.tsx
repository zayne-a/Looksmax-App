"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";
import {
  captureRefFromUrl,
  ensureCreatorProfile,
  type CreatorProfile,
} from "@/lib/portal";

/**
 * Portal shell (2026-10-22): owns the portal's auth state. Logged
 * out, every /portal route shows the reference app's login wall
 * (logo, "Mewmax Creator Portal", one Discord button). Logged in, it
 * renders his layout: left sidebar with the eight sections in his
 * order, the Discord user chip + Sign Out pinned to the bottom.
 * First login creates the creator profile (see lib/portal).
 */

interface PortalContextValue {
  sb: SupabaseClient;
  user: User;
  profile: CreatorProfile;
}

const PortalContext = createContext<PortalContextValue | null>(null);

export function usePortal(): PortalContextValue {
  const ctx = useContext(PortalContext);
  if (!ctx) throw new Error("usePortal must be used inside PortalShell");
  return ctx;
}

type Gate = "loading" | "wall" | "ready" | "profile-error";

const NAV: { href: string; label: string; icon: ReactNode }[] = [
  {
    href: "/portal",
    label: "Dashboard",
    icon: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </>
    ),
  },
  {
    href: "/portal/submit",
    label: "Submit Video",
    icon: (
      <>
        <path d="M12 16V5" />
        <path d="m7 9 5-5 5 5" />
        <path d="M4 20h16" />
      </>
    ),
  },
  {
    href: "/portal/verification",
    label: "Verification",
    icon: (
      <>
        <path d="M12 3l7 3v5c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6l7-3Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
  },
  {
    href: "/portal/videos",
    label: "My Videos",
    icon: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="3" />
        <path d="m10 9.5 5 2.5-5 2.5v-5Z" />
      </>
    ),
  },
  {
    href: "/portal/leaderboard",
    label: "Leaderboard",
    icon: (
      <>
        <path d="M8 21h8" />
        <path d="M12 17v4" />
        <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
        <path d="M7 6H4a1 1 0 0 0-1 1c0 2 1.5 3.5 4 3.5" />
        <path d="M17 6h3a1 1 0 0 1 1 1c0 2-1.5 3.5-4 3.5" />
      </>
    ),
  },
  {
    href: "/portal/offers",
    label: "Offers",
    icon: (
      <>
        <path d="M3 3h8l10 10-8 8L3 11V3Z" />
        <circle cx="8" cy="8" r="1.6" />
      </>
    ),
  },
  {
    href: "/portal/referrals",
    label: "Referrals",
    icon: (
      <>
        <circle cx="9" cy="8" r="3.5" />
        <path d="M3 20c.6-3.2 3-5 6-5s5.4 1.8 6 5" />
        <path d="M16 5.5a3.5 3.5 0 0 1 0 6" />
        <path d="M18.5 15.5c1.8.7 3 2.2 3.4 4.5" />
      </>
    ),
  },
  {
    href: "/portal/settings",
    label: "Settings",
    icon: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19 12a7 7 0 0 0-.14-1.4l2.1-1.63-2-3.46-2.49 1a7 7 0 0 0-2.42-1.4L13.66 2h-3.32L9.95 5.11a7 7 0 0 0-2.42 1.4l-2.49-1-2 3.46L5.14 10.6A7 7 0 0 0 5 12c0 .48.05.94.14 1.4L3.04 15.03l2 3.46 2.49-1a7 7 0 0 0 2.42 1.4l.39 3.11h3.32l.39-3.11a7 7 0 0 0 2.42-1.4l2.49 1 2-3.46-2.1-1.63c.09-.46.14-.92.14-1.4Z" />
      </>
    ),
  },
];

function NavIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="shrink-0"
    >
      {children}
    </svg>
  );
}

function DiscordGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20.32 4.37a19.8 19.8 0 0 0-4.93-1.51 13.8 13.8 0 0 0-.64 1.28 18.3 18.3 0 0 1-5.5 0 13.8 13.8 0 0 0-.64-1.28h-.05A19.7 19.7 0 0 0 3.64 4.37C.53 9.05-.32 13.58.1 18.06a19.9 19.9 0 0 0 6.04 3.03c.49-.66.93-1.37 1.3-2.1a12.9 12.9 0 0 1-2.05-.98c.17-.12.34-.25.5-.38a14.2 14.2 0 0 0 12.22 0c.16.13.33.26.5.38-.65.39-1.34.72-2.05.98.37.73.81 1.44 1.3 2.1a19.8 19.8 0 0 0 6.04-3.03c.5-5.18-.83-9.68-3.58-13.69ZM8.02 15.33c-1.18 0-2.16-1.08-2.16-2.42s.95-2.42 2.16-2.42 2.18 1.09 2.16 2.42c0 1.34-.95 2.42-2.16 2.42Zm7.96 0c-1.18 0-2.16-1.08-2.16-2.42s.95-2.42 2.16-2.42 2.18 1.09 2.16 2.42c0 1.34-.95 2.42-2.16 2.42Z" />
    </svg>
  );
}

function LoginWall() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const login = async () => {
    const sb = getSupabase();
    if (!sb) {
      setError("Accounts aren't configured on this deployment.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error: oauthError } = await sb.auth.signInWithOAuth({
      provider: "discord",
      options: { redirectTo: `${window.location.origin}/portal` },
    });
    if (oauthError) {
      setBusy(false);
      setError(
        "Discord login isn't switched on yet — we're enabling it right now. Try again in a little while."
      );
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-16">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/icon.png"
        alt="Mewmax"
        width={72}
        height={72}
        className="rounded-2xl"
      />
      <h1 className="mt-6 text-center font-display text-3xl font-extrabold tracking-tight text-bone">
        Mewmax Creator Portal
      </h1>
      <button
        type="button"
        onClick={login}
        disabled={busy}
        className="mt-8 inline-flex items-center gap-2.5 rounded-full bg-[#5865F2] px-7 py-3 text-sm font-bold text-white transition hover:bg-[#4752c4] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <DiscordGlyph />
        {busy ? "Opening Discord…" : "Log in with Discord"}
      </button>
      {error ? (
        <p className="mt-4 max-w-sm text-center text-sm text-red-300">{error}</p>
      ) : null}
      <Link
        href="/"
        className="mt-10 text-sm font-semibold text-muted transition hover:text-[#5EEAD4]"
      >
        ← Back to Mewmax
      </Link>
    </div>
  );
}

export default function PortalShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [gate, setGate] = useState<Gate>("loading");
  const [ctx, setCtx] = useState<PortalContextValue | null>(null);
  const bootstrappedFor = useRef<string | null>(null);

  const bootstrap = useCallback(async () => {
    const sb = getSupabase();
    if (!sb) {
      setGate("wall");
      return;
    }
    const { data } = await sb.auth.getSession();
    const user = data.session?.user ?? null;
    if (!user) {
      bootstrappedFor.current = null;
      setCtx(null);
      setGate("wall");
      return;
    }
    if (bootstrappedFor.current === user.id && ctx) {
      setGate("ready");
      return;
    }
    bootstrappedFor.current = user.id;
    const profile = await ensureCreatorProfile(sb, user);
    if (!profile) {
      setCtx(null);
      setGate("profile-error");
      return;
    }
    setCtx({ sb, user, profile });
    setGate("ready");
  }, [ctx]);

  useEffect(() => {
    captureRefFromUrl();
  }, []);

  useEffect(() => {
    void bootstrap();
    const sb = getSupabase();
    if (!sb) return;
    const { data: sub } = sb.auth.onAuthStateChange(() => {
      void bootstrap();
    });
    return () => sub.subscription.unsubscribe();
    // bootstrap reads the latest session each call; re-running it on
    // mount + auth events is the whole design.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signOut = async () => {
    const sb = getSupabase();
    await sb?.auth.signOut();
    bootstrappedFor.current = null;
    setCtx(null);
    setGate("wall");
  };

  if (gate === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-[#5EEAD4]" />
      </div>
    );
  }

  if (gate === "wall") return <LoginWall />;

  if (gate === "profile-error" || !ctx) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
        <h1 className="font-display text-2xl font-extrabold text-bone">
          The portal is still warming up
        </h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">
          You&apos;re signed in with Discord, but creator profiles
          aren&apos;t reachable yet — the portal database is being
          switched on. Try again shortly.
        </p>
        <button
          type="button"
          onClick={signOut}
          className="mt-6 rounded-full border border-white/15 px-5 py-2.5 text-sm font-bold text-bone transition hover:border-[#5EEAD4]/60 hover:text-[#5EEAD4]"
        >
          Sign Out
        </button>
      </div>
    );
  }

  const { profile } = ctx;
  const displayName = profile.discord_username ?? "Creator";

  return (
    <PortalContext.Provider value={ctx}>
      <div className="min-h-screen bg-[#0a0a0c] lg:flex">
        {/* Sidebar (desktop) / top bar (mobile) */}
        <aside className="border-b border-white/10 lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-64 lg:flex-col lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-3 px-5 py-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icon.png"
              alt=""
              width={34}
              height={34}
              className="rounded-lg"
            />
            <span className="font-display text-base font-extrabold tracking-tight text-bone">
              Mewmax Creator Portal
            </span>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-1 lg:flex-col lg:overflow-visible lg:px-3 lg:pb-0">
            {NAV.map((item) => {
              const active =
                item.href === "/portal"
                  ? pathname === "/portal"
                  : pathname === item.href ||
                    pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                    active
                      ? "bg-[#5EEAD4]/10 text-[#5EEAD4]"
                      : "text-muted hover:bg-white/[0.04] hover:text-bone"
                  }`}
                >
                  <NavIcon>{item.icon}</NavIcon>
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="hidden items-center gap-3 border-t border-white/10 px-5 py-4 lg:flex">
            {profile.discord_avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.discord_avatar_url}
                alt=""
                width={36}
                height={36}
                className="rounded-full"
              />
            ) : (
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#5EEAD4]/15 font-display text-sm font-extrabold text-[#5EEAD4]">
                {displayName.slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-bone">
              {displayName}
            </span>
            <button
              type="button"
              onClick={signOut}
              className="shrink-0 text-xs font-bold text-muted transition hover:text-[#5EEAD4]"
            >
              Sign Out
            </button>
          </div>
        </aside>

        <div className="lg:pl-64">
          <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8 lg:py-10">
            {children}
          </main>
          {/* Mobile sign-out (the sidebar chip is desktop-only) */}
          <div className="flex items-center justify-center gap-3 px-4 pb-10 lg:hidden">
            <span className="text-sm text-muted">Signed in as {displayName}</span>
            <button
              type="button"
              onClick={signOut}
              className="text-sm font-bold text-[#5EEAD4]"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </PortalContext.Provider>
  );
}
