"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePortal } from "@/components/portal/PortalShell";
import {
  GateCard,
  PageHeading,
  PlatformGlyph,
  StatusPill,
} from "@/components/portal/ui";
import {
  formatMoney,
  formatViews,
  loadAccounts,
  loadSubmissions,
  submissionEarnedCents,
  submissionProjectedCents,
  type ConnectedAccount,
  type VideoSubmission,
} from "@/lib/portal";

export default function PortalVideosPage() {
  const { sb, profile } = usePortal();
  const [accounts, setAccounts] = useState<ConnectedAccount[] | null>(null);
  const [submissions, setSubmissions] = useState<VideoSubmission[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [accs, subs] = await Promise.all([
        loadAccounts(sb, profile.id),
        loadSubmissions(sb, profile.id),
      ]);
      if (cancelled) return;
      setAccounts(accs);
      setSubmissions(subs);
    })();
    return () => {
      cancelled = true;
    };
  }, [sb, profile.id]);

  const accountById = useMemo(() => {
    const map = new Map<string, ConnectedAccount>();
    for (const a of accounts ?? []) map.set(a.id, a);
    return map;
  }, [accounts]);

  return (
    <div>
      <PageHeading
        title="My Videos"
        sub="Connect a TikTok or Instagram account to track your submitted videos"
      />

      {accounts === null ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : accounts.length === 0 ? (
        <GateCard text="Link your account to submit videos & track earnings" />
      ) : submissions.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center">
          <p className="font-semibold text-bone">No submitted videos yet.</p>
          <p className="mt-1 text-sm text-muted">
            Once a video qualifies, submit it and it will show up here with
            its locked view count.
          </p>
          <Link
            href="/portal/submit"
            className="mt-4 inline-flex rounded-full bg-[#5EEAD4] px-5 py-2.5 text-sm font-bold text-[#0a0a0c] transition hover:bg-[#99f6e4]"
          >
            Submit a Video
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.03] text-[11px] uppercase tracking-[0.14em] text-muted">
                <th className="px-4 py-3 font-bold">Video</th>
                <th className="px-4 py-3 font-bold">Account</th>
                <th className="px-4 py-3 font-bold">Posted</th>
                <th className="px-4 py-3 text-right font-bold">Locked views</th>
                <th className="px-4 py-3 font-bold">Status</th>
                <th className="px-4 py-3 text-right font-bold">Earned</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((s) => {
                const account = accountById.get(s.account_id);
                const earned =
                  s.status === "approved"
                    ? formatMoney(submissionEarnedCents(s))
                    : s.status === "pending"
                      ? `~${formatMoney(submissionProjectedCents(s, account?.tier))}`
                      : "—";
                return (
                  <tr key={s.id} className="border-b border-white/5 last:border-0">
                    <td className="max-w-[220px] px-4 py-3">
                      <a
                        href={s.video_url}
                        target="_blank"
                        rel="noreferrer"
                        className="block truncate font-semibold text-[#5EEAD4] hover:underline"
                      >
                        {s.video_url.replace(/^https?:\/\/(www\.)?/, "")}
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      {account ? (
                        <span className="inline-flex items-center gap-2 text-bone">
                          <PlatformGlyph platform={account.platform} size={15} />@
                          {account.handle}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {new Date(`${s.posted_at}T12:00:00`).toLocaleDateString(
                        "en-US",
                        { month: "short", day: "numeric", year: "numeric" }
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-bone">
                      {formatViews(s.locked_views)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={s.status} />
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-bone">
                      {earned}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
