import { NextResponse } from "next/server";
import { serviceClient } from "@/lib/admin-api";

/**
 * POST /api/coupons/validate { code } — public price check the
 * paywalls (web + native) call when a user applies a code.
 *
 * Answers only whether an ACTIVE code exists and its % off. Codes
 * apply to MONTHLY and YEARLY plans only, never Weekly (Zayne,
 * 2026-10-24) — reported here as `plans` so every surface states
 * the same rule; the paywalls enforce it where prices render.
 * No code enumeration help: unknown and inactive codes answer the
 * identical { valid: false }.
 */
export async function POST(req: Request) {
  let body: { code?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ valid: false });
  }
  if (typeof body.code !== "string") {
    return NextResponse.json({ valid: false });
  }
  const code = body.code.trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9_-]{2,23}$/.test(code)) {
    return NextResponse.json({ valid: false });
  }
  const admin = serviceClient();
  if (!admin) return NextResponse.json({ valid: false });
  const { data, error } = await admin
    .from("coupons")
    .select("percent_off, active")
    .eq("code", code)
    .maybeSingle();
  if (error || !data || !data.active) {
    return NextResponse.json({ valid: false });
  }
  return NextResponse.json({
    valid: true,
    code,
    percent_off: data.percent_off as number,
    plans: ["monthly", "yearly"],
  });
}
