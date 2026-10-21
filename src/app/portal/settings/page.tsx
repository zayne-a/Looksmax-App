"use client";

import { useCallback, useEffect, useState } from "react";
import { usePortal } from "@/components/portal/PortalShell";
import {
  GhostButton,
  MintButton,
  PageHeading,
  PlatformGlyph,
  StatusPill,
  TierBadge,
  WhiteButton,
  inputClass,
  labelClass,
} from "@/components/portal/ui";
import {
  loadAccounts,
  type ConnectedAccount,
  type PayoutMethod,
  type Platform,
} from "@/lib/portal";

/* ------------------------------------------------------------------ */
/* Connect account dialog: his picker → his pre-flight checklist →    */
/* v1 handle claim (real TikTok/IG OAuth needs platform app reviews   */
/* we don't have; the claim is approved via Verification instead).     */
/* ------------------------------------------------------------------ */

const CHECKLISTS: Record<
  Platform,
  { items: string[]; secondAccount: string[] }
> = {
  tiktok: {
    items: [
      "Open tiktok.com in your browser and confirm you're logged into the exact account you want to connect.",
      "Come back here and enter that account's handle below.",
    ],
    secondAccount: [
      "TikTok will silently reuse your first account unless you fully sign out first.",
      "Go to tiktok.com and log out of your current account.",
      "Log in to the account you actually want to connect.",
      "Return here and claim its handle.",
    ],
  },
  instagram: {
    items: [
      "Your account must be a Professional account (Business or Creator).",
      "Open instagram.com and confirm you're logged into the account you want to connect.",
      "On any authorization screen, leave all permissions enabled before pressing Allow.",
    ],
    secondAccount: [
      "Go to instagram.com and log out of your current account.",
      "Log in to the account you actually want to connect.",
      "Return here and claim its handle.",
    ],
  },
};

function ConnectDialog({
  open,
  onClose,
  onConnected,
}: {
  open: boolean;
  onClose: () => void;
  onConnected: () => void;
}) {
  const { sb, profile } = usePortal();
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [handle, setHandle] = useState("");
  const [profileUrl, setProfileUrl] = useState("");
  const [showSecond, setShowSecond] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const reset = () => {
    setPlatform(null);
    setHandle("");
    setProfileUrl("");
    setShowSecond(false);
    setError(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const claim = async () => {
    if (!platform) return;
    const cleanHandle = handle.trim().replace(/^@+/, "");
    const url = profileUrl.trim();
    if (!cleanHandle) {
      setError("Enter the account's handle.");
      return;
    }
    if (!url || !/^https?:\/\//i.test(url)) {
      setError("Paste the full profile URL (starting with https://).");
      return;
    }
    const host = platform === "tiktok" ? "tiktok.com" : "instagram.com";
    if (!url.toLowerCase().includes(host)) {
      setError(
        `That link doesn't look like a ${platform === "tiktok" ? "TikTok" : "Instagram"} profile — paste the full profile URL from ${host}.`
      );
      return;
    }
    setBusy(true);
    setError(null);
    const { error: insertError } = await sb.from("connected_accounts").insert({
      creator_id: profile.id,
      platform,
      handle: cleanHandle,
      profile_url: url,
      status: "pending",
    });
    setBusy(false);
    if (insertError) {
      setError(
        insertError.code === "23505"
          ? "That account is already connected."
          : "Couldn't connect that account — please try again."
      );
      return;
    }
    reset();
    onConnected();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#111113] p-6 shadow-2xl sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-display text-xl font-extrabold text-bone">
              {platform
                ? `Connect ${platform === "tiktok" ? "TikTok" : "Instagram"}`
                : "Connect an account"}
            </h3>
            <p className="mt-1 text-sm text-muted">
              {platform
                ? "A quick check before you connect."
                : "Choose the platform you want to connect."}
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="text-muted transition hover:text-bone"
          >
            ✕
          </button>
        </div>

        {!platform ? (
          <div className="mt-6 grid grid-cols-2 gap-3">
            {(["tiktok", "instagram"] as Platform[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPlatform(p)}
                className="flex items-center justify-center gap-2.5 rounded-xl border border-white/10 px-4 py-4 font-semibold text-bone transition hover:border-[#5EEAD4]/60 hover:text-[#5EEAD4]"
              >
                <PlatformGlyph platform={p} size={20} />
                {p === "tiktok" ? "TikTok" : "Instagram"}
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-5">
            <ul className="space-y-2.5">
              {CHECKLISTS[platform].items.map((item) => (
                <li key={item} className="flex gap-2.5 text-sm leading-relaxed text-bone">
                  <span className="mt-0.5 text-[#5EEAD4]">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={() => setShowSecond((v) => !v)}
              className="mt-4 text-sm font-semibold text-[#5EEAD4]"
            >
              Connecting a second account? {showSecond ? "▾" : "▸"}
            </button>
            {showSecond ? (
              <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-muted">
                {CHECKLISTS[platform].secondAccount.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
            ) : null}

            <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-xs leading-relaxed text-muted">
              Portal v1 connects by <span className="font-bold text-bone">handle claim</span>:
              enter the exact handle of the account you just confirmed above.
              It stays <span className="font-bold text-bone">Pending</span> until
              your audience-demographics recording is approved under
              Verification — that approval is what connects the account and
              assigns your earning tier.
            </div>

            <div className="mt-5 grid gap-4">
              <div>
                <label className={labelClass}>Handle</label>
                <input
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  placeholder="@yourhandle"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Profile URL</label>
                <input
                  value={profileUrl}
                  onChange={(e) => setProfileUrl(e.target.value)}
                  placeholder={
                    platform === "tiktok"
                      ? "https://www.tiktok.com/@yourhandle"
                      : "https://www.instagram.com/yourhandle"
                  }
                  className={inputClass}
                />
              </div>
            </div>

            {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}

            <div className="mt-6 flex justify-end gap-3">
              <GhostButton
                onClick={() => {
                  setPlatform(null);
                  setError(null);
                }}
              >
                Back
              </GhostButton>
              <MintButton onClick={claim} disabled={busy}>
                {busy ? "Connecting…" : "Connect Account"}
              </MintButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Payout methods: his pattern — a ROW per method ("+ Connect") that   */
/* opens a MODAL dialog with double-entry fields. The confirm entry    */
/* must match before Save enables; a mismatch shows his red            */
/* "✕ Entries don't match" under the confirm field. Saves persist      */
/* through the payout_methods upsert and the row then shows the        */
/* saved state.                                                        */
/* ------------------------------------------------------------------ */

type PayoutKind = Exclude<PayoutMethod["type"], "bank">;

interface PayoutConfig {
  kind: PayoutKind;
  title: string;
  line: string;
  glyph: string;
  dialogTitle: string;
  intro?: string;
  fieldLabel: string;
  confirmLabel: string;
  placeholder: string;
  note?: string;
  warning?: string;
  crypto?: boolean;
}

const PAYOUT_CONFIGS: PayoutConfig[] = [
  {
    kind: "paypal",
    title: "PayPal",
    line: "Payouts to your PayPal email or username.",
    glyph: "P",
    dialogTitle: "Connect PayPal",
    fieldLabel: "PayPal email or username",
    confirmLabel: "Confirm",
    placeholder: "yourname@example.com or @username",
    note: "Double-check your PayPal email or username — we can't verify if it's correct.",
  },
  {
    kind: "cashapp",
    title: "Cash App",
    line: "Payouts to your Cash App $Cashtag.",
    glyph: "$",
    dialogTitle: "Connect Cash App",
    fieldLabel: "$Cashtag",
    confirmLabel: "Confirm $Cashtag",
    placeholder: "$YourCashTag",
    note: "Double-check your $Cashtag — we can't verify if it exists.",
  },
  {
    kind: "crypto",
    title: "Crypto Wallet",
    line: "USDC on Solana.",
    glyph: "◎",
    dialogTitle: "Connect Crypto Wallet",
    intro: "Connect Phantom or enter your Solana wallet address manually.",
    fieldLabel: "Wallet address",
    confirmLabel: "Confirm address",
    placeholder: "Your Solana wallet address",
    warning:
      "USDC sent to a wrong address cannot be recovered. Enter your address twice to confirm.",
    crypto: true,
  },
];

interface PhantomProvider {
  isPhantom?: boolean;
  connect: () => Promise<{ publicKey: { toString: () => string } }>;
}

function PayoutDialog({
  config,
  initial,
  onClose,
  onSave,
}: {
  config: PayoutConfig;
  initial: string | null;
  onClose: () => void;
  onSave: (value: string) => Promise<boolean>;
}) {
  const [v1, setV1] = useState(initial ?? "");
  const [v2, setV2] = useState(initial ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phantomNote, setPhantomNote] = useState<string | null>(null);
  const [phantomBusy, setPhantomBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const mismatch = v1.trim() !== "" && v2.trim() !== "" && v1.trim() !== v2.trim();
  const canSave = v1.trim() !== "" && v1.trim() === v2.trim() && !busy;

  const connectPhantom = async () => {
    const provider = (
      window as unknown as { solana?: PhantomProvider }
    ).solana;
    if (!provider?.isPhantom) {
      setPhantomNote(
        "Phantom not detected. You can still enter your address manually."
      );
      return;
    }
    setPhantomBusy(true);
    setPhantomNote(null);
    try {
      const res = await provider.connect();
      const address = res.publicKey.toString();
      setV1(address);
      setV2(address);
    } catch {
      setPhantomNote(
        "Phantom connection was dismissed. You can still enter your address manually."
      );
    } finally {
      setPhantomBusy(false);
    }
  };

  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    setError(null);
    const ok = await onSave(v1.trim());
    setBusy(false);
    if (ok) {
      onClose();
    } else {
      setError("Couldn't save — please try again.");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={config.dialogTitle}
      data-testid={`payout-dialog-${config.kind}`}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#111113] p-6 shadow-2xl sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h3 className="font-display text-xl font-extrabold text-bone">
            {config.dialogTitle}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-muted transition hover:text-bone"
          >
            ✕
          </button>
        </div>

        {config.crypto ? (
          <div className="mt-4">
            <p className="text-sm leading-relaxed text-muted">{config.intro}</p>
            <button
              type="button"
              onClick={connectPhantom}
              disabled={phantomBusy}
              className="mt-3 inline-flex items-center justify-center gap-2 rounded-full bg-[#AB9FF2] px-5 py-2.5 text-sm font-bold text-[#0a0a0c] transition hover:bg-[#c0b5f5] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {phantomBusy ? "Connecting…" : "Connect Phantom"}
            </button>
            {phantomNote ? (
              <p className="mt-3 text-xs leading-relaxed text-muted">
                {phantomNote}
              </p>
            ) : null}
            <p className="mt-4 text-xs font-bold uppercase tracking-[0.14em] text-muted">
              Enter address manually
            </p>
          </div>
        ) : null}

        {config.warning ? (
          <p className="mt-4 rounded-xl border border-yellow-300/30 bg-yellow-300/[0.06] px-3.5 py-2.5 text-xs leading-relaxed text-yellow-100">
            {config.warning}
          </p>
        ) : null}

        <div className="mt-5">
          <label className={labelClass}>{config.fieldLabel}</label>
          <input
            value={v1}
            onChange={(e) => setV1(e.target.value)}
            placeholder={config.placeholder}
            className={inputClass}
            autoComplete="off"
            data-testid={`payout-field-${config.kind}`}
          />
          <label className={`${labelClass} mt-4`}>{config.confirmLabel}</label>
          <input
            value={v2}
            onChange={(e) => setV2(e.target.value)}
            placeholder="Enter again to confirm"
            className={inputClass}
            autoComplete="off"
            data-testid={`payout-confirm-${config.kind}`}
          />
          {mismatch ? (
            <p className="mt-2 text-sm font-semibold text-red-400">
              ✕ Entries don&apos;t match
            </p>
          ) : null}
          {config.note ? (
            <p className="mt-3 text-xs leading-relaxed text-muted">
              {config.note}
            </p>
          ) : null}
          {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <MintButton onClick={save} disabled={!canSave}>
            {busy ? "Saving…" : "Save"}
          </MintButton>
        </div>
      </div>
    </div>
  );
}

function PayoutRow({
  config,
  saved,
  onConnect,
}: {
  config: PayoutConfig;
  saved: string | null;
  onConnect: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] font-display text-lg font-extrabold text-bone">
        {config.glyph}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-display text-base font-extrabold text-bone">
            {config.title}
          </h3>
          {saved ? (
            <span className="inline-flex items-center rounded-full border border-[#5EEAD4]/40 bg-[#5EEAD4]/10 px-2.5 py-0.5 text-[11px] font-bold text-[#5EEAD4]">
              Connected
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 text-sm text-muted">
          {saved ? (
            <span className="break-all font-semibold text-bone">{saved}</span>
          ) : (
            config.line
          )}
        </p>
      </div>
      {saved ? (
        <GhostButton onClick={onConnect}>Update</GhostButton>
      ) : (
        <WhiteButton onClick={onConnect}>+ Connect</WhiteButton>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

export default function PortalSettingsPage() {
  const { sb, profile } = usePortal();
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [methods, setMethods] = useState<PayoutMethod[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [payoutKind, setPayoutKind] = useState<PayoutKind | null>(null);

  const load = useCallback(async () => {
    const [accs, meths] = await Promise.all([
      loadAccounts(sb, profile.id),
      sb
        .from("payout_methods")
        .select("*")
        .eq("creator_id", profile.id)
        .then((r) => (r.data as PayoutMethod[] | null) ?? []),
    ]);
    setAccounts(accs);
    setMethods(meths);
  }, [sb, profile.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveMethod = useCallback(
    async (type: PayoutMethod["type"], value: string): Promise<boolean> => {
      const { error } = await sb.from("payout_methods").upsert(
        {
          creator_id: profile.id,
          type,
          details: { value },
          updated_at: new Date().toISOString(),
        },
        { onConflict: "creator_id,type" }
      );
      if (error) return false;
      await load();
      return true;
    },
    [sb, profile.id, load]
  );

  const removeAccount = async (account: ConnectedAccount) => {
    await sb.from("connected_accounts").delete().eq("id", account.id);
    await load();
  };

  const methodValue = (type: PayoutMethod["type"]): string | null => {
    const m = methods.find((x) => x.type === type);
    return m?.details?.value ?? null;
  };

  return (
    <div>
      <PageHeading
        title="Settings"
        sub="Manage your payment methods and connected social media accounts"
      />

      {/* Profile */}
      <h2 className="font-display text-xl font-extrabold text-bone">Profile</h2>
      <p className="mt-1 text-sm text-muted">
        Your creator identity linked via Discord
      </p>
      <div className="mt-4 flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        {profile.discord_avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.discord_avatar_url}
            alt=""
            width={52}
            height={52}
            className="rounded-full"
          />
        ) : (
          <span className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-[#5EEAD4]/15 font-display text-lg font-extrabold text-[#5EEAD4]">
            {(profile.discord_username ?? "?").slice(0, 1).toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <div className="truncate font-display text-lg font-extrabold text-bone">
            {profile.discord_username ?? "Creator"}
          </div>
          <div className="truncate text-sm font-semibold text-[#5EEAD4]">
            @{profile.discord_username ?? "creator"}
          </div>
        </div>
        <span className="ml-auto inline-flex shrink-0 items-center rounded-full border border-[#5865F2]/50 bg-[#5865F2]/15 px-3 py-1 text-xs font-bold text-[#aeb6ff]">
          Connected via Discord
        </span>
      </div>

      {/* Connected accounts */}
      <div className="mt-10 flex items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-extrabold text-bone">
            Connected Accounts
          </h2>
          <p className="mt-1 text-sm text-muted">
            Link your account to submit videos &amp; track earnings
          </p>
        </div>
        <WhiteButton onClick={() => setDialogOpen(true)}>+ Connect Account</WhiteButton>
      </div>

      <div className="mt-4 grid gap-3">
        {accounts.length === 0 ? null : (
          accounts.map((a) => (
            <div
              key={a.id}
              className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4"
            >
              <span className="text-bone">
                <PlatformGlyph platform={a.platform} size={20} />
              </span>
              <a
                href={a.profile_url}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-bone hover:text-[#5EEAD4]"
              >
                @{a.handle}
              </a>
              <span className="text-xs capitalize text-muted">{a.platform}</span>
              <span className="ml-auto flex items-center gap-2">
                <TierBadge tier={a.tier} />
                <StatusPill status={a.status} />
                {a.status !== "approved" ? (
                  <button
                    type="button"
                    onClick={() => removeAccount(a)}
                    className="text-xs font-bold text-muted transition hover:text-red-300"
                  >
                    Remove
                  </button>
                ) : null}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Payment methods */}
      <h2 className="mt-10 font-display text-xl font-extrabold text-bone">
        Payment Methods
      </h2>
      <p className="mt-1 text-sm text-muted">Choose how you want to receive payouts</p>

      <div className="mt-4 grid gap-3">
        {PAYOUT_CONFIGS.map((config) => (
          <PayoutRow
            key={config.kind}
            config={config}
            saved={methodValue(config.kind)}
            onConnect={() => setPayoutKind(config.kind)}
          />
        ))}

        {/* Bank: honestly deferred — payouts (and Stripe onboarding)
            stay parked until the owner wires Stripe. */}
        <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-bone">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M3 9.5 12 4l9 5.5" />
              <path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8" />
              <path d="M3 21h18" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-base font-extrabold text-bone">
              Bank Account
            </h3>
            <p className="mt-0.5 text-sm leading-relaxed text-muted">
              Bank transfer runs through our payments partner and{" "}
              <span className="font-bold text-bone">
                activates when payouts launch
              </span>
              . Until then, add PayPal, Cash App or a crypto wallet so your
              first payout isn&apos;t held up.
            </p>
          </div>
          <button
            type="button"
            disabled
            className="inline-flex cursor-not-allowed rounded-full border border-white/15 px-5 py-2.5 text-sm font-bold text-muted opacity-50"
          >
            + Connect — coming at payout launch
          </button>
        </div>
      </div>

      {payoutKind ? (
        <PayoutDialog
          config={PAYOUT_CONFIGS.find((c) => c.kind === payoutKind)!}
          initial={methodValue(payoutKind)}
          onClose={() => setPayoutKind(null)}
          onSave={(v) => saveMethod(payoutKind, v)}
        />
      ) : null}

      <ConnectDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onConnected={load}
      />
    </div>
  );
}
