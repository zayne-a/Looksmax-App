# AI Architecture Deep Dive: How the App Analyzes Users and Builds Structured Plans

_Date: 2026-10-20. Status: v1 architecture for the looksmaxxing app MVP._

## The headline: we don't "train" a model

Three options exist, and only one makes sense for us:

| Approach | What it is | Verdict |
|---|---|---|
| Train from scratch | Custom vision model on millions of labeled faces | ❌ Millions of dollars, massive dataset, months. Absurd for this. |
| Fine-tune an LLM | Train Gemini/GPT on our own examples | ⚠️ Useful later, but doesn't fix the core problem: LLMs measure facial ratios at ~35% accuracy. Fine-tuning doesn't teach a language model geometry. |
| **Deterministic measurement + structured KB + LLM orchestration** | **Measure with computer vision, decide with a curated knowledge base, write with an LLM** | ✅ **This is our architecture.** |

The product's intelligence lives in the knowledge base and the pipeline, not in model weights.

## Layer 1 — The Eyes (deterministic measurement, on-device)

- **MediaPipe FaceLandmarker** (Google, Apache 2.0, free): 478 3D facial landmarks, runs **in the browser via WASM** — the photo never leaves the user's device for measurement.
- Computes: facial thirds (target 1:1:1), horizontal fifths, canthal tilt (degrees), gonial angle, jaw÷cheekbone width, FWHR, symmetry score, golden-ratio checks.
- **Skin analysis** (separate pixel-analysis pass, also on-device): redness, texture variance, blemish count, under-eye darkness.
- **Body metrics** from user inputs (height, weight, waist, neck): Navy-method body fat %, FFMI, BMI, TDEE/macros.
- Cost: $0 per scan. Reproducible: same photo → same numbers, every time. This alone fixes competitors' #1 trust complaint.

## Layer 2 — The Knowledge Base (the real "training")

This is where the app's expertise actually lives — a **curated, versioned, expert-reviewed database**, not model weights:

- **Face shape → haircut DB**: measured proportions map to face-shape classification → ranked haircut recommendations with reference descriptions.
- **Skin concern → routine protocols**: concern (acne, redness, dullness, oiliness…) × severity → step-by-step routine templates (cleanser → treatment → moisturizer → SPF), with product *types* (never brand shilling).
- **Body composition → diet/exercise protocols**: body-fat % and goal (cut/maintain) → TDEE-based calorie targets, macro splits, training-day structure.
- **Metric weakness → prioritized actions**: every finding gets an impact score (how much it matters) and an effort score (how hard it is to change) → the plan attacks high-impact, low-effort items first.
- **Moat note**: this KB is the defensible asset. It's improvable forever, it compounds with user feedback, and no one can copy it by calling an API.

## Layer 3 — The Voice (LLM orchestration)

- **Gemini** (free tier for dev; **paid tier in production** — free-tier inputs may be used for training, which is a privacy landmine for face photos).
- Input: measurements + quiz answers (age, goals, skin type, lifestyle, motivation) + KB-matched protocol templates.
- Output: **strict JSON schema** — plan sections (skin / diet / exercise / style), each with week-by-week tasks, priority ranking, and "why this matters for you" explanations tied to the user's actual numbers.
- Prompt system: role ("evidence-based softmaxxing coach"), hard constraints (softmaxxing only; no medical diagnoses; no surgery/finasteride/hormone specifics; supportive tone, never shaming; every claim tied to a measurement), few-shot examples of good plans.
- **Validation layer**: schema check → safety filter (blocklist: medical, surgical, extreme) → fallback to pure template output if the LLM fails. The app never ships unvalidated prose.

## How a plan gets built (the pipeline)

1. **Capture**: front + side photos → landmarks → metrics. Quiz → goals, age, skin type, lifestyle, motivation.
2. **Analyze**: rule engine turns metrics into findings ("skin redness above threshold", "lower third short relative to midface").
3. **Retrieve**: findings → KB protocol templates, ranked by impact × effort.
4. **Generate**: LLM personalizes — adjusts for user context, writes motivating copy, outputs structured plan JSON.
5. **Validate**: schema + safety checks; fallback to templates on failure.
6. **Deliver**: plan UI with week-by-week tasks, check-ins, and progress-tracking hooks (re-scan deltas feed back into step 1).

## What "training" actually means for us (roadmap)

- **Phase 1 (now)**: KB curation + prompt engineering + eval set (50 test faces, human-graded plan quality). No model training at all.
- **Phase 2 (post-launch)**: collect feedback — thumbs up/down per advice item, plan adherence, re-scan metric deltas. This becomes our dataset.
- **Phase 3 (scale)**: fine-tune the advisor on (metrics → plan → outcome) triples; train a reranker for advice quality; distill to a cheaper model if volume demands it.
- **Never**: train on raw user photos without explicit consent; run production face data through free-tier APIs.

## Personalization spec (non-negotiable — added 2026-10-20 per founder)

No two subscribers get the same plan. Personalization is driven by three input streams, and every recommendation must cite the specific input that triggered it.

### Input signals
- **From pictures** (Layer 1): skin redness level, blemish count, texture score, under-eye darkness, oiliness signals; face geometry metrics (drive style/haircut recs).
- **From quiz**: primary goal (ranked 1–3: e.g. clear acne, glow, de-tan, anti-aging), skin type (oily/dry/combination/sensitive), current routine level (none/basic/advanced), age band, lifestyle (outdoor/desk), budget tier.
- **From behavior** (post-launch): adherence, re-scan deltas, thumbs up/down per advice item.

### Decision rules (examples — the KB encodes the full matrix)
- Blemishes high + oily signals → acne protocol first (salicylic acid, lightweight gel moisturizer, strict AM/PM consistency); glow steps deferred to week 3+.
- Redness high → barrier repair first 2 weeks (panthenol, azelaic acid); NO strong actives until redness drops.
- Hyperpigmentation → vitamin C + azelaic/kojic acid + SPF 50+ PA++++ with reapplication discipline as the headline habit.
- Dry + dull → hydration layering, richer moisturizer, gentle exfoliation 1x/week max.
- Routine level "none" → 3-step starter (cleanser → moisturizer → SPF) for 2 weeks before ANY active is introduced.
- Routine level "advanced" → actives with proper sequencing rules (e.g. vitamin C AM, retinoid PM, never layered).
- Goal ranking reorders the plan: if goal #1 is "clear acne", the acne protocol leads the week structure even if glow items exist.

### Anti-generic guardrails
1. Every plan item carries a `whyYou` field citing its trigger ("because your scan showed elevated redness…", "because you ranked de-tanning #1…").
2. The LLM system prompt includes 2–3 few-shot examples showing DIFFERENT inputs → visibly DIFFERENT plans.
3. Eval gate: 5 archetype users (oily-acne beginner, dry-dull 30s, hyperpigmentation-focused, sensitive-redness, advanced maintenance) → plans must differ in actives, order, and priorities. Fail the build if >70% overlap in recommended product types across archetypes.
4. Log a diversity metric per generated plan; review weekly post-launch.

## Costs at scale

- Measurement: $0 (on-device).
- Plan generation: ~$0.002–0.01 per plan on the Gemini paid tier.
- At 500 paying subs/month generating ~2,000 plans: single-digit dollars/month in AI costs. The 30–40% affiliate cut dominates unit economics, not AI.

## Guardrails (non-negotiable)

- **Score inflation**: RLHF makes LLMs complimentary (they average ~7/10 vs human ~5/10). Our scores are anchored to deterministic measurements, never to LLM vibes.
- **Medical**: hard blocklist — no diagnoses, no drug/hormone/surgery specifics, "consult a professional" disclaimers everywhere.
- **Consistency**: same photo in → same score out. Always. This is the trust foundation competitors lack.
- **Tone**: supportive coach, never a judge. No leaderboards, no "mogging."
