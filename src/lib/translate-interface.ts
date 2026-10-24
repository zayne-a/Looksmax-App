/**
 * translate-interface.ts — machine-translate admin interface copy
 * (welcome + hero words) into every native-app locale (Zayne
 * 2026-10-25: admin words translate to every language).
 *
 * Same free gtx endpoint + batching the native repo's
 * scripts/translate-locales.mjs uses (no key): all missing fields
 * for one locale pack into a single request under a sentinel
 * separator, verified on split, with per-string fallback. English
 * is the source; translations never block a save — this fills
 * what it can inside a soft time budget and reports the rest as
 * pending, so the next save (or the VM seed job) converges them.
 * A failed or partial fill never fails the setting save itself.
 */
import {
  INTERFACE_LOCALE_CODES,
  INTERFACE_SCREEN_IDS,
  type InterfaceCopy,
  type InterfaceLocaleCode,
  type InterfaceScreenCopy,
} from "./settings";

const TARGETS: Record<InterfaceLocaleCode, string> = {
  zh: "zh-CN",
  hi: "hi",
  es: "es",
  fr: "fr",
  de: "de",
  ru: "ru",
  pt: "pt",
  it: "it",
  ro: "ro",
  az: "az",
  ar: "ar",
  bn: "bn",
  ur: "ur",
  id: "id",
  ja: "ja",
  tr: "tr",
  ko: "ko",
  vi: "vi",
  fa: "fa",
  sw: "sw",
  mr: "mr",
  ta: "ta",
  te: "te",
  pl: "pl",
  uk: "uk",
  nl: "nl",
  th: "th",
};

const SEP = "\n⟦§⟧\n";
const SEP_RE = /\s*⟦§⟧\s*/;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function gtx(text: string, tl: string): Promise<string> {
  const url =
    "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&dt=t&tl=" +
    encodeURIComponent(tl) +
    "&q=" +
    encodeURIComponent(text);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`gtx HTTP ${res.status}`);
  const data = (await res.json()) as unknown;
  const segments = (data as { 0?: unknown })?.[0];
  if (!Array.isArray(segments)) throw new Error("gtx: unexpected shape");
  return segments
    .map((s) => (Array.isArray(s) ? String(s[0] ?? "") : ""))
    .join("");
}

async function translateOne(text: string, tl: string): Promise<string | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const out = await gtx(text, tl);
      if (out && out.trim().length > 0) return out;
    } catch {
      // fallthrough to retry
    }
    await sleep(600 * (attempt + 1));
  }
  return null;
}

async function translateBatch(
  texts: string[],
  tl: string
): Promise<(string | null)[]> {
  const results: (string | null)[] = new Array(texts.length).fill(null);
  let i = 0;
  while (i < texts.length) {
    let j = i;
    let budget = 0;
    while (j < texts.length && budget + texts[j].length < 1500) {
      budget += texts[j].length + SEP.length;
      j++;
    }
    const batch = texts.slice(i, j);
    if (batch.length === 1) {
      results[i] = await translateOne(batch[0], tl);
    } else {
      let parts: string[] | null = null;
      try {
        const joined = await gtx(batch.join(SEP), tl);
        const split = joined.split(SEP_RE);
        if (split.length === batch.length) parts = split;
      } catch {
        parts = null;
      }
      if (parts) {
        for (let k = 0; k < batch.length; k++) results[i + k] = parts[k];
      } else {
        for (let k = 0; k < batch.length; k++) {
          results[i + k] = await translateOne(batch[k], tl);
          await sleep(120);
        }
      }
    }
    i = j;
    await sleep(150);
  }
  return results;
}

const FIELDS = ["headline", "body", "accent", "cta"] as const;

export interface FillResult {
  copy: InterfaceCopy;
  translated: number;
  failed: number;
  pending: number;
}

/**
 * Fill every missing translation in `copy` (fields whose English
 * text exists but whose locale entry is absent), inside `budgetMs`
 * (locales run 6 at a time; unstarted locales count as pending).
 * Returns a deep-cloned copy — the input is never mutated.
 */
export async function fillInterfaceTranslations(
  copy: InterfaceCopy,
  budgetMs = 8000
): Promise<FillResult> {
  const started = Date.now();
  const out: InterfaceCopy = JSON.parse(JSON.stringify(copy)) as InterfaceCopy;
  let translated = 0;
  let failed = 0;
  let pending = 0;

  // Missing work per locale, computed once (fills don't create new
  // missing entries — they only complete them).
  const missingByLocale = new Map<
    InterfaceLocaleCode,
    { screen: string; field: (typeof FIELDS)[number]; text: string }[]
  >();
  for (const code of INTERFACE_LOCALE_CODES) {
    const missing: { screen: string; field: (typeof FIELDS)[number]; text: string }[] = [];
    for (const screen of INTERFACE_SCREEN_IDS) {
      const entry = out[screen];
      if (!entry) continue;
      for (const field of FIELDS) {
        const text = entry[field];
        if (!text) continue;
        if (entry.translations?.[code]?.[field]) continue;
        missing.push({ screen, field, text });
      }
    }
    if (missing.length > 0) missingByLocale.set(code, missing);
  }

  const codes = [...missingByLocale.keys()];
  for (let base = 0; base < codes.length; base += 6) {
    if (Date.now() - started > budgetMs) {
      for (let k = base; k < codes.length; k++) {
        pending += missingByLocale.get(codes[k])?.length ?? 0;
      }
      break;
    }
    const chunk = codes.slice(base, base + 6);
    await Promise.all(
      chunk.map(async (code) => {
        const missing = missingByLocale.get(code) ?? [];
        const results = await translateBatch(
          missing.map((m) => m.text),
          TARGETS[code]
        );
        for (let i = 0; i < missing.length; i++) {
          const { screen, field } = missing[i];
          const t = results[i];
          const entry = out[screen as keyof InterfaceCopy] as
            | InterfaceScreenCopy
            | undefined;
          if (!entry) continue;
          if (t && t.trim().length > 0) {
            entry.translations ??= {};
            entry.translations[code] ??= {};
            entry.translations[code][field] = t.trim();
            translated++;
          } else {
            failed++;
          }
        }
      })
    );
  }

  return { copy: out, translated, failed, pending };
}
