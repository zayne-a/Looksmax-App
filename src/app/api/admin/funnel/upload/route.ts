import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-api";
import { FUNNEL_SLOT_IDS } from "@/lib/funnel-media";

/**
 * /api/admin/funnel/upload — admin-only media upload for funnel
 * slots (Zayne, 2026-10-21). Multipart form-data: field "file" (the
 * media), field "slot" (a canonical slot id). The file goes into the
 * PUBLIC "funnel-media" Storage bucket via the service-role client,
 * and the slot's funnel_media row is upserted with the public URL +
 * a kind inferred from the mime type.
 */

const BUCKET = "funnel-media";
// Funnel videos are short loops; 100 MB is generous headroom while
// still refusing absurd uploads.
const MAX_BYTES = 100 * 1024 * 1024;

function safeName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  return base.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 80) || "file";
}

export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart form-data" },
      { status: 400 }
    );
  }

  const slotRaw = form.get("slot");
  const slot = typeof slotRaw === "string" ? slotRaw.trim() : "";
  if (!FUNNEL_SLOT_IDS.includes(slot)) {
    return NextResponse.json(
      { error: `Unknown slot. Known slots: ${FUNNEL_SLOT_IDS.join(", ")}` },
      { status: 400 }
    );
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "File too large (max 100 MB)" },
      { status: 400 }
    );
  }
  const kind = file.type.startsWith("video/")
    ? "video"
    : file.type.startsWith("image/")
      ? "image"
      : null;
  if (!kind) {
    return NextResponse.json(
      { error: "Only video or image files are supported" },
      { status: 400 }
    );
  }

  const path = `${slot}/${Date.now()}-${safeName(file.name)}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: upError } = await auth.admin.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: file.type, upsert: true });
  if (upError) {
    return NextResponse.json(
      { error: "Upload to storage failed" },
      { status: 500 }
    );
  }

  const { data: pub } = auth.admin.storage.from(BUCKET).getPublicUrl(path);
  const url = pub.publicUrl;

  const { error: rowError } = await auth.admin
    .from("funnel_media")
    .upsert(
      { slot, kind, url, updated_at: new Date().toISOString() },
      { onConflict: "slot" }
    );
  if (rowError) {
    return NextResponse.json(
      { error: "Uploaded, but saving the slot failed", url },
      { status: 500 }
    );
  }

  return NextResponse.json({ url, slot, kind });
}
