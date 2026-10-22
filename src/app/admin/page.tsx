"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, Eyebrow } from "@/components/ui";
import AdminGate from "@/components/admin/AdminGate";

/**
 * /admin — the admin home (2026-10-22). One landing for every
 * section of the console plus a live stats strip from
 * /api/admin/overview (real service-role counts — nothing cached,
 * nothing estimated). The whole page sits behind AdminGate: anyone
 * who isn't a signed-in admin sees the app's 404 instead.
 */

interface Overview {
  totalUsers: number | null;
  proUsers: number | null;
  totalScans: number | null;
  signups7d: number | null;
  pendingVerifications: number | null;
  pendingSubmissions: number | null;
  forumPosts: number | null;
}

const SECTIONS: {
  href: string;
  title: string;
  text: string;
}[] = [
  {
    href: "/admin/content",
    title: "Content",
    text: "Funnel media, Omegle clips, replays, creator examples, research and animations — everything the site and app render.",
  },
  {
    href: "/admin/users",
    title: "Users & Pro",
    text: "Owner admins, Pro grants by email, the full user directory, and admin promotions.",
  },
  {
    href: "/admin/portal",
    title: "Portal review",
    text: "Creator verification requests and video submissions waiting for a decision.",
  },
  {
    href: "/admin/forum",
    title: "Forum moderation",
    text: "The community forum's latest posts and comments, with delete powers.",
  },
  {
    href: "/admin/settings",
    title: "App settings",
    text: "Maintenance mode, the home announcement, feature switches and the free-trial length.",
  },
  {
    href: "/admin/funnel",
    title: "Funnel media (legacy)",
    text: "The original funnel-slot console. The Content section covers the same slots now; this stays for the classic view.",
  },
];

function Stat({ label, value }: { label: string; value: number | null }) {
  return (
    <Card className="!p-4 text-center">
      <p className="font-display text-3xl font-extrabold text-bone">
        {value === null ? "—" : value.toLocaleString("en-US")}
      </p>
      <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.18em] text-muted">
        {label}
      </p>
    </Card>
  );
}

function OverviewHome({ token }: { token: string }) {
  const [stats, setStats] = useState<Overview | null>(null);

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const res = await fetch("/api/admin/overview", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const json = (await res.json()) as Overview;
        if (live) setStats(json);
      } catch {
        // Stats stay "—" — honest over invented.
      }
    })();
    return () => {
      live = false;
    };
  }, [token]);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:py-16">
      <Eyebrow>Admin · home</Eyebrow>
      <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-bone sm:text-4xl">
        Control room
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
        Everything you run Mewmax with — no code, no deploys. The
        numbers below are live counts from the database, refreshed on
        every visit.
      </p>

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total users" value={stats?.totalUsers ?? null} />
        <Stat label="Pro users" value={stats?.proUsers ?? null} />
        <Stat label="Total scans" value={stats?.totalScans ?? null} />
        <Stat label="Signups · 7 days" value={stats?.signups7d ?? null} />
        <Stat
          label="Verifications pending"
          value={stats?.pendingVerifications ?? null}
        />
        <Stat
          label="Videos pending"
          value={stats?.pendingSubmissions ?? null}
        />
        <Stat label="Forum posts" value={stats?.forumPosts ?? null} />
      </div>

      <div className="mt-10 grid gap-3 sm:grid-cols-2">
        {SECTIONS.map((s) => (
          <Link key={s.href} href={s.href} className="group block">
            <Card className="lift h-full !p-5">
              <p className="font-display text-lg font-extrabold text-bone group-hover:text-gold-soft">
                {s.title} →
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">
                {s.text}
              </p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function AdminHomePage() {
  return <AdminGate>{(token) => <OverviewHome token={token} />}</AdminGate>;
}
