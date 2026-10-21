"use client";

import { useEffect, useState } from "react";
import { usePortal } from "@/components/portal/PortalShell";
import { PageHeading, WhiteButton } from "@/components/portal/ui";
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

const ACCEPT_STEPS = [
  "Go to Settings and connect your TikTok or Instagram account.",
  "Submit a screen recording of your audience demographics in Verification.",
  "An admin reviews your recording — your account is rejected or placed into a tier.",
];

const TIER_DETAILS: Record<
  Tier,
  { tagline: string; qualify: string[]; payoutNote: string }
> = {
  BASIC: {
    tagline: "Tier for accounts with a meaningful Tier-1 audience.",
    qualify: [
      "20% or more of your views in the last 28 days come from Tier-1 countries (US, Canada, UK, Australia, Germany, France, Netherlands, Sweden, Denmark, Switzerland, New Zealand, Poland, Italy).",
      "At least 10,000 views in the last 28 days.",
    ],
    payoutNote:
      "Bonuses stack as a video climbs: at 1M views a video has earned $20 + $30 + $50 = $100 — the $100 max per video.",
  },
  ELITE: {
    tagline: "Tier for accounts with a heavily US audience.",
    qualify: [
      "40% or more of your views in the last 28 days come from the US specifically — other Tier-1 countries don't count.",
      "At least 500,000 views in the last 28 days, across 5 or more videos.",
    ],
    payoutNote:
      "Bonuses stack as a video climbs: at 1M views a video has earned $20 + $30 + $100 + $150 = $300 — the $300 max per video.",
  },
};

function TierDialog({
  tier,
  bonuses,
  onClose,
}: {
  tier: Tier;
  bonuses: string[];
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const details = TIER_DETAILS[tier];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={`${tier} tier details`}
      data-testid="offer-dialog"
      onClick={onClose}
    >
      <div
        className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[#111113] p-6 shadow-2xl sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-display text-2xl font-extrabold text-bone">
              🌿 {tier} Tier
            </h3>
            <p className="mt-1 text-sm text-muted">{details.tagline}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 text-muted transition hover:text-bone"
          >
            ✕
          </button>
        </div>

        <h4 className="mt-6 font-display text-base font-extrabold text-bone">
          How to qualify
        </h4>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted">
          {details.qualify.map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ul>

        <h4 className="mt-6 font-display text-base font-extrabold text-bone">
          Payout structure
        </h4>
        <ul className="mt-2 space-y-1">
          {bonuses.map((b) => (
            <li key={b} className="font-display text-base font-bold text-bone">
              {b}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {details.payoutNote}
        </p>

        <h4 className="mt-6 font-display text-base font-extrabold text-bone">
          How to get accepted
        </h4>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-muted">
          {ACCEPT_STEPS.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>

        <div className="mt-7 flex justify-end">
          <WhiteButton onClick={onClose}>Close</WhiteButton>
        </div>
      </div>
    </div>
  );
}

function TierCard({
  tier,
  audience,
  requirement,
  bonuses,
  maxLabel,
  qualified,
  onOpen,
}: {
  tier: Tier;
  audience: React.ReactNode;
  requirement: string;
  bonuses: string[];
  maxLabel: string;
  qualified: boolean;
  onOpen: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      data-testid={`offer-card-${tier.toLowerCase()}`}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className={`relative cursor-pointer rounded-2xl border p-6 transition hover:border-white/30 focus:outline-none focus-visible:border-[#5EEAD4]/60 sm:p-8 ${
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

const TIER_BONUSES: Record<Tier, string[]> = {
  BASIC: ["+$20 @ 40k views", "+$30 @ 500k views", "+$50 @ 1M views"],
  ELITE: [
    "+$20 @ 40k views",
    "+$30 @ 100k views",
    "+$100 @ 500k views",
    "+$150 @ 1M views",
  ],
};

export default function PortalOffersPage() {
  const { sb, profile } = usePortal();
  const [qualifiedTiers, setQualifiedTiers] = useState<Set<Tier>>(new Set());
  const [openTier, setOpenTier] = useState<Tier | null>(null);

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
          onOpen={() => setOpenTier("BASIC")}
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
          bonuses={TIER_BONUSES.BASIC}
          maxLabel="$100 max per video"
        />
        <TierCard
          tier="ELITE"
          qualified={qualifiedTiers.has("ELITE")}
          onOpen={() => setOpenTier("ELITE")}
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
          bonuses={TIER_BONUSES.ELITE}
          maxLabel="$300 max per video"
        />
      </div>

      {openTier ? (
        <TierDialog
          tier={openTier}
          bonuses={TIER_BONUSES[openTier]}
          onClose={() => setOpenTier(null)}
        />
      ) : null}

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
