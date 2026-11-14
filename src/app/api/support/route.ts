import { NextResponse } from "next/server";
import { serviceClient } from "@/lib/admin-api";
import { buildScoreView } from "@/lib/score-view";
import { getAppSettings } from "@/lib/settings";
import type { FaceMeasurements } from "@/lib/types";
import { MAX_VOICE, COACH_LAYER, languageDirective } from "@/lib/max-voice";

/**
 * /api/support — Max, one persona on web + native (Zayne, 2026-10-21;
 * persona unification + coach mode 2026-10-22).
 *
 * DEFAULT MODE (web widget): Max answers questions ABOUT the app —
 * how it works, plans, pricing, protocols, troubleshooting — from the
 * knowledge base below, on his OWN dedicated Gemini key
 * (SUPPORT_GEMINI_API_KEY) so support chats never eat the plan/coach
 * pool's quota. Personal protocol coaching is the Coach's job; Max
 * points people there.
 *
 * COACH MODE (POST { mode: "coach" }, native Coach tab): the SAME Max
 * persona coaching ONE Pro subscriber from their real account data.
 * Requires a Supabase Bearer token; entitlement is derived server-side
 * (profiles.is_premium must be exactly true, else 403 coach_premium).
 * The route persists the exchange itself into chat_messages and caps
 * coach use at 40 user messages/day — the same accounting pattern as
 * /api/coach — and generation reuses the support key rotation below.
 */

const SYSTEM = `${MAX_VOICE}

WHAT MEWMAX IS
- Mewmax measures your face from a selfie and builds a personal glow-up protocol (softmaxxing: skin, diet, exercise, style — nothing medical, no surgery/drugs advice ever).
- Programme length: 90 days. The dashboard counts down to the user's ascend date (start + 90 days). The protocol is phased across 12 weeks (3 phases × 4 weeks), and days 85–90 are a final consolidation stretch that runs the plan's own consolidation/maintenance week — so if someone asks how long the programme is, the answer is 90 days.
- Flow: free scan (camera) → facial measurements + score → short quiz → your plan → daily tasks in the dashboard, weekly check-ins, an AI Coach who knows your plan and scan history, progress tracking across rescans.

THE SCAN (/scan)
- The scan page opens the front camera; you take the photo inside the app (upload is a fallback if there's no camera / permission is denied).
- A quality gate checks the photo before measuring: face visible and centred, big enough in frame, decent light, not blown out, not blurry. If rejected, the screen says exactly why and retakes are unlimited and free.
- Measurements: symmetry, harmony fit, facial thirds and fifths, canthal tilt, jaw-to-cheekbone ratio, FWHR, face shape — plus skin reads: redness, texture, a blemish estimate and under-eye darkness. Every scan result includes a full written read of what each number means and what can honestly move it.
- Scores are estimates from one photo under your current lighting/angle — a tracking tool, not a medical or absolute judgment. Rescan in similar light for fair comparisons.
- The PSL score runs 1–8 — that is the community's scale; there is no 10, and 8 is the practical ceiling nobody actually touches. Tiers, low to high: Sub-3, Low-Tier Normie, Mid-Tier Normie, High-Tier Normie, Chadlite, Chad, True Adam (female ladder: Sub-3, Low-Tier Becky, Mid-Tier Becky, High-Tier Becky, Stacylite, Stacy, True Eve). POTENTIAL is on the same 1–8 scale. If a user quotes a score out of 10, correct it once, lightly: our numbers are out of 8.

PRIVACY (important, users ask a lot)
- Face analysis runs ON THE DEVICE in the browser — photos are never uploaded for analysis.
- Scan photos a signed-in user keeps for their history are stored in their own browser on their device, not on our servers.
- Account data (scores, plans, check-ins) is stored securely in their account. Signing out deletes nothing — log back in and everything is restored exactly as left. Full deletion of an account and its data is available on request.

FREE vs PRO
- Free: the scan, your score, the measurement breakdown and written read, and a preview plan — the first 3 steps of each of the 4 protocol sections (12 tasks) are open; the other tasks show their titles but stay locked.
- Pro (subscription): all 48 protocols in full with personal instructions, an AI-personalised plan, the AI Coach, the full dashboard (90-day ascend countdown, 12-week roadmap, weekly check-ins, achievements, record calendar, progress photo timeline), rescan history analysis and all guides.
- The 48 protocols: 4 sections — Skin, Diet, Exercise, Style — 12 protocols each, phased across the 12 weeks, plus Foundations (sleep target, hydration, daily movement, non-negotiables) that apply every day.

PRICING (exact — never quote other numbers)
- Weekly $1.99 · Monthly $4.99 · Yearly $29.99.
- TRIAL: 3-day free trial on Monthly and Yearly only. Weekly has NO trial — it bills from day one.
- Influencer/creator coupon codes give 20% off.
- Checkout status: if the paywall on their screen says payments are coming soon, that's accurate — checkout is being switched on; pricing above is final. Their free scan, score and preview work fully in the meantime.

PLANS, CHANGES, VERSIONS
- Plans live in the dashboard Records tab. Every generated version is saved — nothing is ever overwritten or deleted.
- Change my plan (on the plan page): retune body goal, training days or timeline — each plan includes 1 FREE change. Extra changes are a paid add-on that arrives with payments. A fresh scan starts a new plan with its own free change.
- Revert: in Records, every version is listed (Original, Change 1, …); "Revert to this version" makes any earlier version the active plan again, free, instantly, nothing deleted. A new scan or a new change automatically becomes the active plan.
- The dashboard: Today (daily tasks, calories remaining, streak, this week's roadmap), Progress (measurements, scan history with photos and full reads, progress photos, check-ins), Records (saved plans + versions, achievements), More (the full protocol library with every protocol in full, guides, account).
- Weekly check-ins adjust the plan (e.g. calories self-correct by ±150 kcal based on weigh-ins).

THE COACH vs MAX (you)
- You (Max) = how the app works, pricing, plans, troubleshooting, guidance around the site. You appear on the website pages (not inside the dashboard).
- The Coach (/coach, and inside the dashboard) = personal advice from the user's own plan, scans and history. If someone asks YOU for personal protocol advice ("what should I do for my jawline?"), explain their plan and Coach hold their personal data, and point them to /coach or their plan page — you can still explain how any feature works.

ACCOUNTS
- Sign-up needs an email + password, and email verification is mandatory — they must click the link in the verification email before they can log in (check spam; a resend option is on the login page).
- Forgot password: the login page has the reset flow.
- Users must be signed in for plans to save, for the Coach, and for plan changes.

TROUBLESHOOTING
- Camera won't start: allow camera permission in the browser site settings; if it says the camera is busy, close other apps/tabs using it; no front camera → use the upload option on the scan page.
- Photo keeps getting rejected: follow the on-screen reason — move to brighter, even light (face a window), hold the phone at eye level, arm's length, remove glasses/hat, keep still.
- Plan looks wrong / tasks too hard: use Change my plan, or retake the scan in better light — measurements drive everything.
- Score changed between scans: lighting, angle, facial hair, bloating and time of day all move readings — compare scans taken in similar conditions; the trend across several scans is what matters.

GUIDES & PAGES
- /guides — free in-depth guides (mewing explained honestly, the morning debloat protocol, jawline, skincare and more).
- /why-ascend — how Mewmax compares with other looksmaxxing apps.
- /privacy and /terms — the legal pages.
- /paywall — pricing and plans.

CREATOR PROGRAM (creators earn by posting videos — answer these questions from the facts here ONLY)
- The program: creators post looksmaxxing videos using Mewmax ratings overlays, submit them through the Creator Portal, and earn view bounties. The community hub is the MEWMAX CREATORS Discord server — invite: https://discord.gg/HnRdpkwNQ2 (join it first; the full rulebook is pinned in its channels).
- How it works, step by step: 1) Join the Discord server. 2) Log in to the Creator Portal at looksmax-app-echo-mint.vercel.app/portal with your Discord account, then connect and verify your TikTok / Instagram account there. 3) Make videos with the free Creator Tools at /creator — the countdown template and the clean + full ratings templates that produce the ratings overlays. 4) Post to TikTok and Instagram following the video requirements below. 5) Submit each video in the portal at /portal/submit. 6) Get paid monthly.
- The Discord server (MEWMAX CREATORS) — channel map, so you can send people to the exact channel: #how-it-works = the program steps; #video-requirements = the full video rulebook; #submit-videos = submission info (it points you to the portal); #payment-info = the tiers and payment methods; #how-to-get-us-viewers = guides for building a US / Tier-1 audience; #frequently-asked-questions = the FAQ; #announcements = payout dates and program news; #top-performing-videos = what's working; #verified-payouts = payout proof; #support = open a ticket for account-specific help; #general = the community chat. Whenever the server comes up in an answer, give the invite link: https://discord.gg/HnRdpkwNQ2 (it never expires).
- Earnings — BASIC tier: +$20 when a video passes 40K views, +$30 more at 500K, +$50 more at 1M — $100 max per video. The bonuses stack by threshold: 600K views on BASIC = $20 + $30 = $50; 1M+ = the full $100. Do this math carefully whenever someone gives you a view count.
- BASIC requirements: your audience must be at least 20% Tier-1 — Tier-1 countries are the US, Canada, UK, Australia, Germany, France, Netherlands, Sweden, Denmark, Switzerland, New Zealand, Poland and Italy — and your account needs 10K+ views in the last 28 days.
- ELITE tier (as listed on the portal's Offers page): needs a 40% USA audience, 500K+ views in the last 28 days and 5+ videos. Pays +$20 at 40K, +$30 at 100K, +$100 at 500K, +$150 at 1M — $300 max per video.
- Video requirements (the essentials): looksmaxxing content only; a Mewmax ratings overlay made with the Creator Tools must appear within the first 15 seconds and be full-screen for at least 1.5 seconds; tag @mewmax.app in the FIRST line of the description, on both Instagram and TikTok; English only; post to both platforms; no other brands in the video; no engagement farming; audiences that are majority Tier-3 are rejected; banned content categories: anime, cartoons, sports, animals and Smallville.
- Submitting: submit in the portal once you're satisfied with the video — the view count LOCKS at the moment of submission and the payout is calculated on that locked number, so a later submission at a higher count earns more, BUT you have exactly 30 days from the day of posting to submit. Submissions are reviewed around month-end, before payouts.
- Verification: in the portal at /portal/verification, submit a screen recording of your account's last-28-days audience demographics. Account reviews typically take 24–48 hours. After acceptance you must keep your Tier-1 audience share at 20% or above — it is checked monthly.
- Getting US / Tier-1 viewers: the methods live in the #🎯│how-to-get-us-viewers channel in the Discord.
- Referrals: $20 for every new creator whose first video gets approved — no limit. Each creator's personal invite link is on the Referrals page in the portal.
- Payments: payout methods are set in the portal's Settings — Bank Transfer, Crypto (USDC on Solana), PayPal and Cash App. Payouts are monthly, at month end; the exact payout dates are announced in the #announcements channel in the Discord. NEVER state a specific payout date — you don't know it; point to #announcements.
- Account-specific problems (a submission stuck, a verification pending too long, a payout missing): you have no access to anyone's account data — tell them to open a ticket in the #support channel in the Discord, where the team can see their account.
- Never invent payout dates, earnings testimonials, "top creators make $X" claims, or promises that a video or account will be approved — approval is a human review decision. If a program detail isn't in the facts here, say so and point to the Discord.
- LINKS: when an answer touches the Discord, the portal or the Creator Tools, include the real URL in the reply so it can be tapped: Discord invite https://discord.gg/HnRdpkwNQ2 · Creator Portal https://looksmax-app-echo-mint.vercel.app/portal (submit a video: https://looksmax-app-echo-mint.vercel.app/portal/submit · verification: https://looksmax-app-echo-mint.vercel.app/portal/verification · payout methods in Settings: https://looksmax-app-echo-mint.vercel.app/portal/settings) · Creator Tools https://looksmax-app-echo-mint.vercel.app/creator.

WHY IT'S WORTH IT (your second job: make the value obvious)
- You're support AND the person who helps visitors see why Mewmax is worth it. When someone asks about Pro, pricing, or hesitates ("is it worth it?", "why pay?", "what's the point?"), make the honest case — tempting, never pushy:
  • What Pro actually unlocks: the free preview shows 12 of 48 protocol steps. Pro opens all 48 with personal instructions written from THEIR measurements, an AI Coach that knows their scans and plan, the 12-week roadmap, check-ins that adjust the plan, and rescan analysis that shows what's actually moving.
  • Price framing (use the real numbers): yearly works out to about 8 cents a day ($29.99/year); monthly about 17 cents a day. Less than a coffee a month for a full personal protocol.
  • Risk-free angle: Monthly and Yearly start with a 3-day free trial — they can see the entire plan before paying anything.
  • Honest contrasts with typical rivals: many apps hide your score until you pay and upload your face photos to their servers; Mewmax shows the score free and analyses photos on-device. Our scores don't inflate to flatter — the read tells you what to fix.
  • Outcome framing without promises: nobody can promise a new face; what Pro sells is a system — measured starting point, the right protocols in the right order, daily tasks, and proof of progress every rescan.
- In general answers, end with the natural next step when it fits ("Start with the free scan at /scan — the score and read are free") — one line, not a sales pitch in every message.
- NEVER: fake discounts, fake scarcity or countdowns, invented testimonials or user counts, guaranteed results, or shame-based pressure about someone's appearance. Tempt with value and clarity, not insecurity. If they say no, drop it gracefully.

SAFETY
- Mewmax is softmaxxing only. For anything medical — skin conditions, prescription products, pain, sleep apnea — the answer is to see a dermatologist/doctor; never diagnose, never recommend prescription medication, hormones, surgery, fillers or botox.
- Be kind about appearance anxiety: scores are one tracking tool, habits are the point.

FORMAT ON TOP OF THE VOICE RULES ABOVE
- Mention the page (e.g. "Open /scan") when guiding — and for the Discord, the portal and the Creator Tools, include the full clickable URL from the LINKS facts above. One question back at most, only if needed.`;

/* ------------------------------------------------------------------ */
/* APP MODE (native app callers — Zayne, 2026-11-14)                   */
/* ------------------------------------------------------------------ */

/**
 * Local pricing snapshot the native app sends with every Max
 * request (its lib/pricing — the paywall's own source of truth,
 * so Max's numbers can never disagree with the paywall). The app
 * computes it from the device region; the server only quotes it.
 * Sanitised like the reply language: a malformed snapshot is
 * dropped wholesale and Max falls back to the USD list rather
 * than quoting anything untrusted.
 */
interface AppPricing {
  currency: string;
  region: string;
  weekly: { price: string; perDay: string };
  monthly: { price: string; perDay: string };
  yearly: { price: string; perDay: string };
}

/** One formatted price line: no control characters (so it can
 *  never break out of its prompt line), ≤40 chars, must contain
 *  a digit. Anything else is rejected. */
function cleanPrice(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim()
    .slice(0, 40);
  return v && /\d/.test(v) ? v : null;
}

function sanitisePricing(raw: unknown): AppPricing | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const currency =
    typeof r.currency === "string" && /^[A-Z]{3}$/.test(r.currency)
      ? r.currency
      : null;
  if (!currency) return null;
  const region =
    typeof r.region === "string" && /^[A-Z]{2}$/.test(r.region)
      ? r.region
      : "";
  const plan = (key: string) => {
    const p = r[key];
    if (!p || typeof p !== "object") return null;
    const price = cleanPrice((p as Record<string, unknown>).price);
    const perDay = cleanPrice((p as Record<string, unknown>).perDay);
    return price && perDay ? { price, perDay } : null;
  };
  const weekly = plan("weekly");
  const monthly = plan("monthly");
  const yearly = plan("yearly");
  if (!weekly || !monthly || !yearly) return null;
  return { currency, region, weekly, monthly, yearly };
}

/** The trial line for the app pricing block, from the owner's
 *  trial_days app setting (same rule as the web prompt's swap:
 *  0 = no trial at all). */
function appTrialLine(trialDays: number): string {
  if (trialDays === 0)
    return "- TRIAL: there is NO free trial. Every plan — Weekly, Monthly, Yearly — bills from day one. Never tell anyone a trial exists.";
  if (trialDays === 3)
    return "- TRIAL: 3-day free trial on Monthly and Yearly only. Weekly has NO trial — it bills from day one.";
  return `- TRIAL: ${trialDays}-day free trial on Monthly and Yearly only. Weekly has NO trial — it bills from day one.`;
}

/**
 * THE APP — the knowledge block Max answers from in app mode.
 * Every fact here is about the native app's real screens, tabs
 * and flows (verified against the app code, 2026-11-14) — never
 * website pages. Pricing quotes ONLY the validated local
 * snapshot; with no snapshot Max falls back to the USD list and
 * says the paywall shows the local price.
 *
 * `mode` changes exactly two lines: support mode must never
 * claim personal knowledge (it has none — personalisation is
 * the Coach's work), while coach mode answers from the CONTEXT
 * block the server builds from the account rows.
 */
function appKnowledge(
  pricing: AppPricing | null,
  trialDays: number,
  mode: "support" | "coach"
): string {
  const priceLines = pricing
    ? `- Weekly ${pricing.weekly.price} · Monthly ${pricing.monthly.price} · Yearly ${pricing.yearly.price} — in ${pricing.currency}, the currency this phone prices in.`
    : `- Weekly $1.99 · Monthly $4.99 · Yearly $29.99 (USD list — the app did not send local pricing, so quote these and say the paywall shows the price in the local currency).`;
  const perDayLine = pricing
    ? `- Per day: yearly works out to about ${pricing.yearly.perDay} (${pricing.yearly.price}); monthly about ${pricing.monthly.perDay}.`
    : `- Per day: yearly works out to about 8¢ a day ($29.99/year); monthly about 17¢ a day.`;
  const personalLine =
    mode === "coach"
      ? "- You coach from the CONTEXT block below — this user's real scan, plan and logs. For questions about the APP itself (where things are, what Pro unlocks, prices), use this knowledge, not CONTEXT."
      : "- You CANNOT see this user's personal data in this chat — no scan, no plan, no week, no progress. Never claim to know their numbers, never guess them, never invent a score or a task. If they ask about their own score or plan, point them at their [Results](app:/results) or [Routine](app:/(tabs)/routine) — and personal coaching from their data lives in the [Coach](app:/(tabs)/coach) tab (Pro).";
  const resultsLine =
    mode === "coach"
      ? "- Everyone sees the OVERALL score. The breakdown — eyes, midface, lower third and every other section — is blurred and locked for free users; Pro unlocks it. Your CONTEXT carries the real breakdown numbers for this Pro user, so you may quote them."
      : "- Everyone sees the OVERALL score. The breakdown — eyes, midface, lower third and every other section — is blurred and locked for free users; Pro unlocks it. Never quote breakdown numbers — you can't see them in this chat.";

  return `YOU ARE INSIDE THE MEWMAX APP
- You are Max inside the MewMax phone app — NOT on the website. There are no web pages, no URLs, no "dashboard", no "/scan". The app has bottom tabs, a slide-in menu, and screens. Never tell the user to open a web page or a /path — name the tab or screen and LINK it (see IN-APP LINKS below).
${personalLine}

THE APP — SCREENS AND HOW TO GET THERE
- Bottom tabs (always visible): [Home](app:/(tabs)) · [Routine](app:/(tabs)/routine) · [Analytics](app:/(tabs)/analytics) · [Community](app:/(tabs)/community) · [Coach](app:/(tabs)/coach). Generate is NOT a tab — it opens from the Generate card on Home.
- The slide-in menu (☰, from the right): Profile · Rescan face · Go Premium · Ask Max (this chat) · Discord · [The Vault](app:/vault) · [Mewing](app:/mewing) · [Debloat](app:/debloat) · Creator tools · [Settings](app:/settings). Profile is NOT a tab — it lives in the menu.
- [Home](app:/(tabs)): latest scan + score, streak, ascend date (start + 90 days), today's snapshot, the "Scan your face" button, the Generate card.
- [Routine](app:/(tabs)/routine): today's tasks from the active plan, the week strip, the day ring, weekly check-ins. Only TODAY is editable — past days are read-only, future days unlock on the day.
- [Analytics](app:/(tabs)/analytics): measurements, scan history and trends over time.
- [Community](app:/(tabs)/community): the forum, knowledge and products.
- [Coach](app:/(tabs)/coach): the AI Coach chat — Pro only. Free users see a teaser chat (their scan photo, first lines visible, the rest blurred) instead of a paywall bounce.
- The Max bubble (you, support) floats on every tab except Coach — draggable, with quick questions. The Coach tab IS Max too, but coaching.

THE SCAN
- First scan: [Home](app:/(tabs)) → "Scan your face", or straight from onboarding. Gender is asked ONCE, before the scan — never again.
- Rescan: menu → [Rescan face](app:/scan) (Pro — free users land on the paywall), or Home → Generate card ("Re-scan").
- Steps: front-photo guide → side-photo guide → birth-date step (once) → short quiz → results. Face analysis runs ON THE DEVICE — photos are never uploaded for analysis. Scan photos stay on the user's own phone.
- Quality gate: face visible and centred, big enough in frame, decent light, not blown out, not blurry. If rejected, the screen says exactly why; retakes are unlimited and free.
- Scores are estimates from one photo under the current lighting/angle — a tracking tool, not a medical or absolute judgment. Rescan in similar light for fair comparisons.
- The PSL score runs 1–8 — the community's scale; there is no 10, and 8 is the practical ceiling. Tiers, low to high: Sub-3, Low-Tier Normie, Mid-Tier Normie, High-Tier Normie, Chadlite, Chad, True Adam (female ladder: Sub-3, Low-Tier Becky, Mid-Tier Becky, High-Tier Becky, Stacylite, Stacy, True Eve). POTENTIAL is on the same 1–8 scale. If a user quotes a score out of 10, correct it once, lightly.

RESULTS
${resultsLine}
- Every result includes a written read of what each number means and what can honestly move it.

THE PLAN AND ROUTINE
- After the scan + quiz, the app builds a personal 90-day plan: 48 protocols in 4 sections — Skin, Diet, Exercise, Style — 12 each, phased across 12 weeks, plus Foundations (sleep, hydration, daily movement, non-negotiables) every day. Days 85–90 are the consolidation stretch.
- Free: the scan, the overall score, and a preview plan — the first 3 steps of each section (12 tasks) are open; the other tasks show titles but stay locked.
- Pro: all 48 protocols in full with personal instructions, the AI-personalised plan, the AI Coach, the full Routine (12-week roadmap, weekly check-ins, record calendar, progress timeline), rescan history analysis and all guides.
- [Plan builder](app:/plan-builder): retune body goal, training days or timeline. Each plan includes 1 FREE change; a fresh scan starts a new plan with its own free change. Old versions are never deleted.
- Weekly check-ins adjust the plan (e.g. calories self-correct by ±150 kcal on weigh-ins). The [Weekly plan](app:/weekly-plan) is the AI-curated week, generated from the [AI week questions](app:/weekly-questions).

PRICING (exact — quote ONLY these numbers, in this currency, never USD, never other numbers)
${priceLines}
${perDayLine}
${appTrialLine(trialDays)}
- Creator/influencer coupon codes give 20% off Monthly and Yearly — never Weekly. Codes are entered on the paywall.
- Checkout: payments are coming soon via Google Play — Play is the merchant of record and charges in the buyer's local currency. The Continue button on the paywall closes it until Play Billing wires in at store launch. Never ask for card details — the app never builds its own card form.
- Cancelling stops future billing; the free scan, score and preview keep working.

ACCOUNTS
- The app is guest-first: it works fully WITHOUT an account. Signing in is only needed to sync Pro, scans and plan to another phone.
- Sign in from [Settings](app:/settings) or the [Sign in](app:/sign-in) screen. Signing out deletes nothing — sign back in and everything is restored.
- Full deletion of an account and its data is available on request (Profile → delete account — the request goes to the team by email).

SETTINGS
- [Settings](app:/settings): [Language](app:/language) (28 languages), reminders + the MewMax notification sound, account, subscription, app version.
- Reminders: daily task reminders at the plan's own times, plus a morning "plan ready" teaser. If reminders don't arrive, check they are ON in Settings AND notifications are allowed for MewMax in the phone's system settings.
- Changing language can need an app restart before the layout follows — close and reopen the app.

READS AND GUIDES
- [The Vault](app:/vault): every term, decoded. [Mewing](app:/mewing) and [Debloat](app:/debloat): the in-depth reads (tongue posture, bloat) — free.
- [Protocols](app:/protocols): the full protocol library (headings for free, full content for Pro).

TROUBLESHOOTING
- Camera won't start: allow the camera permission in the phone's system settings (Settings → Apps → MewMax → Permissions → Camera); if the camera says busy, close other apps using it; no front camera → use the upload option on the scan screen.
- Photo keeps getting rejected: follow the on-screen reason — brighter, even light (face a window), phone at eye level, arm's length, glasses/hat off, keep still.
- Plan looks wrong / tasks too hard: use the [Plan builder](app:/plan-builder), or retake the scan in better light — measurements drive everything.
- Score changed between scans: lighting, angle, facial hair, bloating and time of day all move readings — compare scans taken in similar conditions; the trend across several scans is what matters.

IN-APP LINKS (how you link — follow this exactly)
- Whenever you name a tab, screen or feature, link it as [Label](app:/path) so the user can TAP it and land there. Examples: [Routine](app:/(tabs)/routine) · [Rescan face](app:/scan) · [Go Pro](app:/paywall) · [Settings](app:/settings) · [The Vault](app:/vault).
- Use ONLY these paths (nothing else exists as a link target): /(tabs), /(tabs)/routine, /(tabs)/analytics, /(tabs)/community, /(tabs)/coach, /(tabs)/generate, /scan, /results, /paywall, /profile, /settings, /vault, /mewing, /debloat, /plan-builder, /weekly-plan, /weekly-questions, /language, /legal, /protocols, /sign-in, /onboarding.
- The form is exactly app: + one slash + the path — never app://, never a missing slash. NEVER wrap a link in **bold** — the stars break the tap. NEVER write a bare /path or a website URL for an app screen. NEVER link to a screen the user can't open (no admin pages, no post/guide pages with ids you don't have).
- The Discord invite, Creator Portal and Creator Tools are web links — use their full https:// URLs from the LINKS facts, not app: links.`;
}

/**
 * The support-mode system prompt for native-app callers: the web
 * prompt with its website knowledge (WHAT MEWMAX IS … GUIDES &
 * PAGES) swapped for the app knowledge block, the USD price
 * framing swapped for the local one, and the format tail taught
 * the in-app link form. Everything else — creator program,
 * safety, the voice — is shared verbatim, so the surfaces can't
 * drift apart. If an anchor is missing (the prompt was edited
 * upstream), the derivation falls back to the web prompt rather
 * than serving a half-swapped one.
 */
function buildAppSystem(
  pricing: AppPricing | null,
  trialDays: number
): string {
  const start = SYSTEM.indexOf("WHAT MEWMAX IS");
  const end = SYSTEM.indexOf("CREATOR PROGRAM");
  if (start < 0 || end < 0 || end <= start) return SYSTEM;
  let app = `${SYSTEM.slice(0, start)}${appKnowledge(pricing, trialDays, "support")}\n\n${SYSTEM.slice(end)}`;
  // Local price framing in WHY IT'S WORTH IT.
  if (pricing) {
    app = app.replace(
      "• Price framing (use the real numbers): yearly works out to about 8 cents a day ($29.99/year); monthly about 17 cents a day. Less than a coffee a month for a full personal protocol.",
      `• Price framing (use the real numbers): yearly works out to about ${pricing.yearly.perDay} (${pricing.yearly.price}); monthly about ${pricing.monthly.perDay}. Less than a coffee a month for a full personal protocol.`
    );
  }
  // Trial bullet, same rule as the web swap.
  if (trialDays === 0) {
    app = app.replace(
      "• Risk-free angle: Monthly and Yearly start with a 3-day free trial — they can see the entire plan before paying anything.",
      "• Low-risk angle: there is no free trial — but the first scan, the score and the preview plan are free forever before they pay anything, and cancelling is one tap and stops future billing."
    );
  } else if (trialDays !== 3) {
    app = app.replace(
      "• Risk-free angle: Monthly and Yearly start with a 3-day free trial — they can see the entire plan before paying anything.",
      `• Risk-free angle: Monthly and Yearly start with a ${trialDays}-day free trial — they can see the entire plan before paying anything.`
    );
  }
  // Next-step hook: the app has no /scan URL.
  app = app.replace(
    '("Start with the free scan at /scan — the score and read are free")',
    '("Start with the free scan — tap [Scan your face](app:/scan) on Home — the score and read are free")'
  );
  // Format tail: teach the in-app link form.
  app = app.replace(
    `- Mention the page (e.g. "Open /scan") when guiding — and for the Discord, the portal and the Creator Tools, include the full clickable URL from the LINKS facts above. One question back at most, only if needed.`,
    `- When you name an in-app destination, ALWAYS link it as [Label](app:/path) using ONLY the paths in the IN-APP LINKS table — tapping it takes the user there. Never write a bare /path or a website URL for an app screen. For the Discord, the portal and the Creator Tools, include the full clickable URL from the LINKS facts above. One question back at most, only if needed.`
  );
  // The app brand is MewMax (the web prompt still says Mewmax).
  return app.replaceAll("Mewmax", "MewMax");
}

/**
 * Reply language (Zayne, 2026-10-24): the native app sends the
 * language the user picked in its language selector with each chat
 * call, and Max answers in it — in BOTH modes. The value is accepted
 * ONLY as an exact (case-insensitive) match against this whitelist of
 * canonical English names; anything else — unknown names, codes,
 * junk, prompt-shaped strings — is ignored and Max replies in
 * English. Raw user input is never interpolated into a prompt: the
 * name that reaches languageDirective() always comes from this list.
 */
const REPLY_LANGUAGES = [
  "English",
  "Chinese",
  "Hindi",
  "Spanish",
  "French",
  "German",
  "Russian",
  "Portuguese",
  "Italian",
  "Romanian",
  "Azerbaijani",
  "Arabic",
  "Bengali",
  "Urdu",
  "Indonesian",
  "Japanese",
  "Turkish",
  "Korean",
  "Vietnamese",
  "Persian",
  "Swahili",
  "Marathi",
  "Tamil",
  "Telugu",
  "Polish",
  "Ukrainian",
  "Dutch",
  "Thai",
] as const;

/** The accepted non-English reply language for this request, or null
 *  for English / anything unrecognised (English needs no directive). */
function sanitiseReplyLanguage(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const wanted = raw.trim().toLowerCase();
  if (!wanted) return null;
  const match = REPLY_LANGUAGES.find((l) => l.toLowerCase() === wanted);
  return match && match !== "English" ? match : null;
}

const MODELS = ["gemini-3.5-flash-lite", "gemini-3.6-flash"];

// Best-effort per-IP daily cap for the public support mode (in-memory;
// resets on cold start — the dedicated key's own quota is the hard
// backstop). Coach mode has its own per-user DB cap below instead.
const DAY_MS = 24 * 60 * 60 * 1000;
const ipHits = new Map<string, { count: number; resetAt: number }>();
const DAILY_CAP = 60;

function overCap(ip: string): boolean {
  const now = Date.now();
  const rec = ipHits.get(ip);
  if (!rec || now > rec.resetAt) {
    ipHits.set(ip, { count: 1, resetAt: now + DAY_MS });
    return false;
  }
  rec.count += 1;
  return rec.count > DAILY_CAP;
}

async function askGemini(
  key: string,
  model: string,
  contents: { role: string; parts: { text: string }[] }[],
  system: string = SYSTEM
): Promise<string | null> {
  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents,
          generationConfig: { temperature: 0.4, maxOutputTokens: 1024 },
        }),
        signal: AbortSignal.timeout(25_000),
      }
    );
    if (!resp.ok) return null;
    const data = (await resp.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? "")
      .join("")
      .trim();
    return text ? text : null;
  } catch {
    return null;
  }
}

/**
 * Streaming Gemini call — the same request as askGemini, only the
 * endpoint differs (:streamGenerateContent with alt=sse). Text
 * deltas reach onDelta as they arrive; the promise resolves to the
 * full assembled reply. Returns null ONLY when zero deltas arrived
 * (a mid-stream failure still returns the partial text the caller
 * already forwarded, so the persisted reply matches what the user
 * saw). Free keys only — same rotation as the non-streaming path.
 */
async function askGeminiStream(
  key: string,
  model: string,
  contents: { role: string; parts: { text: string }[] }[],
  system: string,
  onDelta: (text: string) => void
): Promise<string | null> {
  let full = "";
  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents,
          generationConfig: { temperature: 0.4, maxOutputTokens: 1024 },
        }),
        signal: AbortSignal.timeout(60_000),
      }
    );
    if (!resp.ok || !resp.body) return null;
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      let read: ReadableStreamReadResult<Uint8Array>;
      try {
        read = await reader.read();
      } catch {
        break; // Mid-stream failure: keep the partial text.
      }
      if (read.done) break;
      buffer += decoder.decode(read.value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (payload === "[DONE]") continue;
        try {
          const data = JSON.parse(payload) as {
            candidates?: { content?: { parts?: { text?: string }[] } }[];
          };
          const text = data.candidates?.[0]?.content?.parts
            ?.map((p) => p.text ?? "")
            .join("");
          if (text) {
            full += text;
            onDelta(text);
          }
        } catch {
          // A partial line mid-chunk — the next read completes it.
        }
      }
    }
  } catch {
    // Fetch-level failure before any delta: full is "".
  }
  return full.trim() ? full : null;
}

/**
 * Stream a reply across the key/model rotation. Deltas go to the
 * client as they arrive. A failed attempt is retried on the next
 * key/model ONLY while nothing has streamed yet — once the first
 * delta is out, askGeminiStream returns the partial text and the
 * reply stands as-is. Returns the full (or partial) text, or null
 * when every attempt failed before a single delta.
 */
async function streamReply(
  keys: string[],
  contents: { role: string; parts: { text: string }[] }[],
  system: string,
  onDelta: (text: string) => void
): Promise<string | null> {
  for (const key of keys) {
    for (const model of MODELS) {
      const reply = await askGeminiStream(key, model, contents, system, onDelta);
      if (reply !== null) return reply;
    }
  }
  return null;
}

/** Plain-text 200 body — the stream-mode reply shape. Chunks are
 *  raw reply text, no framing, so a progressive reader (XHR
 *  onprogress in the native app) can append them as they arrive. */
function textResponse(text: string): Response {
  return new Response(text, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

/**
 * Wrap a streaming generation in a plain-text Response. `run`
 * emits deltas as they arrive and handles its own fallback text
 * when generation produced nothing; the stream closes when run
 * resolves (persistence happens inside run, before close, so the
 * stored reply matches what the client received).
 */
function streamResponse(
  run: (emit: (text: string) => void) => Promise<void>
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        await run((text) => controller.enqueue(encoder.encode(text)));
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}

function supportKeys(): string[] {
  const plural = process.env.SUPPORT_GEMINI_API_KEYS;
  if (plural) {
    return plural
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);
  }
  const single = process.env.SUPPORT_GEMINI_API_KEY;
  return single ? [single] : [];
}

type RawHistory = { role?: unknown; content?: unknown }[] | undefined;

/** Normalise client history into Gemini turns. Accepts the web
 *  widget's user/model roles and the native app's user/assistant
 *  roles (assistant → model); anything else is dropped. */
function normaliseHistory(raw: RawHistory) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (h) =>
        h &&
        (h.role === "user" || h.role === "model" || h.role === "assistant") &&
        typeof h.content === "string"
    )
    .slice(-10)
    .map((h) => ({
      role: h.role === "assistant" ? "model" : (h.role as string),
      parts: [{ text: (h.content as string).slice(0, 800) }],
    }));
}

/* ------------------------------------------------------------------ */
/* COACH MODE                                                          */
/* ------------------------------------------------------------------ */

const COACH_DAILY_CAP = 40;

const COACH_CAP_REPLY =
  "🛑 YOUR NUMBER: **40/40** — you've used every coach message for today. Even Chads let the jaw rest.\n🎯 THE MOVE: Your plan and today's tasks are still live in the Routine tab — go execute. I'm back at full strength tomorrow.";

const COACH_BUSY_REPLY =
  "📡 Line dropped on my end — give me a moment and ask that again. Your data's saved, nothing's lost.";

type Admin = NonNullable<ReturnType<typeof serviceClient>>;

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;
const round1 = (v: number) => Math.round(v * 10) / 10;

/**
 * Compact CONTEXT block from the user's REAL rows (service role):
 * latest scan (overall + measurements summary + PSL/POTENTIAL), the
 * active plan (profiles.active_plan_id → plans row, else latest),
 * today's daily log and the latest weekly check-in. Every fetch is
 * best-effort: a missing datum becomes an explicit "none on file"
 * line so the prompt can coach around it instead of inventing it.
 *
 * POTENTIAL is not a stored column: when the scan's stored
 * measurements are complete it is derived with the app's own
 * deterministic lib/psl functions — the exact numbers the app itself
 * shows for that scan — otherwise it is left out, never estimated.
 */
async function buildCoachContext(
  admin: Admin,
  userId: string
): Promise<string> {
  const lines: string[] = [
    "CONTEXT — THIS USER'S REAL DATA (the only numbers you may quote):",
  ];

  // Active plan pointer (tolerate a pre-migration profiles table,
  // exactly like /api/coach: fall back to the latest plan).
  let activePlanId: string | null = null;
  try {
    const { data } = await admin
      .from("profiles")
      .select("active_plan_id")
      .eq("id", userId)
      .single();
    activePlanId =
      (data as { active_plan_id?: string | null } | null)?.active_plan_id ??
      null;
  } catch {
    activePlanId = null;
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const latestPlanQuery = () =>
    admin
      .from("plans")
      .select("plan, tier, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);
  let planRes = activePlanId
    ? await admin
        .from("plans")
        .select("plan, tier, created_at")
        .eq("user_id", userId)
        .eq("id", activePlanId)
        .limit(1)
    : await latestPlanQuery();
  if (activePlanId && !planRes.data?.length) {
    planRes = await latestPlanQuery();
  }

  const [scanRes, checkinRes, checkinCountRes, todayLogRes] =
    await Promise.all([
      admin
        .from("scans")
        .select("overall_score, measurements, quiz, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1),
      admin
        .from("checkins")
        .select("week, adherence, skin_reaction, sleep_quality, weight_trend, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1),
      admin
        .from("checkins")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
      admin
        .from("daily_logs")
        .select("day, answers, habits, water_ml, calories, weight_kg")
        .eq("user_id", userId)
        .eq("day", todayStr)
        .limit(1),
    ]);

  // Latest scan.
  const scan = scanRes.data?.[0];
  if (scan) {
    const m = (scan.measurements ?? null) as FaceMeasurements | null;
    const overall = num(scan.overall_score) ?? num(m?.overallScore);
    const bits: string[] = [];
    if (overall !== null) bits.push(`overall ${round1(overall)}/100`);
    if (m?.landmarksDetected && m.skin) {
      try {
        // Quote the user the numbers they actually SEE: the display
        // scale (1–8, template tiers) from lib/score-view — never the
        // engine's internal /10 values.
        const qg = (scan.quiz as { gender?: unknown } | null)?.gender;
        const view = buildScoreView(
          m,
          qg === "female" ? "female" : qg === "male" ? "male" : undefined
        );
        bits.push(`PSL ${view.psl.formatted} (${view.psl.verdict})`);
        bits.push(
          `POTENTIAL ${view.potential.formatted} (${view.potential.verdict})`
        );
      } catch {
        // Partial legacy measurements — quote the stored reads only.
      }
      bits.push(`symmetry ${Math.round(m.symmetryScore)}`);
      bits.push(`harmony ${Math.round(m.goldenRatioScore)}`);
      bits.push(`canthal tilt ${round1(m.canthalTiltDeg)}°`);
      bits.push(`jaw-to-cheekbone ${round1(m.jawToCheekbone)}`);
      bits.push(`FWHR ${round1(m.fwhr)}`);
      if (m.faceShape && m.faceShape !== "unknown")
        bits.push(`face shape ${m.faceShape}`);
      bits.push(
        `skin: redness ${Math.round(m.skin.redness)}, texture ${Math.round(m.skin.texture)}, blemishes ~${Math.round(m.skin.blemishCount)}, under-eye ${Math.round(m.skin.underEye)}`
      );
    }
    const day = typeof scan.created_at === "string" ? scan.created_at.slice(0, 10) : "unknown date";
    lines.push(`- Latest scan (${day}): ${bits.join(" · ") || "score on file, measurements incomplete"}.`);
  } else {
    lines.push("- Latest scan: none on file.");
  }

  // Active plan.
  const planRow = planRes.data?.[0];
  const plan = planRow?.plan as
    | {
        headline?: string;
        priorityFixes?: { title?: string }[];
        sections?: {
          title?: string;
          weeks?: { tasks?: { title?: string }[] }[];
        }[];
        foundations?: { nonNegotiables?: string[] };
      }
    | undefined;
  if (planRow && plan) {
    const bits: string[] = [];
    if (planRow.tier) bits.push(`tier ${planRow.tier}`);
    if (plan.headline) bits.push(`"${plan.headline}"`);
    lines.push(`- Active plan (${bits.join(" · ") || "plan on file"}):`);
    const fixes = (plan.priorityFixes ?? [])
      .map((f) => f.title)
      .filter(Boolean)
      .slice(0, 3);
    if (fixes.length) lines.push(`  Priority fixes: ${fixes.join("; ")}`);
    const sectionTitles = (plan.sections ?? [])
      .map((s) => s.title)
      .filter(Boolean);
    if (sectionTitles.length)
      lines.push(`  Sections: ${sectionTitles.join(", ")}`);
    const week1: string[] = [];
    for (const s of plan.sections ?? []) {
      for (const t of s.weeks?.[0]?.tasks ?? []) {
        if (t.title) week1.push(`${s.title}: ${t.title}`);
      }
    }
    if (week1.length)
      lines.push(`  Week-1 tasks: ${week1.slice(0, 8).join(" · ")}`);
    const nn = plan.foundations?.nonNegotiables ?? [];
    if (nn.length)
      lines.push(`  Daily non-negotiables: ${nn.slice(0, 5).join(" · ")}`);
  } else {
    lines.push("- Active plan: none on file.");
  }

  // Today's daily log.
  const todayLog = todayLogRes.data?.[0];
  if (todayLog) {
    const answers = Object.keys(todayLog.answers ?? {}).length;
    const habitsDone = Object.values(todayLog.habits ?? {}).filter(
      Boolean
    ).length;
    const habitsTotal = Object.keys(todayLog.habits ?? {}).length;
    lines.push(
      `- Today's daily log (${todayLog.day}): ${answers} daily answers banked · habits ${habitsDone}/${habitsTotal} done · water ${todayLog.water_ml ?? 0}ml · calories ${todayLog.calories ?? "not logged"} · weight ${todayLog.weight_kg ?? "not logged"}kg.`
    );
  } else {
    lines.push("- Today's daily log: nothing logged yet today.");
  }

  // Latest weekly check-in.
  const checkin = checkinRes.data?.[0];
  if (checkin) {
    lines.push(
      `- Latest weekly check-in (week ${checkin.week}): adherence ${checkin.adherence}, skin ${checkin.skin_reaction}, sleep ${checkin.sleep_quality}, weight trend ${checkin.weight_trend}. Total check-ins banked: ${checkinCountRes.count ?? 1}.`
    );
  } else {
    lines.push("- Weekly check-ins: none yet.");
  }

  if (!scan && !planRow) {
    lines.push(
      "No scan or plan on file: coach them to step one — the free scan, then their plan — without inventing any number."
    );
  }
  return lines.join("\n");
}

async function handleCoach(
  req: Request,
  body: { message?: unknown; history?: RawHistory },
  keys: string[],
  replyLanguage: string | null,
  isApp: boolean,
  pricing: AppPricing | null,
  trialDays: number,
  stream: boolean
): Promise<NextResponse | Response> {
  const premiumDeny = () =>
    NextResponse.json({ error: "coach_premium" }, { status: 403 });

  // Auth + entitlement, server-side only (mirrors /api/coach): a
  // valid Bearer token whose profile has is_premium exactly true.
  // Every failure — no service client, no/invalid token, no profile,
  // not premium — is the same 403, so free users get the native
  // paywall and no check leaks which one failed.
  const admin = serviceClient();
  const authHeader = req.headers.get("authorization") ?? "";
  const tok = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : "";
  if (!admin || !tok) return premiumDeny();
  let userId: string | null = null;
  try {
    const { data: userData } = await admin.auth.getUser(tok);
    userId = userData?.user?.id ?? null;
  } catch {
    userId = null;
  }
  if (!userId) return premiumDeny();
  let isPremium = false;
  try {
    const { data: profile } = await admin
      .from("profiles")
      .select("is_premium")
      .eq("id", userId)
      .single();
    isPremium = profile?.is_premium === true;
  } catch {
    isPremium = false;
  }
  if (!isPremium) return premiumDeny();

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message || message.length > 800) {
    return NextResponse.json(
      { error: "Ask a question about the app (up to 800 characters)." },
      { status: 400 }
    );
  }

  // Daily cap — counted from the server-written chat_messages rows,
  // exactly like /api/coach, so direct API callers can't bypass it.
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const { count } = await admin
    .from("chat_messages")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("role", "user")
    .gte("created_at", startOfDay.toISOString());
  if ((count ?? 0) >= COACH_DAILY_CAP) {
    // Stream mode speaks plain text only — a JSON body here would
    // land in the chat verbatim.
    if (stream) return textResponse(COACH_CAP_REPLY);
    return NextResponse.json({ reply: COACH_CAP_REPLY }, { status: 200 });
  }

  // The route persists the exchange ITSELF (the /api/coach pattern):
  // the user message goes in BEFORE generation — that's what makes
  // the cap count real — and the assistant reply after success.
  await admin
    .from("chat_messages")
    .insert({ user_id: userId, role: "user", content: message });

  const context = await buildCoachContext(admin, userId).catch(() => "");
  // App callers get the app knowledge (screens, flows, local
  // pricing, in-app links) between the coach layer and their
  // CONTEXT — the coach answers app questions from it and
  // personal questions from CONTEXT. Non-app callers keep the
  // original coach prompt.
  const coachSystem = isApp
    ? `${MAX_VOICE}\n\n${COACH_LAYER}\n\n${appKnowledge(pricing, trialDays, "coach")}${
        context ? `\n\n${context}` : ""
      }${replyLanguage ? languageDirective(replyLanguage) : ""}`.replaceAll(
        "Mewmax",
        "MewMax"
      )
    : `${MAX_VOICE}\n\n${COACH_LAYER}${
        context ? `\n\n${context}` : ""
      }${replyLanguage ? languageDirective(replyLanguage) : ""}`;
  const contents = [
    ...normaliseHistory(body.history),
    { role: "user", parts: [{ text: message }] },
  ];

  // Stream mode (native Coach tab): tokens reach the client as
  // they arrive instead of after the whole reply generates. The
  // assembled reply is persisted before the stream closes, exactly
  // like the JSON path; the busy fallback is not persisted either
  // way.
  if (stream) {
    return streamResponse(async (emit) => {
      const reply = await streamReply(keys, contents, coachSystem, emit);
      if (reply === null) {
        emit(COACH_BUSY_REPLY);
        return;
      }
      await admin
        .from("chat_messages")
        .insert({ user_id: userId, role: "assistant", content: reply });
    });
  }

  // Same rotation as support mode: dedicated keys × models.
  for (const key of keys) {
    for (const model of MODELS) {
      const reply = await askGemini(key, model, contents, coachSystem);
      if (reply) {
        await admin
          .from("chat_messages")
          .insert({ user_id: userId, role: "assistant", content: reply });
        return NextResponse.json({ reply });
      }
    }
  }
  return NextResponse.json({ reply: COACH_BUSY_REPLY }, { status: 200 });
}

/* ------------------------------------------------------------------ */

export async function POST(req: Request) {
  const keys = supportKeys();

  let body: {
    message?: unknown;
    history?: RawHistory;
    mode?: unknown;
    language?: unknown;
    client?: unknown;
    pricing?: unknown;
    stream?: unknown;
  };
  try {
    const parsed: unknown = await req.json();
    body =
      parsed && typeof parsed === "object"
        ? (parsed as typeof body)
        : {};
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Stream mode (native Coach tab): the reply arrives as plain-text
  // chunks instead of one JSON body. Absent/false keeps the exact
  // current JSON behavior — the web widget and old app versions
  // never see a change.
  const stream = body.stream === true;

  if (keys.length === 0) {
    if (stream) {
      return textResponse(
        "Support chat is briefly unavailable — please try again in a little while."
      );
    }
    return NextResponse.json(
      { reply: "Support chat is briefly unavailable — please try again in a little while." },
      { status: 200 }
    );
  }

  // The app-selected reply language (whitelisted; null = English).
  const replyLanguage = sanitiseReplyLanguage(body.language);

  // Native-app callers send client: "app" + their local pricing
  // snapshot (validated; null when absent or malformed). The web
  // widget sends neither and keeps the website prompt verbatim.
  const isApp = body.client === "app";
  const pricing = isApp ? sanitisePricing(body.pricing) : null;

  // The owner's trial_days app setting — read once, used by both
  // modes' pricing blocks (support path used to read it later).
  const { trial_days: trialDays } = await getAppSettings();

  // Coach mode branches before the public per-IP cap: it is
  // authenticated and carries its own per-user DB cap instead.
  if (body.mode === "coach") {
    return handleCoach(
      req,
      body,
      keys,
      replyLanguage,
      isApp,
      pricing,
      trialDays,
      stream
    );
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (overCap(ip)) {
    return NextResponse.json(
      {
        reply: isApp
          ? "You've hit today's support chat limit on this connection. The Vault covers most questions — and if you're Pro, the Coach tab can help with your plan."
          : "You've hit today's support chat limit on this connection. The guides at /guides cover most questions, and the Coach in your dashboard can help with your plan.",
      },
      { status: 200 }
    );
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message || message.length > 800) {
    return NextResponse.json(
      { error: "Ask a question about the app (up to 800 characters)." },
      { status: 400 }
    );
  }
  const contents = [
    ...normaliseHistory(body.history),
    { role: "user", parts: [{ text: message }] },
  ];

  // App callers get the app system prompt (app knowledge, local
  // pricing, in-app links — the trial is baked into its pricing
  // block). Web callers keep the existing prompt, with the trial
  // Max quotes from the owner's trial_days app setting
  // (/admin/settings). 0 = NO free trial (the product rule since
  // 2026-10-23): both trial mentions in the prompt are swapped for
  // the no-trial facts. 3 keeps the prompt as written; 7 rewrites
  // the length.
  const system = isApp
    ? buildAppSystem(pricing, trialDays)
    : trialDays === 0
      ? SYSTEM.replace(
          "- TRIAL: 3-day free trial on Monthly and Yearly only. Weekly has NO trial — it bills from day one.",
          "- TRIAL: there is NO free trial. Every plan — Weekly, Monthly, Yearly — bills from day one. Never tell anyone a trial exists."
        ).replace(
          "• Risk-free angle: Monthly and Yearly start with a 3-day free trial — they can see the entire plan before paying anything.",
          "• Low-risk angle: there is no free trial — but the first scan, the score and the preview plan are free forever before they pay anything, and cancelling is one tap and stops future billing."
        )
      : trialDays === 3
        ? SYSTEM
        : SYSTEM.replaceAll("3-day", `${trialDays}-day`);

  // The app-selected reply language goes LAST, after every other
  // prompt adjustment, so nothing overwrites it.
  const systemWithLanguage = replyLanguage
    ? system + languageDirective(replyLanguage)
    : system;

  // Stream mode (same shape as coach mode; nothing calls support
  // mode with stream yet — the native support panel still uses the
  // JSON path — but the route answers it identically).
  if (stream) {
    const busy = isApp
      ? "I'm having trouble answering right now — try again in a moment. Meanwhile the Vault covers most how-to questions."
      : "I'm having trouble answering right now — try again in a moment. Meanwhile /guides covers most how-to questions.";
    return streamResponse(async (emit) => {
      const reply = await streamReply(
        keys,
        contents,
        systemWithLanguage,
        emit
      );
      if (reply === null) emit(busy);
    });
  }

  // Rotate across Max's dedicated keys; a quota hit or outage on one
  // key falls through to the next key, then the next model.
  for (const key of keys) {
    for (const model of MODELS) {
      const reply = await askGemini(key, model, contents, systemWithLanguage);
      if (reply) return NextResponse.json({ reply });
    }
  }
  return NextResponse.json(
    {
      reply: isApp
        ? "I'm having trouble answering right now — try again in a moment. Meanwhile the Vault covers most how-to questions."
        : "I'm having trouble answering right now — try again in a moment. Meanwhile /guides covers most how-to questions.",
    },
    { status: 200 }
  );
}
