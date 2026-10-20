"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useApp } from "@/lib/store";
import { isOwnerTestMode, setOwnerTestMode } from "@/lib/admin";
import { getSupabase } from "@/lib/supabase";
import { savePlan } from "@/lib/account";
import type {
  AscendPlan,
  FaceMeasurements,
  PlanFoundations,
  PlanRequest,
  PlanResponse,
  PlanSection,
  PlanTask,
  PlanWeek,
} from "@/lib/types";
import { Button, Card, Eyebrow, ProgressBar, SectionHeading } from "@/components/ui";
import {
  Reveal,
  CountUp,
  ScoreDial,
  MeterBar,
  BeforeAfter,
  ScanFrame,
  staggerParent,
  staggerChild,
} from "@/components/motion";

/* ------------------------------------------------------------------ */
/* Building sequence (waiting experience)                              */
/* ------------------------------------------------------------------ */

const BUILD_STAGES = [
  "Studying your photos",
  "Measuring facial proportions",
  "Analysing your skin signals",
  "Matching protocols to your goals",
  "Organising your plan",
  "Structuring your weeks",
  "Finalising your Ascend plan",
];

const REASSURANCE_LINES = [
  "Personalising — not templating",
  "Checking every step against your goals",
  "Every step cites your scan and your goals",
];

/** Rotating popup cards for the wait: what the AI is doing right now,
 *  plus protocol facts worth reading. A long premium wait should feel
 *  alive — never a frozen spinner. */
const WAIT_CARDS = [
  {
    kicker: "Deep curation",
    title: "Every task is audited against your numbers",
    body: "A step that could belong to anyone gets rewritten until it cites your scan, your goals, your stats — or it gets cut.",
  },
  {
    kicker: "Skin protocol",
    title: "SPF is the highest-ROI step you own",
    body: "Two finger-lengths, every morning. Brighteners and actives only work on top of sun protection — never instead of it.",
  },
  {
    kicker: "Your numbers",
    title: "Calories and protein computed from your body",
    body: "Maintenance kcal from your height, weight and age; protein from your bodyweight. No template ranges anywhere in your plan.",
  },
  {
    kicker: "Foundations",
    title: "Sleep is a training session",
    body: "Growth hormone peaks in deep sleep. Your plan treats sleep, water and daily steps as non-negotiables — they compound everything else.",
  },
  {
    kicker: "The Ascend way",
    title: "Phase 1 of a 12-week protocol",
    body: "No 30-day miracle promises. Four weeks of measurable checkpoints, then progression — that's how real change is built.",
  },
  {
    kicker: "Style protocol",
    title: "Your haircut is chosen from your face shape",
    body: "Measured thirds, ratios and symmetry decide the cut and the fit formulas — not trends.",
  },
];

/** The build sequence never flashes: results wait at least this long. */
const MIN_BUILD_MS = 4000;
/**
 * Stage cadence while waiting. The free preview targets ~20s end-to-end, so
 * the stage list is paced to span ~18s (7 stages × 3s) before holding on the
 * final stage at ~92% with the reassurance lines until the plan lands.
 */
const STAGE_MS = 3000;

/* ------------------------------------------------------------------ */
/* Teaser gate                                                         */
/* ------------------------------------------------------------------ */

/** Tasks per protocol section shown free; everything past this is locked. */
const FREE_TASKS_PER_SECTION = 3;

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

/* ------------------------------------------------------------------ */
/* Building screen: the staged wait while /api/plan generates          */
/* ------------------------------------------------------------------ */

function StageRow({
  label,
  state,
}: {
  label: string;
  state: "done" | "active" | "pending";
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center">
        {state === "done" ? (
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
        ) : state === "active" ? (
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
          state === "pending" ? "text-muted/50" : "text-bone"
        }`}
      >
        {label}
        {state === "active" && <span className="text-gold">…</span>}
      </p>
    </div>
  );
}

function BuildingScreen({
  progress,
  stageIdx,
  microIdx,
  frontPhoto,
  measurements,
  elapsedMs,
  onSkip,
}: {
  progress: number;
  stageIdx: number;
  microIdx: number;
  frontPhoto: string | null;
  measurements: FaceMeasurements | null;
  elapsedMs: number;
  onSkip: () => void;
}) {
  const allDone = stageIdx >= BUILD_STAGES.length;
  const onLastStage = stageIdx >= BUILD_STAGES.length - 1;
  const cardIdx = Math.floor(elapsedMs / 6000) % WAIT_CARDS.length;
  const card = WAIT_CARDS[cardIdx];
  return (
    <div className="mx-auto flex min-h-[74vh] w-full max-w-xl flex-col items-center justify-center px-4 py-14 sm:px-6">
      {frontPhoto ? (
        <ScanFrame
          src={frontPhoto}
          alt="Your scan photo"
          scanning
          className="aspect-[3/4] w-32 sm:w-36"
        />
      ) : measurements ? (
        <ScoreDial
          value={measurements.overallScore}
          size={128}
          label="Your measured score"
        />
      ) : (
        <div
          aria-hidden
          className="flex h-28 w-28 items-center justify-center rounded-full border border-gold/40 bg-gold/10 shadow-[0_0_40px_-8px_rgba(227,185,78,0.55)]"
        >
          <span className="font-display gold-text text-5xl font-extrabold">A</span>
        </div>
      )}

      <div className="mt-8 text-center">
        <Eyebrow>Building your plan</Eyebrow>
        <p
          className="font-display gold-text mt-3 text-6xl font-extrabold tabular-nums sm:text-7xl"
          role="status"
          aria-label={`Building your plan, ${Math.floor(progress)} percent complete`}
        >
          {Math.floor(progress)}%
        </p>
      </div>

      <ProgressBar percent={progress} className="mt-5 w-full max-w-sm" />

      <div className="mt-3 flex h-5 items-center justify-center text-center">
        {progress >= 100 ? (
          <p className="text-sm font-semibold text-gold-soft">Your plan is ready</p>
        ) : onLastStage ? (
          <AnimatePresence mode="wait">
            <motion.p
              key={microIdx}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.3 }}
              className="text-sm text-muted"
            >
              {REASSURANCE_LINES[microIdx % REASSURANCE_LINES.length]}
            </motion.p>
          </AnimatePresence>
        ) : (
          <p className="text-sm text-muted">
            Turning your {measurements ? "measurements" : "quiz answers"} into
            a week-by-week protocol.
          </p>
        )}
      </div>

      <Card glow className="mt-7 w-full">
        <div className="space-y-3">
          {BUILD_STAGES.map((s, i) => (
            <StageRow
              key={s}
              label={s}
              state={
                allDone || i < stageIdx
                  ? "done"
                  : i === stageIdx
                    ? "active"
                    : "pending"
              }
            />
          ))}
        </div>
      </Card>

      <div className="mt-6 w-full max-w-sm">
        <AnimatePresence mode="wait">
          <motion.div
            key={cardIdx}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.35 }}
            className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left"
          >
            <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-gold">
              {card.kicker}
            </p>
            <p className="mt-1.5 font-display text-base font-extrabold text-bone">
              {card.title}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              {card.body}
            </p>
          </motion.div>
        </AnimatePresence>
        <div className="mt-3 flex justify-center gap-1.5">
          {WAIT_CARDS.map((c, i) => (
            <span
              key={c.kicker}
              className={`h-1.5 rounded-full transition-all ${
                i === cardIdx ? "w-5 bg-gold" : "w-1.5 bg-white/15"
              }`}
            />
          ))}
        </div>
      </div>

      <p className="mt-6 text-center text-xs leading-relaxed text-muted">
        {elapsedMs > 90_000
          ? "Still crafting — the AI is under heavy demand right now. Open your full protocol below and let the deep version finish in the background."
          : elapsedMs > 45_000
            ? "Taking longer than usual — premium curation is the deep version, and it's worth the wait."
            : "Built from your numbers and your goals — never a generic template."}
      </p>
      {elapsedMs > 40_000 && !allDone && (
        <button
          onClick={onSkip}
          className="mt-4 rounded-full border border-gold/50 bg-gold/10 px-6 py-2.5 text-sm font-bold text-gold-soft transition hover:bg-gold/20"
        >
          Show my full plan now
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Protocol rendering + teaser gate                                    */
/*                                                                     */
/* v1: this gate is PRESENTATIONAL ONLY — there is no auth yet, so     */
/* locked weeks are blurred client-side while their content still      */
/* ships in the plan payload. v2: replace FREE_TASKS_PER_SECTION       */
/* gating with a real entitlement check (active subscription derived   */
/* server-side) and stop sending locked task content to                */
/* non-subscribers at all.                                             */
/* ------------------------------------------------------------------ */

function LockIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <rect
        x="5"
        y="10.5"
        width="14"
        height="9.5"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M8 10.5V8a4 4 0 0 1 8 0v2.5"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="15.25" r="1.4" fill="currentColor" />
    </svg>
  );
}

function TaskItem({
  task,
  premium = false,
}: {
  task: PlanTask;
  premium?: boolean;
}) {
  return (
    <li
      className={`flex gap-3 rounded-2xl border p-3.5 ${
        premium
          ? "border-gold/25 bg-gold/[0.06]"
          : "border-white/10 bg-white/[0.02]"
      }`}
    >
      <span
        aria-hidden
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
          premium ? "border-gold/70 bg-gold/15" : "border-white/25 bg-white/5"
        }`}
      >
        {premium && (
          <span className="h-1.5 w-1.5 rounded-full bg-gold shadow-[0_0_6px_rgba(227,185,78,0.8)]" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <p className="font-semibold leading-snug text-bone">{task.title}</p>
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-semibold text-muted">
            {task.frequency}
          </span>
        </div>
        <p className="mt-1 text-sm leading-relaxed text-muted">{task.detail}</p>
        {task.whyYou && (
          <p className="mt-1.5 text-xs leading-relaxed text-muted/70">
            <span className="font-semibold text-gold/80">Why you: </span>
            {task.whyYou}
          </p>
        )}
      </div>
    </li>
  );
}

/** Phase names for the week timeline — plans are written to progress
 *  introduce → build → intensify → consolidate across the 4 weeks. */
const PHASE_NAMES = ["", "Introduce", "Build", "Intensify", "Consolidate"];

function WeekBlock({
  week,
  premium = false,
  last = false,
}: {
  week: PlanWeek;
  premium?: boolean;
  last?: boolean;
}) {
  return (
    <div className="flex gap-3.5">
      <div className="flex flex-col items-center" aria-hidden>
        <span className="font-display flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gold/40 bg-gold/10 text-[13px] font-extrabold text-gold-soft">
          {week.week}
        </span>
        {!last && (
          <span className="mt-1.5 w-px flex-1 bg-gradient-to-b from-gold/35 via-white/10 to-transparent" />
        )}
      </div>
      <div className={`min-w-0 flex-1 ${last ? "" : "pb-6"}`}>
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
          <p className="text-sm font-bold text-bone">Week {week.week}</p>
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold">
            {PHASE_NAMES[week.week] ?? "Phase"}
          </span>
        </div>
        <p className="mt-0.5 text-sm font-medium leading-snug text-muted">
          {week.focus}
        </p>
        <ul className="mt-3 space-y-2.5">
          {week.tasks.map((task, ti) => (
            <TaskItem key={ti} task={task} premium={premium} />
          ))}
        </ul>
      </div>
    </div>
  );
}

function sectionTaskCount(section: PlanSection): number {
  return section.weeks.reduce((n, w) => n + w.tasks.length, 0);
}

/** Split a section into the free preview (first N tasks, earliest weeks
 *  first) and the locked remainder. */
function splitSection(section: PlanSection): {
  visible: PlanWeek[];
  locked: PlanWeek[];
} {
  let budget = FREE_TASKS_PER_SECTION;
  const visible: PlanWeek[] = [];
  const locked: PlanWeek[] = [];
  for (const week of section.weeks) {
    if (budget <= 0) {
      locked.push(week);
      continue;
    }
    const shown = week.tasks.slice(0, budget);
    const rest = week.tasks.slice(budget);
    budget -= shown.length;
    if (shown.length > 0) visible.push({ ...week, tasks: shown });
    if (rest.length > 0) locked.push({ ...week, tasks: rest });
  }
  return { visible, locked };
}

function LockedWeeks({ weeks }: { weeks: PlanWeek[] }) {
  return (
    <div className="relative mt-5 overflow-hidden rounded-2xl border border-white/10">
      {/* Veil, not wall: the locked weeks render FULL-SIZE at their real
          layout and length — the complete protocol visibly exists behind
          the blur; only readability is gated. */}
      <div
        aria-hidden="true"
        className="pointer-events-none select-none blur-[6px]"
      >
        <div className="space-y-5 p-4 sm:p-5">
          {weeks.map((week, wi) => (
            <WeekBlock key={week.week} week={week} last={wi === weeks.length - 1} />
          ))}
        </div>
      </div>
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-b from-transparent via-ink/20 to-ink/75"
      />
      <div className="absolute inset-x-0 bottom-3 flex justify-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-ink/85 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-gold-soft backdrop-blur">
          <LockIcon />
          Locked
        </span>
      </div>
    </div>
  );
}

function UnlockCard({ total }: { total: number }) {
  return (
    <div className="mt-6">
      <Card glow className="text-center">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-gold/40 bg-gold/10 text-gold">
          <LockIcon className="h-5 w-5" />
        </div>
        <h3 className="font-display mt-4 text-2xl font-extrabold text-bone">
          Your full protocol is ready
        </h3>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
          You&rsquo;re seeing {FREE_TASKS_PER_SECTION} of your {total}{" "}
          personalised steps. Every step is already built from your photos
          and answers — unlock to see it all, plus progress re-scans that
          re-measure you as you improve.
        </p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-gold-soft">
          Subscribers also get the deep-curated plan: your blueprint
          regenerated with our full curation pass — deeper, tighter, and
          checked step-by-step against your goals.
        </p>
        <div className="mt-5">
          <Button href="/paywall" className="px-8 py-3.5">
            Unlock my protocol
          </Button>
        </div>
        <p className="mt-3 text-xs text-muted">
          3-day free trial on Monthly &amp; Yearly · Cancel anytime
        </p>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Projection — the temptation hook. Free, fully visible, lands       */
/* right after the measurements; its numbers count up on reveal.      */
/* ------------------------------------------------------------------ */

/** Renders an outcome line with its first number counting up. */
function OutcomeText({ text }: { text: string }) {
  const m = text.match(/^(.*?)(\d+(?:\.\d+)?)([\s\S]*)$/);
  if (!m || !m[2]) return <>{text}</>;
  const value = Number(m[2]);
  if (!Number.isFinite(value)) return <>{text}</>;
  const decimals = m[2].includes(".") ? (m[2].split(".")[1] ?? "").length : 0;
  return (
    <>
      {m[1]}
      <CountUp
        value={value}
        decimals={decimals}
        duration={1.6}
        className="font-bold text-gold-soft"
      />
      {m[3]}
    </>
  );
}

function ProjectionSection({ plan }: { plan: AscendPlan }) {
  const p = plan.projection;
  return (
    <section>
      <div className="mb-8 max-w-2xl sm:mb-10">
        <Eyebrow>Your projection</Eyebrow>
        <h2 className="font-display mt-3 text-3xl font-extrabold leading-[1.08] tracking-tight text-bone sm:text-[2.6rem]">
          Your{" "}
          <CountUp
            value={p.horizonWeeks}
            duration={1.2}
            className="gold-text"
          />{" "}
          weeks: what&rsquo;s realistically achievable
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted sm:text-base">
          Computed from your numbers — your calorie target, your skin
          readings, your timeline. Not a promise. A trajectory.
        </p>
      </div>
      <Card glow>
        <motion.ul
          variants={staggerParent}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
          className="space-y-3.5"
        >
          {p.outcomes.map((o, i) => (
            <motion.li key={i} variants={staggerChild} className="flex gap-3">
              <svg
                width="18"
                height="18"
                viewBox="0 0 18 18"
                fill="none"
                aria-hidden
                className="mt-0.5 shrink-0"
              >
                <circle cx="9" cy="9" r="8" stroke="#e3b94e" strokeWidth="1.5" />
                <path
                  d="M5.8 9.3l2.2 2.2 4.2-4.8"
                  stroke="#e3b94e"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <p className="text-[15px] leading-relaxed text-bone/90">
                <OutcomeText text={o} />
              </p>
            </motion.li>
          ))}
        </motion.ul>
        <p className="mt-5 border-t border-white/10 pt-4 text-sm leading-relaxed text-muted">
          {p.note}
        </p>
      </Card>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Foundations — the deterministic vitals layer. FULLY visible to     */
/* everyone (universal value + trust); the numbers are the user's.    */
/* ------------------------------------------------------------------ */

function VitalRow({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <svg
        width="15"
        height="15"
        viewBox="0 0 18 18"
        fill="none"
        aria-hidden
        className="mt-1 shrink-0"
      >
        <path
          d="M3 9.5l3.8 3.8L15 5"
          stroke="#e3b94e"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="text-sm leading-relaxed text-bone/85">{children}</span>
    </li>
  );
}

function VitalCard({
  label,
  headline,
  children,
}: {
  label: string;
  headline: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="h-full">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted">
        {label}
      </p>
      <div className="font-display mt-1.5 text-[1.35rem] font-extrabold leading-snug text-bone">
        {headline}
      </div>
      <div className="mt-3">{children}</div>
    </Card>
  );
}

function FoundationsSection({ f }: { f: PlanFoundations }) {
  return (
    <section>
      <SectionHeading
        align="left"
        eyebrow="Daily vitals"
        title="Foundations — your daily vitals"
        sub="Face, skin, body, sleep, water, presence. The non-negotiables every phase runs on — fully yours, nothing locked."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <VitalCard label="Sleep protocol" headline={f.sleep.target}>
          <ul className="space-y-2">
            {f.sleep.rules.map((r, i) => (
              <VitalRow key={i}>{r}</VitalRow>
            ))}
          </ul>
        </VitalCard>
        <VitalCard
          label="Hydration"
          headline={
            <>
              <CountUp value={f.hydration.dailyMl} duration={1.6} /> ml / day
            </>
          }
        >
          <p className="text-sm leading-relaxed text-bone/85">
            {f.hydration.detail}
          </p>
        </VitalCard>
        <VitalCard label="Daily movement" headline={f.movement.stepTarget}>
          <ul className="space-y-2">
            {f.movement.cues.map((c, i) => (
              <VitalRow key={i}>{c}</VitalRow>
            ))}
          </ul>
        </VitalCard>
        <VitalCard label="Non-negotiables" headline="Every day, no debate">
          <ul className="space-y-2">
            {f.nonNegotiables.map((n, i) => (
              <VitalRow key={i}>{n}</VitalRow>
            ))}
          </ul>
        </VitalCard>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Roadmap — Phase 1 is this preview; Phases 2–3 are named and        */
/* visible, their week-by-week content locked. The retention frame.   */
/* ------------------------------------------------------------------ */

const ROADMAP_PHASES = [
  {
    weeks: "Weeks 1–4",
    name: "Phase 1 — Foundation",
    line: "The full protocol below: introduce, build, intensify, consolidate.",
    here: true,
  },
  {
    weeks: "Weeks 5–8",
    name: "Phase 2 — Intensify",
    line: "Actives at full strength, training loads up, first re-scan measured against today.",
    here: false,
  },
  {
    weeks: "Weeks 9–12",
    name: "Phase 3 — Consolidate",
    line: "Lock the habits in, final re-scan, and your maintenance blueprint.",
    here: false,
  },
] as const;

function RoadmapSection() {
  return (
    <section>
      <SectionHeading
        align="left"
        eyebrow="The journey"
        title="Phase 1 of 3 — the road ahead"
        sub="This preview is Phase 1 of a 12-week phased protocol. The later phases are already mapped — they unlock as you progress."
      />
      <div className="grid gap-4 sm:grid-cols-3">
        {ROADMAP_PHASES.map((ph) => (
          <Card key={ph.name} glow={ph.here} className="h-full">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">
                {ph.weeks}
              </span>
              {ph.here ? (
                <span className="rounded-full border border-gold/40 bg-gold/15 px-2.5 py-0.5 text-[11px] font-bold text-gold-soft">
                  You&rsquo;re here
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-[11px] font-bold text-muted">
                  <LockIcon className="h-3 w-3" />
                  Locked
                </span>
              )}
            </div>
            <h3 className="font-display mt-2.5 text-lg font-extrabold text-bone">
              {ph.name}
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">
              {ph.line}
            </p>
          </Card>
        ))}
      </div>
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
    savedScanId,
    user,
  } = useApp();
  const savedScanIdRef = useRef(savedScanId);
  savedScanIdRef.current = savedScanId;

  // Building-sequence state: drives the staged waiting experience while
  // /api/plan generates (and during the completion tail after it lands).
  const [progress, setProgress] = useState(0);
  const [stageIdx, setStageIdx] = useState(0);
  const [microIdx, setMicroIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [aiPending, setAiPending] = useState(false);
  const [justLanded, setJustLanded] = useState(false);
  const previewRef = useRef(false);
  const skipFiredRef = useRef(false);
  const fetchStarted = useRef(false);
  const runStartedAt = useRef<number | null>(null);
  const planRef = useRef(plan);
  planRef.current = plan;

  // Owner test mode (lib/admin.ts): lifts the teaser veil and requests
  // the premium tier. Read on mount; toggled from the paywall code or
  // the banner on this page.
  const [ownerMode, setOwnerMode] = useState(false);
  useEffect(() => {
    setOwnerMode(isOwnerTestMode());
  }, []);

  const loadPlan = useCallback(async () => {
    if (!quiz) return;
    setPlanLoading(true);
    setPlanError(null);
    try {
      // Attach the session (if any): the server derives the tier from
      // the account's entitlement (admin/premium) when a valid token
      // arrives, instead of trusting the client-sent tier.
      const sb = getSupabase();
      const session = sb
        ? (await sb.auth.getSession()).data.session
        : null;
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session
            ? { Authorization: `Bearer ${session.access_token}` }
            : {}),
        },
        body: JSON.stringify({
          measurements,
          quiz,
          scanId: savedScanIdRef.current,
          // v1 has no auth: free tier by default; owner test mode (the
          // paywall code, see lib/admin.ts) requests the premium tier so
          // Zayne can test the paid experience. v2 derives the tier
          // server-side from the subscription entitlement — the client
          // value is never trusted there.
          tier: isOwnerTestMode() ? "premium" : "free",
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
      setAiPending(Boolean(data.aiPending || data.plan.aiPending));
      if (previewRef.current) {
        previewRef.current = false;
        setJustLanded(true);
      }
      // Persist to the account (no-op logged out) so the user can come
      // back to this exact plan from their dashboard. Skipped when the
      // server flagged the plan aiPending: it already saved the row and
      // owns the background upgrade of that row.
      if (!data.aiPending) {
        void savePlan(
          data.plan,
          data.tier ?? (isOwnerTestMode() ? "premium" : "free"),
          savedScanIdRef.current,
        );
      }
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

  // Owner banner action: rebuild the plan through the premium path.
  // Clearing the stored plan re-fires the mount fetch below, and
  // loadPlan reads the owner flag at call time — so this lands as a
  // premium request without a second code path.
  const regeneratePremium = useCallback(() => {
    fetchStarted.current = false;
    setPlan(null);
  }, [setPlan]);

  // Long-wait escape hatch: pull the deterministic plan instantly (the
  // free path is computed, not generated) and show it as a preview while
  // the premium generation keeps running. When the AI plan lands it
  // swaps in automatically (see the justLanded flag in loadPlan).
  const skipWait = useCallback(async () => {
    if (skipFiredRef.current || planRef.current || !quiz) return;
    skipFiredRef.current = true;
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          measurements,
          quiz,
          tier: "free",
        } satisfies PlanRequest),
      });
      if (!res.ok) return;
      const data = (await res.json()) as PlanResponse;
      if (!planRef.current) {
        previewRef.current = true;
        setPlan(data.plan);
      }
    } catch {
      /* the main generation is still running; nothing to do */
    }
  }, [measurements, quiz, setPlan]);

  const exitOwnerMode = useCallback(() => {
    setOwnerTestMode(false);
    setOwnerMode(false);
  }, []);

  useEffect(() => {
    if (!quiz || plan || planLoading || planError) return;
    if (fetchStarted.current) return;
    fetchStarted.current = true;
    void loadPlan();
  }, [quiz, plan, planLoading, planError, loadPlan]);

  // A fresh generation run resets the building sequence.
  useEffect(() => {
    if (!planLoading) return;
    runStartedAt.current = Date.now();
    setProgress(0);
    setStageIdx(0);
    setMicroIdx(0);
    setRevealed(false);
    setElapsedMs(0);
    setAiPending(false);
    setJustLanded(false);
    skipFiredRef.current = false;
    previewRef.current = false;
  }, [planLoading]);

  // Results show immediately when a plan was already in the store on mount
  // (returning to this page); a freshly fetched plan goes through the
  // building sequence first.
  const showResults = !!plan && (revealed || !fetchStarted.current);
  const building = !showResults && !planError && (planLoading || !!plan);

  // Drive the counter + stages while waiting. The fetch itself fires
  // immediately on mount (see the effect above) — this only paces the show:
  // ease toward ~92% (fast early, slow late), advance stages on cadence,
  // cycle reassurance lines on the final stage. Once the plan has landed
  // AND the minimum display has passed, check off every stage and rush
  // the counter to 100.
  useEffect(() => {
    if (!building) return;
    const id = setInterval(() => {
      const started = runStartedAt.current ?? Date.now();
      const elapsed = Date.now() - started;
      setElapsedMs(elapsed);
      if (planRef.current && elapsed >= MIN_BUILD_MS) {
        setStageIdx(BUILD_STAGES.length);
        setProgress((p) => Math.min(100, p + (100 - p) * 0.3 + 1.5));
        return;
      }
      setStageIdx(
        Math.min(Math.floor(elapsed / STAGE_MS), BUILD_STAGES.length - 1)
      );
      setProgress((p) => Math.min(92, p + (92 - p) * 0.02 + 0.15));
      const lastStageAt = STAGE_MS * (BUILD_STAGES.length - 1);
      if (elapsed > lastStageAt) {
        setMicroIdx(
          Math.floor((elapsed - lastStageAt) / 2400) % REASSURANCE_LINES.length
        );
      }
    }, 90);
    return () => clearInterval(id);
  }, [building]);

  // Counter complete → brief hold → reveal the results.
  useEffect(() => {
    if (!plan || revealed || progress < 100) return;
    const t = setTimeout(() => setRevealed(true), 600);
    return () => clearTimeout(t);
  }, [plan, revealed, progress]);

  // The "your AI plan just landed" note dismisses itself.
  useEffect(() => {
    if (!justLanded) return;
    const t = setTimeout(() => setJustLanded(false), 9000);
    return () => clearTimeout(t);
  }, [justLanded]);

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

  if (!showResults) {
    if (building) {
      return (
        <BuildingScreen
          progress={progress}
          stageIdx={stageIdx}
          microIdx={microIdx}
          frontPhoto={frontPhoto}
          measurements={measurements}
          elapsedMs={elapsedMs}
          onSkip={skipWait}
        />
      );
    }
    return null;
  }

  if (!plan) return null; // unreachable — showResults implies a plan

  // Teaser-gate totals (see the gate comment above the protocol section).
  const totalTasks = plan.sections.reduce(
    (n, s) => n + sectionTaskCount(s),
    0
  );
  const firstLockedSectionIdx = plan.sections.findIndex(
    (s) => sectionTaskCount(s) > FREE_TASKS_PER_SECTION
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="mx-auto max-w-4xl px-4 py-10 pb-32 sm:px-6 sm:py-14 sm:pb-36"
    >
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

      {ownerMode && (
        <Reveal className="mb-8">
          <div className="flex flex-col gap-3 rounded-2xl border border-gold/50 bg-gold/10 p-4 sm:flex-row sm:items-center sm:p-5">
            <p className="flex-1 text-sm leading-relaxed text-gold-soft">
              <span className="font-bold">Owner test mode is ON</span> — the
              full protocol is open and new plans generate on the premium
              AI tier, free. Only visible on this device.
            </p>
            <div className="flex shrink-0 gap-2">
              <Button
                onClick={regeneratePremium}
                className="px-4 py-2.5 text-sm"
              >
                Regenerate premium plan
              </Button>
              <Button
                onClick={exitOwnerMode}
                variant="ghost"
                className="px-4 py-2.5 text-sm"
              >
                Turn off
              </Button>
            </div>
          </div>
        </Reveal>
      )}

      {(aiPending || plan.aiPending) && (
        <Reveal className="mb-8">
          <div className="rounded-2xl border border-gold/30 bg-gold/10 p-4 sm:p-5">
            <p className="text-sm leading-relaxed text-gold-soft">
              <span className="font-bold">
                Your AI deep-personalisation is still being crafted.
              </span>{" "}
              The AI is under heavy demand right now, so your complete
              protocol is open below — the deep-curated version{" "}
              {user
                ? "will replace it here and in your dashboard within a few minutes. No need to stay on this page."
                : "will swap in here within a few minutes if you keep this page open — or create a free account and it will be saved to your dashboard."}
            </p>
          </div>
        </Reveal>
      )}

      {justLanded && (
        <Reveal className="mb-8">
          <div className="rounded-2xl border border-gold/50 bg-gold/15 p-4 sm:p-5">
            <p className="text-sm leading-relaxed text-gold-soft">
              <span className="font-bold">Your AI-personalised plan just landed</span>{" "}
              — you're now reading the deep-curated version, audited against
              your numbers.
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
            sub="Drag the divider. The right side is your potential, visualised — clearer skin, stronger light, sharper presence. Your protocol is how you get there."
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

      {/* PROJECTION — free, fully visible; the emotional peak lands early */}
      {plan.projection && (
        <div className="mt-14">
          <Reveal>
            <ProjectionSection plan={plan} />
          </Reveal>
        </div>
      )}

      {/* FOUNDATIONS — deterministic vitals layer, fully visible to all */}
      {plan.foundations && (
        <div className="mt-14">
          <Reveal>
            <FoundationsSection f={plan.foundations} />
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

      {/* ROADMAP — Phase 1 is this preview; Phases 2–3 named + locked */}
      <div className="mt-14">
        <Reveal>
          <RoadmapSection />
        </Reveal>
      </div>

      {/* PROTOCOL — teaser gate.
          The first FREE_TASKS_PER_SECTION tasks of each pillar render in
          full; everything beyond that renders blurred/locked behind the
          trial. Measurements, scores and priority fixes above stay fully
          visible — the free-scan promise. (Gate comment also lives with
          the LockedWeeks/UnlockCard components.) */}
      <section className="mt-14 space-y-6">
        <SectionHeading
          align="left"
          eyebrow="The work"
          title="Your protocol — Phase 1"
          sub={
            ownerMode
              ? "Weeks 1–4 of your 12-week protocol: face, skin, body, sleep, water, presence — sequenced week by week. Owner test mode: every step is open."
              : "Weeks 1–4 of your 12-week protocol: face, skin, body, sleep, water, presence — sequenced week by week. The first 3 steps of each pillar are open; the rest sits under the veil."
          }
        />
        {plan.sections.map((section, si) => {
          const { visible, locked } = ownerMode
            ? { visible: section.weeks, locked: [] as PlanWeek[] }
            : splitSection(section);
          return (
          <Reveal key={section.id} delay={Math.min(si * 0.06, 0.2)}>
            <Card>
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-gold">
                Pillar {String(si + 1).padStart(2, "0")} · Protocol
              </p>
              <h3 className="font-display mt-1.5 text-2xl font-extrabold text-bone">
                {section.title}
              </h3>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] font-semibold text-muted">
                  {section.weeks.length} weeks
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] font-semibold text-muted">
                  {sectionTaskCount(section)} steps
                </span>
                {ownerMode ? (
                  <span className="rounded-full border border-gold/30 bg-gold/10 px-2.5 py-0.5 text-[11px] font-semibold text-gold-soft">
                    Owner test — all steps open
                  </span>
                ) : (
                  <span className="rounded-full border border-gold/30 bg-gold/10 px-2.5 py-0.5 text-[11px] font-semibold text-gold-soft">
                    First {FREE_TASKS_PER_SECTION} free
                  </span>
                )}
              </div>
              <p className="mt-3.5 border-l-2 border-gold pl-3 text-[15px] font-semibold leading-snug text-bone">
                {section.summary}
              </p>
              <p className="mt-3 rounded-xl border border-gold/20 bg-gold/10 px-3.5 py-2.5 text-[13px] leading-relaxed text-gold-soft">
                <span className="font-bold">Why you: </span>
                {section.whyForYou}
              </p>
              <div className="mt-6">
                {visible.map((week, wi) => (
                  <WeekBlock
                    key={week.week}
                    week={week}
                    premium
                    last={wi === visible.length - 1}
                  />
                ))}
              </div>
              {locked.length > 0 && <LockedWeeks weeks={locked} />}
            </Card>
            {si === firstLockedSectionIdx && !ownerMode && (
              <UnlockCard total={totalTasks} />
            )}
          </Reveal>
          );
        })}
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
            {!ownerMode && (
              <Button href="/paywall" className="px-6 py-3 text-sm">
                Unlock your full plan
              </Button>
            )}
          </div>
        </footer>
      </Reveal>

      {/* Sticky unlock bar — sells both halves of the subscription: every
          step unblurred AND the deep-curated regeneration of the plan.
          Hidden in owner test mode (nothing left to unlock). */}
      {!ownerMode && (
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gold/25 bg-ink/85 backdrop-blur-md">
        <div
          className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3 sm:px-6"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          <p className="text-sm font-bold leading-snug text-bone">
            Your protocol is ready — unlock it
            <span className="block text-xs font-semibold text-gold-soft">
              Every step unblurred, deep-curated for your goals
            </span>
          </p>
          <Button href="/paywall" className="shrink-0 px-4 py-2.5 text-sm">
            Unlock my protocol
          </Button>
        </div>
      </div>
      )}
    </motion.div>
  );
}
