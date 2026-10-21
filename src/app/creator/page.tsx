import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Creator Tools — Mewmax",
  description:
    "Free creator templates: the Ascend countdown card, the cleaner ratings card and the full ratings card, in Mewmax black and mint.",
};

const MINT = "#5EEAD4";

function Icon({ children }: { children: ReactNode }) {
  return (
    <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-xl bg-[#5EEAD4]/10 transition-transform duration-300 group-hover:scale-110">
      <svg
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
        stroke={MINT}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {children}
      </svg>
    </div>
  );
}

const cardClass =
  "group relative overflow-hidden rounded-2xl border-2 border-white/10 bg-white/[0.02] p-8 text-left transition-all duration-300 hover:border-[#5EEAD4]";

const CARDS = [
  {
    href: "/creator/ascend-template",
    title: "Ascend Template",
    description:
      "Create countdown templates with ratings and progress circles for social media",
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
  },
  {
    href: "/creator/clean-ratings-template",
    title: "NEW (Cleaner) Ratings Template",
    description:
      "Simplified rating template with just PSL and Potential scores",
    icon: (
      <>
        <path d="M12 3l1.9 4.6L18.5 9l-4.6 1.4L12 15l-1.9-4.6L5.5 9l4.6-1.4L12 3z" />
        <path d="M19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2z" />
      </>
    ),
  },
  {
    href: "/creator/ratings-template",
    title: "Original Ratings Template",
    description:
      "Full rating cards with all metrics: PSL, Potential, Eyes, Midface, and more",
    icon: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </>
    ),
  },
  {
    href: "/creator/video-examples",
    title: "Video Examples",
    description:
      "Watch example videos showcasing template usage and content creation tips",
    icon: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="3" />
        <path d="M10 9.5l5 2.5-5 2.5v-5z" fill={MINT} />
      </>
    ),
  },
];

export default function CreatorHubPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0c] text-[#f4f1e8]">
      <div className="mx-auto max-w-6xl px-4 py-10 md:px-8 md:py-14">
        <h1 className="font-[family-name:var(--font-archivo)] text-4xl font-extrabold tracking-tight md:text-5xl">
          Creator Tools
        </h1>
        <p className="mt-3 max-w-2xl text-[#9b9ba4]">
          The templates behind the videos: build your countdown and
          ratings cards, download them, and post. Free, no account
          needed.
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {CARDS.map((c) => (
            <Link key={c.href} href={c.href} className={cardClass}>
              <div className="absolute inset-0 bg-[#5EEAD4]/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <div className="relative z-10">
                <Icon>{c.icon}</Icon>
                <h2 className="mb-3 text-2xl font-bold">{c.title}</h2>
                <p className="text-[#9b9ba4]">{c.description}</p>
              </div>
            </Link>
          ))}

          {/* Graphics — Coming Soon, same disabled-card state as his */}
          <div className={`${cardClass} cursor-not-allowed opacity-60`}>
            <span className="absolute top-4 right-4 rounded-full bg-white/10 px-3 py-1 text-xs text-[#9b9ba4]">
              Coming Soon
            </span>
            <div className="relative z-10">
              <Icon>
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <circle cx="9" cy="10" r="1.6" />
                <path d="M21 16l-4.5-4.5L9 19" />
              </Icon>
              <h2 className="mb-3 text-2xl font-bold">Graphics</h2>
              <p className="text-[#9b9ba4]">
                Access a library of graphics and design assets for your
                projects
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
