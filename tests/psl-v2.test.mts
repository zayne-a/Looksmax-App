// @ts-nocheck
/**
 * PSL Scoring v2 — synthetic-landmark calibration fixtures.
 *
 * Run:  node tests/psl-v2.test.mts        (Node ≥ 22, type stripping)
 *
 * These fixtures are the test that would have caught the v1 FWHR bug
 * (a ratio graded against the wrong band, structurally zero for every
 * face): they build synthetic 478-landmark faces at KNOWN metric
 * values and assert the anchored outcomes from the research spec
 * (research_notes/psl-scoring/psl-scoring-spec.md):
 *   - an ideal face lands in the top band (True Adam, PSL ≥ 9.5/10)
 *   - a population-typical face lands at PSL ≈ 5.0/10 (MTN), C ≈ 50
 *   - NO scored metric is dead: perturbing any one moves the composite
 *   - single-metric deviations move the EXPECTED region subscore most
 *   - repeatability (owner rule — NO AI in scoring): identical
 *     landmarks → identical score, exactly
 *   - the side gate passes a true profile, rejects a frontal capture
 *   - v1 scans keep their legacy numbers (history is never rescored)
 */
import { computeMeasurements, computeSideMetrics } from "../src/lib/face.ts";
import {
  applyScoringV2,
  miscScores,
  pslPotential,
  pslScore,
  regionScores,
  scoreBreakdownV2,
  tierForMeasurements,
} from "../src/lib/psl.ts";
import {
  buildScoreView,
  regionDisplayScore,
  toDisplayScore,
} from "../src/lib/score-view.ts";
import { regionLabel, scoreTierLabel } from "../src/lib/creator-tiers.ts";

// ---------------------------------------------------------------------------
// Synthetic landmark generator — builds a 478-point face whose measured
// ratios land on the knob values (solved in closed form / by search).
// ---------------------------------------------------------------------------

const W = 1000;
const H = 1250;
const D2R = Math.PI / 180;

const MEDIAN = {
  fw: 400, totalHW: 1.305, esr: 0.455, oneEye: 1.0, tiltDeg: 2,
  thirds: [0.3, 0.345, 0.355], fwhr: 1.88, bigonial: 0.8,
  cheekSete: 0.75, chinPhil: 1.9, mouthNose: 1.38,
  lipRatio: 1.45, eyeAspect: 3.3, browSete: 0.7, browTiltDeg: 9,
  bitemporal: 0.85, eyeMouth: 0.37, jitterScale: 1,
};

const IDEAL = {
  fw: 400, totalHW: 1.355, esr: 0.465, oneEye: 1.0, tiltDeg: 6.75,
  thirds: [1 / 3, 1 / 3, 1 / 3], fwhr: 2.0, bigonial: 0.885,
  cheekSete: 0.88, chinPhil: 2.3, mouthNose: 1.455,
  lipRatio: 1.7, eyeAspect: 3.2, browSete: 0.55, browTiltDeg: 9,
  bitemporal: 0.895, eyeMouth: 0.36, jitterScale: 0.06,
};

const MEDIAN_F = {
  ...MEDIAN,
  totalHW: 1.28, esr: 0.46, tiltDeg: 3, bigonial: 0.78, chinPhil: 1.85,
  mouthNose: 1.42, eyeAspect: 3.1, browSete: 0.75, browTiltDeg: 12,
  bitemporal: 0.83, cheekSete: 0.74, fwhr: 1.85, lipRatio: 1.5,
};

// Symmetry jitter on right-side, symmetry-only points (px). 282 jitters
// TOWARD the midline so it can never be mistaken for a brow endpoint.
const JITTER = [
  [409, 40, 50], [288, 40, 50], [323, 40, 50], [282, -40, 50],
  [334, 40, 0], [386, 40, 0], [374, 40, 0],
];

function buildFace(k) {
  const lm = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.32 }));
  const set = (i, px, py) => { lm[i] = { x: px / W, y: py / H }; };
  const cx = 500;
  const y10 = 100;
  const faceH = k.totalHW * k.fw;
  const chinY = y10 + faceH;
  const [sU, sM] = [k.thirds[0], k.thirds[1]];
  const u = (sU * faceH) / (1.22 - 0.22 * sU);
  const browY = y10 + u;
  const T = faceH + 0.22 * u;
  const noseBaseY = browY + sM * T;
  const D = k.fw / k.fwhr;
  const lipTopY = browY + D;
  const philtrum = lipTopY - noseBaseY;
  const chinH = k.chinPhil * philtrum;
  const uv = (chinY - lipTopY - 2 - chinH) / (1 + k.lipRatio);
  const y13 = lipTopY + uv;
  const y14 = y13 + 2;
  const y17 = chinY - chinH;
  const ipd = k.esr * k.fw;
  const ew = ipd / (1 + k.oneEye);
  const ic = ipd - ew;
  const mouthLineY = (lipTopY + y13) / 2;
  const eyeY = mouthLineY - k.eyeMouth * faceH;
  const tiltDy = Math.tan(k.tiltDeg * D2R) * ew;
  const fissure = ew / k.eyeAspect;
  set(10, cx, y10); set(168, cx, browY); set(2, cx, noseBaseY); set(152, cx, chinY);
  set(1, cx, noseBaseY - (noseBaseY - browY) * 0.45);
  set(0, cx, lipTopY); set(13, cx, y13); set(14, cx, y14); set(17, cx, y17);
  set(468, cx - ipd / 2, eyeY); set(473, cx + ipd / 2, eyeY);
  set(133, cx - ic / 2, eyeY); set(33, cx - ic / 2 - ew, eyeY - tiltDy);
  set(362, cx + ic / 2, eyeY); set(263, cx + ic / 2 + ew, eyeY - tiltDy);
  set(159, cx - ipd / 2, eyeY - fissure / 2); set(145, cx - ipd / 2, eyeY + fissure / 2);
  set(386, cx + ipd / 2, eyeY - fissure / 2); set(374, cx + ipd / 2, eyeY + fissure / 2);
  const eyeLineY = eyeY - tiltDy / 2;
  const browSpan = 105;
  const btDy = Math.tan(k.browTiltDeg * D2R) * browSpan;
  const browBaseY = eyeLineY - k.browSete * ew;
  const chainA = [107, 105, 66, 65, 63, 55, 53, 52, 70, 46];
  const chainB = [336, 334, 296, 295, 293, 285, 283, 282, 300, 276];
  chainA.forEach((idx, j) => {
    const fx = j / (chainA.length - 1);
    set(idx, cx - ic / 2 - 6 - fx * browSpan, browBaseY - fx * btDy);
  });
  chainB.forEach((idx, j) => {
    const fx = j / (chainB.length - 1);
    set(idx, cx + ic / 2 + 6 + fx * browSpan, browBaseY - fx * btDy);
  });
  const shift = browBaseY - lm[105].y * H;
  [...chainA, ...chainB].forEach((idx) => {
    lm[idx] = { x: lm[idx].x, y: (lm[idx].y * H + shift) / H };
  });
  const cheekY = noseBaseY - k.cheekSete * (noseBaseY - eyeY);
  set(234, cx - k.fw / 2, cheekY); set(454, cx + k.fw / 2, cheekY);
  const noseW = 62;
  set(49, cx - noseW / 2, noseBaseY - 6); set(279, cx + noseW / 2, noseBaseY - 6);
  set(129, cx - 14, noseBaseY - 2); set(409, cx + 14, noseBaseY - 2);
  const mouthW = k.mouthNose * noseW;
  set(61, cx - mouthW / 2, lipTopY + uv * 0.4); set(291, cx + mouthW / 2, lipTopY + uv * 0.4);
  set(109, cx - (k.bitemporal * k.fw) / 2, y10 + 34);
  set(338, cx + (k.bitemporal * k.fw) / 2, y10 + 34);
  const jawW = k.bigonial * k.fw;
  const jawY = chinY - 95;
  set(132, cx - jawW / 2, jawY); set(361, cx + jawW / 2, jawY);
  set(172, cx - jawW / 2 - 6, jawY - 55); set(397, cx + jawW / 2 + 6, jawY - 55);
  set(58, cx - jawW / 2 - 14, jawY + 26); set(288, cx + jawW / 2 + 14, jawY + 26);
  set(93, cx - k.fw / 2 + 8, cheekY + 42); set(323, cx + k.fw / 2 - 8, cheekY + 42);
  for (const [idx, dx, dy] of JITTER) {
    lm[idx] = {
      x: lm[idx].x + (dx * k.jitterScale) / W,
      y: lm[idx].y + (dy * k.jitterScale) / H,
    };
  }
  return lm;
}

function buildSide() {
  const lm = Array.from({ length: 478 }, () => ({ x: 0.45, y: 0.4 }));
  const set = (i, px, py) => { lm[i] = { x: px / W, y: py / H }; };
  set(10, 450, 180);
  set(168, 400, 300);
  set(1, 310, 420);
  set(2, 330, 470);
  set(152, 365, 585);
  set(468, 395, 380); set(473, 390, 382);
  set(127, 530, 370);
  set(132, 480, 500);
  set(172, 520, 520);
  return lm;
}

const SKIN_MEDIAN = { redness: 30, texture: 35, blemishCount: 4, underEye: 40 };
const SKIN_IDEAL = { redness: 5, texture: 8, blemishCount: 0, underEye: 4 };

function measure(knobs, skin, gender = "male", side = undefined) {
  const raw = computeMeasurements(buildFace(knobs), W, H);
  const m = { ...raw, skin, landmarksDetected: true, notes: [], gender };
  if (side !== undefined) m.side = side;
  return applyScoringV2(m);
}

// ---------------------------------------------------------------------------
// Tiny assertion harness
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;
function check(name, cond, detail = "") {
  if (cond) {
    passed++;
    console.log(`  ok  ${name}${detail ? ` — ${detail}` : ""}`);
  } else {
    failed++;
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}
const near = (v, lo, hi) => v >= lo && v <= hi;

// ---------------------------------------------------------------------------

console.log("\n[1] Calibration anchors");
const ideal = measure(IDEAL, SKIN_IDEAL);
const idealB = scoreBreakdownV2(ideal);
check("ideal composite in top range", idealB.composite >= 92, `C=${idealB.composite.toFixed(1)}`);
check("ideal PSL >= 9.5", pslScore(ideal) >= 9.5, `PSL=${pslScore(ideal)}`);
check(
  "ideal tier is True Adam",
  tierForMeasurements(ideal, pslScore(ideal)).label === "True Adam",
  tierForMeasurements(ideal, pslScore(ideal)).label
);

const median = measure(MEDIAN, SKIN_MEDIAN);
const medianB = scoreBreakdownV2(median);
check("median composite ≈ 50", near(medianB.composite, 44, 56), `C=${medianB.composite.toFixed(1)}`);
check("median PSL ≈ 5.0/10", near(pslScore(median), 4.7, 5.3), `PSL=${pslScore(median)}`);
check(
  "median tier is Mid-Tier Normie",
  tierForMeasurements(median, pslScore(median)).label === "Mid-Tier Normie",
  tierForMeasurements(median, pslScore(median)).label
);

const medianF = measure(MEDIAN_F, SKIN_MEDIAN, "female");
check("female median PSL ≈ 5.0/10", near(pslScore(medianF), 4.4, 5.6), `PSL=${pslScore(medianF)}`);

console.log("\n[2] The FWHR regression guard (the v1 bug)");
check(
  "fwhr is the TRUE FWHR (brow->lip), not the v1 width/full-height ~0.7",
  near(median.fwhr, 1.8, 1.96),
  `fwhr=${median.fwhr.toFixed(2)}`
);
check("fwhr metric term is alive", medianB.metrics.fwhr > 30, `score=${medianB.metrics.fwhr.toFixed(1)}`);

console.log("\n[3] No dead metric — every perturbation moves the composite");
const perturbations = [
  ["esr", { esr: 0.5 }],
  ["thirds", { thirds: [0.36, 0.32, 0.32] }],
  ["tilt", { tiltDeg: 6 }],
  ["fwhr (+midface)", { fwhr: 2.02 }],
  ["totalHW", { totalHW: 1.36 }],
  ["bigonial", { bigonial: 0.87 }],
  ["cheekSete", { cheekSete: 0.85 }],
  ["chinPhil", { chinPhil: 2.3 }],
  ["mouthNose", { mouthNose: 1.5 }],
  ["lipRatio", { lipRatio: 1.8 }],
  ["eyeAspect", { eyeAspect: 3.8 }],
  ["browSete", { browSete: 0.5 }],
  ["browTilt", { browTiltDeg: 14 }],
  ["bitemporal", { bitemporal: 0.92 }],
  ["eyeMouth", { eyeMouth: 0.33 }],
  ["oneEye", { oneEye: 1.15 }],
  ["symmetry", { jitterScale: 1.6 }],
];
for (const [name, patch] of perturbations) {
  const p = measure({ ...MEDIAN, ...patch }, SKIN_MEDIAN);
  const d = Math.abs(scoreBreakdownV2(p).composite - medianB.composite);
  check(`perturbing ${name} moves composite`, d > 0.05, `ΔC=${d.toFixed(2)}`);
}
{
  const badSkin = measure(MEDIAN, { redness: 70, texture: 70, blemishCount: 12, underEye: 75 });
  const d = Math.abs(scoreBreakdownV2(badSkin).composite - medianB.composite);
  check("perturbing skin moves composite", d > 0.05, `ΔC=${d.toFixed(2)}`);
}

console.log("\n[4] Single-metric deviations move the expected region most");
const regionMap = (m) =>
  Object.fromEntries(regionScores(m).map((r) => [r.key, r.score]));
const baseRegions = regionMap(median);
function regionDrop(name, basePatch, patch, expectedKey) {
  // Each deviation starts from a HEALTHY value of its metric — at the
  // population median several terms already sit near their floor and
  // cannot drop further (that is the calibration working).
  const base = regionMap(measure({ ...MEDIAN, ...basePatch }, SKIN_MEDIAN));
  const r = regionMap(measure({ ...MEDIAN, ...basePatch, ...patch }, SKIN_MEDIAN));
  const drops = Object.keys(base).map((k) => [k, base[k] - r[k]]);
  const worst = drops.reduce((a, b) => (b[1] > a[1] ? b : a));
  check(
    `${name} deviation drops ${expectedKey} most`,
    worst[0] === expectedKey && worst[1] > 0.3,
    `drops: ${drops.map(([k, v]) => `${k} −${v.toFixed(1)}`).join(", ")}`
  );
}
regionDrop("negative canthal tilt", { tiltDeg: 6.75 }, { tiltDeg: -4 }, "eyes");
regionDrop("narrow jaw (bigonial)", { bigonial: 0.885 }, { bigonial: 0.7 }, "lowerThird");
regionDrop("wide eye spacing (ESR)", {}, { esr: 0.52 }, "eyes");
regionDrop("low cheekbones", {}, { cheekSete: 0.55 }, "midface");

console.log("\n[5] Repeatability — no AI, pure function (owner rule)");
{
  const a = measure(MEDIAN, SKIN_MEDIAN);
  const b2 = measure(MEDIAN, SKIN_MEDIAN);
  check(
    "identical landmarks -> identical breakdown",
    JSON.stringify(scoreBreakdownV2(a)) === JSON.stringify(scoreBreakdownV2(b2))
  );
  check("identical landmarks -> identical PSL", pslScore(a) === pslScore(b2), `${pslScore(a)}`);
}

console.log("\n[6] Side gate");
{
  const side = computeSideMetrics(buildSide(), W, H);
  check("profile fixture passes the gate", side !== null);
  check(
    "gonial reads back near construction (~117°)",
    side !== null && near(side.gonialAngleDeg, 108, 128),
    side ? `${side.gonialAngleDeg.toFixed(1)}°` : "null"
  );
  check(
    "frontal capture is rejected by the gate",
    computeSideMetrics(buildFace(MEDIAN), W, H) === null
  );
  const withSide = measure(MEDIAN, SKIN_MEDIAN, "male", side);
  check("side joins the pools when the gate passes", scoreBreakdownV2(withSide).sideIncluded === true);
  check(
    "no side -> frontal-only renormalisation",
    scoreBreakdownV2(median).sideIncluded === false
  );
}

console.log("\n[7] Stamping");
check(
  "applyScoringV2 stamps overallScore = composite",
  Math.abs(median.overallScore - Math.round(medianB.composite * 10) / 10) < 0.11,
  `overall=${median.overallScore} C=${medianB.composite.toFixed(1)}`
);
check(
  "goldenRatioScore field carries the Harmony bucket on v2 scans",
  Math.abs(median.goldenRatioScore - Math.round(medianB.buckets.harmony * 10) / 10) < 0.11,
  `field=${median.goldenRatioScore} H=${medianB.buckets.harmony.toFixed(1)}`
);

console.log("\n[8] Legacy v1 scans keep their numbers");
{
  const v1 = {
    facialThirds: { upper: 0.33, mid: 0.34, lower: 0.33 },
    fifths: [0.2, 0.2, 0.2, 0.2, 0.2],
    canthalTiltDeg: 5,
    jawToCheekbone: 0.88,
    fwhr: 0.72,
    symmetryScore: 90,
    goldenRatioScore: 78,
    overallScore: 71,
    faceShape: "oval",
    skin: SKIN_MEDIAN,
    landmarksDetected: true,
    notes: [],
  };
  check("v1 PSL mapping unchanged", pslScore(v1) === 5.9, `PSL=${pslScore(v1)}`);
  check(
    "v1 tier resolves on the legacy thresholds",
    tierForMeasurements(v1, 5.9).label === "Chadlite",
    tierForMeasurements(v1, 5.9).label
  );
  check(
    "v1 region deck is the legacy body",
    regionScores(v1)[0].note.includes("under-eye")
  );
  check(
    "v1 misc deck is the legacy body",
    miscScores(v1)[1].note.includes("classical")
  );
  check("v1 has no v2 breakdown", scoreBreakdownV2(v1) === null);
}

// ------------------------------------------------------------------
// [9] Display scale (lib/score-view.ts) — the web shows the template
// 1–8 dialect, never a /10 number, VALUE-IDENTICAL to the native
// app's scoreView. v2 is RAW: the display value IS the engine's
// PSL8 (clamp(4.0 + (C − 50)/12.5, 0.5, 7.9), one decimal) and the
// tier is the template ladder's lookup at that displayed number —
// the numeral a creator card would show for the same person. v1
// scans keep the legacy anchor conversion below (their recorded
// meaning). Fixtures reuse the section-[1]/[8] faces plus the
// reference-class face defined here.

// Reference-class face: knobs tuned so the composite lands on
// C ≈ 37.5 → engine PSL8 ≈ 3.0 (the class of the live reference
// portrait: raw display 3.0, Low-Tier Normie).
const REFERENCE = {
  fw: 400, totalHW: 1.2874, esr: 0.4455, oneEye: 1.0135, tiltDeg: 0.9183,
  thirds: [0.2919, 0.3409, 0.3672], fwhr: 1.8367, bigonial: 0.7675,
  cheekSete: 0.7148, chinPhil: 1.8054, mouthNose: 1.3367,
  lipRatio: 1.3689, eyeAspect: 3.4623, browSete: 0.7676, browTiltDeg: 7.3775,
  bitemporal: 0.8311, eyeMouth: 0.3808, jitterScale: 1.3245,
};
const SKIN_REFERENCE = {
  redness: 37.6, texture: 42.3, blemishCount: 5.9, underEye: 47.6,
};
{
  console.log("\n[9] Display scale — web display == native raw presentation");
  const rawPsl8 = (m) => {
    const b = scoreBreakdownV2(m);
    return Math.min(7.9, Math.max(0.5, 4.0 + (b.composite - 50) / 12.5));
  };
  const round1 = (v) => Math.round(v * 10) / 10;

  // v2 median: raw display 4.2, template tier Mid-Tier Normie.
  const medianView = buildScoreView(median);
  check(
    "median v2 display is the RAW PSL8 (4.2)",
    medianView.psl.display === round1(rawPsl8(median)) &&
      medianView.psl.display === 4.2,
    `C=${scoreBreakdownV2(median).composite.toFixed(1)} -> ${medianView.psl.display}`
  );
  check(
    "median displayed tier is the template lookup at 4.2",
    medianView.psl.verdict === scoreTierLabel(4.2, "male") &&
      medianView.psl.verdict === "Mid-Tier Normie",
    medianView.psl.verdict
  );
  check(
    "median POTENTIAL follows the raw formula (4.6)",
    medianView.potential.display ===
      round1(
        Math.min(
          8,
          Math.max(
            0.5,
            rawPsl8(median) +
              (pslPotential(median) - pslScore(median)) / 1.25
          )
        )
      ) && medianView.potential.display === 4.6,
    `${medianView.potential.display}`
  );
  const idealView = buildScoreView(ideal);
  check(
    "ideal v2 display is the RAW PSL8 (7.8), True Adam",
    idealView.psl.display === 7.8 && idealView.psl.verdict === "True Adam",
    `${idealView.psl.display} ${idealView.psl.verdict}`
  );
  // v2 reference-class: engine PSL8 ≈ 3.0 displays 3.0, template LTN.
  const reference = measure(REFERENCE, SKIN_REFERENCE);
  const referenceView = buildScoreView(reference);
  check(
    "reference fixture engine PSL8 ≈ 3.0",
    rawPsl8(reference) >= 2.95 && rawPsl8(reference) < 3.05,
    `PSL8=${rawPsl8(reference).toFixed(3)}`
  );
  check(
    "reference displays 3.0 with the template LTN label",
    referenceView.psl.display === 3 &&
      referenceView.psl.verdict === "Low-Tier Normie" &&
      referenceView.psl.verdict ===
        scoreTierLabel(referenceView.psl.display, "male"),
    `${pslScore(reference)} -> ${referenceView.psl.display} ${referenceView.psl.verdict}`
  );
  check(
    "reference POTENTIAL follows the raw formula (3.5)",
    referenceView.potential.display === 3.5,
    `${referenceView.potential.display}`
  );
  check(
    "POTENTIAL display never exceeds 8.0",
    idealView.potential.display <= 8.0 &&
      medianView.potential.display <= 8.0,
    `ideal ${idealView.potential.display}, median ${medianView.potential.display}`
  );
  check(
    "POTENTIAL display >= PSL display",
    idealView.potential.display >= idealView.psl.display &&
      medianView.potential.display >= medianView.psl.display &&
      referenceView.potential.display >= referenceView.psl.display
  );
  const medianFView = buildScoreView(medianF);
  check(
    "female median displays raw 4.0, template female tier",
    medianFView.psl.display === 4 &&
      medianFView.psl.verdict === "Mid-Tier Becky",
    `${medianFView.psl.display} ${medianFView.psl.verdict}`
  );
  // v1 anchors: the legacy floors still map the same way.
  const LEGACY_FLOORS: [number, string][] = [
    [2.5, "Low-Tier Normie"],
    [3.5, "Mid-Tier Normie"],
    [4.5, "High-Tier Normie"],
    [5.5, "Chadlite"],
    [6.5, "Chad"],
    [8.5, "True Adam"],
  ];
  for (const [min, label] of LEGACY_FLOORS) {
    check(
      `v1 floor ${min} displays as tier ${label}`,
      scoreTierLabel(toDisplayScore(min), "male") === label,
      `${min} -> ${toDisplayScore(min)}`
    );
  }
  {
    const v1 = {
      facialThirds: { upper: 0.33, mid: 0.34, lower: 0.33 },
      fifths: [0.2, 0.2, 0.2, 0.2, 0.2],
      canthalTiltDeg: 5,
      jawToCheekbone: 0.88,
      fwhr: 0.72,
      symmetryScore: 90,
      goldenRatioScore: 78,
      overallScore: 71,
      faceShape: "oval",
      skin: SKIN_MEDIAN,
      landmarksDetected: true,
      notes: [],
    };
    const v = buildScoreView(v1);
    check(
      "v1 scan displays through the v1 anchors, tier preserved",
      v.psl.display === 5.7 && v.psl.verdict === "Chadlite",
      `${pslScore(v1)} -> ${v.psl.display} ${v.psl.verdict}`
    );
  }
  check(
    "region display scale endpoints (0->1, 5->4.5, 10->8)",
    regionDisplayScore(0) === 1 &&
      regionDisplayScore(5) === 4.5 &&
      regionDisplayScore(10) === 8
  );
  {
    const r0 = regionScores(median)[0];
    const rv = buildScoreView(median).regions[0];
    check(
      "region display == template region lookup",
      rv.display === regionDisplayScore(r0.score) &&
        rv.verdict === regionLabel(rv.display),
      `${r0.score} -> ${rv.display} ${rv.verdict}`
    );
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
