# The Guides library content (new, 2026-10-20, Zayne): 14 general advice guides in 5 categories — the clear, curated general layer that sits alongside the personalised plans, so subscribers never have to dig through fluff research online. One honest structure per guide (intro, protocol, mistakes, bottom line), softmaxxing-only, no miracle claims, prescription territory always "see a dermatologist". SECTION_GUIDES maps plan pillars to guides for the plan page’s "Go deeper" links.
/**
 * The Guides library — Ascend's general advice, curated in one place.
 *
 * Why this exists (Zayne, 2026-10-20): subscribers shouldn't have to
 * dig through contradictory "fluff research" online. These pages are
 * the clear, general layer that sits ALONGSIDE the personalised plans:
 * what the plan tells you to do for YOU, the guides explain properly
 * for anyone. Every guide follows the same honest structure — what it
 * is, why it matters, the protocol, the mistakes, the bottom line —
 * and the same safety rules as the plans: softmaxxing only, no miracle
 * promises, prescription territory is always "see a dermatologist".
 */
export interface GuideSection {
  heading: string;
  paragraphs?: string[];
  steps?: string[];
}

export interface Guide {
  slug: string;
  title: string;
  category: "Skin" | "Hair" | "Face & Posture" | "Body" | "Style";
  blurb: string;
  readMins: number;
  intro: string;
  sections: GuideSection[];
  mistakes: string[];
  bottomLine: string;
}

export const GUIDE_CATEGORIES: Guide["category"][] = [
  "Skin",
  "Hair",
  "Face & Posture",
  "Body",
  "Style",
];

export const GUIDES: Guide[] = [
  {
    slug: "skincare-routine-basics",
    title: "The Only Skincare Routine You Need to Start",
    category: "Skin",
    blurb:
      "Cleanser, moisturiser, sunscreen — in the right order, morning and night. Everything else is an upgrade, not a foundation.",
    readMins: 5,
    intro:
      "Most skin problems beginners try to fix with ten products are caused by having no consistent basics — or by basics done in the wrong order. This is the routine everything else builds on. If you do only this, you are ahead of most people.",
    sections: [
      {
        heading: "The morning routine (3 steps)",
        steps: [
          "Rinse with water, or use a gentle cleanser if you wake up oily. Morning skin rarely needs a full cleanse.",
          "Moisturiser on slightly damp skin — this locks in water and keeps the barrier calm all day.",
          "Sunscreen, SPF 30 or higher, as the last step. Two finger-lengths for face and neck. This is the single highest-impact step for how skin ages.",
        ],
      },
      {
        heading: "The evening routine (2–3 steps)",
        steps: [
          "Cleanser — this one matters. The day's sunscreen, oil and city grime need to come off. 60 seconds, lukewarm water, no scrubbing.",
          "Any treatment step your plan calls for goes here, on clean, dry skin.",
          "Moisturiser again to seal the night in.",
        ],
      },
      {
        heading: "Why order matters",
        paragraphs: [
          "Products layer thinnest to thickest, and sunscreen always goes last in the morning — anything over it dilutes it. Treatments work on clean skin; moisturisers work best on damp skin. Get the order right and cheap products outperform expensive ones used randomly.",
        ],
      },
      {
        heading: "How long before it works",
        paragraphs: [
          "Hydration improves in days. Texture and breakouts need a full skin cycle — about 4 to 6 weeks of consistency. Judge any routine at 6 weeks, not 6 days. Changing products every week resets the clock and is the most common reason 'nothing works'.",
        ],
      },
    ],
    mistakes: [
      "Washing with hot water or scrubbing — it strips the barrier and increases oil production.",
      "Skipping sunscreen on cloudy days or indoors near windows — UVA passes through both.",
      "Starting five new products at once — when something irritates you, you'll never know which one.",
      "Judging a routine before 4–6 weeks of consistent use.",
    ],
    bottomLine:
      "Cleanse at night, moisturise twice a day, sunscreen every morning. Six boring weeks of that beats any product haul.",
  },
  {
    slug: "acne-and-breakouts",
    title: "Acne & Breakouts: What Actually Helps",
    category: "Skin",
    blurb:
      "Why spots happen, the habits that quietly make them worse, and the honest line between self-care and seeing a dermatologist.",
    readMins: 6,
    intro:
      "Breakouts come from four things combining: oil production, pores clogging with dead skin, bacteria, and inflammation. Genetics and hormones drive most of it — which is why the honest answer is management, not a miracle cure, and why severe acne is a medical condition, not a discipline problem.",
    sections: [
      {
        heading: "The daily habits that move the needle",
        steps: [
          "Cleanse once at night (twice only if genuinely oily) — over-washing triggers more oil and more irritation.",
          "Change your pillowcase at least twice a week. It collects oil, product and bacteria nightly.",
          "Hands off your face. Touching transfers bacteria; picking and squeezing cause the scars and marks that outlast the spot itself.",
          "Clean your phone screen — it presses against your cheek for hours a week.",
          "Shower or rinse after training; sweat sitting on skin under a cap or headband is a classic forehead-breakout pattern.",
        ],
      },
      {
        heading: "Ingredients with real evidence (over the counter)",
        paragraphs: [
          "Salicylic acid (BHA) helps unclog pores; benzoyl peroxide targets bacteria; adapalene is a retinoid available over the counter in many countries. Introduce ONE at a time, a few nights a week, and build up — more is not faster, it is just more irritation. Your personalised plan sequences these for your skin specifically; this guide is the general picture.",
        ],
      },
      {
        heading: "Food, sleep and stress",
        paragraphs: [
          "The evidence is strongest for high-sugar, high-glycaemic diets worsening acne in some people, and for poor sleep and high stress making inflammation worse. None of these is a guaranteed cause for you — but they are free levers worth pulling alongside topical care.",
        ],
      },
      {
        heading: "When it's a dermatologist, not a guide",
        paragraphs: [
          "Deep, painful, cystic spots; acne leaving scars or dark marks; sudden severe adult acne; or no improvement after 8–12 weeks of consistent over-the-counter care. Prescription options exist and work — but choosing them is a doctor's job, not an app's. Ascend will never specify prescription medication; that line is deliberate.",
        ],
      },
    ],
    mistakes: [
      "Picking or squeezing — the single biggest cause of permanent marks.",
      "Scrubbing with harsh exfoliants daily — a damaged barrier breaks out more.",
      "Spot-treating with toothpaste, lemon or alcohol — internet folklore that burns skin.",
      "Starting three actives in the same week and blaming 'purging' for a damaged barrier.",
    ],
    bottomLine:
      "Gentle consistency, clean surfaces, hands off — and a dermatologist without hesitation when it's deep, scarring or stubborn.",
  },
  {
    slug: "sunscreen-guide",
    title: "Sunscreen, Explained Properly",
    category: "Skin",
    blurb:
      "SPF numbers, how much to actually use, reapplication, and why this is the closest thing to a real 'anti-ageing' product.",
    readMins: 4,
    intro:
      "Up to 80% of visible facial ageing — wrinkles, sagging, uneven tone — is attributed to UV exposure, not time. Sunscreen is therefore not a beach product; it is the foundation every other skincare step stands on. An expensive serum under no sunscreen is money leaking.",
    sections: [
      {
        heading: "What SPF actually means",
        paragraphs: [
          "SPF measures UVB protection (the burning rays). SPF 30 blocks about 97%, SPF 50 about 98% — the jump from 30 to 50 matters far less than applying enough and reapplying. Look for 'broad spectrum' so UVA (the ageing rays, present all day, through windows) is covered too.",
        ],
      },
      {
        heading: "How much, and how often",
        steps: [
          "Two finger-lengths of product for face and neck — most people apply half enough and get a fraction of the labelled SPF.",
          "Apply as the last morning step, 15 minutes before going out.",
          "Reapply every 2 hours outdoors, and after sweating or swimming. A normal indoor day usually needs the morning application plus one top-up if you're near windows or step out at lunch.",
          "Don't forget ears, neck and the backs of hands — they age in public too.",
        ],
      },
      {
        heading: "Finding one you'll actually wear",
        paragraphs: [
          "The best sunscreen is the one that doesn't annoy you. Gel and fluid textures suit oily skin; creams suit dry skin. If a formula stings your eyes, use it below the eye line and a different one (or sunglasses) above it. Tinted versions help avoid the white cast on deeper skin tones.",
        ],
      },
    ],
    mistakes: [
      "Relying on the SPF in a moisturiser or foundation — you'd need to apply an unrealistic amount to reach it.",
      "Only wearing it when it's sunny — UVA is present at similar levels all year, including overcast days.",
      "Applying it once on a full day outdoors and assuming you're covered.",
    ],
    bottomLine:
      "SPF 30+, two finger-lengths, every morning, reapplied outdoors. This one habit protects every other rupee and minute you spend on your skin.",
  },
  {
    slug: "skin-barrier",
    title: "Your Skin Barrier: The Thing Everyone Breaks",
    category: "Skin",
    blurb:
      "Tight, stingy, suddenly-sensitive skin is usually a damaged barrier — often caused by the products meant to fix it. Here's the repair protocol.",
    readMins: 5,
    intro:
      "Your skin barrier is the thin outer layer that keeps water in and irritants out. When it's damaged, skin feels tight after washing, products sting that never stung before, and breakouts and redness appear together. The usual cause is enthusiasm: too many actives, too often, too fast.",
    sections: [
      {
        heading: "Signs your barrier is struggling",
        steps: [
          "Stinging or burning from plain moisturiser.",
          "Tight, shiny-but-dry feeling after cleansing.",
          "New sensitivity to products you've used for months.",
          "Breakouts plus flaking at the same time.",
        ],
      },
      {
        heading: "The barrier-repair protocol (1–2 weeks)",
        steps: [
          "Stop all actives — no exfoliating acids, no retinoids, no scrubs. This is a pause, not a surrender.",
          "Cleanse once daily, at night, with the gentlest cleanser you have. Lukewarm water only.",
          "Moisturise generously, twice daily. Look for ceramides, glycerin or petrolatum-based products.",
          "Sunscreen every morning as usual — damaged skin is more UV-sensitive, not less.",
          "Reintroduce actives one at a time, twice a week, only when stinging has been gone for several days.",
        ],
      },
      {
        heading: "How to never break it again",
        paragraphs: [
          "Introduce one new active every 2–3 weeks, start at low frequency, and never stack two strong actives on the same night. More irritation is never a sign something is 'working' — it's a sign to slow down. Your plan's pacing exists for exactly this reason.",
        ],
      },
    ],
    mistakes: [
      "Pushing through stinging because 'purging is normal' — purging is about breakouts in usual spots, not burning.",
      "Exfoliating daily because a video said to.",
      "Repairing with ten new 'barrier' products at once — repair should be the simplest routine you own.",
    ],
    bottomLine:
      "When in doubt, subtract. A calm barrier makes every active work better — and most 'my skin hates everything' stories end here.",
  },
  {
    slug: "haircare-basics",
    title: "Haircare Basics Most People Get Wrong",
    category: "Hair",
    blurb:
      "Washing frequency, conditioner, scalp health and heat — the fundamentals that decide whether your hair looks expensive or neglected.",
    readMins: 5,
    intro:
      "Hair is dead fibre — you can't heal it, only protect it and grow better fibre. That means most hair quality is decided at the scalp (where new hair forms) and by how little damage you do to the lengths. The basics below cover both.",
    sections: [
      {
        heading: "Washing: how often, and how",
        steps: [
          "Wash when your scalp is oily or itchy — for most people every 1–3 days. 'Training' your scalp to produce less oil is a myth; oil output is hormonal.",
          "Shampoo goes on the scalp, not the lengths. Massage with fingertips (not nails) for 30–60 seconds, then let the rinse carry it through.",
          "Conditioner goes on the lengths and ends, not the scalp — that's what keeps hair smooth without flattening roots.",
          "Rinse with cooler water at the end if you can; very hot water swells and roughens the fibre.",
        ],
      },
      {
        heading: "Drying and heat",
        steps: [
          "Pat or squeeze dry with a soft t-shirt or microfibre towel — rough towel-rubbing frays the fibre and causes frizz.",
          "If you blow-dry, use medium heat and keep the dryer moving. Heat protectant first if you style with hot tools.",
          "Never sleep on soaking-wet hair regularly — damp scalps invite irritation and the fibre is weakest when wet.",
        ],
      },
      {
        heading: "The scalp is skin too",
        paragraphs: [
          "Flakes, itching or bumps at the scalp line deserve attention: dandruff is usually a yeast-and-oil issue that anti-dandruff shampoos (used 2–3 times a week, left on 3–5 minutes) handle well. Persistent shedding, patchy loss or a receding hairline changing fast is a dermatologist conversation — early is genuinely better with hair loss, and no guide can assess it.",
        ],
      },
    ],
    mistakes: [
      "Shampooing the lengths and skipping the scalp — exactly backwards.",
      "Skipping conditioner because hair is short or oily — lengths still need it.",
      "Tight hairstyles daily (slicked ponytails, tight buns) — traction damages the hairline over time.",
      "Judging a haircut the day it's cut — most cuts settle and look best after 1–2 weeks.",
    ],
    bottomLine:
      "Clean scalp, conditioned lengths, gentle drying. Hair rewards consistency quietly, over months.",
  },
  {
    slug: "hairstyle-by-face-shape",
    title: "Choosing a Hairstyle for Your Face Shape",
    category: "Hair",
    blurb:
      "Your scan measures your face shape for a reason. Here's how each shape should think about length, volume and fringe — the barber brief, decoded.",
    readMins: 5,
    intro:
      "Hairstyles work when they balance your proportions: adding width where the face is narrow, length where it's wide, and never exaggerating what already dominates. Your Ascend scan identifies your face shape — this guide turns that label into decisions you can hand to a barber.",
    sections: [
      {
        heading: "Oval — the flexible shape",
        paragraphs: [
          "Balanced proportions mean most styles work. Your decision is about hair texture and lifestyle, not correction. Keep some length on top for versatility; avoid a heavy fringe that hides the natural balance.",
        ],
      },
      {
        heading: "Round — add height and angles",
        steps: [
          "Volume on top, shorter faded sides — height elongates the face.",
          "Angular fringes and side parts break up the roundness.",
          "Avoid: round, bowl-like silhouettes and chin-length volume at the sides — they widen further.",
        ],
      },
      {
        heading: "Square — soften or sharpen, your choice",
        steps: [
          "To soften a strong jaw: textured crops, some length, softer edges around the temples.",
          "To lean into it: very short, clean styles make the jaw the feature.",
          "Avoid heavy straight fringes that make the face look boxy.",
        ],
      },
      {
        heading: "Oblong — add width, keep height in check",
        steps: [
          "More length and volume at the sides; less height on top — the opposite of the round-face brief.",
          "A fringe shortens the face visually and usually suits this shape well.",
          "Avoid very short sides with tall tops — it stretches the face.",
        ],
      },
      {
        heading: "Heart & diamond — balance the extremes",
        steps: [
          "Heart (wide forehead, narrow chin): volume at the sides near the jaw, softer fringe; avoid all the volume sitting on top.",
          "Diamond (wide cheekbones, narrow forehead and jaw): fringe and temple length up top, keep sides from puffing out at the cheek line.",
        ],
      },
      {
        heading: "Talking to your barber",
        paragraphs: [
          "Bring two or three photos of people with your hair type (not just your face shape), say what you liked about each, and state your daily styling budget honestly — a style that needs 15 minutes daily fails if you have three. A good barber adapts the reference; a photo alone is not a plan.",
        ],
      },
    ],
    mistakes: [
      "Copying a style from someone with a different hair texture — texture beats shape in daily reality.",
      "Choosing a high-maintenance cut with a low-maintenance lifestyle.",
      "Changing everything at once before an event — grow into a new style over 2–3 cuts.",
    ],
    bottomLine:
      "Balance the proportions, respect your texture, brief the barber properly. The right cut is the cheapest 'facial improvement' that exists.",
  },
  {
    slug: "jawline-and-facial-fat",
    title: "Jawline & Facial Fat: The Honest Version",
    category: "Face & Posture",
    blurb:
      "No gum-chewing miracles, no mewing promises. What actually changes how defined your jaw looks: fat, posture, water and time.",
    readMins: 6,
    intro:
      "Jaw definition is mostly three things: your bone structure (fixed), the fat and water sitting over it (changeable), and posture (changeable today). The internet sells exercises for the first one because it's the one you can't change. This guide is about the two you can.",
    sections: [
      {
        heading: "Body fat is the biggest lever",
        paragraphs: [
          "Faces lean out as overall body fat falls — there's no way to spot-reduce the face, and the face is often the last place to change and the first place others notice. If your plan includes a fat-loss goal, your jawline is on that timeline: gradual, over months, alongside everything else. Crash diets backfire — they cost muscle, which makes the final result softer, not sharper.",
        ],
      },
      {
        heading: "Water, salt and sleep — the daily swing",
        steps: [
          "High-salt days and poor sleep both show up as a puffier face the next morning. This is water, not fat — it reverses in a day or two.",
          "Consistent hydration (your plan sets your number) paradoxically reduces retention — bodies hold water when supply is erratic.",
          "Alcohol is the fastest route to a bloated morning face; late heavy meals are second.",
          "A morning walk and a few minutes of movement genuinely help lymph drainage — the 'depuff' effect is real but temporary.",
        ],
      },
      {
        heading: "Posture and the tongue question",
        paragraphs: [
          "Forward-head posture shortens the neck visually and pushes tissue under the jaw — standing tall genuinely changes your jawline in photos and in person. As for tongue posture ('mewing'): keeping your tongue resting on the palate and breathing through your nose are harmless, normal habits — but claims that they remodel adult bone are not supported by evidence. Do them as posture hygiene, expect nothing structural, and ignore anyone selling transformation timelines from them.",
        ],
      },
      {
        heading: "What about chewing gum and jaw trainers?",
        paragraphs: [
          "Chewing strengthens the masseter muscles slightly; oversized jaw muscles can actually widen the lower face in a way most people don't want, and aggressive jaw devices risk jaw-joint (TMJ) pain. This is a hard pass — the risk-to-reward is upside down.",
        ],
      },
    ],
    mistakes: [
      "Judging your jaw in harsh overhead bathroom light at midnight — lighting angle changes it more than a month of dieting.",
      "Extreme water-cutting or diuretic tricks before photos — dehydrating for a picture is a bad trade that also reads on camera.",
      "Buying jaw exercisers and facial gadgets with transformation claims.",
      "Expecting facial change in two weeks — fat loss shows in the face on a months timeline.",
    ],
    bottomLine:
      "Lean out gradually if that's your goal, sleep well, manage salt and water, stand tall. Your jaw is mostly a lifestyle photograph — change the lifestyle.",
  },
  {
    slug: "posture-and-presence",
    title: "Posture & Presence: The Same-Day Upgrade",
    category: "Face & Posture",
    blurb:
      "The only looks upgrade that works in one day: how you carry your head, shoulders and chest changes your face, jawline and presence immediately.",
    readMins: 5,
    intro:
      "Screens pull the head forward and round the shoulders — and forward-head posture is measurable in your scan photos: it shortens the neck, softens the jaw line and reads as low energy. Posture work is unglamorous and it's the fastest legitimate improvement available.",
    sections: [
      {
        heading: "The 5-point standing check",
        steps: [
          "Ears over shoulders (not in front of them).",
          "Shoulders down and slightly back — think 'shoulder blades into your back pockets', not military stiffness.",
          "Chest open, ribs down — breathe into your back, not just your belly.",
          "Chin level — imagine a string lifting the crown of your head.",
          "Weight even across both feet.",
        ],
      },
      {
        heading: "The daily reset (5 minutes)",
        steps: [
          "Wall angels: back against a wall, arms sliding up and down, 2 sets of 10 — teaches your shoulders where 'back' is.",
          "Chin tucks: glide your head straight back (making a deliberate double chin), hold 3 seconds, 10 reps — reverses the forward-head pattern.",
          "Chest opener: hands in a doorway, lean through gently, 30 seconds each side.",
          "Dead hangs or simply reaching tall overhead for 30–60 seconds — decompresses a desk spine.",
        ],
      },
      {
        heading: "Fix the environment, not just yourself",
        paragraphs: [
          "Raise your screen toward eye level, keep your phone at chest height or higher for long reading, and stand up every hour. Willpower loses to furniture every time. At a desk all day, a two-minute movement break per hour beats a heroic Sunday stretch session.",
        ],
      },
      {
        heading: "Presence is posture plus calm",
        paragraphs: [
          "Slow your movements down slightly, unclench your jaw, and let your hands be still. Composure reads as confidence more reliably than any single feature — and it's trainable the same day, which is why your plan treats it as a foundation, not an afterthought.",
        ],
      },
    ],
    mistakes: [
      "Forcing a rigid 'military' posture all day — unsustainable, and stiffness reads as tension, not confidence.",
      "Buying posture-corrector straps instead of building the muscles — the strap does the work, you keep none of it.",
      "Only fixing posture for photos — the goal is a default, not a pose.",
    ],
    bottomLine:
      "Ears over shoulders, chest open, chin level, reset daily. It's free, it's immediate, and it improves every photo and room you walk into.",
  },
  {
    slug: "sleep-for-looks",
    title: "Sleep: The Original Beauty Product",
    category: "Body",
    blurb:
      "One bad night shows on your face measurably. What sleep does for skin, eyes and weight — and the protocol that fixes it.",
    readMins: 5,
    intro:
      "Sleep is when skin repairs, collagen is produced and fluid balance resets. Studies consistently find that observers rate sleep-deprived faces as less healthy and less attractive — darker under-eye circles, puffier eyes, paler skin, droopier mouth corners. No product stack compensates for a broken night pattern.",
    sections: [
      {
        heading: "What one bad night does — and what chronic short sleep does",
        paragraphs: [
          "One short night: puffiness, dullness, more visible fine lines — mostly fluid and blood flow, gone in a day or two. Chronic short sleep is different: slower barrier repair, more breakouts, harder fat loss (hunger hormones shift measurably), and worse training recovery. Your streaks and check-ins track sleep for a reason — it's an input to everything else.",
        ],
      },
      {
        heading: "The sleep protocol",
        steps: [
          "Fixed wake time, 7 days a week — this anchors everything; bedtime follows naturally.",
          "7–9 hours in bed. If you must choose, protect the wake time and let bedtime drift earlier as sleepiness builds.",
          "Last caffeine by early afternoon — caffeine's half-life is ~5–6 hours and it fragments sleep even when you 'fall asleep fine'.",
          "Dim lights and park the phone 30–60 minutes before bed; charge it outside arm's reach if willpower is the issue.",
          "Cool, dark room. A shower 60–90 minutes before bed helps the body temperature drop that triggers sleepiness.",
          "Same wind-down sequence nightly — the routine itself becomes the signal.",
        ],
      },
      {
        heading: "The under-eye area specifically",
        paragraphs: [
          "Sleep position matters: back-sleeping or an extra pillow reduces overnight fluid pooling under the eyes, and side-sleeping into the pillow worsens morning puffiness on that side. Persistent dark circles despite good sleep are often genetics, allergies or pigmentation — manage expectations, and see a doctor if they're new and severe.",
        ],
      },
    ],
    mistakes: [
      "Catching up with a 4-hour weekend lie-in — it shifts your clock and makes Sunday night worse.",
      "Using alcohol as a nightcap — it sedates but fragments sleep architecture.",
      "Tracking sleep obsessively and stressing about the score — the stress costs more than the data earns.",
    ],
    bottomLine:
      "Fixed wake time, enough hours, caffeine curfew, dark cool room. Sleep is the base layer your whole face is printed on.",
  },
  {
    slug: "nutrition-for-skin-and-body",
    title: "Nutrition for Skin & Body Composition",
    category: "Body",
    blurb:
      "Protein targets, the sugar story, hydration and supplements with actual evidence — eating for the face and body you're building.",
    readMins: 6,
    intro:
      "Nutrition affects how you look through three channels: body composition (fat and muscle), skin quality (inflammation, glycation, nutrients) and daily appearance (water retention, energy). No single food is magic; the patterns below are where the evidence actually lives.",
    sections: [
      {
        heading: "Protein: the structural nutrient",
        steps: [
          "Aim for roughly 1.6–2.2 g of protein per kg of bodyweight daily when training or cutting — your Ascend targets already compute this from your weight.",
          "Spread it across the day (3–4 protein-containing meals) rather than one giant serving.",
          "Anchor each meal with a palm-to-two-palms portion of a protein source you actually like — adherence beats optimisation.",
          "When cutting, protein is what protects your muscle — and muscle is what keeps a leaner face from looking gaunt.",
        ],
      },
      {
        heading: "Sugar, glycation and skin",
        paragraphs: [
          "Chronically high sugar intake is associated with glycation — sugar molecules stiffening collagen — and with worse acne in susceptible people. You don't need zero sugar; you need the everyday baseline down: sugary drinks are the first target (liquid sugar is the easiest large reduction most people can make), then habitual desserts, then hidden sugars in sauces and 'healthy' snacks.",
        ],
      },
      {
        heading: "Hydration — steady, not heroic",
        paragraphs: [
          "Your plan sets your water number from your bodyweight (about 35 ml per kg). Sip across the day; pale-straw urine is the practical test. Chugging litres at night just costs you sleep. Skin hydration mostly follows overall hydration plus your moisturiser — water alone doesn't moisturise skin directly, but chronic under-drinking shows in everything.",
        ],
      },
      {
        heading: "Supplements: the short honest list",
        steps: [
          "Creatine monohydrate (3–5 g/day) — the best-evidenced performance supplement; it can add slight water weight inside muscles (a good thing visually).",
          "Vitamin D if you're deficient — test rather than guess if you can; deficiency is common in indoor lifestyles.",
          "Omega-3s if you rarely eat oily fish.",
          "Everything else is optional at best. Collagen peptides have modest skin evidence; expensive 'beauty blends' mostly sell hope. Food, sleep and training first — your money is better spent there.",
        ],
      },
    ],
    mistakes: [
      "Crash dieting — rapid loss takes muscle and water with fat, and the face looks worse before it looks better.",
      "Eliminating whole food groups on influencer advice — deficiency is not a glow-up.",
      "Treating supplements as the plan instead of the garnish.",
      "Drinking your calories — the quietest way to overshoot every target.",
    ],
    bottomLine:
      "Protein high, sugary drinks gone, water steady, supplements minimal and evidence-based. Boring inputs, visible outputs.",
  },
  {
    slug: "gym-starter-guide",
    title: "The Gym Starter Guide: Your First 8 Weeks",
    category: "Body",
    blurb:
      "What to actually do in the gym as a beginner: full-body sessions, compound movements, progressive overload — and the mindset that makes it stick.",
    readMins: 6,
    intro:
      "Beginners don't need complexity — they need a repeatable full-body routine, decent technique and gradual progression. The gym improves how you look through muscle (shoulders, back, chest — the frame everything hangs on) and through fat loss. Both respond to the same basics done consistently.",
    sections: [
      {
        heading: "The structure: 3 days a week, full body",
        steps: [
          "Each session: one squat pattern (squat or leg press), one hinge (deadlift variation or hip hinge), one push (bench press or push-up progression), one pull (row or lat pulldown), plus one accessory you enjoy.",
          "3 sets of 6–12 reps per movement, resting 1–3 minutes. Leave 1–3 reps 'in the tank' on most sets — beginners grow without grinding to failure.",
          "Alternate days with rest between — Monday/Wednesday/Friday is the classic for a reason.",
        ],
      },
      {
        heading: "Progressive overload, simply",
        paragraphs: [
          "When you can do the top of the rep range on all sets with clean form, add the smallest weight increment next session. That's it. Log your sessions (the app habit matters more than the app) — progression you don't record is progression you'll repeat or forget. Expect visible change around weeks 6–12; strength changes come first and are the early proof.",
        ],
      },
      {
        heading: "Technique before ego",
        steps: [
          "Film one set per exercise weekly and compare against a good tutorial — your body lies about positions; cameras don't.",
          "Pain is information: joint pain means stop and reassess the movement, muscle burn means you're fine.",
          "If you can afford one session with a competent coach for the big lifts, it's the highest-value money in this whole guide.",
        ],
      },
      {
        heading: "The frame you're building",
        paragraphs: [
          "For visual impact, the priorities are back width (pulls), shoulders (overhead work and lateral raises), chest (pushes) and legs (squats) — the V-taper that changes silhouettes in clothes. Arms grow from the compound work plus a little direct work. Your plan's exercise section sequences this against your starting point.",
        ],
      },
    ],
    mistakes: [
      "Programme-hopping every fortnight — novelty is the enemy of progression.",
      "Skipping legs — the imbalance shows, and legs drive overall growth signals.",
      "Training hard and eating randomly — the gym is the stimulus; food and sleep are the building materials.",
      "Comparing your week 3 to someone's year 3 on social media.",
    ],
    bottomLine:
      "Three full-body days, compounds first, add weight slowly, log everything, eat your protein, sleep. Eight honest weeks change how clothes fit.",
  },
  {
    slug: "grooming-checklist",
    title: "The Grooming Checklist: Details That Read as 'Put Together'",
    category: "Style",
    blurb:
      "Brows, nails, teeth, scent, facial hair — the small maintained details people register subconsciously as attractiveness and competence.",
    readMins: 5,
    intro:
      "Grooming is the difference between 'good features' and 'looks after himself'. None of it is expensive; all of it is noticeable when neglected. Run this checklist honestly once a month — most people find two or three free wins.",
    sections: [
      {
        heading: "Face and hair details",
        steps: [
          "Brows: tidy strays between and below the brow line; never reshape the natural line dramatically — clean, not sculpted.",
          "Nose and ear hair: a cheap trimmer fixes in 30 seconds what people politely never mention.",
          "Facial hair: either commit to shaping it (clean neckline, defined edges) or stay clean-shaven — the in-between scruff reads as accidental. Patchy growth improves its look at slightly longer lengths, kept edged.",
          "Neckline and sideburns: keep the barber's lines fresh between cuts with a careful trimmer pass.",
        ],
      },
      {
        heading: "Hands, teeth, lips",
        steps: [
          "Nails short, clean and even; file rough edges. Hands are in every handshake and every photo holding a cup.",
          "Teeth: brush twice daily, floss or interdental brushes (this is also the bad-breath fix — most breath issues are between teeth and on the tongue). Whitening is optional polish; cleanliness is the foundation.",
          "Lips: a plain lip balm when they're cracked — dry, peeling lips undo an otherwise sharp look, especially on camera.",
        ],
      },
      {
        heading: "Scent, handled like an adult",
        steps: [
          "Shower daily and use deodorant/antiperspirant — this is 90% of scent.",
          "Fragrance, if you wear it: 1–2 sprays maximum, on pulse points, applied 20+ minutes before close contact. People should notice it when near you, not when you enter the building.",
          "One signature scent worn well beats a rotating collection worn heavily.",
          "Clothes carry scent too — a fresh shirt matters more than a second spray.",
        ],
      },
    ],
    mistakes: [
      "Over-plucked or dramatically reshaped brows — tidy, never sculpt.",
      "Drowning in fragrance to compensate for a skipped shower.",
      "Ignoring the back view — neckline, collar, and hair from behind are what most people actually see.",
    ],
    bottomLine:
      "Clean edges, clean hands, clean teeth, light scent. Maintenance is a signal — send it on purpose.",
  },
  {
    slug: "style-and-fit-basics",
    title: "Style & Fit: Looking Intentional in Any Budget",
    category: "Style",
    blurb:
      "Fit beats brands every time. Shoulder seams, trouser breaks, colour discipline and proportion — the rules that make clothes look expensive.",
    readMins: 5,
    intro:
      "People read 'well dressed' as a proxy for competence and self-respect, and 80% of it is fit, not price. A perfectly fitted simple outfit beats a designer piece in the wrong size every single time. These rules work with any wardrobe you already own.",
    sections: [
      {
        heading: "The fit rules",
        steps: [
          "Shoulder seams sit at your shoulder edge — not drooping down the arm, not pulling in.",
          "Shirts skim the torso without pulling at buttons or billowing at the waist; you should be able to pinch about 2–4 cm of fabric at the sides.",
          "Trousers: no pooling fabric at the shoe — a slight break or none. Waist sits without a belt doing structural work.",
          "Sleeves end at the wrist bone; jacket sleeves show a sliver of shirt cuff.",
          "A tailor can fix most of this cheaply — hemming and taking in a waist cost little and upgrade everything you own.",
        ],
      },
      {
        heading: "Colour and coordination",
        steps: [
          "Build around neutrals (navy, charcoal, white, black, olive, beige) — they combine with each other, so a small wardrobe multiplies.",
          "One statement piece per outfit, maximum. Everything else supports.",
          "Match leather to leather (belt with shoes) and metals to metals where you can — small coherence reads as intentional.",
          "Contrast near your face affects how your skin reads — if a colour washes you out, keep it below the waist.",
        ],
      },
      {
        heading: "Proportion tricks",
        paragraphs: [
          "Tucking (or a clean French tuck) restores your leg line and reads sharper instantly. Monochrome or low-contrast outfits lengthen; heavy horizontal breaks shorten. Cuffing trousers slightly shows the shoe and cleans the silhouette. Posture multiplies all of it — see the posture guide.",
        ],
      },
      {
        heading: "Shoes and the final 10%",
        paragraphs: [
          "Clean shoes are non-negotiable — wipe them weekly, rotate pairs so they rest. White sneakers only read 'minimal' when they're actually white. Hair, grooming and fit do the heavy lifting; shoes are where polish is judged.",
        ],
      },
    ],
    mistakes: [
      "Buying logos instead of fit — the most expensive-looking thing is a plain garment that fits perfectly.",
      "Wearing everything oversized or everything skin-tight — proportion needs contrast.",
      "Ignoring the tailor — most 'this brand doesn't suit me' is just unaltered sizing.",
    ],
    bottomLine:
      "Fit first, neutrals as the base, one statement max, clean shoes. Intentional beats expensive, every time.",
  },
  {
    slug: "progress-photos-guide",
    title: "Progress Photos That Tell the Truth",
    category: "Body",
    blurb:
      "Mirrors lie daily; photos don't — if you take them correctly. The exact setup for honest before/afters, and why this timeline becomes your best motivation.",
    readMins: 4,
    intro:
      "You see your own face daily, so gradual change is invisible to you — the mirror shows you a memory, not a measurement. Standardised photos remove the noise: same light, same angle, same distance. Ascend's progress timeline stores these on your device only; this guide makes them worth storing.",
    sections: [
      {
        heading: "The setup (5 minutes, once)",
        steps: [
          "Pick one spot with consistent, soft light — facing a window in daytime is ideal; harsh overhead bathroom light is the worst.",
          "Camera at eye level, about an arm's length plus a step (roughly 1–1.5 m), back camera if you can manage it, timer mode on.",
          "Head straight, neutral expression, relaxed jaw, no filter, no beauty mode — check it's off; many phones enable it silently.",
          "Take front and both three-quarter angles if you want the full record.",
        ],
      },
      {
        heading: "The cadence",
        steps: [
          "One session per week, same day, same time, ideally same conditions (morning, before food, is most consistent).",
          "Daily photos measure water and lighting, not progress — weekly is the honest frequency.",
          "Monthly, take one set in a second location/outfit for a reality check on how the change reads in the wild.",
        ],
      },
      {
        heading: "Reading them without spiralling",
        paragraphs: [
          "Compare week 1 to week 4, never to yesterday. Expect the order of change to be: how clothes fit and how others comment, first; what photos show, second; what your mirror shows you, last. If a photo set looks worse, check the light and your sleep before you check your plan — Ascend's measurement-day rhythm (every ~4 weeks) exists because that's the timescale real change photographs on.",
        ],
      },
    ],
    mistakes: [
      "Comparing photos taken in different lighting — light can manufacture or erase a jawline.",
      "Using the front camera's wide-angle distortion up close — it exaggerates the nose and shrinks the jaw.",
      "Deleting 'bad' early photos — they're the entire value of the timeline later.",
    ],
    bottomLine:
      "Same spot, same light, weekly. In four weeks the timeline will show you what your mirror has been hiding.",
  },
];

export function getGuide(slug: string): Guide | null {
  return GUIDES.find((g) => g.slug === slug) ?? null;
}

/** Guides related to a plan section — used for "read the guide" links. */
export const SECTION_GUIDES: Record<string, string[]> = {
  skin: ["skincare-routine-basics", "acne-and-breakouts", "sunscreen-guide"],
  diet: ["nutrition-for-skin-and-body", "sleep-for-looks"],
  exercise: ["gym-starter-guide", "posture-and-presence"],
  style: ["grooming-checklist", "style-and-fit-basics", "hairstyle-by-face-shape"],
};
