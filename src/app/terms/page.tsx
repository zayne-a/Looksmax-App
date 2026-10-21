// Terms page (new, audit fix). Plain-terms framing matches the brand: softmaxxing only, not medical advice, Pro pricing + the trial rule stated exactly as sold (3-day trial on Monthly/Yearly only, Weekly bills day one), no transformation guarantees.
import { Card, Eyebrow } from "@/components/ui";
import { Reveal } from "@/components/motion";

export const metadata = {
  title: "Terms — Mewmax",
  description: "The terms for using Mewmax, including Mewmax Pro.",
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <Reveal>
        <Eyebrow>Terms</Eyebrow>
        <h1 className="font-display mt-3 text-4xl font-extrabold tracking-tight text-bone">
          Plain terms, no traps.
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          Last updated October 2026.
        </p>
      </Reveal>

      <Reveal delay={0.05} className="mt-8 space-y-4">
        <Card>
          <h2 className="font-display text-lg font-extrabold text-bone">
            What Mewmax is
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Mewmax provides aesthetic self-improvement guidance
            (“softmaxxing”): skincare, grooming, fitness and lifestyle
            protocols generated from your measurements and answers. It is
            not medical advice, diagnosis or treatment. Prescription-only
            items are never specified — anything in that territory is
            labelled “see a dermatologist.” Consult a qualified
            professional for medical concerns.
          </p>
        </Card>
        <Card>
          <h2 className="font-display text-lg font-extrabold text-bone">
            Mewmax Pro
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Pro is a subscription: $1.99/week, $4.99/month or $29.99/year.
            Monthly and Yearly plans start with a 3-day free trial; the
            Weekly plan bills from day one. One price covers everything —
            re-scans, the adaptive 12-week protocol, the daily system and
            the AI coach are never sold separately. Cancel anytime;
            cancelling stops future billing, and there are no retention
            traps or dark patterns by design.
          </p>
        </Card>
        <Card>
          <h2 className="font-display text-lg font-extrabold text-bone">
            Honest results
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Scores and projections are estimates derived from your own
            measurements. We make no transformation guarantees and no
            fixed-timeline promises; outcomes depend on consistency, and
            projections are framed as realistically achievable, never
            assured.
          </p>
        </Card>
        <Card>
          <h2 className="font-display text-lg font-extrabold text-bone">
            Your account
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            You are responsible for your account credentials. Email
            verification is required. We may suspend accounts that abuse
            the service (including automated scraping of paid features);
            subscription features are for the account holder&apos;s
            personal use.
          </p>
        </Card>
      </Reveal>
    </div>
  );
}
