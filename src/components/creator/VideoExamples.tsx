"use client";

import { useEffect, useState } from "react";
import type { VideoExample } from "@/lib/video-examples";

/** Grid of example cards; a click opens the in-page modal YouTube
 *  player — the reference's video-examples pattern. Fed entirely by
 *  src/lib/video-examples.ts. */
export default function VideoExamples({
  examples,
}: {
  examples: VideoExample[];
}) {
  const [active, setActive] = useState<VideoExample | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActive(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {examples.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => setActive(v)}
            className="group overflow-hidden rounded-2xl border-2 border-white/10 bg-white/[0.02] text-left transition-all duration-300 hover:border-[#5EEAD4]"
          >
            <div className="relative aspect-video w-full overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://i.ytimg.com/vi/${v.youtubeId}/hqdefault.jpg`}
                alt={v.title}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#5EEAD4] text-black shadow-[0_0_24px_rgba(94,234,212,0.5)]">
                  ▶
                </span>
              </span>
            </div>
            <p className="line-clamp-2 p-4 font-medium transition-colors group-hover:text-[#5EEAD4]">
              {v.title}
            </p>
          </button>
        ))}
      </div>

      {active && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setActive(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Video Player"
        >
          <div
            className="w-full max-w-5xl overflow-hidden rounded-xl border-2 border-white/15 bg-black"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="aspect-video w-full">
              <iframe
                width="100%"
                height="100%"
                src={`https://www.youtube.com/embed/${active.youtubeId}?autoplay=1`}
                title="Video Player"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="h-full w-full"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
