"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePortal } from "@/components/portal/PortalShell";
import { MonthSelect, PageHeading } from "@/components/portal/ui";
import {
  formatMoney,
  formatViews,
  loadAccounts,
  monthKey,
  monthLabel,
  monthOptions,
  type LeaderboardRow,
} from "@/lib/portal";

export default function PortalLeaderboardPage() {
  const { sb, profile } = usePortal();
  const [unlocked, setUnlocked] = useState<boolean | null>(null);
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [month, setMonth] = useState<string>(() => monthKey(new Date()));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const accounts = await loadAccounts(sb, profile.id);
      const hasApproved = accounts.some((a) => a.status === "approved");
      if (cancelled) return;
      setUnlocked(hasApproved);
      if (!hasApproved) return;
      const { data, error: rpcError } = await sb.rpc("portal_leaderboard", {
        p_month: month,
      });
      if (cancelled) return;
      if (rpcError) {
        setError("The leaderboard isn't reachable right now.");
        setRows([]);
        return;
      }
      setError(null);
      setRows((data as LeaderboardRow[] | null) ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [sb, profile.id, month]);

  return (
    <div>
      <PageHeading
        title="Leaderboard"
        sub="See how you rank against other creators this month"
        right={
          unlocked ? (
            <MonthSelect
              value={month}
              onChange={setMonth}
              options={monthOptions().filter((o) => o.value !== "all")}
            />
          ) : undefined
        }
      />

      {unlocked === null ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : !unlocked ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center sm:p-12">
          <h3 className="font-display text-xl font-extrabold text-bone">
            Rankings are locked
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
            Connect a TikTok or Instagram account and get it verified into
            an earning tier to unlock the leaderboard.
          </p>
          <Link
            href="/portal/settings"
            className="mt-6 inline-flex rounded-full bg-white px-6 py-3 text-sm font-bold text-[#0a0a0c] transition hover:bg-white/85"
          >
            Connect an Account
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/10">
          <div className="border-b border-white/10 bg-white/[0.03] px-4 py-3">
            <h2 className="font-display text-base font-extrabold text-bone">
              Rankings · {monthLabel(month)}
            </h2>
          </div>
          {error ? (
            <p className="px-4 py-8 text-sm text-red-300">{error}</p>
          ) : rows.length === 0 ? (
            <p className="px-4 py-8 text-sm text-muted">
              No approved videos this month yet — rankings appear as soon
              as submissions start getting approved.
            </p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-[11px] uppercase tracking-[0.14em] text-muted">
                  <th className="px-4 py-3 font-bold">#</th>
                  <th className="px-4 py-3 font-bold">Creator</th>
                  <th className="px-4 py-3 text-right font-bold">Posts</th>
                  <th className="px-4 py-3 text-right font-bold">Views</th>
                  <th className="px-4 py-3 text-right font-bold">Earnings</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const mine = r.creator_id === profile.id;
                  return (
                    <tr
                      key={r.creator_id}
                      className={`border-b border-white/5 last:border-0 ${
                        mine ? "bg-[#5EEAD4]/[0.06]" : ""
                      }`}
                    >
                      <td className="px-4 py-3 font-display font-extrabold text-bone">
                        {i + 1}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-2.5 font-semibold text-bone">
                          {r.discord_avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={r.discord_avatar_url}
                              alt=""
                              width={26}
                              height={26}
                              className="rounded-full"
                            />
                          ) : (
                            <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-[#5EEAD4]/15 text-xs font-extrabold text-[#5EEAD4]">
                              {(r.discord_username ?? "?").slice(0, 1).toUpperCase()}
                            </span>
                          )}
                          {r.discord_username ?? "Creator"}
                          {mine ? (
                            <span className="text-xs font-bold text-[#5EEAD4]">(you)</span>
                          ) : null}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted">
                        {r.posts}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted">
                        {formatViews(r.views)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-bone">
                        {formatMoney(r.earnings_cents)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
