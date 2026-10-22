import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-api";
import { CONTENT_COLLECTION_IDS } from "@/lib/content";

/**
 * /api/admin/content/upload — admin-only media upload for content
 * items (2026-10-22). Multipart form-data: field "file" (the media),
 * field "collection" (a canonical collection id). The file goes into
 * the PUBLIC "content-media" Storage bucket via the service-role
 * client. Unlike the funnel upload, this does NOT create a row —
 * the admin UI saves the item via POST /api/admin/content with the
 * returned url, so one upload can back any item shape.
 */

const BUCKET = "content-media";
// Replays and creator examples can be full videos; 200 MB headroom.
const MAX_BYTES = 200 * 1024 * 1024;

function safeName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  return base.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 80) || "file";
}

type UploadKind = "video" | "image" | "animation";

function inferKind(file: File): UploadKind | null {
  const name = file.name.toLowerCase();
  const mime = file.type.toLowerCase();
  // Lottie JSON and GIFs are animations, whatever the mime says.
  if (mime === "application/json" || name.endsWith(".json")) {
    return "animation";
  }
  if (mime === "image/gif" || name.endsWith(".gif")) return "animation";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("image/")) return "image";
  return null;
}

export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth) {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
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

  const collectionRaw = form.get("collection");
  const collection =
    typeof collectionRaw === "string" ? collectionRaw.trim() : "";
  if (!CONTENT_COLLECTION_IDS.includes(collection)) {
    return NextResponse.json(
      {
        error: `Unknown collection. Known collections: ${CONTENT_COLLECTION_IDS.join(", ")}`,
      },
      { status: 400 }
    );
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "File too large (max 200 MB)" },
      { status: 400 }
    );
  }
  const kind = inferKind(file);
  if (!kind) {
    return NextResponse.json(
      { error: "Only video, image, GIF or Lottie (.json) files are supported" },
      { status: 400 }
    );
  }

  const path = `${collection}/${Date.now()}-${safeName(file.name)}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const contentType =
    file.type ||
    (kind === "animation" && path.toLowerCase().endsWith(".json")
      ? "application/json"
      : kind === "animation"
        ? "image/gif"
        : "application/octet-stream");
  const { error: upError } = await auth.admin.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType, upsert: true });
  if (upError) {
    return NextResponse.json(
      { error: "Upload to storage failed" },
      { status: 500 }
    );
  }

  const { data: pub } = auth.admin.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ url: pub.publicUrl, path, kind });
}
