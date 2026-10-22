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

const SIZE = 1080;

interface CleanState {
  logo: HTMLImageElement | null;
  img: HTMLImageElement | null;
  t: PhotoTransform;
  gender: Gender;
  psl: number;
  potential: number;
}

/** Draws the square card. `yOff` centres the card in the taller
 *  video frame (his MP4 is a 1080x1920 render of this same card);
 *  `anim` drives the intro count-up / bar sweep. `hoverCircle` is a
 *  preview-only affordance — exports never pass it. */
function drawClean(
  ctx: CanvasRenderingContext2D,
  s: CleanState,
  yOff = 0,
  anim = 1,
  hoverCircle = false
) {
  ctx.save();
  ctx.translate(0, yOff);
  drawBackdrop(ctx, SIZE, SIZE, 540, 540);
  drawBrandHeader(ctx, s.logo, 540, 102, 150, 100);
  // Same card geometry as the full template: 74px margins, the pair
  // running low in the square, the photo overlapping them on top.
  drawScoreCard(ctx, {
    x: 74,
    y: 560,
    w: 450,
    h: 415,
    label: "PSL",
    score: s.psl,
    tier: scoreTierLabel(s.psl, s.gender),
    color: barColor(s.psl),
    fraction: barFraction(s.psl),
    anim,
  });
  drawScoreCard(ctx, {
    x: 556,
    y: 560,
    w: 450,
    h: 415,
    label: "POTENTIAL",
    score: s.potential,
    tier: scoreTierLabel(s.potential, s.gender),
    color: barColor(s.potential),
    fraction: barFraction(s.potential),
    anim,
  });
  drawPhotoCircle(ctx, s.img, s.t, 540, 395, 238, hoverCircle);
  ctx.restore();
}

export default function CleanRatingsBuilder() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [circleHover, setCircleHover] = useState(false);
  const [logo, setLogo] = useState<HTMLImageElement | null>(null);
  const [gender, setGender] = useState<Gender>("male");
  const [psl, setPsl] = useState(5);
  const [potential, setPotential] = useState(7);
  const [busyImg, setBusyImg] = useState(false);
  const [busyVid, setBusyVid] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [videoDone, setVideoDone] = useState(false);
  const { img, t, setT, onFile } = usePhoto();

  useCanvasPhotoControls(canvasRef, t, setT, !!img, {
    circle: { cx: 540, cy: 395, r: 238 },
    onCircleClick: () => fileInputRef.current?.click(),
    onCircleHoverChange: setCircleHover,
  });

  useEffect(() => {
    loadImage("/icon.png").then(setLogo).catch(() => {});
  }, []);

  const state: CleanState = { logo, img, t, gender, psl, potential };

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    drawClean(ctx, state, 0, 1, circleHover);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logo, img, t, gender, psl, potential, circleHover]);

  const downloadImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setBusyImg(true);
    requestAnimationFrame(() => {
      downloadCanvas(canvas, "mewmax-clean-ratings.png");
      setBusyImg(false);
    });
  };

  const downloadVideo = async () => {
    setVideoError(null);
    setVideoDone(false);
    setBusyVid(true);
    try {
      await exportMp4Video({
        width: 1080,
        height: 1920,
        filename: "mewmax-clean-ratings.mp4",
        drawFrame: (ctx, p) => drawClean(ctx, state, (1920 - SIZE) / 2, p),
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
      title="Cleaner Ratings Template"
      customize={
        <>
          <GenderToggle gender={gender} onChange={setGender} />
          <UploadButton onFile={onFile} hasPhoto={!!img} inputRef={fileInputRef} />
          {img && <PhotoAdjustPanel t={t} setT={setT} />}
          <ScoreSliderRow
            label="PSL Rating"
            value={psl}
            onChange={setPsl}
            min={1}
            max={8}
            step={0.1}
          />
          <ScoreSliderRow
            label="Potential Rating"
            value={potential}
            onChange={setPotential}
            min={1}
            max={8}
            step={0.1}
          />
          <div>
            <DownloadButton
              onClick={downloadImage}
              busy={busyImg}
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
            Adjust PSL and Potential ratings (1-8 scale)
          </HowToItem>
          <HowToItem>
            Switch Male / Female to relabel the tiers instantly
          </HowToItem>
          <HowToItem icon="download">
            Download creates a 1080x1080 image, or a 1080x1920 MP4 video
            with an animated intro
          </HowToItem>
        </>
      }
    >
      <canvas
        ref={canvasRef}
        width={SIZE}
        height={SIZE}
        className="mx-auto block h-auto w-full max-w-[440px] touch-none rounded-lg bg-black select-none"
        style={{ cursor: circleHover ? "pointer" : img ? "grab" : "default" }}
      />
    </BuilderShell>
  );
}
