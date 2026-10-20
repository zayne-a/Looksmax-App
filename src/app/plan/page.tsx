"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useApp } from "@/lib/store";
import type { FaceMeasurements, PlanRequest, PlanResponse } from "@/lib/types";
import { Button, Card, Eyebrow, SectionHeading } from "@/components/ui";
import {
  Reveal,
  CountUp,
  ScoreDial,
  MeterBar,
  BeforeAfter,
  staggerParent,
  staggerChild,
} from "@/components/motion";

const PLAN_BEATS = [
  "Reading your measurements",
  "Scoring your ratios",
  "Finding your biggest levers",
  "Building your week-by-week protocol",
];

function impactBadge(level: "high" | "medium" | "low") {
  const cls =
    level === "high"
      ? "bg-gold/15 text-gold-soft border-gold/40"
      : level === "medium"
        ? "bg-white/5 text-bone border-white/20"
        : "bg-white/5 text-muted border-white/10";
  return (
    <span
      className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${cls}`}
    >
      {level} impact
    </span>
  );
}

function ThirdsBar({ m }: { m: FaceMeasurements }) {
  const segs = [
    { label: "Upper", v: m.facialThirds.upper },
    { label: "Mid", v: m.facialThirds.mid },
    { label: "Lower", v: m.facialThirds.lower },
  ];
  const total = segs.reduce((a, s) => a + s.v, 0) || 1;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold text-bone">Facial thirds</p>
        <p className="text-xs text-muted">ideal 1 : 1 : 1</p>
      </div>
      <div className="mt-2 flex h-3 overflow-hidden rounded-full bg-white/8">
        {segs.map((s, i) => (
          <motion.div
            key={s.label}
            className={`h-full ${
              i === 0
                ? "bg-gold-deep"
                : i === 1
                  ? "bg-gold"
                  : "bg-gold-soft"
            }`}
            initial={{ width: 0 }}
            whileInView={{ width: `${(s.v / total) * 100}%` }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{
              duration: 0.9,
              delay: 0.15 + i * 0.12,
              ease: [0.22, 1, 0.36, 1],
            }}
          />
        ))}
      </div>
      <div className="mt-2 flex justify-between text-xs text-muted">
        {segs.map((s) => (
          <span key={s.label} className="tabular-nums">
            {s.label} <span className="font-semibold text-bone/80">{s.v.toFixed(2)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function StatTile({
  label,
  children,
  sub,
}: {
  label: string;
  children: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="card-premium rounded-2xl p-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted">
        {label}
      </p>
      <div className="font-display mt-1.5 text-2xl font-extrabold text-bone tabular-nums">
        {children}
      </div>
      {sub && <p className="mt-1 text-xs text-muted/80">{sub}</p>}
    </div>
  );
}

function MeasurementsSection({ m }: { m: FaceMeasurements }) {
  return (
    <section>
      <SectionHeading
        align="left"
        eyebrow="Your readout"
        title="Your face, in numbers"
        sub="Every number below is measured geometry — the same photo always gives the same numbers."
      />
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3 space-y-6" glow>
          <MeterBar
            label="Symmetry"
            value={m.symmetryScore}
            hint="Left/right mirroring across your midline. Small asymmetries are normal — big ones are fixable with posture, chewing balance, and sleep side."
          />
          <MeterBar
            label="Golden ratio fit"
            value={m.goldenRatioScore}
            delay={0.12}
            hint="How your key proportions sit against 1.618 — mouth-to-nose, face length-to-width."
          />
          <ThirdsBar m={m} />
        </Card>
        <div className="lg:col-span-2 grid grid-cols-2 gap-4">
          <StatTile label="Face shape" sub="Your natural blueprint">
            <span className="capitalize text-gold-soft">{m.faceShape}</span>
          </StatTile>
          <StatTile label="Canthal tilt" sub="degrees · positive reads alert">
            <CountUp value={m.canthalTiltDeg} decimals={1} suffix="°" />
          </StatTile>
          <StatTile label="Jaw : cheekbone" sub="width ratio">
            <CountUp value={m.jawToCheekbone} decimals={2} />
          </StatTile>
          <StatTile label="fWHR" sub="width-to-height ratio">
            <CountUp value={m.fwhr} decimals={2} />
          </StatTile>
        </div>
      </div>

      {/* Skin readout */}
      <Card className="mt-4">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-base font-bold text-bone">Skin readout</h3>
          <p className="text-xs text-muted">lower is better</p>
        </div>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          {(
            [
              { label: "Redness", v: m.skin.redness },
              { label: "Texture", v: m.skin.texture },
              { label: "Under-eye darkness", v: m.skin.underEye },
            ] as const
          ).map((s, i) => (
            <MeterBar key={s.label} label={s.label} value={s.v} delay={i * 0.1} />
          ))}
          <div>
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-semibold text-bone">Blemish estimate</p>
              <p className="text-sm font-bold text-gold-soft tabular-nums">
                <CountUp value={m.skin.blemishCount} duration={1.1} />
              </p>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-muted">
              Estimated from visible texture variation — your skin protocol
              targets this first.
            </p>
          </div>
        </div>
      </Card>

      {m.notes.length > 0 && (
        <ul className="mt-4 space-y-1.5 text-xs leading-relaxed text-muted">
          {m.notes.map((n, i) => (
            <li key={i} className="flex gap-2">
              <span aria-hidden className="text-gold">•</span>
              {n}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function PlanPage() {
  const {
    quiz,
    measurements,
    plan,
    planLoading,
    planError,
    setPlan,
    setPlanLoading,
    setPlanError,
    frontPhoto,
  } = useApp();

  const [beatIdx, setBeatIdx] = useState(0);
  const fetchStarted = useRef(false);

  const loadPlan = useCallback(async () => {
    if (!quiz) return;
    setPlanLoading(true);
    setPlanError(null);
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          measurements,
          quiz,
        } satisfies PlanRequest),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
          text || `Plan request failed with status ${res.status}`
        );
      }
      const data = (await res.json()) as PlanResponse;
      setPlan(data.plan);
    } catch (err) {
      setPlanError(
        err instanceof Error
          ? err.message
          : "Something went wrong while building your plan."
      );
    } finally {
      setPlanLoading(false);
    }
  }, [quiz, measurements, setPlan, setPlanLoading, setPlanError]);

  useEffect(() => {
    if (!quiz || plan || planLoading || planError) return;
    if (fetchStarted.current) return;
    fetchStarted.current = true;
    void loadPlan();
  }, [quiz, plan, planLoading, planError, loadPlan]);

  // Staged beats while the plan builds.
  useEffect(() => {
    if (!planLoading) {
      setBeatIdx(0);
      return;
    }
    setBeatIdx(0);
    const id = setInterval(() => {
      setBeatIdx((i) => Math.min(i + 1, PLAN_BEATS.length - 1));
    }, 1400);
    return () => clearInterval(id);
  }, [planLoading]);

  const retry = () => {
    fetchStarted.current = false;
    void loadPlan();
  };

  if (!quiz) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 sm:px-6 text-center">
        <Reveal>
          <Eyebrow>No data yet</Eyebrow>
          <h1 className="font-display mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight">
            Your blueprint needs your answers first
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm sm:text-base text-muted">
            Take the 60-second quiz so we can build your ascend plan around
            you — your goals, your skin, your body.
          </p>
          <div className="mt-8">
            <Button href="/quiz" className="px-9 py-3.5">
              Start the quiz
            </Button>
          </div>
        </Reveal>
      </div>
    );
  }

  if (planLoading && !plan) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 sm:px-6">
        <div className="text-center">
          <div
            aria-hidden
            className="mx-auto mb-6 h-12 w-12 animate-spin rounded-full border-2 border-gold/20 border-t-gold"
          />
          <h1 className="font-display text-3xl font-extrabold tracking-tight">
            Building your blueprint…
          </h1>
          <p className="mt-2 text-sm text-muted">
            Turning your{" "}
            {measurements ? "measurements" : "quiz answers"} into a
            week-by-week protocol.
          </p>
        </div>
        <Card glow className="mt-8">
          <div className="space-y-3">
            {PLAN_BEATS.map((b, i) => (
              <div key={b} className="flex items-center gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                  {i < beatIdx ? (
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
                      <circle cx="9" cy="9" r="8" stroke="#e3b94e" strokeWidth="1.5" />
                      <path
                        d="M5.8 9.3l2.2 2.2 4.2-4.8"
                        stroke="#e3b94e"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : i === beatIdx ? (
                    <span
                      aria-hidden
                      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gold/25 border-t-gold"
                    />
                  ) : (
                    <span aria-hidden className="h-2 w-2 rounded-full bg-white/15" />
                  )}
                </span>
                <p
                  className={`text-sm font-medium ${
                    i > beatIdx ? "text-muted/50" : "text-bone"
                  }`}
                >
                  {b}
                  {i === beatIdx && <span className="text-gold">…</span>}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-6 space-y-2" aria-hidden>
            <div className="skeleton h-3 rounded-full" />
            <div className="skeleton h-3 w-4/5 rounded-full" />
            <div className="skeleton h-3 w-2/3 rounded-full" />
          </div>
        </Card>
      </div>
    );
  }

  if (planError && !plan) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 sm:px-6 text-center">
        <Reveal>
          <Eyebrow>Something failed</Eyebrow>
          <h1 className="font-display mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight">
            Couldn't build your plan
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm text-muted">{planError}</p>
          <div className="mt-8 flex justify-center gap-3">
            <Button onClick={retry}>Try again</Button>
            <Button href="/quiz" variant="ghost">
              Retake quiz
            </Button>
          </div>
        </Reveal>
      </div>
    );
  }

  if (!plan) return null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      {!measurements && (
        <Reveal className="mb-8">
          <div className="rounded-2xl border border-gold/30 bg-gold/10 p-4 sm:p-5">
            <p className="text-sm text-gold-soft">
              <span className="font-bold">No face scan yet</span> — this plan
              was built from your quiz answers only.{" "}
              <Link
                href="/scan"
                className="font-bold underline underline-offset-2 hover:text-gold"
              >
                Take a scan
              </Link>{" "}
              for a measurement-based plan.
            </p>
          </div>
        </Reveal>
      )}

      {/* HEADLINE + SCORE */}
      <div className="text-center">
        <Reveal>
          <Eyebrow>Your blueprint</Eyebrow>
          <h1 className="font-display mx-auto mt-3 max-w-2xl text-4xl sm:text-5xl font-extrabold tracking-tight leading-[1.05]">
            {plan.headline}
          </h1>
        </Reveal>
        {measurements && (
          <Reveal delay={0.12} className="mt-8">
            <ScoreDial
              value={measurements.overallScore}
              label="Measured facial score"
              sublabel="out of 100 · deterministic geometry"
            />
          </Reveal>
        )}
        <Reveal delay={0.18}>
          <p className="mx-auto mt-6 max-w-2xl text-sm sm:text-base leading-relaxed text-muted">
            {plan.scoreSummary}
          </p>
        </Reveal>
      </div>

      {/* GLOW-UP PREVIEW */}
      {frontPhoto && (
        <Reveal className="mx-auto mt-12 max-w-sm">
          <SectionHeading
            align="left"
            eyebrow="Your potential"
            title="Your glow-up preview"
            sub="Drag the divider. The right side is an illustrative enhancement of your photo — your protocol is how you get there."
          />
          <BeforeAfter
            beforeSrc={frontPhoto}
            afterSrc={frontPhoto}
            beforeLabel="Today"
            afterLabel="Potential"
            caption="Illustrative preview only — not a guaranteed result. Built from your actual scan photo."
          />
        </Reveal>
      )}

      {/* MEASUREMENTS */}
      {measurements && (
        <div className="mt-14">
          <Reveal>
            <MeasurementsSection m={measurements} />
          </Reveal>
        </div>
      )}

      {/* PRIORITY FIXES */}
      <section className="mt-14">
        <SectionHeading
          align="left"
          eyebrow="Start here"
          title="Your biggest levers"
          sub="Highest-impact changes first. Lock these in before anything else."
        />
        <motion.div
          variants={staggerParent}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
          className="grid gap-4 sm:grid-cols-2"
        >
          {plan.priorityFixes.map((f, i) => (
            <motion.div key={i} variants={staggerChild}>
              <Card className="lift h-full" glow={f.impact === "high"}>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-base font-bold text-bone">{f.title}</h3>
                  {impactBadge(f.impact)}
                </div>
                <p className="mt-2 text-sm leading-relaxed text-muted">{f.why}</p>
                <p className="mt-3 text-xs font-medium text-muted/70">
                  Effort: <span className="text-bone/80">{f.effort}</span>
                </p>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* PROTOCOL */}
      <section className="mt-14 space-y-6">
        <SectionHeading
          align="left"
          eyebrow="The work"
          title="Your protocol"
          sub="Week-by-week tasks across four pillars. Do the work, watch the numbers move."
        />
        {plan.sections.map((section, si) => (
          <Reveal key={section.id} delay={Math.min(si * 0.06, 0.2)}>
            <Card>
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-gold">
                Pillar {String(si + 1).padStart(2, "0")}
              </p>
              <h3 className="font-display mt-1.5 text-2xl font-extrabold text-bone">
                {section.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">
                {section.summary}
              </p>
              <p className="mt-3 rounded-2xl border border-gold/20 bg-gold/10 p-4 text-sm leading-relaxed text-gold-soft">
                <span className="font-bold">Why this matters for you: </span>
                {section.whyForYou}
              </p>
              <div className="mt-5 space-y-5">
                {section.weeks.map((week) => (
                  <div
                    key={week.week}
                    className="border-t border-white/10 pt-4"
                  >
                    <p className="text-sm font-bold text-bone">
                      Week {week.week} —{" "}
                      <span className="font-medium text-muted">{week.focus}</span>
                    </p>
                    <ul className="mt-3 space-y-3">
                      {week.tasks.map((task, ti) => (
                        <li key={ti} className="flex gap-3 text-sm">
                          <span
                            aria-hidden
                            className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gold shadow-[0_0_8px_rgba(227,185,78,0.7)]"
                          />
                          <div>
                            <p className="font-semibold text-bone">
                              {task.title}{" "}
                              <span className="ml-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs font-medium text-muted">
                                {task.frequency}
                              </span>
                            </p>
                            <p className="mt-0.5 leading-relaxed text-muted">
                              {task.detail}
                            </p>
                            {task.whyYou && (
                              <p className="mt-1.5 text-xs leading-relaxed text-muted/70">
                                <span className="font-semibold text-gold/80">
                                  Why you:{" "}
                                </span>
                                {task.whyYou}
                              </p>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </Card>
          </Reveal>
        ))}
      </section>

      {/* DISCLAIMERS + CTA */}
      <Reveal className="mt-12">
        <footer className="card-premium rounded-3xl p-6 sm:p-8">
          <p className="font-display text-lg font-extrabold text-bone">
            Keep climbing
          </p>
          <ul className="mt-3 space-y-1.5 text-xs leading-relaxed text-muted">
            {plan.disclaimers.map((d, i) => (
              <li key={i} className="flex gap-2">
                <span aria-hidden className="text-gold">•</span>
                {d}
              </li>
            ))}
            <li className="flex gap-2">
              <span aria-hidden className="text-gold">•</span>
              Not medical advice. For aesthetic guidance only.
            </li>
          </ul>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button href="/scan" variant="ghost" className="px-6 py-3 text-sm">
              {measurements ? "Rescan my face" : "Add a face scan"}
            </Button>
            <Button href="/paywall" className="px-6 py-3 text-sm">
              Unlock your full plan
            </Button>
          </div>
        </footer>
      </Reveal>
    </div>
  );
}
