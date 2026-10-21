"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePortal } from "@/components/portal/PortalShell";
import {
  GateCard,
  MintButton,
  PageHeading,
  PlatformGlyph,
  StatusPill,
  TierBadge,
  inputClass,
  labelClass,
} from "@/components/portal/ui";
import {
  loadAccounts,
  RECORDINGS_BUCKET,
  type ConnectedAccount,
  type VerificationRequest,
} from "@/lib/portal";

function AccountVerification({
  account,
  requests,
  onSubmitted,
}: {
  account: ConnectedAccount;
  requests: VerificationRequest[];
  onSubmitted: () => void;
}) {
  const { sb, profile } = usePortal();
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const pending = requests.find((r) => r.status === "pending");
  const latest = requests[0];

  const submit = async () => {
    setError(null);
    setNotice(null);
    const file = fileRef.current?.files?.[0] ?? null;
    const url = link.trim();
    if (!file && !url) {
      setError("Upload a recording or paste a link to one.");
      return;
    }
    setBusy(true);
    let storagePath: string | null = null;
    let recordingUrl: string | null = null;
    if (file) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      storagePath = `${profile.id}/${account.id}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await sb.storage
        .from(RECORDINGS_BUCKET)
        .upload(storagePath, file, { contentType: file.type || "video/mp4" });
      if (uploadError) {
        setBusy(false);
        setError(
          "The recording upload failed — try again, or paste a link to the recording instead."
        );
        return;
      }
    } else {
      recordingUrl = url;
    }
    const { error: insertError } = await sb.from("verification_requests").insert({
      creator_id: profile.id,
      account_id: account.id,
      recording_url: recordingUrl,
      storage_path: storagePath,
      status: "pending",
    });
    setBusy(false);
    if (insertError) {
      setError("Couldn't send that for review — please try again.");
      return;
    }
    setLink("");
    if (fileRef.current) fileRef.current.value = "";
    setNotice("Sent for review. Verification reviews land within 24–48 hours.");
    onSubmitted();
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-bone">
          <PlatformGlyph platform={account.platform} size={20} />
        </span>
        <span className="font-semibold text-bone">@{account.handle}</span>
        <span className="text-xs capitalize text-muted">{account.platform}</span>
        <span className="ml-auto flex items-center gap-2">
          <TierBadge tier={account.tier} />
          <StatusPill
            status={
              account.status === "approved"
                ? "approved"
                : pending
                  ? "pending"
                  : account.status
            }
          />
        </span>
      </div>

      {account.status === "approved" ? (
        <p className="mt-4 text-sm text-muted">
          This account is verified into the {account.tier ?? "BASIC"} tier and
          can submit videos.
        </p>
      ) : pending ? (
        <p className="mt-4 text-sm text-muted">
          Your demographics recording is under review (sent{" "}
          {new Date(pending.created_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}
          ). Reviews land within 24–48 hours.
        </p>
      ) : (
        <div className="mt-4">
          {account.status === "rejected" && latest ? (
            <p className="mb-3 text-sm text-red-300">
              Your last recording wasn&apos;t approved. Check the
              requirements — 28-day audience demographics, at least 20%
              Tier-1 — and send a fresh recording.
            </p>
          ) : null}
          <p className="text-sm leading-relaxed text-muted">
            Record your account&apos;s audience demographics for the last 28
            days (TikTok Studio / Instagram Insights → Audience), showing the
            country split. Upload the screen recording or paste a link to
            it.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Upload recording</label>
              <input
                ref={fileRef}
                type="file"
                accept="video/*"
                className="w-full text-sm text-muted file:mr-3 file:rounded-full file:border file:border-white/15 file:bg-transparent file:px-4 file:py-2 file:text-sm file:font-bold file:text-bone hover:file:border-[#5EEAD4]/60"
              />
            </div>
            <div>
              <label className={labelClass}>…or paste a recording link</label>
              <input
                type="url"
                placeholder="https://drive.google.com/…"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
          {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
          {notice ? <p className="mt-3 text-sm text-[#5EEAD4]">{notice}</p> : null}
          <MintButton onClick={submit} disabled={busy} className="mt-4">
            {busy ? "Sending…" : "Send for Review"}
          </MintButton>
        </div>
      )}
    </div>
  );
}

export default function PortalVerificationPage() {
  const { sb, profile } = usePortal();
  const [accounts, setAccounts] = useState<ConnectedAccount[] | null>(null);
  const [requests, setRequests] = useState<VerificationRequest[]>([]);

  const load = useCallback(async () => {
    const [accs, reqs] = await Promise.all([
      loadAccounts(sb, profile.id),
      sb
        .from("verification_requests")
        .select("*")
        .eq("creator_id", profile.id)
        .order("created_at", { ascending: false })
        .then((r) => (r.data as VerificationRequest[] | null) ?? []),
    ]);
    setAccounts(accs);
    setRequests(reqs);
  }, [sb, profile.id]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <PageHeading
        title="End of Month Verification"
        sub="Link your TikTok or Instagram to verify your accounts and stay payout-eligible."
      />
      {accounts === null ? (
        <p className="text-sm text-muted">Loading your accounts…</p>
      ) : accounts.length === 0 ? (
        <GateCard text="Link your account to submit audience recordings" />
      ) : (
        <div className="grid gap-4">
          {accounts.map((a) => (
            <AccountVerification
              key={a.id}
              account={a}
              requests={requests.filter((r) => r.account_id === a.id)}
              onSubmitted={load}
            />
          ))}
        </div>
      )}
    </div>
  );
}
