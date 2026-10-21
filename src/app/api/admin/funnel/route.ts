import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-api";
import { FUNNEL_SLOT_IDS } from "@/lib/funnel-media";

/**
 * /api/admin/funnel — admin-only management of public.funnel_media
 * (Zayne, 2026-10-21). The table has NO client write policies: every
 * write goes through here (or the upload route) with the service-role
 * client, after requireAdmin verifies the caller's profile has
 * is_admin === true.
 */

function forbidden() {
  return NextResponse.json({ error: "Admins only" }, { status: 403 });
}

/** GET — every funnel_media row, including inactive ones. */
export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth) return forbidden();
  const { data, error } = await auth.admin
    .from("funnel_media")
    .select("id, slot, kind, url, headline, body, sort, active, updated_at")
    .order("sort", { ascending: true });
  if (error) {
    return NextResponse.json(
      { error: "Could not load funnel media" },
      { status: 500 }
    );
  }
  return NextResponse.json({ rows: data ?? [] });
}

interface UpsertBody {
  slot?: unknown;
  kind?: unknown;
  url?: unknown;
  headline?: unknown;
  body?: unknown;
  sort?: unknown;
  active?: unknown;
}

const str = (v: unknown, max: number): string | null =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;

/** POST — upsert one slot by `slot`. */
export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth) return forbidden();

  let body: UpsertBody;
  try {
    body = (await req.json()) as UpsertBody;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const slot = typeof body.slot === "string" ? body.slot.trim() : "";
  if (!FUNNEL_SLOT_IDS.includes(slot)) {
    return NextResponse.json(
      { error: `Unknown slot. Known slots: ${FUNNEL_SLOT_IDS.join(", ")}` },
      { status: 400 }
    );
  }
  const kind =
    body.kind === "video" || body.kind === "image" || body.kind === "quote"
      ? body.kind
      : "video";

  const row = {
    slot,
    kind,
    url: str(body.url, 2048),
    headline: str(body.headline, 500),
    body: str(body.body, 1000),
    sort:
      typeof body.sort === "number" && Number.isFinite(body.sort)
        ? Math.trunc(body.sort)
        : 0,
    active: body.active !== false,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await auth.admin
    .from("funnel_media")
    .upsert(row, { onConflict: "slot" })
    .select("id, slot, kind, url, headline, body, sort, active, updated_at")
    .single();
  if (error) {
    return NextResponse.json(
      { error: "Could not save funnel media" },
      { status: 500 }
    );
  }
  return NextResponse.json({ row: data });
}
