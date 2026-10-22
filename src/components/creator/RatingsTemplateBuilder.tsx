"use client";

import { useEffect, useRef, useState } from "react";
import {
  downloadCanvas,
  drawBackdrop,
  drawBrandHeader,
  drawPhotoCircle,
  drawScoreCard,
  loadImage,
  type PhotoTransform,
} from "./canvas-kit";
import { exportMp4Video } from "./video-export";
import {
  barColor,
  barFraction,
  regionLabel,
  scoreTierLabel,
  type Gender,
} from "@/lib/creator-tiers";
import { useCanvasPhotoControls, usePhoto } from "./use-photo";
import {
  BuilderShell,
  DownloadButton,
  GenderToggle,
  HowToItem,
  PhotoAdjustPanel,
  ScoreSliderRow,
  UploadButton,
} from "./BuilderShell";

const W = 1080;
const H = 1920;

interface RatingsState {
  logo: HTMLImageElement | null;
  img: HTMLImageElement | null;
  t: PhotoTransform;
  gender: Gender;
  psl: number;
  potential: number;
  eyes: number;
  midface: number;
  lowerThird: number;
  upperThird: number;
}

/** Draws the full 1080x1920 template. `anim` drives the video
 *  intro count-up / bar sweep; `hoverCircle` is a preview-only
 *  affordance — exports never pass it. */
function drawRatings(
  ctx: CanvasRenderingContext2D,
  s: RatingsState,
  anim = 1,
  hoverCircle = false
) {
  drawBackdrop(ctx, W, H, 540, 960);
  drawBrandHeader(ctx, s.logo, 540, 118, 168, 110);

  const cards: Array<{
    label: string;
    score: number;
    tier: string;
  }> = [
    { label: "PSL", score: s.psl, tier: scoreTierLabel(s.psl, s.gender) },
    {
      label: "POTENTIAL",
      score: s.potential,
      tier: scoreTierLabel(s.potential, s.gender),
    },
    { label: "EYES", score: s.eyes, tier: regionLabel(s.eyes) },
    { label: "MIDFACE", score: s.midface, tier: regionLabel(s.midface) },
    {
      label: "LOWER THIRD",
      score: s.lowerThird,
      tier: regionLabel(s.lowerThird),
    },
    {
      label: "UPPER THIRD",
      score: s.upperThird,
      tier: regionLabel(s.upperThird),
    },
  ];
  // Grid fills the frame like the reference: 74px outer margins,
  // three rows running nearly to the bottom edge — no watermark.
  const xs = [74, 556];
  const ys = [580, 1033, 1486];
  cards.forEach((c, i) => {
    drawScoreCard(ctx, {
      x: xs[i % 2],
      y: ys[Math.floor(i / 2)],
      w: 450,
      h: 410,
      label: c.label,
      score: c.score,
      tier: c.tier,
      color: barColor(c.score),
      fraction: barFraction(c.score),
      anim,
    });
  });

  // Photo last: the circle overlaps the first card row. His disc
  // measures centre (540, 408), r 240 on his own export.
  drawPhotoCircle(ctx, s.img, s.t, 540, 408, 240, hoverCircle);
}

export default function RatingsTemplateBuilder() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [circleHover, setCircleHover] = useState(false);
  const [logo, setLogo] = useState<HTMLImageElement | null>(null);
  const [gender, setGender] = useState<Gender>("male");
  const [psl, setPsl] = useState(5);
  const [potential, setPotential] = useState(7);
  const [eyes, setEyes] = useState(4);
  const [midface, setMidface] = useState(6);
  const [lowerThird, setLowerThird] = useState(7);
  const [upperThird, setUpperThird] = useState(5);
  const [busy, setBusy] = useState(false);
  const [busyVid, setBusyVid] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [videoDone, setVideoDone] = useState(false);
  const { img, t, setT, onFile } = usePhoto();

  useCanvasPhotoControls(canvasRef, t, setT, !!img, {
    circle: { cx: 540, cy: 408, r: 240 },
    onCircleClick: () => fileInputRef.current?.click(),
    onCircleHoverChange: setCircleHover,
  });

  useEffect(() => {
    loadImage("/icon.png").then(setLogo).catch(() => {});
  }, []);

  const state: RatingsState = {
    logo,
    img,
    t,
    gender,
    psl,
    potential,
    eyes,
    midface,
    lowerThird,
    upperThird,
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    drawRatings(ctx, state, 1, circleHover);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logo, img, t, gender, psl, potential, eyes, midface, lowerThird, upperThird, circleHover]);

  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setBusy(true);
    requestAnimationFrame(() => {
      downloadCanvas(canvas, "mewmax-ratings-template.png");
      setBusy(false);
    });
  };

  const downloadVideo = async () => {
    setVideoError(null);
    setVideoDone(false);
    setBusyVid(true);
    try {
      await exportMp4Video({
        width: W,
        height: H,
        filename: "mewmax-ratings-template.mp4",
        drawFrame: (ctx, p) => drawRatings(ctx, state, p),
      });
      setVideoDone(true);
    } catch (e) {
      setVideoError(
        e instanceof Error ? e.message : "Video export failed. Please try again."
      );
    } finally {
      setBusyVid(false);
    }
  };

  return (
    <BuilderShell
      title="Original Ratings Template"
      customize={
        <>
          <GenderToggle gender={gender} onChange={setGender} />
          <UploadButton onFile={onFile} hasPhoto={!!img} inputRef={fileInputRef} />
          {img && <PhotoAdjustPanel t={t} setT={setT} />}
          <ScoreSliderRow label="PSL Rating" value={psl} onChange={setPsl} min={1} max={8} step={0.1} />
          <ScoreSliderRow label="Potential Rating" value={potential} onChange={setPotential} min={1} max={8} step={0.1} />
          <ScoreSliderRow label="Eyes" value={eyes} onChange={setEyes} min={1} max={8} step={0.1} />
          <ScoreSliderRow label="Midface" value={midface} onChange={setMidface} min={1} max={8} step={0.1} />
          <ScoreSliderRow label="Lower Third" value={lowerThird} onChange={setLowerThird} min={1} max={8} step={0.1} />
          <ScoreSliderRow label="Upper Third" value={upperThird} onChange={setUpperThird} min={1} max={8} step={0.1} />
          <div>
            <DownloadButton
              onClick={download}
              busy={busy}
              busyLabel="Preparing Image..."
              label="Download Image (.png)"
            />
            <div className="mt-3">
              <DownloadButton
                onClick={downloadVideo}
                busy={busyVid}
                busyLabel="Exporting Video..."
                label="Download Video (.mp4)"
                variant="outline"
                icon="video"
              />
            </div>
            {videoDone && (
              <p className="mt-3 text-sm text-[#5EEAD4]">
                Video exported — check your downloads.
              </p>
            )}
            {videoError && (
              <p
                role="alert"
                className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300"
              >
                {videoError}
              </p>
            )}
          </div>
        </>
      }
      howTo={
        <>
          <HowToItem icon="image">
            Upload an image and drag to reposition, scroll to zoom
          </HowToItem>
          <HowToItem>
            Adjust all six ratings (1-8 scale) — PSL, Potential and the
            four regions
          </HowToItem>
          <HowToItem>
            Switch Male / Female to relabel the score tiers instantly
          </HowToItem>
          <HowToItem icon="download">
            Download creates a 1080x1920 image, or a 1080x1920 MP4 video
            with an animated intro
          </HowToItem>
        </>
      }
    >
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="mx-auto block h-auto w-full max-w-[400px] touch-none rounded-lg bg-black select-none"
        style={{ cursor: circleHover ? "pointer" : img ? "grab" : "default" }}
      />
    </BuilderShell>
  );
}
