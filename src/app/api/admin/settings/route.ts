import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-api";
import {
  SETTING_KEYS,
  getAppSettings,
  resolveSettings,
  validateSettingValue,
  type SettingKey,
} from "@/lib/settings";

/**
 * /api/admin/settings — owner control of public.app_settings
 * (2026-10-22). Same auth as /api/admin/content: Bearer JWT →
 * requireAdmin (profile is_admin === true) → service-role writes.
 * Every accepted key is genuinely consumed (see lib/settings.ts) —
 * there are deliberately no decorative switches here.
 */

function forbidden() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

/** GET — resolved settings + per-key row metadata (updated_at/by). */
export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth) return forbidden();

  const settings = await getAppSettings();
  const { data } = await auth.admin
    .from("app_settings")
    .select("key, updated_at, updated_by");
  const meta: Record<string, { updated_at: string; updated_by: string | null }> =
    {};
  for (const r of data ?? []) {
    meta[r.key as string] = {
      updated_at: r.updated_at as string,
      updated_by: (r.updated_by as string | null) ?? null,
    };
  }
  return NextResponse.json({ settings, meta });
}

interface SettingBody {
  key?: unknown;
  value?: unknown;
}

/** POST { key, value } — validate + upsert one setting. */
export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth) return forbidden();

  let body: SettingBody;
  try {
    body = (await req.json()) as SettingBody;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const key = typeof body.key === "string" ? body.key : "";
  if (!(SETTING_KEYS as readonly string[]).includes(key)) {
    return NextResponse.json(
      {
        error: `Unknown setting. Known settings: ${SETTING_KEYS.join(", ")}`,
      },
      { status: 400 }
    );
  }
  const value = validateSettingValue(key as SettingKey, body.value);
  if (value === null) {
    return NextResponse.json(
      { error: `Invalid value for ${key}` },
      { status: 400 }
    );
  }

  const { data: caller } = await auth.admin
    .from("profiles")
    .select("email")
    .eq("id", auth.userId)
    .single();

  const { error } = await auth.admin.from("app_settings").upsert(
    {
      key,
      value,
      updated_at: new Date().toISOString(),
      updated_by:
        typeof caller?.email === "string" ? caller.email : null,
    },
    { onConflict: "key" }
  );
  if (error) {
    return NextResponse.json(
      {
        error:
          "Could not save the setting — if this persists, the app_settings migration may not be applied yet.",
      },
      { status: 500 }
    );
  }

  // Re-read so the response carries the fully resolved shape.
  const { data: rows } = await auth.admin
    .from("app_settings")
    .select("key, value");
  const map: Record<string, unknown> = {};
  for (const r of rows ?? []) map[r.key as string] = r.value;
  return NextResponse.json({ ok: true, settings: resolveSettings(map) });
}
