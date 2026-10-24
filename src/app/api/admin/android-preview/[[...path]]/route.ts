import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin-api";

/**
 * GET /api/admin/android-preview/[[...path]] — serves the latest web
 * export of the native app (the /admin/android browser preview) from
 * the private `android-preview` Supabase Storage bucket.
 *
 * Admin-only (Zayne's rule: every /api/admin/* URL 404s for
 * non-admins). The credential is the caller's own Supabase access
 * token, accepted from the Authorization header, the mewmax_preview
 * cookie, or the ?token= query param — an iframe navigation cannot
 * send an Authorization header, so the /admin/android page (inside
 * AdminGate, which holds the token) passes it as ?token= on the
 * first load, and this handler then sets the path-scoped HttpOnly
 * cookie so the iframe's asset requests stay authed without the
 * token in every URL. The token is the admin's own short-lived
 * session token (1h); it appears in the iframe URL and server logs
 * for that first load only.
 *
 * Serving: exact bucket file by path; bare path → index.html;
 * route-like misses (no asset extension) fall back to index.html
 * (client-side routing); asset misses 404. index.html is never
 * cached (the preview must update the moment a new export lands);
 * hashed assets are immutable.
 *
 * Supabase Storage rejects `[`/`]` in object keys, so the publish
 * script stores dynamic-route files translated ([ → __LB__,
 * ] → __RB__); this handler applies the same translation before
 * every lookup. Browser-visible URLs keep their bracket names.
 */

const BUCKET = "android-preview";
const COOKIE = "mewmax_preview";
const COOKIE_PATH = "/api/admin/android-preview";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".mp4": "video/mp4",
  ".txt": "text/plain; charset=utf-8",
};

function mimeFor(key: string): string {
  const dot = key.lastIndexOf(".");
  const ext = dot >= 0 ? key.slice(dot).toLowerCase() : "";
  return MIME[ext] ?? "application/octet-stream";
}

function isAssetKey(key: string): boolean {
  const dot = key.lastIndexOf(".");
  if (dot < 0) return false;
  const ext = key.slice(dot).toLowerCase();
  return ext !== ".html" && Object.prototype.hasOwnProperty.call(MIME, ext);
}

function notFound() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ path?: string[] }> }
) {
  const { path } = await ctx.params;
  const segments = (path ?? []).filter((s) => s !== "");
  if (segments.some((s) => s === "..")) return notFound();
  const key = segments.length === 0 ? "index.html" : segments.join("/");

  // Credential: header, then cookie, then query param (iframe first load).
  const headerTok = req.headers.get("authorization") ?? "";
  const bearer = headerTok.startsWith("Bearer ")
    ? headerTok.slice(7).trim()
    : "";
  const tok =
    bearer ||
    req.cookies.get(COOKIE)?.value ||
    req.nextUrl.searchParams.get("token") ||
    "";
  if (!tok) return notFound();

  // Verify through the shared admin gate (JWT → profile is_admin).
  const probe = new Request(req.url, {
    headers: { authorization: `Bearer ${tok}` },
  });
  const auth = await requireAdmin(probe);
  if (!auth) return notFound();

  const setPreviewCookie = (res: NextResponse) => {
    res.cookies.set(COOKIE, tok, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: COOKIE_PATH,
      maxAge: 3600,
    });
    return res;
  };

  const storageKey = key.replaceAll("[", "__LB__").replaceAll("]", "__RB__");
  const { data, error } = await auth.admin.storage
    .from(BUCKET)
    .download(storageKey);
  let fileKey = key;
  let blob = !error ? data : null;
  if (!blob) {
    // Route-like miss → SPA fallback, but only if an index exists.
    if (isAssetKey(key)) return notFound();
    const index = await auth.admin.storage.from(BUCKET).download("index.html");
    if (index.error || !index.data) {
      // Nothing published yet — friendly page inside the frame.
      return setPreviewCookie(
        new NextResponse(
          '<!doctype html><title>Preview not published yet</title><body style="background:#0A0A0C;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0"><p>The Android preview hasn\'t been published yet — it appears here after the next app publish.</p></body>',
          {
            headers: {
              "content-type": "text/html; charset=utf-8",
              "cache-control": "no-store",
            },
          }
        )
      );
    }
    fileKey = "index.html";
    blob = index.data;
  }

  const isIndex = fileKey === "index.html";
  return setPreviewCookie(
    new NextResponse(blob, {
      headers: {
        "content-type": mimeFor(fileKey),
        "cache-control": isIndex
          ? "no-store"
          : "public, max-age=31536000, immutable",
      },
    })
  );
}
