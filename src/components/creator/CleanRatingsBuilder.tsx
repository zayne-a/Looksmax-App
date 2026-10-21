"use client";

import { useEffect, useRef, useState } from "react";
import {
  downloadBlob,
  downloadCanvas,
  drawBackdrop,
  drawBrandHeader,
  drawPhotoCircle,
  drawScoreCard,
  loadImage,
  type PhotoTransform,
} from "./canvas-kit";
import {
  barColor,
  barFraction,
  easeOutCubic,
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
 *  `anim` drives the intro count-up / bar sweep. */
function drawClean(
  ctx: CanvasRenderingContext2D,
  s: CleanState,
  yOff = 0,
  anim = 1
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
  drawPhotoCircle(ctx, s.img, s.t, 540, 395, 238);
  ctx.restore();
}

export default function CleanRatingsBuilder() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [logo, setLogo] = useState<HTMLImageElement | null>(null);
  const [gender, setGender] = useState<Gender>("male");
  const [psl, setPsl] = useState(5);
  const [potential, setPotential] = useState(7);
  const [busyImg, setBusyImg] = useState(false);
  const [busyVid, setBusyVid] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [videoDone, setVideoDone] = useState(false);
  const { img, t, setT, onFile } = usePhoto();

  useCanvasPhotoControls(canvasRef, t, setT, !!img);

  useEffect(() => {
    loadImage("/icon.png").then(setLogo).catch(() => {});
  }, []);

  const state: CleanState = { logo, img, t, gender, psl, potential };

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    drawClean(ctx, state);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logo, img, t, gender, psl, potential]);

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
    if (typeof VideoEncoder === "undefined") {
      setVideoError(
        "Your browser does not support video encoding. Please use Chrome, Edge, or Safari 16.4+."
      );
      return;
    }
    setBusyVid(true);
    try {
      const { Muxer, ArrayBufferTarget } = await import("mp4-muxer");
      const VW = 1080;
      const VH = 1920;
      const FPS = 30;
      const FRAMES = 45; // 1.5s — intro animates over the first 0.5s
      const off = new OffscreenCanvas(VW, VH);
      const octx = off.getContext("2d");
      if (!octx) throw new Error("Canvas is unavailable in this browser.");
      const muxer = new Muxer({
        target: new ArrayBufferTarget(),
        video: { codec: "avc", width: VW, height: VH },
        fastStart: "in-memory",
      });
      let encError: Error | null = null;
      const encoder = new VideoEncoder({
        output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
        error: (e) => {
          encError = e instanceof Error ? e : new Error(String(e));
        },
      });
      const config: VideoEncoderConfig = {
        codec: "avc1.640028",
        width: VW,
        height: VH,
        bitrate: 5_000_000,
        framerate: FPS,
      };
      const support = await VideoEncoder.isConfigSupported(config);
      if (!support.supported) {
        throw new Error(
          "This browser cannot encode H.264 video at 1080x1920. Try Chrome or Edge."
        );
      }
      encoder.configure(config);
      const octx2d = octx as unknown as CanvasRenderingContext2D;
      for (let i = 0; i < FRAMES; i++) {
        const p = easeOutCubic(Math.min(1, i / (FPS * 0.5)));
        drawClean(octx2d, state, (VH - SIZE) / 2, p);
        const frame = new VideoFrame(off, {
          timestamp: Math.round((i * 1_000_000) / FPS),
          duration: Math.round(1_000_000 / FPS),
        });
        encoder.encode(frame, { keyFrame: i % 15 === 0 });
        frame.close();
        if (encoder.encodeQueueSize > 4) {
          await new Promise((r) => setTimeout(r, 10));
        }
      }
      await encoder.flush();
      encoder.close();
      if (encError) throw encError;
      muxer.finalize();
      const blob = new Blob([muxer.target.buffer], { type: "video/mp4" });
      if (blob.size === 0) {
        throw new Error(
          "Video encoding produced an empty file. Please try again."
        );
      }
      downloadBlob(blob, "mewmax-clean-ratings.mp4");
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
          <UploadButton onFile={onFile} hasPhoto={!!img} />
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
        style={{ cursor: img ? "grab" : "default" }}
      />
    </BuilderShell>
  );
}
