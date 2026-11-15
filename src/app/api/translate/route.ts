// Runtime translation for the native app (Zayne, 2026-11-15:
// all content lands in the selected language automatically — no
// manual translation passes).
//
// The app's bundled dictionaries cover the strings that existed
// when they were filled. Everything NEW — a fresh screen's copy,
// a new KB task, an AI-designed task stored in English — misses
// the dictionary and would render English forever. Instead the
// app asks this route: it translates the miss through Google
// Translate's free gtx endpoint (the same endpoint the locale
// fill tools use — no key, no Gemini, no paid service), and the
// app caches the result on-device forever, so each string is
// translated once per device per language.
//
// HONEST LIMITS (read before depending on this):
// - gtx is an UNOFFICIAL, undocumented endpoint. Google
//   rate-limits it per egress IP: heavy bursts return 429 (the
//   fill tools hit ~17h blocks on a shared VM IP). Vercel's
//   egress IPs are shared too, so blocks WILL happen — when
//   they do this route returns nulls and the app renders
//   English (never an error, never a hang) and retries later.
//   The per-device cache is what makes this viable: steady
//   state is near-zero calls, because each string translates
//   once.
// - Quality is machine translation (same as the bundled
//   dictionaries, which are GT output). Titles + frequencies
//   in the bundled files are hand-corrected; runtime
//   translations are not.
// - This route NEVER uses Gemini (Zayne's standing rule: no
//   Gemini keys for translation).
//
// Contract: POST { texts: string[], target: string } (target =
// the app's language code, e.g. "hi") → { ok: true,
// translations: (string|null)[], cached: number } — aligned
// with the input order; null = that text failed (English
// fallback on the client). Auth: any valid Supabase session
// (free or Pro — translation is not a tier feature). Caps: 20
// texts, 5000 chars total per request. Server cache: in-memory,
// 2000 entries (warm instances share it; cold starts lose it —
// the device cache is the durable layer).

import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 30;

// ---------- Caps ----------

const MAX_TEXTS = 20;
const MAX_TOTAL_CHARS = 5000;
const MAX_TEXT_CHARS = 1000;
const CACHE_MAX = 2000;
/** After a gtx failure, no new gtx calls for this long. */
const GTX_COOLDOWN_MS = 60_000;
/** Per-gtx-call timeout. */
const GTX_TIMEOUT_MS = 10_000;
/** Batching budget per gtx call (same as the fill tools). */
const BATCH_CHAR_BUDGET = 1500;
/** Retries per batch before giving up on it. */
const BATCH_RETRIES = 2;

// ---------- Language codes ----------

/** App language code → Google Translate target (zh needs zh-CN;
 *  every other code is already the GT target). */
const GT_TARGET: Record<string, string> = {
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

// ---------- Auth (same pattern as /api/plan-ai) ----------

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

async function validSession(token: string): Promise<boolean> {
  const admin = serviceClient();
  if (!admin) return false;
  try {
    const { data } = await admin.auth.getUser(token);
    return Boolean(data?.user?.id);
  } catch {
    return false;
  }
}

function bearer(req: NextRequest): string | null {
  const header = req.headers.get("authorization");
  return header?.startsWith("Bearer ") ? header.slice(7) : null;
}

// ---------- Server cache (in-memory, per instance) ----------

const cache = new Map<string, string>();

function cacheGet(text: string, target: string): string | null {
  return cache.get(`${target}\n${text}`) ?? null;
}

function cacheSet(text: string, target: string, translated: string): void {
  cache.set(`${target}\n${text}`, translated);
  while (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

// ---------- gtx ----------

/** Batch separator (same scheme as the fill tools). */
const SEP = "\n⟦§⟧\n";
const SEP_RE = /\s*⟦§⟧\s*/;

let gtxCooldownUntil = 0;

function gtxCoolingDown(): boolean {
  return Date.now() < gtxCooldownUntil;
}

function noteGtxFailure(): void {
  gtxCooldownUntil = Date.now() + GTX_COOLDOWN_MS;
}

/** One gtx call; null on any failure (HTTP error, timeout, bad shape). */
async function gtx(text: string, target: string): Promise<string | null> {
  try {
    const url =
      "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&dt=t&tl=" +
      encodeURIComponent(target) +
      "&q=" +
      encodeURIComponent(text);
    const res = await fetch(url, {
      signal: AbortSignal.timeout(GTX_TIMEOUT_MS),
    });
    if (!res.ok) {
      noteGtxFailure();
      return null;
    }
    const data: unknown = await res.json();
    const segments = (data as unknown[] | null)?.[0];
    if (!Array.isArray(segments)) return null;
    const out = segments
      .map((s) => (Array.isArray(s) ? String(s[0] ?? "") : ""))
      .join("");
    return out.trim().length > 0 ? out : null;
  } catch {
    return null;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Translate one string with retries; null when it fails. */
async function translateOne(
  text: string,
  target: string
): Promise<string | null> {
  for (let attempt = 0; attempt <= BATCH_RETRIES; attempt++) {
    if (gtxCoolingDown()) return null;
    const out = await gtx(text, target);
    if (out !== null) return out;
    await sleep(600 * (attempt + 1));
  }
  return null;
}

/**
 * Translate a batch: pack texts into 1500-char gtx calls joined
 * by the sentinel separator; a batch whose split count mismatches
 * falls back to per-string calls (same as the fill tools).
 * Returns a null per text that could not be translated.
 */
async function translateBatch(
  texts: string[],
  target: string
): Promise<(string | null)[]> {
  const results: (string | null)[] = new Array(texts.length).fill(null);
  let i = 0;
  while (i < texts.length) {
    if (gtxCoolingDown()) return results;
    let j = i;
    let budget = 0;
    while (
      j < texts.length &&
      budget + texts[j].length < BATCH_CHAR_BUDGET
    ) {
      budget += texts[j].length + SEP.length;
      j++;
    }
    const batch = texts.slice(i, j);
    if (batch.length === 1) {
      results[i] = await translateOne(batch[0], target);
    } else {
      let parts: string[] | null = null;
      for (let attempt = 0; attempt <= BATCH_RETRIES; attempt++) {
        if (gtxCoolingDown()) break;
        const joined = await gtx(batch.join(SEP), target);
        if (joined !== null) {
          const split = joined.split(SEP_RE);
          if (split.length === batch.length) {
            parts = split;
            break;
          }
        }
        await sleep(600 * (attempt + 1));
      }
      if (parts) {
        for (let k = 0; k < batch.length; k++) results[i + k] = parts[k];
      } else {
        for (let k = 0; k < batch.length; k++) {
          results[i + k] = await translateOne(batch[k], target);
          await sleep(120);
        }
      }
    }
    i = j;
    await sleep(150);
  }
  return results;
}

// ---------- Route ----------

export async function POST(req: NextRequest) {
  const token = bearer(req);
  if (!token || !(await validSession(token))) {
    return NextResponse.json(
      { ok: false, error: "unauthorized", detail: "valid session required" },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "bad_request", detail: "body is not JSON" },
      { status: 400 }
    );
  }
  const b = (typeof body === "object" && body !== null ? body : {}) as Record<
    string,
    unknown
  >;
  const texts = b.texts;
  const targetRaw = b.target;
  if (
    !Array.isArray(texts) ||
    texts.length === 0 ||
    texts.length > MAX_TEXTS ||
    !texts.every(
      (t) => typeof t === "string" && t.length > 0 && t.length <= MAX_TEXT_CHARS
    )
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: "bad_request",
        detail: `texts must be 1–${MAX_TEXTS} strings of 1–${MAX_TEXT_CHARS} chars`,
      },
      { status: 400 }
    );
  }
  const totalChars = (texts as string[]).reduce((n, t) => n + t.length, 0);
  if (totalChars > MAX_TOTAL_CHARS) {
    return NextResponse.json(
      {
        ok: false,
        error: "bad_request",
        detail: `total chars must be ≤ ${MAX_TOTAL_CHARS}`,
      },
      { status: 400 }
    );
  }
  if (typeof targetRaw !== "string") {
    return NextResponse.json(
      { ok: false, error: "bad_request", detail: "target is required" },
      { status: 400 }
    );
  }
  const targetCode = targetRaw.trim().toLowerCase();
  // English needs no translation — echo (the client only calls
  // for non-English, but a stray call is free, not an error).
  if (targetCode === "en") {
    return NextResponse.json({
      ok: true,
      translations: texts,
      cached: texts.length,
    });
  }
  const gtTarget = GT_TARGET[targetCode];
  if (!gtTarget) {
    return NextResponse.json(
      { ok: false, error: "bad_request", detail: "unsupported target language" },
      { status: 400 }
    );
  }

  const input = texts as string[];
  const translations: (string | null)[] = new Array(input.length).fill(null);
  const missing: { text: string; index: number }[] = [];
  let cached = 0;
  for (let idx = 0; idx < input.length; idx++) {
    const hit = cacheGet(input[idx], targetCode);
    if (hit !== null) {
      translations[idx] = hit;
      cached++;
    } else {
      missing.push({ text: input[idx], index: idx });
    }
  }
  if (missing.length > 0) {
    const fresh = await translateBatch(
      missing.map((m) => m.text),
      gtTarget
    );
    for (let k = 0; k < missing.length; k++) {
      const out = fresh[k];
      if (out !== null && out.trim().length > 0) {
        translations[missing[k].index] = out.trim();
        cacheSet(missing[k].text, targetCode, out.trim());
      }
    }
  }
  return NextResponse.json({ ok: true, translations, cached });
}
