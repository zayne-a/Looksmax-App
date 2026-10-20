// Project Ascend — face measurement engine (pure functions, no React).
// All geometry is computed from MediaPipe FaceLandmarker 478 normalized
// landmarks (x,y in 0..1). Deterministic: same landmarks -> same numbers.

import type { FaceMeasurements, SkinMetrics } from "./types";

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

/** Penalty of a measured ratio vs an ideal, 0 (perfect) .. 1 (bad). */
const ratioPenalty = (measured: number, ideal: number): number =>
  clamp(Math.abs(measured - ideal) / ideal, 0, 1);

function get(landmarks: Landmark[], i: number): Landmark {
  const p = landmarks[i];
  if (!p) throw new Error(`Missing landmark ${i}`);
  return p;
}

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

  // ---- facial thirds (vertical segments between 10 -> 168 -> 2 -> 152) ----
  const upper = yDist(get(landmarks, 10), get(landmarks, 168), imgH);
  const mid = yDist(get(landmarks, 168), get(landmarks, 2), imgH);
  const lower = yDist(get(landmarks, 2), get(landmarks, 152), imgH);
  const tSum = upper + mid + lower || 1;
  const facialThirds = {
    upper: upper / tSum,
    mid: mid / tSum,
    lower: lower / tSum,
  };

  // ---- facial fifths (horizontal segments across 234 -> 454) ----
  const faceW = xDist(get(landmarks, 234), get(landmarks, 454), imgW) || 1;
  const segIdx = [234, 33, 133, 362, 263, 454]; // cheek -> outer eye -> inner eye ... (both eyes)
  const fifths: number[] = [];
  for (let i = 0; i < 5; i++) {
    fifths.push(
      xDist(get(landmarks, segIdx[i]), get(landmarks, segIdx[i + 1]), imgW) /
        faceW
    );
  }

  // ---- canthal tilt: angle of inner->outer eye corner line vs horizontal ----
  // y grows downward, so outerHigher => inner.y - outer.y > 0.
  const tiltOf = (inner: number, outer: number): number => {
    const dy = (get(landmarks, inner).y - get(landmarks, outer).y) * imgH;
    const dx = xDist(get(landmarks, inner), get(landmarks, outer), imgW) || 1;
    return (Math.atan2(dy, dx) * 180) / Math.PI;
  };
  const canthalTiltDeg = (tiltOf(133, 33) + tiltOf(362, 263)) / 2;

  // ---- width ratios ----
  const jawW = xDist(get(landmarks, 132), get(landmarks, 361), imgW);
  const jawToCheekbone = jawW / faceW;
  const faceH = yDist(get(landmarks, 10), get(landmarks, 152), imgH) || 1;
  const fwhr = faceW / faceH;

  // ---- symmetry: mirror pairs across the vertical midline (x of 168) ----
  const pairs: [number, number][] = [
    [33, 263], // outer eye corners
    [133, 362], // inner eye corners
    [61, 291], // mouth corners
    [132, 361], // jaw angles
    [234, 454], // cheeks
    [70, 300], // temples
    [105, 334], // brow
    [52, 282], // mid brow
  ];
  const x0 = get(landmarks, 168).x;
  let symErr = 0;
  let symN = 0;
  for (const [li, ri] of pairs) {
    const l = get(landmarks, li);
    const r = get(landmarks, ri);
    const rMirroredX = 2 * x0 - r.x;
    symErr += (Math.abs(l.x - rMirroredX) * imgW) / faceW;
    symErr += (Math.abs(l.y - r.y) * imgH) / faceH;
    symN += 2;
  }
  const avgSymErr = symErr / (symN || 1);
  const symmetryScore = clamp(100 * (1 - 4 * avgSymErr), 0, 100);

  // ---- golden ratio composite vs ideals ----
  const thirdIdeal = 1 / 3;
  const thirdsPen = clamp(
    (Math.abs(facialThirds.upper - thirdIdeal) +
      Math.abs(facialThirds.mid - thirdIdeal) +
      Math.abs(facialThirds.lower - thirdIdeal)) /
      3 /
      thirdIdeal,
    0,
    1
  );
  const fifthsPen = clamp(
    fifths.reduce((s, f) => s + Math.abs(f - 0.2), 0) / 5 / 0.2,
    0,
    1
  );
  const mouthW = dist(get(landmarks, 61), get(landmarks, 291), imgW, imgH);
  const noseW = dist(get(landmarks, 129), get(landmarks, 409), imgW, imgH) || 1;
  const mouthNosePen = ratioPenalty(mouthW / noseW, 1.618);
  const lenWidthPen = ratioPenalty(faceH / faceW, 1.618);
  const goldenRatioScore = clamp(
    100 * (1 - (thirdsPen + fifthsPen + mouthNosePen + lenWidthPen) / 4),
    0,
    100
  );

  // ---- deterministic sub-scores, each 0..100 vs its ideal ----
  const thirdsBalance = clamp(100 * (1 - thirdsPen), 0, 100);
  const canthalTiltScore = clamp(100 * (1 - Math.abs(canthalTiltDeg - 5) / 10), 0, 100);
  const fwhrScore = clamp(100 * (1 - Math.abs(fwhr - 0.68) / 0.18), 0, 100);

  const overallScore =
    Math.round(
      (0.25 * symmetryScore +
        0.25 * goldenRatioScore +
        0.2 * thirdsBalance +
        0.15 * canthalTiltScore +
        0.15 * fwhrScore) *
        10
    ) / 10;

  // ---- face shape classification ----
  const faceShape = classifyFaceShape(landmarks, imgW, imgH, faceW, faceH, jawW);

  return {
    facialThirds,
    fifths,
    canthalTiltDeg,
    jawToCheekbone,
    fwhr,
    symmetryScore,
    goldenRatioScore,
    overallScore,
    faceShape,
  };
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
