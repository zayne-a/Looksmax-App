import { NextResponse } from "next/server";
import { requireAdmin, type AdminClient } from "@/lib/admin-api";

/**
 * GET /api/admin/overview — the real numbers behind the /admin home
 * stats strip (2026-10-22). Every figure is a live service-role
 * count against the production tables; nothing is estimated or
 * cached. Same auth as /api/admin/content (Bearer → is_admin).
 * A count that errors (e.g. a table not migrated yet) comes back
 * null and the panel shows "—" rather than a wrong zero.
 */

function forbidden() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

type CountResult = { count: number | null; error: unknown };

async function num(p: PromiseLike<CountResult>): Promise<number | null> {
  try {
    const { count: n, error } = await p;
    return error ? null : (n ?? 0);
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth) return forbidden();
  const admin: AdminClient = auth.admin;

  const sevenDaysAgo = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000
  ).toISOString();
  const head = { count: "exact", head: true } as const;

  const [
    totalUsers,
    proUsers,
    totalScans,
    signups7d,
    pendingVerifications,
    pendingSubmissions,
    forumPosts,
  ] = await Promise.all([
    num(admin.from("profiles").select("id", head)),
    num(admin.from("profiles").select("id", head).eq("is_premium", true)),
    num(admin.from("scans").select("id", head)),
    num(
      admin
        .from("profiles")
        .select("id", head)
        .gte("created_at", sevenDaysAgo)
    ),
    num(
      admin
        .from("verification_requests")
        .select("id", head)
        .eq("status", "pending")
    ),
    num(
      admin
        .from("video_submissions")
        .select("id", head)
        .eq("status", "pending")
    ),
    num(admin.from("forum_posts").select("id", head)),
  ]);

  return NextResponse.json({
    totalUsers,
    proUsers,
    totalScans,
    signups7d,
    pendingVerifications,
    pendingSubmissions,
    forumPosts,
  });
}
