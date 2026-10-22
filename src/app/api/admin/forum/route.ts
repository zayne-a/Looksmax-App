import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-api";

/**
 * /api/admin/forum — moderation for the community forum behind
 * /admin/forum (2026-10-22). The forum tables (public.forum_posts /
 * forum_comments / forum_upvotes) live in the same Supabase project
 * and are written by the native app; this route is the owner's
 * delete switch. Same auth as /api/admin/content: Bearer JWT →
 * requireAdmin → service-role writes. Deleting a post cascades to
 * its comments and upvotes (FK ON DELETE CASCADE in the forum
 * migration).
 */

function forbidden() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

/** GET — newest 50 posts + newest 50 comments, handles included. */
export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth) return forbidden();
  const { admin } = auth;

  const [{ data: posts, error: postErr }, { data: comments, error: commentErr }] =
    await Promise.all([
      admin
        .from("forum_posts")
        .select("id, user_id, author_handle, title, body, created_at")
        .order("created_at", { ascending: false })
        .limit(50),
      admin
        .from("forum_comments")
        .select("id, post_id, user_id, author_handle, body, created_at")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
  if (postErr || commentErr) {
    return NextResponse.json(
      {
        error:
          "Could not load the forum — if this persists, the forum tables may not be migrated yet.",
      },
      { status: 500 }
    );
  }
  return NextResponse.json({ posts: posts ?? [], comments: comments ?? [] });
}

interface DeleteBody {
  kind?: unknown;
  id?: unknown;
}

/** DELETE { kind: "post" | "comment", id } — remove one row. */
export async function DELETE(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth) return forbidden();
  const { admin } = auth;

  let body: DeleteBody;
  try {
    body = (await req.json()) as DeleteBody;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const kind = body.kind === "post" || body.kind === "comment" ? body.kind : "";
  const id = typeof body.id === "string" ? body.id : "";
  if (!kind || !id) {
    return NextResponse.json(
      { error: 'Expected { kind: "post" | "comment", id }' },
      { status: 400 }
    );
  }

  const table = kind === "post" ? "forum_posts" : "forum_comments";
  const { error } = await admin.from(table).delete().eq("id", id);
  if (error) {
    return NextResponse.json(
      { error: `Could not delete the ${kind}` },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true, kind, id });
}
