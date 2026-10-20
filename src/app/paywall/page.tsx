"use client";

import { useState } from "react";
import { Button, Card, Eyebrow } from "@/components/ui";
import { Reveal, staggerParent, staggerChild } from "@/components/motion";
import { motion } from "@/components/motion-client";

const plans = [
  {
    id: "weekly",
    name: "Weekly",
    price: "$1.99",
    per: "/week",
    note: "Half the price of the rating apps",
    sub: "starts after your 3-day free trial",
    highlight: false,
    best: false,
  },
  {
    id: "monthly",
    name: "Monthly",
    price: "$4.99",
    per: "/month",
    note: "just $1.15/week",
    sub: "starts after your 3-day free trial",
    highlight: false,
    best: false,
  },
  {
    id: "yearly",
    name: "Yearly",
    price: "$29.99",
    per: "/year",
    note: "just $0.58/week — commit to the climb",
    sub: "starts after your 3-day free trial",
    highlight: true,
    best: true,
  },
];

const valueProps = [
  "Measured, not guessed — deterministic facial scores",
  "Unlimited rescans whenever you want",
  "Real week-by-week skin, diet, exercise & style protocols",
  "Progress tracking that shows what's improving",
  "Real-face try-on (planned for v1)",
  "A coach with memory of your measurements and goals",
  "Free toolbox: BMI, body-fat & facial-ratio calculators",
  "Shareable scorecard for every milestone",
];

export default function PaywallPage() {
  const [coupon, setCoupon] = useState("");
  const [couponApplied, setCouponApplied] = useState(false);
  const [comingSoon, setComingSoon] = useState<string | null>(null);

  const applyCoupon = () => {
    if (coupon.trim().length > 0) setCouponApplied(true);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-2xl text-center">
        <Reveal>
          <Eyebrow>Ascend Pro</Eyebrow>
          <h1 className="font-display mt-4 text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.05]">
            Lock in your glow-up.
            <br />
            <span className="gold-text">3 days free.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-sm sm:text-base leading-relaxed text-muted">
            Your first scan is already free. Pro unlocks the full protocol —
            try everything for 3 days, pay nothing if it's not for you.
          </p>
        </Reveal>
      </div>

      {/* PLAN CARDS */}
      <motion.div
        variants={staggerParent}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-60px" }}
        className="mt-12 grid gap-4 sm:grid-cols-3"
      >
        {plans.map((p) => (
          <motion.div key={p.id} variants={staggerChild}>
            <Card
              glow={p.best}
              className={`lift relative flex h-full flex-col ${
                p.best ? "border-gold/60" : ""
              }`}
            >
              {p.best && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gold px-4 py-1 text-xs font-extrabold uppercase tracking-widest text-ink shadow-[0_0_20px_rgba(227,185,78,0.6)]">
                  Best value
                </span>
              )}
              <h3 className="font-display text-lg font-extrabold text-bone">
                {p.name}
              </h3>
              <p className="mt-3">
                <span className="font-display text-5xl font-extrabold tracking-tight text-gold-soft">
                  {p.price}
                </span>
                <span className="text-muted">{p.per}</span>
              </p>
              <p className="mt-2 text-sm font-bold text-gold">{p.note}</p>
              <p className="text-xs text-muted">{p.sub}</p>
              <div className="mt-6 flex-1" />
              <Button
                onClick={() => setComingSoon(p.id)}
                className="w-full py-3.5"
                variant={p.best ? "primary" : "ghost"}
              >
                {comingSoon === p.id
                  ? "Payments coming soon"
                  : `Start 3-day trial — ${p.name}`}
              </Button>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* COUPON */}
      <Reveal className="mt-6">
        <Card>
          <h3 className="font-display text-lg font-extrabold text-bone">
            Have a creator code?
          </h3>
          <p className="mt-1 text-sm text-muted">
            Our micro-influencer partners get you 20% off. Ask yours for a
            code.
          </p>
          {couponApplied ? (
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 rounded-2xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm font-bold text-gold-soft"
            >
              20% off applied — demo state, no payment processed.
            </motion.p>
          ) : (
            <div className="mt-4 flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={coupon}
                onChange={(e) => setCoupon(e.target.value)}
                placeholder="Enter coupon code"
                aria-label="Coupon code"
                className="input-premium flex-1"
              />
              <Button onClick={applyCoupon} variant="ghost" className="px-8">
                Apply
              </Button>
            </div>
          )}
        </Card>
      </Reveal>

      {/* TRIAL EXPLAINER */}
      <Reveal className="mt-6">
        <Card>
          <h3 className="font-display text-lg font-extrabold text-bone">
            How your 3-day trial works
          </h3>
          <ol className="mt-4 space-y-3 text-sm text-muted list-none">
            {[
              ["Day 0", "Start your trial. Unlock the full week-by-week plan, unlimited rescans, and progress tracking. No charge."],
              ["Day 3", "Trial ends. Stay on your chosen plan or cancel in one tap — no charge either way if you leave."],
              ["After", "Keep scanning, keep tracking, keep climbing. Cancel anytime."],
            ].map(([day, text]) => (
              <li key={day} className="flex gap-3">
                <span className="shrink-0 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs font-extrabold text-gold-soft">
                  {day}
                </span>
                <span className="leading-relaxed">{text}</span>
              </li>
            ))}
          </ol>
        </Card>
      </Reveal>

      {/* VALUE PROPS */}
      <Reveal className="mt-6">
        <Card>
          <h3 className="font-display text-lg font-extrabold text-bone">
            Everything Pro unlocks
          </h3>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {valueProps.map((v) => (
              <li key={v} className="flex items-start gap-2.5 text-sm text-muted">
                <svg
                  aria-hidden
                  className="mt-0.5 h-5 w-5 shrink-0 text-gold"
                  viewBox="0 0 20 20"
                  fill="none"
                >
                  <circle
                    cx="10"
                    cy="10"
                    r="9"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M6.5 10.2l2.4 2.4 4.6-5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="leading-relaxed">{v}</span>
              </li>
            ))}
          </ul>
        </Card>
      </Reveal>

      <p className="mt-10 text-center text-xs text-muted/80">
        Cancel anytime. Not medical advice. Prices in USD.
      </p>
    </div>
  );
}
