// Guides link added alongside Privacy/Terms/Pricing/Toolbox.
"use client";

import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-gold/10 bg-ink-2">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <p className="font-display text-xl font-extrabold tracking-tight">
          <span className="gold-text">ASCEND</span>
        </p>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">
          Your most attractive self — measured, not guessed. Deterministic
          facial measurement and a week-by-week softmaxxing protocol.
        </p>
        <p className="mt-4 text-xs text-muted/80">
          Not medical advice. For aesthetic guidance only.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-5 text-sm text-muted">
          <Link href="/privacy" className="transition hover:text-bone">
            Privacy
          </Link>
          <Link href="/terms" className="transition hover:text-bone">
            Terms
          </Link>
          <Link href="/paywall" className="transition hover:text-bone">
            Pricing
          </Link>
          <Link href="/calculators" className="transition hover:text-bone">
            Toolbox
          </Link>
          <Link href="/guides" className="transition hover:text-bone">
            Guides
          </Link>
        </div>
        <p className="mt-8 text-xs text-muted/60">
          © 2026 Ascend. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
