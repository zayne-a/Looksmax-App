"use client";

import {
  motion,
  AnimatePresence,
  animate,
  type Variants,
} from "framer-motion";
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
} from "react";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/* ------------------------------------------------------------------ */
/* Reveal: fade-and-rise on scroll into view                           */
/* ------------------------------------------------------------------ */
export function Reveal({
  children,
  delay = 0,
  y = 26,
  className = "",
  once = true,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  once?: boolean;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, margin: "-40px" }}
      transition={{ duration: 0.6, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

export const staggerParent: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
};

export const staggerChild: Variants = {
  hidden: { opacity: 0, y: 26 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: EASE },
  },
};

/* ------------------------------------------------------------------ */
/* CountUp: animated number                                            */
/* ------------------------------------------------------------------ */
export function CountUp({
  value,
  decimals = 0,
  duration = 1.4,
  className = "",
  prefix = "",
  suffix = "",
}: {
  value: number;
  decimals?: number;
  duration?: number;
  className?: string;
  prefix?: string;
  suffix?: string;
}) {
  const [display, setDisplay] = useState("0");
  const fromRef = useRef(0);

  useEffect(() => {
    const controls = animate(fromRef.current, value, {
      duration,
      ease: EASE,
      onUpdate: (v) => setDisplay(v.toFixed(decimals)),
    });
    fromRef.current = value;
    return () => controls.stop();
  }, [value, decimals, duration]);

  return (
    <span className={className}>
      {prefix}
      {display}
      {suffix}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* ScoreDial: animated circular gauge (0–100)                           */
/* ------------------------------------------------------------------ */
export function ScoreDial({
  value,
  size = 190,
  label,
  sublabel,
}: {
  value: number;
  size?: number;
  label?: string;
  sublabel?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  return (
    <div
      className="relative inline-flex items-center justify-center"
      role="img"
      aria-label={`${label ?? "Score"}: ${Math.round(clamped)} out of 100`}
    >
      {/* halo */}
      <div
        aria-hidden
        className="absolute inset-0 rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(227,185,78,0.16) 0%, transparent 65%)",
        }}
      />
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id="dial-gold" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f2d488" />
            <stop offset="55%" stopColor="#e3b94e" />
            <stop offset="100%" stopColor="#9a7a2e" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#dial-gold)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - clamped / 100) }}
          transition={{ duration: 1.6, ease: EASE }}
          style={{ filter: "drop-shadow(0 0 8px rgba(227,185,78,0.55))" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <CountUp
          value={clamped}
          className="gold-text font-display text-5xl font-extrabold tracking-tight"
        />
        {label && (
          <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.2em] text-muted">
            {label}
          </p>
        )}
        {sublabel && <p className="text-xs text-muted/70">{sublabel}</p>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* MeterBar: labeled animated bar (0–100)                              */
/* ------------------------------------------------------------------ */
export function MeterBar({
  label,
  value,
  hint,
  delay = 0,
}: {
  label: string;
  value: number; // 0–100
  hint?: string;
  delay?: number;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold text-bone">{label}</p>
        <p className="text-sm font-bold text-gold-soft tabular-nums">
          <CountUp value={clamped} decimals={1} duration={1.1} />
          <span className="text-muted font-normal"> / 100</span>
        </p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/8">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-gold-deep via-gold to-gold-soft"
          initial={{ width: "0%" }}
          whileInView={{ width: `${clamped}%` }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 1.1, delay, ease: EASE }}
          style={{ boxShadow: "0 0 10px rgba(227,185,78,0.5)" }}
        />
      </div>
      {hint && <p className="mt-1.5 text-xs leading-relaxed text-muted">{hint}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* FaqAccordion: smooth height-animated accordion                       */
/* ------------------------------------------------------------------ */
export function FaqAccordion({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="space-y-3">
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <div
            key={item.q}
            className={`card-premium overflow-hidden rounded-2xl transition-colors ${
              isOpen ? "border-gold/30" : ""
            }`}
          >
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-4 p-5 text-left"
            >
              <span className="text-[15px] font-semibold text-bone">
                {item.q}
              </span>
              <motion.span
                aria-hidden
                animate={{ rotate: isOpen ? 45 : 0 }}
                transition={{ duration: 0.25 }}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gold/30 text-lg leading-none text-gold"
              >
                +
              </motion.span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  key="content"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.32, ease: EASE }}
                  className="overflow-hidden"
                >
                  <p className="px-5 pb-5 text-sm leading-relaxed text-muted">
                    {item.a}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* BeforeAfter: draggable divider comparing two states                 */
/* ------------------------------------------------------------------ */
export function BeforeAfter({
  beforeSrc,
  afterSrc,
  beforeLabel = "Before",
  afterLabel = "Your potential",
  caption,
  className = "",
}: {
  beforeSrc: string;
  afterSrc: string;
  beforeLabel?: string;
  afterLabel?: string;
  caption?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(50);
  const dragging = useRef(false);

  const update = (clientX: number) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.max(4, Math.min(96, pct)));
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    update(e.clientX);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (dragging.current) update(e.clientX);
  };
  const end = () => {
    dragging.current = false;
  };

  return (
    <div className={className}>
      <div
        ref={ref}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={end}
        onPointerCancel={end}
        className="relative aspect-[3/4] w-full cursor-ew-resize touch-none select-none overflow-hidden rounded-3xl border border-gold/20"
        role="slider"
        aria-label="Before and after comparison"
        aria-valuenow={Math.round(pos)}
        aria-valuemin={0}
        aria-valuemax={100}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") setPos((p) => Math.max(4, p - 4));
          if (e.key === "ArrowRight") setPos((p) => Math.min(96, p + 4));
        }}
      >
        {/* After (enhanced) — full-bleed base layer */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={afterSrc}
          alt="Enhanced preview"
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover"
          style={{
            filter:
              "brightness(1.05) contrast(1.06) saturate(1.1) sepia(0.08)",
          }}
        />
        {/* Before — clipped to the left of the divider */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={beforeSrc}
          alt="Original photo"
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover"
          style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
        />
        {/* Divider */}
        <div
          aria-hidden
          className="absolute inset-y-0"
          style={{ left: `${pos}%` }}
        >
          <div className="absolute inset-y-0 -translate-x-1/2 w-[2px] bg-gold shadow-[0_0_12px_rgba(227,185,78,0.8)]" />
          <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-gold text-ink shadow-[0_0_20px_rgba(227,185,78,0.7)]">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
              <path
                d="M6 3.5L2.5 9L6 14.5M12 3.5L15.5 9L12 14.5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
        {/* Labels */}
        <span className="absolute left-3 top-3 rounded-full bg-ink/70 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-bone backdrop-blur">
          {beforeLabel}
        </span>
        <span className="absolute right-3 top-3 rounded-full bg-gold px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-ink">
          {afterLabel}
        </span>
      </div>
      {caption && (
        <p className="mt-3 text-center text-xs leading-relaxed text-muted">
          {caption}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ScanFrame: landmark-overlay-style framing for photo previews        */
/* Decorative only — the real measurement logic lives in lib/face.ts    */
/* ------------------------------------------------------------------ */
function Corner({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute h-7 w-7 border-gold ${className}`}
    />
  );
}

export function ScanFrame({
  src,
  alt,
  scanning = false,
  landmark = true,
  className = "",
  children,
}: {
  src?: string | null;
  alt: string;
  scanning?: boolean;
  landmark?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-3xl border border-gold/25 bg-ink-2 ${className}`}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-ink-3/40">
          {children}
        </div>
      )}

      {/* landmark-style grid overlay (decorative) */}
      {landmark && (
        <svg
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full opacity-40"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <line x1="50" y1="4" x2="50" y2="96" stroke="#e3b94e" strokeWidth="0.4" strokeDasharray="2 1.6" />
          <line x1="8" y1="33" x2="92" y2="33" stroke="#e3b94e" strokeWidth="0.4" strokeDasharray="2 1.6" />
          <line x1="8" y1="66" x2="92" y2="66" stroke="#e3b94e" strokeWidth="0.4" strokeDasharray="2 1.6" />
          {[20, 40, 60, 80].map((x) => (
            <line
              key={x}
              x1={x}
              y1="8"
              x2={x}
              y2="92"
              stroke="#e3b94e"
              strokeWidth="0.3"
              strokeDasharray="1.5 1.5"
              opacity="0.7"
            />
          ))}
          <ellipse
            cx="50"
            cy="42"
            rx="26"
            ry="32"
            fill="none"
            stroke="#e3b94e"
            strokeWidth="0.5"
            strokeDasharray="3 2"
          />
        </svg>
      )}

      {/* corner brackets */}
      <Corner className="left-3 top-3 border-l-2 border-t-2 rounded-tl-lg" />
      <Corner className="right-3 top-3 border-r-2 border-t-2 rounded-tr-lg" />
      <Corner className="bottom-3 left-3 border-b-2 border-l-2 rounded-bl-lg" />
      <Corner className="bottom-3 right-3 border-b-2 border-r-2 rounded-br-lg" />

      {/* animated scan line */}
      {scanning && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 h-16"
          style={{
            background:
              "linear-gradient(180deg, transparent, rgba(227,185,78,0.35) 55%, rgba(242,212,136,0.85) 98%, transparent)",
            filter: "blur(1px)",
          }}
          animate={{ top: ["-20%", "105%", "-20%"] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      {/* bottom vignette for legibility of overlays */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-ink/70 to-transparent"
      />

      {/* foreground content (buttons, prompts) */}
      {children && src && (
        <div className="absolute inset-0">{children}</div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* StaggerGroup / StaggerItem: server-component-safe stagger wrappers */
/* (framer-motion's `motion` proxy can't cross the server/client       */
/* boundary, so server pages use these instead of <motion.div>.)      */
/* ------------------------------------------------------------------ */
export function StaggerGroup({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      variants={staggerParent}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-80px" }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div className={className} variants={staggerChild}>
      {children}
    </motion.div>
  );
}
/* ------------------------------------------------------------------ */
/* Float: gentle infinite float for badges and hero accents            */
/* ------------------------------------------------------------------ */
export function Float({
  children,
  className = "",
  duration = 5,
  distance = 10,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  duration?: number;
  distance?: number;
  delay?: number;
}) {
  return (
    <motion.div
      className={className}
      animate={{ y: [0, -distance, 0] }}
      transition={{ duration, delay, repeat: Infinity, ease: "easeInOut" }}
    >
      {children}
    </motion.div>
  );
}
