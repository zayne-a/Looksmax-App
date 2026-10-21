"use client";

import { useEffect, useMemo, useState } from "react";
import { usePortal } from "@/components/portal/PortalShell";
import {
  MonthSelect,
  PageHeading,
  StatCard,
  TierBadge,
  PlatformGlyph,
} from "@/components/portal/ui";
import {
  formatMoney,
  formatViews,
  loadAccounts,
  loadSubmissions,
  monthKey,
  monthOptions,
  REFERRAL_BONUS_CENTS,
  submissionEarnedCents,
  submissionProjectedCents,
  type ConnectedAccount,
  type Referral,
  type VideoSubmission,
} from "@/lib/portal";

/** Live countdown to the end of the current month, rendered as his
 *  four segmented boxes: "10d : 08h : 12m : 29s". */
function useMonthCountdown(): { value: string; unit: string }[] {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  let diff = Math.max(0, Math.floor((end.getTime() - now.getTime()) / 1000));
  const d = Math.floor(diff / 86400);
  diff -= d * 86400;
  const h = Math.floor(diff / 3600);
  diff -= h * 3600;
  const m = Math.floor(diff / 60);
  const s = diff - m * 60;
  const pad = (n: number) => `${n}`.padStart(2, "0");
  return [
    { value: `${d}`, unit: "d" },
    { value: pad(h), unit: "h" },
    { value: pad(m), unit: "m" },
    { value: pad(s), unit: "s" },
  ];
}

export default function PortalDashboardPage() {
  const { sb, profile } = usePortal();
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [submissions, setSubmissions] = useState<VideoSubmission[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState<string>(() => monthKey(new Date()));
  const countdown = useMonthCountdown();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [accs, subs, refs] = await Promise.all([
        loadAccounts(sb, profile.id),
        loadSubmissions(sb, profile.id),
        sb
          .from("referrals")
          .select("*")
          .eq("referrer_id", profile.id)
          .then((r) => (r.data as Referral[] | null) ?? []),
      ]);
      if (cancelled) return;
      setAccounts(accs);
      setSubmissions(subs);
      setReferrals(refs);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [sb, profile.id]);

  const tierByAccount = useMemo(() => {
    const map = new Map<string, ConnectedAccount["tier"]>();
    for (const a of accounts) map.set(a.id, a.tier);
    return map;
  }, [accounts]);

  const stats = useMemo(() => {
    const inFilter = (s: VideoSubmission) =>
      filter === "all" || s.month === filter;
    const set = submissions.filter(inFilter);
    const approved = set.filter((s) => s.status === "approved");
    const pending = set.filter((s) => s.status === "pending");
    const counted = set.filter((s) => s.status !== "rejected");
    const referralBonus = referrals
      .filter((r) => r.status === "qualified")
      .filter(
        (r) =>
          filter === "all" ||
          (r.qualified_at && monthKey(new Date(r.qualified_at)) === filter)
      ).length * REFERRAL_BONUS_CENTS;
    return {
      verified:
        approved.reduce((sum, s) => sum + submissionEarnedCents(s), 0) +
        referralBonus,
      unverified: pending.reduce(
        (sum, s) => sum + submissionProjectedCents(s, tierByAccount.get(s.account_id)),
        0
      ),
      posts: counted.length,
      views: counted.reduce((sum, s) => sum + s.locked_views, 0),
    };
  }, [submissions, referrals, filter, tierByAccount]);

  const approvedAccounts = accounts.filter((a) => a.status === "approved");
  const options = monthOptions();

  return (
    <div>
      <PageHeading
        title="Dashboard"
        sub="Track your performance and earnings"
        right={
          <MonthSelect value={filter} onChange={setFilter} options={options} />
        }
      />

      <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.02] p-5 text-center">
        <div
          className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2"
          data-testid="countdown"
        >
          {countdown.map((seg, i) => (
            <span key={seg.unit} className="flex items-center gap-1.5 sm:gap-2">
              {i > 0 ? (
                <span className="font-display text-xl font-extrabold text-muted">
                  :
                </span>
              ) : null}
              <span
                data-testid="countdown-seg"
                className="inline-flex min-w-[64px] items-baseline justify-center rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5"
              >
                <span className="font-display text-2xl font-extrabold tabular-nums text-bone">
                  {seg.value}
                </span>
                <span className="ml-1 text-xs font-semibold text-muted">
                  {seg.unit}
                </span>
              </span>
            </span>
          ))}
        </div>
        <div className="mt-3 text-sm text-muted">
          remaining to submit for this month
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Verified Earnings" value={formatMoney(stats.verified)} />
        <StatCard label="Unverified Earnings" value={formatMoney(stats.unverified)} />
        <StatCard label="Posts" value={`${stats.posts}`} />
        <StatCard label="Views" value={formatViews(stats.views)} />
      </div>

      <h2 className="mt-10 font-display text-xl font-extrabold text-bone">
        Your Active Accounts &amp; Deals
      </h2>
      <p className="mt-1 text-sm text-muted">
        Each account earns based on the tier it was approved at.
      </p>

      <div className="mt-4">
        {!loaded ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-sm text-muted">
            Loading your accounts…
          </div>
        ) : approvedAccounts.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8">
            <p className="font-semibold text-bone">No verified accounts yet.</p>
            <p className="mt-1 text-sm text-muted">
              Connect and verify an account in Settings to start earning.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {approvedAccounts.map((a) => (
              <div
                key={a.id}
                className="rounded-2xl border border-white/10 bg-white/[0.02] p-5"
              >
                <div className="flex items-center gap-3">
                  <span className="text-bone">
                    <PlatformGlyph platform={a.platform} size={20} />
                  </span>
                  <span className="min-w-0 flex-1 truncate font-semibold text-bone">
                    @{a.handle}
                  </span>
                  <TierBadge tier={a.tier} />
                </div>
                <p className="mt-3 text-xs leading-relaxed text-muted">
                  {a.tier === "ELITE"
                    ? "+$20 @ 40k views · +$30 @ 100k · +$100 @ 500k · +$150 @ 1M — $300 max per video"
                    : "+$20 @ 40k views · +$30 @ 500k · +$50 @ 1M — $100 max per video"}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
