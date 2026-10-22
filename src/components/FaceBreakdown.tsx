// Face breakdown for the dashboard (new): the trait-by-trait results pattern (cf. Umax) done honestly — bars only for true 0-100 scores (harmony, symmetry), values + plain-language readings for ratios (thirds, canthal tilt, jaw, FWHR), plus the skin readout (redness/texture/under-eye, lower is better) for parity with the plan page’s measurements section. All from the latest scan’s on-device measurements.
import { Card } from "@/components/ui";
import type { FaceMeasurements } from "@/lib/types";
import { buildMeasurementRead } from "@/lib/read";

/**
 * Trait-by-trait face breakdown — the results pattern users love in
 * apps like Umax, done Ascend's way: the numbers are the deterministic
 * on-device measurements, bars appear only for true 0–100 scores, and
 * ratio metrics get a value plus a plain-language reading instead of
 * an invented score. Nothing here is AI-generated or padded.
 */

function scoreLabel(score: number): string {
  if (score >= 80) return "Strong";
  if (score >= 65) return "Good";
  if (score >= 50) return "Developing";
  return "Focus area";
}

function ScoreRow({
  name,
  score,
  note,
}: {
  name: string;
  score: number;
  note: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-bold text-bone">{name}</p>
        <p className="text-sm tabular-nums text-muted">
          <span className="font-display text-base font-extrabold text-bone">
            {Math.round(score)}
          </span>{" "}
          / 100 ·{" "}
          <span className="font-bold text-gold-soft">{scoreLabel(score)}</span>
        </p>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-gold/60 to-gold transition-all"
          style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
        />
      </div>
      <p className="mt-1 text-xs leading-relaxed text-muted">{note}</p>
    </div>
  );
}

function ValueRow({
  name,
  value,
  reading,
}: {
  name: string;
  value: string;
  reading: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <div>
        <p className="text-sm font-bold text-bone">{name}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted">{reading}</p>
      </div>
      <p className="shrink-0 font-display text-base font-extrabold tabular-nums text-bone">
        {value}
      </p>
    </div>
  );
}

export default function FaceBreakdown({
  measurements,
}: {
  measurements: FaceMeasurements;
}) {
  const m = measurements;
  const thirds = m.facialThirds;
  const maxDev =
    Math.max(
      Math.abs(thirds.upper - 1 / 3),
      Math.abs(thirds.mid - 1 / 3),
      Math.abs(thirds.lower - 1 / 3)
    ) * 100;
  const thirdsReading =
    maxDev <= 3
      ? "Close to equal thirds — the classical balance faces are judged against."
      : maxDev <= 6
        ? "Slightly uneven thirds — hairstyle length and fringe choices can rebalance this visually."
        : "Noticeably uneven thirds — your hairstyle guide covers the optical fixes; proportions themselves are bone, not effort.";

  const tilt = m.canthalTiltDeg;
  const tiltReading =
    tilt >= 2
      ? "Positive (upturned) tilt — reads alert and sharp."
      : tilt >= -1
        ? "Neutral tilt — in the typical range."
        : "Negative (downturned) tilt — sleep and under-eye care move how this reads more than anything.";

  const jaw = m.jawToCheekbone;
  const jawReading =
    jaw >= 0.95
      ? "Strong jaw presence relative to the cheekbones."
      : jaw >= 0.85
        ? "In the typical range — facial fat and posture decide how defined it looks day to day."
        : "Softer jaw presence — the jawline guide covers the levers that actually change this.";

  const fwhr = m.fwhr;
  const fwhrReading =
    fwhr >= 1.8 && fwhr <= 2.05
      ? "Inside the commonly cited 1.8–2.0 band for a broad, mature face structure."
      : fwhr < 1.8
        ? "A narrower facial structure — hairstyles with side volume balance it best."
        : "A wide facial structure — keep hairstyle height in check so width doesn't dominate.";

  return (
    <Card>
      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-gold">
        Face breakdown
      </p>
      <h3 className="font-display mt-1.5 text-xl font-extrabold text-bone">
        Your face, trait by trait
      </h3>
      <p className="mt-1 text-xs leading-relaxed text-muted">
        From your latest scan — measured on your device, never uploaded.
        Bars are true scores; ratios get readings, not invented grades.
      </p>

      <div className="mt-5 space-y-5">
        <ScoreRow
          name="Harmony"
          score={m.goldenRatioScore}
          note="Every measured ratio scored against its researched ideal band, across the whole face."
        />
        <ScoreRow
          name="Symmetry"
          score={m.symmetryScore}
          note="Left-right balance. Perfect symmetry isn't human — small gaps are normal and unnoticeable in motion."
        />
      </div>

      <div className="mt-5 space-y-4 border-t border-white/[0.07] pt-5">
        <ValueRow
          name="Facial thirds"
          value={`${Math.round(thirds.upper * 100)} / ${Math.round(thirds.mid * 100)} / ${Math.round(thirds.lower * 100)}`}
          reading={thirdsReading}
        />
        <ValueRow
          name="Canthal tilt"
          value={`${tilt > 0 ? "+" : ""}${tilt.toFixed(1)}°`}
          reading={tiltReading}
        />
        <ValueRow
          name="Jaw to cheekbone"
          value={jaw.toFixed(2)}
          reading={jawReading}
        />
        <ValueRow
          name="Facial width-to-height"
          value={fwhr.toFixed(2)}
          reading={fwhrReading}
        />
      </div>

      <div className="mt-5 border-t border-white/[0.07] pt-5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-bold text-bone">Skin readout</p>
          <p className="text-xs text-muted">lower is better</p>
        </div>
        <div className="mt-3 space-y-4">
          {(
            [
              { label: "Redness", v: m.skin.redness },
              { label: "Texture", v: m.skin.texture },
              { label: "Under-eye darkness", v: m.skin.underEye },
            ] as const
          ).map((s) => (
            <div key={s.label}>
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm text-bone/85">{s.label}</p>
                <p className="text-sm tabular-nums text-muted">
                  <span className="font-display text-base font-extrabold text-bone">
                    {Math.round(s.v)}
                  </span>{" "}
                  / 100 ·{" "}
                  <span className="font-bold text-gold-soft">
                    {s.v <= 33 ? "Calm" : s.v <= 66 ? "Moderate" : "Active"}
                  </span>
                </p>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-gold/60 to-gold transition-all"
                  style={{ width: `${Math.max(0, Math.min(100, s.v))}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-5 border-t border-white/[0.07] pt-4 text-xs leading-relaxed text-muted">
        Face shape from this scan:{" "}
        <span className="font-bold capitalize text-bone">{m.faceShape}</span>{" "}
        — your{" "}
        <a href="/guides/hairstyle-by-face-shape" className="font-semibold text-gold-soft">
          hairstyle-by-face-shape guide
        </a>{" "}
        turns that into a barber brief.
      </p>

      {/* THE DELIBERATE READ — every trait in long form (Zayne, 2026-10-21) */}
      <div className="mt-5 border-t border-white/[0.07] pt-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-gold">
          The deliberate read
        </p>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          Every trait above, in full — what it means, what moves it, and what
          to watch next scan. Settle in; it&apos;s the long version.
        </p>
        {(() => {
          const read = buildMeasurementRead(m);
          return (
            <>
              {read.intro.split("\n\n").map((p, i) => (
                <p key={i} className="mt-3 text-sm leading-relaxed text-bone/85">
                  {p}
                </p>
              ))}
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-gold/30 bg-gold/8 px-3 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-gold-soft">
                    Your standout
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-bone/85">
                    {read.strongest}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
                    Biggest lever
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-bone/85">
                    {read.biggestLever}
                  </p>
                </div>
              </div>
              <div className="divide-y divide-white/[0.06]">
                {read.items.map((item) => (
                  <div key={item.label} className="py-3">
                    <p className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-sm font-bold text-bone">
                        {item.label}
                      </span>
                      <span className="font-display text-sm font-extrabold tabular-nums text-gold-soft">
                        {item.value}
                      </span>
                    </p>
                    {item.detail.split("\n\n").map((p, i) => (
                      <p
                        key={i}
                        className="mt-2 text-sm leading-relaxed text-bone/85"
                      >
                        {p}
                      </p>
                    ))}
                  </div>
                ))}
              </div>
              <div className="mt-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
                  What to compare next scan
                </p>
                {read.nextScan.split("\n\n").map((p, i) => (
                  <p
                    key={i}
                    className="mt-2 text-sm leading-relaxed text-bone/85"
                  >
                    {p}
                  </p>
                ))}
              </div>
            </>
          );
        })()}
      </div>
    </Card>
  );
}
