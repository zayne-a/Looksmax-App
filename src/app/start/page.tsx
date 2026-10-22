"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  fetchFunnelMedia,
  funnelMediaForSlot,
  type FunnelMedia,
} from "@/lib/funnel-media";
import { PSL_TIERS } from "@/lib/psl";

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
  },
  {
    title: "919 studies. Same verdict.",
    body: "Langlois et al.'s meta-analysis of the entire field: attractive adults and children are treated better and judged better across nearly every social outcome ever measured.",
  },
  {
    title: "Looks pay. Literally.",
    body: "Economist Daniel Hamermesh's research puts the beauty premium at roughly 10–15% higher earnings across a career — a lifetime gap in the hundreds of thousands.",
  },
];

export default function StartPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [media, setMedia] = useState<FunnelMedia[]>([]);

  useEffect(() => {
    let live = true;
    void fetchFunnelMedia().then((rows) => {
      if (live) setMedia(rows);
    });
    return () => {
      live = false;
    };
  }, []);

  const chad = funnelMediaForSlot(media, "chad-reality");
  const average = funnelMediaForSlot(media, "average-reality");
  const quotes = ["quote-1", "quote-2", "quote-3"]
    .map((s) => funnelMediaForSlot(media, s))
    .filter((q): q is FunnelMedia => q !== null);

  const LAST = 6;
  const next = () => setStep((s) => Math.min(LAST, s + 1));
  // Into the existing flow: quiz first (it feeds the plan), then scan.
  const toScan = () => router.push("/quiz");

  const videoStep = (
    row: FunnelMedia | null,
    fallbackHeadline: string,
    copy: string,
    cta: string,
    onCta: () => void
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
              chad,
              "Chad's Reality",
              "He doesn't chase. He gets chosen. Numbers offered, doors opened, respect arriving before he says a single word. You think that's confidence. It's structure — plus everything trainable stacked ruthlessly on top of it.",
              "And the average man?",
              next
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
                {[...PSL_TIERS].reverse().map((t, i, arr) => {
                  const nextMin = i === 0 ? 10 : arr[i - 1].min;
                  const isTop = t.label === "True Adam" || t.label === "Chad";
                  return (
                    <div
                      key={t.label}
                      className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5"
                    >
                      <span
                        className="w-32 shrink-0 text-sm font-black uppercase tracking-wide"
                        style={{ color: isTop ? MINT : "#fff" }}
                      >
                        {t.label}
                      </span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${(t.min / 10) * 100}%`,
                            background: isTop ? MINT : "rgba(255,255,255,0.4)",
                          }}
                        />
                      </div>
                      <span className="w-16 shrink-0 text-right text-xs font-bold text-white/50">
                        {t.min === 0
                          ? "< 2.5"
                          : `${t.min.toFixed(1)}–${nextMin.toFixed(1)}`}
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
                {RESEARCH.map((r) => (
                  <div
                    key={r.title}
                    className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"
                  >
                    <p
                      className="font-display text-lg font-black"
                      style={{ color: MINT }}
                    >
                      {r.title}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-white/65">
                      {r.body}
                    </p>
                  </div>
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
