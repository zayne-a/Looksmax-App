import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-api";
import { OWNER_ADMIN_EMAILS, isOwnerAdminEmail } from "@/lib/admin";

/**
 * /api/admin/pro — owner-admin roster + Pro grants (2026-10-22,
 * Zayne's rule). cerxemm@gmail.com and zayneasad7@gmail.com are THE
 * admins: every plan free, full panel access, and they can grant
 * Pro to any other email. Grants live in public.pro_grants
 * (service-role only); the profiles INSERT trigger applies a grant
 * automatically at signup, and POST here applies it immediately when
 * the account already exists. Owner admins can never be revoked.
 *
 * Auth is the exact /api/admin/content pattern: Bearer JWT →
 * requireAdmin (profile is_admin === true) → service-role writes.
 */

function forbidden() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

/** Normalise + validate an email from a request body. Null = invalid. */
function validEmail(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const email = v.trim().toLowerCase();
  if (email.length < 3 || email.length > 254) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

interface EmailBody {
  email?: unknown;
}

async function readEmail(req: Request): Promise<string | null> {
  let body: EmailBody;
  try {
    body = (await req.json()) as EmailBody;
  } catch {
    return null;
  }
  return validEmail(body.email);
}

/** GET — the owner roster + every current Pro grant. */
export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth) return forbidden();

  const { data, error } = await auth.admin
    .from("pro_grants")
    .select("email, granted_by, created_at")
    .order("created_at", { ascending: true });
  if (error) {
    return NextResponse.json(
      { error: "Could not load Pro grants" },
      { status: 500 }
    );
  }
  return NextResponse.json({
    owners: [...OWNER_ADMIN_EMAILS],
    grants: data ?? [],
  });
}

/** POST { email } — grant Pro. Applies to the existing profile
 *  immediately when there is one; otherwise the profiles INSERT
 *  trigger applies it when that email signs up. */
export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth) return forbidden();

  const email = await readEmail(req);
  if (!email) {
    return NextResponse.json(
      { error: "Enter a valid email address" },
      { status: 400 }
    );
  }

  // Owners already have every plan free — a grant row is meaningless.
  if (isOwnerAdminEmail(email)) {
    return NextResponse.json({
      ok: true,
      email,
      alreadyOwner: true,
      appliedNow: true,
    });
  }

  // Who is granting (recorded on the row for the panel).
  const { data: caller } = await auth.admin
    .from("profiles")
    .select("email")
    .eq("id", auth.userId)
    .single();
  const grantedBy =
    typeof caller?.email === "string" ? caller.email : null;

  const { error: grantError } = await auth.admin
    .from("pro_grants")
    .upsert(
      { email, granted_by: grantedBy },
      { onConflict: "email", ignoreDuplicates: true }
    );
  if (grantError) {
    return NextResponse.json(
      { error: "Could not save the grant" },
      { status: 500 }
    );
  }

  // Existing account? Flip premium on right now (service role — the
  // protect_profile_privileges trigger allows exactly this path).
  const { data: profile } = await auth.admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (profile?.id) {
    const { error: flipError } = await auth.admin
      .from("profiles")
      .update({ is_premium: true })
      .eq("id", profile.id as string);
    if (flipError) {
      return NextResponse.json(
        { error: "Grant saved, but the profile update failed" },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true, email, appliedNow: true });
  }

  return NextResponse.json({ ok: true, email, appliedNow: false });
}

/** DELETE { email } — revoke a grant. Owner admins can NEVER be
 *  revoked; any other admin's premium is left untouched (their
 *  access doesn't come from the grant list). */
export async function DELETE(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth) return forbidden();

  const email = await readEmail(req);
  if (!email) {
    return NextResponse.json(
      { error: "Enter a valid email address" },
      { status: 400 }
    );
  }

  if (isOwnerAdminEmail(email)) {
    return NextResponse.json(
      {
        error:
          "Owner admins can't be revoked — cerxemm@gmail.com and zayneasad7@gmail.com always keep full access and every plan free.",
      },
      { status: 400 }
    );
  }

  const { error: grantError } = await auth.admin
    .from("pro_grants")
    .delete()
    .eq("email", email);
  if (grantError) {
    return NextResponse.json(
      { error: "Could not remove the grant" },
      { status: 500 }
    );
  }

  let profileUpdated = false;
  const { data: profile } = await auth.admin
    .from("profiles")
    .select("id, is_admin")
    .eq("email", email)
    .maybeSingle();
  if (profile?.id && profile.is_admin !== true) {
    const { error: flipError } = await auth.admin
      .from("profiles")
      .update({ is_premium: false })
      .eq("id", profile.id as string);
    if (flipError) {
      return NextResponse.json(
        { error: "Grant removed, but the profile update failed" },
        { status: 500 }
      );
    }
    profileUpdated = true;
  }

  return NextResponse.json({ ok: true, email, profileUpdated });
}
