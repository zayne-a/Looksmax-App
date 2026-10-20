# Bottom app navigation (mobile, MyFitnessPal pattern): Today / Progress / Records / More switch dashboard views in place when onNavigate is given; elsewhere they deep-link /dashboard?tab=. Centre + is the Scan action; Coach links to /coach. Hidden on sm+ where the dashboard app bar carries the tabs.
"use client";

import Link from "next/link";

export type AppTab = "today" | "progress" | "records" | "more";

const TABS: { id: AppTab; label: string; icon: string }[] = [
  { id: "today", label: "Today", icon: "◉" },
  { id: "progress", label: "Progress", icon: "▲" },
  { id: "records", label: "Records", icon: "▦" },
  { id: "more", label: "More", icon: "•••" },
];

/**
 * The app shell's bottom navigation (mobile pattern, MyFitnessPal
 * style) — Today / Progress / Records / More inside the dashboard,
 * with the Coach one tap away and Scan as the raised centre action.
 * On the dashboard it switches views in place; elsewhere it links.
 */
export default function AppNav({
  active,
  onNavigate,
}: {
  active: AppTab | "coach";
  onNavigate?: (tab: AppTab) => void;
}) {
  const tabButton = (t: { id: AppTab; label: string; icon: string }) => {
    const isActive = active === t.id;
    const cls = `flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-bold ${
      isActive ? "text-gold" : "text-muted"
    }`;
    if (onNavigate) {
      return (
        <button key={t.id} onClick={() => onNavigate(t.id)} className={cls}>
          <span className="text-base leading-none">{t.icon}</span>
          {t.label}
        </button>
      );
    }
    return (
      <Link
        key={t.id}
        href={t.id === "today" ? "/dashboard" : `/dashboard?tab=${t.id}`}
        className={cls}
      >
        <span className="text-base leading-none">{t.icon}</span>
        {t.label}
      </Link>
    );
  };

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#0d0b08]/95 backdrop-blur-md sm:hidden">
      <div className="mx-auto flex max-w-md items-end px-2 pb-[env(safe-area-inset-bottom)]">
        {tabButton(TABS[0])}
        {tabButton(TABS[1])}
        <Link
          href="/scan"
          className="mx-1 mb-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gold text-xl font-extrabold text-ink shadow-[0_6px_20px_-4px_rgba(227,185,78,0.7)]"
          aria-label="New scan"
        >
          +
        </Link>
        <Link
          href="/coach"
          className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-bold ${
            active === "coach" ? "text-gold" : "text-muted"
          }`}
        >
          <span className="text-base leading-none">✦</span>
          Coach
        </Link>
        {tabButton(TABS[2])}
        {tabButton(TABS[3])}
      </div>
    </nav>
  );
}
