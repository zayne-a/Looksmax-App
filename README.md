# Mewmax — AI Looksmaxxing, Measured Not Guessed

MVP v1 of the AI looksmaxxing / glow-up web app. Users take a quiz, upload selfies,
get **deterministic facial measurements** (computed on-device, never LLM vibes) and a
**structured week-by-week softmaxxing plan** (skin / diet / exercise / style) generated
by Gemini, grounded in a curated knowledge base.

Business model: 3-day free trial → $1.99/week subscription (half of Umax's $3.99/week),
micro-influencer affiliates on 30–40% commission via coupon codes.

## Quick start

```bash
cd ~/workspace/looksmax-app
npm install
npm run dev        # http://localhost:3000
```

Production check:

```bash
npm run build && npm start
```

## Gemini API keys (free tier works for dev)

1. Get a free key at https://aistudio.google.com/apikey (no card required).
2. Create `.env.local` in the project root (gitignored — **never commit it**):
   ```
   GEMINI_API_KEYS=key_one,key_two,key_three
   ```
   `GEMINI_API_KEYS` is a comma-separated **pool** of keys. If it is
   unset/empty, the route falls back to a single key from `GEMINI_API_KEY=...`.
3. Restart the dev server. `/api/plan` uses `gemini-3.8-flash` (fallback
   `gemini-3.6-flash`). Failover: requests rotate across the pool, and a key
   that hits a quota/rate-limit error (HTTP 429/503, `RESOURCE_EXHAUSTED`)
   cools down for 60s while the next key takes over; if every key fails, the
   route returns a realistic template-built stub plan so the UI stays demoable.

> **Production warning:** free-tier inputs may be used by Google for model training.
> Run production face-adjacent traffic on the paid tier / Vertex AI with
> zero-retention. See `docs/ai-architecture.md`.

## Architecture (see `docs/ai-architecture.md` for the full deep dive)

Three layers — the product's intelligence lives in the pipeline, not model weights:

1. **Eyes (deterministic, on-device)** — MediaPipe FaceLandmarker (478 landmarks,
   WASM in the browser) computes facial thirds, fifths, canthal tilt, jaw/cheekbone
   ratio, FWHR, symmetry, golden-ratio score, face shape + a pixel-based skin analysis
   (redness, texture, blemishes, under-eye). $0 per scan, same photo → same numbers.
2. **Knowledge base (`data/kb/`)** — the defensible asset: face-shape → haircut DB,
   skin-concern → routine protocols, body-goal → diet/exercise templates,
   metric → prioritized actions (impact × effort). Versioned JSON, expert-curated.
3. **Voice (LLM orchestration)** — `src/app/api/plan/route.ts` feeds measurements +
   quiz answers + KB excerpts to Gemini with a strict JSON schema, softmaxxing-only
   constraints, few-shot personalization examples, and a safety filter
   (blocks medical/surgical/RX-dosage content, fails closed to the stub plan).

**Personalization** (non-negotiable): plans are input-driven — goal ranking, skin
type, routine level, budget tier, sun exposure + scan signals reorder protocols;
every task carries a `whyYou` citing its trigger. Run the eval gate:

```bash
npx -y tsx scripts/eval-personalization.ts   # fails if any archetype pair overlaps >70%
```

## Pages

| Route | What it is |
|---|---|
| `/` | Landing: hero, how it works, 8 differentiators, pricing teaser, FAQ |
| `/quiz` | 12-step onboarding (goals ranked 1–3, skin, routine level, budget, lifestyle) |
| `/scan` | Front + side photo upload → on-device MediaPipe measurement (graceful fallback) |
| `/plan` | Measurements + structured AI plan with week-by-week tasks and `whyYou` notes |
| `/calculators` | Toolbox: BMI, Navy body-fat %, FFMI, TDEE + macros (SEO landing pages later) |
| `/paywall` | **UI stub only** — 3 plan cards, coupon field, trial explainer (no real billing) |
| `/api/plan` | POST `{measurements, quiz}` → `{plan, source: "gemini" \| "stub"}` |

## Project layout

```
src/app/            # routes (page.tsx per route)
src/app/api/plan/   # plan generation route (Gemini + safety filter + stub fallback)
src/components/     # ui.tsx, motion.tsx, Navbar, Footer
src/lib/            # types.ts, store.tsx (client state), face.ts (measurements),
                    # calculators.ts, kb.ts (KB loaders + stub builder), eval.ts
data/kb/            # knowledge base JSON (face-shapes, skin-*, body-protocols, metric-actions)
docs/               # ai-architecture.md, kb-skincare-input.md
scripts/            # eval-personalization.ts
public/images/      # generated model photography (landing)
```

## v2 roadmap (not in this MVP)

- Auth (email + Google OAuth) and user accounts
- Stripe subscriptions: 3-day trial → $1.99/week, $4.99/month, $29.99/year
- Affiliate coupon system (Rewardful/FirstPromoter-style, 30–40% rev share)
- Database for plans, progress photos, re-scan deltas
- Real-face hairstyle/beard try-on, shareable scorecards, mog battles
- Feedback loop: thumbs up/down per advice → KB improvements → future fine-tune

## Notes

- Mobile-first, dark premium theme (ink + gold). Motion via framer-motion.
- No emojis in UI. Copy voice: confident, second-person, motivational.
- Safety: softmaxxing only — no diagnoses, no drug/hormone/surgery specifics;
  "not medical advice" disclaimers throughout. See the safety filter in
  `src/app/api/plan/route.ts`.
