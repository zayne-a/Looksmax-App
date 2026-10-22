import { serviceClient } from "./admin-api";

/**
 * App settings (2026-10-22, Zayne's directive): the owner runs the
 * product from /admin/settings instead of touching code. Values live
 * in public.app_settings (see the migration of the same date) and
 * are served publicly by GET /api/settings — web chrome, the paywall
 * and the native app all read the same resolved shape.
 *
 * HARD RULE (owner's "no fake controls"): every key here has a real
 * consumer —
 *   maintenance   → components/AppSettingsGate.tsx (web gate) + API
 *   announcement  → AppSettingsGate banner on the web home + API
 *   features.creator_program → components/CreatorProgramGate.tsx
 *                    wrapping /creator and /portal
 *   features.forum → API only for now (the forum lives in the
 *                    native app; there is no web forum surface)
 *   trial_days    → paywall + plan/dashboard/coach upsell copy, the
 *                    home/why-ascend/terms copy, and Max's prompt
 *                    (/api/support). 0 = NO free trial anywhere
 *                    (Zayne, 2026-10-23 — the reference app's model:
 *                    plans bill from day one, "cancel anytime" is
 *                    the only promise). 3 | 7 re-enable a trial on
 *                    Monthly & Yearly only, from the admin panel.
 */

export interface AppSettings {
  maintenance: { on: boolean; message: string };
  announcement: { on: boolean; text: string };
  features: { creator_program: boolean; forum: boolean };
  /** 0 = no free trial (current product rule); 3 | 7 = trial days
   *  on Monthly & Yearly when the owner re-enables it. */
  trial_days: 0 | 3 | 7;
}

export const DEFAULT_SETTINGS: AppSettings = {
  maintenance: {
    on: false,
    message:
      "Mewmax is briefly down for scheduled maintenance. We will be back shortly — your scans and plans are safe.",
  },
  announcement: { on: false, text: "" },
  features: { creator_program: true, forum: true },
  trial_days: 0,
};

export const SETTING_KEYS = [
  "maintenance",
  "announcement",
  "features",
  "trial_days",
] as const;
export type SettingKey = (typeof SETTING_KEYS)[number];

const isObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);

const asBool = (v: unknown, fallback: boolean): boolean =>
  typeof v === "boolean" ? v : fallback;

const asText = (v: unknown, fallback: string, max: number): string =>
  typeof v === "string" ? v.slice(0, max) : fallback;

/** Merge raw app_settings rows (key → jsonb value) over the
 *  defaults. Anything malformed falls back to the default for that
 *  field — a bad row can never take the site down. */
export function resolveSettings(
  rows: Record<string, unknown> | null | undefined
): AppSettings {
  const d = DEFAULT_SETTINGS;
  if (!rows) return d;
  const m = isObj(rows.maintenance) ? rows.maintenance : {};
  const a = isObj(rows.announcement) ? rows.announcement : {};
  const f = isObj(rows.features) ? rows.features : {};
  const t = rows.trial_days;
  return {
    maintenance: {
      on: asBool(m.on, d.maintenance.on),
      message: asText(m.message, d.maintenance.message, 300),
    },
    announcement: {
      on: asBool(a.on, d.announcement.on),
      text: asText(a.text, d.announcement.text, 300),
    },
    features: {
      creator_program: asBool(f.creator_program, d.features.creator_program),
      forum: asBool(f.forum, d.features.forum),
    },
    trial_days: t === 7 ? 7 : t === 3 ? 3 : 0,
  };
}

/** Validate one admin-submitted value for `key`. Returns the
 *  normalised value to store, or null when invalid. */
export function validateSettingValue(
  key: SettingKey,
  value: unknown
): unknown | null {
  if (key === "trial_days") {
    return value === 0 || value === 3 || value === 7 ? value : null;
  }
  if (!isObj(value)) return null;
  if (key === "maintenance") {
    if (typeof value.on !== "boolean") return null;
    if (value.message !== undefined && typeof value.message !== "string")
      return null;
    return {
      on: value.on,
      message: (value.message ?? "").toString().slice(0, 300),
    };
  }
  if (key === "announcement") {
    if (typeof value.on !== "boolean") return null;
    if (value.text !== undefined && typeof value.text !== "string")
      return null;
    return { on: value.on, text: (value.text ?? "").toString().slice(0, 300) };
  }
  // features
  if (
    typeof value.creator_program !== "boolean" ||
    typeof value.forum !== "boolean"
  ) {
    return null;
  }
  return {
    creator_program: value.creator_program,
    forum: value.forum,
  };
}

/**
 * Server-side read of the resolved settings (service role). Falls
 * back to DEFAULT_SETTINGS when the table doesn't exist yet (the
 * migration not applied) or Supabase is unconfigured — the site must
 * behave exactly as before in that state.
 */
export async function getAppSettings(): Promise<AppSettings> {
  const admin = serviceClient();
  if (!admin) return DEFAULT_SETTINGS;
  try {
    const { data, error } = await admin
      .from("app_settings")
      .select("key, value");
    if (error || !data) return DEFAULT_SETTINGS;
    const rows: Record<string, unknown> = {};
    for (const r of data) rows[r.key as string] = r.value;
    return resolveSettings(rows);
  } catch {
    return DEFAULT_SETTINGS;
  }
}
