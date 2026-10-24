/**
 * translate-interface.ts — transcreate admin interface copy
 * (welcome + hero words) into every native-app locale (Zayne
 * 2026-10-25: admin words translate to every language; 04:37 IST
 * refinement: they must read as if WRITTEN for native speakers,
 * not like Google Translate output).
 *
 * Engine: Gemini through the app's own fallback chain
 * (lib/ai-providers completeWithFallback — key pool + model
 * failover, same as /api/plan), prompted as a native copywriter:
 * transcreate, never literally translate; natural word order and
 * idiom; no translationese. One call per screen per locale.
 *
 * Hero accent model: English stores body as a prefix ("...level
 * up in") + accent ("90 days"), rendered as body + accent + ".".
 * That word order is English-only, so a translation stores the
 * FULL natural sentence as body and the accent as the exact
 * substring of that sentence to highlight — the native hero
 * renders the substring in mint wherever it sits. A translation
 * whose accent is not verbatim inside its body is rejected (and
 * retried once); a locale that still fails keeps English until
 * the next save, never a broken highlight.
 *
 * Fills never block a save: fillInterfaceTranslations works
 * inside a soft time budget, reports the rest as pending, and
 * calls onProgress with the accumulated copy after each locale
 * so the caller can persist partial progress (a killed background
 * fill loses nothing already done).
 */
import { completeWithFallback } from "./ai-providers";
import {
  INTERFACE_ACCENT_MAX,
  INTERFACE_BODY_MAX,
  INTERFACE_CTA_MAX,
  INTERFACE_HEADLINE_MAX,
  INTERFACE_LOCALE_CODES,
  INTERFACE_SCREEN_IDS,
  type InterfaceCopy,
  type InterfaceLocaleCode,
  type InterfaceScreenCopy,
} from "./settings";

const LANGUAGE_NAMES: Record<InterfaceLocaleCode, string> = {
  ar: "Arabic",
  az: "Azerbaijani",
  bn: "Bengali",
  de: "German",
  es: "Spanish",
  fa: "Persian",
  fr: "French",
  hi: "Hindi",
  id: "Indonesian",
  it: "Italian",
  ja: "Japanese",
  ko: "Korean",
  mr: "Marathi",
  nl: "Dutch",
  pl: "Polish",
  pt: "Portuguese (Brazilian)",
  ro: "Romanian",
  ru: "Russian",
  sw: "Swahili",
  ta: "Tamil",
  te: "Telugu",
  th: "Thai",
  tr: "Turkish",
  uk: "Ukrainian",
  ur: "Urdu",
  vi: "Vietnamese",
  zh: "Chinese (Simplified)",
};

const FIELDS = ["headline", "body", "accent", "cta"] as const;
const FIELD_MAX = {
  headline: INTERFACE_HEADLINE_MAX,
  body: INTERFACE_BODY_MAX,
  accent: INTERFACE_ACCENT_MAX,
  cta: INTERFACE_CTA_MAX,
} as const;

const SYSTEM =
  "You are a native copywriter for a mobile app. Transcreate (do NOT literally translate) the given English screen texts so they read as if originally written for native speakers of the target language: natural word order, natural idiom, no translationese, no awkward calques, no copied phrasing. Keep the brand name \"Mewmax\" unchanged. Keep digits as digits. Return ONLY JSON, no commentary.";

function capFields(
  out: Partial<InterfaceScreenCopy>
): Partial<InterfaceScreenCopy> {
  const capped: Partial<InterfaceScreenCopy> = {};
  for (const field of FIELDS) {
    const v = out[field];
    if (typeof v === "string" && v.trim()) {
      capped[field] = v.trim().slice(0, FIELD_MAX[field]);
    }
  }
  return capped;
}

/**
 * One transcreation call for one screen in one locale. Returns the
 * validated fields, or null when the model fails or its output
 * fails validation (caller counts it failed and retries next save).
 * `correction` appends a fix-up note on the single retry.
 */
async function transcreateScreen(
  screen: string,
  entry: InterfaceScreenCopy,
  code: InterfaceLocaleCode,
  correction?: string
): Promise<Partial<InterfaceScreenCopy> | null> {
  const lang = LANGUAGE_NAMES[code];
  const isHero = screen === "hero";
  const fullSentence =
    isHero && entry.body && entry.accent
      ? `${entry.body} ${entry.accent}.`
      : null;
  const user =
    (isHero
      ? `Screen: hero. English headline: ${JSON.stringify(entry.headline ?? "")}. ` +
        `English body sentence: ${JSON.stringify(fullSentence ?? entry.body ?? "")}. ` +
        `English accent phrase (the part highlighted in the app): ${JSON.stringify(entry.accent ?? "")}. ` +
        `English button: ${JSON.stringify(entry.cta ?? "")}. ` +
        `Write ONE natural full ${lang} sentence carrying the body sentence's meaning, then report the exact substring of YOUR sentence that corresponds to the accent phrase (it must appear verbatim, character for character, inside your sentence). ` +
        `Return JSON: {"headline": "...", "body": "<your full sentence>", "accent": "<verbatim substring of body>", "cta": "..."}. ` +
        `Omit any field whose English was empty.`
      : `Screen: welcome. English headline: ${JSON.stringify(entry.headline ?? "")}. ` +
        `English body: ${JSON.stringify(entry.body ?? "")}. ` +
        `English button: ${JSON.stringify(entry.cta ?? "")}. ` +
        `Transcreate each naturally into ${lang}. ` +
        `Return JSON: {"headline": "...", "body": "...", "cta": "..."}. ` +
        `Omit any field whose English was empty.`) +
    (correction ? ` Correction: ${correction}` : "");
  const res = await completeWithFallback({
    system: SYSTEM,
    messages: [{ role: "user", content: user }],
    json: true,
    maxTokens: 600,
    temperature: 0.3,
    timeoutMs: 25_000,
  });
  if (!res) return null;
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(res.text) as Record<string, unknown>;
  } catch {
    return null;
  }
  const out: Partial<InterfaceScreenCopy> = {};
  for (const field of FIELDS) {
    if (field === "accent" && !isHero) continue;
    const english = entry[field];
    if (!english) continue;
    const v = parsed[field];
    if (typeof v !== "string" || !v.trim()) return null;
    out[field] = v.trim();
  }
  if (isHero && entry.accent) {
    // The accent MUST sit verbatim inside the translated sentence,
    // or the native highlight has nothing to highlight.
    if (
      !out.body ||
      !out.accent ||
      !out.body.includes(out.accent)
    ) {
      if (!correction) {
        return transcreateScreen(
          screen,
          entry,
          code,
          "Your accent MUST appear character-for-character inside your body sentence. Rewrite the sentence so the accent phrase sits naturally inside it, then report that exact substring."
        );
      }
      return null;
    }
  }
  return capFields(out);
}

export interface FillOptions {
  budgetMs?: number;
  /** Called after each locale completes, with the accumulated copy
   *  (deep-cloned). Use it to persist partial progress. */
  onProgress?: (partial: InterfaceCopy) => Promise<void> | void;
}

export interface FillResult {
  copy: InterfaceCopy;
  translated: number;
  failed: number;
  pending: number;
}

/** Count fields whose English text exists but whose locale entry
 *  is absent — the synchronous part of the status, computed without
 *  any model call. */
export function countMissingTranslations(copy: InterfaceCopy): number {
  let missing = 0;
  for (const code of INTERFACE_LOCALE_CODES) {
    for (const screen of INTERFACE_SCREEN_IDS) {
      const entry = copy[screen];
      if (!entry) continue;
      for (const field of FIELDS) {
        if (field === "accent" && screen !== "hero") continue;
        if (!entry[field]) continue;
        if (entry.translations?.[code]?.[field]) continue;
        missing++;
      }
    }
  }
  return missing;
}

/**
 * Fill every missing translation in `copy` (fields whose English
 * text exists but whose locale entry is absent), inside `budgetMs`
 * (locales run 6 at a time; unstarted locales count as pending).
 * Returns a deep-cloned copy — the input is never mutated. Only
 * fields that were missing are written; existing translations are
 * never overwritten by a re-fill.
 */
export async function fillInterfaceTranslations(
  copy: InterfaceCopy,
  opts: FillOptions = {}
): Promise<FillResult> {
  const budgetMs = opts.budgetMs ?? 120_000;
  const started = Date.now();
  const out: InterfaceCopy = JSON.parse(JSON.stringify(copy)) as InterfaceCopy;
  let translated = 0;
  let failed = 0;
  let pending = 0;

  const missingByLocale = new Map<
    InterfaceLocaleCode,
    { screen: string; entry: InterfaceScreenCopy; fields: (typeof FIELDS)[number][] }[]
  >();
  for (const code of INTERFACE_LOCALE_CODES) {
    const jobs: { screen: string; entry: InterfaceScreenCopy; fields: (typeof FIELDS)[number][] }[] = [];
    for (const screen of INTERFACE_SCREEN_IDS) {
      const entry = out[screen];
      if (!entry) continue;
      const fields = FIELDS.filter((field) => {
        if (field === "accent" && screen !== "hero") return false;
        if (!entry[field]) return false;
        return !entry.translations?.[code]?.[field];
      });
      if (fields.length > 0) jobs.push({ screen, entry, fields });
    }
    if (jobs.length > 0) missingByLocale.set(code, jobs);
  }

  const codes = [...missingByLocale.keys()];
  for (let base = 0; base < codes.length; base += 6) {
    if (Date.now() - started > budgetMs) {
      for (let k = base; k < codes.length; k++) {
        for (const job of missingByLocale.get(codes[k]) ?? []) {
          pending += job.fields.length;
        }
      }
      break;
    }
    const chunk = codes.slice(base, base + 6);
    await Promise.all(
      chunk.map(async (code) => {
        const jobs = missingByLocale.get(code) ?? [];
        await Promise.all(
          jobs.map(async (job) => {
            const result = await transcreateScreen(
              job.screen,
              job.entry,
              code
            );
            if (!result) {
              failed += job.fields.length;
              return;
            }
            const target = out[job.screen as keyof InterfaceCopy] as
              | InterfaceScreenCopy
              | undefined;
            if (!target) return;
            target.translations ??= {};
            target.translations[code] ??= {};
            for (const field of job.fields) {
              const v = result[field];
              if (v) {
                target.translations[code][field] = v;
                translated++;
              } else {
                failed++;
              }
            }
          })
        );
        if (opts.onProgress) {
          await opts.onProgress(
            JSON.parse(JSON.stringify(out)) as InterfaceCopy
          );
        }
      })
    );
  }

  return { copy: out, translated, failed, pending };
}

/**
 * Merge translations from `translated` (built from `base` English)
 * onto `current` (possibly newer English): a translation applies
 * only when the current English field still equals the base
 * English it was translated from — a newer admin edit is never
 * clobbered by a stale background fill.
 */
export function mergeTranslationsIntoCurrent(
  current: InterfaceCopy,
  translated: InterfaceCopy,
  base: InterfaceCopy
): InterfaceCopy {
  const out: InterfaceCopy = JSON.parse(JSON.stringify(current)) as InterfaceCopy;
  for (const screen of INTERFACE_SCREEN_IDS) {
    const cur = out[screen];
    const tr = translated[screen];
    const b = base[screen];
    if (!cur || !tr || !b) continue;
    for (const code of INTERFACE_LOCALE_CODES) {
      const trLocale = tr.translations?.[code];
      if (!trLocale) continue;
      for (const field of FIELDS) {
        const v = trLocale[field];
        if (!v) continue;
        if (cur[field] === undefined || cur[field] !== b[field]) continue;
        if (cur.translations?.[code]?.[field]) continue;
        cur.translations ??= {};
        cur.translations[code] ??= {};
        cur.translations[code][field] = v;
      }
    }
  }
  return out;
}
