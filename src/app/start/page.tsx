"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  fetchFunnelMedia,
  funnelMediaForSlot,
  type FunnelMedia,
} from "@/lib/funnel-media";
import {
  contentForSlot,
  fetchContent,
  type ContentItem,
} from "@/lib/content";
import { barFraction, scoreTierLabel } from "@/lib/creator-tiers";

/**
 * The persuasion onboarding (Zayne, 2026-10-21) — "that's what the
 * product is." A full-screen, black + mint step machine that installs
 * the belief BEFORE the scan: the dating reality, the halo effect,
 * the two realities (admin-managed videos), the PSL scale itself,
 * and the research — then hands off to the scan.
 *
 * Copy register is deliberately brutal, mirroring the category
 * leader. Every factual claim made here is a real, published one
 * (OkCupid's data, Dion 1972, Langlois 2000, Hamermesh) stated at
 * full strength. The video steps and quote cards are admin slots —
 * Zayne fills them from /admin/funnel; empty slots render the static
 * design and never block the flow.
 */

const MINT = "#5EEAD4";

/** The PSL ladder in the template's own dialect (lib/creator-tiers):
 *  floors on the 1–8 scale, tier names from scoreTierLabel itself.
 *  The scale tops at 8 — there is no 10. */
const LADDER: { floor: number; range: string }[] = [
  { floor: 7.5, range: "7.5–8.0" },
  { floor: 6, range: "6.0–7.5" },
  { floor: 5.5, range: "5.5–6.0" },
  { floor: 5, range: "5.0–5.5" },
  { floor: 4, range: "4.0–5.0" },
  { floor: 3, range: "3.0–4.0" },
  { floor: 1, range: "< 3.0" },
];

function Cta({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-full bg-white px-6 py-4 font-display text-base font-black tracking-wide text-black transition active:scale-[0.98]"
    >
      {children}
    </button>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-[11px] font-black uppercase tracking-[0.3em]"
      style={{ color: MINT }}
    >
      {children}
    </p>
  );
}

function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-white/10">
      <div
        className="h-full rounded-full"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
}

const RESEARCH = [
  {
    title: "The halo effect is real",
    body: "In Dion, Berscheid & Walster's classic experiment, attractive people were judged more competent, more successful and happier — on no evidence beyond a photograph.",
    source: "Dion, Berscheid & Walster (1972)",
  },
  {
    title: "919 studies. Same verdict.",
    body: "Langlois et al.'s meta-analysis of the entire field: attractive adults and children are treated better and judged better across nearly every social outcome ever measured.",
    source: "Langlois et al. (2000)",
  },
  {
    title: "Looks pay. Literally.",
    body: "Economist Daniel Hamermesh's research puts the beauty premium at roughly 10–15% higher earnings across a career — a lifetime gap in the hundreds of thousands.",
    source: "Hamermesh, Beauty Pays (2011)",
  },
];

/** Study logos, mirrored from the native StudyCard (studyLogos.ts):
 *  the mark for a study's source, on a disc (white, except Oxford
 *  navy — its crest is white line art — and Minnesota maroon, whose
 *  M carries its own maroon field). People-led rows map to their
 *  institution's mark (Dion → Minnesota, Langlois + Hamermesh →
 *  UT Austin, Bryan Johnson → his Blueprint mark), so every card
 *  carries a logo. Hosted on the public content-media bucket. */
const STUDY_LOGOS: Record<string, { url: string; bg: string }> = {
  Harvard: {
    url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/content-media/study-logos/harvard.png`,
    bg: "#FFFFFF",
  },
  Stanford: {
    url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/content-media/study-logos/stanford.png`,
    bg: "#FFFFFF",
  },
  Oxford: {
    url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/content-media/study-logos/oxford.png`,
    bg: "#002147",
  },
  Yale: {
    url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/content-media/study-logos/yale.png`,
    bg: "#FFFFFF",
  },
  "St Andrews": {
    url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/content-media/study-logos/st-andrews.png`,
    bg: "#FFFFFF",
  },
  OkCupid: {
    url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/content-media/study-logos/okcupid.png`,
    bg: "#FFFFFF",
  },
  Minnesota: {
    url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/content-media/study-logos/minnesota.png`,
    bg: "#7A0019",
  },
  "UT Austin": {
    url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/content-media/study-logos/ut-austin.png`,
    bg: "#FFFFFF",
  },
  Blueprint: {
    url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/content-media/study-logos/blueprint.png`,
    bg: "#FFFFFF",
  },
};

/** The logo for a study's source, or null → monogram. Matches on
 *  the part before "·" for institution-led rows; people-led rows
 *  match on their leading name → their institution's mark
 *  (Dion → Minnesota, Langlois + Hamermesh → UT Austin,
 *  Bryan Johnson → his Blueprint mark). Web extends the native
 *  map with these rows; native parity is a follow-up. */
function logoForStudy(source: string | null): { url: string; bg: string } | null {
  const name = (source ?? "").trim();
  if (!name) return null;
  const head = name.split("·")[0].trim();
  const hit = STUDY_LOGOS[head];
  if (hit) return hit;
  if (name.startsWith("OkCupid")) return STUDY_LOGOS.OkCupid;
  if (name.startsWith("Dion")) return STUDY_LOGOS.Minnesota;
  if (name.startsWith("Langlois")) return STUDY_LOGOS["UT Austin"];
  if (name.startsWith("Hamermesh")) return STUDY_LOGOS["UT Austin"];
  if (name.startsWith("Bryan Johnson")) return STUDY_LOGOS.Blueprint;
  return null;
}

/** Monogram fallback, mirrored from the native StudyCard. */
function monogram(source: string | null, title: string | null): string {
  const text = (source ?? title ?? "M").trim();
  const letters = text.replace(/[^A-Za-z ]/g, "").split(" ").filter(Boolean);
  if (letters.length === 0) return "M";
  if (letters.length === 1) return (letters[0] ?? "M").slice(0, 1).toUpperCase();
  const first = letters[0]?.[0] ?? "";
  const second = letters[1]?.[0] ?? "";
  return (first + second).toUpperCase();
}

/** One research card's display data, live row or bundled fallback. */
interface ResearchCardData {
  key: string;
  title: string;
  body: string;
  source: string;
  mediaUrl: string | null;
  citation: string | null;
}

/** A research card in the native StudyCard's header layout: a
 *  round avatar (the item's image when set, else the source's
 *  logo on its disc, else a monogram), the headline as the name
 *  line, the source as the credential line, the finding in
 *  italics, and a citation footer when one is carried. */
function ResearchCard({ item }: { item: ResearchCardData }) {
  const logo = item.mediaUrl ? null : logoForStudy(item.source);
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <div className="flex items-center gap-4">
        {item.mediaUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.mediaUrl}
            alt=""
            className="h-16 w-16 shrink-0 rounded-full object-cover ring-2 ring-white"
          />
        ) : logo ? (
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full p-[7px] ring-2 ring-white"
            style={{ backgroundColor: logo.bg }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logo.url}
              alt=""
              className="h-full w-full object-contain"
            />
          </div>
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white/5 ring-2 ring-[#5EEAD4]">
            <span className="text-xl font-extrabold" style={{ color: MINT }}>
              {monogram(item.source, item.title)}
            </span>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-display text-base font-black leading-snug text-white">
            {item.title}
          </p>
          {item.source ? (
            <p className="mt-0.5 text-[13px] font-semibold text-white/50">
              {item.source}
            </p>
          ) : null}
        </div>
      </div>
      {item.body ? (
        <p className="mt-3 text-[15px] italic leading-relaxed text-[#D8D8DE]">
          “{item.body}”
        </p>
      ) : null}
      {item.citation ? (
        <p className="mt-2 text-xs font-semibold text-white/40">
          {item.citation}
        </p>
      ) : null}
    </div>
  );
}

/** Map a unified content_items row onto the FunnelMedia shape the
 *  step renderer already speaks. */
function contentToFunnelMedia(item: ContentItem): FunnelMedia {
  return {
    id: item.id,
    slot: item.slot ?? "",
    kind:
      item.type === "quote"
        ? "quote"
        : item.type === "image"
          ? "image"
          : "video",
    url: item.mediaUrl,
    headline: item.title,
    body: item.caption,
    sort: item.sort,
    active: item.active,
    updated_at: item.updatedAt,
  };
}

export default function StartPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [media, setMedia] = useState<FunnelMedia[]>([]);
  const [content, setContent] = useState<ContentItem[]>([]);
  const [researchItems, setResearchItems] = useState<ContentItem[]>([]);
  const [omegleClips, setOmegleClips] = useState<ContentItem[]>([]);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void fetchFunnelMedia().then((rows) => {
      if (live) setMedia(rows);
    });
    void fetchContent("funnel").then((rows) => {
      if (live) setContent(rows);
    });
    void fetchContent("research").then((rows) => {
      if (live) setResearchItems(rows);
    });
    void fetchContent("omegle-clips").then((rows) => {
      if (live) setOmegleClips(rows);
    });
    return () => {
      live = false;
    };
  }, []);

  // Prefer a content_items row for a slot; fall back to the legacy
  // funnel_media row when the slot doesn't exist there.
  const resolveSlot = (slot: string): FunnelMedia | null => {
    const item = contentForSlot(content, slot);
    if (item) {
      const mapped = contentToFunnelMedia(item);
      if (mapped.kind === "quote" ? mapped.headline : mapped.url) {
        return mapped;
      }
    }
    return funnelMediaForSlot(media, slot);
  };

  const chad = resolveSlot("chad-reality");
  const average = resolveSlot("average-reality");
  const quotes = ["quote-1", "quote-2", "quote-3"]
    .map((s) => resolveSlot(s))
    .filter((q): q is FunnelMedia => q !== null);

  // Omegle clips for the Chad's Reality step: playable videos only.
  const clips = omegleClips.filter(
    (c) => c.type === "video" && Boolean(c.mediaUrl)
  );
  const selectedClip = clips.find((c) => c.id === selectedClipId) ?? null;
  const clipForBg =
    selectedClip ?? (!chad?.url ? (clips[0] ?? null) : null);
  const chadEffective: FunnelMedia | null = clipForBg
    ? {
        id: clipForBg.id,
        slot: "chad-reality",
        kind: "video",
        url: clipForBg.mediaUrl,
        headline: chad?.headline ?? null,
        body: chad?.body ?? null,
        sort: chad?.sort ?? 0,
        active: true,
        updated_at: clipForBg.updatedAt,
      }
    : chad;

  // Research cards, live rows first choice, bundled fallback
  // otherwise — normalized to one shape, then filtered with
  // Zayne's rule: a study whose logo can't be found is removed
  // from the list (never shown logo-less); logo'd studies keep
  // their original order.
  const researchCards: ResearchCardData[] =
    researchItems.length > 0
      ? researchItems.map((r) => ({
          key: r.id,
          title: r.title ?? "",
          body: r.caption ?? "",
          source: r.sourceName ?? "",
          mediaUrl: r.mediaUrl,
          citation:
            typeof r.meta?.citation === "string" && r.meta.citation.length > 0
              ? r.meta.citation
              : null,
        }))
      : RESEARCH.map((r) => ({
          key: r.title,
          title: r.title,
          body: r.body,
          source: r.source,
          mediaUrl: null,
          citation: null,
        }));
  const sortedResearch = researchCards.filter((c) =>
    logoForStudy(c.source),
  );

  const LAST = 6;
  const next = () => setStep((s) => Math.min(LAST, s + 1));
  // Into the existing flow: quiz first (it feeds the plan), then scan.
  const toScan = () => router.push("/quiz");

  const videoStep = (
    row: FunnelMedia | null,
    fallbackHeadline: string,
    copy: string,
    cta: string,
    onCta: () => void,
    extra?: React.ReactNode
  ) => (
    <div className="relative flex min-h-full flex-col">
      {row?.url ? (
        <>
          <video
            src={row.url}
            autoPlay
            muted
            loop
            playsInline
            className="absolute inset-0 h-full w-full object-cover opacity-70"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black" />
        </>
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(94,234,212,0.10),transparent_65%)]" />
      )}
      <div className="relative mt-auto px-6 pb-4 pt-40">
        <Eyebrow>The two realities</Eyebrow>
        <h2 className="mt-3 font-display text-4xl font-black leading-[1.02] tracking-tight">
          {row?.headline || fallbackHeadline}
        </h2>
        <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/75">
          {copy}
        </p>
        {extra}
        <div className="mt-8">
          <Cta onClick={onCta}>{cta}</Cta>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-black text-white">
      {/* Progress */}
      <div className="sticky top-0 z-10 bg-black/80 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center gap-3 px-5 pt-4">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              className="text-xl leading-none text-white/60"
              aria-label="Back"
            >
              ←
            </button>
          ) : (
            <span className="w-5" />
          )}
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${((step + 1) / (LAST + 1)) * 100}%`,
                background: MINT,
              }}
            />
          </div>
          {step > 0 && step < LAST && (
            <button
              type="button"
              onClick={() => setStep(LAST)}
              className="text-xs font-bold uppercase tracking-widest text-white/40"
            >
              Skip
            </button>
          )}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 32 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -32 }}
          transition={{ duration: 0.28 }}
          className="mx-auto flex min-h-[calc(100dvh-60px)] w-full max-w-xl flex-col"
        >
          {step === 0 && (
            <div className="flex flex-1 flex-col px-6 pb-6 pt-16">
              <Eyebrow>PSL · Looksmax · Mewmax</Eyebrow>
              <h1 className="mt-4 font-display text-5xl font-black leading-[0.98] tracking-tight">
                Become
                <br />
                top-tier
                <br />
                <span style={{ color: MINT }}>attractive</span>
              </h1>
              <p className="mt-6 max-w-sm text-lg leading-relaxed text-white/70">
                Get your PSL rating and ascend in{" "}
                <span className="font-bold text-white">90 days</span> or less.
              </p>
              <div className="mt-auto pt-12">
                <Cta onClick={next}>Get my PSL rating</Cta>
                <p className="mt-4 text-center text-xs text-white/40">
                  Free score · Scanned on your device · Your photo never
                  uploads
                </p>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="flex flex-1 flex-col px-6 pb-6 pt-10">
              <Eyebrow>The dating reality</Eyebrow>
              <h2 className="mt-3 font-display text-4xl font-black leading-[1.02] tracking-tight">
                80% of men are rated below average
              </h2>
              <p className="mt-4 text-[15px] leading-relaxed text-white/70">
                That&apos;s not an insult. It&apos;s from OkCupid&apos;s own
                published data — women judged four out of five men below
                average. The top sliver of faces takes almost every match,
                every reply, every date.
              </p>
              <div className="mt-10 space-y-6">
                <div>
                  <div className="mb-2 flex items-baseline justify-between">
                    <span className="text-sm font-bold">Top 20% of men</span>
                    <span className="text-xs font-bold" style={{ color: MINT }}>
                      Almost all the attention
                    </span>
                  </div>
                  <Bar pct={92} color={MINT} />
                </div>
                <div>
                  <div className="mb-2 flex items-baseline justify-between">
                    <span className="text-sm font-bold">Bottom 80%</span>
                    <span className="text-xs font-bold text-white/40">
                      Fighting for what&apos;s left
                    </span>
                  </div>
                  <Bar pct={14} color="rgba(255,255,255,0.35)" />
                </div>
              </div>
              <p className="mt-10 text-[15px] leading-relaxed text-white/70">
                Nobody hands you this information. You either learn where you
                stand — and climb — or you stay in the dark wondering why
                nothing works.
              </p>
              <div className="mt-auto pt-10">
                <Cta onClick={next}>Keep going</Cta>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-1 flex-col px-6 pb-6 pt-10">
              <Eyebrow>The halo effect</Eyebrow>
              <h2 className="mt-3 font-display text-4xl font-black leading-[1.02] tracking-tight">
                Your face speaks before you do
              </h2>
              <p className="mt-4 text-[15px] leading-relaxed text-white/70">
                Psychologists call it the halo effect: one trait — your face —
                colours every judgement a stranger makes about you. Competence.
                Trust. Status. Worth.
              </p>
              <div className="mt-8 space-y-3">
                {[
                  "Hired faster",
                  "Paid more",
                  "Believed sooner",
                  "Forgiven easier",
                ].map((t) => (
                  <div
                    key={t}
                    className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3.5"
                  >
                    <span style={{ color: MINT }} className="font-black">
                      →
                    </span>
                    <span className="font-bold">{t}</span>
                  </div>
                ))}
              </div>
              <p className="mt-8 text-[15px] leading-relaxed text-white/70">
                Same person. Different face. Different life. That&apos;s not
                fair — it&apos;s just true, and it&apos;s true everywhere:
                work, dating, every room you&apos;ll ever walk into.
              </p>
              <div className="mt-auto pt-10">
                <Cta onClick={next}>Show me the two realities</Cta>
              </div>
            </div>
          )}

          {step === 3 &&
            videoStep(
              chadEffective,
              "Chad's Reality",
              "He doesn't chase. He gets chosen. Numbers offered, doors opened, respect arriving before he says a single word. You think that's confidence. It's structure — plus everything trainable stacked ruthlessly on top of it.",
              "And the average man?",
              next,
              clips.length > 0 ? (
                <div className="mt-6">
                  <div className="flex gap-3 overflow-x-auto pb-2">
                    {clips.map((clip) => {
                      const isActive = clipForBg?.id === clip.id;
                      return (
                        <button
                          key={clip.id}
                          type="button"
                          onClick={() => setSelectedClipId(clip.id)}
                          className={`w-24 shrink-0 overflow-hidden rounded-xl border text-left transition ${
                            isActive
                              ? "border-[#5EEAD4]"
                              : "border-white/15 hover:border-white/40"
                          }`}
                        >
                          {clip.posterUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={clip.posterUrl}
                              alt={clip.title ?? ""}
                              className="aspect-[9/16] w-full object-cover"
                            />
                          ) : (
                            <video
                              src={clip.mediaUrl ?? undefined}
                              muted
                              playsInline
                              preload="metadata"
                              className="aspect-[9/16] w-full object-cover"
                            />
                          )}
                          <span className="block truncate px-2 py-1.5 text-[11px] font-bold text-white/80">
                            {clip.title}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : undefined
            )}

          {step === 4 &&
            videoStep(
              average,
              "Average Reality",
              "Invisible in the group photo. Left on read. “You're like a brother to me.” The average face gets the average life — quietly, every single day, in ways nobody ever explains to him.",
              "I'm done being average",
              next
            )}

          {step === 5 && (
            <div className="flex flex-1 flex-col px-6 pb-6 pt-10">
              <Eyebrow>The PSL scale</Eyebrow>
              <h2 className="mt-3 font-display text-4xl font-black leading-[1.02] tracking-tight">
                You&apos;ve been rated your whole life
              </h2>
              <p className="mt-4 text-[15px] leading-relaxed text-white/70">
                You just never got to see the number. Everyone you&apos;ve ever
                met placed you on this scale in seconds:
              </p>
              <div className="mt-8 space-y-2">
                {LADDER.map((row) => {
                  const label = scoreTierLabel(row.floor, "male");
                  const isTop = label === "True Adam" || label === "Chad";
                  return (
                    <div
                      key={label}
                      className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5"
                    >
                      <span
                        className="w-32 shrink-0 text-sm font-black uppercase tracking-wide"
                        style={{ color: isTop ? MINT : "#fff" }}
                      >
                        {label}
                      </span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${barFraction(row.floor) * 100}%`,
                            background: isTop ? MINT : "rgba(255,255,255,0.4)",
                          }}
                        />
                      </div>
                      <span className="w-16 shrink-0 text-right text-xs font-bold text-white/50">
                        {row.range}
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="mt-8 text-[15px] leading-relaxed text-white/70">
                In about sixty seconds you&apos;ll know exactly where you
                stand — and exactly how many points of potential you&apos;re
                leaving on the table.
              </p>
              <div className="mt-auto pt-10">
                <Cta onClick={next}>Show me the proof</Cta>
              </div>
            </div>
          )}

          {step === 6 && (
            <div className="flex flex-1 flex-col px-6 pb-6 pt-10">
              <Eyebrow>The research</Eyebrow>
              <h2 className="mt-3 font-display text-4xl font-black leading-[1.02] tracking-tight">
                This isn&apos;t opinion. It&apos;s measured.
              </h2>
              <div className="mt-8 space-y-3">
                {sortedResearch.map((r) => (
                  <ResearchCard key={r.key} item={r} />
                ))}
                {quotes.map((q) => (
                  <figure
                    key={q.slot}
                    className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"
                  >
                    <blockquote className="font-display text-lg font-bold leading-snug">
                      “{q.headline}”
                    </blockquote>
                    {q.body && (
                      <figcaption className="mt-2 text-xs font-bold uppercase tracking-widest text-white/45">
                        {q.body}
                      </figcaption>
                    )}
                  </figure>
                ))}
              </div>
              <div className="mt-auto pt-10">
                <Cta onClick={toScan}>Get my PSL rating →</Cta>
                <p className="mt-4 text-center text-xs text-white/40">
                  Two photos. Sixty seconds. The number everyone else already
                  knows.
                </p>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
