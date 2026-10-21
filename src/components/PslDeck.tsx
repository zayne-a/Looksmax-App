"use client";

import {
  pslScore,
  pslTier,
  pslPotential,
  regionScores,
  regionVerdict,
} from "@/lib/psl";
import type { FaceMeasurements } from "@/lib/types";

/**
 * The PSL results deck (Zayne, 2026-10-21 — modelled on the category
 * leader's score screen, with our one structural difference kept:
 * every number here is VISIBLE, free, and computed from the real
 * measurements — nothing blurred, nothing invented).
 *
 * Layout mirrors the reference: photo up top, "Overall", the two
 * hero cards (PSL now · POTENTIAL), then the 2×2 region grid with a
 * score, a one-word verdict and a bar on every card. Black + mint,
 * the funnel's colour scheme.
 */

const MINT = "#5EEAD4";
const GOLD_BAR = "#FACC15";

function Bar({ value10, color }: { value10: number; color: string }) {
  return (
    <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/10">
      <div
        className="h-full rounded-full"
        style={{ width: `${Math.min(100, value10 * 10)}%`, background: color }}
      />
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
  if (!measurements.landmarksDetected) return null;

  const psl = pslScore(measurements);
  const tier = pslTier(psl);
  const potential = pslPotential(measurements);
  const potentialTier = pslTier(potential);
  const regions = regionScores(measurements);
  const gap = Math.round((potential - psl) * 10) / 10;

  return (
    <section
      aria-label="Your PSL rating"
      className="overflow-hidden rounded-3xl border border-white/10 bg-black p-5"
    >
      {photoUrl && (
        <div className="mx-auto w-28">
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

      <p className="mt-4 text-center font-display text-sm font-black uppercase tracking-[0.3em] text-white/70">
        Overall
      </p>

      {/* Hero cards: where you stand · where you could stand */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <p
            className="text-[11px] font-black uppercase tracking-[0.22em]"
            style={{ color: MINT }}
          >
            PSL
          </p>
          <p className="mt-1.5 font-display text-4xl font-black text-white">
            {psl.toFixed(1)}
            <span className="ml-2 align-middle text-xs font-bold text-white/60">
              · {tier.label}
            </span>
          </p>
          <Bar value10={psl} color={GOLD_BAR} />
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <p
            className="text-[11px] font-black uppercase tracking-[0.22em]"
            style={{ color: MINT }}
          >
            Potential
          </p>
          <p className="mt-1.5 font-display text-4xl font-black text-white">
            {potential.toFixed(1)}
            <span className="ml-2 align-middle text-xs font-bold text-white/60">
              · {potentialTier.label}
            </span>
          </p>
          <Bar value10={potential} color="#4ADE80" />
        </div>
      </div>

      <p className="mt-4 text-center text-sm leading-relaxed text-white/60">
        That gap —{" "}
        <span className="font-bold text-white">
          {gap > 0 ? `+${gap.toFixed(1)}` : "0"} points
        </span>{" "}
        — is what you&apos;re leaving on the table. It&apos;s skin, sleep and
        body composition. All of it is trainable, and your protocol is built
        to take it.
      </p>

      {/* Region grid */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        {regions.map((r) => (
          <div
            key={r.key}
            className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
          >
            <p
              className="text-[11px] font-black uppercase tracking-[0.22em]"
              style={{ color: MINT }}
            >
              {r.label}
            </p>
            <p className="mt-1.5 font-display text-3xl font-black text-white">
              {r.score.toFixed(1)}
              <span className="ml-2 align-middle text-xs font-bold text-white/60">
                · {regionVerdict(r.score)}
              </span>
            </p>
            <Bar
              value10={r.score}
              color={r.score >= 7 ? "#4ADE80" : GOLD_BAR}
            />
            <p className="mt-2.5 text-[11px] leading-relaxed text-white/45">
              {r.note}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
