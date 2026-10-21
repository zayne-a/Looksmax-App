"use client";

import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { usePathname } from "next/navigation";
import { SUPPORT_AVATAR } from "@/lib/support-avatar";

/**
 * Max — the Mewmax support guide (Zayne, 2026-10-21; homepage-only
 * rework 2026-10-22). Max lives on the MAIN HOMEPAGE only: he pops in
 * with a spring entrance a beat after load, waves a one-time greeting
 * teaser, and his launcher can be dragged anywhere on screen — the
 * spot persists in localStorage and the chat panel anchors to wherever
 * the launcher currently sits. Answers come from /api/support, which
 * runs on its own dedicated AI key (60 req/day/IP).
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

const SIZE = 56; // launcher diameter (h-14 w-14)
const MARGIN = 8; // min distance from any viewport edge
const GAP = 12; // launcher ↔ panel gap
const DRAG_SLOP = 6; // px of movement before a press becomes a drag
const POS_KEY = "max-launcher-pos";
const TEASER_KEY = "max-teaser-shown";

const clampN = (v: number, lo: number, hi: number) =>
  Math.min(Math.max(v, lo), Math.max(lo, hi));

/* Render an assistant message with clickable links: bare http(s) URLs
   and markdown-style [label](url) become real anchors (new tab, mint,
   underlined). Built purely from text + <a> elements — no raw HTML —
   and only http/https ever linkifies. */
const LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<]+)/g;

function renderRichText(text: string): ReactNode {
  const parts: ReactNode[] = [];
  let last = 0;
  let k = 0;
  let m: RegExpExecArray | null;
  LINK_RE.lastIndex = 0;
  while ((m = LINK_RE.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const anchorCls =
      "font-semibold text-gold-soft underline decoration-gold/50 underline-offset-2 transition hover:text-gold";
    if (m[1] && m[2]) {
      parts.push(
        <a
          key={k++}
          href={m[2]}
          target="_blank"
          rel="noopener noreferrer"
          className={anchorCls}
        >
          {m[1]}
        </a>,
      );
    } else if (m[3]) {
      let url = m[3];
      let trail = "";
      while (/[.,;:!?]$/.test(url)) {
        trail = url.slice(-1) + trail;
        url = url.slice(0, -1);
      }
      if (url.endsWith(")") && !url.includes("(")) {
        trail = ")" + trail;
        url = url.slice(0, -1);
      }
      parts.push(
        <a
          key={k++}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className={anchorCls}
        >
          {url}
        </a>,
      );
      if (trail) parts.push(trail);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

const defaultPos = (w: number, h: number) => ({
  x: w - SIZE - 20,
  y: h - SIZE - 20,
});

export default function SupportChat() {
  const pathname = usePathname();
  const [view, setView] = useState<"closed" | "open" | "closing">("closed");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [teaser, setTeaser] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [vp, setVp] = useState({ w: 0, h: 0 });
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    id: number;
    sx: number;
    sy: number;
    ox: number;
    oy: number;
    cx: number;
    cy: number;
    moved: boolean;
  } | null>(null);
  const suppressClickRef = useRef(false);
  const closeTimer = useRef<number | null>(null);

  const onHome = pathname === "/";

  /* Position: restore the saved spot (or the classic bottom-right),
     keep it inside the viewport, and track viewport resizes. */
  useEffect(() => {
    if (!onHome) return;
    try {
      const raw = window.localStorage.getItem(POS_KEY);
      if (raw) {
        const p = JSON.parse(raw) as { x?: unknown; y?: unknown };
        if (typeof p?.x === "number" && typeof p?.y === "number") {
          setPos({ x: p.x, y: p.y });
        }
      }
    } catch {
      /* storage unavailable — fall through to the default spot */
    }
    const read = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      setVp({ w, h });
      setPos((p) => {
        const base = p ?? defaultPos(w, h);
        return {
          x: clampN(base.x, MARGIN, w - SIZE - MARGIN),
          y: clampN(base.y, MARGIN, h - SIZE - MARGIN),
        };
      });
    };
    read();
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, [onHome]);

  /* One attention beat per session: a greeting teaser slides out a
     few seconds after the entrance pop, then never repeats. */
  useEffect(() => {
    if (!onHome) return;
    let already = false;
    try {
      already = window.sessionStorage.getItem(TEASER_KEY) === "1";
    } catch {
      /* ignore */
    }
    if (already) return;
    let t2: number | undefined;
    const t1 = window.setTimeout(() => {
      setTeaser(true);
      try {
        window.sessionStorage.setItem(TEASER_KEY, "1");
      } catch {
        /* ignore */
      }
      t2 = window.setTimeout(() => setTeaser(false), 6000);
    }, 4000);
    return () => {
      window.clearTimeout(t1);
      if (t2) window.clearTimeout(t2);
    };
  }, [onHome]);

  useEffect(() => {
    if (view !== "closed") setTeaser(false);
  }, [view]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [msgs, view, busy]);

  useEffect(
    () => () => {
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
    },
    [],
  );

  // Homepage only — Max is completely absent everywhere else.
  if (!onHome) return null;

  const close = () => {
    setView("closing");
    closeTimer.current = window.setTimeout(() => setView("closed"), 190);
  };

  /* ---- drag (pointer events; a clean press-release is a tap) ---- */
  const onPointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.button !== undefined && e.button !== 0) return;
    setTeaser(false);
    const base = pos ?? defaultPos(vp.w || SIZE + 40, vp.h || SIZE + 40);
    dragRef.current = {
      id: e.pointerId,
      sx: e.clientX,
      sy: e.clientY,
      ox: base.x,
      oy: base.y,
      cx: base.x,
      cy: base.y,
      moved: false,
    };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* capture unsupported — move/up on the button still work */
    }
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.id) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (!d.moved && Math.hypot(dx, dy) < DRAG_SLOP) return;
    if (!d.moved) {
      d.moved = true;
      setDragging(true);
    }
    d.cx = clampN(d.ox + dx, MARGIN, vp.w - SIZE - MARGIN);
    d.cy = clampN(d.oy + dy, MARGIN, vp.h - SIZE - MARGIN);
    setPos({ x: d.cx, y: d.cy });
  };

  const onPointerEnd = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.id) return;
    dragRef.current = null;
    if (d.moved) {
      setDragging(false);
      // The browser still fires a click after a drag — swallow it.
      suppressClickRef.current = true;
      try {
        window.localStorage.setItem(
          POS_KEY,
          JSON.stringify({ x: d.cx, y: d.cy }),
        );
      } catch {
        /* ignore */
      }
    }
  };

  const onLauncherClick = () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    setView("open");
  };

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

  /* ---- panel geometry, anchored to the launcher ---- */
  const panelW = Math.min(380, Math.max(vp.w - 16, 0));
  const panelH = Math.min(560, Math.max(vp.h - 16, 0));
  let panelStyle: React.CSSProperties | undefined;
  if (pos && vp.w > 0 && vp.h > 0) {
    const cx = pos.x + SIZE / 2;
    const cy = pos.y + SIZE / 2;
    let left = cx * 2 >= vp.w ? pos.x + SIZE - panelW : pos.x;
    let top = cy * 2 >= vp.h ? pos.y - GAP - panelH : pos.y + SIZE + GAP;
    left = clampN(left, MARGIN, vp.w - panelW - MARGIN);
    top = clampN(top, MARGIN, vp.h - panelH - MARGIN);
    panelStyle = {
      left,
      top,
      width: panelW,
      height: panelH,
      transformOrigin: `${clampN(cx - left, 0, panelW)}px ${clampN(cy - top, 0, panelH)}px`,
    };
  }

  const teaserOnLeft = pos ? pos.x + SIZE / 2 >= vp.w / 2 : true;

  return (
    <>
      {view === "closed" && pos && (
        <div
          className="fixed z-50"
          style={{ left: pos.x, top: pos.y, width: SIZE, height: SIZE }}
        >
          {teaser && (
            <button
              onClick={() => {
                setTeaser(false);
                setView("open");
              }}
              aria-label="Questions? Ask Max — open support chat"
              className={`max-teaser-in absolute top-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-gold/40 bg-ink-3/95 px-3.5 py-2 text-xs font-semibold text-bone shadow-[0_10px_30px_rgba(0,0,0,0.5)] backdrop-blur transition hover:border-gold ${
                teaserOnLeft
                  ? "right-[calc(100%+10px)]"
                  : "left-[calc(100%+10px)]"
              }`}
              style={{
                transformOrigin: teaserOnLeft ? "right center" : "left center",
              }}
            >
              Questions? Ask Max
            </button>
          )}
          <button
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerEnd}
            onPointerCancel={onPointerEnd}
            onClick={onLauncherClick}
            aria-label="Chat with Max, the Mewmax support guide"
            title="Chat with Max — drag to move"
            className={`max-pop-in relative block h-14 w-14 touch-none select-none rounded-full border border-gold/40 bg-ink/95 backdrop-blur transition hover:border-gold ${
              dragging
                ? "cursor-grabbing shadow-[0_18px_44px_rgba(0,0,0,0.65)]"
                : "cursor-grab shadow-[0_12px_36px_rgba(0,0,0,0.55)]"
            }`}
          >
            <span className="pointer-events-none block h-full w-full overflow-hidden rounded-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={SUPPORT_AVATAR}
                alt="Max"
                draggable={false}
                className="h-full w-full object-cover"
              />
            </span>
            <span className="pointer-events-none absolute bottom-0.5 right-0.5 z-10 h-3.5 w-3.5 rounded-full border-2 border-ink bg-emerald-400" />
          </button>
        </div>
      )}

      {view !== "closed" && (
        <div
          className={`fixed z-50 flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-ink shadow-[0_24px_60px_rgba(0,0,0,0.6)] ${
            panelStyle
              ? ""
              : "bottom-4 right-4 h-[min(560px,calc(100dvh-2rem))] w-[min(380px,calc(100vw-2rem))]"
          } ${view === "closing" ? "max-panel-out" : "max-panel-in"}`}
          style={panelStyle}
        >
          <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
            <span className="relative block h-10 w-10 shrink-0">
              <span className="block h-full w-full overflow-hidden rounded-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={SUPPORT_AVATAR}
                  alt="Max"
                  className="h-full w-full object-cover"
                />
              </span>
              <span className="absolute bottom-0 right-0 z-10 h-2.5 w-2.5 rounded-full border-2 border-ink bg-emerald-400" />
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="text-sm font-bold text-bone">Max</p>
              <p className="text-[11px] text-muted">
                Mewmax support guide — plans, pricing, protocols, fixes
              </p>
            </div>
            <button
              onClick={close}
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
                {m.role === "model" ? renderRichText(m.content) : m.content}
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
