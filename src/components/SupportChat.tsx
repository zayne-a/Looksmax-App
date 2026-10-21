"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { SUPPORT_AVATAR } from "@/lib/support-avatar";

/**
 * Max — the Ascend support guide (Zayne, 2026-10-21). A floating
 * support chat on every site page EXCEPT the dashboard, where the
 * in-app navigation and the Coach take over. Max answers questions
 * about the app (plans, pricing, protocols, troubleshooting) via
 * /api/support, which runs on its own dedicated AI key.
 */

type Msg = { role: "user" | "model"; content: string };

const QUICK = [
  "How does the scan work?",
  "What do I get for free?",
  "How much is Pro?",
  "Why was my photo rejected?",
];

const GREETING =
  "Hey, I'm Max — I know Mewmax inside out. Ask me anything about the scan, plans, pricing or protocols.";

export default function SupportChat() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [msgs, open, busy]);

  // The dashboard has its own app chrome + Coach — Max stays out.
  if (pathname?.startsWith("/dashboard")) return null;

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    const history = msgs.slice(-10);
    setMsgs((m) => [...m, { role: "user", content: q }]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: q, history }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        reply?: string;
        error?: string;
      };
      setMsgs((m) => [
        ...m,
        {
          role: "model",
          content:
            data.reply ??
            data.error ??
            "Something glitched — try asking that again.",
        },
      ]);
    } catch {
      setMsgs((m) => [
        ...m,
        {
          role: "model",
          content: "I couldn't connect just now — try again in a moment.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Chat with Max, the Mewmax support guide"
          className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 rounded-full border border-gold/40 bg-ink/95 py-2 pl-2 pr-4 shadow-[0_12px_36px_rgba(0,0,0,0.55)] backdrop-blur transition hover:border-gold"
        >
          <span className="relative block h-10 w-10 overflow-hidden rounded-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={SUPPORT_AVATAR}
              alt="Max"
              className="h-full w-full object-cover"
            />
            <span className="absolute bottom-0.5 right-0.5 h-2.5 w-2.5 rounded-full border-2 border-ink bg-emerald-400" />
          </span>
          <span className="text-left leading-tight">
            <span className="block text-sm font-bold text-bone">Max</span>
            <span className="block text-[11px] text-muted">
              Mewmax guide · ask me anything
            </span>
          </span>
        </button>
      )}

      {open && (
        <div className="fixed bottom-4 right-4 z-50 flex h-[min(560px,calc(100dvh-2rem))] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-3xl border border-white/10 bg-ink shadow-[0_24px_60px_rgba(0,0,0,0.6)]">
          <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
            <span className="relative block h-10 w-10 shrink-0 overflow-hidden rounded-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={SUPPORT_AVATAR}
                alt="Max"
                className="h-full w-full object-cover"
              />
              <span className="absolute bottom-0.5 right-0.5 h-2.5 w-2.5 rounded-full border-2 border-ink bg-emerald-400" />
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="text-sm font-bold text-bone">Max</p>
              <p className="text-[11px] text-muted">
                Mewmax support guide — plans, pricing, protocols, fixes
              </p>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close support chat"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-muted transition hover:text-bone"
            >
              ✕
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-white/5 px-3.5 py-2.5 text-sm leading-relaxed text-bone">
              {GREETING}
            </div>
            {msgs.map((m, i) => (
              <div
                key={i}
                className={
                  m.role === "user"
                    ? "ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-gold/15 px-3.5 py-2.5 text-sm leading-relaxed text-bone"
                    : "max-w-[85%] rounded-2xl rounded-bl-md bg-white/5 px-3.5 py-2.5 text-sm leading-relaxed text-bone"
                }
              >
                {m.content}
              </div>
            ))}
            {busy && (
              <div className="max-w-[60%] rounded-2xl rounded-bl-md bg-white/5 px-3.5 py-2.5 text-sm text-muted">
                Max is typing…
              </div>
            )}
            {msgs.length === 0 && !busy && (
              <div className="flex flex-wrap gap-2 pt-1">
                {QUICK.map((q) => (
                  <button
                    key={q}
                    onClick={() => void send(q)}
                    className="rounded-full border border-gold/30 px-3 py-1.5 text-xs font-semibold text-gold-soft transition hover:bg-gold/10"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>

          <form
            className="flex items-center gap-2 border-t border-white/10 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Max about the app…"
              maxLength={800}
              className="h-11 flex-1 rounded-full border border-white/10 bg-white/5 px-4 text-sm text-bone outline-none placeholder:text-muted focus:border-gold/50"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              aria-label="Send message"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gold text-sm font-black text-ink transition disabled:opacity-40"
            >
              →
            </button>
          </form>
        </div>
      )}
    </>
  );
}
