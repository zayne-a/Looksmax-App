import { NextResponse } from "next/server";
import { getAppSettings } from "@/lib/settings";

/**
 * GET /api/settings — the public, resolved app settings
 * (2026-10-22). This is the canonical read path: the web chrome
 * (maintenance gate, announcement banner), the creator-program gate,
 * the paywall's trial copy and the native app all consume this one
 * shape. Nothing here is secret — the values are owner-published
 * product switches. no-store so an admin edit shows up on the next
 * page load, not after a cache window.
 */
export async function GET() {
  const settings = await getAppSettings();
  return NextResponse.json(settings, {
    headers: { "Cache-Control": "no-store" },
  });
}
