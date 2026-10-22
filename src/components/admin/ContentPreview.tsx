"use client";

import Link from "next/link";
import VideoExamples, {
  normalizeContentItem,
} from "@/components/creator/VideoExamples";
import { youtubeIdFrom, type ContentItem } from "@/lib/content";

/**
 * ContentPreview — the live app/site preview for /admin/content.
 *
 * Renders the item being edited inside a phone frame in the app's
 * visual language (near-black #0A0A0C, mint #5EEAD4 accents, the
 * surfaces' own card grammar), updating on every keystroke and on
 * local file selection (object URLs passed in via localMediaUrl /
 * localPosterUrl preview the chosen file BEFORE it is uploaded).
 *
 * Reused vs mirrored (the surfaces' renderers are mostly inline
 * closures in page components, not exportable components):
 *  - creator-examples / replays → REUSED: the real `VideoExamples`
 *    grid component + `normalizeContentItem` from
 *    src/components/creator/VideoExamples.tsx, fed a preview
 *    ContentItem. Clicking the card opens the real player modal.
 *  - funnel video slots, funnel quotes, research cards, Omegle
 *    rail cards → MIRRORED: markup/classes copied verbatim from
 *    src/app/start/page.tsx (videoStep, the step-6 quote figure,
 *    the step-6 research card, the step-3 clip rail) because those
 *    renderers are closures inside StartPage and cannot be imported
 *    without refactoring the funnel itself.
 *  - animations → a looping <video>/<img> element, which is how the
 *    asset itself plays; Lottie JSON gets an honest note (no Lottie
 *    player exists on the web side).
 *
 * Empty states are honest: they show what the surface itself shows
 * (the funnel's plain radial background, a card the grid renders
 * with no media) or an explicit admin note that the item renders
 * nothing yet — never a fake/placeholder image.
 */

export interface PreviewItem {
  collection: string;
  slot: string | null;
  type: ContentItem["type"];
  title: string;
  caption: string;
  sourceName: string;
  mediaUrl: string;
  posterUrl: string;
  linkUrl: string;
  active: boolean;
}

/** The real page a collection renders on, or null when the
 *  collection has no single live page (animations are picked up by
 *  other surfaces). */
export function liveSurfaceFor(
  collection: string
): { href: string; label: string } | null {
  switch (collection) {
    case "funnel":
    case "omegle-clips":
    case "research":
      return { href: "/start", label: "View on live surface — /start" };
    case "creator-examples":
    case "replays":
      return {
        href: "/creator/video-examples",
        label: "View on live surface — /creator/video-examples",
      };
    default:
      return null;
  }
}

const MINT = "#5EEAD4";

function isImageUrl(url: string): boolean {
  return /\.(png|jpe?g|gif|webp|avif|svg)(\?|#|$)/i.test(url);
}

function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov|m4v|ogg)(\?|#|$)/i.test(url);
}

/** Eyebrow exactly as /start renders it. */
function StartEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-[11px] font-black uppercase tracking-[0.3em]"
      style={{ color: MINT }}
    >
      {children}
    </p>
  );
}

/** Admin-only empty note (dashed, clearly not part of the surface). */
function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-2xl border border-dashed border-white/20 bg-white/[0.02] px-4 py-3 text-xs leading-relaxed text-white/50">
      {children}
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* Mirrored surface renderers (from src/app/start/page.tsx)            */
/* ------------------------------------------------------------------ */

const FUNNEL_VIDEO_COPY: Record<
  string,
  { fallbackHeadline: string; copy: string; cta: string }
> = {
  "chad-reality": {
    fallbackHeadline: "Chad's Reality",
    copy: "He doesn't chase. He gets chosen. Numbers offered, doors opened, respect arriving before he says a single word. You think that's confidence. It's structure — plus everything trainable stacked ruthlessly on top of it.",
    cta: "And the average man?",
  },
  "average-reality": {
    fallbackHeadline: "Average Reality",
    copy: "Invisible in the group photo. Left on read. “You're like a brother to me.” The average face gets the average life — quietly, every single day, in ways nobody ever explains to him.",
    cta: "I'm done being average",
  },
};

/** Mirror of the videoStep() renderer in /start. */
function FunnelVideoPreview({
  item,
  media,
  poster,
}: {
  item: PreviewItem;
  media: string;
  poster: string;
}) {
  const def = FUNNEL_VIDEO_COPY[item.slot ?? ""] ?? {
    fallbackHeadline: "Chad's Reality",
    copy: FUNNEL_VIDEO_COPY["chad-reality"].copy,
    cta: "Keep going",
  };
  const showAsImage = item.type === "image" || (media && isImageUrl(media));
  return (
    <div className="relative flex min-h-[540px] flex-col">
      {media ? (
        <>
          {showAsImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={media}
              alt={item.title}
              className="absolute inset-0 h-full w-full object-cover opacity-70"
            />
          ) : (
            <video
              src={media}
              poster={poster || undefined}
              autoPlay
              muted
              loop
              playsInline
              className="absolute inset-0 h-full w-full object-cover opacity-70"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black" />
        </>
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(94,234,212,0.10),transparent_65%)]" />
      )}
      <div className="relative mt-auto px-6 pb-6 pt-40">
        <StartEyebrow>The two realities</StartEyebrow>
        <h2 className="mt-3 font-display text-4xl font-black leading-[1.02] tracking-tight">
          {item.title || def.fallbackHeadline}
        </h2>
        <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/75">
          {def.copy}
        </p>
        <div className="mt-8">
          <div className="w-full rounded-full bg-white px-6 py-4 text-center font-display text-base font-black tracking-wide text-black">
            {def.cta}
          </div>
        </div>
        {!media && (
          <p className="mt-4 text-center text-[11px] leading-relaxed text-white/40">
            No media yet — this is exactly what /start shows for this
            slot until you add a video and save.
          </p>
        )}
      </div>
    </div>
  );
}

/** Mirror of the step-6 quote figure in /start (the big quote
 *  treatment quotes get everywhere). */
function QuotePreview({ item }: { item: PreviewItem }) {
  return (
    <div className="px-5 pb-6 pt-12">
      <StartEyebrow>The research</StartEyebrow>
      <div className="mt-6">
        {item.title ? (
          <figure className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <blockquote className="font-display text-lg font-bold leading-snug">
              “{item.title}”
            </blockquote>
            {item.caption && (
              <figcaption className="mt-2 text-xs font-bold uppercase tracking-widest text-white/45">
                {item.caption}
              </figcaption>
            )}
          </figure>
        ) : (
          <EmptyNote>
            Nothing renders on the surface yet — a quote only appears
            once it has quote text.
          </EmptyNote>
        )}
      </div>
    </div>
  );
}

/** Mirror of the step-6 research card in /start. */
function ResearchPreview({ item }: { item: PreviewItem }) {
  const hasContent = item.title || item.caption || item.sourceName;
  return (
    <div className="px-5 pb-6 pt-12">
      <StartEyebrow>The research</StartEyebrow>
      <h2 className="mt-3 font-display text-4xl font-black leading-[1.02] tracking-tight">
        This isn&apos;t opinion. It&apos;s measured.
      </h2>
      <div className="mt-8">
        {hasContent ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            {item.title && (
              <p
                className="font-display text-lg font-black"
                style={{ color: MINT }}
              >
                {item.title}
              </p>
            )}
            {item.caption && (
              <p className="mt-2 text-sm leading-relaxed text-white/65">
                {item.caption}
              </p>
            )}
            {item.sourceName && (
              <p className="mt-2 text-xs text-white/40">
                Source: {item.sourceName}
              </p>
            )}
          </div>
        ) : (
          <EmptyNote>
            Nothing renders yet — add a title, caption and a real
            source name, and the card appears in the research step of
            /start.
          </EmptyNote>
        )}
      </div>
    </div>
  );
}

/** Mirror of the step-3 Omegle clip rail card in /start. */
function OmeglePreview({
  item,
  media,
  poster,
  ytId,
}: {
  item: PreviewItem;
  media: string;
  poster: string;
  ytId: string | null;
}) {
  return (
    <div className="px-5 pb-6 pt-12">
      <StartEyebrow>Chad&apos;s Reality — clip rail</StartEyebrow>
      <p className="mt-3 text-sm leading-relaxed text-white/65">
        Clips sit in a rail inside the Chad&apos;s Reality step;
        tapping one plays it as the step&apos;s background.
      </p>
      <div className="mt-6 flex gap-3 overflow-x-auto pb-2">
        <div className="w-24 shrink-0 overflow-hidden rounded-xl border border-[#5EEAD4] text-left">
          {poster ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={poster}
              alt={item.title}
              className="aspect-[9/16] w-full object-cover"
            />
          ) : media ? (
            <video
              src={media}
              muted
              playsInline
              preload="metadata"
              className="aspect-[9/16] w-full object-cover"
            />
          ) : (
            <div className="flex aspect-[9/16] w-full items-center justify-center bg-white/[0.04] px-2 text-center text-[10px] font-bold uppercase tracking-widest text-white/40">
              No media
            </div>
          )}
          <span className="block truncate px-2 py-1.5 text-[11px] font-bold text-white/80">
            {item.title || "Untitled"}
          </span>
        </div>
      </div>
      {!media && (
        <div className="mt-4">
          <EmptyNote>
            Without a video file this clip is filtered out of the rail
            entirely — add media and save to make it appear.
          </EmptyNote>
        </div>
      )}
      {media && ytId && (
        <div className="mt-4">
          <EmptyNote>
            This is a YouTube URL — the rail plays direct video files,
            so a YouTube link won&apos;t play there. Upload the clip
            file instead.
          </EmptyNote>
        </div>
      )}
    </div>
  );
}

/** Animations play as looping media; Lottie JSON has no web player. */
function AnimationPreview({
  item,
  media,
  ytId,
}: {
  item: PreviewItem;
  media: string;
  ytId: string | null;
}) {
  const isLottie = /\.json(\?|#|$)/i.test(media);
  return (
    <div className="px-5 pb-6 pt-12">
      <StartEyebrow>Animation</StartEyebrow>
      <div className="mt-6">
        {!media ? (
          <EmptyNote>
            No media yet — add a looping video, GIF or Lottie file and
            it will play here exactly as the asset plays.
          </EmptyNote>
        ) : ytId ? (
          <div className="aspect-video w-full overflow-hidden rounded-2xl border border-white/10">
            <iframe
              width="100%"
              height="100%"
              src={`https://www.youtube.com/embed/${ytId}`}
              title={item.title || "Animation preview"}
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="h-full w-full"
            />
          </div>
        ) : isLottie ? (
          <EmptyNote>
            Lottie JSON ({media.split("/").pop()}) — it animates in
            the app; there is no Lottie player on the web side, so
            this preview can&apos;t play it.
          </EmptyNote>
        ) : isImageUrl(media) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={media}
            alt={item.title}
            className="w-full rounded-2xl border border-white/10 object-cover"
          />
        ) : (
          <video
            src={media}
            autoPlay
            muted
            loop
            playsInline
            className="w-full rounded-2xl border border-white/10 object-cover"
          />
        )}
      </div>
      {(item.title || item.caption) && (
        <div className="mt-4 text-center">
          {item.title && (
            <p className="font-display text-base font-bold">{item.title}</p>
          )}
          {item.caption && (
            <p className="mt-1 text-sm leading-relaxed text-white/65">
              {item.caption}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** REUSED surface: the real VideoExamples grid + normaliser. */
function CreatorExamplesPreview({
  item,
  media,
  poster,
}: {
  item: PreviewItem;
  media: string;
  poster: string;
}) {
  const previewItem: ContentItem = {
    id: "preview",
    collection: item.collection,
    slot: item.slot,
    type: item.type,
    title: item.title || null,
    caption: item.caption || null,
    sourceName: item.sourceName || null,
    mediaUrl: media || null,
    posterUrl: poster || null,
    linkUrl: item.linkUrl || null,
    meta: {},
    sort: 0,
    active: item.active,
    updatedAt: "",
  };
  const normalized = normalizeContentItem(previewItem);
  return (
    <div className="bg-[#0a0a0c] px-4 pb-6 pt-12 text-[#f4f1e8]">
      <p className="font-[family-name:var(--font-archivo)] text-2xl font-extrabold tracking-tight">
        {item.collection === "replays"
          ? "Top-performing replays"
          : "Video Examples"}
      </p>
      <div className="mt-5">
        <VideoExamples examples={[normalized]} />
      </div>
      {(item.caption || item.sourceName) && (
        <p className="mt-3 text-[11px] leading-relaxed text-white/40">
          This surface shows the poster and title only — the caption
          and source name aren&apos;t displayed on the card.
        </p>
      )}
    </div>
  );
}

/** Generic fallbacks for type/collection combinations without a
 *  dedicated surface renderer. */
function GenericPreview({
  item,
  media,
  poster,
  ytId,
}: {
  item: PreviewItem;
  media: string;
  poster: string;
  ytId: string | null;
}) {
  if (item.type === "quote") return <QuotePreview item={item} />;
  if (item.type === "research") return <ResearchPreview item={item} />;
  if (item.type === "animation")
    return <AnimationPreview item={item} media={media} ytId={ytId} />;
  return (
    <div className="px-5 pb-6 pt-12">
      <StartEyebrow>Preview</StartEyebrow>
      <div className="mt-6">
        {!media && !item.linkUrl ? (
          <EmptyNote>
            Nothing renders yet — add media or a link and it will
            appear here as you type.
          </EmptyNote>
        ) : ytId ? (
          <div className="aspect-video w-full overflow-hidden rounded-2xl border border-white/10">
            <iframe
              width="100%"
              height="100%"
              src={`https://www.youtube.com/embed/${ytId}`}
              title={item.title || "Video preview"}
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="h-full w-full"
            />
          </div>
        ) : media && (item.type === "video" || isVideoUrl(media)) ? (
          <video
            src={media}
            poster={poster || undefined}
            controls
            muted
            loop
            playsInline
            className="aspect-video w-full rounded-2xl border border-white/10 bg-black object-cover"
          />
        ) : media ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={media}
            alt={item.title}
            className="w-full rounded-2xl border border-white/10 object-cover"
          />
        ) : (
          <a
            href={item.linkUrl}
            target="_blank"
            rel="noreferrer"
            className="block rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-sm font-bold text-[#5EEAD4]"
          >
            Open link →
          </a>
        )}
      </div>
      {item.title && (
        <p className="mt-4 font-display text-lg font-bold leading-snug">
          {item.title}
        </p>
      )}
      {item.caption && (
        <p className="mt-2 text-sm leading-relaxed text-white/65">
          {item.caption}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The phone-frame preview                                             */
/* ------------------------------------------------------------------ */

export default function ContentPreview({
  item,
  localMediaUrl,
  localPosterUrl,
  liveHref,
}: {
  item: PreviewItem;
  /** Object URL for a just-picked media file (pre-upload). */
  localMediaUrl?: string | null;
  /** Object URL for a just-picked poster file (pre-upload). */
  localPosterUrl?: string | null;
  /** When set (item saved / exists), shows the live-surface link. */
  liveHref?: string | null;
}) {
  const media = localMediaUrl || item.mediaUrl || "";
  const poster = localPosterUrl || item.posterUrl || "";
  const ytId = youtubeIdFrom(media) || youtubeIdFrom(item.linkUrl);
  const hasLocal = Boolean(localMediaUrl || localPosterUrl);
  const live = liveSurfaceFor(item.collection);

  let body: React.ReactNode;
  if (item.collection === "funnel") {
    body =
      item.type === "quote" || (item.slot ?? "").startsWith("quote") ? (
        <QuotePreview item={item} />
      ) : (
        <FunnelVideoPreview item={item} media={media} poster={poster} />
      );
  } else if (item.collection === "omegle-clips") {
    body =
      item.type === "quote" ? (
        <QuotePreview item={item} />
      ) : (
        <OmeglePreview item={item} media={media} poster={poster} ytId={ytId} />
      );
  } else if (
    item.collection === "creator-examples" ||
    item.collection === "replays"
  ) {
    body = <CreatorExamplesPreview item={item} media={media} poster={poster} />;
  } else if (item.collection === "research") {
    body =
      item.type === "quote" ? (
        <QuotePreview item={item} />
      ) : (
        <ResearchPreview item={item} />
      );
  } else if (item.collection === "animations") {
    body =
      item.type === "quote" ? (
        <QuotePreview item={item} />
      ) : (
        <AnimationPreview item={item} media={media} ytId={ytId} />
      );
  } else {
    body = (
      <GenericPreview item={item} media={media} poster={poster} ytId={ytId} />
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-gold">
          Live preview · app / site
        </span>
        {item.active ? (
          <span className="rounded-full border border-[#5EEAD4]/50 bg-[#5EEAD4]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-[#5EEAD4]">
            ● Live
          </span>
        ) : (
          <span className="rounded-full border border-white/15 bg-white/[0.03] px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-muted">
            Hidden
          </span>
        )}
      </div>

      {/* Phone frame */}
      <div className="relative mx-auto mt-3 w-full max-w-[350px] rounded-[2.4rem] border border-white/15 bg-[#111113] p-2.5 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.9)]">
        <div className="relative overflow-hidden rounded-[1.9rem] bg-[#0A0A0C] text-white">
          <div className="pointer-events-none absolute left-1/2 top-2 z-20 h-5 w-24 -translate-x-1/2 rounded-full border border-white/5 bg-black" />
          {!item.active && (
            <div className="relative z-10 bg-white/10 px-4 py-2 pt-9 text-center text-[11px] font-bold uppercase tracking-widest text-white/70">
              Hidden from users — inactive
            </div>
          )}
          <div className={item.active ? undefined : "opacity-50 saturate-50"}>
            {body}
          </div>
        </div>
      </div>

      {hasLocal && (
        <p className="mt-3 text-center text-[11px] font-semibold leading-relaxed text-gold-soft">
          Showing the file you just picked — Upload, then Save, to
          publish it.
        </p>
      )}
      {!item.active && (
        <p className="mt-2 text-center text-[11px] leading-relaxed text-muted">
          Inactive items don&apos;t appear on any surface.
        </p>
      )}
      {item.collection === "animations" && (
        <p className="mt-2 text-center text-[11px] leading-relaxed text-muted">
          Animations are picked up by other surfaces — there&apos;s no
          single live page for them.
        </p>
      )}
      {liveHref && live && (
        <p className="mt-3 text-center">
          <Link
            href={liveHref}
            target="_blank"
            className="text-xs font-bold text-gold hover:underline"
          >
            {live.label} ↗
          </Link>
        </p>
      )}
    </div>
  );
}
