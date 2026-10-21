"use client";

import { useEffect, useState } from "react";
import { usePortal } from "@/components/portal/PortalShell";
import { PageHeading } from "@/components/portal/ui";
import { loadAccounts, TIER1_COUNTRIES, type Tier } from "@/lib/portal";

const TIER1_FLAGS: [string, string][] = [
  ["US", "🇺🇸"],
  ["CA", "🇨🇦"],
  ["GB", "🇬🇧"],
  ["AU", "🇦🇺"],
  ["DE", "🇩🇪"],
  ["FR", "🇫🇷"],
  ["NL", "🇳🇱"],
  ["SE", "🇸🇪"],
  ["DK", "🇩🇰"],
  ["CH", "🇨🇭"],
  ["NZ", "🇳🇿"],
  ["PL", "🇵🇱"],
  ["IT", "🇮🇹"],
];

function TierCard({
  tier,
  audience,
  requirement,
  bonuses,
  maxLabel,
  qualified,
}: {
  tier: Tier;
  audience: React.ReactNode;
  requirement: string;
  bonuses: string[];
  maxLabel: string;
  qualified: boolean;
}) {
  return (
    <div
      className={`relative rounded-2xl border p-6 sm:p-8 ${
        qualified
          ? "border-[#5EEAD4]/50 bg-[#5EEAD4]/[0.04]"
          : "border-white/10 bg-white/[0.02]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-display text-2xl font-extrabold tracking-tight text-bone">
          🌿 {tier}
        </h2>
        {qualified ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#5EEAD4]/40 bg-[#5EEAD4]/10 px-3 py-1 text-xs font-bold text-[#5EEAD4]">
            ✓ You qualify
          </span>
        ) : (
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1 text-xs font-bold text-muted"
            title="Not qualified yet"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              aria-hidden
            >
              <rect x="5" y="11" width="14" height="9" rx="2" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" />
            </svg>
            Locked
          </span>
        )}
      </div>

      <div className="mt-4">{audience}</div>

      <span className="mt-4 inline-block rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-bold text-bone">
        {requirement}
      </span>

      <ul className="mt-5 space-y-1.5">
        {bonuses.map((b) => (
          <li key={b} className="font-display text-lg font-bold text-bone">
            {b}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm font-bold text-[#5EEAD4]">{maxLabel}</p>
    </div>
  );
}

export default function PortalOffersPage() {
  const { sb, profile } = usePortal();
  const [qualifiedTiers, setQualifiedTiers] = useState<Set<Tier>>(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const accounts = await loadAccounts(sb, profile.id);
      if (cancelled) return;
      const tiers = new Set<Tier>();
      for (const a of accounts) {
        if (a.status === "approved" && a.tier) tiers.add(a.tier);
      }
      setQualifiedTiers(tiers);
    })();
    return () => {
      cancelled = true;
    };
  }, [sb, profile.id]);

  return (
    <div>
      <PageHeading
        title="Current Offers"
        sub="Accounts are placed into an earning tier based on their audience demographics"
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <TierCard
          tier="BASIC"
          qualified={qualifiedTiers.has("BASIC")}
          audience={
            <>
              <p className="text-sm font-semibold text-bone">
                20% Tier-1 audience
              </p>
              <p className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-lg" aria-label={TIER1_COUNTRIES}>
                {TIER1_FLAGS.map(([code, flag]) => (
                  <span key={code} title={code}>
                    {flag}
                  </span>
                ))}
              </p>
              <p className="mt-1 text-xs text-muted">{TIER1_COUNTRIES}</p>
            </>
          }
          requirement="10k+ views / 28d"
          bonuses={["+$20 @ 40k views", "+$30 @ 500k views", "+$50 @ 1M views"]}
          maxLabel="$100 max per video"
        />
        <TierCard
          tier="ELITE"
          qualified={qualifiedTiers.has("ELITE")}
          audience={
            <>
              <p className="text-sm font-semibold text-bone">
                40% USA audience <span className="text-lg">🇺🇸</span>
              </p>
              <p className="mt-1 text-xs text-muted">
                The top deal — a heavily-US audience earns the full ladder.
              </p>
            </>
          }
          requirement="500k+ views / 28d · 5+ videos"
          bonuses={[
            "+$20 @ 40k views",
            "+$30 @ 100k views",
            "+$100 @ 500k views",
            "+$150 @ 1M views",
          ]}
          maxLabel="$300 max per video"
        />
      </div>

      <p className="mt-6 text-sm leading-relaxed text-muted">
        Your tier is set when your account&apos;s verification is approved —
        send your 28-day audience demographics in{" "}
        <a href="/portal/verification" className="font-semibold text-[#5EEAD4] hover:underline">
          Verification
        </a>
        . Maintain your Tier-1 share after acceptance: accounts that drop
        below their tier&apos;s audience requirement can have payments
        reduced or voided.
      </p>
    </div>
  );
}
