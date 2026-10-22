import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-api";
import {
  CONTENT_COLLECTION_IDS,
  CONTENT_TYPES,
  type ContentType,
} from "@/lib/content";

/**
 * /api/admin/content — admin-only management of public.content_items
 * (2026-10-22), the unified content table behind every collection
 * (funnel, omegle-clips, replays, creator-examples, research,
 * animations). Writes go through the service-role client after
 * requireAdmin verifies the caller's profile has is_admin === true;
 * the admin-all RLS policy is a backstop, not the write path.
 */

const SELECT =
  "id, collection, slot, type, title, caption, source_name, media_url, poster_url, link_url, meta, sort, active, created_at, updated_at";

const BUCKET = "content-media";

function forbidden() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

const str = (v: unknown, max: number): string | null =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;

/** GET — ALL rows (incl. inactive) for ?collection=<id>, or every
 *  collection when omitted. Ordered collection, sort, created_at. */
export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth) return forbidden();

  const collection = new URL(req.url).searchParams
    .get("collection")
    ?.trim();
  if (collection && !CONTENT_COLLECTION_IDS.includes(collection)) {
    return NextResponse.json(
      {
        error: `Unknown collection. Known collections: ${CONTENT_COLLECTION_IDS.join(", ")}`,
      },
      { status: 400 }
    );
  }

  let query = auth.admin
    .from("content_items")
    .select(SELECT)
    .order("collection", { ascending: true })
    .order("sort", { ascending: true })
    .order("created_at", { ascending: true });
  if (collection) query = query.eq("collection", collection);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json(
      { error: "Could not load content items" },
      { status: 500 }
    );
  }
  return NextResponse.json({ items: data ?? [] });
}

interface ContentBody {
  id?: unknown;
  collection?: unknown;
  slot?: unknown;
  type?: unknown;
  title?: unknown;
  caption?: unknown;
  source_name?: unknown;
  media_url?: unknown;
  poster_url?: unknown;
  link_url?: unknown;
  meta?: unknown;
  sort?: unknown;
  active?: unknown;
}

/** POST — create or save one item. With `id`: update that row. Else
 *  with `slot`: upsert on (collection, slot). Else: insert. */
export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth) return forbidden();

  let body: ContentBody;
  try {
    body = (await req.json()) as ContentBody;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const collection =
    typeof body.collection === "string" ? body.collection.trim() : "";
  if (!CONTENT_COLLECTION_IDS.includes(collection)) {
    return NextResponse.json(
      {
        error: `Unknown collection. Known collections: ${CONTENT_COLLECTION_IDS.join(", ")}`,
      },
      { status: 400 }
    );
  }

  if (
    body.type !== undefined &&
    body.type !== null &&
    !(CONTENT_TYPES as string[]).includes(body.type as string)
  ) {
    return NextResponse.json(
      {
        error: `Unknown type. Known types: ${CONTENT_TYPES.join(", ")}`,
      },
      { status: 400 }
    );
  }
  const type: ContentType =
    typeof body.type === "string" &&
    (CONTENT_TYPES as string[]).includes(body.type)
      ? (body.type as ContentType)
      : "video";

  const meta: Record<string, unknown> =
    body.meta && typeof body.meta === "object" && !Array.isArray(body.meta)
      ? (body.meta as Record<string, unknown>)
      : {};

  const row = {
    collection,
    slot: str(body.slot, 200),
    type,
    title: str(body.title, 300),
    caption: str(body.caption, 2000),
    source_name: str(body.source_name, 300),
    media_url: str(body.media_url, 2048),
    poster_url: str(body.poster_url, 2048),
    link_url: str(body.link_url, 2048),
    meta,
    sort:
      typeof body.sort === "number" && Number.isFinite(body.sort)
        ? Math.trunc(body.sort)
        : 0,
    active: body.active !== false,
    updated_at: new Date().toISOString(),
  };

  const id = str(body.id, 200);

  // Update by id.
  if (id) {
    const { data, error } = await auth.admin
      .from("content_items")
      .update(row)
      .eq("id", id)
      .select(SELECT)
      .single();
    if (error) {
      return NextResponse.json(
        { error: "Could not save content item" },
        { status: 500 }
      );
    }
    return NextResponse.json({ item: data });
  }

  // Upsert on (collection, slot): the unique index is partial
  // (where slot is not null), so resolve the existing row first
  // rather than relying on ON CONFLICT inference.
  if (row.slot) {
    const { data: existing } = await auth.admin
      .from("content_items")
      .select("id")
      .eq("collection", collection)
      .eq("slot", row.slot)
      .maybeSingle();
    if (existing?.id) {
      const { data, error } = await auth.admin
        .from("content_items")
        .update(row)
        .eq("id", existing.id as string)
        .select(SELECT)
        .single();
      if (error) {
        return NextResponse.json(
          { error: "Could not save content item" },
          { status: 500 }
        );
      }
      return NextResponse.json({ item: data });
    }
  }

  const { data, error } = await auth.admin
    .from("content_items")
    .insert(row)
    .select(SELECT)
    .single();
  if (error) {
    return NextResponse.json(
      { error: "Could not save content item" },
      { status: 500 }
    );
  }
  return NextResponse.json({ item: data });
}

interface DeleteBody {
  id?: unknown;
}

function storagePathFromUrl(url: unknown): string | null {
  if (typeof url !== "string" || !url) return null;
  const marker = `/${BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  const raw = url.slice(idx + marker.length).split(/[?#]/)[0];
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** DELETE — remove one row by { id }; best-effort cleanup of its
 *  content-media storage objects (media + poster). */
export async function DELETE(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth) return forbidden();

  let body: DeleteBody;
  try {
    body = (await req.json()) as DeleteBody;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const id = str(body.id, 200);
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const { data: existing } = await auth.admin
    .from("content_items")
    .select("media_url, poster_url")
    .eq("id", id)
    .maybeSingle();

  const { error } = await auth.admin
    .from("content_items")
    .delete()
    .eq("id", id);
  if (error) {
    return NextResponse.json(
      { error: "Could not delete content item" },
      { status: 500 }
    );
  }

  if (existing) {
    const paths = [
      storagePathFromUrl(existing.media_url),
      storagePathFromUrl(existing.poster_url),
    ].filter((p): p is string => !!p);
    if (paths.length) {
      try {
        await auth.admin.storage.from(BUCKET).remove(paths);
      } catch {
        // Best-effort only — the row is already gone.
      }
    }
  }

  return NextResponse.json({ ok: true });
}
