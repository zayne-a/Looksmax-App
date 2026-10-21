// Guides added to the main nav — the library is a first-class destination, not a footer afterthought.
// Mobile build (2026-10-21): the old single flex row wrapped its links
// into three lines and pushed "Log in" off the right edge at phone
// widths (and the overflow widened every public page). Now: one clean
// row (logo · account · CTA) plus a swipeable link strip on mobile;
// the desktop row is unchanged.
import Link from "next/link";
import { Button } from "@/components/ui";
import AccountLink from "@/components/AccountLink";

const links = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/calculators", label: "Toolbox" },
  { href: "/guides", label: "Guides" },
  { href: "/coach", label: "Coach" },
  { href: "/why-ascend", label: "Why Mewmax" },
  { href: "/paywall", label: "Pricing" },
];

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-gold/10 bg-ink/85 backdrop-blur-xl">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex items-center justify-between gap-3 py-3">
          <Link
            href="/"
            className="font-display text-[1.35rem] font-extrabold tracking-tight"
            aria-label="Mewmax home"
          >
            <span className="gold-text">MEWMAX</span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm font-medium text-muted lg:flex">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="whitespace-nowrap transition hover:text-bone"
              >
                {l.label}
              </Link>
            ))}
            <AccountLink />
          </nav>
          <div className="flex items-center gap-4 text-sm font-medium text-muted lg:hidden">
            <AccountLink />
            <Button href="/quiz" className="px-4 py-2 text-sm">
              Free scan
            </Button>
          </div>
          <Button
            href="/quiz"
            className="hidden px-5 py-2 text-sm lg:inline-flex"
          >
            Start free scan
          </Button>
        </div>
        <nav
          aria-label="Sections"
          className="flex gap-5 overflow-x-auto whitespace-nowrap pb-3 text-sm font-medium text-muted [scrollbar-width:none] lg:hidden [&::-webkit-scrollbar]:hidden"
        >
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="transition hover:text-bone"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
