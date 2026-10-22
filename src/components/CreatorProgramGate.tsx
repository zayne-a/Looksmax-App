"use client";

import type { ReactNode } from "react";
import { useAppSettings } from "@/lib/use-settings";

/**
 * CreatorProgramGate — the web consumer of features.creator_program
 * (2026-10-22, /admin/settings). Wraps the /creator hub and the
 * /portal trees: while the owner has the program ON (the default),
 * children render untouched; OFF replaces the whole surface with an
 * honest "paused" notice — no tools, no portal, no fake content.
 * The underlying data is untouched, so switching back on restores
 * everything exactly as it was.
 */
export default function CreatorProgramGate({
  children,
}: {
  children: ReactNode;
}) {
  const settings = useAppSettings();

  if (settings.features.creator_program) return <>{children}</>;

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink px-4">
      <div className="w-full max-w-md text-center">
        <p className="font-display text-3xl font-extrabold tracking-tight">
          <span className="gold-text">MEWMAX</span>
        </p>
        <h1 className="mt-6 font-display text-2xl font-extrabold text-bone">
          The creator program is paused
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          The Creator Tools and the Creator Portal are switched off for
          now. Nothing is deleted — when the program reopens, your
          account, submissions and earnings pick up exactly where they
          left off.
        </p>
        <p className="mt-6 text-xs text-muted">
          Updates are posted in the MEWMAX CREATORS Discord server.
        </p>
      </div>
    </main>
  );
}
