# Skincare KB Input — extracted from user-supplied references (2026-10-20)

Source A: "Daily Glow & De-Tanning Routine" PDF (morning/night routine + day rules).
Source B: TikTok "entering:" stack meme (looksmaxxing product stack).
Source C: Instagram reel @dpy2k (30-day looksmaxxing challenge checklist).

## Safety classification (must be respected when seeding data/kb/)

- **SAFE (put in KB as recommendations)**: OTC skincare actives and habits with broad consensus.
- **RX-ONLY (KB may mention the *category* with "consult a dermatologist" framing; NEVER recommend directly, never give dosage/frequency)**: tretinoin, isotretinoin, hydrocortisone, bimatoprost, minoxidil.
- **EXCLUDE entirely**: topical aminophylline, xanthigen, GHK-Cu, DSIP (experimental/unregulated compounds); 600mg caffeine (unsafe dose — keep general "moderate caffeine" guidance instead, ≤400mg/day); melatonin as a recommendation (keep as "discuss sleep with a doctor" only).

## SAFE values to seed

### Morning routine template (oily/combination, glow + de-tan focus)
1. Gentle cleanser — mild, non-drying (e.g. Cetaphil-type gentle cleanser).
2. Vitamin C serum 10–15% — 2–3 drops on clean dry skin, pat gently (antioxidant + brightening).
3. Moisturizer — lightweight layer if skin feels dry/tight.
4. Sunscreen SPF 50+ PA++++ — two finger-lengths, face + ears + neck. **Reapply every 2–3 hours** outdoors or near windows; wear cap/hat/sunglasses in midday sun.

### Night routine template
1. Gentle cleanser — thorough, removes sunscreen/sebum/pollutants.
2. Retinol/retinal (OTC) — pea-sized amount on completely dry face (cell renewal, fades pigmentation over time). Start 2x/week, build up.
3. Moisturizer.

### De-tan specific notes
- Stop new melanin production first (strict sun protection), then fade existing tan — sunscreen is what prevents the tan from returning.
- Kojic acid and azelaic acid are useful brightening agents for hyperpigmentation (OTC in most regions).
- Salicylic acid for oily/acne-prone skin (exfoliant).

### Supporting actives (SAFE list)
- Azelaic acid, salicylic acid, niacinamide, panthenol, kojic acid — with one-line "what it does" descriptions.
- Ice + gua sha (morning depuff ritual); homemade mask (haldi + besan + curd) as an optional traditional brightening mask.

### Diet & lifestyle for skin (from sources)
- Protein-rich diet, fiber (gut–skin link), fruits, fermented foods; cut heavily on added sugar.
- ~4–5L water daily with electrolytes (do NOT present 5L as a flat rule — pair with electrolyte note).
- 10,000 steps/day, cardio 3–5x/week, weights 4–5x/week, walk after meals.
- Sleep: 7–9h; last meal cut-off 2–3h before bed; nasal breathing at night.
- Supplements (general-wellness framing, "consider discussing with a doctor"): magnesium glycinate, vitamin D3+K2, chelated zinc, omega-3 fish oil, collagen + vitamin C.

### Posture/appearance habits (from dpy2k checklist — lifestyle section, not skincare)
- Chin tucks, wall angels (posture), eyebrow shaping (grooming), mouth tape for nasal breathing (present with caution note), hyoid/tongue posture exercises (present as habit, not promised outcome).

## RX-ONLY framing (for the LLM system prompt + KB notes, not as recommendations)
- "Retinoids (e.g. tretinoin) are prescription-only in most regions and the gold standard for acne/photoaging — talk to a dermatologist about whether they're right for you." Never dosage, never "you should use X%".
- Same pattern for: isotretinoin (severe acne, derm-only), hydrocortisone (short-term, derm guidance), bimatoprost/minoxidil (lash/hair — derm discussion).

## RX reference (for KB "dermatologist-only" framing — NEVER as direct recommendations)

**1. Tretinoin (topical retinoid)**
- Prescription-only in India, the US, UK, and most regions.
- Benefits: the most evidence-backed topical for acne, photoaging, fine lines, uneven tone and texture. The gold-standard retinoid in dermatology.
- Doctor needed: YES — a dermatologist should assess your skin and set strength/frequency. Causes irritation, purging, and sun sensitivity at the start.

**2. Isotretinoin (oral retinoid)**
- Prescription-only everywhere; tightly controlled.
- Benefits: the most powerful acne treatment in existence — can permanently resolve severe, nodular, or treatment-resistant acne.
- Doctor needed: YES, absolutely — requires blood tests, ongoing monitoring, and strict pregnancy prevention (highly teratogenic). Never taken casually.

**3. Hydrocortisone (topical corticosteroid)**
- Low strength (1%) OTC in many regions; higher strengths prescription-only.
- Benefits: calms inflammation, redness, and eczema/dermatitis flares fast.
- Doctor needed: for facial use, YES — steroids can thin facial skin and trigger steroid rosacea with prolonged use. Short-term, guided use only.

**4. Bimatoprost (prostaglandin analog — Latisse for lashes)**
- Prescription-only.
- Benefits: longer, thicker, darker eyelashes (originally a glaucoma eye drop; lash growth was the discovered side effect).
- Doctor needed: YES — it's an eye-area product with real risks (iris pigmentation change, irritation). Never without medical supervision.

**5. Minoxidil (hair loss)**
- Topical (2%/5%) OTC in India and the US; the oral form is prescription-only.
- Benefits: the most evidence-backed hair-regrowth treatment; also used off-label for beard/eyebrow density.
- Doctor needed: recommended — a dermatologist should confirm the cause of hair loss first (not all hair loss responds to minoxidil).

**App framing line**: "Prescription treatments exist for [concern] and can be very effective, but they need a dermatologist's supervision. What we help with is everything around them — the routine, the habits, the tracking."

## Notes for the plan generator
- Indian skin context matters (user is building for a global audience incl. India): emphasize de-tanning, hyperpigmentation, and high-UV protection; PA++++ ratings; affordable product *types* (never brand endorsements).
- Every recommendation must carry its "why" tied to a measurement or quiz answer.
- Safety filter must block any dosage/frequency advice for RX-ONLY items.
