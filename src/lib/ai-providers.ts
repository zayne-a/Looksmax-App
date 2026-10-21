/**
 * Multi-provider AI fallback (added 2026-10-21, Zayne: "add more API
 * keys so coach or plan builder never runs out").
 *
 * The Gemini key pool stays PRIMARY everywhere — it is the fastest,
 * best-tuned path and its quota stacks across 9 accounts. This module
 * is the safety net behind it: when every Gemini key/model is down or
 * exhausted, generation fails over to independent providers with their
 * own quotas, in this order:
 *
 *   1. Groq          (GROQ_API_KEY)          — OpenAI-compatible, very fast
 *   2. NVIDIA NIM    (NVIDIA_API_KEY)        — OpenAI-compatible
 *   3. OpenRouter    (OPENROUTER_API_KEY)    — free-tier models only
 *   4. Cloudflare    (CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID)
 *                      Workers AI, OpenAI-compatible endpoint (account
 *                      id configured + live-verified 2026-10-21).
 *
 * Every provider speaks the OpenAI chat-completions shape, so one
 * client covers all four. Keys are read from env ONLY and never logged
 * (provider + model names are fine to log; key material never is).
 * The deterministic plan engine remains the final fallback after this
 * layer — this module returning null is never a user-facing error by
 * itself.
 */

export interface ProviderMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ProviderDef {
  name: string;
  baseUrl: string;
  apiKey: string;
  models: string[];
  /** Models known to honour OpenAI JSON mode on this provider. */
  jsonModeModels?: string[];
  extraHeaders?: Record<string, string>;
}

function buildProviders(): ProviderDef[] {
  const providers: ProviderDef[] = [];

  const groqKey = process.env.GROQ_API_KEY?.trim();
  if (groqKey) {
    providers.push({
      name: "groq",
      baseUrl: "https://api.groq.com/openai/v1",
      apiKey: groqKey,
      // Only models this key can actually reach (verified live
      // 2026-10-21 — the Llama 3.3 listing is NOT on this account).
      models: ["openai/gpt-oss-120b", "qwen/qwen3.8-27b", "openai/gpt-oss-20b"],
      jsonModeModels: ["openai/gpt-oss-120b", "openai/gpt-oss-20b"],
    });
  }

  // NVIDIA keys pool like the Gemini keys: NVIDIA_API_KEYS (comma
  // list) plus the single-key vars NVIDIA_API_KEY / NVIDIA_API_KEY_2.
  // Each key becomes its own chain entry so quota spreads across them
  // (both keys Zayne supplied verified live against the chat models).
  const nvidiaKeys = [
    ...(process.env.NVIDIA_API_KEYS ?? "")
      .split(",")
      .map((k) => k.trim())
      .filter((k) => k.length > 0),
    ...[
      "NVIDIA_API_KEY",
      "NVIDIA_API_KEY_2",
      "NVIDIA_API_KEY_3",
      "NVIDIA_API_KEY_4",
      "NVIDIA_API_KEY_5",
      "NVIDIA_API_KEY_6",
      "NVIDIA_API_KEY_7",
      "NVIDIA_API_KEY_8",
    ].map((name) => process.env[name]?.trim() ?? ""),
  ].filter((k, i, arr) => k.length > 0 && arr.indexOf(k) === i);
  nvidiaKeys.forEach((nvidiaKey, i) => {
    providers.push({
      name: i === 0 ? "nvidia" : `nvidia-${i + 1}`,
      baseUrl: "https://integrate.api.nvidia.com/v1",
      apiKey: nvidiaKey,
      models: [
        // Verified live 2026-10-21: the headline Nemotron/DeepSeek
        // endpoints 404 for this key's account ("Function not found
        // for account") — these two actually serve chat completions.
        // Nemotron Lightning is a reasoning model: its thinking rides
        // a separate field and content lands given a normal token
        // budget, which both callers already allow.
        "stepfun-ai/step-5-preview",
        "nvidia/nemotron-3.5-lightning-30b-a3b",
      ],
    });
  });

  const openrouterKey = process.env.OPENROUTER_API_KEY?.trim();
  if (openrouterKey) {
    providers.push({
      name: "openrouter",
      baseUrl: "https://openrouter.ai/api/v1",
      apiKey: openrouterKey,
      // Free-tier models only (the key carries no credit balance;
      // free models share a 50-requests/day account budget, so this
      // provider is deliberately LAST of the general-purpose three).
      models: [
        // Verified live 2026-10-21: inkling answered; several other
        // listed :free models 404/503 upstream — order is deliberate.
        "thinkingmachines/inkling:free",
        "thinkingmachines/inkling-small:free",
        "google/gemma-4-31b-it:free",
        "minimax/minimax-m3.1-flash:free",
      ],
      extraHeaders: { "X-Title": "Ascend" },
    });
  }

  const cfToken = process.env.CLOUDFLARE_API_TOKEN?.trim();
  const cfAccount = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  if (cfToken && cfAccount) {
    providers.push({
      name: "cloudflare",
      baseUrl: `https://api.cloudflare.com/client/v4/accounts/${cfAccount}/ai/v1`,
      apiKey: cfToken,
      models: ["@cf/meta/llama-3.3-70b-instruct-fp8-fast"],
    });
  }

  return providers;
}

/** True when at least one non-Gemini provider is configured. */
export function fallbackConfigured(): boolean {
  return buildProviders().length > 0;
}

/** Names of the configured fallback providers, for diagnostics. */
export function fallbackProviderNames(): string[] {
  return buildProviders().map((p) => p.name);
}

interface CompleteOpts {
  system: string;
  messages: ProviderMessage[];
  json?: boolean;
  maxTokens?: number;
  temperature?: number;
  /** Per-attempt timeout; also clamped to `deadline` when given. */
  timeoutMs: number;
  deadline?: number;
  /** Hard cap on total provider/model attempts across the chain.
   *  Callers with long chains of slow providers (plan builder vs 8
   *  pooled NVIDIA keys) use it so one job cannot burn its whole
   *  budget waiting on timeouts. */
  maxAttempts?: number;
}

function chatBody(
  provider: ProviderDef,
  model: string,
  opts: CompleteOpts,
  stream: boolean
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: opts.system },
      ...opts.messages.map((m) => ({ role: m.role, content: m.content })),
    ],
    temperature: opts.temperature ?? 0.7,
    max_tokens: opts.maxTokens ?? 4096,
    stream,
  };
  if (opts.json && provider.jsonModeModels?.includes(model)) {
    body.response_format = { type: "json_object" };
  }
  return body;
}

/**
 * Concurrency guard for fallback completions: the plan builder fires
 * 5 part-jobs in parallel, and 5 simultaneous giant prompts stampede
 * the free tiers into 413/429s and timeouts (observed live in local
 * testing, 2026-10-21). At most 2 fallback completions run at once;
 * the rest queue — the caller's deadline still bounds total waiting.
 */
let activeCompletions = 0;
const completionWaiters: (() => void)[] = [];

async function acquireCompletionSlot(): Promise<void> {
  if (activeCompletions < 2) {
    activeCompletions += 1;
    return;
  }
  await new Promise<void>((resolve) => completionWaiters.push(resolve));
  activeCompletions += 1;
}

function releaseCompletionSlot(): void {
  activeCompletions -= 1;
  const next = completionWaiters.shift();
  if (next) next();
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * One non-streaming completion across the whole fallback chain.
 * Providers are tried in order, models in order inside each provider;
 * the first response with non-empty text wins. A 413/429 (free-tier
 * per-minute token caps) earns ONE retry after a short pause — the
 * cap window is a minute, but a couple of seconds often clears the
 * burst the caller's own parallel jobs created. Returns null when
 * every provider/model fails or the deadline passes — callers keep
 * their own final fallback (deterministic plan / honest busy message).
 */
export async function completeWithFallback(
  opts: CompleteOpts
): Promise<{ text: string; provider: string; model: string } | null> {
  await acquireCompletionSlot();
  try {
    let attemptsUsed = 0;
    const providers = buildProviders();
    for (const provider of providers) {
      for (const model of provider.models) {
        for (let attemptNo = 0; attemptNo < 2; attemptNo += 1) {
          if (opts.maxAttempts !== undefined && attemptsUsed >= opts.maxAttempts)
            return null;
          attemptsUsed += 1;
          const remaining = opts.deadline
            ? opts.deadline - Date.now()
            : opts.timeoutMs;
          if (remaining < 1_000) return null;
          try {
            const res = await fetch(`${provider.baseUrl}/chat/completions`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${provider.apiKey}`,
                ...(provider.extraHeaders ?? {}),
              },
              signal: AbortSignal.timeout(Math.min(opts.timeoutMs, remaining)),
              body: JSON.stringify(chatBody(provider, model, opts, false)),
            });
            if (!res.ok) {
              console.warn(
                `[ai-fallback] ${provider.name}/${model} returned HTTP ${res.status}; trying next`
              );
              if (
                (res.status === 413 || res.status === 429) &&
                attemptNo === 0 &&
                (!opts.deadline || opts.deadline - Date.now() > 5_000)
              ) {
                await sleep(2_500);
                continue;
              }
              break;
            }
            const data = (await res.json()) as {
              choices?: { message?: { content?: string } }[];
            };
            const text = data.choices?.[0]?.message?.content?.trim();
            if (!text) {
              console.warn(
                `[ai-fallback] ${provider.name}/${model} returned no content; trying next`
              );
              break;
            }
            console.log(`[ai-fallback] served by ${provider.name}/${model}`);
            return { text, provider: provider.name, model };
          } catch (err) {
            console.warn(
              `[ai-fallback] ${provider.name}/${model} failed: ${
                err instanceof Error ? err.message : String(err)
              }; trying next`
            );
            break;
          }
        }
      }
    }
    return null;
  } finally {
    releaseCompletionSlot();
  }
}

// ---------- Streaming (coach) ----------

export interface FallbackStream {
  provider: string;
  model: string;
  /** The first content delta, already received. */
  firstText: string;
  /** Resolves with the next content delta, or null when the stream ended. */
  nextDelta: () => Promise<string | null>;
  /** Abort the underlying fetch (client went away). */
  cancel: () => void;
}

/** Extract the content delta from one OpenAI-style SSE event block.
 *  Reasoning models (gpt-oss, nemotron) stream their thinking on a
 *  separate `reasoning` field — only `content` is user-visible text,
 *  so only `content` is forwarded. */
function streamDeltaFromEvent(rawEvent: string): string {
  let text = "";
  for (const line of rawEvent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) continue;
    const payload = trimmed.slice(5).trim();
    if (!payload || payload === "[DONE]") continue;
    try {
      const data = JSON.parse(payload) as {
        choices?: { delta?: { content?: string } }[];
      };
      text += data.choices?.[0]?.delta?.content ?? "";
    } catch {
      // Partial / keep-alive frame — skip.
    }
  }
  return text;
}

interface StreamAttempt {
  provider: string;
  model: string;
  nextDelta: () => Promise<string | null>;
  ended: () => boolean;
  cancel: () => void;
}

function startStreamAttempt(
  provider: ProviderDef,
  model: string,
  opts: CompleteOpts
): StreamAttempt {
  const controller = new AbortController();
  const queue: (string | null)[] = [];
  let waiter: ((v: string | null) => void) | null = null;
  let ended = false;

  const push = (v: string | null) => {
    if (waiter) {
      const w = waiter;
      waiter = null;
      w(v);
    } else {
      queue.push(v);
    }
  };
  const finish = () => {
    if (ended) return;
    ended = true;
    push(null);
  };

  void (async () => {
    try {
      const res = await fetch(`${provider.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${provider.apiKey}`,
          ...(provider.extraHeaders ?? {}),
        },
        signal: controller.signal,
        body: JSON.stringify(chatBody(provider, model, opts, true)),
      });
      if (!res.ok || !res.body) {
        console.warn(
          `[ai-fallback] stream ${provider.name}/${model} returned HTTP ${res.status}`
        );
        finish();
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let m = buffer.match(/\r\n\r\n|\n\n|\r\r/);
        while (m && m.index !== undefined) {
          const rawEvent = buffer.slice(0, m.index);
          buffer = buffer.slice(m.index + m[0].length);
          const text = streamDeltaFromEvent(rawEvent);
          if (text) push(text);
          m = buffer.match(/\r\n\r\n|\n\n|\r\r/);
        }
      }
      const tail = streamDeltaFromEvent(buffer);
      if (tail) push(tail);
      finish();
    } catch {
      finish();
    }
  })();

  return {
    provider: provider.name,
    model,
    nextDelta: () => {
      if (queue.length > 0) return Promise.resolve(queue.shift() ?? null);
      if (ended) return Promise.resolve(null);
      return new Promise<string | null>((resolve) => {
        waiter = resolve;
      });
    },
    ended: () => ended,
    cancel: () => controller.abort(),
  };
}

/**
 * Open a streaming completion on the fallback chain and wait for the
 * first content token. Providers/models are tried in order; an attempt
 * that produces no content within `firstTokenTimeoutMs` (total across
 * the chain, spent per-attempt) is abandoned for the next one. Returns
 * null when nothing produced a token in time.
 */
export async function openFallbackStream(
  opts: CompleteOpts & { firstTokenTimeoutMs: number }
): Promise<FallbackStream | null> {
  const providers = buildProviders();
  for (const provider of providers) {
    for (const model of provider.models) {
      const attempt = startStreamAttempt(provider, model, opts);
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), opts.firstTokenTimeoutMs);
      });
      const first = await Promise.race([attempt.nextDelta(), timeout]);
      if (timer) clearTimeout(timer);
      if (first !== null) {
        console.log(`[ai-fallback] stream served by ${provider.name}/${model}`);
        return {
          provider: provider.name,
          model,
          firstText: first,
          nextDelta: attempt.nextDelta,
          cancel: attempt.cancel,
        };
      }
      attempt.cancel();
      console.warn(
        `[ai-fallback] stream ${provider.name}/${model} produced no token; trying next`
      );
    }
  }
  return null;
}
