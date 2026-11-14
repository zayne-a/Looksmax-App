/**
 * COACH KNOWLEDGE — scraped looksmaxxing methods (Blend Slice 5, 2026-11-15).
 *
 * DESIGN
 * - STORE: a data file in this repo, not a Supabase table. Both Coach
 *   routes are Next.js server routes in this repo, so a plain module
 *   import is readable at request time with zero new infrastructure,
 *   zero added latency and zero cost, and the batch is versioned with
 *   the code. A Supabase table would need a dashboard SQL migration
 *   plus a DB round-trip on every Coach message, for no v1 benefit.
 * - RETRIEVAL: keyword retrieval in memory (retrieveCoachMethods).
 *   The question is tokenised, each method scores on keyword overlap
 *   (exact keyword hit 3, multi-word phrase 4, stem-ish partial 1,
 *   name-word 1), and the top N above the threshold (score >= 3) are
 *   returned. No vector DB exists in this stack, and keyword retrieval
 *   is enough for 36 entries. v1 is English-keyword only: a
 *   non-English question will not keyword-match, and the Coach then
 *   answers from its own capability (see below) — that is a known v1
 *   limitation, not a bug.
 * - CITATION: when methods match, the route injects them into the
 *   system prompt (name + what + how-to + source URL) via
 *   coachMethodsPromptBlock, with an instruction to answer from them
 *   in the Coach's own words and cite the source URL inline. The
 *   COACH_LAYER in max-voice.ts carries the standing version of that
 *   rule, so both Coach surfaces cite the same way.
 * - RETRIEVAL ENHANCES, NEVER GATES: when nothing matches, no block
 *   is injected and the Coach answers from its own capability exactly
 *   as before. A retrieved method that doesn't fit is ignored by the
 *   model (the block says so), and the model must never invent a
 *   source URL.
 * - SOURCING: every entry is a short paraphrase (our own words, never
 *   copied text) of the public guide at its source URL. All sources
 *   are public, non-paywalled, non-login-walled pages whose robots.txt
 *   allows the article path for general crawlers; a few carry a
 *   Cloudflare content-signal of ai-train=no / use=reference — this
 *   use is reference-with-citation, not training, and the entries are
 *   summaries, not reproductions. Nothing here is invented, and
 *   nothing here touches the plan KB (src/lib/plan/kb.ts in the
 *   native repo) — scraped knowledge is the COACH's knowledge only.
 *   To grow the batch, append entries here with keywords + a source
 *   URL; no route change is needed.
 */

export type CoachMethodSection = "skin" | "diet" | "exercise" | "style";

export interface CoachMethod {
  id: string;
  name: string;
  section: CoachMethodSection;
  /** Lowercase single words or phrases the question is matched against. */
  keywords: string[];
  /** What the method is, in our own words (1–2 sentences). */
  what: string;
  /** How to do it, in our own words (concrete steps / doses). */
  howTo: string;
  /** Public source URL this entry was summarised from. */
  source: string;
}

export const COACH_METHODS: CoachMethod[] = [
  // ------------------------------------------------------------ SKIN
  {
    id: "cleanser-twice-daily",
    name: "Gentle cleanser twice daily",
    section: "skin",
    keywords: ["cleanser", "cleansing", "wash", "face wash", "cleanse", "foam", "gel cleanser"],
    what: "Washing morning and night with a gentle cleanser matched to your skin type removes sweat, oil, dead skin and sunscreen that clog pores and dull skin.",
    howTo:
      "Wash every morning and night with lukewarm water and gentle massage; gel or foaming cleanser for oily or acne-prone skin, lotion or cream cleanser for dry or sensitive skin. Pat dry, never rub; no hot water, no harsh scrubbing.",
    source:
      "https://www.geisinger.org/health-and-wellness/wellness-articles/2026/04/10/12/54/build-a-skincare-routine-beginners",
  },
  {
    id: "moisturizer-damp-skin",
    name: "Moisturizer on damp skin",
    section: "skin",
    keywords: ["moisturizer", "moisturise", "moisturize", "hydration", "hydrated", "dry skin", "damp"],
    what: "Moisturizer restores water to the skin after washing and supports the barrier that keeps moisture in — every skin type needs it, including oily skin.",
    howTo:
      "Apply to slightly damp skin right after washing. Gel or lotion with glycerin or hyaluronic acid for oily or combination skin; cream with ceramides for dry or mature skin; fragrance-free minimal formulas for sensitive skin.",
    source:
      "https://www.geisinger.org/health-and-wellness/wellness-articles/2026/04/10/12/54/build-a-skincare-routine-beginners",
  },
  {
    id: "sunscreen-spf30",
    name: "Sunscreen SPF 30+ every day",
    section: "skin",
    keywords: ["sunscreen", "spf", "sun", "uv", "sunblock", "protection", "tan"],
    what: "Daily broad-spectrum sunscreen is the single highest-ROI skincare step — UV is the biggest driver of wrinkles, dark spots and loss of firmness, and it reaches you through windows and on cloudy days.",
    howTo:
      "Broad-spectrum SPF 30 or higher every morning, about a nickel-sized amount for the face (more for the neck). Reapply every 2 hours outdoors or after sweating. Mineral formulas suit dry or sensitive skin; chemical formulas feel lighter on oily skin.",
    source:
      "https://www.geisinger.org/health-and-wellness/wellness-articles/2026/04/10/12/54/build-a-skincare-routine-beginners",
  },
  {
    id: "retinol-night",
    name: "Retinol at night",
    section: "skin",
    keywords: ["retinol", "retinoid", "anti-aging", "antiaging", "wrinkles", "acne", "vitamin a"],
    what: "Retinol (vitamin A) is the gold-standard anti-aging and acne active: it speeds cell turnover, boosts collagen and fades dark spots.",
    howTo:
      "Start at 0.1–0.3%, twice a week at night, and build up slowly. Expect dryness and flaking for the first few weeks; buffer with moisturizer. Never the same night as exfoliating acids when starting out. Skip if pregnant.",
    source: "https://www.primelooks.app/guides/skincare-routine/",
  },
  {
    id: "vitamin-c-morning",
    name: "Vitamin C serum in the morning",
    section: "skin",
    keywords: ["vitamin c", "serum", "brightening", "brighten", "pigmentation", "dark spots", "antioxidant"],
    what: "A morning vitamin C serum brightens skin, fades pigmentation and boosts your sunscreen's protection.",
    howTo:
      "Use 10–20% L-ascorbic acid in the morning, under moisturizer and SPF. Introduce it separately from retinol (vitamin C in the morning, retinol at night) so you can spot irritation. Replace the serum if it turns dark orange — it has oxidized.",
    source: "https://www.primelooks.app/guides/skincare-routine/",
  },
  {
    id: "chemical-exfoliation",
    name: "Chemical exfoliation (AHA/BHA)",
    section: "skin",
    keywords: ["exfoliation", "exfoliate", "aha", "bha", "salicylic", "glycolic", "lactic", "acid", "pores", "blackheads", "texture"],
    what: "Chemical exfoliants dissolve the dead skin and oil that clog pores — salicylic acid (BHA) for clogged pores, glycolic or lactic acid (AHA) for texture.",
    howTo:
      "Once or twice a week, not the same night as retinol when starting out. One exfoliating step at a time — scrubs plus acids plus retinol destroys the barrier. Give any product 6–8 weeks before judging it.",
    source: "https://www.primelooks.app/guides/skincare-routine/",
  },
  {
    id: "niacinamide-serum",
    name: "Niacinamide serum",
    section: "skin",
    keywords: ["niacinamide", "b3", "redness", "oil", "oily", "blotchy", "barrier"],
    what: "Niacinamide (vitamin B3) is the gentle all-rounder: it reduces redness and blotchiness, regulates oil and supports the skin barrier, and plays nicely with everything.",
    howTo:
      "A 4–5% serum is a great first active, especially for sensitive skin. Layer thinnest to thickest — water-based serums like niacinamide go on after cleansing, before moisturizer.",
    source: "https://www.primelooks.app/guides/skincare-routine/",
  },
  {
    id: "gua-sha",
    name: "Gua sha lymphatic drainage",
    section: "skin",
    keywords: ["gua sha", "guasha", "lymphatic", "drainage", "massage", "roller", "jade roller", "sculpt"],
    what: "Gua sha is a flat stone tool stroked over the face for lymphatic drainage — lymph only moves one way, toward the ears and down the neck, so every stroke follows that route. It reduces puffiness and improves contour by moving fluid; it doesn't add volume or lift tissue.",
    howTo:
      "Apply facial oil first — never work on dry skin. Hold the tool nearly flat (15–30 degrees) with feather-light pressure. Open the drains first: 5 gentle strokes down each side of the neck, then sweep jawline, cheeks and brow outward toward the ears, 5 strokes each, and finish by draining the neck again. 1–5 minutes daily; skip active breakouts, rashes or sunburn.",
    source: "https://www.akaraintegrative.com/blog/how-to-use-gua-sha-on-face",
  },
  {
    id: "ice-rolling",
    name: "Ice rolling / cold compress for puffiness",
    section: "skin",
    keywords: ["ice", "cold", "compress", "puffiness", "puffy", "depuff", "roller", "ice roller", "swelling", "eyes", "under-eye"],
    what: "Cold narrows small blood vessels for a short time, so a cold compress or ice roller can make morning puffiness look tighter for a while — a quick fix, not a cure.",
    howTo:
      "A cold-water rinse, a wrapped cold pack, chilled spoons or an ice roller, pressed lightly under the eyes and along the cheeks for 2–5 minutes. Never put ice directly on skin; stop if the area goes numb, painful or discolored.",
    source: "https://www.getmaxilla.com/guides/face-debloat",
  },

  // ------------------------------------------------------------ DIET
  {
    id: "morning-debloat-routine",
    name: "Morning debloat routine",
    section: "diet",
    keywords: ["debloat", "bloat", "bloated", "puffy", "puffiness", "morning", "routine", "swollen", "water retention"],
    what: "A 5-minute morning routine that moves the fluid that settled in your face overnight back down — it takes the morning edge off, it does not change face shape.",
    howTo:
      "Get up and move for a minute; drink a glass of water; splash cool water on your face or hold a cool damp cloth on eyes and cheeks for 60 seconds; then stroke lightly from the centre of the face outward toward the ears and down the neck, 5 times each. Finish with a cold spoon or cool gel mask under each eye for 30 seconds.",
    source: "https://lookist.app/blog/how-to-debloat-face",
  },
  {
    id: "low-sodium",
    name: "Low-sodium eating",
    section: "diet",
    keywords: ["sodium", "salt", "salty", "low-salt", "processed", "takeout"],
    what: "Salt makes the body hold water, and one salty dinner can show on your face the next morning — most sodium comes from processed and restaurant food.",
    howTo:
      "Keep dinner lower in salt: home-cooked eggs, yogurt, oats or fruit instead of deli meat, instant noodles or takeout. The CDC limit is 2,300 mg of sodium a day; the NHS adult salt limit is 6 g a day.",
    source: "https://www.getmaxilla.com/guides/face-debloat",
  },
  {
    id: "potassium-foods",
    name: "Potassium-rich foods",
    section: "diet",
    keywords: ["potassium", "banana", "avocado", "sweet potato", "spinach", "magnesium"],
    what: "Potassium balances sodium in the body and signals the kidneys to excrete excess fluid — pairing potassium-rich foods with lower salt is the dietary move against water retention.",
    howTo:
      "Add potassium-rich foods daily: a banana with unsalted almonds, avocado toast, Greek yogurt with berries, a handful of dried apricots, sweet potato or spinach. Extra potassium isn't safe for everyone — people with kidney disease or on certain blood pressure drugs should check with a doctor first.",
    source:
      "https://www.mindbodygreen.com/articles/these-foods-help-reduce-water-retention-and-everyday-puffiness",
  },
  {
    id: "hydration",
    name: "Hydration (6–8 cups a day)",
    section: "diet",
    keywords: ["hydration", "water", "drink", "dehydrated", "fluids", "cups"],
    what: "Drinking normally helps puffiness more than restricting fluids — when the body is short on water it hoards it. But forcing extra water does not flush your face either.",
    howTo:
      "The NHS guide is 6–8 cups or glasses of fluid a day, enough that your urine is a clear pale yellow. Drink a glass of water with your morning routine, then drink to thirst; you need more in hot weather and when you exercise.",
    source: "https://lookist.app/blog/how-to-debloat-face",
  },
  {
    id: "calorie-deficit",
    name: "Calorie deficit for a leaner face",
    section: "diet",
    keywords: ["calorie", "deficit", "fat loss", "lose fat", "weight loss", "lean", "tdee", "calories", "diet"],
    what: "Face fat only drops with overall body fat, and body fat drops on a calorie deficit — eating slightly less than you burn. There is no way to spot-reduce face fat.",
    howTo:
      "Aim for a modest deficit of 250–500 calories a day below your maintenance (TDEE, estimated with the Mifflin-St Jeor equation) — roughly 1 lb a week. Track intake honestly for a week first so the deficit is real, not guessed.",
    source: "https://www.startweightloss.com/blog/calorie-deficit-for-beginners/",
  },
  {
    id: "high-protein",
    name: "High protein (1.6–2.2 g/kg)",
    section: "diet",
    keywords: ["protein", "muscle", "grams", "build muscle", "gains", "amino"],
    what: "Protein is the building material for muscle — without enough of it, training builds far less, and dieting costs you muscle along with fat.",
    howTo:
      "Aim for 1.6–2.2 g of protein per kg of bodyweight per day, spread across meals. Prioritize whole foods (meat, fish, eggs, dairy, legumes) and use a shake only to fill the gap.",
    source: "https://ironstreak.com/blog/how-much-protein-to-build-muscle",
  },
  {
    id: "limit-alcohol",
    name: "Limit alcohol",
    section: "diet",
    keywords: ["alcohol", "drinking", "beer", "hangover"],
    what: "Alcohol is one of the most reliable causes of next-morning face puffiness — it is usually paired with a late salty meal and worse sleep, so the effect compounds.",
    howTo:
      "Skip alcohol the night before a morning that matters. If you do drink, stop early and alternate each drink with a glass of water, and keep dinner low in salt. Compare a week with alcohol against a week without, same morning photo setup, to see your own effect.",
    source: "https://www.getmaxilla.com/guides/face-debloat",
  },
  {
    id: "intermittent-fasting-16-8",
    name: "Intermittent fasting 16:8",
    section: "diet",
    keywords: ["fasting", "intermittent", "fast", "16:8", "16/8", "window", "eating window"],
    what: "16:8 intermittent fasting means eating all your food inside an 8-hour window each day and fasting for 16 hours — it works by making a calorie deficit easier to hold, not by magic.",
    howTo:
      "Pick a window that fits your day, e.g. noon to 8 pm. Eat normally inside it; drink water (and black coffee or tea) during the fast. Not for under-18s, pregnant people, or anyone with a history of eating disorders.",
    source: "https://easyfastingapp.com/blog/16-8-intermittent-fasting-guide/",
  },
  {
    id: "early-light-dinner",
    name: "Early, light dinner",
    section: "diet",
    keywords: ["dinner", "late meal", "night", "bedtime", "evening", "meal timing"],
    what: "The best debloat happens the night before: a late, salty dinner is the single biggest reason you wake up puffy.",
    howTo:
      "Finish dinner at least 2–3 hours before bed and keep it lower in salt. Home-cooked beats takeout here. Pair it with a full night of sleep and your head raised slightly on an extra pillow.",
    source: "https://lookist.app/blog/how-to-debloat-face",
  },

  // --------------------------------------------------------- EXERCISE
  {
    id: "mewing",
    name: "Mewing (tongue posture)",
    section: "exercise",
    keywords: ["mewing", "mew", "tongue", "palate", "jawline", "jaw", "oral posture", "mouth breathing", "nose breathing"],
    what: "Mewing is holding your whole tongue — including the back third — flat against the roof of your mouth, lips closed, breathing through your nose, as your default resting posture. It may improve resting facial posture and reduce mouth breathing; claims of dramatic adult bone reshaping are unproven (no rigorous trials show it reshapes adult jaws).",
    howTo:
      "Say 'sing' and hold the 'ng' — that is where the back of your tongue should press. Flatten the whole tongue across the palate with a gentle suction hold, never a forceful push. Lips sealed without strain, teeth slightly apart or barely touching, never clenched. Build the habit with reminders until it is automatic.",
    source: "https://www.primelooks.app/guides/mewing/",
  },
  {
    id: "neck-training",
    name: "Neck training (curls + extensions)",
    section: "exercise",
    keywords: ["neck", "thicker neck", "traps", "neck curl", "neck extension"],
    what: "A thicker neck frames the jawline and makes the whole head look more proportional — neck muscles respond to direct training like any other muscle.",
    howTo:
      "3 times a week: neck curls 3×12–15 and neck extensions 3×12–15, plus lateral flexion 2×12 per side, with a slow 3-second lowering phase. Start light — the neck is not a place to ego-lift.",
    source:
      "https://www.looksmaxxing.today/articles/gymmax-thicker-neck-exercises-aesthetic-physique-2026",
  },
  {
    id: "mastic-gum",
    name: "Mastic gum chewing",
    section: "exercise",
    keywords: ["mastic", "gum", "chewing", "chew", "masseter", "jawline gum"],
    what: "Chewing hard mastic gum works the masseter muscles that shape the jaw angle — the resistance is far higher than regular gum.",
    howTo:
      "Start with 5 minutes per side every other day and progress hardness slowly. Stop if you feel jaw pain or clicking — TMJ pain means back off, not push through.",
    source: "https://exercisedaily.com/top-20-jawline-gum-facial-fitness/",
  },
  {
    id: "chin-tucks",
    name: "Chin tucks (forward head posture)",
    section: "exercise",
    keywords: ["chin tuck", "posture", "forward head", "neck posture", "head posture", "hunch"],
    what: "Chin tucks train the deep neck flexors that hold your head stacked over your shoulders — a forward head position softens the jaw-neck angle on its own, puffy or not.",
    howTo:
      "Glide your chin straight back (like making a double chin) and hold 5 seconds, 3 sets of 10, twice a day. Keep the movement horizontal — no nodding down.",
    source: "https://postureguymike.com/blog/chin-tuck-exercise",
  },
  {
    id: "resistance-training",
    name: "Resistance training + progressive overload",
    section: "exercise",
    keywords: ["gym", "weights", "lifting", "resistance", "progressive overload", "strength", "workout", "train", "muscle"],
    what: "Resistance training is the foundation of a better physique: muscles only grow when they are asked to do slightly more than last time — progressive overload.",
    howTo:
      "Train all major muscle groups twice a week, 1–3 sets of 8–15 reps. Double progression: add reps first, then add 2–10% load once you hit the top of the rep range with good form.",
    source: "https://www.unitperformance.co.uk/blog/progressive-overload-for-beginners",
  },
  {
    id: "zone-2-cardio",
    name: "Zone 2 cardio",
    section: "exercise",
    keywords: ["zone 2", "cardio", "running", "fat burn", "heart rate", "endurance", "jog"],
    what: "Zone 2 cardio is steady, easy-paced work at 60–70% of max heart rate — the intensity where your body burns mostly fat and builds an aerobic base without hammering recovery.",
    howTo:
      "Aim for 150+ minutes a week. The talk test: you should be able to hold a conversation but not sing. Brisk walking, easy cycling or a slow jog all count — if you can't talk, slow down.",
    source:
      "https://www.vively.com.au/post/the-science-and-benefits-of-zone-2-running-for-weight-loss",
  },
  {
    id: "daily-walking",
    name: "Daily walking (brisk)",
    section: "exercise",
    keywords: ["walking", "walk", "steps", "10k steps", "stroll"],
    what: "Brisk walking is the lowest-friction fat-loss tool there is — a fast walk lands in zone 2, moves pooled fluid, and costs nothing in recovery.",
    howTo:
      "Walk briskly, around 3.5–4 mph — fast enough that talking takes slight effort. Build toward a daily step habit and use walks after meals to blunt blood sugar spikes.",
    source: "https://getsteps.app/blog/zone-2-walking",
  },
  {
    id: "sleep-7-9-hours",
    name: "Sleep 7–9 hours",
    section: "exercise",
    keywords: ["sleep", "rest", "recovery", "tired", "insomnia", "bedtime", "nap"],
    what: "Short sleep shows up fast on the face — puffier eyes, darker circles, paler skin — and no topical fixes chronic 5-hour sleep. Sleep is when recovery and growth hormone do their work.",
    howTo:
      "Adults need at least 7 hours; teens 8–10. Fix a bedtime, finish dinner 2–3 hours before it, and raise your head slightly with an extra pillow to cut morning puffiness.",
    source: "https://www.getmaxilla.com/guides/face-debloat",
  },
  {
    id: "jaw-exercises",
    name: "Jaw exercises (jaw juts + chin lifts)",
    section: "exercise",
    keywords: ["jaw exercises", "jaw jut", "chin lift", "jaw workout", "face exercises", "face yoga"],
    what: "Simple jaw movements that engage the muscles around the jaw and under the chin — a low-effort complement to chewing and posture work, not a replacement for leanness.",
    howTo:
      "Jaw juts: push your lower jaw forward and hold 5 seconds, 10 reps. Chin lifts: tilt your head back, pucker your lips toward the ceiling and hold 5 seconds, 10 reps. Stop if anything clicks or hurts.",
    source: "https://top5best.com/mastic-gum-jawline",
  },

  // ------------------------------------------------------------ STYLE
  {
    id: "haircut-face-shape",
    name: "Haircut matched to face shape",
    section: "style",
    keywords: ["haircut", "hair", "barber", "hairstyle", "fade", "quiff", "pompadour"],
    what: "The right cut works with your bone structure instead of against it — the goal is balance: add height where the face is wide, show the jaw where it is strong.",
    howTo:
      "Round face: height on top with tight sides (quiff or pompadour). Square face: show the jaw — buzz or crew cut. Oval face: most cuts work. Bring a reference photo to the barber and name the cut, don't just say 'shorter'.",
    source: "https://lookist.app/blog/haircuts-for-men-by-face-shape",
  },
  {
    id: "eyebrow-grooming",
    name: "Eyebrow grooming",
    section: "style",
    keywords: ["eyebrows", "brows", "eyebrow", "pluck", "trim brows"],
    what: "Clean eyebrows frame the eyes and sharpen the whole upper face — the most underrated 5-minute upgrade. The rule is restraint: groomed, not shaped into oblivion.",
    howTo:
      "Brush brows upward; trim only the tips that stick past the natural line; pluck strays below the arch, never above it. Check every 3–4 weeks. Never over-pluck — sparse brows take months to grow back.",
    source: "https://looksmaxscan.com/articles/how-to-shape-eyebrows-for-men",
  },
  {
    id: "beard-shaping",
    name: "Beard shaping for the jawline",
    section: "style",
    keywords: ["beard", "facial hair", "jawline beard", "shave", "stubble"],
    what: "A shaped beard can add definition to a soft jawline — length at the chin sharpens a round face, clean lines keep it intentional instead of scruffy.",
    howTo:
      "Set the neckline 1–2 finger-widths above the Adam's apple. Round face: keep length at the chin and short sides. Square face: soften the corners. Keep the cheek line clean and the shape symmetrical.",
    source: "https://www.gentlemanscuts.sg/journal/beard-shaping-for-your-face-shape",
  },
  {
    id: "glasses-face-shape",
    name: "Glasses frames for your face shape",
    section: "style",
    keywords: ["glasses", "frames", "spectacles", "eyewear"],
    what: "Frames work by contrast: the right shape balances your face, the wrong one exaggerates what you already have.",
    howTo:
      "Round face: rectangular or angular frames. Square face: round or oval frames to soften the jaw. Oval face: almost anything works — pick by style. The frame should sit level and not slide down the nose.",
    source: "https://selfmadenewbie.com/glasses-face-shape/",
  },
  {
    id: "clothing-fit",
    name: "Clothing fit",
    section: "style",
    keywords: ["clothing", "fit", "clothes", "fashion", "style", "dress", "outfit", "wardrobe"],
    what: "Fit beats brand, price and trend: clothes that actually fit your body make you look sharper than expensive clothes that don't.",
    howTo:
      "Shoulder seam sits on the shoulder, not drooping down the arm. Pinch test: you should be able to pinch about an inch of fabric at the side — more means too loose, none means too tight. Get the basics tailored before buying more.",
    source: "https://www.mansroutine.com/how-to-dress-for-your-body-type/",
  },
  {
    id: "teeth-whitening",
    name: "Teeth whitening at home",
    section: "style",
    keywords: ["teeth", "whitening", "white teeth", "smile", "toothpaste", "strips"],
    what: "Whiter teeth make the whole smile read cleaner — and the safe home options work, slowly, without damaging enamel.",
    howTo:
      "Whitening toothpaste or whitening strips, used exactly as directed. Avoid charcoal, lemon and vinegar — they wear enamel down. For stronger results, dentist-supervised trays beat any home hack.",
    source:
      "https://www.acibademhealthpoint.com/blog/how-to-whiten-teeth-at-home-a-doctor-reviewed-answer/",
  },
  {
    id: "fragrance",
    name: "Fragrance / cologne application",
    section: "style",
    keywords: ["cologne", "fragrance", "perfume", "scent", "smell"],
    what: "Fragrance is a halo you can't see — applied right, it is noticed when someone is close; applied wrong, it announces you from across the room.",
    howTo:
      "Spray pulse points: sides of the neck, wrists, chest. EDT 3–4 sprays, EDP 2–3, parfum 1–2. Never rub your wrists together after spraying — it crushes the top notes.",
    source: "https://culturedgrooming.com/how-to-apply-cologne/",
  },
  {
    id: "sea-salt-spray",
    name: "Hair styling with sea salt spray",
    section: "style",
    keywords: ["sea salt", "hair styling", "volume", "texture", "blow-dry", "blow dry", "hair product"],
    what: "Sea salt spray adds texture and volume to flat hair — the easiest route to a fuller, styled look without heavy product.",
    howTo:
      "2–4 sprays on damp hair, roots and mid-lengths, then blow-dry for volume — lift at the roots while drying. A little goes a long way; too much dries the hair out.",
    source: "https://www.reuzel.com/blogs/news/how-to-use-sea-salt-spray",
  },
  {
    id: "sunless-tanner",
    name: "Sunless tanner for the face",
    section: "style",
    keywords: ["tanner", "tan", "tanning", "self-tanner", "sunless", "bronze", "glow"],
    what: "A sunless tanner gives a tanned look without UV damage: modern formulas use DHA, a sugar that reacts with amino acids on the skin's outermost layer to create a natural-looking bronze.",
    howTo:
      "Exfoliate 24 hours before and moisturize dry spots. Apply with a mitt in long smooth strokes and gentle circles, hands and feet last. Let it dry a few minutes, wear loose dark clothes while it develops, then take a quick lukewarm rinse after a few hours. It lasts 5–6 days; moisturize daily to extend it. For the face, mix tanning drops into your regular moisturizer instead of using body tanner.",
    source: "https://www.3verybody.com/post/best-tanner-for-men",
  },
];

/** Words that carry no retrieval signal. */
const STOPWORDS = new Set(
  "a an the and or but if then so to of in on for with from by at is are was were be been do does did how what when where why which who can could should would will i my me you your it its this that these those as am just very really get got make much many more most some any no not than too also about into over after before between through during under again once here there all both each few other own same".split(
    " "
  )
);

function tokenize(question: string): string[] {
  return question
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

/**
 * Keyword retrieval, v1. Scores each method on overlap with the
 * question: exact keyword hit 3, multi-word phrase 4, stem-ish
 * partial match 1, name word 1. Returns the top `limit` methods
 * scoring >= 3 (one solid keyword hit), best first; ties keep
 * COACH_METHODS order (Array.sort is stable). Returns [] when
 * nothing matches — the caller then injects no block and the Coach
 * answers from its own capability.
 */
export function retrieveCoachMethods(
  question: string,
  limit = 4
): CoachMethod[] {
  const lower = question.toLowerCase();
  const tokens = tokenize(question);
  if (tokens.length === 0) return [];
  const scored: { method: CoachMethod; score: number }[] = [];
  for (const method of COACH_METHODS) {
    let score = 0;
    for (const keyword of method.keywords) {
      if (keyword.includes(" ")) {
        if (lower.includes(keyword)) score += 4;
        continue;
      }
      if (tokens.includes(keyword)) {
        score += 3;
        continue;
      }
      // Stem-ish partial match: "debloat" also matches the keyword
      // "bloat", "mewing" matches "mew". Minimum 4 chars so short
      // words don't false-positive.
      if (keyword.length >= 4) {
        for (const token of tokens) {
          if (
            token.length >= 4 &&
            (token.startsWith(keyword) || keyword.startsWith(token))
          ) {
            score += 1;
            break;
          }
        }
      }
    }
    // Name words in the question are a weak extra signal.
    for (const word of method.name.toLowerCase().split(/[^a-z0-9]+/)) {
      if (word.length >= 3 && tokens.includes(word)) score += 1;
    }
    if (score >= 3) scored.push({ method, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.method);
}

/**
 * Renders retrieved methods as a system-prompt block. Returns "" when
 * nothing was retrieved, so the caller can inject conditionally.
 * The citation instruction lives here AND as a standing rule in
 * COACH_LAYER (max-voice.ts) — the block is per-request, the layer
 * is the permanent rule.
 */
export function coachMethodsPromptBlock(methods: CoachMethod[]): string {
  if (methods.length === 0) return "";
  const lines = methods.map(
    (m) =>
      `- ${m.name} [${m.section}]: ${m.what} How to do it: ${m.howTo} Source: ${m.source}`
  );
  return [
    "SCRAPED METHODS — short summaries of public looksmaxxing guides, retrieved because they match this question. They are background knowledge, NOT the user's data: the numbers inside them (doses, reps, amounts) are the guide's facts and you may quote them, but the user's own numbers still come only from CONTEXT.",
    ...lines,
    "When your answer draws on one of these methods, say so in your own words AND cite its source URL inline — paste the full URL in parentheses right after the advice, like (Source: https://example.com/guide). The citation is not optional: every method you use must carry its URL, pasted in full, never shortened or paraphrased. Do not substitute an in-app link for the source URL. If a retrieved method doesn't actually fit the question, ignore it.",
  ].join("\n");
}
