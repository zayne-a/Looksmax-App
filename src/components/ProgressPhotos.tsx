"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui";
import { BeforeAfter } from "@/components/motion";
import type { SavedScan } from "@/lib/account";

interface ProgressPhoto {
  id: string;
  date: string; // day key
  dataUrl: string;
}

const STORAGE_KEY = "ascend_progress_photos";
const MAX_PHOTOS = 12;

/** Downscale on-device before storing — keeps local storage sane and
 *  the photo never leaves the phone at any size. */
function downscale(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const max = 900;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image load failed"));
    };
    img.src = url;
  });
}

function nearestScore(scans: SavedScan[], date: string): number | null {
  let best: number | null = null;
  let bestDiff = Infinity;
  for (const s of scans) {
    if (s.overall_score == null) continue;
    const d = Math.abs(
      new Date(s.created_at).getTime() - new Date(`${date}T12:00:00`).getTime()
    );
    if (d < bestDiff) {
      bestDiff = d;
      best = s.overall_score;
    }
  }
  return bestDiff <= 4 * 86400_000 ? best : null;
}

/**
 * The progress photo timeline — stored ONLY on this device (the
 * privacy promise: photos are never uploaded). Side-by-side compare
 * with the score nearest each photo's date turns "progress pictures"
 * into actual evidence.
 */
export default function ProgressPhotos({ scans }: { scans: SavedScan[] }) {
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setPhotos(JSON.parse(raw) as ProgressPhoto[]);
    } catch {
      /* private mode etc. — timeline simply starts empty */
    }
  }, []);

  const persist = (next: ProgressPhoto[]) => {
    setPhotos(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      setError("This device's storage is full — oldest photos can't be kept here. Nothing was uploaded; they're only on this device.");
    }
  };

  const addPhoto = async (file: File) => {
    setError(null);
    try {
      const dataUrl = await downscale(file);
      const now = new Date();
      const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const entry: ProgressPhoto = {
        id: `${Date.now()}`,
        date,
        dataUrl,
      };
      persist([entry, ...photos].slice(0, MAX_PHOTOS));
    } catch {
      setError("That image couldn't be read — try another photo.");
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev.slice(-1), id]
    );
  };

  const compare = selected
    .map((id) => photos.find((p) => p.id === id))
    .filter((p): p is ProgressPhoto => Boolean(p))
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  return (
    <Card>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-gold">
            Progress photos
          </p>
          <h3 className="font-display mt-1.5 text-2xl font-extrabold text-bone">
            Your face, over time
          </h3>
          <p className="mt-1 max-w-md text-xs leading-relaxed text-muted">
            Same light, same angle, front-facing. Stored{" "}
            <span className="font-bold text-bone">only on this device</span>{" "}
            — never uploaded. Tap two photos to compare them.
          </p>
        </div>
        <button
          onClick={() => fileRef.current?.click()}
          className="rounded-full bg-gold px-6 py-3 text-sm font-extrabold text-ink transition hover:brightness-110"
        >
          + Add today&apos;s photo
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void addPhoto(f);
            e.target.value = "";
          }}
        />
      </div>

      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}

      {photos.length === 0 ? (
        <p className="mt-5 rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-5 text-sm leading-relaxed text-muted">
          No progress photos yet. Add the first one today — in 4 weeks,
          this timeline is the proof no mirror can give you, because
          mirrors show you today and photos show you the change.
        </p>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-4">
            {photos.map((p) => {
              const score = nearestScore(scans, p.date);
              const isSel = selected.includes(p.id);
              return (
                <div key={p.id} className="group relative">
                  <button
                    onClick={() => toggleSelect(p.id)}
                    className={`block w-full overflow-hidden rounded-2xl border-2 transition ${
                      isSel ? "border-gold" : "border-white/10 hover:border-gold/40"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.dataUrl}
                      alt={`Progress photo from ${p.date}`}
                      className="aspect-[3/4] w-full object-cover"
                    />
                  </button>
                  <div className="mt-1.5 flex items-center justify-between px-0.5">
                    <p className="text-[11px] font-semibold text-muted">
                      {p.date}
                      {score !== null && (
                        <span className="text-gold-soft"> · {Math.round(score)}</span>
                      )}
                    </p>
                    <button
                      onClick={() =>
                        persist(photos.filter((x) => x.id !== p.id))
                      }
                      className="text-[11px] font-semibold text-muted opacity-0 transition hover:text-red-300 group-hover:opacity-100"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {compare.length === 2 && (
            <div className="mx-auto mt-6 max-w-sm">
              <BeforeAfter
                beforeSrc={compare[0].dataUrl}
                afterSrc={compare[1].dataUrl}
                beforeLabel={compare[0].date}
                afterLabel={compare[1].date}
                caption="Drag to compare — same person, weeks apart. This is the evidence."
              />
            </div>
          )}
        </>
      )}
    </Card>
  );
}
