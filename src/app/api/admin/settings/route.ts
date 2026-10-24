import { NextResponse, after } from "next/server";
import { requireAdmin } from "@/lib/admin-api";
import {
  INTERFACE_LOCALE_CODES,
  INTERFACE_SCREEN_IDS,
  SETTING_KEYS,
  getAppSettings,
  normaliseInterfaceCopy,
  resolveSettings,
  validateSettingValue,
  type InterfaceCopy,
  type InterfaceLocaleCode,
  type InterfaceScreenCopy,
  type SettingKey,
} from "@/lib/settings";
import {
  countMissingTranslations,
  fillInterfaceTranslations,
  mergeTranslationsIntoCurrent,
} from "@/lib/translate-interface";

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
  const valueRaw = validateSettingValue(key as SettingKey, body.value);
  if (valueRaw === null) {
    return NextResponse.json(
      { error: `Invalid value for ${key}` },
      { status: 400 }
    );
  }
  let value: unknown = valueRaw;

  // Interface copy translations (Zayne 2026-10-25: admin words
  // translate to every language). The admin page sends English
  // drafts only, so the server owns translations: client-sent
  // translations win (the VM seed path sends a fully translated
  // value); otherwise stored translations survive for fields whose
  // English is unchanged, changed or removed English drops its
  // translations, and missing translations are filled inline
  // inside a soft time budget — the rest stay English until the
  // next save converges them. A fill failure never fails the save.
  let translationStatus: {
    translated: number;
    failed: number;
    pending: number;
  } | null = null;
  if (key === "interface_copy") {
    const { data: storedRow } = await auth.admin
      .from("app_settings")
      .select("value")
      .eq("key", key)
      .single();
    const stored = normaliseInterfaceCopy(storedRow?.value ?? null);
    const incoming = value as InterfaceCopy;
    const merged: InterfaceCopy = {};
    for (const screen of INTERFACE_SCREEN_IDS) {
      const next = incoming[screen];
      const prev = stored[screen];
      if (!next && !prev) continue;
      const entry: InterfaceScreenCopy = { ...(next ?? {}) };
      const translations: Partial<
        Record<InterfaceLocaleCode, InterfaceScreenCopy>
      > = { ...(next?.translations ?? {}) };
      if (prev?.translations) {
        for (const field of ["headline", "body", "accent", "cta"] as const) {
          const newText = next?.[field];
          if (newText !== undefined && newText === prev[field]) {
            for (const code of INTERFACE_LOCALE_CODES) {
              const t = prev.translations[code]?.[field];
              if (t && !translations[code]?.[field]) {
                translations[code] ??= {};
                translations[code][field] = t;
              }
            }
          }
        }
      }
      if (Object.keys(translations).length > 0) {
        entry.translations = translations;
      } else {
        delete entry.translations;
      }
      if (
        entry.headline ||
        entry.body ||
        entry.accent ||
        entry.cta ||
        entry.translations
      ) {
        merged[screen] = entry;
      }
    }
    // Save the merged English + carried translations FIRST, so a
    // translation failure can never fail the save. Fresh
    // translations are then produced in the background (after())
    // and upserted incrementally as each locale completes — a
    // stale fill never clobbers newer English (see
    // mergeTranslationsIntoCurrent), and the response reports how
    // many translations were queued.
    value = merged;
    const queued = countMissingTranslations(merged);
    translationStatus = { translated: 0, failed: 0, pending: queued };
    if (queued > 0) {
      after(async () => {
        try {
          await fillInterfaceTranslations(merged, {
            budgetMs: 240_000,
            onProgress: async (partial) => {
              const { data: currentRow } = await auth.admin
                .from("app_settings")
                .select("value")
                .eq("key", key)
                .single();
              const current = normaliseInterfaceCopy(
                currentRow?.value ?? null
              );
              const updated = mergeTranslationsIntoCurrent(
                current,
                partial,
                merged
              );
              await auth.admin.from("app_settings").upsert(
                {
                  key,
                  value: updated,
                  updated_at: new Date().toISOString(),
                  updated_by: "translation-fill",
                },
                { onConflict: "key" }
              );
            },
          });
        } catch {
          // Background fill never fails the save.
        }
      });
    }
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
  return NextResponse.json({
    ok: true,
    settings: resolveSettings(map),
    ...(translationStatus ? { translationStatus } : {}),
  });
}
