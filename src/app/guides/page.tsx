# Guides hub (new): every guide on one clear page, grouped by category with anchor chips — the "certain page" where all general advice lives. Closes with the positioning line: guides are general, your plan is personal.
import Link from "next/link";
import { Card, Eyebrow } from "@/components/ui";
import { Reveal } from "@/components/motion";
import { GUIDES, GUIDE_CATEGORIES } from "@/lib/guides";

export const metadata = {
  title: "Guides — Ascend",
  description:
    "The clear, general advice library: skincare, hair, jawline, posture, sleep, nutrition, gym and style — no fluff, no miracle claims.",
};

export default function GuidesPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
      <Reveal>
        <Eyebrow>The Guides Library</Eyebrow>
        <h1 className="font-display mt-3 max-w-2xl text-4xl font-extrabold tracking-tight text-bone sm:text-5xl">
          Clear answers, in one place.{" "}
          <span className="text-gold">No fluff to dig through.</span>
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">
          The internet&apos;s looks advice is a swamp of contradictions and
          miracle claims. These guides are the opposite: the general layer,
          written plainly and checked against what&apos;s actually known —
          sitting alongside your personalised plan, which handles what&apos;s
          specific to your face and your numbers.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {GUIDE_CATEGORIES.map((c) => (
            <a
              key={c}
              href={`#${c.replace(/[^a-z]/gi, "").toLowerCase()}`}
              className="rounded-full border border-white/12 px-4 py-2 text-sm font-bold text-muted transition hover:border-gold/40 hover:text-gold-soft"
            >
              {c}
            </a>
          ))}
        </div>
      </Reveal>

      {GUIDE_CATEGORIES.map((cat, ci) => {
        const guides = GUIDES.filter((g) => g.category === cat);
        if (!guides.length) return null;
        return (
          <Reveal
            key={cat}
            delay={0.04 * (ci + 1)}
            className="mt-12"
          >
            <h2
              id={cat.replace(/[^a-z]/gi, "").toLowerCase()}
              className="font-display scroll-mt-28 text-2xl font-extrabold text-bone"
            >
              {cat}
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {guides.map((g) => (
                <Link key={g.slug} href={`/guides/${g.slug}`} className="group">
                  <Card className="h-full transition group-hover:border-gold/40">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gold">
                      {g.readMins} min read
                    </p>
                    <h3 className="font-display mt-2 text-xl font-extrabold leading-snug text-bone">
                      {g.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted">
                      {g.blurb}
                    </p>
                    <p className="mt-3 text-sm font-bold text-gold-soft">
                      Read the guide →
                    </p>
                  </Card>
                </Link>
              ))}
            </div>
          </Reveal>
        );
      })}

      <Reveal delay={0.1} className="mt-14">
        <Card glow className="text-center">
          <h2 className="font-display text-2xl font-extrabold text-bone">
            Guides are general. Your plan is personal.
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-muted">
            These pages explain the principles. Your Ascend plan sequences
            them against your own measurements, skin readings and goals —
            with a weekly loop that adjusts as you go.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link
              href="/quiz"
              className="rounded-full bg-gold px-7 py-3 text-sm font-extrabold text-ink transition hover:brightness-110"
            >
              Start your free scan
            </Link>
            <Link
              href="/why-ascend"
              className="rounded-full border border-white/15 px-7 py-3 text-sm font-bold text-bone transition hover:border-gold/40"
            >
              Why Ascend
            </Link>
          </div>
        </Card>
      </Reveal>
    </div>
  );
}
