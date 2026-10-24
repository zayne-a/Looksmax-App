"use client";

/**
 * InterfacePreview — instant phone-layout previews for the app's
 * first interfaces (welcome + onboarding hero), for the admin
 * editors that own them.
 *
 * Unlike ContentPreview (which previews one content ITEM), these
 * previews render the WHOLE screen the way the app renders it, so
 * an edit to copy or media shows its real effect immediately:
 *  - /admin/settings Interface copy → previews read the DRAFT
 *    field values (every keystroke updates them); blank fields
 *    fall back to the app's built-in copy, exactly as the app does.
 *  - /admin/content Interfaces slots → previews read the slot
 *    editor's DRAFT media (picked file or pasted URL, pre-save)
 *    plus the LIVE interface copy from /api/settings.
 *
 * The frame matches ContentPreview's phone frame. The hero's
 * built-in visual is an approximation of the app's gradient +
 * scan-glyph panel (the glyph itself lives in native code); when
 * owner media is set, the preview shows that media full-bleed,
 * exactly as the app will.
 */

export interface InterfaceCopyDraft {
  headline: string;
  body: string;
  accent: string;
  cta: string;
}

export const BUILT_IN_WELCOME: InterfaceCopyDraft = {
  headline: "Become top-tier attractive",
  body: "Scan your face, get your PSL rating and your potential — then a plan that closes the gap. No account needed.",
  accent: "",
  cta: "Get Started",
};

export const BUILT_IN_HERO: InterfaceCopyDraft = {
  headline: "Become top-tier attractive",
  body: "Get your PSL score, a personal routine, products & more — ascend in",
  accent: "90 days",
  cta: "Get started",
};

/** Resolve a draft (blank = built-in) the way the app resolves it. */
export function resolveCopy(
  draft: Partial<InterfaceCopyDraft>,
  builtIn: InterfaceCopyDraft
): InterfaceCopyDraft {
  return {
    headline: draft.headline?.trim() || builtIn.headline,
    body: draft.body?.trim() || builtIn.body,
    accent: draft.accent?.trim() || builtIn.accent,
    cta: draft.cta?.trim() || builtIn.cta,
  };
}

function isImageUrl(url: string): boolean {
  return /\.(png|jpe?g|gif|webp|avif|svg)(\?|#|$)/i.test(url);
}

function PhoneFrame({
  label,
  children,
  dimmed,
}: {
  label: string;
  children: React.ReactNode;
  dimmed?: boolean;
}) {
  return (
    <div>
      <p className="text-center text-[11px] font-bold uppercase tracking-widest text-muted">
        {label}
      </p>
      <div className="relative mx-auto mt-2 w-full max-w-[350px] rounded-[2.4rem] border border-white/15 bg-[#111113] p-2.5 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.9)]">
        <div className="relative overflow-hidden rounded-[1.9rem] bg-[#0A0A0C] text-white">
          <div className="pointer-events-none absolute left-1/2 top-2 z-20 h-5 w-24 -translate-x-1/2 rounded-full border border-white/5 bg-black" />
          <div className={dimmed ? "opacity-50 saturate-50" : undefined}>
            {children}
          </div>
        </div>
      </div>
      {dimmed ? (
        <p className="mt-2 text-center text-[11px] leading-relaxed text-muted">
          Inactive — the app renders nothing for this slot until it
          is active.
        </p>
      ) : null}
    </div>
  );
}

function ScreenMedia({
  media,
  className,
}: {
  media: string;
  className?: string;
}) {
  if (!media) return null;
  if (isImageUrl(media)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={media} alt="" className={className} />
    );
  }
  return (
    <video
      src={media}
      autoPlay
      loop
      muted
      playsInline
      className={className}
    />
  );
}

/** The welcome screen, as the app renders it. */
export function WelcomePreview({
  copy,
  media,
  active = true,
}: {
  copy: InterfaceCopyDraft;
  media?: string;
  active?: boolean;
}) {
  return (
    <PhoneFrame label="Welcome" dimmed={!active}>
      <div className="flex min-h-[560px] flex-col justify-between px-6 pb-6 pt-12">
        <div>
          {media ? (
            <div className="mb-6 overflow-hidden rounded-2xl">
              <ScreenMedia
                media={media}
                className="aspect-[16/10] w-full object-cover"
              />
            </div>
          ) : null}
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/60">
            Mewmax
          </p>
          <p className="mt-3 text-[32px] font-extrabold leading-[1.1]">
            {copy.headline}
          </p>
          <p className="mt-3 text-[15px] leading-relaxed text-white/60">
            {copy.body}
          </p>
        </div>
        <div className="mt-8 rounded-full bg-[#5EEAD4] py-4 text-center text-[16px] font-extrabold text-black">
          {copy.cta}
        </div>
      </div>
    </PhoneFrame>
  );
}

/** The onboarding hero card, as the app renders it. */
export function HeroPreview({
  copy,
  media,
  active = true,
}: {
  copy: InterfaceCopyDraft;
  media?: string;
  active?: boolean;
}) {
  return (
    <PhoneFrame label="Onboarding hero" dimmed={!active}>
      <div className="relative">
        {/* Visual area — owner media shown whole (contain, no crop),
            else the built-in gradient + glyph panel. Matches the app:
            the hero video sits wholly above the sheet, never behind
            it (Zayne 2026-10-25). */}
        <div className="relative h-[330px] overflow-hidden">
          {media ? (
            <ScreenMedia
              media={media}
              className="absolute inset-0 h-full w-full object-contain"
            />
          ) : (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{
                background:
                  "linear-gradient(to bottom, #123B36 0%, #0C1F22 55%, #0A0A0C 100%)",
              }}
            >
              <svg width="150" height="150" viewBox="0 0 150 150">
                <ellipse
                  cx="75"
                  cy="75"
                  rx="58"
                  ry="78"
                  fill="none"
                  stroke="#5EEAD4"
                  strokeWidth="3"
                  opacity="0.65"
                />
                <path
                  d="M30 60 Q75 20 120 60"
                  fill="none"
                  stroke="#5EEAD4"
                  strokeWidth="5"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          )}
          {/* Language pill — top-right, as on the app. */}
          <div className="absolute right-4 top-3 rounded-full bg-white px-3 py-1.5 text-[13px] font-semibold text-black">
            English
          </div>
        </div>
        {/* Bottom sheet card, flush below the visual — no overlap,
            so the whole video stays visible above it, as on the app. */}
        <div className="mt-0 rounded-t-[28px] bg-[#0A0A0C] px-6 pb-8 pt-6 text-center">
          <p className="text-[28px] font-extrabold leading-[1.15]">
            {copy.headline}
          </p>
          <p className="mt-3 text-[15px] leading-relaxed text-white/60">
            {copy.body}{" "}
            {copy.accent ? (
              <span className="font-bold text-[#5EEAD4]">
                {copy.accent}
              </span>
            ) : null}
            .
          </p>
          <div className="mx-auto mt-5 max-w-[280px] rounded-full bg-white py-3.5 text-center text-[15px] font-extrabold text-black">
            {copy.cta}
          </div>
        </div>
      </div>
    </PhoneFrame>
  );
}
