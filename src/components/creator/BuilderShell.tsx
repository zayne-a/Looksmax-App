"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { Gender } from "@/lib/creator-tiers";

export const MINT = "#5EEAD4";

/** Range-input styling shared by every builder (mint fill track). */
export function CreatorStyles() {
  return (
    <style>{`
      input[type="range"].creator-range {
        -webkit-appearance: none;
        appearance: none;
        width: 100%;
        height: 6px;
        border-radius: 999px;
        background: linear-gradient(to right, ${MINT} 0%, ${MINT} var(--fill, 50%), rgba(255,255,255,0.12) var(--fill, 50%));
        outline: none;
        cursor: pointer;
      }
      input[type="range"].creator-range::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 22px; height: 22px;
        border-radius: 999px;
        background: #0a0a0c;
        border: 3px solid ${MINT};
        box-shadow: 0 0 12px rgba(94,234,212,0.5);
        cursor: pointer;
      }
      input[type="range"].creator-range::-moz-range-thumb {
        width: 22px; height: 22px;
        border-radius: 999px;
        background: #0a0a0c;
        border: 3px solid ${MINT};
        box-shadow: 0 0 12px rgba(94,234,212,0.5);
        cursor: pointer;
      }
    `}</style>
  );
}

/** 3-column builder layout: Preview | Customize | How to Use. */
export function BuilderShell({
  title,
  children,
  customize,
  howTo,
}: {
  title: string;
  children: ReactNode;
  customize: ReactNode;
  howTo: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#0a0a0c] text-[#f4f1e8]">
      <CreatorStyles />
      <div className="mx-auto max-w-[1400px] px-4 py-8 md:px-8">
        <Link
          href="/creator"
          className="text-sm text-[#9b9ba4] transition-colors hover:text-[#5EEAD4]"
        >
          ← Back to Creator Tools
        </Link>
        <h1 className="mt-4 font-[family-name:var(--font-archivo)] text-3xl font-extrabold tracking-tight md:text-4xl">
          {title}
        </h1>
        <div className="mt-8 flex flex-col gap-6 lg:flex-row">
          <div className="flex-1 rounded-2xl border border-white/10 bg-white/[0.02] p-4 md:p-6">
            <h2 className="mb-4 text-sm font-semibold tracking-widest text-[#9b9ba4] uppercase">
              Preview
            </h2>
            {children}
          </div>
          <div className="w-full shrink-0 space-y-6 rounded-2xl border border-white/10 bg-white/[0.02] p-6 lg:w-80">
            <h2 className="text-sm font-semibold tracking-widest text-[#9b9ba4] uppercase">
              Customize
            </h2>
            {customize}
          </div>
          <div className="w-full shrink-0 rounded-2xl border border-white/10 bg-white/[0.02] p-6 lg:w-80">
            <h2 className="text-sm font-semibold tracking-widest text-[#9b9ba4] uppercase">
              How to Use
            </h2>
            <ul className="mt-4 space-y-3 text-sm text-[#9b9ba4]">{howTo}</ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export function HowToItem({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-2">
      <span className="mt-0.5 shrink-0 text-[#5EEAD4]">✓</span>
      <span>{children}</span>
    </li>
  );
}

export function GenderToggle({
  gender,
  onChange,
}: {
  gender: Gender;
  onChange: (g: Gender) => void;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium">Gender</label>
      <div className="flex w-full items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-1">
        {(["male", "female"] as Gender[]).map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => onChange(g)}
            className={`flex-1 rounded-md px-4 py-1.5 text-sm font-medium capitalize transition-all duration-200 ${
              gender === g
                ? "bg-[#5EEAD4] font-semibold text-black"
                : "text-[#9b9ba4] hover:text-white"
            }`}
          >
            {g}
          </button>
        ))}
      </div>
    </div>
  );
}

export function UploadButton({
  onFile,
  hasPhoto,
}: {
  onFile: (f: File) => void;
  hasPhoto: boolean;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium">Photo</label>
      <label className="block w-full cursor-pointer rounded-lg border border-white/15 bg-white/5 px-4 py-3 text-center text-sm font-medium transition-colors hover:border-[#5EEAD4]/60 hover:text-[#5EEAD4]">
        {hasPhoto ? "Change Image" : "Upload Image"}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = "";
          }}
        />
      </label>
      <p className="mt-2 text-xs text-[#9b9ba4]">
        Drag the photo on the preview to reposition it. Scroll over it to
        zoom.
      </p>
    </div>
  );
}

/** A number input + slider pair, bidirectionally synced (his pattern). */
export function ScoreSliderRow({
  label,
  value,
  onChange,
  min,
  max,
  step,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
}) {
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <label className="text-sm font-medium">{label}</label>
        <input
          type="number"
          value={Number.isInteger(value) ? value : Math.round(value * 10) / 10}
          min={min}
          max={max}
          step={step}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (!Number.isNaN(v)) {
              onChange(Math.min(max, Math.max(min, Math.round(v * 10) / 10)));
            }
          }}
          onBlur={(e) => {
            if (e.target.value === "") onChange(min);
          }}
          className="h-8 w-20 rounded-md border border-white/10 bg-white/5 px-2 text-right text-lg font-bold text-white focus:border-[#5EEAD4]/60 focus:outline-none"
        />
      </div>
      <input
        type="range"
        className="creator-range"
        style={{ ["--fill" as string]: `${fill}%` }}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      <div className="flex justify-between text-xs text-[#9b9ba4]">
        <span>
          {min} {min === 0 ? "days" : ""}
        </span>
        <span>
          {max} {min === 0 ? "days" : ""}
        </span>
      </div>
    </div>
  );
}

export function DownloadButton({
  onClick,
  busy,
  busyLabel,
  label,
  variant = "primary",
}: {
  onClick: () => void;
  busy?: boolean;
  busyLabel?: string;
  label: string;
  variant?: "primary" | "outline";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-base font-semibold transition-all disabled:opacity-70 ${
        variant === "primary"
          ? "bg-[#5EEAD4] text-black hover:brightness-110"
          : "border border-white/25 text-white hover:border-[#5EEAD4]/70 hover:text-[#5EEAD4]"
      }`}
    >
      {busy ? (
        <>
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
          {busyLabel ?? "Working..."}
        </>
      ) : (
        label
      )}
    </button>
  );
}
