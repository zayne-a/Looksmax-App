"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ComingSoon from "@/components/creator/ComingSoon";
import {
  fetchContent,
  youtubeIdFor,
  type ContentItem,
} from "@/lib/content";

/**
 * Creator video examples — now DB-driven via the unified content
 * system (collections `creator-examples` and `replays`, managed from
 * /admin/content). The default grid component accepts normalised
 * items and renders both player kinds in the modal: YouTube embeds
 * and direct <video> files. `VideoExamplesLoader` (below) is the
 * client child the server page renders: it fetches both collections,
 * shows the replays section only when it has items, and falls back
 * to the exact Coming Soon state when both collections are empty.
 */

export interface NormalizedExample {
  id: string;
  title: string;
  youtubeId?: string | null;
  videoUrl?: string | null;
  posterUrl?: string | null;
  linkUrl?: string | null;
}

/** ContentItem → the normalised shape the grid/modal speak. */
export function normalizeContentItem(item: ContentItem): NormalizedExample {
  const youtubeId = youtubeIdFor(item);
  const isImage = item.type === "image";
  return {
    id: item.id,
    title: item.title ?? "Untitled",
    youtubeId,
    videoUrl: !youtubeId && item.type === "video" ? item.mediaUrl : null,
    posterUrl: item.posterUrl ?? (isImage ? item.mediaUrl : null),
    linkUrl: item.linkUrl ?? (item.type === "link" ? item.mediaUrl : null),
  };
}

function isPlayable(v: NormalizedExample): boolean {
  return Boolean(v.youtubeId || v.videoUrl);
}

function thumbSrc(v: NormalizedExample): string | null {
  if (v.posterUrl) return v.posterUrl;
  if (v.youtubeId) return `https://i.ytimg.com/vi/${v.youtubeId}/hqdefault.jpg`;
  return null;
}

export default function VideoExamples({
  examples,
}: {
  examples: NormalizedExample[];
}) {
  const [active, setActive] = useState<NormalizedExample | null>(null);

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
        {examples.map((v) => {
          const thumb = thumbSrc(v);
          const cardCls =
            "group overflow-hidden rounded-2xl border-2 border-white/10 bg-white/[0.02] text-left transition-all duration-300 hover:border-[#5EEAD4]";
          const inner = (
            <>
              <div className="relative aspect-video w-full overflow-hidden">
                {thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={thumb}
                    alt={v.title}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : v.videoUrl ? (
                  <video
                    src={v.videoUrl}
                    preload="metadata"
                    muted
                    playsInline
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-white/[0.04] text-sm font-bold text-[#9b9ba4]">
                    Open link →
                  </div>
                )}
                {isPlayable(v) && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#5EEAD4] text-black shadow-[0_0_24px_rgba(94,234,212,0.5)]">
                      ▶
                    </span>
                  </span>
                )}
              </div>
              <p className="line-clamp-2 p-4 font-medium transition-colors group-hover:text-[#5EEAD4]">
                {v.title}
              </p>
            </>
          );
          if (isPlayable(v)) {
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => setActive(v)}
                className={cardCls}
              >
                {inner}
              </button>
            );
          }
          return (
            <a
              key={v.id}
              href={v.linkUrl ?? v.posterUrl ?? "#"}
              target="_blank"
              rel="noreferrer"
              className={cardCls}
            >
              {inner}
            </a>
          );
        })}
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
              {active.youtubeId ? (
                <iframe
                  width="100%"
                  height="100%"
                  src={`https://www.youtube.com/embed/${active.youtubeId}?autoplay=1`}
                  title="Video Player"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="h-full w-full"
                />
              ) : active.videoUrl ? (
                <video
                  src={active.videoUrl}
                  poster={active.posterUrl ?? undefined}
                  controls
                  autoPlay
                  playsInline
                  className="h-full w-full"
                />
              ) : null}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Client loader for /creator/video-examples: fetches `creator-examples`
 * and `replays`, renders the examples grid plus (only when non-empty)
 * the replays section, and the Coming Soon state when both are empty.
 */
export function VideoExamplesLoader() {
  const [state, setState] = useState<
    | { phase: "loading" }
    | { phase: "ready"; examples: NormalizedExample[]; replays: NormalizedExample[] }
  >({ phase: "loading" });

  useEffect(() => {
    let live = true;
    void Promise.all([
      fetchContent("creator-examples"),
      fetchContent("replays"),
    ]).then(([examples, replays]) => {
      if (!live) return;
      setState({
        phase: "ready",
        examples: examples.map(normalizeContentItem),
        replays: replays.map(normalizeContentItem),
      });
    });
    return () => {
      live = false;
    };
  }, []);

  if (state.phase === "ready" && state.examples.length === 0 && state.replays.length === 0) {
    return <ComingSoon title="Video Examples" />;
  }

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-[#f4f1e8]">
      <div className="mx-auto max-w-6xl px-4 py-10 md:px-8 md:py-14">
        <Link
          href="/creator"
          className="text-sm text-[#9b9ba4] transition-colors hover:text-[#5EEAD4]"
        >
          ← Back to Creator Tools
        </Link>
        <h1 className="mt-4 font-[family-name:var(--font-archivo)] text-4xl font-extrabold tracking-tight md:text-5xl">
          Video Examples
        </h1>
        <p className="mt-3 max-w-2xl text-[#9b9ba4]">
          Watch example videos showcasing template usage and content
          creation tips.
        </p>

        {state.phase === "loading" ? (
          <p className="mt-10 text-sm text-[#9b9ba4]">Loading…</p>
        ) : (
          <>
            <div className="mt-10">
              <VideoExamples examples={state.examples} />
            </div>
            {state.replays.length > 0 && (
              <div className="mt-16">
                <h2 className="font-[family-name:var(--font-archivo)] text-2xl font-extrabold tracking-tight md:text-3xl">
                  Top-performing replays
                </h2>
                <div className="mt-6">
                  <VideoExamples examples={state.replays} />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
