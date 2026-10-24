import { getSupabase } from "./supabase";

/**
 * Unified Admin Content System — shared contract (2026-10-22).
 *
 * Every admin-managed media collection lives in public.content_items
 * (see supabase/migrations/2026-10-22-content-system.sql). The owner
 * manages all of it from the admin panel; writes go through the
 * service-role API under /api/admin/content after requireAdmin, and
 * rendering (web + native) reads ACTIVE rows through this module via
 * the anon client + RLS. This file is the contract other surfaces
 * code against — keep its exports stable.
 */

export type ContentType =
  | "video"
  | "image"
  | "quote"
  | "research"
  | "animation"
  | "link";

export interface ContentItem {
  id: string;
  collection: string;
  slot: string | null;
  type: ContentType;
  title: string | null;
  caption: string | null;
  sourceName: string | null;
  mediaUrl: string | null;
  posterUrl: string | null;
  linkUrl: string | null;
  meta: Record<string, unknown>;
  sort: number;
  active: boolean;
  updatedAt: string;
}

export interface ContentCollectionDef {
  id: string;
  label: string;
  hint: string;
  types: ContentType[];
}

export const CONTENT_COLLECTIONS: ContentCollectionDef[] = [
  {
    id: "funnel",
    label: "Funnel — /start persuasion slots",
    hint: "Persuasion slots for the /start funnel: Chad's Reality and Average Reality background media, plus the three testimonial quotes.",
    types: ["video", "image", "quote"],
  },
  {
    id: "omegle-clips",
    label: "Omegle clips — reaction clips in Chad's Reality",
    hint: "Short reaction clips shown inside Chad's Reality.",
    types: ["video"],
  },
  {
    id: "replays",
    label: "Replays — top-performing videos",
    hint: "Top-performing videos surfaced as replays. Use a video upload or a link (e.g. YouTube) per item.",
    types: ["video", "link"],
  },
  {
    id: "creator-examples",
    label: "Creator video examples — /creator/video-examples",
    hint: "Example videos creators model on the /creator/video-examples page. Use a video upload or a YouTube link per item.",
    types: ["video", "link"],
  },
  {
    id: "research",
    label: "Research cards — studies with real sources",
    hint: "Study cards with real citations: title, caption and source name. Never invent a study or a source.",
    types: ["research"],
  },
  {
    id: "animations",
    label: "Animations — loops/Lottie/GIF assets",
    hint: "Loops, Lottie JSON and GIF assets used across web and the native app.",
    types: ["animation", "video", "image"],
  },
  {
    id: "interfaces",
    label: "Interfaces — app first screens",
    hint: "Photo/video media for the app's opening screens: the welcome screen and the onboarding hero card. One fixed slot per screen.",
    types: ["video", "image"],
  },
];

export const CONTENT_COLLECTION_IDS: string[] = CONTENT_COLLECTIONS.map(
  (c) => c.id
);

export const CONTENT_TYPES: ContentType[] = [
  "video",
  "image",
  "quote",
  "research",
  "animation",
  "link",
];

/** Canonical funnel slots, mirrored into the `funnel` collection. */
export const FUNNEL_CONTENT_SLOTS = [
  "chad-reality",
  "average-reality",
  "scan-front",
  "scan-side",
  "quote-1",
  "quote-2",
  "quote-3",
];

interface ContentRow {
  id: string;
  collection: string;
  slot: string | null;
  type: string;
  title: string | null;
  caption: string | null;
  source_name: string | null;
  media_url: string | null;
  poster_url: string | null;
  link_url: string | null;
  meta: unknown;
  sort: number;
  active: boolean;
  updated_at: string;
}

function isContentType(v: string): v is ContentType {
  return (CONTENT_TYPES as string[]).includes(v);
}

function mapRow(row: ContentRow): ContentItem {
  return {
    id: row.id,
    collection: row.collection,
    slot: row.slot ?? null,
    type: isContentType(row.type) ? row.type : "video",
    title: row.title ?? null,
    caption: row.caption ?? null,
    sourceName: row.source_name ?? null,
    mediaUrl: row.media_url ?? null,
    posterUrl: row.poster_url ?? null,
    linkUrl: row.link_url ?? null,
    meta:
      row.meta && typeof row.meta === "object" && !Array.isArray(row.meta)
        ? (row.meta as Record<string, unknown>)
        : {},
    sort: typeof row.sort === "number" ? row.sort : 0,
    active: row.active !== false,
    updatedAt: row.updated_at,
  };
}

/**
 * Fetch the ACTIVE items for one collection (anon read; RLS also
 * filters to active=true). Ordered by sort asc, then created_at asc.
 * Returns [] on any failure — unconfigured Supabase, a network error,
 * or a missing table must never break rendering; callers fall back
 * to their static/empty state. Never throws.
 */
export async function fetchContent(
  collection: string
): Promise<ContentItem[]> {
  try {
    const sb = getSupabase();
    if (!sb) return [];
    const { data, error } = await sb
      .from("content_items")
      .select(
        "id, collection, slot, type, title, caption, source_name, media_url, poster_url, link_url, meta, sort, active, created_at, updated_at"
      )
      .eq("collection", collection)
      .eq("active", true)
      .order("sort", { ascending: true })
      .order("created_at", { ascending: true });
    if (error || !data) return [];
    return (data as ContentRow[]).map(mapRow);
  } catch {
    return [];
  }
}

/** One slot's item from a fetched list, or null when absent. */
export function contentForSlot(
  items: ContentItem[],
  slot: string
): ContentItem | null {
  return items.find((item) => item.slot === slot) ?? null;
}

const YOUTUBE_ID = "[A-Za-z0-9_-]{11}";

/**
 * Extract a YouTube video id from a URL, or null. Handles
 * watch?v=, youtu.be/, /shorts/ and /embed/ shapes.
 */
export function youtubeIdFrom(
  url: string | null | undefined
): string | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  const patterns: RegExp[] = [
    new RegExp(`[?&]v=(${YOUTUBE_ID})`),
    new RegExp(`youtu\\.be/(${YOUTUBE_ID})`),
    new RegExp(`/shorts/(${YOUTUBE_ID})`),
    new RegExp(`/embed/(${YOUTUBE_ID})`),
    new RegExp(`/live/(${YOUTUBE_ID})`),
    new RegExp(`/v/(${YOUTUBE_ID})`),
  ];
  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match) return match[1];
  }
  // A bare 11-char id pasted directly.
  if (new RegExp(`^${YOUTUBE_ID}$`).test(trimmed)) return trimmed;
  return null;
}

/**
 * The YouTube id for an item: an explicit meta.youtubeId wins,
 * otherwise parse linkUrl (falling back to mediaUrl).
 */
export function youtubeIdFor(item: ContentItem): string | null {
  const fromMeta = item.meta?.youtubeId;
  if (typeof fromMeta === "string" && fromMeta.trim()) {
    return fromMeta.trim();
  }
  return youtubeIdFrom(item.linkUrl ?? item.mediaUrl);
}
