"use client";

import { useState } from "react";
import { ascendByDate, formatAscendDate } from "@/lib/psl";
import { buildScoreView } from "@/lib/score-view";
import type { FaceMeasurements } from "@/lib/types";

/**
 * The PSL results deck (Zayne, 2026-10-21 — modelled on the category
 * leader's score screens, including the two-deck carousel and the
 * personalised ascend-by header from their app walkthrough, with our
 * one structural difference kept: every number here is VISIBLE, free,
 * and computed from the real measurements — nothing blurred).
 *
 * Deck 1 "Overall": photo, PSL + POTENTIAL hero cards, region grid.
 * Deck 2 "Miscellaneous": six more real reads (skin, harmony,
 * symmetry, jawline, eye spacing, proportions). Black + mint, the
 * funnel's colour scheme; bars run the reference's yellow→green.
 */

const MINT = "#5EEAD4";
const GOLD_BAR = "#FACC15";

function Bar({
  fraction,
  color,
  gradient = false,
}: {
  fraction: number;
  color: string;
  gradient?: boolean;
}) {
  return (
    <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/10">
      <div
        className="h-full rounded-full"
        style={{
          width: `${Math.min(100, Math.max(0, fraction) * 100)}%`,
          background: gradient
            ? "linear-gradient(90deg, #FACC15, #4ADE80)"
            : color,
        }}
      />
    </div>
  );
}

function ScoreCard({
  label,
  formatted,
  verdict,
  fraction,
  note,
  big = false,
}: {
  label: string;
  formatted: string;
  verdict: string;
  fraction: number;
  note?: string;
  big?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <p
        className="text-[11px] font-black uppercase tracking-[0.22em]"
        style={{ color: MINT }}
      >
        {label}
      </p>
      <p
        className={`mt-1.5 font-display font-black text-white ${
          big ? "text-4xl" : "text-3xl"
        }`}
      >
        {formatted}
        <span className="ml-2 align-middle text-xs font-bold text-white/60">
          · {verdict}
        </span>
      </p>
      <Bar fraction={fraction} color={GOLD_BAR} gradient />
      {note && (
        <p className="mt-2.5 text-[11px] leading-relaxed text-white/45">
          {note}
        </p>
      )}
    </div>
  );
}

export default function PslDeck({
  measurements,
  photoUrl,
}: {
  measurements: FaceMeasurements;
  photoUrl?: string | null;
}) {
  const [deck, setDeck] = useState(0);
  if (!measurements.landmarksDetected) return null;

  // Display values come from the one display layer (lib/score-view):
  // the template 1–8 scale + template tier/verdict names, identical
  // to the app and the creator cards. The engine's /10 numbers never
  // reach the screen.
  const view = buildScoreView(measurements);
  const gap =
    Math.round((view.potential.display - view.psl.display) * 10) / 10;
  const by = ascendByDate(new Date());

  return (
    <section
      aria-label="Your PSL rating"
      className="overflow-hidden rounded-3xl border border-white/10 bg-black p-5"
    >
      {/* Personalised ascend-by header (the reference's results opener) */}
      <p className="text-center text-sm font-semibold text-white/70">
        You will ascend by{" "}
        <span className="bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text font-display text-base font-black text-transparent">
          {formatAscendDate(by)}
        </span>
      </p>

      {photoUrl && (
        <div className="mx-auto mt-4 w-28">
          {/* The user's own scan photo, on-device only. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoUrl}
            alt="Your scan"
            className="aspect-[3/4] w-full rounded-2xl border-2 object-cover"
            style={{ borderColor: MINT }}
          />
        </div>
      )}

      <p
        className="mt-4 text-center font-display text-sm font-black uppercase tracking-[0.3em]"
        style={{ color: MINT }}
      >
        {deck === 0 ? "Overall" : "Miscellaneous"}
      </p>

      {deck === 0 ? (
        <>
          {/* Hero cards: where you stand · where you could stand */}
          <div className="mt-3 grid grid-cols-2 gap-3">
            <ScoreCard
              label="PSL"
              formatted={view.psl.formatted}
              verdict={view.psl.verdict}
              fraction={view.psl.fraction}
              big
            />
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p
                className="text-[11px] font-black uppercase tracking-[0.22em]"
                style={{ color: MINT }}
              >
                Potential
              </p>
              <p className="mt-1.5 font-display text-4xl font-black text-white">
                {view.potential.formatted}
                <span className="ml-2 align-middle text-xs font-bold text-white/60">
                  · {view.potential.verdict}
                </span>
              </p>
              <Bar fraction={view.potential.fraction} color="#4ADE80" />
            </div>
          </div>

          <p className="mt-4 text-center text-sm leading-relaxed text-white/60">
            That gap —{" "}
            <span className="font-bold text-white">
              {gap > 0 ? `+${gap.toFixed(1)}` : "0"} points
            </span>{" "}
            — is what you&apos;re leaving on the table. It&apos;s skin, sleep
            and body composition. All of it is trainable, and your protocol is
            built to take it.
          </p>

          {/* Region grid */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            {view.regions.map((r) => (
              <ScoreCard
                key={r.key}
                label={r.label}
                formatted={r.formatted}
                verdict={r.verdict}
                fraction={r.fraction}
                note={r.note}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-3">
          {view.misc.map((s) => (
            <ScoreCard
              key={s.label}
              label={s.label}
              formatted={s.formatted}
              verdict={s.verdict}
              fraction={s.fraction}
              note={s.note}
            />
          ))}
        </div>
      )}

      {/* Carousel dots */}
      <div className="mt-5 flex items-center justify-center gap-2.5">
        {[0, 1].map((i) => (
          <button
            key={i}
            type="button"
            onClick={() => setDeck(i)}
            aria-label={i === 0 ? "Overall scores" : "Miscellaneous scores"}
            className="h-2 rounded-full transition-all"
            style={{
              width: deck === i ? 22 : 8,
              background: deck === i ? MINT : "rgba(255,255,255,0.25)",
            }}
          />
        ))}
      </div>
    </section>
  );
}
