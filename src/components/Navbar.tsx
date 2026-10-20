# Guides added to the main nav — the library is a first-class destination, not a footer afterthought.
import Link from "next/link";
import { Button } from "@/components/ui";
import AccountLink from "@/components/AccountLink";

const links = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/calculators", label: "Toolbox" },
  { href: "/guides", label: "Guides" },
  { href: "/coach", label: "Coach" },
  { href: "/why-ascend", label: "Why Ascend" },
  { href: "/paywall", label: "Pricing" },
];

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-gold/10 bg-ink/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="font-display text-[1.35rem] font-extrabold tracking-tight"
          aria-label="Ascend home"
        >
          <span className="gold-text">ASCEND</span>
        </Link>
        <nav className="flex items-center gap-4 sm:gap-7 text-sm font-medium text-muted">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="transition hover:text-bone"
            >
              {l.label}
            </Link>
          ))}
          <AccountLink />
        </nav>
        <Button href="/quiz" className="px-5 py-2 text-sm">
          Start free scan
        </Button>
      </div>
    </header>
  );
}
