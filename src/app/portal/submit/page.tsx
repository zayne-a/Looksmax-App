"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePortal } from "@/components/portal/PortalShell";
import {
  GateCard,
  MintButton,
  PageHeading,
  inputClass,
  labelClass,
} from "@/components/portal/ui";
import {
  loadAccounts,
  monthKey,
  type ConnectedAccount,
} from "@/lib/portal";

export default function PortalSubmitPage() {
  const { sb, profile } = usePortal();
  const [accounts, setAccounts] = useState<ConnectedAccount[] | null>(null);
  const [accountId, setAccountId] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [postedAt, setPostedAt] = useState("");
  const [views, setViews] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const accs = await loadAccounts(sb, profile.id);
      if (cancelled) return;
      setAccounts(accs);
      const firstApproved = accs.find((a) => a.status === "approved");
      if (firstApproved) setAccountId(firstApproved.id);
    })();
    return () => {
      cancelled = true;
    };
  }, [sb, profile.id]);

  const approved = useMemo(
    () => (accounts ?? []).filter((a) => a.status === "approved"),
    [accounts]
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setDone(false);
    const account = approved.find((a) => a.id === accountId);
    if (!account) {
      setError("Choose the account this video belongs to.");
      return;
    }
    const url = videoUrl.trim();
    const host = account.platform === "tiktok" ? "tiktok.com" : "instagram.com";
    if (!url.includes(host)) {
      setError(`That link doesn't look like a ${account.platform} link — paste the full video URL from ${host}.`);
      return;
    }
    const posted = new Date(`${postedAt}T12:00:00`);
    if (!postedAt || Number.isNaN(posted.getTime())) {
      setError("Pick the date you posted the video.");
      return;
    }
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const ageDays = Math.floor(
      (today.getTime() - posted.getTime()) / (24 * 3600 * 1000)
    );
    if (ageDays < 0) {
      setError("The posting date can't be in the future.");
      return;
    }
    if (ageDays > 30) {
      setError(
        "Videos older than 30 days can't be submitted — the submission window is exactly 30 days from posting."
      );
      return;
    }
    const lockedViews = Number.parseInt(views, 10);
    if (!Number.isFinite(lockedViews) || lockedViews < 0) {
      setError("Enter the video's current view count.");
      return;
    }
    setBusy(true);
    const { error: insertError } = await sb.from("video_submissions").insert({
      creator_id: profile.id,
      account_id: account.id,
      video_url: url,
      posted_at: postedAt,
      locked_views: lockedViews,
      status: "pending",
      month: monthKey(new Date()),
    });
    setBusy(false);
    if (insertError) {
      setError("Couldn't save that submission — please try again.");
      return;
    }
    setDone(true);
    setVideoUrl("");
    setViews("");
  };

  return (
    <div>
      <PageHeading
        title="Submit Video"
        sub="Link your TikTok or Instagram to submit videos and start earning."
      />

      {accounts === null ? (
        <p className="text-sm text-muted">Loading your accounts…</p>
      ) : accounts.length === 0 ? (
        <GateCard text="Link your account to submit videos & track earnings" />
      ) : approved.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center sm:p-12">
          <h2 className="font-display text-xl font-extrabold text-bone">
            Verification Needed
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
            Your connected account has to be verified into an earning tier
            before you can submit videos. Send your audience demographics
            recording in Verification — once it&apos;s approved, this page
            unlocks.
          </p>
          <Link
            href="/portal/verification"
            className="mt-6 inline-flex rounded-full bg-[#5EEAD4] px-6 py-3 text-sm font-bold text-[#0a0a0c] transition hover:bg-[#99f6e4]"
          >
            Go to Verification
          </Link>
        </div>
      ) : (
        <form
          onSubmit={submit}
          className="max-w-xl rounded-2xl border border-white/10 bg-white/[0.02] p-6 sm:p-8"
        >
          <div>
            <label className={labelClass} htmlFor="account">
              Account
            </label>
            <select
              id="account"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className={inputClass}
            >
              {approved.map((a) => (
                <option key={a.id} value={a.id} className="bg-[#111113]">
                  @{a.handle} · {a.platform === "tiktok" ? "TikTok" : "Instagram"}
                  {a.tier ? ` · ${a.tier}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-5">
            <label className={labelClass} htmlFor="url">
              Video URL
            </label>
            <input
              id="url"
              type="url"
              required
              placeholder="https://www.tiktok.com/@you/video/…"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              className={inputClass}
            />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass} htmlFor="posted">
                Date posted
              </label>
              <input
                id="posted"
                type="date"
                required
                value={postedAt}
                onChange={(e) => setPostedAt(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="views">
                Current views
              </label>
              <input
                id="views"
                type="number"
                min={0}
                step={1}
                required
                placeholder="42000"
                value={views}
                onChange={(e) => setViews(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-[#5EEAD4]/25 bg-[#5EEAD4]/[0.04] px-4 py-3 text-xs leading-relaxed text-muted">
            <span className="font-bold text-[#5EEAD4]">Views lock at submission.</span>{" "}
            Only submit when you&apos;re satisfied with the view count — your
            payout is calculated from the views you enter here and will not
            update after that. You have exactly 30 days from posting to
            submit. An admin reviews every submission before it counts.
          </div>

          {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
          {done ? (
            <p className="mt-4 text-sm text-[#5EEAD4]">
              Submitted for review. Track it under{" "}
              <Link href="/portal/videos" className="font-bold underline">
                My Videos
              </Link>
              .
            </p>
          ) : null}

          <MintButton type="submit" disabled={busy} className="mt-6">
            {busy ? "Submitting…" : "Submit Video"}
          </MintButton>
        </form>
      )}
    </div>
  );
}
