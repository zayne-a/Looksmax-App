import { getSupabase } from "./supabase";

/**
 * Funnel media — the admin-managed media slots for the PSL-style
 * onboarding funnel (Zayne, 2026-10-21). Rows live in public.funnel_media
 * (public read of ACTIVE rows via RLS; all writes go through the
 * service-role API routes under /api/admin/funnel after an is_admin
 * check). Zayne manages these himself from /admin/funnel.
 *
 * A slot with no row, an inactive row, or no url renders NOTHING
 * upstream — the funnel falls back to its static design for that step.
 */

export type FunnelMediaKind = "video" | "image" | "quote";

export interface FunnelMedia {
  id: string;
  slot: string;
  kind: FunnelMediaKind;
  url: string | null;
  headline: string | null;
  body: string | null;
  sort: number;
  active: boolean;
  updated_at: string;
}

/** Canonical slots the funnel knows how to render, in funnel order. */
export interface FunnelSlotDef {
  slot: string;
  kind: FunnelMediaKind;
  label: string;
  hint: string;
  defaultHeadline: string;
}

export const FUNNEL_SLOTS: FunnelSlotDef[] = [
  {
    slot: "chad-reality",
    kind: "video",
    label: "Chad's Reality — background video",
    hint: "Plays full-bleed behind the “Chad's Reality” persuasion step. Vertical MP4 works best.",
    defaultHeadline: "Chad's Reality",
  },
  {
    slot: "average-reality",
    kind: "video",
    label: "Average Reality — background video",
    hint: "Plays full-bleed behind the “Average Reality” persuasion step. Vertical MP4 works best.",
    defaultHeadline: "Average Reality",
  },
  {
    slot: "scan-front",
    kind: "video",
    label: "Face Scan — FRONT guide media",
    hint: "Plays (looping, muted) inside the app's framed FRONT card on the scan guide. Nothing set → the built-in outline shows.",
    defaultHeadline: "Front",
  },
  {
    slot: "scan-side",
    kind: "video",
    label: "Face Scan — SIDE guide media",
    hint: "Plays (looping, muted) inside the app's framed SIDE card on the scan guide. Nothing set → the built-in outline shows.",
    defaultHeadline: "Side",
  },
  {
    slot: "quote-1",
    kind: "quote",
    label: "Testimonial quote 1",
    hint: "Headline = the quote text. Body = the author line (name, handle, result).",
    defaultHeadline: "",
  },
  {
    slot: "quote-2",
    kind: "quote",
    label: "Testimonial quote 2",
    hint: "Headline = the quote text. Body = the author line (name, handle, result).",
    defaultHeadline: "",
  },
  {
    slot: "quote-3",
    kind: "quote",
    label: "Testimonial quote 3",
    hint: "Headline = the quote text. Body = the author line (name, handle, result).",
    defaultHeadline: "",
  },
];

export const FUNNEL_SLOT_IDS = FUNNEL_SLOTS.map((s) => s.slot);

/**
 * Fetch the ACTIVE funnel media rows for rendering (anon read, RLS
 * filters to active=true). Ordered by sort, then slot order. Returns
 * [] when Supabase is unconfigured or the table is unreachable — the
 * funnel then renders its static fallbacks.
 */
export async function fetchFunnelMedia(): Promise<FunnelMedia[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("funnel_media")
    .select("id, slot, kind, url, headline, body, sort, active, updated_at")
    .eq("active", true)
    .order("sort", { ascending: true });
  if (error || !data) return [];
  return data as FunnelMedia[];
}

/** One slot's active media, or null when the slot should render nothing. */
export function funnelMediaForSlot(
  rows: FunnelMedia[],
  slot: string
): FunnelMedia | null {
  const row = rows.find((r) => r.slot === slot);
  if (!row || !row.active) return null;
  if (row.kind !== "quote" && !row.url) return null;
  if (row.kind === "quote" && !row.headline) return null;
  return row;
}
