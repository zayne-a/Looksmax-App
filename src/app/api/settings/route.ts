import { NextResponse } from "next/server";
import { getAppSettings } from "@/lib/settings";

// Freshness comes from getAppSettings() itself: it awaits
// connection() (next/server) before reading, so this handler runs
// per request under Cache Components. Do NOT add a legacy
// `dynamic = 'force-dynamic'` export — the migration guide says to
// remove it, and it was the missing request-time call (not a segment
// config) that let this route prerender with baked-in defaults
// (2026-11-13: empty interface_copy served for hours).

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
