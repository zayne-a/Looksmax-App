import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-api";
import { FUNNEL_SLOT_IDS } from "@/lib/funnel-media";

/**
 * /api/admin/funnel/upload — admin-only media upload ticket for
 * funnel slots (Zayne, 2026-10-21). The client POSTs JSON metadata
 * ({ slot, fileName, mimeType?, size? }) and receives a one-shot
 * signed upload URL for the PUBLIC "funnel-media" Storage bucket,
 * created with the service-role client. The client then uploads
 * the file bytes DIRECTLY to Supabase Storage with that URL.
 *
 * Why not upload the bytes through this route (the original
 * design)? Vercel Functions reject request bodies over ~4.5 MB
 * with 413 FUNCTION_PAYLOAD_TOO_LARGE before the handler runs —
 * the route's old 100 MB limit was unreachable in production, and
 * funnel background videos died while small images squeaked
 * through. Direct-to-storage uploads remove the platform cap from
 * the path entirely; the effective ceiling becomes the
 * bucket/project storage limit.
 *
 * Like the content upload route, this does NOT write the slot's
 * funnel_media row — the admin page saves the slot via
 * POST /api/admin/funnel with the returned public url when the
 * admin hits Save, so the upload alone never changes the live
 * funnel.
 */

const BUCKET = "funnel-media";
// Funnel videos are short loops; 100 MB is generous headroom while
// still refusing absurd uploads. Declared-size gate for the ticket
// request; the bucket enforces the project's own storage limit at
// upload time.
const MAX_BYTES = 100 * 1024 * 1024;

function safeName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  return base.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 80) || "file";
}

type UploadKind = "video" | "image";

function inferKind(fileName: string, mime: string): UploadKind | null {
  const name = fileName.toLowerCase();
  const type = mime.toLowerCase();
  if (type.startsWith("video/") || /\.(mp4|mov|webm|m4v|mkv)$/.test(name)) {
    return "video";
  }
  if (
    type.startsWith("image/") ||
    /\.(jpe?g|png|webp|avif|svg|gif)$/.test(name)
  ) {
    return "image";
  }
  return null;
}

export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: {
    slot?: unknown;
    fileName?: unknown;
    mimeType?: unknown;
    size?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { error: "Expected a JSON body" },
      { status: 400 }
    );
  }

  const slot = typeof body.slot === "string" ? body.slot.trim() : "";
  if (!FUNNEL_SLOT_IDS.includes(slot)) {
    return NextResponse.json(
      { error: `Unknown slot. Known slots: ${FUNNEL_SLOT_IDS.join(", ")}` },
      { status: 400 }
    );
  }

  const fileName =
    typeof body.fileName === "string" ? body.fileName.trim() : "";
  if (!fileName) {
    return NextResponse.json({ error: "No file name provided" }, { status: 400 });
  }
  if (typeof body.size === "number" && body.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "File too large (max 100 MB)" },
      { status: 400 }
    );
  }
  const mimeType = typeof body.mimeType === "string" ? body.mimeType : "";
  const kind = inferKind(fileName, mimeType);
  if (!kind) {
    return NextResponse.json(
      { error: "Only video or image files are supported" },
      { status: 400 }
    );
  }

  const path = `${slot}/${Date.now()}-${safeName(fileName)}`;
  const { data: signed, error: signError } = await auth.admin.storage
    .from(BUCKET)
    .createSignedUploadUrl(path);
  if (signError || !signed) {
    return NextResponse.json(
      { error: "Could not prepare the upload" },
      { status: 500 }
    );
  }

  const { data: pub } = auth.admin.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({
    signedUrl: signed.signedUrl,
    token: signed.token,
    path,
    url: pub.publicUrl,
    slot,
    kind,
  });
}
