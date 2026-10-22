"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button, Card, Eyebrow } from "@/components/ui";
import ContentPreview, {
  liveSurfaceFor,
} from "@/components/admin/ContentPreview";
import { getSupabase } from "@/lib/supabase";
import type { ContentItem } from "@/lib/content";
import { AdminChecking } from "@/components/admin/AdminGate";
import NotFoundExperience from "@/components/NotFoundExperience";

/**
 * /admin/content — the unified content console (2026-10-22). The
 * owner manages EVERY DB-driven surface from here: the funnel slots,
 * Omegle clips, replays, creator examples, research cards and
 * animations. Web and the native app render the same rows.
 *
 * Everything talks to /api/admin/content with the session's Bearer
 * token; the server re-checks is_admin on every call, so this page's
 * gate is presentation only — a non-admin gets 404s and sees the
 * not-found state (same pattern as /admin/funnel).
 *
 * Rows arrive as ContentItem-shaped objects; the normaliser below
 * also tolerates raw snake_case DB rows, so the console keeps working
 * whichever shape the API hands back.
 */

type Gate = "loading" | "denied" | "ready";

type CollectionId =
  | "funnel"
  | "omegle-clips"
  | "replays"
  | "creator-examples"
  | "research"
  | "animations";

const COLLECTIONS: { id: CollectionId; label: string; hint: string }[] = [
  {
    id: "funnel",
    label: "Funnel",
    hint: "The five fixed slots inside the /start persuasion funnel.",
  },
  {
    id: "omegle-clips",
    label: "Omegle clips",
    hint: "Short clips for the Chad's Reality step in /start.",
  },
  {
    id: "replays",
    label: "Replays",
    hint: "Top-performing replays, shown on /creator/video-examples.",
  },
  {
    id: "creator-examples",
    label: "Creator examples",
    hint: "Example videos for /creator/video-examples.",
  },
  {
    id: "research",
    label: "Research",
    hint: "Study cards for the research step in /start. Only real studies — always name the source.",
  },
  {
    id: "animations",
    label: "Animations",
    hint: "Animation assets other surfaces can pick up.",
  },
];

const CONTENT_TYPES: ContentItem["type"][] = [
  "video",
  "image",
  "quote",
  "research",
  "animation",
  "link",
];

/** Local editable shape — same fields as ContentItem, all strings. */
interface AdminItem {
  id: string | null;
  collection: string;
  slot: string | null;
  type: ContentItem["type"];
  title: string;
  caption: string;
  sourceName: string;
  mediaUrl: string;
  posterUrl: string;
  linkUrl: string;
  sort: number;
  active: boolean;
}

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function normalise(raw: unknown, collection: string): AdminItem | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const typeRaw = asString(r.type);
  const type = (CONTENT_TYPES as string[]).includes(typeRaw)
    ? (typeRaw as ContentItem["type"])
    : "video";
  return {
    id: typeof r.id === "string" ? r.id : null,
    collection: asString(r.collection) || collection,
    slot: typeof r.slot === "string" ? r.slot : null,
    type,
    title: asString(r.title),
    caption: asString(r.caption),
    sourceName: asString(r.sourceName) || asString(r.source_name),
    mediaUrl: asString(r.mediaUrl) || asString(r.media_url),
    posterUrl: asString(r.posterUrl) || asString(r.poster_url),
    linkUrl: asString(r.linkUrl) || asString(r.link_url),
    sort: typeof r.sort === "number" && Number.isFinite(r.sort) ? r.sort : 0,
    active: r.active !== false,
  };
}

function blankItem(collection: string, sort: number): AdminItem {
  return {
    id: null,
    collection,
    slot: null,
    type:
      collection === "research"
        ? "research"
        : collection === "animations"
          ? "animation"
          : "video",
    title: "",
    caption: "",
    sourceName: "",
    mediaUrl: "",
    posterUrl: "",
    linkUrl: "",
    sort,
    active: true,
  };
}

/** POST one item to the admin API. Throws an Error with a human message. */
async function saveItem(token: string, item: AdminItem): Promise<void> {
  const res = await fetch("/api/admin/content", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    // The API reads snake_case field names (source_name, media_url,
    // …) — the camelCase twins are sent alongside so the payload also
    // matches the ContentItem contract shape.
    body: JSON.stringify({
      ...(item.id ? { id: item.id } : {}),
      collection: item.collection,
      slot: item.slot,
      type: item.type,
      title: item.title || null,
      caption: item.caption || null,
      sourceName: item.sourceName || null,
      source_name: item.sourceName || null,
      mediaUrl: item.mediaUrl || null,
      media_url: item.mediaUrl || null,
      posterUrl: item.posterUrl || null,
      poster_url: item.posterUrl || null,
      linkUrl: item.linkUrl || null,
      link_url: item.linkUrl || null,
      sort: item.sort,
      active: item.active,
    }),
  });
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(json.error ?? "Save failed — try again.");
  }
}

/** Upload a file via the content upload route; resolves to its URL. */
async function uploadFile(
  token: string,
  collection: string,
  file: File
): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  form.append("collection", collection);
  const res = await fetch("/api/admin/content/upload", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const json = (await res.json().catch(() => ({}))) as {
    url?: string;
    error?: string;
  };
  if (!res.ok || !json.url) {
    throw new Error(json.error ?? "Upload failed — try again.");
  }
  return json.url;
}

/** File input + upload button that hands the hosted URL back. */
function UploadField({
  token,
  collection,
  accept,
  label,
  onUploaded,
  onLocalFile,
}: {
  token: string;
  collection: string;
  accept: string;
  label: string;
  onUploaded: (url: string) => void;
  /** Fires the moment a file is picked (before any upload), so the
   *  live preview can show the local file immediately. */
  onLocalFile?: (file: File | null) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const run = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setNote("Choose a file first.");
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      const url = await uploadFile(token, collection, file);
      onUploaded(url);
      setNote("Uploaded — remember to Save.");
      if (fileRef.current) fileRef.current.value = "";
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Upload failed — try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.22em] text-gold">
        {label}
      </span>
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept={accept}
          onChange={(e) => onLocalFile?.(e.target.files?.[0] ?? null)}
          className="max-w-full text-xs text-muted file:mr-3 file:rounded-full file:border file:border-gold/40 file:bg-gold/10 file:px-4 file:py-2 file:text-xs file:font-bold file:text-gold-soft"
        />
        <Button
          variant="ghost"
          onClick={() => void run()}
          disabled={busy}
          className="px-5 py-2.5 text-xs"
        >
          {busy ? "Uploading…" : "Upload"}
        </Button>
        {note && (
          <span className="text-xs font-semibold text-gold-soft">{note}</span>
        )}
      </div>
    </div>
  );
}

const labelCls =
  "mb-1.5 block text-[11px] font-bold uppercase tracking-[0.22em] text-gold";

/**
 * Local file preview state for the live preview pane: picking a file
 * produces an object URL immediately (before upload), so the preview
 * shows the chosen file at once. Object URLs are revoked on replace,
 * on clear (e.g. after a successful upload hands back the hosted
 * URL) and on unmount.
 */
function useLocalPreview() {
  const [url, setUrl] = useState<string | null>(null);
  const ref = useRef<string | null>(null);

  const setFile = useCallback((file: File | null) => {
    if (ref.current) URL.revokeObjectURL(ref.current);
    ref.current = file ? URL.createObjectURL(file) : null;
    setUrl(ref.current);
  }, []);

  const clear = useCallback(() => {
    if (ref.current) URL.revokeObjectURL(ref.current);
    ref.current = null;
    setUrl(null);
  }, []);

  useEffect(() => {
    return () => {
      if (ref.current) URL.revokeObjectURL(ref.current);
    };
  }, []);

  return { url, setFile, clear };
}

export default function AdminContentPage() {
  const [gate, setGate] = useState<Gate>("loading");
  const [token, setToken] = useState<string | null>(null);
  const [collection, setCollection] = useState<CollectionId>("funnel");
  const [items, setItems] = useState<AdminItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const loadItems = useCallback(
    async (tok: string, col: CollectionId) => {
      setLoadingItems(true);
      setListError(null);
      try {
        const res = await fetch(
          `/api/admin/content?collection=${encodeURIComponent(col)}`,
          { headers: { Authorization: `Bearer ${tok}` } }
        );
        if (!res.ok) {
          setListError("Could not load this collection — try again.");
          setItems([]);
          return;
        }
        const json = (await res.json()) as { items?: unknown[] };
        const rows = (json.items ?? [])
          .map((r) => normalise(r, col))
          .filter((r): r is AdminItem => r !== null)
          .sort((a, b) => a.sort - b.sort);
        setItems(rows);
      } catch {
        setListError("Could not load this collection — check your connection.");
        setItems([]);
      } finally {
        setLoadingItems(false);
      }
    },
    []
  );

  // Gate: same pattern as /admin/funnel — session token, then a probe
  // load of the current collection; a 404 lands on the not-found state.
  useEffect(() => {
    let live = true;
    void (async () => {
      const sb = getSupabase();
      if (!sb) {
        if (live) setGate("denied");
        return;
      }
      const { data } = await sb.auth.getSession();
      const tok = data.session?.access_token ?? null;
      if (!tok) {
        if (live) setGate("denied");
        return;
      }
      try {
        const res = await fetch(
          `/api/admin/content?collection=${encodeURIComponent(collection)}`,
          { headers: { Authorization: `Bearer ${tok}` } }
        );
        if (!live) return;
        if (res.status === 403 || !res.ok) {
          setGate("denied");
          return;
        }
        const json = (await res.json()) as { items?: unknown[] };
        setItems(
          (json.items ?? [])
            .map((r) => normalise(r, collection))
            .filter((r): r is AdminItem => r !== null)
            .sort((a, b) => a.sort - b.sort)
        );
        setToken(tok);
        setGate("ready");
      } catch {
        if (live) setGate("denied");
      }
    })();
    return () => {
      live = false;
    };
    // The probe runs once on mount for the initial collection; later
    // collection switches go through switchCollection below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchCollection = (col: CollectionId) => {
    setCollection(col);
    if (token) void loadItems(token, col);
  };

  const reload = useCallback(() => {
    if (token) void loadItems(token, collection);
  }, [token, collection, loadItems]);

  const activeDef = COLLECTIONS.find((c) => c.id === collection);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:py-16">
      {gate === "loading" && <AdminChecking />}

      {gate === "denied" && <NotFoundExperience />}

      {gate === "ready" && token && (
        <>
      <Eyebrow>Content system · admin</Eyebrow>
      <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-bone sm:text-4xl">
        All content
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
        One console for everything the site and the app render — funnel
        media, clips, replays, creator examples, research and animations.
        Add or edit a row, hit Save, and every surface picks it up.{" "}
        <Link href="/admin" className="font-semibold text-gold hover:underline">
          Admin home →
        </Link>{" "}
        <Link href="/admin/users" className="font-semibold text-gold hover:underline">
          Users &amp; Pro →
        </Link>{" "}
        <Link href="/admin/portal" className="font-semibold text-gold hover:underline">
          Portal review →
        </Link>{" "}
        <Link href="/admin/forum" className="font-semibold text-gold hover:underline">
          Forum →
        </Link>{" "}
        <Link href="/admin/settings" className="font-semibold text-gold hover:underline">
          App settings →
        </Link>{" "}
        <Link href="/admin/funnel" className="font-semibold text-gold hover:underline">
          Funnel media (legacy console) →
        </Link>
      </p>
          {/* Collection switcher */}
          <div className="mt-10 flex flex-wrap gap-2">
            {COLLECTIONS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => switchCollection(c.id)}
                className={`rounded-full border px-4 py-2 text-xs font-bold tracking-wide transition ${
                  c.id === collection
                    ? "border-gold/60 bg-gold/15 text-gold-soft"
                    : "border-white/10 bg-white/[0.03] text-muted hover:text-bone"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
          {activeDef && (
            <p className="mt-3 text-xs leading-relaxed text-muted">
              {activeDef.hint}
            </p>
          )}
          {collection === "research" && (
            <p className="mt-1 text-xs font-semibold leading-relaxed text-gold-soft">
              Only real studies — always name the source.
            </p>
          )}
          {listError && (
            <p className="mt-3 text-xs font-semibold text-gold-soft">
              {listError}
            </p>
          )}
          {loadingItems && (
            <p className="mt-3 text-xs text-muted">Loading…</p>
          )}

          <div className="mt-8">
            {collection === "funnel" ? (
              <FunnelSlots
                items={items}
                token={token}
                onSaved={reload}
              />
            ) : (
              <ListCollection
                // Remount per collection so form state resets cleanly.
                key={collection}
                collection={collection}
                items={items}
                token={token}
                onChanged={reload}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Funnel collection — fixed slot editors                              */
/* ------------------------------------------------------------------ */

const FUNNEL_SLOT_DEFS: {
  slot: string;
  label: string;
  kind: "video" | "quote";
  hint: string;
}[] = [
  {
    slot: "chad-reality",
    label: "Chad's Reality — background video",
    kind: "video",
    hint: "Plays full-bleed behind the “Chad's Reality” step in /start. Vertical MP4 works best.",
  },
  {
    slot: "average-reality",
    label: "Average Reality — background video",
    kind: "video",
    hint: "Plays full-bleed behind the “Average Reality” step in /start. Vertical MP4 works best.",
  },
  {
    slot: "quote-1",
    label: "Testimonial quote 1",
    kind: "quote",
    hint: "Title = the quote text. Caption = the author line (name, handle, result).",
  },
  {
    slot: "quote-2",
    label: "Testimonial quote 2",
    kind: "quote",
    hint: "Title = the quote text. Caption = the author line (name, handle, result).",
  },
  {
    slot: "quote-3",
    label: "Testimonial quote 3",
    kind: "quote",
    hint: "Title = the quote text. Caption = the author line (name, handle, result).",
  },
];

function FunnelSlots({
  items,
  token,
  onSaved,
}: {
  items: AdminItem[];
  token: string;
  onSaved: () => void;
}) {
  return (
    <div className="space-y-6">
      {FUNNEL_SLOT_DEFS.map((def, i) => (
        <FunnelSlotEditor
          key={def.slot}
          def={def}
          item={items.find((r) => r.slot === def.slot) ?? null}
          sortFallback={i}
          token={token}
          onSaved={onSaved}
        />
      ))}
    </div>
  );
}

function FunnelSlotEditor({
  def,
  item,
  sortFallback,
  token,
  onSaved,
}: {
  def: (typeof FUNNEL_SLOT_DEFS)[number];
  item: AdminItem | null;
  sortFallback: number;
  token: string;
  onSaved: () => void;
}) {
  const isQuote = def.kind === "quote";
  const [title, setTitle] = useState(item?.title ?? "");
  const [caption, setCaption] = useState(item?.caption ?? "");
  const [mediaUrl, setMediaUrl] = useState(item?.mediaUrl ?? "");
  const [posterUrl, setPosterUrl] = useState(item?.posterUrl ?? "");
  const [active, setActive] = useState(item?.active ?? true);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [savedOnce, setSavedOnce] = useState(false);
  const mediaPreview = useLocalPreview();
  const posterPreview = useLocalPreview();

  useEffect(() => {
    setTitle(item?.title ?? "");
    setCaption(item?.caption ?? "");
    setMediaUrl(item?.mediaUrl ?? "");
    setPosterUrl(item?.posterUrl ?? "");
    setActive(item?.active ?? true);
    mediaPreview.clear();
    posterPreview.clear();
    // Local-preview clears are stable callbacks; only the item matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item]);

  const save = async () => {
    setBusy(true);
    setStatus(null);
    try {
      await saveItem(token, {
        id: item?.id ?? null,
        collection: "funnel",
        slot: def.slot,
        type: isQuote ? "quote" : "video",
        title,
        caption,
        sourceName: "",
        mediaUrl: isQuote ? "" : mediaUrl,
        posterUrl: isQuote ? "" : posterUrl,
        linkUrl: "",
        sort: item?.sort ?? sortFallback,
        active,
      });
      setStatus("Saved — live now.");
      setSavedOnce(true);
      mediaPreview.clear();
      posterPreview.clear();
      onSaved();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Save failed — try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,350px)]">
        <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-extrabold text-bone">
          {def.label}
        </h2>
        <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-gold">
          {def.slot}
        </span>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-muted">{def.hint}</p>

      {!isQuote && (
        <div className="mt-4 space-y-4">
          <UploadField
            token={token}
            collection="funnel"
            accept="video/*,image/*"
            label="Media file"
            onUploaded={(url) => {
              setMediaUrl(url);
              mediaPreview.clear();
            }}
            onLocalFile={mediaPreview.setFile}
          />
          <label className="block">
            <span className={labelCls}>…or paste a media URL</span>
            <input
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
              className="input-premium w-full"
              placeholder="https://…/video.mp4"
            />
          </label>
          <UploadField
            token={token}
            collection="funnel"
            accept="image/*"
            label="Poster image"
            onUploaded={(url) => {
              setPosterUrl(url);
              posterPreview.clear();
            }}
            onLocalFile={posterPreview.setFile}
          />
          <label className="block">
            <span className={labelCls}>…or paste a poster URL</span>
            <input
              value={posterUrl}
              onChange={(e) => setPosterUrl(e.target.value)}
              className="input-premium w-full"
              placeholder="https://…/poster.jpg"
            />
          </label>
        </div>
      )}

      <div className="mt-4 space-y-3">
        <label className="block">
          <span className={labelCls}>{isQuote ? "Quote text" : "Headline"}</span>
          <textarea
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            rows={isQuote ? 3 : 1}
            maxLength={500}
            className="input-premium w-full resize-y"
            placeholder={
              isQuote
                ? "The exact words of the testimonial…"
                : "Headline shown over the video"
            }
          />
        </label>
        <label className="block">
          <span className={labelCls}>
            {isQuote ? "Author line" : "Supporting line (optional)"}
          </span>
          <input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
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

      <div className="mt-5 flex flex-wrap items-center gap-4">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-bone">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="h-4 w-4 accent-[#e3b94e]"
          />
          Active
        </label>
        <Button
          onClick={() => void save()}
          disabled={busy}
          className="px-6 py-2.5 text-xs"
        >
          {busy ? "Saving…" : "Save slot"}
        </Button>
        {status && (
          <span className="text-xs font-semibold text-gold-soft">{status}</span>
        )}
      </div>
        </div>

        <div className="lg:sticky lg:top-6">
          <ContentPreview
            item={{
              collection: "funnel",
              slot: def.slot,
              type: isQuote ? "quote" : "video",
              title,
              caption,
              sourceName: "",
              mediaUrl,
              posterUrl,
              linkUrl: "",
              active,
            }}
            localMediaUrl={mediaPreview.url}
            localPosterUrl={posterPreview.url}
            liveHref={item?.id || savedOnce ? "/start" : null}
          />
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* List collections                                                    */
/* ------------------------------------------------------------------ */

function ListCollection({
  collection,
  items,
  token,
  onChanged,
}: {
  collection: CollectionId;
  items: AdminItem[];
  token: string;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState<AdminItem | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const liveSurface = liveSurfaceFor(collection);

  const startNew = () => {
    const nextSort =
      items.length > 0 ? Math.max(...items.map((i) => i.sort)) + 1 : 0;
    setEditing(blankItem(collection, nextSort));
    setFormKey((k) => k + 1);
  };

  const startEdit = (item: AdminItem) => {
    setEditing({ ...item });
    setFormKey((k) => k + 1);
  };

  const remove = async (item: AdminItem) => {
    if (!item.id) return;
    if (
      !window.confirm(
        `Delete “${item.title || "Untitled"}”? This removes it from every surface.`
      )
    ) {
      return;
    }
    setBusyId(item.id);
    setStatus(null);
    try {
      const res = await fetch("/api/admin/content", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id: item.id }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setStatus(json.error ?? "Delete failed — try again.");
        return;
      }
      if (editing?.id === item.id) setEditing(null);
      setStatus("Deleted.");
      onChanged();
    } catch {
      setStatus("Delete failed — check your connection and try again.");
    } finally {
      setBusyId(null);
    }
  };

  const move = async (index: number, dir: -1 | 1) => {
    const other = index + dir;
    if (other < 0 || other >= items.length) return;
    const a = items[index];
    const b = items[other];
    setBusyId(a.id ?? "move");
    setStatus(null);
    try {
      // Swap sort values; when the neighbours share a sort value,
      // fall back to their list positions so the swap still orders.
      const aSort = a.sort === b.sort ? other : b.sort;
      const bSort = a.sort === b.sort ? index : a.sort;
      await saveItem(token, { ...a, sort: aSort });
      await saveItem(token, { ...b, sort: bSort });
      onChanged();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Reorder failed — try again.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      {items.length === 0 ? (
        <Card>
          <p className="font-display text-lg font-bold text-bone">
            Nothing here yet
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            This collection is empty. Add the first item below — it will
            appear on the live surfaces as soon as you save it.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item, i) => (
            <Card key={item.id ?? `${item.title}-${i}`} className="!p-4">
              <div className="flex items-center gap-4">
                {item.posterUrl || item.mediaUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.posterUrl || item.mediaUrl}
                    alt={item.title}
                    className="h-14 w-20 shrink-0 rounded-xl bg-black object-cover"
                  />
                ) : (
                  <div className="flex h-14 w-20 shrink-0 items-center justify-center rounded-xl bg-white/[0.04] text-[10px] font-bold uppercase tracking-widest text-muted">
                    {item.type}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-sm font-bold text-bone">
                    {item.title || "Untitled"}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted">
                    <span className="rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 font-bold uppercase tracking-widest text-gold-soft">
                      {item.type}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 font-bold uppercase tracking-widest ${
                        item.active
                          ? "border-white/15 bg-white/[0.05] text-bone"
                          : "border-white/10 bg-transparent text-muted"
                      }`}
                    >
                      {item.active ? "Active" : "Inactive"}
                    </span>
                    <span>Sort {item.sort}</span>
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                  <Button
                    variant="ghost"
                    onClick={() => void move(i, -1)}
                    disabled={i === 0 || busyId !== null}
                    className="px-3 py-2 text-xs"
                  >
                    ↑
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => void move(i, 1)}
                    disabled={i === items.length - 1 || busyId !== null}
                    className="px-3 py-2 text-xs"
                  >
                    ↓
                  </Button>
                  {liveSurface && item.id && (
                    <Link
                      href={liveSurface.href}
                      target="_blank"
                      className="px-2 py-2 text-xs font-bold text-gold hover:underline"
                    >
                      View live ↗
                    </Link>
                  )}
                  <Button
                    variant="ghost"
                    onClick={() => startEdit(item)}
                    className="px-4 py-2 text-xs"
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => void remove(item)}
                    disabled={busyId !== null || !item.id}
                    className="px-4 py-2 text-xs"
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {status && (
        <p className="text-xs font-semibold text-gold-soft">{status}</p>
      )}

      <div>
        <Button onClick={startNew} className="px-6 py-2.5 text-xs">
          + Add item
        </Button>
      </div>

      {editing && (
        <ListItemForm
          key={`${editing.id ?? "new"}-${formKey}`}
          collection={collection}
          initial={editing}
          token={token}
          onDone={(msg) => {
            setEditing(null);
            setStatus(msg);
            onChanged();
          }}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function ListItemForm({
  collection,
  initial,
  token,
  onDone,
  onCancel,
}: {
  collection: CollectionId;
  initial: AdminItem;
  token: string;
  onDone: (msg: string) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial.title);
  const [caption, setCaption] = useState(initial.caption);
  const [sourceName, setSourceName] = useState(initial.sourceName);
  const [type, setType] = useState<ContentItem["type"]>(initial.type);
  const [mediaUrl, setMediaUrl] = useState(initial.mediaUrl);
  const [posterUrl, setPosterUrl] = useState(initial.posterUrl);
  const [linkUrl, setLinkUrl] = useState(initial.linkUrl);
  const [sort, setSort] = useState(String(initial.sort));
  const [active, setActive] = useState(initial.active);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const mediaPreview = useLocalPreview();
  const posterPreview = useLocalPreview();

  const save = async () => {
    setBusy(true);
    setStatus(null);
    try {
      await saveItem(token, {
        id: initial.id,
        collection,
        slot: initial.slot,
        type,
        title,
        caption,
        sourceName,
        mediaUrl,
        posterUrl,
        linkUrl,
        sort: Number.isFinite(parseInt(sort, 10)) ? parseInt(sort, 10) : 0,
        active,
      });
      onDone(initial.id ? "Saved — live now." : "Added — live now.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Save failed — try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,350px)]">
        <div>
      <h2 className="font-display text-lg font-extrabold text-bone">
        {initial.id ? "Edit item" : "Add item"}
      </h2>
      {collection === "research" && (
        <p className="mt-1.5 text-xs font-semibold leading-relaxed text-gold-soft">
          Only real studies — always name the source.
        </p>
      )}

      <div className="mt-4 space-y-3">
        <label className="block">
          <span className={labelCls}>Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={500}
            className="input-premium w-full"
            placeholder="Item title"
          />
        </label>
        <label className="block">
          <span className={labelCls}>Caption</span>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={3}
            maxLength={1000}
            className="input-premium w-full resize-y"
            placeholder="Short supporting text (optional)"
          />
        </label>
        <label className="block">
          <span className={labelCls}>Source name</span>
          <input
            value={sourceName}
            onChange={(e) => setSourceName(e.target.value)}
            maxLength={300}
            className="input-premium w-full"
            placeholder={
              collection === "research"
                ? "e.g. Langlois et al. (2000)"
                : "Where this came from (optional)"
            }
          />
        </label>
        <label className="block">
          <span className={labelCls}>Type</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as ContentItem["type"])}
            className="input-premium w-full"
          >
            {CONTENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>

        <UploadField
          token={token}
          collection={collection}
          accept="video/*,image/*"
          label="Media file"
          onUploaded={(url) => {
            setMediaUrl(url);
            mediaPreview.clear();
          }}
          onLocalFile={mediaPreview.setFile}
        />
        <label className="block">
          <span className={labelCls}>…or media URL</span>
          <input
            value={mediaUrl}
            onChange={(e) => setMediaUrl(e.target.value)}
            className="input-premium w-full"
            placeholder="https://… (direct file or YouTube URL)"
          />
        </label>
        <label className="block">
          <span className={labelCls}>YouTube / link URL</span>
          <input
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            className="input-premium w-full"
            placeholder="https://youtube.com/watch?v=… or any link"
          />
        </label>

        <UploadField
          token={token}
          collection={collection}
          accept="image/*"
          label="Poster image"
          onUploaded={(url) => {
            setPosterUrl(url);
            posterPreview.clear();
          }}
          onLocalFile={posterPreview.setFile}
        />
        <label className="block">
          <span className={labelCls}>…or poster URL</span>
          <input
            value={posterUrl}
            onChange={(e) => setPosterUrl(e.target.value)}
            className="input-premium w-full"
            placeholder="https://…/poster.jpg"
          />
        </label>

        <label className="block">
          <span className={labelCls}>Sort order</span>
          <input
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            inputMode="numeric"
            className="input-premium w-full"
            placeholder="0"
          />
        </label>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-4">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-bone">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="h-4 w-4 accent-[#e3b94e]"
          />
          Active
        </label>
        <Button
          onClick={() => void save()}
          disabled={busy}
          className="px-6 py-2.5 text-xs"
        >
          {busy ? "Saving…" : initial.id ? "Save item" : "Add item"}
        </Button>
        <Button
          variant="ghost"
          onClick={onCancel}
          disabled={busy}
          className="px-5 py-2.5 text-xs"
        >
          Cancel
        </Button>
        {status && (
          <span className="text-xs font-semibold text-gold-soft">{status}</span>
        )}
      </div>
        </div>

        <div className="lg:sticky lg:top-6">
          <ContentPreview
            item={{
              collection,
              slot: initial.slot,
              type,
              title,
              caption,
              sourceName,
              mediaUrl,
              posterUrl,
              linkUrl,
              active,
            }}
            localMediaUrl={mediaPreview.url}
            localPosterUrl={posterPreview.url}
            liveHref={initial.id ? liveSurfaceFor(collection)?.href ?? null : null}
          />
        </div>
      </div>
    </Card>
  );
}
