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
 *   deck          → the native app's ResultsDeck (page order, first
 *                    page, entrance style, per-page visibility),
 *                    administered from the phone's admin panel.
 *   persuasion_copy → the native app's onboarding persuasion
 *                    steps (per-step title/body overrides;
 *                    blank = the bundled copy), administered
 *                    from /admin/settings.
 */

/** Results-deck pages (native app), in their canonical order. The
 *  owner reorders / hides them from the in-app admin panel; the
 *  first entry of `order` is the page users land on. */
export const DECK_PAGE_IDS = [
  "overall",
  "eyes",
  "midface",
  "lower",
  "upper",
  "misc",
  "failos",
  "halos",
  "summary",
] as const;
export type DeckPageId = (typeof DECK_PAGE_IDS)[number];

export type DeckEntrance = "slide" | "fade" | "rise" | "instant";

export interface DeckSettings {
  order: DeckPageId[];
  entrance: DeckEntrance;
  hidden: DeckPageId[];
}

/** Persuasion steps (native onboarding pager), in flow order. */
export const PERSUASION_STEP_IDS = [
  "dating",
  "halo",
  "chad",
  "average",
  "scale",
  "studies",
] as const;
export type PersuasionStepId = (typeof PERSUASION_STEP_IDS)[number];

/** One step's owner override: an optional title and/or body.
 *  A blank field means "keep the bundled copy" for that field. */
export interface PersuasionStepCopy {
  title?: string;
  body?: string;
}

/** Owner overrides for persuasion copy (2026-10-24) — consumed
 *  by the native PersuasionScreen; edited from /admin/settings.
 *  Absent steps (or an empty map) mean the bundled copy ships. */
export type PersuasionCopy = Partial<
  Record<PersuasionStepId, PersuasionStepCopy>
>;

/** First-interface copy ids (2026-10-24): the app's opening
 *  screens, editable from /admin/settings. `welcome` is the
 *  no-session launch screen; `hero` is the onboarding hero card
 *  (the first interface a new user actually walks through). */
export const INTERFACE_SCREEN_IDS = ["welcome", "hero"] as const;
export type InterfaceScreenId = (typeof INTERFACE_SCREEN_IDS)[number];

/** One screen's owner overrides. `accent` is the hero's mint
 *  highlight segment ("90 days") — welcome ignores it. Blank /
 *  absent fields keep the app's built-in copy for that field.
 *  `translations` holds the same fields machine-translated into
 *  the native app's non-English locales (Zayne 2026-10-25: admin
 *  words translate to every language) — English is the top-level
 *  fields; the app renders translations[language.code] with
 *  per-field fallback to English. */
export interface InterfaceScreenCopy {
  headline?: string;
  body?: string;
  accent?: string;
  cta?: string;
  translations?: Partial<Record<InterfaceLocaleCode, InterfaceScreenCopy>>;
}

/** The native app's 27 non-English locales (ascend-native
 *  src/lib/i18n/locales/*.json; English is the key itself). The
 *  single source of truth for which languages interface copy is
 *  translated into — keep in sync with that directory. */
export const INTERFACE_LOCALE_CODES = [
  "ar",
  "az",
  "bn",
  "de",
  "es",
  "fa",
  "fr",
  "hi",
  "id",
  "it",
  "ja",
  "ko",
  "mr",
  "nl",
  "pl",
  "pt",
  "ro",
  "ru",
  "sw",
  "ta",
  "te",
  "th",
  "tr",
  "uk",
  "ur",
  "vi",
  "zh",
] as const;
export type InterfaceLocaleCode = (typeof INTERFACE_LOCALE_CODES)[number];

/** Owner overrides for first-interface copy — consumed by the
 *  native app's welcome + hero screens; edited from
 *  /admin/settings. Empty = all bundled copy. */
export type InterfaceCopy = Partial<
  Record<InterfaceScreenId, InterfaceScreenCopy>
>;

export interface AppSettings {
  maintenance: { on: boolean; message: string };
  announcement: { on: boolean; text: string };
  features: { creator_program: boolean; forum: boolean };
  /** 0 = no free trial (current product rule); 3 | 7 = trial days
   *  on Monthly & Yearly when the owner re-enables it. */
  trial_days: 0 | 3 | 7;
  /** Results-deck presentation (2026-10-24) — consumed by the
   *  native app's ResultsDeck; administered from the phone's admin
   *  panel (in-app /admin-deck). */
  deck: DeckSettings;
  /** Persuasion copy overrides (2026-10-24) — consumed by the
   *  native app's onboarding pager; administered from
   *  /admin/settings. Empty = all bundled copy. */
  persuasion_copy: PersuasionCopy;
  /** First-interface copy overrides (2026-10-24) — consumed by
   *  the native app's welcome + hero screens; administered from
   *  /admin/settings. Empty = all bundled copy. */
  interface_copy: InterfaceCopy;
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
  deck: {
    order: [...DECK_PAGE_IDS],
    entrance: "slide",
    hidden: [],
  },
  persuasion_copy: {},
  interface_copy: {},
};

export const SETTING_KEYS = [
  "maintenance",
  "announcement",
  "features",
  "trial_days",
  "deck",
  "persuasion_copy",
  "interface_copy",
] as const;
export type SettingKey = (typeof SETTING_KEYS)[number];

const isObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);

const asBool = (v: unknown, fallback: boolean): boolean =>
  typeof v === "boolean" ? v : fallback;

const asText = (v: unknown, fallback: string, max: number): string =>
  typeof v === "string" ? v.slice(0, max) : fallback;

const DECK_ENTRANCES: DeckEntrance[] = ["slide", "fade", "rise", "instant"];

function isDeckPageId(v: unknown): v is DeckPageId {
  return (
    typeof v === "string" && (DECK_PAGE_IDS as readonly string[]).includes(v)
  );
}

/** Normalise a raw deck value: order = known ids, deduped, with any
 *  missing pages appended in canonical order (so a page added later
 *  can never vanish); hidden = known ids, never "overall" (the free
 *  anchor page); entrance falls back to "slide". */
export function normaliseDeck(raw: unknown): DeckSettings {
  const d = DEFAULT_SETTINGS.deck;
  if (!isObj(raw)) return d;
  const seen = new Set<DeckPageId>();
  const order: DeckPageId[] = [];
  if (Array.isArray(raw.order)) {
    for (const v of raw.order) {
      if (isDeckPageId(v) && !seen.has(v)) {
        seen.add(v);
        order.push(v);
      }
    }
  }
  for (const id of DECK_PAGE_IDS) {
    if (!seen.has(id)) order.push(id);
  }
  const hidden: DeckPageId[] = [];
  if (Array.isArray(raw.hidden)) {
    for (const v of raw.hidden) {
      if (isDeckPageId(v) && v !== "overall" && !hidden.includes(v)) {
        hidden.push(v);
      }
    }
  }
  return {
    order,
    entrance: DECK_ENTRANCES.includes(raw.entrance as DeckEntrance)
      ? (raw.entrance as DeckEntrance)
      : d.entrance,
    hidden,
  };
}

const PERSUASION_TITLE_MAX = 120;
const PERSUASION_BODY_MAX = 2000;

function isPersuasionStepId(v: unknown): v is PersuasionStepId {
  return (
    typeof v === "string" &&
    (PERSUASION_STEP_IDS as readonly string[]).includes(v)
  );
}

/** Normalise a raw persuasion_copy value: known step ids only,
 *  title/body trimmed + capped; entries with neither are dropped
 *  (clearing a field restores the bundled copy for it). */
export function normalisePersuasionCopy(raw: unknown): PersuasionCopy {
  if (!isObj(raw)) return {};
  const out: PersuasionCopy = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!isPersuasionStepId(key) || !isObj(value)) continue;
    const entry: PersuasionStepCopy = {};
    if (typeof value.title === "string") {
      const title = value.title.trim().slice(0, PERSUASION_TITLE_MAX);
      if (title) entry.title = title;
    }
    if (typeof value.body === "string") {
      const body = value.body.trim().slice(0, PERSUASION_BODY_MAX);
      if (body) entry.body = body;
    }
    if (entry.title || entry.body) out[key] = entry;
  }
  return out;
}

export const INTERFACE_HEADLINE_MAX = 120;
export const INTERFACE_BODY_MAX = 500;
export const INTERFACE_ACCENT_MAX = 40;
export const INTERFACE_CTA_MAX = 40;

function isInterfaceScreenId(v: unknown): v is InterfaceScreenId {
  return (
    typeof v === "string" &&
    (INTERFACE_SCREEN_IDS as readonly string[]).includes(v)
  );
}

function isInterfaceLocaleCode(v: unknown): v is InterfaceLocaleCode {
  return (
    typeof v === "string" &&
    (INTERFACE_LOCALE_CODES as readonly string[]).includes(v)
  );
}

const INTERFACE_FIELD_MAX = {
  headline: INTERFACE_HEADLINE_MAX,
  body: INTERFACE_BODY_MAX,
  accent: INTERFACE_ACCENT_MAX,
  cta: INTERFACE_CTA_MAX,
} as const;

/** Pick one screen's four text fields, trimmed + capped; empty
 *  fields dropped. Shared by the top level and every translation
 *  entry (translations never nest — their fields are plain text). */
function pickScreenFields(value: Record<string, unknown>): InterfaceScreenCopy {
  const entry: InterfaceScreenCopy = {};
  for (const field of ["headline", "body", "accent", "cta"] as const) {
    if (typeof value[field] === "string") {
      const v = value[field].trim().slice(0, INTERFACE_FIELD_MAX[field]);
      if (v) entry[field] = v;
    }
  }
  return entry;
}

/** Normalise a raw interface_copy value: known screen ids only,
 *  fields trimmed + capped; entries with nothing left are dropped
 *  (clearing a field restores the bundled copy for it). Translation
 *  entries survive the same treatment: known locale codes only,
 *  same caps, empty locales dropped. */
export function normaliseInterfaceCopy(raw: unknown): InterfaceCopy {
  if (!isObj(raw)) return {};
  const out: InterfaceCopy = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!isInterfaceScreenId(key) || !isObj(value)) continue;
    const entry = pickScreenFields(value);
    if (isObj(value.translations)) {
      const translations: Partial<
        Record<InterfaceLocaleCode, InterfaceScreenCopy>
      > = {};
      for (const [locale, tr] of Object.entries(value.translations)) {
        if (!isInterfaceLocaleCode(locale) || !isObj(tr)) continue;
        const sub = pickScreenFields(tr);
        if (sub.headline || sub.body || sub.accent || sub.cta) {
          translations[locale] = sub;
        }
      }
      if (Object.keys(translations).length > 0) {
        entry.translations = translations;
      }
    }
    if (
      entry.headline ||
      entry.body ||
      entry.accent ||
      entry.cta ||
      entry.translations
    ) {
      out[key] = entry;
    }
  }
  return out;
}

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
    deck: normaliseDeck(rows.deck),
    persuasion_copy: normalisePersuasionCopy(rows.persuasion_copy),
    interface_copy: normaliseInterfaceCopy(rows.interface_copy),
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
  if (key === "deck") {
    if (!isObj(value)) return null;
    if (
      value.order !== undefined &&
      (!Array.isArray(value.order) || !value.order.every(isDeckPageId))
    ) {
      return null;
    }
    if (
      value.hidden !== undefined &&
      (!Array.isArray(value.hidden) || !value.hidden.every(isDeckPageId))
    ) {
      return null;
    }
    if (
      value.entrance !== undefined &&
      !DECK_ENTRANCES.includes(value.entrance as DeckEntrance)
    ) {
      return null;
    }
    return normaliseDeck(value);
  }
  if (key === "persuasion_copy") {
    if (!isObj(value)) return null;
    for (const [k, v] of Object.entries(value)) {
      if (!isPersuasionStepId(k) || !isObj(v)) return null;
      if (v.title !== undefined && typeof v.title !== "string") return null;
      if (v.body !== undefined && typeof v.body !== "string") return null;
    }
    return normalisePersuasionCopy(value);
  }
  if (key === "interface_copy") {
    if (!isObj(value)) return null;
    for (const [k, v] of Object.entries(value)) {
      if (!isInterfaceScreenId(k) || !isObj(v)) return null;
      for (const f of ["headline", "body", "accent", "cta"] as const) {
        if (v[f] !== undefined && typeof v[f] !== "string") return null;
      }
      // Translations (server-managed, seed-sent): known locale
      // codes only, each a plain field object with string fields.
      if (v.translations !== undefined) {
        if (!isObj(v.translations)) return null;
        for (const [locale, tr] of Object.entries(v.translations)) {
          if (!isInterfaceLocaleCode(locale) || !isObj(tr)) return null;
          for (const f of ["headline", "body", "accent", "cta"] as const) {
            if (tr[f] !== undefined && typeof tr[f] !== "string") return null;
          }
        }
      }
    }
    return normaliseInterfaceCopy(value);
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
