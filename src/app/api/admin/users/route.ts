import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-api";
import { isOwnerAdminEmail } from "@/lib/admin";

/**
 * /api/admin/users — the user directory behind /admin/users
 * (2026-10-22). Search profiles by email and manage the admin flag.
 * Pro grant/revoke stays in /api/admin/pro (same semantics, reused
 * by the page). Same auth as /api/admin/content: Bearer JWT →
 * requireAdmin → service-role writes.
 *
 * Deliberately NOT here: user deletion and suspend. Deletion is
 * destructive and irreversible; suspend only means something with
 * login enforcement behind it, which is a separate build.
 */

function forbidden() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

interface DirectoryRow {
  id: string;
  email: string;
  created_at: string;
  is_premium: boolean;
  is_admin: boolean;
  is_owner: boolean;
  scan_count: number;
}

/** GET ?q=<email substring> — up to 50 profiles, newest first, each
 *  with its real scan count. Empty q returns the newest 50. */
export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth) return forbidden();
  const { admin } = auth;

  const q = (new URL(req.url).searchParams.get("q") ?? "")
    .trim()
    .slice(0, 100);

  let query = admin
    .from("profiles")
    .select("id, email, created_at, is_premium, is_admin")
    .order("created_at", { ascending: false })
    .limit(50);
  if (q) query = query.ilike("email", `%${q}%`);

  const { data: profiles, error } = await query;
  if (error) {
    return NextResponse.json(
      { error: "Could not load users" },
      { status: 500 }
    );
  }
  const rows = (profiles ?? []) as DirectoryRow[];
  if (rows.length === 0) return NextResponse.json({ users: [] });

  // Real scan counts for exactly these users, tallied in JS.
  const counts = new Map<string, number>();
  const { data: scanRows } = await admin
    .from("scans")
    .select("user_id")
    .in(
      "user_id",
      rows.map((r) => r.id)
    )
    .limit(20000);
  for (const s of scanRows ?? []) {
    const uid = s.user_id as string;
    counts.set(uid, (counts.get(uid) ?? 0) + 1);
  }

  return NextResponse.json({
    users: rows.map((r) => ({
      ...r,
      is_owner: isOwnerAdminEmail(r.email ?? ""),
      scan_count: counts.get(r.id) ?? 0,
    })),
  });
}

interface AdminBody {
  userId?: unknown;
  admin?: unknown;
}

/** POST { userId, admin } — make/remove admin on a NON-owner
 *  profile. Guards: owners are untouchable; you cannot remove your
 *  own admin; the last remaining admin cannot be removed. Only the
 *  is_admin flag changes here — premium is managed via /api/admin/pro. */
export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth) return forbidden();
  const { admin } = auth;

  let body: AdminBody;
  try {
    body = (await req.json()) as AdminBody;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const userId = typeof body.userId === "string" ? body.userId : "";
  const makeAdmin = body.admin === true;
  if (!userId || typeof body.admin !== "boolean") {
    return NextResponse.json(
      { error: "Expected { userId, admin: boolean }" },
      { status: 400 }
    );
  }

  const { data: target } = await admin
    .from("profiles")
    .select("id, email, is_admin")
    .eq("id", userId)
    .maybeSingle();
  if (!target?.id) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (isOwnerAdminEmail((target.email as string) ?? "")) {
    return NextResponse.json(
      {
        error:
          "Owner admins are untouchable — their access is permanent by design.",
      },
      { status: 400 }
    );
  }

  if (!makeAdmin) {
    if (userId === auth.userId) {
      return NextResponse.json(
        { error: "You can't remove your own admin access." },
        { status: 400 }
      );
    }
    if (target.is_admin === true) {
      const { count } = await admin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("is_admin", true);
      if ((count ?? 0) <= 1) {
        return NextResponse.json(
          {
            error:
              "That's the last admin account — removing it would lock everyone out of this panel.",
          },
          { status: 400 }
        );
      }
    }
  }

  const { error } = await admin
    .from("profiles")
    .update({ is_admin: makeAdmin })
    .eq("id", userId);
  if (error) {
    return NextResponse.json(
      { error: "Could not update the admin flag" },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true, userId, admin: makeAdmin });
}
