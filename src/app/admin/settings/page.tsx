"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button, Card, Eyebrow } from "@/components/ui";
import AdminGate from "@/components/admin/AdminGate";
import type { AppSettings, DeckEntrance, DeckPageId } from "@/lib/settings";

const DECK_TITLES: Record<DeckPageId, string> = {
  overall: "Overall",
  eyes: "Eyes",
  midface: "Midface",
  lower: "Lower Third",
  upper: "Upper Third",
  misc: "Miscellaneous",
  failos: "Failos",
  halos: "Halos",
  summary: "Summary",
};

const DECK_ENTRANCES: { id: DeckEntrance; label: string }[] = [
  { id: "slide", label: "Slide" },
  { id: "fade", label: "Fade" },
  { id: "rise", label: "Rise" },
  { id: "instant", label: "Instant" },
];

/**
 * /admin/settings — the owner's product switches (2026-10-22).
 * Every control here is wired to a real consumer (see
 * lib/settings.ts for the map): maintenance gates the web app,
 * the announcement banners the home page, creator_program gates
 * /creator + /portal, forum is served to the native app via
 * GET /api/settings, and trial_days rewrites the pricing copy.
 * Saves go through /api/admin/settings (server re-checks is_admin).
 */

const labelCls =
  "mb-1.5 block text-[11px] font-bold uppercase tracking-[0.22em] text-gold";

function SettingsConsole({ token }: { token: string }) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [meta, setMeta] = useState<
    Record<string, { updated_at: string; updated_by: string | null }>
  >({});
  const [status, setStatus] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  // Local draft state per section.
  const [maintOn, setMaintOn] = useState(false);
  const [maintMsg, setMaintMsg] = useState("");
  const [annOn, setAnnOn] = useState(false);
  const [annText, setAnnText] = useState("");
  const [featCreator, setFeatCreator] = useState(true);
  const [featForum, setFeatForum] = useState(true);
  const [trialDays, setTrialDays] = useState<0 | 3 | 7>(0);
  const [deckOrder, setDeckOrder] = useState<DeckPageId[]>([]);
  const [deckEntrance, setDeckEntrance] = useState<DeckEntrance>("slide");
  const [deckHidden, setDeckHidden] = useState<DeckPageId[]>([]);

  const applyLoaded = useCallback((s: AppSettings) => {
    setSettings(s);
    setMaintOn(s.maintenance.on);
    setMaintMsg(s.maintenance.message);
    setAnnOn(s.announcement.on);
    setAnnText(s.announcement.text);
    setFeatCreator(s.features.creator_program);
    setFeatForum(s.features.forum);
    setTrialDays(s.trial_days);
    setDeckOrder(s.deck.order);
    setDeckEntrance(s.deck.entrance);
    setDeckHidden(s.deck.hidden);
  }, []);

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const res = await fetch("/api/admin/settings", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const json = (await res.json()) as {
          settings: AppSettings;
          meta: Record<
            string,
            { updated_at: string; updated_by: string | null }
          >;
        };
        if (!live) return;
        applyLoaded(json.settings);
        setMeta(json.meta ?? {});
      } catch {
        setStatus("Could not load settings — try reloading.");
      }
    })();
    return () => {
      live = false;
    };
  }, [token, applyLoaded]);

  const save = async (key: string, value: unknown) => {
    setBusyKey(key);
    setStatus(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ key, value }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        settings?: AppSettings;
      };
      if (!res.ok || !json.settings) {
        setStatus(json.error ?? "Save failed — try again.");
        return;
      }
      applyLoaded(json.settings);
      setStatus("Saved — live now.");
    } catch {
      setStatus("Save failed — check your connection and try again.");
    } finally {
      setBusyKey(null);
    }
  };

  const metaLine = (key: string) => {
    const m = meta[key];
    if (!m) return null;
    const d = new Date(m.updated_at);
    const when = Number.isNaN(d.getTime())
      ? ""
      : d.toLocaleString("en-GB", {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        });
    return (
      <p className="mt-3 text-[11px] text-muted">
        Last changed {when}
        {m.updated_by ? ` by ${m.updated_by}` : ""}
      </p>
    );
  };

  const toggleCls = "h-4 w-4 accent-[#e3b94e]";

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-12 sm:py-16">
      <Eyebrow>App settings · admin</Eyebrow>
      <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-bone sm:text-4xl">
        App settings
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
        The switches that run the product. Every one of these is live:
        change it here and the site (and the app, where noted) obeys
        on the next page load — no code, no deploy.{" "}
        <Link href="/admin" className="font-semibold text-gold hover:underline">
          Admin home →
        </Link>{" "}
        <Link href="/admin/content" className="font-semibold text-gold hover:underline">
          All content →
        </Link>{" "}
        <Link href="/admin/users" className="font-semibold text-gold hover:underline">
          Users &amp; Pro →
        </Link>{" "}
        <Link href="/admin/portal" className="font-semibold text-gold hover:underline">
          Portal review →
        </Link>{" "}
        <Link href="/admin/forum" className="font-semibold text-gold hover:underline">
          Forum →
        </Link>
      </p>

      {status && (
        <p className="mt-4 text-xs font-semibold text-gold-soft">{status}</p>
      )}

      {!settings ? (
        <Card className="mt-10">
          <p className="text-sm text-muted">Loading settings…</p>
        </Card>
      ) : (
        <div className="mt-8 space-y-6">
          {/* Maintenance */}
          <Card>
            <h2 className="font-display text-lg font-extrabold text-bone">
              Maintenance mode
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-muted">
              While ON, every web surface shows the maintenance message
              instead of the app. Signed-in admins keep full access,
              and the sign-in + admin pages stay reachable so you can
              always get back in. The native app reads the same switch
              via the settings feed.
            </p>
            <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-bone">
              <input
                type="checkbox"
                checked={maintOn}
                onChange={(e) => setMaintOn(e.target.checked)}
                className={toggleCls}
              />
              Maintenance ON
            </label>
            <label className="mt-4 block">
              <span className={labelCls}>Message shown to visitors</span>
              <textarea
                value={maintMsg}
                onChange={(e) => setMaintMsg(e.target.value)}
                rows={3}
                maxLength={300}
                className="input-premium w-full resize-y"
              />
            </label>
            <div className="mt-4">
              <Button
                onClick={() =>
                  void save("maintenance", { on: maintOn, message: maintMsg })
                }
                disabled={busyKey !== null}
                className="px-6 py-2.5 text-xs"
              >
                {busyKey === "maintenance" ? "Saving…" : "Save maintenance"}
              </Button>
            </div>
            {metaLine("maintenance")}
          </Card>

          {/* Announcement */}
          <Card>
            <h2 className="font-display text-lg font-extrabold text-bone">
              Home announcement
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-muted">
              A banner across the top of the home page. Also published
              in the settings feed the native app reads.
            </p>
            <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-bone">
              <input
                type="checkbox"
                checked={annOn}
                onChange={(e) => setAnnOn(e.target.checked)}
                className={toggleCls}
              />
              Banner ON
            </label>
            <label className="mt-4 block">
              <span className={labelCls}>Banner text</span>
              <input
                value={annText}
                onChange={(e) => setAnnText(e.target.value)}
                maxLength={300}
                className="input-premium w-full"
                placeholder="e.g. New: the 90-day protocol is live"
              />
            </label>
            <div className="mt-4">
              <Button
                onClick={() =>
                  void save("announcement", { on: annOn, text: annText })
                }
                disabled={busyKey !== null}
                className="px-6 py-2.5 text-xs"
              >
                {busyKey === "announcement" ? "Saving…" : "Save announcement"}
              </Button>
            </div>
            {metaLine("announcement")}
          </Card>

          {/* Features */}
          <Card>
            <h2 className="font-display text-lg font-extrabold text-bone">
              Features
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-muted">
              Creator program OFF replaces the Creator Tools and the
              Creator Portal with a &ldquo;paused&rdquo; notice —
              nothing is deleted, and switching back on restores them
              exactly. The forum switch is read by the native app
              (the forum lives there; there is no web forum page).
            </p>
            <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-bone">
              <input
                type="checkbox"
                checked={featCreator}
                onChange={(e) => setFeatCreator(e.target.checked)}
                className={toggleCls}
              />
              Creator program (tools + portal)
            </label>
            <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-bone">
              <input
                type="checkbox"
                checked={featForum}
                onChange={(e) => setFeatForum(e.target.checked)}
                className={toggleCls}
              />
              Community forum (native app)
            </label>
            <div className="mt-4">
              <Button
                onClick={() =>
                  void save("features", {
                    creator_program: featCreator,
                    forum: featForum,
                  })
                }
                disabled={busyKey !== null}
                className="px-6 py-2.5 text-xs"
              >
                {busyKey === "features" ? "Saving…" : "Save features"}
              </Button>
            </div>
            {metaLine("features")}
          </Card>

          {/* Trial length */}
          <Card>
            <h2 className="font-display text-lg font-extrabold text-bone">
              Free-trial length
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-muted">
              The trial on Monthly &amp; Yearly (Weekly never has one).
              &ldquo;No trial&rdquo; = every plan bills from day one and the
              site sells &ldquo;cancel anytime&rdquo; only. This rewrites the
              trial copy quoted on the paywall, the plan + dashboard + coach
              upsells, the home page, the comparison and terms pages, and in
              Max&apos;s answers.
            </p>
            <div className="mt-4 flex gap-2">
              {([0, 3, 7] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setTrialDays(d)}
                  className={`rounded-full border px-5 py-2 text-xs font-bold tracking-wide transition ${
                    trialDays === d
                      ? "border-gold/60 bg-gold/15 text-gold-soft"
                      : "border-white/10 bg-white/[0.03] text-muted hover:text-bone"
                  }`}
                >
                  {d === 0 ? "No trial" : `${d} days`}
                </button>
              ))}
            </div>
            <div className="mt-4">
              <Button
                onClick={() => void save("trial_days", trialDays)}
                disabled={busyKey !== null}
                className="px-6 py-2.5 text-xs"
              >
                {busyKey === "trial_days" ? "Saving…" : "Save trial length"}
              </Button>
            </div>
            {metaLine("trial_days")}
          </Card>

          {/* Results deck (app) — the same control as the phone
              admin's Results deck screen; both write this setting. */}
          <Card>
            <h2 className="font-display text-lg font-extrabold text-bone">
              Results deck (app)
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-muted">
              The score pages a user swipes through after a scan, in
              the app. The first page in the list is the page the deck
              opens on; arrows reorder. Pick how pages come in, and
              hide any page but Overall — Overall always shows (it
              carries the free score). Applies over the air: no app
              update needed.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              {deckOrder.map((id, index) => {
                const hidden = deckHidden.includes(id);
                return (
                  <div
                    key={id}
                    className="flex items-center gap-2 rounded-lg border border-line bg-ink px-3 py-2"
                  >
                    <span className="w-6 text-center font-display text-sm font-extrabold text-gold">
                      {index + 1}
                    </span>
                    <span className="flex-1 text-sm font-bold text-bone">
                      {DECK_TITLES[id]}
                      {index === 0 ? (
                        <span className="ml-2 rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-extrabold tracking-widest text-gold-soft">
                          FIRST PAGE
                        </span>
                      ) : null}
                    </span>
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() =>
                        setDeckOrder((prev) => {
                          const next = [...prev];
                          [next[index - 1], next[index]] = [
                            next[index],
                            next[index - 1],
                          ];
                          return next;
                        })
                      }
                      className="rounded-md border border-white/10 px-2.5 py-1 text-xs font-bold text-muted hover:text-bone disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={index === deckOrder.length - 1}
                      onClick={() =>
                        setDeckOrder((prev) => {
                          const next = [...prev];
                          [next[index + 1], next[index]] = [
                            next[index],
                            next[index + 1],
                          ];
                          return next;
                        })
                      }
                      className="rounded-md border border-white/10 px-2.5 py-1 text-xs font-bold text-muted hover:text-bone disabled:opacity-30"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      disabled={id === "overall"}
                      onClick={() =>
                        setDeckHidden((prev) =>
                          hidden
                            ? prev.filter((h) => h !== id)
                            : [...prev, id]
                        )
                      }
                      className="rounded-md border border-white/10 px-2.5 py-1 text-xs font-bold text-muted hover:text-bone disabled:opacity-30"
                    >
                      {id === "overall"
                        ? "Always on"
                        : hidden
                          ? "Hidden"
                          : "Shown"}
                    </button>
                  </div>
                );
              })}
            </div>
            <p className={`${labelCls} mt-5`}>How pages come in</p>
            <div className="flex gap-2">
              {DECK_ENTRANCES.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => setDeckEntrance(e.id)}
                  className={`rounded-full border px-5 py-2 text-xs font-bold tracking-wide transition ${
                    deckEntrance === e.id
                      ? "border-gold/60 bg-gold/15 text-gold-soft"
                      : "border-white/10 bg-white/[0.03] text-muted hover:text-bone"
                  }`}
                >
                  {e.label}
                </button>
              ))}
            </div>
            <div className="mt-4">
              <Button
                onClick={() =>
                  void save("deck", {
                    order: deckOrder,
                    entrance: deckEntrance,
                    hidden: deckHidden,
                  })
                }
                disabled={busyKey !== null}
                className="px-6 py-2.5 text-xs"
              >
                {busyKey === "deck" ? "Saving…" : "Save deck"}
              </Button>
            </div>
            {metaLine("deck")}
          </Card>
        </div>
      )}
    </div>
  );
}

export default function AdminSettingsPage() {
  return (
    <AdminGate>{(token) => <SettingsConsole token={token} />}</AdminGate>
  );
}
