"use client";

import { useEffect, useRef, useState } from "react";
import {
  downloadCanvas,
  drawBackdrop,
  drawBrandHeader,
  drawPhotoCircle,
  loadImage,
} from "./canvas-kit";
import { ringColor } from "@/lib/creator-tiers";
import { useCanvasPhotoControls, usePhoto } from "./use-photo";
import {
  BuilderShell,
  DownloadButton,
  HowToItem,
  MINT,
  PhotoAdjustPanel,
  ScoreSliderRow,
  UploadButton,
} from "./BuilderShell";

const W = 1080;
const H = 1920;

function drawSpacedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  y: number,
  spacing: number
) {
  const widths = [...text].map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (text.length - 1);
  let x = cx - total / 2;
  const prevAlign = ctx.textAlign;
  ctx.textAlign = "left";
  [...text].forEach((ch, i) => {
    ctx.fillText(ch, x, y);
    x += widths[i] + spacing;
  });
  ctx.textAlign = prevAlign;
}

export default function AscendTemplateBuilder() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [logo, setLogo] = useState<HTMLImageElement | null>(null);
  const [days, setDays] = useState(89);
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
    drawBrandHeader(ctx, logo, 540, 118, 168, 110);
    drawPhotoCircle(ctx, img, t, 540, 452, 268);

    // Countdown ring — fills and shifts red → yellow → green → mint
    // as the days run down (progress = (90 − days) / 90).
    const cx = 540;
    const cy = 1220;
    const r = 480;
    const q = (90 - days) / 90;
    const color = ringColor(q);
    ctx.save();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.lineWidth = 28;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    if (q > 0) {
      ctx.strokeStyle = color;
      ctx.lineCap = "round";
      ctx.shadowColor = color;
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + q * Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    ctx.fillStyle = "#ffffff";
    ctx.font = "800 320px Archivo, Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(String(days), cx, cy - 60);
    ctx.font = "500 80px Inter, system-ui, sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.fillText("DAYS", cx, cy + 80);
    ctx.font = "500 68px Inter, system-ui, sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.fillText("UNTIL YOU", cx, cy + 180);
    ctx.font = "800 80px Archivo, Inter, system-ui, sans-serif";
    ctx.fillStyle = MINT;
    ctx.shadowColor = MINT;
    ctx.shadowBlur = 8;
    drawSpacedText(ctx, "ASCEND", cx, cy + 290, 20);
    ctx.restore();
  }, [days, img, t, logo]);

  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setBusy(true);
    requestAnimationFrame(() => {
      downloadCanvas(canvas, "mewmax-ascend-template.png");
      setBusy(false);
    });
  };

  return (
    <BuilderShell
      title="Ascend Template"
      customize={
        <>
          <UploadButton onFile={onFile} hasPhoto={!!img} />
          {img && <PhotoAdjustPanel t={t} setT={setT} />}
          <ScoreSliderRow
            label="Days Until Ascend"
            value={days}
            onChange={(v) => setDays(Math.round(v))}
            min={0}
            max={90}
            step={1}
          />
          <DownloadButton
            onClick={download}
            busy={busy}
            busyLabel="Preparing Image..."
            label="Download Customized Template (.png)"
          />
        </>
      }
      howTo={
        <>
          <HowToItem icon="image">
            Upload an image and drag to reposition, scroll to zoom
          </HowToItem>
          <HowToItem>Set the days left until you ascend (0–90)</HowToItem>
          <HowToItem>
            The ring fills and turns green as the deadline closes in
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
        style={{ cursor: img ? "grab" : "default" }}
      />
    </BuilderShell>
  );
}
