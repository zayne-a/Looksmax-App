import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-api";

/**
 * /api/admin/coupons — owner-managed discount codes (2026-10-24,
 * Zayne). The owner creates codes and sets each code's % off from
 * the admin panel — in the phone app (/admin-coupons) and on the
 * site (/admin/coupons); both surfaces ride this one route.
 *
 * Codes apply to MONTHLY and YEARLY plans only, never Weekly —
 * enforced where prices are computed (the paywalls), with the
 * validate endpoint reporting the same rule.
 *
 * Auth is the exact /api/admin/content pattern: Bearer <redacted> →
 * requireAdmin (profile is_admin === true) → service-role writes.
 * Non-admins get a flat 404 (the invisibility rule).
 */

function forbidden() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

/** Normalise a coupon code: trim, uppercase, [A-Z0-9_-], 3–24 chars. */
function validCode(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const code = v.trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9_-]{2,23}$/.test(code)) return null;
  return code;
}

function validPercent(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : v;
  if (typeof n !== "number" || !Number.isInteger(n) || n < 1 || n > 90) {
    return null;
  }
  return n;
}

interface CouponRow {
  code: string;
  percent_off: number;
  active: boolean;
  created_by: string | null;
  created_at: string;
}

async function listCoupons(admin: {
  from: (t: string) => any;
}): Promise<CouponRow[] | null> {
  const { data, error } = await admin
    .from("coupons")
    .select("code, percent_off, active, created_by, created_at")
    .order("created_at", { ascending: false });
  if (error) return null;
  return (data ?? []) as CouponRow[];
}

/** GET — every coupon, newest first. */
export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth) return forbidden();
  const coupons = await listCoupons(auth.admin);
  if (!coupons) {
    return NextResponse.json(
      { error: "Could not load coupons" },
      { status: 500 }
    );
  }
  return NextResponse.json({ coupons });
}

/** POST { code, percent_off } — create a code (active immediately). */
export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth) return forbidden();
  let body: { code?: unknown; percent_off?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const code = validCode(body.code);
  const percent = validPercent(body.percent_off);
  if (!code || percent === null) {
    return NextResponse.json(
      {
        error:
          "A code is 3–24 characters (letters, numbers, - or _) and the discount is a whole % between 1 and 90.",
      },
      { status: 400 }
    );
  }
  const { error } = await auth.admin.from("coupons").insert({
    code,
    percent_off: percent,
    active: true,
    created_by: auth.userId,
  });
  if (error) {
    const duplicate = (error as { code?: string }).code === "23505";
    return NextResponse.json(
      {
        error: duplicate
          ? `The code ${code} already exists.`
          : "Could not create the coupon.",
      },
      { status: duplicate ? 409 : 500 }
    );
  }
  const coupons = await listCoupons(auth.admin);
  return NextResponse.json({ coupons: coupons ?? [] }, { status: 201 });
}

/** PATCH { code, active?, percent_off? } — toggle or re-price. */
export async function PATCH(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth) return forbidden();
  let body: { code?: unknown; active?: unknown; percent_off?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const code = validCode(body.code);
  if (!code) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }
  const patch: Record<string, unknown> = {};
  if (typeof body.active === "boolean") patch.active = body.active;
  if (body.percent_off !== undefined) {
    const percent = validPercent(body.percent_off);
    if (percent === null) {
      return NextResponse.json(
        { error: "The discount is a whole % between 1 and 90." },
        { status: 400 }
      );
    }
    patch.percent_off = percent;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to change" }, { status: 400 });
  }
  const { error } = await auth.admin
    .from("coupons")
    .update(patch)
    .eq("code", code);
  if (error) {
    return NextResponse.json(
      { error: "Could not update the coupon." },
      { status: 500 }
    );
  }
  const coupons = await listCoupons(auth.admin);
  return NextResponse.json({ coupons: coupons ?? [] });
}

/** DELETE { code } — remove a code entirely. */
export async function DELETE(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth) return forbidden();
  let body: { code?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const code = validCode(body.code);
  if (!code) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }
  const { error } = await auth.admin.from("coupons").delete().eq("code", code);
  if (error) {
    return NextResponse.json(
      { error: "Could not delete the coupon." },
      { status: 500 }
    );
  }
  const coupons = await listCoupons(auth.admin);
  return NextResponse.json({ coupons: coupons ?? [] });
}
