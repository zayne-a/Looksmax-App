// Claims corrected to match the shipped product (audit, 2026-10-20): weekly check-ins + Coach Review show "With account" in the Free column instead of Pro-only, since signed-in free users get them as shipped. The extra-scan comparison line keeps its wording and gains the * tying it to the store-listing footnote.
import Link from "next/link";
import { Button, Card, Eyebrow, SectionHeading } from "@/components/ui";
import { Reveal } from "@/components/motion";

/**
 * The public "what makes it worth it" page: an honest, checkable
 * comparison — Ascend Pro vs the leading rating app, and Free vs Pro —
 * so visitors can see exactly what a subscription runs for them.
 * Competitor facts are from its public store listing (Oct 2026).
 */

const VS_UMAX: [string, string, string][] = [
  ["Your first scan", "Free — full measurements + score, no card", "Results locked behind a subscription*"],
  ["Re-scans as you progress", "Unlimited, included", "Extra scans are an extra purchase*"],
  ["What you actually get", "A 12-week adaptive protocol (skin, diet, exercise, style) — mewing and debloat protocols included", "One-off ratings + per-trait tips"],
  ["A plan that adapts", "Weekly check-ins change your plan; Phases 2–3 are generated from your progress", "—"],
  ["Daily system", "Today's checklist, water & calorie trackers set from your plan, streak, calendar", "—"],
  ["AI coach", "Knows your plan and your logs; asks you 3 questions a day", "—"],
  ["Progress tracking", "Score history, weekly Coach Review, tracked-day calendar", "Photo storage"],
  ["Your photos", "Measured on your phone — never uploaded", "Uploaded for analysis"],
  ["Price", "$4.99/month · $29.99/year", "$9.99–$24.99/month (store-listed)*"],
  ["Upsells", "One price — everything included, no 'supercharged' tier", "Paid add-on results*"],
];

const FREE_VS_PRO: [string, string, string][] = [
  ["Face scan + measurements", "✓", "✓"],
  ["Core score + projection", "✓", "✓"],
  ["Foundations (sleep, water, movement)", "✓", "✓"],
  ["Calculators toolbox", "✓", "✓"],
  ["Full protocol — every step unblurred", "First 3 steps per section", "✓"],
  ["AI-personalised plan (deep curation)", "—", "✓"],
  ["AI Coach with memory of your plan", "—", "✓"],
  ["Daily 3 questions + Today home", "—", "✓"],
  ["Streak, trackers & record calendar", "—", "✓"],
  ["Weekly check-ins that adjust your plan", "With account", "✓"],
  ["Weekly Coach Review", "With account", "✓"],
  ["Phases 2–3, generated from your progress", "—", "✓"],
];

function CompareTable({
  head,
  rows,
}: {
  head: [string, string, string];
  rows: [string, string, string][];
}) {
  return (
    <div className="overflow-hidden rounded-3xl border border-white/10">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="bg-white/[0.05] text-bone">
            <th className="px-4 py-3.5 font-display font-extrabold sm:px-5">{head[0]}</th>
            <th className="px-4 py-3.5 font-display font-extrabold text-gold-soft sm:px-5">{head[1]}</th>
            <th className="px-4 py-3.5 font-display font-extrabold text-muted sm:px-5">{head[2]}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, ascend, other]) => (
            <tr key={label} className="border-t border-white/8 align-top">
              <td className="px-4 py-3 font-bold text-bone sm:px-5">{label}</td>
              <td className="px-4 py-3 leading-relaxed text-bone/90 sm:px-5">{ascend}</td>
              <td className="px-4 py-3 leading-relaxed text-muted sm:px-5">{other}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function WorthItPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 sm:py-20">
      <Reveal>
        <div className="text-center">
          <Eyebrow>Worth it?</Eyebrow>
          <h1 className="font-display mx-auto mt-4 max-w-2xl text-4xl font-extrabold leading-[1.05] tracking-tight text-bone sm:text-5xl">
            One price. Everything included.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-muted">
            The leading rating app sells you a scan — then charges again for
            re-scans and upgraded results. Ascend runs your next 12 weeks:
            the protocol, the coach, the daily system, the adjustments.
            Compare for yourself.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Button href="/quiz" className="px-8 py-3.5">
              Get my free scan
            </Button>
            <Button href="/paywall" variant="ghost" className="px-8 py-3.5">
              See plans
            </Button>
          </div>
        </div>
      </Reveal>

      <Reveal delay={0.05} className="mt-14">
        <SectionHeading
          eyebrow="Head to head"
          title="Ascend Pro vs the leading rating app"
        />
        <div className="mt-6">
          <CompareTable
            head={["", "Ascend Pro", "Umax"]}
            rows={VS_UMAX}
          />
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          *From Umax&apos;s public App Store listing and in-app purchase
          list, October 2026. Prices shown are its store-listed ranges.
        </p>
      </Reveal>

      <Reveal delay={0.05} className="mt-14">
        <SectionHeading
          eyebrow="A week inside Pro"
          title="What your subscription actually runs"
        />
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {[
            ["Every morning", "Your Today home opens with your streak, today's protocol as a checklist, and trackers already set to your numbers — water from your bodyweight, calories from your goal."],
            ["Every day", "Your coach asks 3 questions — skin, diet, sleep, training — and remembers the answers. Ask it anything; it replies with your plan, not generic tips."],
            ["Every week", "A 60-second check-in. Your plan adjusts: breakouts → a barrier week, stalled weight → a calorie dial, low adherence → a simpler week. Then your Coach Review: what improved, what slipped, your #1 move."],
            ["Every phase", "Phase 2 unlocks at week 5, Phase 3 at week 9 — generated from your check-ins and progress scans. They don't exist yet, for anyone, because they're built from your data."],
          ].map(([title, body]) => (
            <Card key={title}>
              <h3 className="font-display text-lg font-extrabold text-bone">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
            </Card>
          ))}
        </div>
      </Reveal>

      <Reveal delay={0.05} className="mt-14">
        <SectionHeading eyebrow="No surprises" title="Free vs Pro, line by line" />
        <div className="mt-6">
          <CompareTable head={["", "Free", "Ascend Pro"]} rows={FREE_VS_PRO} />
        </div>
      </Reveal>

      <Reveal delay={0.05} className="mt-14">
        <Card glow className="text-center">
          <p className="font-display text-3xl font-extrabold text-bone">
            $29.99 a year is $0.58 a week.
          </p>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-muted">
            Less than the other app charges for a single extra scan* — for
            a coach, a protocol that adapts weekly, and a system that keeps
            you honest for 12 weeks. Monthly and Yearly start with a 3-day
            free trial. Cancel anytime, in one tap, no traps.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button href="/paywall" className="px-8 py-3.5">
              Start the journey
            </Button>
            <Link
              href="/#how-it-works"
              className="inline-flex items-center rounded-full px-6 py-3.5 text-sm font-bold text-gold-soft underline underline-offset-4 hover:text-gold"
            >
              How the scan works
            </Link>
          </div>
        </Card>
      </Reveal>
    </div>
  );
}
