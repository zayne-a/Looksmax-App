"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button, Card, Eyebrow } from "@/components/ui";
import { getSupabase } from "@/lib/supabase";
import {
  FUNNEL_SLOTS,
  type FunnelMedia,
  type FunnelSlotDef,
} from "@/lib/funnel-media";

/**
 * /admin/funnel — Zayne's own console for the onboarding funnel's
 * media slots (2026-10-21). Everything here talks to the admin API
 * routes with the session's Bearer token; the server re-checks
 * is_admin on every call, so this page's gate is only cosmetic —
 * a non-admin simply gets 403s and sees the "Admins only" state.
 */

type Gate = "loading" | "denied" | "ready";

export default function AdminFunnelPage() {
  const [gate, setGate] = useState<Gate>("loading");
  const [token, setToken] = useState<string | null>(null);
  const [rows, setRows] = useState<FunnelMedia[]>([]);

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
      const res = await fetch("/api/admin/funnel", {
        headers: { Authorization: `Bearer ${tok}` },
      });
      if (!res.ok) {
        setGate("denied");
        return;
      }
      const json = (await res.json()) as { rows?: FunnelMedia[] };
      setRows(json.rows ?? []);
      setToken(tok);
      setGate("ready");
    } catch {
      setGate("denied");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onSaved = useCallback((row: FunnelMedia) => {
    setRows((prev) => {
      const i = prev.findIndex((r) => r.slot === row.slot);
      if (i === -1) return [...prev, row];
      const next = [...prev];
      next[i] = row;
      return next;
    });
  }, []);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-12 sm:py-16">
      <Eyebrow>Funnel media · admin</Eyebrow>
      <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-bone sm:text-4xl">
        Funnel videos &amp; quotes
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
        These are the media slots inside the onboarding funnel — the
        persuasion-step background videos and the testimonial quotes.
        Upload a file or edit the text, hit Save, and the live funnel
        picks it up. A slot with no media (or switched off) simply
        doesn&apos;t render.{" "}
        <Link href="/admin/portal" className="font-semibold text-gold hover:underline">
          Portal review queues →
        </Link>
      </p>

      {gate === "loading" && (
        <Card className="mt-10">
          <p className="text-sm text-muted">Checking your admin access…</p>
        </Card>
      )}

      {gate === "denied" && (
        <Card className="mt-10">
          <p className="font-display text-lg font-bold text-bone">
            Admins only
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            This console is restricted to the site owner&apos;s admin
            account. If that&apos;s you, sign in with the admin email
            and reload this page.
          </p>
          <Button href="/login" className="mt-5">
            Sign in
          </Button>
        </Card>
      )}

      {gate === "ready" && token && (
        <div className="mt-10 space-y-6">
          {FUNNEL_SLOTS.map((def) => (
            <SlotEditor
              key={def.slot}
              def={def}
              row={rows.find((r) => r.slot === def.slot) ?? null}
              token={token}
              onSaved={onSaved}
            />
          ))}
          <p className="text-xs leading-relaxed text-muted">
            Looking for a slot that isn&apos;t listed? New slots are
            added in code (src/lib/funnel-media.ts) so the funnel
            always knows how to render them.{" "}
            <Link href="/dashboard" className="font-semibold text-gold-soft">
              Back to dashboard
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}

function SlotEditor({
  def,
  row,
  token,
  onSaved,
}: {
  def: FunnelSlotDef;
  row: FunnelMedia | null;
  token: string;
  onSaved: (row: FunnelMedia) => void;
}) {
  const kind = row?.kind ?? def.kind;
  const [url, setUrl] = useState(row?.url ?? "");
  const [headline, setHeadline] = useState(
    row?.headline ?? def.defaultHeadline
  );
  const [body, setBody] = useState(row?.body ?? "");
  const [active, setActive] = useState(row?.active ?? true);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Keep local fields in sync when the parent reloads rows.
  useEffect(() => {
    setUrl(row?.url ?? "");
    setHeadline(row?.headline ?? def.defaultHeadline);
    setBody(row?.body ?? "");
    setActive(row?.active ?? true);
  }, [row, def.defaultHeadline]);

  const upload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setStatus("Choose a file first.");
      return;
    }
    setUploading(true);
    setStatus(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("slot", def.slot);
      const res = await fetch("/api/admin/funnel/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const json = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };
      if (!res.ok || !json.url) {
        setStatus(json.error ?? "Upload failed — try again.");
        return;
      }
      setUrl(json.url);
      setStatus("Uploaded. Hit Save to publish it to the funnel.");
      if (fileRef.current) fileRef.current.value = "";
    } catch {
      setStatus("Upload failed — check your connection and try again.");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/admin/funnel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          slot: def.slot,
          kind,
          url: url || null,
          headline: headline || null,
          body: body || null,
          sort: row?.sort ?? 0,
          active,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        row?: FunnelMedia;
        error?: string;
      };
      if (!res.ok || !json.row) {
        setStatus(json.error ?? "Save failed — try again.");
        return;
      }
      onSaved(json.row);
      setStatus("Saved — live in the funnel now.");
    } catch {
      setStatus("Save failed — check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const isQuote = kind === "quote";

  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-extrabold text-bone">
          {def.label}
        </h2>
        <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-gold">
          {def.slot}
        </span>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-muted">{def.hint}</p>

      {/* Current preview */}
      <div className="mt-4">
        {kind === "video" && url ? (
          <video
            src={url}
            controls
            muted
            loop
            playsInline
            className="aspect-[9/16] max-h-80 w-full rounded-2xl bg-black object-cover"
          />
        ) : kind === "image" && url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={def.label}
            className="max-h-80 w-full rounded-2xl bg-black object-cover"
          />
        ) : isQuote && headline ? (
          <figure className="rounded-2xl border border-white/8 bg-white/[0.03] px-5 py-4">
            <blockquote className="text-sm leading-relaxed text-bone">
              “{headline}”
            </blockquote>
            {body && (
              <figcaption className="mt-2 text-xs font-semibold text-gold-soft">
                {body}
              </figcaption>
            )}
          </figure>
        ) : (
          <p className="rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3 text-xs text-muted">
            Nothing here yet — this slot renders nothing in the funnel
            until you add {isQuote ? "a quote" : "a file"} and save.
          </p>
        )}
      </div>

      {/* Upload */}
      {!isQuote && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept="video/*,image/*"
            className="max-w-full text-xs text-muted file:mr-3 file:rounded-full file:border file:border-gold/40 file:bg-gold/10 file:px-4 file:py-2 file:text-xs file:font-bold file:text-gold-soft"
          />
          <Button
            variant="ghost"
            onClick={() => void upload()}
            disabled={uploading}
            className="px-5 py-2.5 text-xs"
          >
            {uploading ? "Uploading…" : "Upload file"}
          </Button>
        </div>
      )}
      {url && !isQuote && (
        <p className="mt-2 break-all text-[11px] text-muted">
          Current file: {url}
        </p>
      )}

      {/* Text fields */}
      <div className="mt-4 space-y-3">
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.22em] text-gold">
            {isQuote ? "Quote text" : "Headline"}
          </span>
          <textarea
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            rows={isQuote ? 3 : 1}
            maxLength={500}
            className="input-premium w-full resize-y"
            placeholder={
              isQuote
                ? "The exact words of the testimonial…"
                : def.defaultHeadline || "Headline shown over the media"
            }
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.22em] text-gold">
            {isQuote ? "Author line" : "Supporting line (optional)"}
          </span>
          <input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={1000}
            className="input-premium w-full"
            placeholder={
              isQuote
                ? "Name, @handle — e.g. “+2 PSL in 4 months”"
                : "One short line under the headline"
            }
          />
        </label>
      </div>

      {/* Active + save */}
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-bone">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="h-4 w-4 accent-[#e3b94e]"
          />
          Active in the funnel
        </label>
        <Button
          onClick={() => void save()}
          disabled={busy}
          className="px-6 py-2.5 text-xs"
        >
          {busy ? "Saving…" : "Save slot"}
        </Button>
        {status && (
          <span className="text-xs font-semibold text-gold-soft">
            {status}
          </span>
        )}
      </div>
    </Card>
  );
}
