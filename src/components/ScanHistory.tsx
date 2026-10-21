// Scan history (Zayne, 2026-10-21): EVERY scan and re-scan, saved with
// its photo (on-device) and its full data — and each scan expands into
// its complete deliberate read (~10 minutes: every trait interpreted
// in long form by lib/read). The record the AI coach analyses. Newest
// first. Additive: sits below the existing Progress sections.
"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui";
import type { SavedScan } from "@/lib/account";
import { loadScanPhotos, type ScanPhotoEntry } from "@/lib/scan-photos";
import { buildMeasurementRead } from "@/lib/read";

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function Paras({ text }: { text: string }) {
  return (
    <>
      {text.split("\n\n").map((p, i) => (
        <p key={i} className="mt-2 text-sm leading-relaxed text-bone/85">
          {p}
        </p>
      ))}
    </>
  );
}

export default function ScanHistory({ scans }: { scans: SavedScan[] }) {
  const [photos, setPhotos] = useState<Record<string, ScanPhotoEntry>>({});
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    setPhotos(loadScanPhotos());
  }, [scans]);

  if (!scans.length) return null;

  return (
    <Card>
      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-gold">
        Scan history
      </p>
      <p className="mt-1 text-xs leading-relaxed text-muted">
        Every scan and re-scan, saved with its photo and full measurements —
        open any scan for its complete read. Your AI coach can see this whole
        history and analyse how your numbers move over time. Photos stay on
        this device; they are never uploaded.
      </p>

      <div className="mt-4 space-y-3">
        {scans.map((scan, i) => {
          const prev = scans[i + 1];
          const delta =
            scan.overall_score != null && prev?.overall_score != null
              ? scan.overall_score - prev.overall_score
              : null;
          const photo = photos[scan.id];
          const sidePhoto = photos[`${scan.id}:side`];
          const m = scan.measurements;
          const isOpen = openId === scan.id;
          const read =
            isOpen && m?.landmarksDetected ? buildMeasurementRead(m) : null;
          return (
            <div
              key={scan.id}
              className="overflow-hidden rounded-2xl border border-white/10"
            >
              <button
                onClick={() => setOpenId(isOpen ? null : scan.id)}
                className="flex w-full items-center gap-3 px-3 py-3 text-left"
                aria-expanded={isOpen}
              >
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photo.img}
                    alt={`Scan from ${fmtDate(scan.created_at)}`}
                    className="h-12 w-12 shrink-0 rounded-xl object-cover"
                  />
                ) : (
                  <span className="font-display flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/15 text-sm font-extrabold text-bone">
                    {scan.overall_score ?? "—"}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-bone">
                    {fmtDate(scan.created_at)}
                    {i === 0 && (
                      <span className="ml-2 rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gold-soft">
                        Latest
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted">
                    Score {scan.overall_score ?? "—"}/100
                    {m?.faceShape && m.faceShape !== "unknown"
                      ? ` · ${m.faceShape} face`
                      : ""}
                    {!photo ? " · taken on another device" : ""}
                  </span>
                </span>
                {delta != null && delta !== 0 && (
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                      delta > 0
                        ? "border border-emerald-300/30 bg-emerald-300/10 text-emerald-200"
                        : "border border-white/15 bg-white/5 text-muted"
                    }`}
                  >
                    {delta > 0 ? `+${delta}` : delta} vs previous
                  </span>
                )}
                <span className="shrink-0 text-muted">{isOpen ? "−" : "+"}</span>
              </button>

              {isOpen && m && !m.landmarksDetected && (
                <div className="border-t border-white/10 px-4 py-4">
                  <p className="text-sm leading-relaxed text-muted">
                    Quiz-only entry — no face was measured in this scan, so
                    there&apos;s no photo read for it. It still anchors the
                    plan that was built from your answers that day.
                  </p>
                </div>
              )}

              {isOpen && m && read && (
                <div className="border-t border-white/10 px-4 py-4">
                  {photo && (
                    <div className="mb-4 flex gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.img}
                        alt={`Your scan photo from ${fmtDate(scan.created_at)}`}
                        className={`h-52 rounded-2xl object-cover ${sidePhoto ? "w-1/2" : "w-full"}`}
                      />
                      {sidePhoto && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={sidePhoto.img}
                          alt={`Your side profile from ${fmtDate(scan.created_at)}`}
                          className="h-52 w-1/2 rounded-2xl object-cover"
                        />
                      )}
                    </div>
                  )}
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gold">
                    The full read — {fmtDate(scan.created_at)}
                  </p>
                  <Paras text={read.intro} />
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
                  <div className="mt-2 divide-y divide-white/[0.06]">
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
                        <Paras text={item.detail} />
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
                      What to compare next scan
                    </p>
                    <Paras text={read.nextScan} />
                  </div>
                  {m.notes?.length ? (
                    <p className="mt-3 text-xs leading-relaxed text-muted">
                      Scan notes: {m.notes.join(" ")}
                    </p>
                  ) : null}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
