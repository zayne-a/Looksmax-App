import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-api";
import { CONTENT_COLLECTION_IDS } from "@/lib/content";

/**
 * /api/admin/content/upload — admin-only media upload ticket for
 * content items. The client POSTs JSON metadata ({ collection,
 * fileName, mimeType?, size? }) and receives a one-shot signed
 * upload URL for the PUBLIC "content-media" Storage bucket,
 * created with the service-role client. The client then uploads
 * the file bytes DIRECTLY to Supabase Storage with that URL.
 *
 * Why not upload the bytes through this route (the original
 * design)? Vercel Functions reject request bodies over ~4.5 MB
 * with 413 FUNCTION_PAYLOAD_TOO_LARGE before the handler runs —
 * which is exactly why admin VIDEO uploads always failed while
 * images (usually under the cap) went through. Direct-to-storage
 * uploads remove the platform cap from the path entirely; the
 * effective ceiling becomes the bucket/project storage limit.
 *
 * Like the route it replaces, this does NOT create a content row —
 * the admin UI saves the item via POST /api/admin/content with the
 * returned public url, so one upload can back any item shape.
 */

const BUCKET = "content-media";
// Declared-size gate for the ticket request. Replays and creator
// examples can be full videos; 200 MB headroom. (The bucket also
// enforces the project's own storage limit at upload time.)
const MAX_BYTES = 200 * 1024 * 1024;

function safeName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  return base.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 80) || "file";
}

type UploadKind = "video" | "image" | "animation";

function inferKind(fileName: string, mime: string): UploadKind | null {
  const name = fileName.toLowerCase();
  const type = mime.toLowerCase();
  // Lottie JSON and GIFs are animations, whatever the mime says.
  if (type === "application/json" || name.endsWith(".json")) {
    return "animation";
  }
  if (type === "image/gif" || name.endsWith(".gif")) return "animation";
  if (type.startsWith("video/") || /\.(mp4|mov|webm|m4v|mkv)$/.test(name)) {
    return "video";
  }
  if (type.startsWith("image/") || /\.(jpe?g|png|webp|avif|svg)$/.test(name)) {
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
    collection?: unknown;
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

  const fileName =
    typeof body.fileName === "string" ? body.fileName.trim() : "";
  if (!fileName) {
    return NextResponse.json({ error: "No file name provided" }, { status: 400 });
  }
  if (typeof body.size === "number" && body.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "File too large (max 200 MB)" },
      { status: 400 }
    );
  }
  const mimeType = typeof body.mimeType === "string" ? body.mimeType : "";
  const kind = inferKind(fileName, mimeType);
  if (!kind) {
    return NextResponse.json(
      { error: "Only video, image, GIF or Lottie (.json) files are supported" },
      { status: 400 }
    );
  }

  const path = `${collection}/${Date.now()}-${safeName(fileName)}`;
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
    kind,
  });
}
