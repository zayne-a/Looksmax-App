// Guide article (new): statically generated per guide — intro, numbered protocol steps, common-mistakes card, bottom-line card with the personalised-plan bridge, and keep-reading links. (Fixed during the zero-error pass: Eyebrow renders a <p>, so it must not be wrapped in another <p> — that nesting caused React hydration error #418 on every article.)
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, Eyebrow } from "@/components/ui";
import { Reveal } from "@/components/motion";
import { GUIDES, getGuide } from "@/lib/guides";

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) return { title: "Guide — Ascend" };
  return { title: `${guide.title} — Ascend Guides`, description: guide.blurb };
}

export default async function GuidePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) notFound();

  const related = GUIDES.filter(
    (g) => g.category === guide.category && g.slug !== guide.slug
  ).slice(0, 2);
  const moreFromLibrary = GUIDES.filter(
    (g) => g.category !== guide.category
  ).slice(0, 2);

  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <Reveal>
        <Link
          href="/guides"
          className="text-sm font-bold text-gold-soft hover:text-gold"
        >
          ← All guides
        </Link>
        <div className="mt-6">
          <Eyebrow>
            {guide.category} · {guide.readMins} min read
          </Eyebrow>
        </div>
        <h1 className="font-display mt-3 text-4xl font-extrabold tracking-tight text-bone">
          {guide.title}
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted">
          {guide.intro}
        </p>
      </Reveal>

      {guide.sections.map((section, i) => (
        <Reveal key={section.heading} delay={0.03 * (i + 1)} className="mt-10">
          <h2 className="font-display text-2xl font-extrabold text-bone">
            {section.heading}
          </h2>
          {section.paragraphs?.map((p) => (
            <p key={p.slice(0, 24)} className="mt-3 leading-relaxed text-muted">
              {p}
            </p>
          ))}
          {section.steps && (
            <ol className="mt-4 space-y-3">
              {section.steps.map((step, si) => (
                <li key={si} className="flex gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-gold/40 bg-gold/10 text-xs font-extrabold text-gold-soft">
                    {si + 1}
                  </span>
                  <span className="leading-relaxed text-bone/85">{step}</span>
                </li>
              ))}
            </ol>
          )}
        </Reveal>
      ))}

      <Reveal delay={0.05} className="mt-12">
        <Card>
          <h2 className="font-display text-xl font-extrabold text-bone">
            The common mistakes
          </h2>
          <ul className="mt-3 space-y-2.5">
            {guide.mistakes.map((m) => (
              <li key={m.slice(0, 24)} className="flex gap-2.5 text-sm leading-relaxed text-muted">
                <span aria-hidden className="font-bold text-red-300">
                  ✕
                </span>
                {m}
              </li>
            ))}
          </ul>
        </Card>
      </Reveal>

      <Reveal delay={0.06} className="mt-6">
        <Card glow>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-gold">
            The bottom line
          </p>
          <p className="font-display mt-2 text-xl font-extrabold leading-snug text-bone">
            {guide.bottomLine}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Want this applied to your face, your numbers and your week?{" "}
            <Link href="/quiz" className="font-bold text-gold-soft">
              Your personalised plan
            </Link>{" "}
            sequences it for you — and if you&apos;re a subscriber, your
            coach can walk you through it.
          </p>
        </Card>
      </Reveal>

      {(related.length > 0 || moreFromLibrary.length > 0) && (
        <Reveal delay={0.07} className="mt-12">
          <h2 className="font-display text-xl font-extrabold text-bone">
            Keep reading
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {[...related, ...moreFromLibrary].slice(0, 4).map((g) => (
              <Link key={g.slug} href={`/guides/${g.slug}`} className="group">
                <Card className="h-full transition group-hover:border-gold/40">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gold">
                    {g.category} · {g.readMins} min
                  </p>
                  <h3 className="font-display mt-2 text-lg font-extrabold leading-snug text-bone">
                    {g.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">
                    {g.blurb}
                  </p>
                </Card>
              </Link>
            ))}
          </div>
        </Reveal>
      )}
    </div>
  );
}
