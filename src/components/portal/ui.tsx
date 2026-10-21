"use client";

import type { ReactNode } from "react";
import type { ReviewStatus, Tier } from "@/lib/portal";

// Shared portal chrome (2026-10-22): the creator portal speaks the
// app's black + mint language (#5EEAD4), like the Creator Tools.

export const MINT = "#5EEAD4";

export const inputClass =
  "w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-bone placeholder:text-muted/60 focus:border-[#5EEAD4]/60 focus:outline-none";

export const labelClass =
  "mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-muted";

export function MintButton({
  children,
  onClick,
  type = "button",
  disabled = false,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-full bg-[#5EEAD4] px-5 py-2.5 text-sm font-bold text-[#0a0a0c] transition hover:bg-[#99f6e4] disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  onClick,
  disabled = false,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-full border border-white/15 px-5 py-2.5 text-sm font-bold text-bone transition hover:border-[#5EEAD4]/60 hover:text-[#5EEAD4] disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  );
}

export function PageHeading({
  title,
  sub,
  right,
}: {
  title: string;
  sub?: string;
  right?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-bone">
          {title}
        </h1>
        {sub ? <p className="mt-1.5 text-sm text-muted">{sub}</p> : null}
      </div>
      {right}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
        {label}
      </div>
      <div className="mt-2 font-display text-2xl font-extrabold text-bone">
        {value}
      </div>
      {hint ? <div className="mt-1 text-xs text-muted">{hint}</div> : null}
    </div>
  );
}

export function StatusPill({ status }: { status: ReviewStatus }) {
  const styles =
    status === "approved"
      ? "border-[#5EEAD4]/40 bg-[#5EEAD4]/10 text-[#5EEAD4]"
      : status === "rejected"
        ? "border-red-400/40 bg-red-400/10 text-red-300"
        : "border-yellow-300/40 bg-yellow-300/10 text-yellow-200";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${styles}`}
    >
      {status}
    </span>
  );
}

export function TierBadge({ tier }: { tier: Tier | null }) {
  if (!tier) return null;
  return (
    <span className="inline-flex items-center rounded-full border border-[#5EEAD4]/40 bg-[#5EEAD4]/10 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[#5EEAD4]">
      🌿 {tier}
    </span>
  );
}

/** His gate card: shown until a social account is connected. */
export function GateCard({
  text,
  ctaHref = "/portal/settings",
  ctaLabel = "Connect an Account",
}: {
  text: string;
  ctaHref?: string;
  ctaLabel?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center sm:p-12">
      <h2 className="font-display text-xl font-extrabold text-bone">
        Connect Account
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
        {text}
      </p>
      <div className="mt-4 flex items-center justify-center gap-3 text-muted">
        <PlatformGlyph platform="tiktok" />
        <PlatformGlyph platform="instagram" />
      </div>
      <a
        href={ctaHref}
        className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-[#5EEAD4] px-6 py-3 text-sm font-bold text-[#0a0a0c] transition hover:bg-[#99f6e4]"
      >
        {ctaLabel}
      </a>
    </div>
  );
}

export function PlatformGlyph({
  platform,
  size = 22,
}: {
  platform: "tiktok" | "instagram";
  size?: number;
}) {
  if (platform === "tiktok") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M16.6 3c.4 2 1.8 3.6 3.9 3.9v3c-1.5 0-2.9-.5-3.9-1.3v6.6a6.1 6.1 0 1 1-6.1-6.1c.3 0 .7 0 1 .1v3.1a3 3 0 1 0 2 2.8V3h2.1Z" />
      </svg>
    );
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}
