import Link from "next/link";
import Image from "next/image";
import { Button, Card, Eyebrow, SectionHeading } from "@/components/ui";
import {
  Reveal,
  Float,
  FaqAccordion,
  ScanFrame,
  StaggerGroup,
  StaggerItem,
} from "@/components/motion";
import { IMAGES } from "@/lib/images";
import { getAppSettings } from "@/lib/settings";

// The trial length in the FAQ + pricing copy below is the owner's
// trial_days app setting (/admin/settings) — rendered per-request
// so a panel change rewrites this page without a deploy.
export const instant = false;

const steps = [
  {
    n: "01",
    title: "Scan",
    text: "Upload a clear, front-facing selfie. Your photo is measured on your device — never stored in a gallery, never used to train models.",
  },
  {
    n: "02",
    title: "Measure",
    text: "478 facial landmarks become real ratios: symmetry, facial thirds, canthal tilt, jaw-to-cheekbone. Numbers, not vibes.",
  },
  {
    n: "03",
    title: "Ascend",
    text: "Get your structured week-by-week protocol for skin, diet, exercise, and style — built around your measurements and your goals.",
  },
];

const differentiators = [
  {
    title: "Measured, not guessed",
    text: "Your score comes from deterministic geometry — symmetry, thirds, ratios. Never an AI's mood about your photo.",
  },
  {
    title: "Unlimited rescans",
    text: "Check in as often as you like. One flat weekly price — no per-scan credits, no pay-per-rating traps.",
  },
  {
    title: "Real week-by-week protocols",
    text: "Skin, diet, exercise, and style broken into tasks with frequencies — mewing and debloat protocols included, with honest expectations — not a generic list of tips.",
  },
  {
    title: "Progress you can prove",
    text: "Rescan and compare your measurements side by side. Watch the numbers move as you lock in.",
  },
  {
    title: "Private by design",
    text: "Measurement runs 100% on your device. Your photo never leaves this browser for analysis.",
  },
  {
    title: "A coach with memory",
    text: "Your plan remembers your measurements, your focus areas, and your last check-in — and picks up where you left off.",
  },
  {
    title: "Free toolbox",
    text: "BMI, body-fat, FFMI, and calorie calculators — free forever, no account required.",
  },
  {
    title: "Shareable scorecard",
    text: "A clean scorecard you can screenshot when your number climbs. Earned, not given.",
  },
];

function faqsFor(trialDays: number) {
  return [
  {
    q: "How does the facial measurement actually work?",
    a: "On your device, a face model detects 478 facial landmarks on your photo and computes real geometric ratios — symmetry, facial thirds, canthal tilt, jaw-to-cheekbone width. The same photo always produces the same numbers. What it can't do is fix a bad photo: poor lighting or a tilted angle shows up as a low-confidence scan, and we'll tell you to retake it so your baseline is honest.",
  },
  {
    q: "Is my photo private?",
    a: "Yes. Your photo is processed in your browser to extract measurements, then discarded. It is never stored in a gallery, never sold, and never used to train models.",
  },
  {
    q: "Do I pay to see my results?",
    a: `No. Your first scan — real measurements and your core score — is completely free, no card required. Mewmax Pro starts your 12-week adaptive protocol: Phase 1 in full, weekly check-ins and progress scans, Phases 2–3 generated from your progress, and a weekly coach review. ${trialDays > 0 ? `Monthly and Yearly start with a ${trialDays}-day free trial; Weekly bills from day one.` : "There is no free trial — every plan bills from day one, and you can cancel anytime."}`,
  },
  {
    q: "What is softmaxxing?",
    a: "Softmaxxing is the discipline of maximizing your appearance through non-surgical levers: skin, body composition, hairstyle, grooming, posture, tongue posture (mewing), and style. Mewmax turns that loose internet concept into measured ratios and a structured protocol you can actually follow.",
  },
  {
    q: "Can this replace a doctor or dermatologist?",
    a: "No — and it doesn't pretend to. Mewmax is aesthetic guidance, not medical advice. If you have persistent skin conditions, hair loss, or any health concern, see a qualified professional. Nothing here is a diagnosis.",
  },
  {
    q: "How is Mewmax different from rating apps?",
    a: "Rating apps hand you a number and upsell you on credits. Mewmax hands you measured geometry, unlimited rescans, and a structured plan that tells you exactly what to do this week — for half the weekly price.",
  },
  ];
}

function TrustItem({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex items-start gap-3 text-left">
      <span
        aria-hidden
        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gold/40 bg-gold/10"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path
            d="M2.5 7.2l3 3 6-6.4"
            stroke="#e3b94e"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <div>
        <p className="text-sm font-bold text-bone">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted">{text}</p>
      </div>
    </div>
  );
}

export default async function Home() {
  const { trial_days: trialDays } = await getAppSettings();
  const faqs = faqsFor(trialDays);
  return (
    <div className="bg-ink text-bone">
      {/* ================= HERO ================= */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_50%_-5%,rgba(227,185,78,0.16),transparent)]"
        />
        <div className="relative mx-auto max-w-6xl px-4 pt-14 pb-10 sm:px-6 sm:pt-20">
          <div className="mx-auto max-w-3xl text-center">
            <Reveal>
              <Eyebrow>AI looksmaxxing · measured, not guessed</Eyebrow>
            </Reveal>
            <Reveal delay={0.08}>
              <h1 className="font-display mt-5 text-[2.75rem] sm:text-7xl font-extrabold tracking-tight leading-[1.02]">
                Your most attractive self,
                <br />
                <span className="gold-text">measured.</span>
              </h1>
            </Reveal>
            <Reveal delay={0.16}>
              <p className="mx-auto mt-6 max-w-xl text-base sm:text-lg leading-relaxed text-muted">
                Upload a selfie and get deterministic facial measurements —
                real ratios like symmetry, thirds, and jaw-to-cheekbone — plus
                a week-by-week plan for skin, diet, exercise, and style that
                tells you exactly what to do next.
              </p>
            </Reveal>
            <Reveal delay={0.24}>
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Button
                  href="/start"
                  className="w-full sm:w-auto px-9 py-4 text-base"
                >
                  Start your free scan
                </Button>
                <Button
                  href="/#how-it-works"
                  variant="ghost"
                  className="w-full sm:w-auto px-9 py-4 text-base"
                >
                  See how it works
                </Button>
              </div>
              <p className="mt-5 text-[13px] font-medium tracking-wide text-muted">
                Free first scan · No card required · 60 seconds
              </p>
            </Reveal>
          </div>

          {/* Phone-style scan mock */}
          <Reveal delay={0.3} className="mx-auto mt-12 max-w-[340px] sm:max-w-[380px]">
            <div className="relative">
              <div
                aria-hidden
                className="absolute -inset-6 rounded-[2.5rem] bg-gold/10 blur-3xl"
              />
              <div className="noise relative rounded-[2rem] border border-gold/25 bg-ink-2 p-3 shadow-[0_30px_80px_-30px_rgba(227,185,78,0.35)]">
                <ScanFrame
                  src={IMAGES.hero}
                  alt="Mewmax face scan preview"
                  scanning
                  className="aspect-[3/4]"
                />
                {/* floating readout chips */}
                <Float
                  className="absolute -left-4 top-16 sm:-left-10"
                  duration={5}
                >
                  <div className="rounded-2xl border border-gold/30 bg-ink/85 px-4 py-2.5 backdrop-blur-md">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">
                      Symmetry
                    </p>
                    <p className="font-display text-xl font-extrabold text-gold-soft">
                      94.2
                    </p>
                  </div>
                </Float>
                <Float
                  className="absolute -right-4 top-40 sm:-right-10"
                  duration={6}
                  delay={0.8}
                >
                  <div className="rounded-2xl border border-gold/30 bg-ink/85 px-4 py-2.5 backdrop-blur-md">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">
                      Harmony
                    </p>
                    <p className="font-display text-xl font-extrabold text-gold-soft">
                      91.7
                    </p>
                  </div>
                </Float>
                <Float
                  className="absolute -left-3 bottom-24 sm:-left-8"
                  duration={5.5}
                  delay={1.6}
                >
                  <div className="rounded-2xl border border-gold bg-gold px-4 py-2.5 shadow-[0_0_24px_rgba(227,185,78,0.6)]">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink/70">
                      Your score
                    </p>
                    <p className="font-display text-2xl font-extrabold text-ink">
                      88<span className="text-sm font-bold">/100</span>
                    </p>
                  </div>
                </Float>
                <div className="flex items-center justify-center gap-2 px-2 pb-2 pt-4">
                  <span className="pulse-dot h-2 w-2 rounded-full bg-gold" />
                  <p className="text-xs font-semibold tracking-wide text-muted">
                    Live on-device measurement
                  </p>
                </div>
              </div>
            </div>
          </Reveal>

          {/* Trust strip */}
          <Reveal delay={0.15} className="mx-auto mt-14 max-w-4xl">
            <div className="grid gap-6 sm:grid-cols-3">
              <TrustItem
                title="On-device analysis"
                text="Your photo never leaves this browser for measurement."
              />
              <TrustItem
                title="Deterministic geometry"
                text="Same photo, same numbers. Every single time."
              />
              <TrustItem
                title="A plan, not a rating"
                text="Week-by-week tasks across skin, diet, exercise, style."
              />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ================= THE LOOPHOLES =================
          Competitor-gap section (Zayne, 2026-10-20): name the traps found
          in Umax & the other rating apps — sourced from their own 1-star
          reviews and store listings (see research_notes/
          looksmax-app-store-reviews-gaps-20261020-0015) — and contrast
          each with the Ascend policy. Sits before the quiz so users see
          it before they start. Keep claims truthful to the research. */}
      <section className="border-y border-gold/10 bg-ink-2">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <SectionHeading
            eyebrow="The loopholes"
            title="Every rating app has a trap. We removed all of them."
            sub="We read hundreds of 1-star reviews of Umax and the other rating apps. The same traps, over and over — so we built Mewmax the opposite way. Your first scan proves it, free."
          />
          <div className="grid gap-4 lg:grid-cols-2">
            <Reveal>
              <Card className="h-full">
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-muted">
                  Umax &amp; the rating apps
                </p>
                <ul className="mt-5 space-y-4">
                  {[
                    ["Pay — or invite 3 friends —", "before you see a single result. It's their #1 complaint, straight from their own 1-star reviews."],
                    ["Every scan costs extra.", "Credits, scan packs, and “supercharge” upsells — even after you've already subscribed."],
                    ["Card before rating.", "They want your payment details before they've shown you one number."],
                    ["Generic advice.", "“Wash your face with water” — handed to people with 10-step routines."],
                    ["Your selfies, uploaded.", "Stored on their servers. One leading app's own store listing admits your data “isn't encrypted.”"],
                    ["Trial traps.", "Subscriptions their users say they can't cancel — renewing anyway."],
                  ].map(([lead, text]) => (
                    <li key={lead} className="flex items-start gap-3 text-sm">
                      <span
                        aria-hidden
                        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-red-400/30 bg-red-400/10 text-[11px] font-black text-red-300"
                      >
                        ✕
                      </span>
                      <span className="leading-relaxed text-muted">
                        <strong className="font-bold text-bone/90">{lead}</strong>{" "}
                        {text}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            </Reveal>
            <Reveal delay={0.08}>
              <Card glow className="h-full border-gold/50">
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-gold">
                  Mewmax — the way out
                </p>
                <ul className="mt-5 space-y-4">
                  {[
                    ["Your full first scan is free.", "Real measurements and scores before any paywall. No card. No invites."],
                    ["Unlimited scans.", "Rescan every week of your protocol and watch the numbers move. One flat price — no per-scan charges, ever."],
                    ["One plan = the whole journey.", "No stacked upsells, no second paywall for your “true potential” — every phase, check-in and review is in the one plan."],
                    ["A protocol built from your numbers.", "Your jaw ratio, your skin signals, your goals — sequenced week by week, not copied from a poster."],
                    ["Measured on your phone.", "Your photo never leaves your device for measurement. Nothing to leak, sell, or train on."],
                    ["Cancel in one tap.", trialDays > 0 ? "Leave during the trial and you pay nothing. No maze, no begging support." : "Cancel stops future billing instantly. No maze, no begging support."],
                  ].map(([lead, text]) => (
                    <li key={lead} className="flex items-start gap-3 text-sm">
                      <svg
                        aria-hidden
                        className="mt-0.5 h-5 w-5 shrink-0 text-gold"
                        viewBox="0 0 20 20"
                        fill="none"
                      >
                        <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5" />
                        <path
                          d="M6.5 10.2l2.4 2.4 4.6-5"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <span className="leading-relaxed text-muted">
                        <strong className="font-bold text-bone">{lead}</strong>{" "}
                        {text}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            </Reveal>
          </div>
          <Reveal className="mt-8 text-center">
            <Button href="/start" className="px-9 py-3.5">
              Get my free scan
            </Button>
            <p className="mt-3 text-xs text-muted">
              No card · No invites · Unlimited scans on Pro
            </p>
          </Reveal>
        </div>
      </section>

      {/* ================= HOW IT WORKS ================= */}
      <section
        id="how-it-works"
        className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24"
      >
        <SectionHeading
          eyebrow="How it works"
          title="Three steps. Zero guesswork."
          sub="From selfie to structured plan in about a minute."
        />
        <StaggerGroup className="grid gap-4 sm:grid-cols-3">
          {steps.map((s) => (
            <StaggerItem key={s.n}>
              <Card className="lift h-full">
                <p className="gold-text font-display text-4xl font-extrabold">
                  {s.n}
                </p>
                <h3 className="font-display mt-3 text-xl font-bold text-bone">
                  {s.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  {s.text}
                </p>
              </Card>
            </StaggerItem>
          ))}
        </StaggerGroup>
        <Reveal className="mt-8 text-center">
          <Button href="/start" className="px-9 py-3.5">
            Let's go — start the quiz
          </Button>
        </Reveal>
      </section>

      {/* ================= IMAGE BAND ================= */}
      <section className="border-y border-gold/10 bg-ink-2">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <SectionHeading
            eyebrow="The protocol"
            title="Look better from every angle"
            sub="Your plan attacks the four pillars that actually move the needle."
          />
          <div className="grid gap-5 md:grid-cols-2">
            <Reveal>
              <div className="group relative overflow-hidden rounded-3xl border border-gold/15">
                <div className="relative aspect-[16/10]">
                  <Image
                    src={IMAGES.skincare}
                    alt="Skincare routine for clear, photogenic skin"
                    fill
                    className="object-cover transition duration-700 group-hover:scale-[1.03]"
                    sizes="(max-width: 768px) 100vw, 50vw"
                  />
                  <div
                    aria-hidden
                    className="absolute inset-0 bg-gradient-to-t from-ink via-ink/35 to-transparent"
                  />
                </div>
                <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
                  <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-gold">
                    Pillar 01 — Skin
                  </p>
                  <h3 className="font-display mt-2 text-2xl font-extrabold text-bone">
                    Skin that photographs well
                  </h3>
                  <p className="mt-2 max-w-md text-sm leading-relaxed text-bone/70">
                    A routine matched to your skin type and concerns —
                    redness, texture, and under-eyes handled in order of
                    impact.
                  </p>
                </div>
              </div>
            </Reveal>
            <Reveal delay={0.12}>
              <div className="group relative overflow-hidden rounded-3xl border border-gold/15">
                <div className="relative aspect-[16/10]">
                  <Image
                    src={IMAGES.fitness}
                    alt="Training for a leaner, sharper facial structure"
                    fill
                    className="object-cover transition duration-700 group-hover:scale-[1.03]"
                    sizes="(max-width: 768px) 100vw, 50vw"
                  />
                  <div
                    aria-hidden
                    className="absolute inset-0 bg-gradient-to-t from-ink via-ink/35 to-transparent"
                  />
                </div>
                <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
                  <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-gold">
                    Pillar 02 — Body
                  </p>
                  <h3 className="font-display mt-2 text-2xl font-extrabold text-bone">
                    A frame that sharpens your face
                  </h3>
                  <p className="mt-2 max-w-md text-sm leading-relaxed text-bone/70">
                    Cut, maintain, or build — calorie and training targets
                    tuned to your body, so leanness shows where it counts.
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ================= WHY ASCEND ================= */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <SectionHeading
          eyebrow="Why Mewmax"
          title="Built differently, on purpose"
          sub="Eight reasons this isn't another rating app."
        />
        <StaggerGroup className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {differentiators.map((d) => (
            <StaggerItem key={d.title}>
              <Card className="lift h-full">
                <h3 className="text-[15px] font-bold text-gold-soft">
                  {d.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  {d.text}
                </p>
              </Card>
            </StaggerItem>
          ))}
        </StaggerGroup>
      </section>

      {/* ================= PRICING TEASER ================= */}
      <section className="border-y border-gold/10 bg-ink-2">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24 text-center">
          <Reveal>
            <Eyebrow>Pricing</Eyebrow>
            <p className="font-display mt-4 text-6xl sm:text-7xl font-extrabold tracking-tight">
              <span className="gold-text">$1.99</span>
              <span className="text-2xl font-bold text-muted">/week</span>
            </p>
            <p className="mx-auto mt-4 max-w-xl text-sm sm:text-base leading-relaxed text-muted">
              Half the price of the rating apps.{" "}
              {trialDays > 0
                ? `Monthly and Yearly start with a ${trialDays}-day free trial — and your first scan is free forever, no card required.`
                : "No free trial, no lock-in — cancel anytime, and your first scan is free forever, no card required."}
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button href="/paywall" className="w-full sm:w-auto px-9 py-3.5">
                See plans
              </Button>
              <Button
                href="/start"
                variant="ghost"
                className="w-full sm:w-auto px-9 py-3.5"
              >
                Scan free first
              </Button>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ================= FAQ ================= */}
      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
        <SectionHeading eyebrow="FAQ" title="Straight answers" />
        <Reveal>
          <FaqAccordion items={faqs} />
        </Reveal>
      </section>

      {/* ================= FINAL CTA ================= */}
      <section className="relative overflow-hidden border-t border-gold/10">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_65%_70%_at_50%_110%,rgba(227,185,78,0.14),transparent)]"
        />
        <div className="relative mx-auto max-w-3xl px-4 py-20 sm:px-6 sm:py-28 text-center">
          <Reveal>
            <h2 className="font-display text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.05]">
              Stop guessing.
              <br />
              <span className="gold-text">Start ascending.</span>
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-base sm:text-lg text-muted">
              Free scan. No card. A plan you can start tonight — built on your
              actual measurements.
            </p>
            <div className="mt-9">
              <Button href="/start" className="px-12 py-4 text-base">
                Start your free scan
              </Button>
            </div>
            <p className="mt-5 text-sm text-muted">
              <Link
                href="/paywall"
                className="font-semibold text-gold hover:text-gold-soft transition"
              >
                Or compare plans first
              </Link>
            </p>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
