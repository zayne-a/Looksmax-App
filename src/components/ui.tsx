"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { ReactNode } from "react";

type ButtonVariant = "primary" | "ghost";

interface ButtonProps {
  href?: string;
  variant?: ButtonVariant;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}

export function Button({
  href,
  variant = "primary",
  onClick,
  type = "button",
  disabled = false,
  className = "",
  children,
}: ButtonProps) {
  const styles = variant === "primary" ? "btn-gold" : "btn-ghost";
  const classes = `inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-bold tracking-wide transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/70 focus-visible:ring-offset-2 focus-visible:ring-offset-ink ${
    styles
  } ${disabled ? "cursor-not-allowed opacity-40 saturate-50" : ""} ${className}`;

  if (href) {
    return (
      <Link
        href={href}
        className={classes}
        aria-disabled={disabled}
        onClick={disabled ? (e) => e.preventDefault() : undefined}
      >
        {children}
      </Link>
    );
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={classes}>
      {children}
    </button>
  );
}

export function Card({
  className = "",
  glow = false,
  children,
}: {
  className?: string;
  glow?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`card-premium rounded-3xl p-5 sm:p-6 ${
        glow ? "shadow-[0_0_36px_-10px_rgba(227,185,78,0.5)]" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  sub,
  align = "center",
}: {
  eyebrow?: string;
  title: string;
  sub?: string;
  align?: "center" | "left";
}) {
  const alignCls = align === "center" ? "text-center mx-auto" : "text-left";
  return (
    <div className={`max-w-2xl ${alignCls} mb-8 sm:mb-12`}>
      {eyebrow && (
        <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.28em] text-gold">
          {eyebrow}
        </p>
      )}
      <h2 className="font-display text-3xl sm:text-[2.6rem] font-extrabold tracking-tight leading-[1.08] text-bone">
        {title}
      </h2>
      {sub && (
        <p className="mt-3 text-sm sm:text-base leading-relaxed text-muted">
          {sub}
        </p>
      )}
    </div>
  );
}

export function ProgressBar({
  percent,
  className = "",
}: {
  percent: number;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div
      className={`h-1.5 w-full overflow-hidden rounded-full bg-white/10 ${className}`}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <motion.div
        className="quiz-progress h-full rounded-full bg-gradient-to-r from-gold-deep via-gold to-gold-soft"
        initial={false}
        animate={{ width: `${clamped}%` }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  );
}

/** Small uppercase eyebrow label used above headlines. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-gold">
      {children}
    </p>
  );
}
