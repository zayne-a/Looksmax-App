// The deliberate read (Zayne, 2026-10-21): every measurement turned
// into a considered, long-form interpretation — what the number is,
// how it's read, what its band means on a real face, what honestly
// moves it, and what to compare on the next scan. Deliberately sized
// as a ~10-minute read per scan: depth is the product. All banded
// deterministically from the measured values; nothing invented, no
// medical claims, softmaxxing levers only. Shared by the scan history
// (every scan's full read) and the dashboard face breakdown.
import type { FaceMeasurements } from "./types";

export interface ReadItem {
  label: string;
  value: string;
  detail: string; // paragraphs separated by \n\n
}

export interface MeasurementRead {
  intro: string;
  items: ReadItem[];
  strongest: string; // the standout trait, in words
  biggestLever: string; // the single highest-return focus, in words
  nextScan: string; // what to compare when they re-scan
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const skinCalm = (v: number) => clamp01(1 - v / 100);

export function buildMeasurementRead(m: FaceMeasurements): MeasurementRead {
  const items: ReadItem[] = [];
  const t = m.facialThirds;

  items.push({
    label: "Overall score",
    value: `${m.overallScore}/100`,
    detail:
      (m.overallScore >= 75
        ? "A strong composite. At this level, proportions, symmetry and skin are reading well together in the same photo — which matters, because the overall score is not an average of best moments; it's how the whole face lands at once."
        : m.overallScore >= 60
          ? "A solid mid-range composite. This is the band where the score is genuinely contestable: not decided by bone, but by the condition of everything around the bone — skin state, under-eye fatigue, facial fat and water, and how the photo itself was taken."
          : m.overallScore >= 45
            ? "A developing composite. Read this number as a weighted summary where the weakest traits pull hardest — the overall follows the lowest reads below, not the highest. That's deliberate: it's how observers actually judge a face, by its most noticeable feature."
            : "An early-stage composite — and the most improvable kind. First scans often read low on the fast-moving signals (skin, under-eye, puffiness) while the slow structural reads sit mid-range. The gap between those two groups is your first month of progress.") +
      "\n\nWhat moves this number: the deterministic composite weights proportion fit and symmetry alongside the skin signals, so no single change maxes it. Expect movement in steps, not jumps — a few points between monthly scans is real progress, and a sudden leap usually means a better-lit photo rather than a different face. Judge the trend across three scans, never the gap between two.",
  });

  items.push({
    label: "Symmetry",
    value: `${Math.round(m.symmetryScore)}/100`,
    detail:
      (m.symmetryScore >= 85
        ? "Very balanced left-to-right — landmark pairs (eye corners, brow points, jaw angles, mouth corners) sit at near-mirror distances from the centre line. At this level, asymmetry is essentially invisible in real life, because people judge faces in motion, not in frozen frames."
        : m.symmetryScore >= 70
          ? "Good balance. The gaps here are the normal human kind — almost every face has a slightly stronger side, a marginally higher brow, a jaw that turns a fraction more on one side. Observers don't register differences at this scale unless they're comparing side-by-side stills."
          : m.symmetryScore >= 55
            ? "A noticeable imbalance in this still photo — one or more landmark pairs sit measurably off-mirror. Before treating any of it as structure, know how this read is made: it's exquisitely sensitive to capture. A head turned five degrees, a camera slightly off-centre, or light falling from one side will each cost real points."
            : "A wide left-right gap in this photo. At this level the first suspect is the capture itself — a tilted or off-centre shot is the most common cause of a read this low, ahead of any structural explanation.") +
      "\n\nWhat honestly moves it: sleeping position, habitual chewing side and posture shift soft-tissue reads by a few points over months — slow, marginal, real. What moves it instantly is photo discipline: camera at eye level, dead centre, head straight, even light. If a re-scan under those conditions jumps several points, the first number was measuring the photo, not you. The plan's routine includes both sides of that — the habits, and the measurement hygiene that keeps this read trustworthy.",
  });

  items.push({
    label: "Harmony fit",
    value: `${Math.round(m.goldenRatioScore)}/100`,
    detail:
      (m.goldenRatioScore >= 80
        ? "Your proportions sit close to the researched ideal bands this score is benchmarked against — eye spacing, facial thirds, mouth-to-nose and face height-to-width all land near the values the rating community measures by."
        : m.goldenRatioScore >= 65
          ? "Proportions sit near the researched bands, with one or two ratios doing most of the pulling away. The thirds and jaw reads below identify which — the fit score itself is deliberately a summary, and the detail always lives in the components."
          : m.goldenRatioScore >= 50
            ? "Several ratios sit outside their ideal band. It's worth being precise about what this score is: a comparison against researched proportion bands, not a measurement of attractiveness. Plenty of faces read striking with proportions far from these bands — they describe one kind of harmony, not the only one."
            : "Proportions sit well outside the researched bands. Read this as a styling brief rather than a verdict: when the underlying ratios aren't the textbook kind, presence is built from condition, grooming, hair and expression — the things entirely in your control.") +
      "\n\nWhy it's in your read at all: not as a grade to chase — this score is mostly bone and moves least of anything here — but because it tells the plan where to aim. A high fit means styling should stay quiet and let structure speak. A lower fit means the deliberate work is optical: hairstyle geometry, facial-hair lines and frame widths chosen to lend the eye a different set of ratios than the ones measured. Either way, the score's job is direction, not judgement.",
  });

  const thirdNames: [string, number][] = [
    ["upper (hairline to brow)", t.upper],
    ["mid (brow to nose base)", t.mid],
    ["lower (nose base to chin)", t.lower],
  ];
  const sorted = [...thirdNames].sort((a, b) => b[1] - a[1]);
  const maxDev = Math.max(...thirdNames.map(([, v]) => Math.abs(v - 1 / 3))) * 100;
  items.push({
    label: "Facial thirds",
    value: `${Math.round(t.upper * 100)} / ${Math.round(t.mid * 100)} / ${Math.round(t.lower * 100)}`,
    detail:
      (maxDev <= 3
        ? "Close to equal thirds — the classical vertical balance, where hairline-to-brow, brow-to-nose-base and nose-base-to-chin divide the face into near-identical bands. Nothing here asks for optical correction; hairstyle choices are free to follow taste instead of compensation."
        : `The ${sorted[0][0]} third runs largest and the ${sorted[2][0]} smallest — a spread of about ${Math.round((sorted[0][1] - sorted[2][1]) * 100)} points between them. The eye reads this before it reads any single feature: a dominant lower third reads strong and mature, a dominant upper third reads thoughtful, a dominant mid third centres attention on the eyes and nose. None of these is a flaw — they're different visual signatures.`) +
      "\n\nThirds are bone and hairline — they don't change with effort, and this read won't move much between scans (if it does, hair position over the hairline is why). The deliberate response is optical, and it's genuinely effective: fringe and length add or remove apparent upper-third height, facial hair extends or trims the lower third, and volume placement shifts where the eye divides the face. Your hairstyle guide turns your exact three numbers into a barber brief — that's this read doing its job.",
  });

  const fifthsSpread = (Math.max(...m.fifths) - Math.min(...m.fifths)) * 100;
  items.push({
    label: "Facial fifths (width)",
    value: `spread ${fifthsSpread.toFixed(0)} pts`,
    detail:
      (fifthsSpread <= 4
        ? "Width segments are even across the face — the five vertical bands (temple, eye, nose bridge span, eye, temple) sit in close proportion to each other, which is why the face reads balanced from straight on."
        : fifthsSpread <= 8
          ? "Width segments are mostly even with mild variation — one band runs slightly wide or narrow against the others. This is the common case, and it's rarely what an observer actually notices; expression and condition outrank it."
          : "Width segments vary noticeably across the face — the horizontal architecture is uneven, which usually means one feature group (often eye spacing or jaw width) dominates the front-on read.") +
      "\n\nLike the thirds, fifths are structural — the read is stable across scans and its value is guidance. Uneven fifths are what hairstyle side-volume, glasses width and photo distance are for: shooting from too close exaggerates the centre bands, which is why scan photos taken at arm's length read truer than close-ups. If this spread changes a lot between scans, suspect camera distance before anatomy.",
  });

  items.push({
    label: "Canthal tilt",
    value: `${m.canthalTiltDeg > 0 ? "+" : ""}${m.canthalTiltDeg.toFixed(1)}°`,
    detail:
      (m.canthalTiltDeg >= 2
        ? "Clearly positive (upturned) tilt — the outer corners of the eyes sit measurably higher than the inner corners. This is one of the most commented-on reads in looksmaxxing because it changes how the whole eye area lands: positive tilt reads alert, sharp and slightly predatory in stills."
        : m.canthalTiltDeg >= -1
          ? "Neutral tilt — inner and outer eye corners sit close to level, in the typical range. Neither lifting the eye area's read nor dragging it; what the eye area communicates will be decided by under-eye condition and brow position instead."
          : "Negative (downturned) tilt in this photo — the outer corners sit lower than the inner. In stills this can read tired or heavy even when you aren't, which is precisely why it's worth separating the tilt itself from everything that amplifies it.") +
      "\n\nThe honest anatomy: tilt is set by the orbital structure and the canthal tendons — no softmaxxing exercise re-angles it, and anything claiming to is selling fiction. What genuinely changes is how strongly the tilt reads. Under-eye darkness pools shadow exactly where a negative tilt already dips, sleep debt lowers the whole lid complex, and squinting in harsh light drags the outer corners in photos. The plan therefore works this trait from the sleep and skin side, and the re-scan comparison that matters is tilt photographed rested versus tired — the angle will match; the impression won't.",
  });

  items.push({
    label: "Jaw to cheekbone",
    value: m.jawToCheekbone.toFixed(2),
    detail:
      (m.jawToCheekbone >= 0.95
        ? "The jaw measures wide against the cheekbones — near parity between the jaw angles and the widest point of the cheekbones. Lower faces that read this way tend to photograph strong from front and three-quarter angles alike."
        : m.jawToCheekbone >= 0.85
          ? "Jaw width sits in the typical range against the cheekbones. At this ratio the bone is not the deciding factor in how defined the jaw looks — the deciding factors are what's over the bone: facial fat, water retention and the angle your head habitually sits at."
          : "The jaw reads narrower and softer than the cheekbones in this measurement. Part of that is structural — the ratio itself — and part is presentational: the jaw is the feature most buried by facial fat and morning puffiness, and the first one revealed when both come down.") +
      "\n\nWhat moves the read: body composition over months (the jaw is where fat loss shows first on most faces), debloat discipline over days (sodium, sleep and alcohol decide morning jaw visibility more than any exercise), and posture in the photo itself — head pushed slightly forward and chin level sharpens the jaw line the camera sees. Tongue posture (mewing) belongs in the honest middle: it changes how the jaw sits at rest and how you habitually hold it, which is real but modest. Your plan sequences these by speed — debloat first, composition underneath it — and this ratio, tracked across scans, is how you'll see it working.",
  });

  items.push({
    label: "Facial width-to-height",
    value: m.fwhr.toFixed(2),
    detail:
      (m.fwhr >= 1.8 && m.fwhr <= 2.05
        ? "Inside the commonly cited 1.8–2.0 band — cheekbone width against the height of the mid-face. Faces in this band are the ones research photographs describe as broad and mature in structure."
        : m.fwhr < 1.8
          ? "A narrower, longer facial structure — width runs low against mid-face height. This is the architecture behind a leaner, more angular overall impression, and it's common in lighter frames."
          : "A wide facial structure — width runs high against mid-face height, giving a broad, grounded read.") +
      "\n\nFWHR barely moves between scans — it's a ratio of two structural spans — so treat it as context for styling rather than a progress metric. A lower FWHR is balanced by side volume in the hair and punished by tall, narrow styling; a higher FWHR wants height kept in check so width doesn't dominate. It also quietly explains other reads: wide structures show jaw definition earlier in a fat-loss phase, narrow structures show cheekbone contour earlier. Your plan's style section is written with this number in hand.",
  });

  items.push({
    label: "Face shape",
    value: m.faceShape === "unknown" ? "Not classified" : m.faceShape,
    detail:
      m.faceShape === "unknown"
        ? "This photo didn't classify cleanly into a shape — usually because hair covered the hairline, the angle was slightly off true-front, or the width ratios landed between two shapes. Shape is read from the relationship between forehead, cheekbone and jaw widths plus face length, and it needs those landmarks visible. The next scan with hair off the forehead and the camera level will classify it — and shape matters, because it's the input your hairstyle and frames guidance is built from."
        : `Classified ${m.faceShape} from the length-to-width ratio and the relative widths of forehead, cheekbones and jaw. Shape is the frame everything else is styled around: it decides which hairstyles lend balance, where facial hair should hold its lines, and what glasses geometry flatters rather than fights the face. Two people with identical scores and different shapes get different style sections in their plans for exactly this reason — if you read your plan's style guidance and it feels specific, this classification is why. It should stay constant across scans; if it flips, the capture angle differed, not your face.`,
  });

  items.push({
    label: "Skin redness",
    value: `${Math.round(m.skin.redness)}/100`,
    detail:
      (m.skin.redness <= 33
        ? "Calm — little visible redness in this light. Skin that reads this way is usually a sign the barrier is intact and not being argued with: no stacked actives fighting each other, no over-washing, no unprotected sun debt."
        : m.skin.redness <= 66
          ? "Moderate redness — visible flushing or persistent pink across the central face. The usual drivers are barrier stress (too many actives introduced at once, over-exfoliation, harsh cleansing), sun exposure without protection, heat, and for some people, plain genetics showing through fair skin."
          : "Active redness in this read — the skin is visibly reactive in this photo. At this level the deliberate move is subtraction before addition: two weeks of nothing but gentle cleansing, moisturiser and SPF, so the barrier can settle and you can see what the baseline actually is.") +
      "\n\nWhy the plan treats this first among skin signals: an irritated barrier makes every other skin read worse — texture looks rougher, blemishes heal slower and leave longer marks, under-eyes read darker against inflamed skin. So the skin section deliberately simplifies before it builds, and redness trending down across scans is often the earliest visible proof the protocol is working. One boundary, stated plainly: redness that is persistent, spreading, painful or patterned across the cheeks belongs to a dermatologist, not a product shelf.",
  });

  items.push({
    label: "Skin texture",
    value: `${Math.round(m.skin.texture)}/100`,
    detail:
      (m.skin.texture <= 33
        ? "A smooth texture read — pores and surface variation are low in this photo, and light is travelling across the skin evenly rather than catching on roughness."
        : m.skin.texture <= 66
          ? "Moderate texture — visible surface variation: pore prominence, small bumps, areas that catch light unevenly. This is the most common read there is, and the one most distorted by photography — hard side-light will double it, soft front-light will halve it."
          : "A rough texture read — pronounced surface variation across the skin. Before treating the number as your skin's report card, account for the capture: directional light rakes across texture and exaggerates it more than any other skin signal.") +
      "\n\nWhat actually changes texture: hydration in the short term (dehydrated skin reads dramatically rougher), consistent gentle exfoliation over weeks, and time on a stable routine — skin cell turnover runs on a roughly monthly cycle, so texture is judged scan-to-scan, never day-to-day. The deliberate trap to avoid is intensity: aggressive scrubbing and acid stacking roughen the barrier and make this read worse while feeling productive. Your plan doses texture work low and steady for exactly that reason, and same-light re-scans are how you'll know it's landing.",
  });

  items.push({
    label: "Blemish estimate",
    value: `~${m.skin.blemishCount}`,
    detail:
      (m.skin.blemishCount <= 3
        ? "Very few blemish marks detected — skin clarity is a strength in this scan, and the protocol's job is maintenance and protection rather than correction."
        : m.skin.blemishCount <= 10
          ? "A moderate blemish count — a scattering of active spots or recent marks. At this level the count usually reflects a handful of recurring causes rather than a skin type: touching the face through the day, a pillowcase carrying a week's buildup, products being introduced faster than skin can vote on them."
          : "A high blemish estimate in this photo — frequent active spots or widespread marks. (It is an estimate from a photo: shadows, stubble and healing marks can all be counted, so treat the trend as truer than any single number.)") +
      "\n\nThe deliberate order of operations in your plan: hygiene and hands first — pillowcase rotation, phone-screen cleaning, hands off the face — because they cost nothing and quietly remove causes. Then patience with a simple routine, changing one thing at a time so cause and effect stay readable. Picking is the one behaviour that reliably makes this worse: it converts days of healing into weeks of marks. And the honest ceiling: breakouts that are deep, painful, cystic or leaving scars are past softmaxxing — that's a dermatologist's territory, and going early is the deliberate move, not a defeat.",
  });

  items.push({
    label: "Under-eye darkness",
    value: `${Math.round(m.skin.underEye)}/100`,
    detail:
      (m.skin.underEye <= 33
        ? "Bright under-eyes in this read — the eye area is holding up its side of the overall impression, which usually means sleep is doing its job."
        : m.skin.underEye <= 66
          ? "Moderate under-eye darkness — visible shadowing under the eyes. This is the most lifestyle-sensitive read on the entire face: it worsens with short or irregular sleep, late screens, dehydration and allergies, and improves on the same levers faster than almost anything else measured here."
          : "Pronounced under-eye darkness — the eye area is reading tired regardless of how you feel. At this level it's worth running the experiment the plan sets up: a week of fixed wake times and protected sleep, then a re-scan. How much of the darkness survives a rested week tells you how much is fatigue (changeable, fast) versus structure and skin thinness (managed, slower).") +
      "\n\nWhy this read gets its own slot in your foundations: the under-eye is where observers judge restedness, and restedness quietly colours every other impression — the same face reads points better rested. That's why your plan's sleep rules are written as an appearance intervention, not generic wellness advice, and why this number, more than any other, should be compared only between scans taken at a similar time of day. Morning scans after poor sleep will always read darkest; the trend across rested scans is the signal.",
  });

  const standings: { name: string; strength: number }[] = [
    { name: "symmetry", strength: clamp01(m.symmetryScore / 100) },
    { name: "proportion fit", strength: clamp01(m.goldenRatioScore / 100) },
    { name: "skin calm (low redness)", strength: skinCalm(m.skin.redness) },
    { name: "skin smoothness", strength: skinCalm(m.skin.texture) },
    { name: "under-eye brightness", strength: skinCalm(m.skin.underEye) },
    { name: "blemish clarity", strength: clamp01(1 - m.skin.blemishCount / 20) },
  ];
  const sortedStandings = [...standings].sort((a, b) => b.strength - a.strength);
  const strongest = `Your standout in this scan is ${sortedStandings[0].name}. Protect it — the plan is sequenced to improve the weaker reads without disturbing what's already working, because more than one user has traded away a strength by attacking everything at once.`;
  const weakest = sortedStandings[sortedStandings.length - 1];
  const biggestLever = `The highest-return focus from this read is ${weakest.name} — it's the trait furthest from its strong band, and the overall score is pulled by its weakest components, so early effort here moves the headline number more than the same effort spent anywhere else. That's the order your protocol works in, and the order your coach will hold you to.`;

  const intro =
    "This is the full deliberate read of this scan — every trait the measurement found, what it means, and what honestly moves it. Two ground rules before the detail. First, everything here comes from one photo, measured on your device: lighting, angle, time of day and last night's sleep all leave fingerprints on these numbers, which is why the reads separate structure (slow, mostly bone) from condition (fast, mostly habits) — they are worked differently and judged on different clocks. Second, nothing here is a medical statement; where a read crosses into health territory, the read says so and points at a professional.";

  const nextScan =
    "On your next scan, compare in this order: under-eye and redness first (they move in weeks and prove the foundations are landing), texture and blemish count second (monthly cycle — judge them scan-to-scan), then the overall score as the summary of all of it. Symmetry, thirds, fifths, tilt, jaw ratio, FWHR and shape should barely move — if one of them jumps, the photo differed (angle, distance, light), and that scan's condition reads should be discounted too. Take scans at the same time of day, same light, camera level at arm's length: the discipline is what turns these reads from snapshots into evidence — and it's the same history your coach analyses when it plans your next phase with you.";

  return { items, strongest, biggestLever, intro, nextScan };
}
