// Project Ascend — face measurement engine (pure functions, no React).
// All geometry is computed from MediaPipe FaceLandmarker 478 normalized
// landmarks (x,y in 0..1). Deterministic: same landmarks -> same numbers.
//
// Engine v2 (2026-10-22): the metric set follows the benchmark table in
// research_notes/psl-scoring/psl-scoring-spec.md. The v1 "golden ratio"
// composite (scored against 1.618 — a debunked universal target) and the
// mislabelled v1 "fwhr" (face width ÷ FULL face height, ~0.7) are gone:
// v2's fwhr is the true FWHR, bizygomatic ÷ (glabella → upper lip).
// This module returns raw geometry only — composite scores are stamped
// by lib/psl.ts (applyScoringV2) once skin is merged, in the scan flow.

import type {
  FaceMeasurements,
  FrontalMetricsV2,
  SideMetricsV2,
  SkinMetrics,
} from "./types";

/** One landmark point. Structurally matches MediaPipe NormalizedLandmark. */
export type Landmark = { x: number; y: number; z: number };

const clamp = (v: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, v));

// Pixel-space helpers (landmarks are normalized 0..1).
const xDist = (
  a: Landmark,
  b: Landmark,
  w: number
): number => Math.abs(a.x - b.x) * w;
const yDist = (
  a: Landmark,
  b: Landmark,
  h: number
): number => Math.abs(a.y - b.y) * h;
const dist = (
  a: Landmark,
  b: Landmark,
  w: number,
  h: number
): number => Math.hypot((a.x - b.x) * w, (a.y - b.y) * h);

function get(landmarks: Landmark[], i: number): Landmark {
  const p = landmarks[i];
  if (!p) throw new Error(`Missing landmark ${i}`);
  return p;
}

/** Angle (degrees) at `vertex` between the rays to `a` and `b`, in
 *  pixel space. */
function angleAt(
  vertex: Landmark,
  a: Landmark,
  b: Landmark,
  w: number,
  h: number
): number {
  const v1x = (a.x - vertex.x) * w;
  const v1y = (a.y - vertex.y) * h;
  const v2x = (b.x - vertex.x) * w;
  const v2y = (b.y - vertex.y) * h;
  const m1 = Math.hypot(v1x, v1y) || 1;
  const m2 = Math.hypot(v2x, v2y) || 1;
  const cos = clamp((v1x * v2x + v1y * v2y) / (m1 * m2), -1, 1);
  return (Math.acos(cos) * 180) / Math.PI;
}

/** The trichion (hairline) sits above the face mesh's top point (10):
 *  the mesh ends on the upper forehead, short of the anatomical
 *  hairline the facial-thirds ideals are defined against (spec §4.2).
 *  We estimate the hairline by extending the brow→mesh-top segment by
 *  this fraction. Named and documented because it is an estimate —
 *  the one free parameter in the thirds measurement. */
export const HAIRLINE_EXTENSION = 0.22;

// ---------------------------------------------------------------------------
// computeMeasurements
// ---------------------------------------------------------------------------

export function computeMeasurements(
  landmarks: Landmark[],
  imgW: number,
  imgH: number
): Omit<FaceMeasurements, "skin" | "landmarksDetected" | "notes"> {
  if (!landmarks || landmarks.length < 478) {
    throw new Error(
      "computeMeasurements needs all 478 MediaPipe face landmarks"
    );
  }

  const L = (i: number) => get(landmarks, i);
  const faceWE = dist(L(234), L(454), imgW, imgH) || 1; // bizygomatic, euclidean
  const faceW = xDist(L(234), L(454), imgW) || 1; // bizygomatic, horizontal (v1 convention)
  const faceH = yDist(L(10), L(152), imgH) || 1; // mesh top -> chin

  // ---- facial thirds, from the ESTIMATED hairline (spec §4.2) ----
  // The mesh top (10) is not the trichion; the upper third is measured
  // from the estimated hairline (see HAIRLINE_EXTENSION).
  const browY = L(168).y * imgH;
  const meshTopY = L(10).y * imgH;
  const hairlineY = meshTopY - HAIRLINE_EXTENSION * (browY - meshTopY);
  const upper = browY - hairlineY;
  const mid = yDist(L(168), L(2), imgH);
  const lower = yDist(L(2), L(152), imgH);
  const tSum = upper + mid + lower || 1;
  const facialThirds = {
    upper: upper / tSum,
    mid: mid / tSum,
    lower: lower / tSum,
  };

  // ---- facial fifths (horizontal segments across 234 -> 454) ----
  const segIdx = [234, 33, 133, 362, 263, 454]; // cheek -> outer eye -> inner eye ... (both eyes)
  const fifths: number[] = [];
  for (let i = 0; i < 5; i++) {
    fifths.push(
      xDist(L(segIdx[i]), L(segIdx[i + 1]), imgW) / faceW
    );
  }

  // ---- canthal tilt: angle of inner->outer eye corner line vs horizontal ----
  // y grows downward, so outerHigher => inner.y - outer.y > 0.
  const tiltOf = (inner: number, outer: number): number => {
    const dy = (L(inner).y - L(outer).y) * imgH;
    const dx = xDist(L(inner), L(outer), imgW) || 1;
    return (Math.atan2(dy, dx) * 180) / Math.PI;
  };
  const canthalTiltDeg = (tiltOf(133, 33) + tiltOf(362, 263)) / 2;

  // ---- width ratios ----
  const jawW = xDist(L(132), L(361), imgW);
  const jawToCheekbone = jawW / faceW; // F8: bigonial ÷ bizygomatic
  /** TRUE FWHR (F4): bizygomatic ÷ (glabella → upper lip). v1's field
   *  held faceW ÷ full height (~0.7) — a different quantity entirely. */
  const fwhr = faceWE / (dist(L(168), L(0), imgW, imgH) || 1);

  // ---- symmetry: 16 mirror pairs across the vertical midline (x of 168) ----
  const pairs: [number, number][] = [
    [33, 263], // outer eye corners
    [133, 362], // inner eye corners
    [61, 291], // mouth corners
    [132, 361], // jaw angles
    [234, 454], // cheeks
    [70, 300], // temples
    [105, 334], // brow
    [52, 282], // mid brow
    [172, 397], // jaw corners (ramus)
    [109, 338], // bitemporal
    [49, 279], // nose alae
    [129, 409], // nostrils
    [159, 386], // upper eyelids
    [145, 374], // lower eyelids
    [58, 288], // jaw contour
    [93, 323], // cheek contour
  ];
  const x0 = L(168).x;
  let symErr = 0;
  let symN = 0;
  for (const [li, ri] of pairs) {
    const l = L(li);
    const r = L(ri);
    const rMirroredX = 2 * x0 - r.x;
    symErr += (Math.abs(l.x - rMirroredX) * imgW) / faceW;
    symErr += (Math.abs(l.y - r.y) * imgH) / faceH;
    symN += 2;
  }
  const avgSymErr = symErr / (symN || 1);
  const symmetryScore = clamp(100 * (1 - 4 * avgSymErr), 0, 100);

  // ---- v2 frontal metrics (spec §5.1; raw values, scored in psl.ts) ----
  const ipd = dist(L(468), L(473), imgW, imgH);
  const eyeWidthA = dist(L(33), L(133), imgW, imgH);
  const eyeWidthB = dist(L(362), L(263), imgW, imgH);
  const meanEyeWidth = (eyeWidthA + eyeWidthB) / 2 || 1;
  const intercanthal = dist(L(133), L(362), imgW, imgH);

  // Brow tilt: inner end = brow point nearest the midline, outer end =
  // farthest, per brow chain (chains from the FaceLandmarker topology).
  const browChainA = [46, 52, 53, 55, 63, 65, 66, 70, 105, 107];
  const browChainB = [276, 282, 283, 285, 293, 295, 296, 300, 334, 336];
  const browTiltOf = (chain: number[]): number => {
    let inner = chain[0];
    let outer = chain[0];
    for (const i of chain) {
      if (Math.abs(L(i).x - x0) < Math.abs(L(inner).x - x0)) inner = i;
      if (Math.abs(L(i).x - x0) > Math.abs(L(outer).x - x0)) outer = i;
    }
    const dy = (L(inner).y - L(outer).y) * imgH; // outer higher => positive
    const dx = Math.abs(L(outer).x - L(inner).x) * imgW || 1;
    return (Math.atan2(dy, dx) * 180) / Math.PI;
  };

  const frontal: FrontalMetricsV2 = {
    esr: ipd / faceWE,
    intercanthalRatio: intercanthal / faceWE,
    oneEyeRatio: intercanthal / meanEyeWidth,
    totalHeightWidth: faceH / faceWE,
    midfaceRatio: ipd / (dist(L(168), L(0), imgW, imgH) || 1),
    eyeMouthRatio:
      (Math.abs((L(0).y + L(13).y) / 2 - (L(468).y + L(473).y) / 2) * imgH) /
      faceH,
    chinPhiltrumRatio:
      dist(L(17), L(152), imgW, imgH) / (dist(L(2), L(0), imgW, imgH) || 1),
    mouthNoseRatio:
      dist(L(61), L(291), imgW, imgH) / (dist(L(49), L(279), imgW, imgH) || 1),
    lipRatio:
      yDist(L(14), L(17), imgH) / (yDist(L(0), L(13), imgH) || 1),
    eyeAspectRatio:
      meanEyeWidth /
      (((yDist(L(159), L(145), imgH) + yDist(L(386), L(374), imgH)) / 2) || 1),
    browSetedness:
      ((((L(133).y + L(33).y) / 2 - L(105).y) * imgH) / (eyeWidthA || 1) +
        (((L(362).y + L(263).y) / 2 - L(334).y) * imgH) / (eyeWidthB || 1)) /
      2,
    browTiltDeg: (browTiltOf(browChainA) + browTiltOf(browChainB)) / 2,
    bitemporalRatio: dist(L(109), L(338), imgW, imgH) / faceWE,
    cheekboneSetedness:
      (L(2).y - (L(234).y + L(454).y) / 2) /
      ((L(2).y - (L(468).y + L(473).y) / 2) || 1),
    jawFrontalAngleDeg:
      (angleAt(L(132), L(172), L(152), imgW, imgH) +
        angleAt(L(361), L(397), L(152), imgW, imgH)) /
      2,
  };

  // ---- face shape classification ----
  const faceShape = classifyFaceShape(landmarks, imgW, imgH, faceW, faceH, jawW);

  return {
    facialThirds,
    fifths,
    canthalTiltDeg,
    jawToCheekbone,
    fwhr,
    symmetryScore,
    // Stamped by lib/psl.ts applyScoringV2 once skin is merged (the
    // composite needs the skin suite for its Misc bucket).
    goldenRatioScore: 0,
    overallScore: 0,
    faceShape,
    engineVersion: 2,
    frontal,
    side: null,
  };
}

// ---------------------------------------------------------------------------
// computeSideMetrics — side-profile reads behind a confidence gate.
// Spec §5.4: landmark quality in true profile is materially worse than
// frontal, so the gate checks the capture actually IS a profile and the
// fitted outline is plausible. Any doubt -> null, and the scorer
// renormalises weights. A side metric is NEVER estimated silently.
// ---------------------------------------------------------------------------

export function computeSideMetrics(
  landmarks: Landmark[],
  imgW: number,
  imgH: number
): SideMetricsV2 | null {
  try {
    if (!landmarks || landmarks.length < 478) return null;
    const L = (i: number) => get(landmarks, i);

    let minX = 1;
    let maxX = 0;
    let minY = 1;
    let maxY = 0;
    for (const p of landmarks) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    const spanX = (maxX - minX) * imgW || 1;
    const spanY = (maxY - minY) * imgH || 1;

    // Gate 1 — profile-ness: in profile the two irises nearly coincide
    // horizontally (frontal: ~0.4 of the span apart).
    if (Math.abs(L(468).x - L(473).x) * imgW > 0.22 * spanX) return null;
    // Gate 2 — the nose tip must protrude clearly from the brow line,
    // and be the foremost midline point on the facing side.
    const noseDir = Math.sign(L(1).x - L(168).x);
    if (noseDir === 0) return null;
    if (Math.abs(L(1).x - L(168).x) * imgW < 0.06 * spanX) return null;
    const foremost = noseDir > 0 ? maxX : minX;
    if (Math.abs(L(1).x - foremost) * imgW > 0.25 * spanX) return null;

    // The visible outline chain lives on the side the nose points to.
    const temple = noseDir < 0 ? 127 : 356;
    const jawSide = noseDir < 0 ? 132 : 361;
    const corner = noseDir < 0 ? 172 : 397;

    // Gate 3 — jaw chain plausibility: temple above jaw corner above
    // chin, in order (small tolerance for landmark jitter).
    const tol = 0.02 * spanY;
    if (!(L(temple).y < L(corner).y + tol)) return null;
    if (!(L(corner).y < L(152).y + tol)) return null;
    if (L(jawSide).y > L(corner).y + 0.05 * spanY) return null;

    const gonialAngleDeg = angleAt(L(corner), L(temple), L(152), imgW, imgH);
    const mandibularPlaneDeg =
      (Math.atan2(
        Math.abs(L(152).y - L(corner).y) * imgH,
        Math.abs(L(152).x - L(corner).x) * imgW || 1
      ) *
        180) /
      Math.PI;
    const convexityGlabellaDeg = angleAt(L(1), L(168), L(152), imgW, imgH);
    const totalConvexityDeg = angleAt(L(2), L(168), L(152), imgW, imgH);

    // Gate 4 — fitted values inside anatomical plausibility ranges.
    if (gonialAngleDeg < 60 || gonialAngleDeg > 170) return null;
    if (mandibularPlaneDeg < 0 || mandibularPlaneDeg > 60) return null;
    if (totalConvexityDeg < 100 || totalConvexityDeg > 175) return null;
    if (convexityGlabellaDeg < 120 || convexityGlabellaDeg > 179) return null;

    return {
      gonialAngleDeg,
      mandibularPlaneDeg,
      convexityGlabellaDeg,
      totalConvexityDeg,
    };
  } catch {
    return null;
  }
}

function classifyFaceShape(
  landmarks: Landmark[],
  imgW: number,
  imgH: number,
  faceW: number,
  faceH: number,
  jawW: number
): FaceMeasurements["faceShape"] {
  // Roll check: if the eye line is strongly tilted, the face isn't frontal.
  const eyeW = xDist(get(landmarks, 33), get(landmarks, 263), imgW) || 1;
  const roll = (Math.abs(get(landmarks, 33).y - get(landmarks, 263).y) * imgH) / eyeW;
  if (roll > 0.15) return "unknown";

  const lenW = faceH / faceW;
  const jawCheek = jawW / (faceW || 1);
  const foreheadW = xDist(get(landmarks, 70), get(landmarks, 300), imgW);
  const foreJaw = foreheadW / (jawW || 1);

  if (lenW >= 1.5 && jawCheek <= 0.92) return "oblong";
  if (lenW <= 1.2 && jawCheek >= 0.92) return "round";
  if (jawCheek >= 0.94 && lenW < 1.5) return "square";
  if (foreJaw >= 1.08 && jawCheek <= 0.92) return "heart";
  if (foreheadW <= faceW * 0.88 && jawCheek <= 0.88) return "diamond";
  return "oval";
}

// ---------------------------------------------------------------------------
// analyzeSkin — cheap on-device skin heuristics from a canvas
// ---------------------------------------------------------------------------

const ZERO_SKIN: SkinMetrics = { redness: 0, texture: 0, blemishCount: 0, underEye: 0 };

interface Region {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function sampleRegion(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  r: Region,
  cb: (lum: number, red: number, green: number, blue: number) => void
): void {
  const sx = Math.max(0, Math.floor(r.x0 * w));
  const sy = Math.max(0, Math.floor(r.y0 * h));
  const ex = Math.min(w, Math.ceil(r.x1 * w));
  const ey = Math.min(h, Math.ceil(r.y1 * h));
  for (let y = sy; y < ey; y += 2) {
    for (let x = sx; x < ex; x += 2) {
      const i = (y * w + x) * 4;
      const red = data[i];
      const green = data[i + 1];
      const blue = data[i + 2];
      cb(0.299 * red + 0.587 * green + 0.114 * blue, red, green, blue);
    }
  }
}

export function analyzeSkin(canvas: HTMLCanvasElement): SkinMetrics {
  try {
    if (!canvas || canvas.width < 8 || canvas.height < 8) return { ...ZERO_SKIN };

    const TARGET = 200;
    const scale = Math.min(1, TARGET / Math.max(canvas.width, canvas.height));
    const w = Math.max(8, Math.round(canvas.width * scale));
    const h = Math.max(8, Math.round(canvas.height * scale));
    const tmp = document.createElement("canvas");
    tmp.width = w;
    tmp.height = h;
    const ctx = tmp.getContext("2d", { willReadFrequently: true });
    if (!ctx) return { ...ZERO_SKIN };
    ctx.drawImage(canvas, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;

    // Relative regions (front-facing face assumed).
    const leftCheek: Region = { x0: 0.28, y0: 0.48, x1: 0.42, y1: 0.62 };
    const rightCheek: Region = { x0: 0.58, y0: 0.48, x1: 0.72, y1: 0.62 };
    const forehead: Region = { x0: 0.35, y0: 0.18, x1: 0.65, y1: 0.3 };
    const underEyeL: Region = { x0: 0.32, y0: 0.4, x1: 0.45, y1: 0.46 };
    const underEyeR: Region = { x0: 0.55, y0: 0.4, x1: 0.68, y1: 0.46 };

    // Cheek stats: redness (r-g), texture (luminance variance).
    let redSum = 0;
    let lumSum = 0;
    let lumSq = 0;
    let n = 0;
    const cheek = (region: Region) =>
      sampleRegion(data, w, h, region, (lum, red, green) => {
        redSum += red - green;
        lumSum += lum;
        lumSq += lum * lum;
        n += 1;
      });
    cheek(leftCheek);
    cheek(rightCheek);

    if (n === 0) return { ...ZERO_SKIN };
    const meanLum = lumSum / n;
    const variance = Math.max(0, lumSq / n - meanLum * meanLum);
    const redness = clamp(((redSum / n) / 60) * 100, 0, 100);
    const texture = clamp((Math.sqrt(variance) / 40) * 100, 0, 100);

    // Blemishes: dark cells across cheeks + forehead vs local mean.
    let blemishCells = 0;
    let cellCount = 0;
    const cell = 10;
    for (const region of [leftCheek, rightCheek, forehead]) {
      const sx = Math.max(0, Math.floor(region.x0 * w));
      const sy = Math.max(0, Math.floor(region.y0 * h));
      const ex = Math.min(w, Math.ceil(region.x1 * w));
      const ey = Math.min(h, Math.ceil(region.y1 * h));
      for (let cy = sy; cy + cell <= ey; cy += cell) {
        for (let cx = sx; cx + cell <= ex; cx += cell) {
          let cSum = 0;
          let cN = 0;
          for (let y = cy; y < cy + cell; y += 2) {
            for (let x = cx; x < cx + cell; x += 2) {
              const i = (y * w + x) * 4;
              cSum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
              cN += 1;
            }
          }
          cellCount += 1;
          if (cN > 0 && cSum / cN < meanLum * 0.68) blemishCells += 1;
        }
      }
    }
    const blemishCount = cellCount === 0 ? 0 : Math.min(50, Math.round((blemishCells / cellCount) * 60));

    // Under-eye darkness: cheek luminance vs under-eye luminance.
    let eyeSum = 0;
    let eyeN = 0;
    const eye = (region: Region) =>
      sampleRegion(data, w, h, region, (lum) => {
        eyeSum += lum;
        eyeN += 1;
      });
    eye(underEyeL);
    eye(underEyeR);
    const underEye =
      eyeN === 0 || meanLum <= 0
        ? 0
        : clamp(((meanLum - eyeSum / eyeN) / meanLum) * 100, 0, 100);

    return { redness, texture, blemishCount, underEye };
  } catch {
    return { ...ZERO_SKIN };
  }
}

// ---------------------------------------------------------------------------
// evaluatePhotoQuality — the hard GATE in front of measurement.
// Deterministic, on-device. An image that fails never reaches
// computeMeasurements / analyzeSkin. One specific reason per rejection.
// Thresholds are deliberately lenient: catch genuinely unusable photos
// (dark, blown out, blurry, tiny, off-centre, no face), don't nag good
// ones taken in normal indoor light.
// ---------------------------------------------------------------------------

export type PhotoQualityCode =
  | "no-face"
  | "too-small"
  | "off-centre"
  | "too-dark"
  | "blown-out"
  | "blurry";

export interface PhotoQualityGateResult {
  ok: boolean;
  code: PhotoQualityCode | null;
  reason: string | null;
  metrics: {
    faceWidthRatio: number;
    faceHeightRatio: number;
    centerOffsetX: number;
    centerOffsetY: number;
    meanLuminance: number;
    highlightRatio: number;
    sharpness: number;
  };
}

export const PHOTO_GATE_THRESHOLDS = {
  /** Face bounding box must span at least this share of frame width/height. */
  minFaceWidthRatio: 0.24,
  minFaceHeightRatio: 0.3,
  /** Face centre may sit at most this far (normalised) from frame centre. */
  maxCenterOffset: 0.16,
  /** Mean luminance (0–255) of the face region below this = too dark. */
  minMeanLuminance: 45,
  /** Blown out: mean above this AND more than `maxHighlightRatio` of face
   *  pixels clipped at near-white. The mean is over the whole face region
   *  (hair and beard included), so 140 already implies the skin itself is
   *  broadly near clipping. */
  blownMeanLuminance: 140,
  maxHighlightRatio: 0.3,
  /** Laplacian variance of the face region below this = blurry. */
  minSharpness: 60,
};

const ZERO_GATE_METRICS = {
  faceWidthRatio: 0,
  faceHeightRatio: 0,
  centerOffsetX: 0,
  centerOffsetY: 0,
  meanLuminance: 0,
  highlightRatio: 0,
  sharpness: 0,
};

export function evaluatePhotoQuality(
  landmarks: Landmark[] | null,
  canvas: HTMLCanvasElement
): PhotoQualityGateResult {
  const T = PHOTO_GATE_THRESHOLDS;
  const fail = (
    code: PhotoQualityCode,
    reason: string,
    metrics: PhotoQualityGateResult["metrics"]
  ): PhotoQualityGateResult => ({ ok: false, code, reason, metrics });

  if (!landmarks || landmarks.length === 0) {
    return fail(
      "no-face",
      "No face found — centre your face in the guide and try again.",
      { ...ZERO_GATE_METRICS }
    );
  }

  // ---- face size + position from the landmark bounding box ----
  let minX = 1;
  let maxX = 0;
  let minY = 1;
  let maxY = 0;
  for (const p of landmarks) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const faceWidthRatio = maxX - minX;
  const faceHeightRatio = maxY - minY;
  const centerOffsetX = Math.abs((minX + maxX) / 2 - 0.5);
  const centerOffsetY = Math.abs((minY + maxY) / 2 - 0.5);

  const metrics = {
    faceWidthRatio,
    faceHeightRatio,
    centerOffsetX,
    centerOffsetY,
    meanLuminance: 0,
    highlightRatio: 0,
    sharpness: 0,
  };

  if (
    faceWidthRatio < T.minFaceWidthRatio ||
    faceHeightRatio < T.minFaceHeightRatio
  ) {
    return fail(
      "too-small",
      "Too far away — move closer so your face fills the guide.",
      metrics
    );
  }
  if (centerOffsetX > T.maxCenterOffset || centerOffsetY > T.maxCenterOffset) {
    return fail(
      "off-centre",
      "Face off-centre — line your face up in the guide.",
      metrics
    );
  }

  // ---- lighting + sharpness from the face region's pixels ----
  try {
    const pad = 0.04;
    const rx0 = clamp(minX - pad, 0, 1);
    const ry0 = clamp(minY - pad, 0, 1);
    const rx1 = clamp(maxX + pad, 0, 1);
    const ry1 = clamp(maxY + pad, 0, 1);
    const srcW = Math.max(2, Math.round((rx1 - rx0) * canvas.width));
    const srcH = Math.max(2, Math.round((ry1 - ry0) * canvas.height));
    const scale = Math.min(1, 256 / Math.max(srcW, srcH));
    const w = Math.max(8, Math.round(srcW * scale));
    const h = Math.max(8, Math.round(srcH * scale));
    const tmp = document.createElement("canvas");
    tmp.width = w;
    tmp.height = h;
    const ctx = tmp.getContext("2d", { willReadFrequently: true });
    if (!ctx) return { ok: true, code: null, reason: null, metrics };
    ctx.drawImage(
      canvas,
      rx0 * canvas.width,
      ry0 * canvas.height,
      srcW,
      srcH,
      0,
      0,
      w,
      h
    );
    const data = ctx.getImageData(0, 0, w, h).data;
    const gray = new Float32Array(w * h);
    let sum = 0;
    let clipped = 0;
    for (let i = 0; i < w * h; i++) {
      const lum =
        0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
      gray[i] = lum;
      sum += lum;
      if (lum >= 250) clipped += 1;
    }
    metrics.meanLuminance = sum / (w * h);
    metrics.highlightRatio = clipped / (w * h);

    // Laplacian variance (4-neighbour) over interior pixels.
    let lapSum = 0;
    let lapSq = 0;
    let lapN = 0;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        const lap =
          4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - w] - gray[i + w];
        lapSum += lap;
        lapSq += lap * lap;
        lapN += 1;
      }
    }
    if (lapN > 0) {
      const mean = lapSum / lapN;
      metrics.sharpness = Math.max(0, lapSq / lapN - mean * mean);
    }
  } catch {
    // Pixel checks are best-effort; geometry already passed. Never block
    // a geometrically good photo on a canvas read failure.
    return { ok: true, code: null, reason: null, metrics };
  }

  if (metrics.meanLuminance < T.minMeanLuminance) {
    return fail(
      "too-dark",
      "Too dark — face a light source and try again.",
      metrics
    );
  }
  if (
    metrics.meanLuminance > T.blownMeanLuminance &&
    metrics.highlightRatio > T.maxHighlightRatio
  ) {
    return fail(
      "blown-out",
      "Too bright — the light is washing your face out. Soften it and try again.",
      metrics
    );
  }
  if (metrics.sharpness < T.minSharpness) {
    return fail(
      "blurry",
      "That was blurry — hold steady and try again.",
      metrics
    );
  }

  return { ok: true, code: null, reason: null, metrics };
}

// ---------------------------------------------------------------------------
// checkPhotoQuality
// ---------------------------------------------------------------------------

export function checkPhotoQuality(
  landmarks: Landmark[] | null,
  img: { width: number; height: number },
  canvas?: HTMLCanvasElement
): { ok: boolean; issues: string[] } {
  const issues: string[] = [];

  if (!landmarks || landmarks.length === 0) {
    issues.push("No face detected — try a clearer, front-facing photo.");
    return { ok: false, issues };
  }

  // Face too small in frame.
  let minX = 1;
  let maxX = 0;
  for (const p of landmarks) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
  }
  if (maxX - minX < 0.22) {
    issues.push("Face is too small in the frame — move closer to the camera.");
  }

  // Not frontal: estimate roll from the eye-corner y difference.
  const eL = landmarks[33];
  const eR = landmarks[263];
  if (eL && eR) {
    const eyeW = Math.abs(eL.x - eR.x) * img.width || 1;
    const roll = (Math.abs(eL.y - eR.y) * img.height) / eyeW;
    if (roll > 0.12) {
      issues.push("Face isn't frontal — look straight into the camera with your head level.");
    }
  }

  // Too dark: estimate mean brightness from a downscaled canvas.
  if (canvas) {
    try {
      const dw = 64;
      const dh = Math.max(1, Math.round((64 * canvas.height) / Math.max(1, canvas.width)));
      const tmp = document.createElement("canvas");
      tmp.width = dw;
      tmp.height = dh;
      const ctx = tmp.getContext("2d", { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(canvas, 0, 0, dw, dh);
        const d = ctx.getImageData(0, 0, dw, dh).data;
        let sum = 0;
        const px = d.length / 4;
        for (let i = 0; i < d.length; i += 4) {
          sum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        }
        if (px > 0 && sum / px < 60) {
          issues.push("Photo is too dark — retake in brighter, even lighting.");
        }
      }
    } catch {
      // Brightness check is advisory; never block on it.
    }
  }

  return { ok: issues.length === 0, issues };
}
