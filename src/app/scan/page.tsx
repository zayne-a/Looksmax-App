"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useApp } from "@/lib/store";
import { saveScan } from "@/lib/account";
import { analyzeSkin, checkPhotoQuality, computeMeasurements } from "@/lib/face";
import type { FaceMeasurements } from "@/lib/types";
import { Button, Card, Eyebrow } from "@/components/ui";
import { Reveal, ScanFrame } from "@/components/motion";

const WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

type Phase = "idle" | "working" | "failed";

const WHAT_WE_MEASURE = [
  ["Facial thirds", "Upper, middle and lower face balance against the ideal 1:1:1."],
  ["Facial fifths", "Five horizontal segments across the cheekbones, checked for evenness."],
  ["Canthal tilt", "The angle of your eye corners — positive tilt reads alert and youthful."],
  ["Symmetry", "Left/right mirroring across your face's vertical midline."],
  ["Golden ratio", "Mouth-to-nose and face length-to-width against 1.618."],
  ["Width ratios", "Jaw vs cheekbone width and your facial width-to-height ratio."],
  ["Face shape", "Oval, round, square, oblong, heart or diamond."],
  ["Skin", "Redness, texture, blemish estimate and under-eye darkness from the photo."],
];

const ANALYZE_BEATS = [
  "Warming up the on-device model",
  "Detecting 478 facial landmarks",
  "Analyzing facial structure",
  "Detecting standout traits",
  "Calculating your baseline",
];

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read that photo file."));
    img.src = src;
  });
}

function quizOnlyMeasurements(note: string): FaceMeasurements {
  return {
    facialThirds: { upper: 1 / 3, mid: 1 / 3, lower: 1 / 3 },
    fifths: [0.2, 0.2, 0.2, 0.2, 0.2],
    canthalTiltDeg: 0,
    jawToCheekbone: 0,
    fwhr: 0,
    symmetryScore: 0,
    goldenRatioScore: 0,
    overallScore: 0,
    faceShape: "unknown",
    skin: { redness: 0, texture: 0, blemishCount: 0, underEye: 0 },
    landmarksDetected: false,
    notes: [note],
  };
}

function BeatRow({
  label,
  state,
}: {
  label: string;
  state: "done" | "active" | "pending";
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
      className="flex items-center gap-3"
    >
      <span className="flex h-6 w-6 shrink-0 items-center justify-center">
        {state === "done" ? (
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
            <circle cx="9" cy="9" r="8" stroke="#e3b94e" strokeWidth="1.5" />
            <path
              d="M5.8 9.3l2.2 2.2 4.2-4.8"
              stroke="#e3b94e"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : state === "active" ? (
          <span
            aria-hidden
            className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gold/25 border-t-gold"
          />
        ) : (
          <span aria-hidden className="h-2 w-2 rounded-full bg-white/15" />
        )}
      </span>
      <p
        className={`text-sm font-medium ${
          state === "pending" ? "text-muted/50" : "text-bone"
        }`}
      >
        {label}
        {state === "active" && <span className="text-gold">…</span>}
      </p>
    </motion.div>
  );
}

export default function ScanPage() {
  const router = useRouter();
  const { quiz, setMeasurements, setFrontPhoto, setSavedScanId } = useApp();

  // Persist the finished scan to the user's account when logged in
  // (no-op logged out). The row id lets the plan page link its plan.
  const persistScan = (m: FaceMeasurements) => {
    void saveScan(m, quiz).then((id) => {
      if (id) setSavedScanId(id);
    });
  };

  const [frontUrl, setFrontUrl] = useState<string | null>(null);
  const [sideUrl, setSideUrl] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [statusText, setStatusText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [noFace, setNoFace] = useState(false);
  const [beatIdx, setBeatIdx] = useState(0);

  const frontFileRef = useRef<File | null>(null);
  const frontInputRef = useRef<HTMLInputElement>(null);
  const sideInputRef = useRef<HTMLInputElement>(null);

  const busy = phase === "working";

  // Advance the staged "analyzing" beats while the real work runs.
  useEffect(() => {
    if (!busy) {
      setBeatIdx(0);
      return;
    }
    setBeatIdx(0);
    const id = setInterval(() => {
      setBeatIdx((i) => Math.min(i + 1, ANALYZE_BEATS.length - 1));
    }, 1150);
    return () => clearInterval(id);
  }, [busy]);

  const pickFile = (
    file: File | undefined,
    setter: (url: string | null) => void,
    prev: string | null,
    isFront: boolean
  ) => {
    if (!file) return;
    if (prev) URL.revokeObjectURL(prev);
    const url = URL.createObjectURL(file);
    setter(url);
    if (isFront) {
      frontFileRef.current = file;
      setNoFace(false);
      setError(null);
      // Keep a copy for the glow-up preview on /plan.
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") setFrontPhoto(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const removePhoto = (
    setter: (url: string | null) => void,
    url: string | null,
    isFront: boolean
  ) => {
    if (url) URL.revokeObjectURL(url);
    setter(null);
    if (isFront) {
      frontFileRef.current = null;
      setNoFace(false);
      setError(null);
      setFrontPhoto(null);
    }
  };

  const continueQuizOnly = (note: string) => {
    const m = quizOnlyMeasurements(note);
    setMeasurements(m);
    persistScan(m);
    router.push("/plan");
  };

  const analyze = async () => {
    const file = frontFileRef.current;
    if (!file) return;
    setPhase("working");
    setError(null);
    setNoFace(false);
    setStatusText("Loading the on-device face model...");

    try {
      const vision = await import("@mediapipe/tasks-vision");
      const fileset = await vision.FilesetResolver.forVisionTasks(WASM_URL);

      // Try GPU, fall back to CPU if the device can't run it.
      let landmarker;
      try {
        landmarker = await vision.FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
          runningMode: "IMAGE",
          numFaces: 1,
        });
      } catch {
        landmarker = await vision.FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" },
          runningMode: "IMAGE",
          numFaces: 1,
        });
      }

      setStatusText("Measuring 478 facial landmarks... on your device");

      const img = await loadImage(URL.createObjectURL(file));
      const MAX = 1024;
      const scale = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
      const cw = Math.max(1, Math.round(img.naturalWidth * scale));
      const ch = Math.max(1, Math.round(img.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = cw;
      canvas.height = ch;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) throw new Error("Canvas is not available in this browser.");
      ctx.drawImage(img, 0, 0, cw, ch);

      const result = landmarker.detect(canvas);
      const faces = result.faceLandmarks ?? [];
      try {
        landmarker.close();
      } catch {
        // Ignore close errors.
      }

      if (faces.length === 0) {
        setPhase("failed");
        setNoFace(true);
        setError(
          "We couldn't detect a face in that photo. Try a front-facing shot with even lighting and no sunglasses, or continue with a quiz-only plan."
        );
        return;
      }

      const landmarks = faces[0];
      const m = computeMeasurements(landmarks, cw, ch);
      const skin = analyzeSkin(canvas);
      const quality = checkPhotoQuality(landmarks, { width: cw, height: ch }, canvas);

      const measurements: FaceMeasurements = {
        ...m,
        skin,
        landmarksDetected: true,
        notes: quality.ok
          ? ["Measured on your device from 478 facial landmarks."]
          : quality.issues,
      };
      setMeasurements(measurements);
      persistScan(measurements);
      router.push("/plan");
    } catch (e) {
      // Graceful fallback: never leave the user stuck.
      setPhase("failed");
      setError(
        e instanceof Error && e.message
          ? `On-device measurement couldn't load (${e.message}) — you can continue with a quiz-only plan.`
          : "On-device measurement couldn't load — you can continue with a quiz-only plan."
      );
    }
  };

  return (
    <main className="mx-auto w-full max-w-md px-5 pb-16 pt-10">
      <Reveal>
        <Eyebrow>Your scan</Eyebrow>
        <h1 className="font-display mt-2 text-4xl font-extrabold tracking-tight text-bone">
          Let's see what we're <span className="gold-text">working with.</span>
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Upload a clear photo and we'll measure your facial structure right
          here on your device. No account, no uploads, no waiting room — just
          your numbers.
        </p>
      </Reveal>

      {/* Photo guidance */}
      <Reveal delay={0.08}>
        <div className="card-premium mt-6 rounded-2xl p-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-gold-soft">
            Set yourself up for an honest score
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Face the camera directly. Good, even lighting. No sunglasses or
            hat. A plain background helps the model lock on.
          </p>
        </div>
      </Reveal>

      {/* Upload slots */}
      <Reveal delay={0.14}>
        <div className="mt-6 grid grid-cols-2 gap-3">
          {/* Front photo */}
          <div>
            <ScanFrame
              src={frontUrl}
              alt="Front photo preview"
              scanning={busy}
              landmark={!!frontUrl}
              className="aspect-[3/4]"
            >
              {!frontUrl ? (
                <button
                  type="button"
                  onClick={() => frontInputRef.current?.click()}
                  className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center transition hover:bg-gold/5"
                >
                  <span
                    className="flex h-11 w-11 items-center justify-center rounded-full border border-dashed border-gold/50 text-xl leading-none text-gold"
                    aria-hidden="true"
                  >
                    +
                  </span>
                  <span className="text-sm font-bold text-bone">Front photo</span>
                  <span className="text-xs text-muted">Tap to upload</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => removePhoto(setFrontUrl, frontUrl, true)}
                  className="absolute right-2.5 top-2.5 rounded-full bg-ink/80 px-3 py-1.5 text-xs font-bold text-bone backdrop-blur transition hover:bg-ink"
                  aria-label="Remove front photo"
                >
                  Remove
                </button>
              )}
            </ScanFrame>
            <p className="mt-2 text-center text-xs font-bold text-bone">
              Front photo{" "}
              <span className="font-normal text-muted">(required)</span>
            </p>
          </div>

          {/* Side photo */}
          <div>
            <ScanFrame
              src={sideUrl}
              alt="Side profile preview"
              landmark={!!sideUrl}
              className="aspect-[3/4]"
            >
              {!sideUrl ? (
                <button
                  type="button"
                  onClick={() => sideInputRef.current?.click()}
                  className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center transition hover:bg-gold/5"
                >
                  <span
                    className="flex h-11 w-11 items-center justify-center rounded-full border border-dashed border-white/25 text-xl leading-none text-muted"
                    aria-hidden="true"
                  >
                    +
                  </span>
                  <span className="text-sm font-bold text-bone">Side profile</span>
                  <span className="text-xs text-muted">Tap to upload</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => removePhoto(setSideUrl, sideUrl, false)}
                  className="absolute right-2.5 top-2.5 rounded-full bg-ink/80 px-3 py-1.5 text-xs font-bold text-bone backdrop-blur transition hover:bg-ink"
                  aria-label="Remove side photo"
                >
                  Remove
                </button>
              )}
            </ScanFrame>
            <p className="mt-2 text-center text-xs font-bold text-bone">
              Side profile{" "}
              <span className="font-normal text-muted">(optional)</span>
            </p>
          </div>
        </div>
      </Reveal>

      <input
        ref={frontInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) =>
          pickFile(e.target.files?.[0], setFrontUrl, frontUrl, true)
        }
      />
      <input
        ref={sideInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) =>
          pickFile(e.target.files?.[0], setSideUrl, sideUrl, false)
        }
      />

      {/* Analyze CTA / staged analyzing sequence */}
      <div className="mt-6">
        <AnimatePresence mode="wait">
          {busy ? (
            <motion.div
              key="analyzing"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.35 }}
            >
              <Card glow>
                <div className="flex items-center gap-3">
                  <span className="pulse-dot h-2.5 w-2.5 shrink-0 rounded-full bg-gold" />
                  <p className="text-[15px] font-bold text-bone">
                    Analyzing your photo…
                  </p>
                </div>
                <div className="mt-5 space-y-3">
                  {ANALYZE_BEATS.map((b, i) => (
                    <BeatRow
                      key={b}
                      label={b}
                      state={
                        i < beatIdx
                          ? "done"
                          : i === beatIdx
                            ? "active"
                            : "pending"
                      }
                    />
                  ))}
                </div>
                <div className="mt-6 space-y-2" aria-hidden>
                  <div className="skeleton h-3 rounded-full" />
                  <div className="skeleton h-3 w-4/5 rounded-full" />
                  <div className="skeleton h-3 w-3/5 rounded-full" />
                </div>
                <p className="mt-5 text-xs leading-relaxed text-muted">
                  {statusText || "Running on your device — nothing uploads."}
                </p>
              </Card>
            </motion.div>
          ) : (
            <motion.div
              key="cta"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.35 }}
            >
              <Button
                onClick={analyze}
                disabled={!frontUrl}
                className="w-full rounded-2xl px-6 py-4 text-base"
              >
                Analyze my face
                <span aria-hidden>→</span>
              </Button>
              {!frontUrl && (
                <p className="mt-3 text-center text-xs text-muted">
                  Add your front photo to unlock the analysis.
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Error / fallback */}
      {phase === "failed" && error && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 rounded-2xl border border-gold-deep/60 bg-ink-2 p-4"
        >
          <p className="text-sm leading-relaxed text-bone">{error}</p>
          <button
            type="button"
            onClick={() =>
              continueQuizOnly(
                noFace
                  ? "No face was detected in the uploaded photo, so this plan is based on the quiz only. You can re-scan later from the scan page."
                  : "On-device measurement couldn't load, so this plan is based on the quiz only. You can re-scan later from the scan page."
              )
            }
            className="btn-ghost mt-3 w-full rounded-xl px-4 py-3 text-sm font-bold"
          >
            Continue with a quiz-only plan
          </button>
        </motion.div>
      )}

      {/* What we measure */}
      <Reveal className="mt-10">
        <h2 className="font-display text-xl font-extrabold text-bone">
          What we read from your photo
        </h2>
        <ul className="mt-4 space-y-2.5">
          {WHAT_WE_MEASURE.map(([title, detail]) => (
            <li
              key={title}
              className="card-premium rounded-2xl p-4 transition-colors hover:border-gold/30"
            >
              <p className="text-sm font-bold text-gold-soft">{title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted">{detail}</p>
            </li>
          ))}
        </ul>
      </Reveal>

      {/* Privacy note */}
      <p className="mt-8 text-center text-xs leading-relaxed text-muted">
        Measurement runs 100% on your device — your photo never leaves this
        browser for analysis.
      </p>
    </main>
  );
}
