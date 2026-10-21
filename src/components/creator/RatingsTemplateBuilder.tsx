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
  ScoreSliderRow,
  UploadButton,
} from "./BuilderShell";

const W = 1080;
const H = 1920;
const POTENTIAL_YELLOW = "#FACC15";

export default function RatingsTemplateBuilder() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
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

  useCanvasPhotoControls(canvasRef, t, setT, !!img);

  useEffect(() => {
    loadImage("/icon.png").then(setLogo).catch(() => {});
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    drawBackdrop(ctx, W, H, 540, 960);
    drawBrandHeader(ctx, logo, 540, 124, 156, 100);
    drawPhotoCircle(ctx, img, t, 540, 460, 200);

    const cards: Array<{
      label: string;
      score: number;
      tier: string;
      labelColor?: string;
    }> = [
      { label: "PSL", score: psl, tier: scoreTierLabel(psl, gender) },
      {
        label: "POTENTIAL",
        score: potential,
        tier: scoreTierLabel(potential, gender),
        labelColor: POTENTIAL_YELLOW,
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
    const xs = [45, 565];
    const ys = [610, 960, 1310];
    cards.forEach((c, i) => {
      drawScoreCard(ctx, {
        x: xs[i % 2],
        y: ys[Math.floor(i / 2)],
        w: 470,
        h: 320,
        label: c.label,
        score: c.score,
        tier: c.tier,
        color: barColor(c.score),
        fraction: barFraction(c.score),
        labelColor: c.labelColor,
      });
    });

    ctx.save();
    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
    ctx.font = "600 34px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("M E W M A X", 540, 1790);
    ctx.restore();
  }, [logo, img, t, gender, psl, potential, eyes, midface, lowerThird, upperThird]);

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
          <UploadButton onFile={onFile} hasPhoto={!!img} />
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
          <HowToItem>
            Upload an image and drag to reposition, scroll to zoom
          </HowToItem>
          <HowToItem>
            Adjust all six ratings (1-8 scale) — PSL, Potential and the
            four regions
          </HowToItem>
          <HowToItem>
            Switch Male / Female to relabel the score tiers instantly
          </HowToItem>
          <HowToItem>
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
        style={{ cursor: img ? "grab" : "default" }}
      />
    </BuilderShell>
  );
}
