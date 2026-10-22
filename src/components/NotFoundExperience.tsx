import Link from "next/link";

/**
 * NotFoundExperience — THE 404 experience for this app (2026-10-22).
 * Rendered by src/app/not-found.tsx for genuinely unknown URLs AND
 * by every admin gate for anyone who isn't a signed-in admin: the
 * owner's rule is that /admin/* must be invisible — a non-admin gets
 * exactly this, as if the page didn't exist. No admin wording, no
 * sign-in hint, nothing that confirms an admin area exists.
 */
export default function NotFoundExperience() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col items-center px-4 py-24 text-center sm:py-32">
      <p className="font-display text-7xl font-extrabold tracking-tight sm:text-8xl">
        <span className="gold-text">404</span>
      </p>
      <h1 className="mt-6 font-display text-2xl font-extrabold text-bone">
        This page doesn&apos;t exist
      </h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">
        The link may be broken, or the page may have moved. Head back
        home and start from there.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex rounded-full bg-gold px-7 py-3 text-sm font-extrabold text-ink transition hover:brightness-110"
      >
        Back to home
      </Link>
    </div>
  );
}
