"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button, Card, Eyebrow } from "@/components/ui";
import { getSupabase } from "@/lib/supabase";
import { formatMoney, formatViews, ladderCents, type Tier } from "@/lib/portal";

/**
 * /admin/portal — review queues for the Creator Portal (2026-10-22):
 * verification requests (approve an account into BASIC/ELITE, or
 * reject) and video submissions (approve freezes the ladder amount;
 * a creator's first approved video qualifies their referral). All
 * decisions go through /api/admin/portal with the session's Bearer
 * token; the server re-checks is_admin on every call.
 */

type Gate = "loading" | "denied" | "ready";

interface JoinedCreator {
  discord_username: string | null;
  discord_avatar_url: string | null;
}
interface JoinedAccount {
  platform: string;
  handle: string;
  profile_url: string;
  tier: string | null;
  status: string;
}
interface VerificationRow {
  id: string;
  creator_id: string;
  account_id: string;
  recording_url: string | null;
  storage_path: string | null;
  recording_view_url: string | null;
  status: string;
  created_at: string;
  creator: JoinedCreator | null;
  account: JoinedAccount | null;
}
interface SubmissionRow {
  id: string;
  creator_id: string;
  account_id: string;
  video_url: string;
  posted_at: string;
  locked_views: number;
  status: string;
  month: string;
  earned_cents: number | null;
  tier_at_approval: string | null;
  created_at: string;
  creator: JoinedCreator | null;
  account: JoinedAccount | null;
}
interface Queues {
  verifications: { pending: VerificationRow[]; decided: VerificationRow[] };
  submissions: { pending: SubmissionRow[]; decided: SubmissionRow[] };
}

function CreatorChip({ creator }: { creator: JoinedCreator | null }) {
  const name = creator?.discord_username ?? "Unknown creator";
  return (
    <span className="inline-flex items-center gap-2 font-semibold text-bone">
      {creator?.discord_avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={creator.discord_avatar_url}
          alt=""
          width={24}
          height={24}
          className="rounded-full"
        />
      ) : (
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gold/20 text-[11px] font-extrabold text-gold">
          {name.slice(0, 1).toUpperCase()}
        </span>
      )}
      {name}
    </span>
  );
}

export default function AdminPortalPage() {
  const [gate, setGate] = useState<Gate>("loading");
  const [token, setToken] = useState<string | null>(null);
  const [queues, setQueues] = useState<Queues | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tierPick, setTierPick] = useState<Record<string, Tier>>({});
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const sb = getSupabase();
    if (!sb) {
      setGate("denied");
      return;
    }
    const { data } = await sb.auth.getSession();
    const tok = data.session?.access_token ?? null;
    if (!tok) {
      setGate("denied");
      return;
    }
    try {
      const res = await fetch("/api/admin/portal", {
        headers: { Authorization: `Bearer ${tok}` },
      });
      if (!res.ok) {
        setGate("denied");
        return;
      }
      setQueues((await res.json()) as Queues);
      setToken(tok);
      setGate("ready");
    } catch {
      setGate("denied");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (action: string, id: string, tier?: Tier) => {
    if (!token) return;
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch("/api/admin/portal", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action, id, tier }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(json?.error ?? "Action failed");
      }
    } catch {
      setError("Action failed");
    }
    setBusyId(null);
    await load();
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:py-16">
      <Eyebrow>Creator portal · admin</Eyebrow>
      <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-bone sm:text-4xl">
        Portal review queues
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
        Approving a verification places the account into its earning
        tier. Approving a video freezes its ladder amount at the
        account&apos;s tier — and a creator&apos;s first approved video
        qualifies their referral ($20 to the referrer).{" "}
        <Link href="/admin/funnel" className="font-semibold text-gold hover:underline">
          Funnel media →
        </Link>{" "}
        <Link href="/admin/users" className="font-semibold text-gold hover:underline">
          Users &amp; Pro →
        </Link>
      </p>

      {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}

      {gate === "loading" ? (
        <p className="mt-10 text-sm text-muted">Loading queues…</p>
      ) : gate === "denied" ? (
        <Card className="mt-10 p-8">
          <p className="font-semibold text-bone">Admins only</p>
          <p className="mt-1 text-sm text-muted">
            Sign in with the admin account to review the creator portal.
          </p>
          <Button href="/login" className="mt-4 px-6 py-2.5">
            Go to login
          </Button>
        </Card>
      ) : queues ? (
        <>
          <h2 className="mt-10 font-display text-xl font-extrabold text-bone">
            Verification requests ({queues.verifications.pending.length} pending)
          </h2>
          <div className="mt-4 grid gap-3">
            {queues.verifications.pending.length === 0 ? (
              <p className="text-sm text-muted">Nothing waiting for review.</p>
            ) : (
              queues.verifications.pending.map((v) => (
                <Card key={v.id} className="p-5">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <CreatorChip creator={v.creator} />
                    {v.account ? (
                      <a
                        href={v.account.profile_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-semibold text-gold hover:underline"
                      >
                        @{v.account.handle} · {v.account.platform}
                      </a>
                    ) : null}
                    <span className="text-xs text-muted">
                      {new Date(v.created_at).toLocaleString("en-US")}
                    </span>
                    <span className="ml-auto flex items-center gap-2">
                      <select
                        value={tierPick[v.id] ?? "BASIC"}
                        onChange={(e) =>
                          setTierPick((p) => ({
                            ...p,
                            [v.id]: e.target.value as Tier,
                          }))
                        }
                        className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-bold text-bone focus:outline-none"
                        aria-label="Tier"
                      >
                        <option value="BASIC" className="bg-[#111113]">BASIC</option>
                        <option value="ELITE" className="bg-[#111113]">ELITE</option>
                      </select>
                      <Button
                        onClick={() =>
                          act("verification_approve", v.id, tierPick[v.id] ?? "BASIC")
                        }
                        disabled={busyId === v.id}
                        className="px-4 py-2 text-xs"
                      >
                        Approve
                      </Button>
                      <button
                        type="button"
                        onClick={() => act("verification_reject", v.id)}
                        disabled={busyId === v.id}
                        className="rounded-full border border-red-400/40 px-4 py-2 text-xs font-bold text-red-300 transition hover:bg-red-400/10 disabled:opacity-40"
                      >
                        Reject
                      </button>
                    </span>
                  </div>
                  <div className="mt-3 text-sm">
                    {v.recording_view_url ? (
                      <a
                        href={v.recording_view_url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-gold hover:underline"
                      >
                        Watch the demographics recording ↗
                      </a>
                    ) : (
                      <span className="text-muted">No recording attached.</span>
                    )}
                  </div>
                </Card>
              ))
            )}
          </div>

          <h2 className="mt-12 font-display text-xl font-extrabold text-bone">
            Video submissions ({queues.submissions.pending.length} pending)
          </h2>
          <div className="mt-4 grid gap-3">
            {queues.submissions.pending.length === 0 ? (
              <p className="text-sm text-muted">Nothing waiting for review.</p>
            ) : (
              queues.submissions.pending.map((s) => {
                const tier = (s.account?.tier === "ELITE" ? "ELITE" : "BASIC") as Tier;
                return (
                  <Card key={s.id} className="p-5">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                      <CreatorChip creator={s.creator} />
                      <a
                        href={s.video_url}
                        target="_blank"
                        rel="noreferrer"
                        className="max-w-[280px] truncate text-sm font-semibold text-gold hover:underline"
                      >
                        {s.video_url.replace(/^https?:\/\/(www\.)?/, "")}
                      </a>
                      <span className="text-xs text-muted">
                        posted {s.posted_at} · {formatViews(s.locked_views)} locked
                        views · {tier} → {formatMoney(ladderCents(s.locked_views, tier))}
                      </span>
                      <span className="ml-auto flex items-center gap-2">
                        <Button
                          onClick={() => act("submission_approve", s.id)}
                          disabled={busyId === s.id}
                          className="px-4 py-2 text-xs"
                        >
                          Approve
                        </Button>
                        <button
                          type="button"
                          onClick={() => act("submission_reject", s.id)}
                          disabled={busyId === s.id}
                          className="rounded-full border border-red-400/40 px-4 py-2 text-xs font-bold text-red-300 transition hover:bg-red-400/10 disabled:opacity-40"
                        >
                          Reject
                        </button>
                      </span>
                    </div>
                  </Card>
                );
              })
            )}
          </div>

          {(queues.verifications.decided.length > 0 ||
            queues.submissions.decided.length > 0) && (
            <>
              <h2 className="mt-12 font-display text-xl font-extrabold text-bone">
                Recently decided
              </h2>
              <ul className="mt-4 space-y-2 text-sm text-muted">
                {queues.verifications.decided.map((v) => (
                  <li key={v.id}>
                    Verification · @{v.account?.handle ?? "?"} ·{" "}
                    <span className="font-semibold text-bone">{v.status}</span> ·{" "}
                    {new Date(v.created_at).toLocaleDateString("en-US")}
                  </li>
                ))}
                {queues.submissions.decided.map((s) => (
                  <li key={s.id}>
                    Video · {formatViews(s.locked_views)} views ·{" "}
                    <span className="font-semibold text-bone">{s.status}</span>
                    {s.status === "approved" && s.earned_cents != null
                      ? ` · ${formatMoney(s.earned_cents)}`
                      : ""}{" "}
                    · {new Date(s.created_at).toLocaleDateString("en-US")}
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      ) : null}
    </div>
  );
}
