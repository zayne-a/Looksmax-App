"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useApp } from "@/lib/store";
import { saveScan } from "@/lib/account";
import {
  analyzeSkin,
  checkPhotoQuality,
  computeMeasurements,
  evaluatePhotoQuality,
  type Landmark,
  type PhotoQualityGateResult,
} from "@/lib/face";
import type { FaceMeasurements } from "@/lib/types";
import { Button, Card, Eyebrow } from "@/components/ui";
import { Reveal, ScanFrame } from "@/components/motion";

const WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

type Phase = "idle" | "working" | "failed";

/** Minimal structural view of the MediaPipe FaceLandmarker we use. */
interface FaceLandmarkerLike {
  detect: (input: HTMLCanvasElement) => {
    faceLandmarks?: Landmark[][];
  };
  close: () => void;
}

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

/** Draw a photo file onto a canvas capped at 1024px — the exact input the
 *  gate and the measurement pipeline both work from. */
async function prepareCanvas(
  file: File
): Promise<{ canvas: HTMLCanvasElement; width: number; height: number }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
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
    return { canvas, width: cw, height: ch };
  } finally {
    URL.revokeObjectURL(url);
  }
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

/* ------------------------------------------------------------------ */
/* CameraCapture: full-bleed live viewfinder — the video IS the screen. */
/* One oval guide, one instruction line, one shutter. Nothing else.     */
/* ------------------------------------------------------------------ */

type CamStatus =
  | "starting"
  | "live"
  | "captured"
  | "checking"
  | "rejected";

function CameraCapture({
  onClose,
  onUnavailable,
  onUsePhoto,
}: {
  onClose: () => void;
  onUnavailable: (notice: string) => void;
  onUsePhoto: (file: File) => Promise<{ ok: boolean; reason?: string }>;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const capturedRef = useRef<{ file: File; url: string } | null>(null);
  const aliveRef = useRef(true);

  const [status, setStatus] = useState<CamStatus>("starting");
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  // Bumping the session restarts the stream (initial open + retakes).
  const [session, setSession] = useState(0);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  // Start (or restart) the camera for this session.
  useEffect(() => {
    aliveRef.current = true;
    let cancelled = false;

    const start = async () => {
      try {
        if (typeof navigator.mediaDevices?.getUserMedia !== "function") {
          throw new DOMException("unsupported", "NotSupportedError");
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: "user",
            width: { ideal: 1280 },
            height: { ideal: 1600 },
          },
        });
        if (cancelled || !aliveRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => undefined);
        }
        if (!cancelled && aliveRef.current) setStatus("live");
      } catch (e) {
        if (cancelled || !aliveRef.current) return;
        const denied =
          e instanceof DOMException && e.name === "NotAllowedError";
        onUnavailable(
          denied
            ? "Camera access was blocked — upload a photo instead, or allow the camera and try again."
            : "Live camera isn't available here — upload a photo instead."
        );
      }
    };

    void start();
    return () => {
      cancelled = true;
      stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // Full cleanup on unmount: stream off, captured preview released.
  useEffect(() => {
    return () => {
      aliveRef.current = false;
      stopStream();
      if (capturedRef.current) URL.revokeObjectURL(capturedRef.current.url);
    };
  }, [stopStream]);

  const capture = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || status !== "live") return;

    // Capture exactly what the viewfinder shows (object-cover crop).
    const rect = video.getBoundingClientRect();
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const targetAspect = rect.width / Math.max(1, rect.height);
    const srcAspect = vw / vh;
    let sx = 0;
    let sy = 0;
    let sw = vw;
    let sh = vh;
    if (srcAspect > targetAspect) {
      sw = vh * targetAspect;
      sx = (vw - sw) / 2;
    } else {
      sh = vw / targetAspect;
      sy = (vh - sh) / 2;
    }
    const scale = Math.min(1, 1280 / Math.max(sw, sh));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(sw * scale));
    canvas.height = Math.max(1, Math.round(sh * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Mirror the saved frame to match the (mirrored) preview.
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob || !aliveRef.current) return;
        const file = new File([blob], "front-photo.jpg", {
          type: "image/jpeg",
        });
        const url = URL.createObjectURL(blob);
        capturedRef.current = { file, url };
        setCapturedUrl(url);
        setReason(null);
        setStatus("captured");
        stopStream();
      },
      "image/jpeg",
      0.92
    );
  };

  const retake = () => {
    if (capturedRef.current) {
      URL.revokeObjectURL(capturedRef.current.url);
      capturedRef.current = null;
    }
    setCapturedUrl(null);
    setReason(null);
    setStatus("starting");
    setSession((s) => s + 1);
  };

  const usePhoto = async () => {
    const shot = capturedRef.current;
    if (!shot) return;
    setStatus("checking");
    const res = await onUsePhoto(shot.file);
    if (!aliveRef.current) return;
    if (!res.ok) {
      setReason(res.reason ?? "That photo won't work — try again.");
      setStatus("rejected");
    }
    // On success the parent closes the viewfinder (unmount cleanup runs).
  };

  const line =
    status === "rejected" && reason
      ? reason
      : status === "checking"
        ? "Checking your photo…"
        : status === "starting"
          ? "Opening camera…"
          : "Centre your face in the oval · Face the light";

  return (
    <div
      className="fixed inset-0 z-[90] bg-black"
      role="dialog"
      aria-modal="true"
      aria-label="Take your front photo"
    >
      {capturedUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={capturedUrl}
          alt="Your captured photo"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          aria-label="Live camera preview"
          className="absolute inset-0 h-full w-full -scale-x-100 object-cover"
        />
      )}

      {/* The one overlay graphic: a centred face guide. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[44%] aspect-[3/4] h-[58%] max-w-[80vw] -translate-x-1/2 -translate-y-1/2"
      >
        <div className="h-full w-full rounded-[50%] border-2 border-gold/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.38)]" />
      </div>

      {/* Close — discreet, top corner. */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close camera"
        className="absolute right-4 flex h-10 w-10 items-center justify-center rounded-full bg-black/45 text-2xl leading-none text-bone backdrop-blur transition hover:bg-black/70"
        style={{ top: "max(1rem, env(safe-area-inset-top))" }}
      >
        ×
      </button>

      {/* The one instruction / status line. */}
      <p
        role={status === "rejected" ? "alert" : undefined}
        className={`pointer-events-none absolute inset-x-0 pl-6 pr-16 text-center text-sm font-semibold ${
          status === "rejected" ? "text-gold-soft" : "text-bone"
        }`}
        style={{ top: "max(1.1rem, env(safe-area-inset-top))" }}
      >
        {line}
      </p>

      {/* Controls — one shutter, or retake / use photo. Nothing else. */}
      <div
        className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-3 px-6"
        style={{ paddingBottom: "max(1.75rem, env(safe-area-inset-bottom))" }}
      >
        {status === "live" && (
          <button
            type="button"
            onClick={capture}
            aria-label="Take photo"
            className="flex h-[76px] w-[76px] items-center justify-center rounded-full border-4 border-bone/90 bg-black/20 backdrop-blur transition active:scale-95"
          >
            <span className="h-14 w-14 rounded-full bg-bone" />
          </button>
        )}
        {status === "captured" && (
          <>
            <Button variant="ghost" onClick={retake} className="bg-black/45 backdrop-blur">
              Retake
            </Button>
            <Button onClick={() => void usePhoto()}>Use photo</Button>
          </>
        )}
        {status === "checking" && (
          <Button disabled className="bg-black/45">
            Checking…
          </Button>
        )}
        {status === "rejected" && (
          <Button onClick={retake}>Retake</Button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

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

  // Camera-first intake state.
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraUnavailable, setCameraUnavailable] = useState(false);
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null);
  const [intakeBusy, setIntakeBusy] = useState(false);
  const [intakeError, setIntakeError] = useState<string | null>(null);

  const frontFileRef = useRef<File | null>(null);
  const frontInputRef = useRef<HTMLInputElement>(null);
  const sideInputRef = useRef<HTMLInputElement>(null);
  const autoOpenedRef = useRef(false);

  // The landmarker is created once and shared by the quality gate and the
  // measurement run (one model load per visit, closed on unmount).
  const landmarkerRef = useRef<FaceLandmarkerLike | null>(null);
  const landmarkerLoadingRef = useRef<Promise<FaceLandmarkerLike> | null>(null);
  const unmountedRef = useRef(false);

  const busy = phase === "working";

  const getLandmarker = useCallback(async (): Promise<FaceLandmarkerLike> => {
    if (landmarkerRef.current) return landmarkerRef.current;
    if (landmarkerLoadingRef.current) return landmarkerLoadingRef.current;
    const loading = (async () => {
      const vision = await import("@mediapipe/tasks-vision");
      const fileset = await vision.FilesetResolver.forVisionTasks(WASM_URL);
      const options = (delegate: "GPU" | "CPU") => ({
        baseOptions: { modelAssetPath: MODEL_URL, delegate },
        runningMode: "IMAGE" as const,
        numFaces: 1,
      });
      // Try GPU, fall back to CPU if the device can't run it.
      let landmarker: FaceLandmarkerLike;
      try {
        landmarker = (await vision.FaceLandmarker.createFromOptions(
          fileset,
          options("GPU")
        )) as FaceLandmarkerLike;
      } catch {
        landmarker = (await vision.FaceLandmarker.createFromOptions(
          fileset,
          options("CPU")
        )) as FaceLandmarkerLike;
      }
      if (unmountedRef.current) {
        try {
          landmarker.close();
        } catch {
          // Ignore close errors.
        }
        throw new Error("Scan page closed.");
      }
      landmarkerRef.current = landmarker;
      return landmarker;
    })();
    landmarkerLoadingRef.current = loading;
    try {
      return await loading;
    } finally {
      if (landmarkerLoadingRef.current === loading) {
        landmarkerLoadingRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    return () => {
      unmountedRef.current = true;
      try {
        landmarkerRef.current?.close();
      } catch {
        // Ignore close errors.
      }
      landmarkerRef.current = null;
    };
  }, []);

  /** The quality gate: detect + evaluate. Nothing is measured here —
      an image that fails never reaches computeMeasurements. */
  const runGate = useCallback(
    async (file: File): Promise<PhotoQualityGateResult> => {
      const { canvas } = await prepareCanvas(file);
      const landmarker = await getLandmarker();
      const result = landmarker.detect(canvas);
      const faces = result.faceLandmarks ?? [];
      return evaluatePhotoQuality(faces[0] ?? null, canvas);
    },
    [getLandmarker]
  );

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

  /* Starting a scan opens the live camera (the PSL pattern). If this
     browser can't do a live camera, we land on the upload fallback. */
  useEffect(() => {
    if (autoOpenedRef.current) return;
    autoOpenedRef.current = true;
    if (frontFileRef.current) return;
    if (
      typeof navigator !== "undefined" &&
      typeof navigator.mediaDevices?.getUserMedia === "function"
    ) {
      setCameraOpen(true);
    } else {
      setCameraUnavailable(true);
      setFallbackNotice(
        "Live camera isn't available in this browser — upload a photo instead."
      );
    }
  }, []);

  const openCamera = () => {
    setCameraUnavailable(false);
    setFallbackNotice(null);
    setIntakeError(null);
    setCameraOpen(true);
  };

  const handleCameraUnavailable = useCallback((notice: string) => {
    setCameraOpen(false);
    setCameraUnavailable(true);
    setFallbackNotice(notice);
  }, []);

  /** A photo (camera or upload) that passed the gate becomes the scan. */
  const setFrontFromFile = (file: File) => {
    setFrontUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    frontFileRef.current = file;
    setNoFace(false);
    setError(null);
    setIntakeError(null);
    // Keep a copy for the glow-up preview on /plan.
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setFrontPhoto(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleCameraPhoto = useCallback(
    async (file: File): Promise<{ ok: boolean; reason?: string }> => {
      try {
        const gate = await runGate(file);
        if (!gate.ok) {
          return { ok: false, reason: gate.reason ?? undefined };
        }
      } catch {
        // The gate itself couldn't run (model failed to load). Don't trap
        // the user in the viewfinder — the Analyze run re-checks before
        // measuring, and fails safe to the quiz-only path if it must.
        setFrontFromFile(file);
        setCameraOpen(false);
        return { ok: true };
      }
      setFrontFromFile(file);
      setCameraOpen(false);
      return { ok: true };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [runGate]
  );

  const handleFrontUpload = async (file: File | undefined) => {
    if (!file || intakeBusy) return;
    setIntakeBusy(true);
    setIntakeError(null);
    try {
      const gate = await runGate(file);
      if (!gate.ok) {
        setIntakeError(gate.reason);
        return;
      }
      setFrontFromFile(file);
    } catch {
      // Gate couldn't run; accept the photo — Analyze re-checks it
      // before any measurement happens (same fail-safe as the camera).
      setFrontFromFile(file);
    } finally {
      setIntakeBusy(false);
    }
  };

  const pickSideFile = (file: File | undefined) => {
    if (!file) return;
    setSideUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
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
      setIntakeError(null);
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
      const landmarker = await getLandmarker();
      setStatusText("Measuring 478 facial landmarks... on your device");

      const { canvas, width: cw, height: ch } = await prepareCanvas(file);

      const result = landmarker.detect(canvas);
      const faces = result.faceLandmarks ?? [];

      // Quality gate — a bad photo is rejected here and never measured.
      const gate = evaluatePhotoQuality(faces[0] ?? null, canvas);
      if (!gate.ok) {
        setPhase("failed");
        setNoFace(gate.code === "no-face");
        setError(
          gate.code === "no-face"
            ? "We couldn't detect a face in that photo. Try a front-facing shot with even lighting and no sunglasses, or continue with a quiz-only plan."
            : `${gate.reason} Retake it, or continue with a quiz-only plan.`
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
          Take a clear photo with your camera and we'll measure your facial
          structure right here on your device. No account, no uploads, no
          waiting room — just your numbers.
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

      {fallbackNotice && (
        <p className="mt-4 text-sm leading-relaxed text-gold-soft" role="status">
          {fallbackNotice}{" "}
          <button
            type="button"
            onClick={openCamera}
            className="font-bold text-bone underline underline-offset-2"
          >
            Try the camera again
          </button>
        </p>
      )}

      {/* Photo slots */}
      <Reveal delay={0.14}>
        <div className="mt-6 grid grid-cols-2 gap-3">
          {/* Front photo — live camera first, upload only as fallback */}
          <div>
            <ScanFrame
              src={frontUrl}
              alt="Front photo preview"
              scanning={busy}
              landmark={!!frontUrl}
              className="aspect-[3/4]"
            >
              {!frontUrl ? (
                cameraUnavailable ? (
                  <button
                    type="button"
                    onClick={() => frontInputRef.current?.click()}
                    disabled={intakeBusy}
                    className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center transition hover:bg-gold/5"
                  >
                    <span
                      className="flex h-11 w-11 items-center justify-center rounded-full border border-dashed border-gold/50 text-xl leading-none text-gold"
                      aria-hidden="true"
                    >
                      +
                    </span>
                    <span className="text-sm font-bold text-bone">Front photo</span>
                    <span className="text-xs text-muted">
                      {intakeBusy ? "Checking photo…" : "Tap to upload"}
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={openCamera}
                    className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center transition hover:bg-gold/5"
                  >
                    <span
                      className="flex h-11 w-11 items-center justify-center rounded-full border border-gold/50 text-gold"
                      aria-hidden="true"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                        <path
                          d="M4 8h2.2l2-2.5h7.6L17.8 8H20a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinejoin="round"
                        />
                        <circle cx="12" cy="13.5" r="3.4" stroke="currentColor" strokeWidth="1.6" />
                      </svg>
                    </span>
                    <span className="text-sm font-bold text-bone">Front photo</span>
                    <span className="text-xs text-muted">Tap to open camera</span>
                  </button>
                )
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

      {intakeError && (
        <p className="mt-3 text-center text-sm font-semibold text-gold-soft" role="alert">
          {intakeError}
        </p>
      )}

      <input
        ref={frontInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void handleFrontUpload(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        ref={sideInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          pickSideFile(e.target.files?.[0]);
          e.target.value = "";
        }}
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

      {/* Full-screen live camera (the scan's primary intake) */}
      {cameraOpen && (
        <CameraCapture
          onClose={() => setCameraOpen(false)}
          onUnavailable={handleCameraUnavailable}
          onUsePhoto={handleCameraPhoto}
        />
      )}
    </main>
  );
}
