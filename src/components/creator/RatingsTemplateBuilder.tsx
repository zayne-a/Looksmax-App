"use client";

import { useEffect, useRef, useState } from "react";
import {
  downloadCanvas,
  drawBackdrop,
  drawBrandHeader,
  drawPhotoCircle,
  drawScoreCard,
  loadImage,
} from "./canvas-kit";
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
  const { img, t, setT, onFile } = usePhoto();

  useCanvasPhotoControls(canvasRef, t, setT, !!img, {
    circle: { cx: 540, cy: 408, r: 240 },
    onCircleClick: () => fileInputRef.current?.click(),
    onCircleHoverChange: setCircleHover,
  });

  useEffect(() => {
    loadImage("/icon.png").then(setLogo).catch(() => {});
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    drawBackdrop(ctx, W, H, 540, 960);
    drawBrandHeader(ctx, logo, 540, 118, 168, 110);

    const cards: Array<{
      label: string;
      score: number;
      tier: string;
    }> = [
      { label: "PSL", score: psl, tier: scoreTierLabel(psl, gender) },
      {
        label: "POTENTIAL",
        score: potential,
        tier: scoreTierLabel(potential, gender),
      },
      { label: "EYES", score: eyes, tier: regionLabel(eyes) },
      { label: "MIDFACE", score: midface, tier: regionLabel(midface) },
      {
        label: "LOWER THIRD",
        score: lowerThird,
        tier: regionLabel(lowerThird),
      },
      {
        label: "UPPER THIRD",
        score: upperThird,
        tier: regionLabel(upperThird),
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
      });
    });

    // Photo last: the circle overlaps the first card row. His disc
    // measures centre (540, 408), r 240 on his own export.
    drawPhotoCircle(ctx, img, t, 540, 408, 240, circleHover);
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
          <DownloadButton
            onClick={download}
            busy={busy}
            busyLabel="Preparing Image..."
            label="Download Image (.png)"
          />
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
            Download creates a 1080x1920 image perfect for social media
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
