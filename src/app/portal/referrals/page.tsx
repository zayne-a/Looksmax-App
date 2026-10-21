"use client";

import { useEffect, useMemo, useState } from "react";
import { usePortal } from "@/components/portal/PortalShell";
import { PageHeading, StatCard } from "@/components/portal/ui";
import {
  formatMoney,
  REFERRAL_BONUS_CENTS,
  type ReferralFriend,
} from "@/lib/portal";

const STEPS = [
  {
    title: "Share your link",
    body: "Send it to creators who are new to Mewmax.",
  },
  {
    title: "They sign up & get verified",
    body: "They join with Discord through your link and verify their account.",
  },
  {
    title: "First approved video = $20",
    body: "Added to your next monthly payout automatically.",
  },
];

export default function PortalReferralsPage() {
  const { sb, profile } = usePortal();
  const [friends, setFriends] = useState<ReferralFriend[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await sb.rpc("portal_referral_friends");
      if (cancelled) return;
      setFriends((data as ReferralFriend[] | null) ?? []);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [sb]);

  const inviteLink = useMemo(() => {
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/portal?ref=${profile.referral_code}`;
  }, [profile.referral_code]);

  const qualified = friends.filter((f) => f.status === "qualified");
  const inProgress = friends.filter((f) => f.status === "in_progress");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — the field is selectable manually
    }
  };

  return (
    <div>
      <PageHeading
        title="Referrals"
        sub="Earn $20 for every new creator whose first video gets approved."
      />

      <div className="grid grid-cols-3 gap-4">
        <StatCard
          label="$ Earned"
          value={formatMoney(qualified.length * REFERRAL_BONUS_CENTS)}
        />
        <StatCard label="Qualified" value={`${qualified.length}`} />
        <StatCard label="In progress" value={`${inProgress.length}`} />
      </div>

      <h2 className="mt-10 font-display text-xl font-extrabold text-bone">
        Your invite link
      </h2>
      <p className="mt-1 text-sm text-muted">$20 per creator, no limit.</p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <input
          readOnly
          value={inviteLink}
          onFocus={(e) => e.target.select()}
          className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-bone focus:border-[#5EEAD4]/60 focus:outline-none"
          aria-label="Your invite link"
        />
        <button
          type="button"
          onClick={copy}
          className="shrink-0 rounded-full bg-[#5EEAD4] px-6 py-3 text-sm font-bold text-[#0a0a0c] transition hover:bg-[#99f6e4]"
        >
          {copied ? "Copied!" : "Copy invite link"}
        </button>
      </div>

      <h2 className="mt-10 font-display text-xl font-extrabold text-bone">
        Your friends&apos; progress
      </h2>
      <div className="mt-4">
        {!loaded ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : friends.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8">
            <p className="font-semibold text-bone">No invites yet</p>
            <p className="mt-1 text-sm text-muted">
              Share your link. Friends show up here the moment they sign up.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-white/5 rounded-2xl border border-white/10">
            {friends.map((f) => (
              <li key={f.invitee_id} className="flex items-center gap-3 px-4 py-3">
                {f.discord_avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={f.discord_avatar_url}
                    alt=""
                    width={32}
                    height={32}
                    className="rounded-full"
                  />
                ) : (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#5EEAD4]/15 text-xs font-extrabold text-[#5EEAD4]">
                    {(f.discord_username ?? "?").slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span className="flex-1 font-semibold text-bone">
                  {f.discord_username ?? "Creator"}
                </span>
                <span
                  className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
                    f.status === "qualified"
                      ? "border-[#5EEAD4]/40 bg-[#5EEAD4]/10 text-[#5EEAD4]"
                      : "border-yellow-300/40 bg-yellow-300/10 text-yellow-200"
                  }`}
                >
                  {f.status === "qualified" ? "Qualified · +$20" : "In progress"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <h2 className="mt-10 font-display text-xl font-extrabold text-bone">
        How it works
      </h2>
      <ol className="mt-4 grid gap-4 sm:grid-cols-3">
        {STEPS.map((s, i) => (
          <li
            key={s.title}
            className="rounded-2xl border border-white/10 bg-white/[0.02] p-5"
          >
            <div className="font-display text-sm font-extrabold text-[#5EEAD4]">
              {i + 1}
            </div>
            <div className="mt-1.5 font-semibold text-bone">{s.title}</div>
            <p className="mt-1 text-sm leading-relaxed text-muted">{s.body}</p>
          </li>
        ))}
      </ol>

      <p className="mt-6 text-xs leading-relaxed text-muted">
        Only genuinely new creators count, and only their first approved
        video pays. Self-referrals, duplicate accounts or shared payout
        details are reviewed and forfeit the reward.
      </p>
    </div>
  );
}
