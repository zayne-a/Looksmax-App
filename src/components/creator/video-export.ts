import { downloadBlob } from "./canvas-kit";
import { easeOutCubic } from "@/lib/creator-tiers";

/**
 * Shared MP4 export for the creator template builders (WebCodecs
 * VideoEncoder + mp4-muxer): 45 frames at 30fps (1.5s), H.264
 * avc1.640028 at 5 Mbps, with the intro animation eased out over
 * the first 15 frames. `drawFrame` renders one frame at animation
 * progress `anim` (0–1) onto a canvas of the export size. Throws an
 * Error with a user-facing message when the browser cannot encode —
 * callers surface it as-is.
 */
export async function exportMp4Video(opts: {
  width: number;
  height: number;
  filename: string;
  drawFrame: (ctx: CanvasRenderingContext2D, anim: number) => void;
}): Promise<void> {
  if (typeof VideoEncoder === "undefined") {
    throw new Error(
      "Your browser does not support video encoding. Please use Chrome, Edge, or Safari 16.4+."
    );
  }
  const VW = opts.width;
  const VH = opts.height;
  const FPS = 30;
  const FRAMES = 45; // 1.5s — intro animates over the first 0.5s
  const { Muxer, ArrayBufferTarget } = await import("mp4-muxer");
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
      `This browser cannot encode H.264 video at ${VW}x${VH}. Try Chrome or Edge.`
    );
  }
  encoder.configure(config);
  const ctx2d = octx as unknown as CanvasRenderingContext2D;
  for (let i = 0; i < FRAMES; i++) {
    const p = easeOutCubic(Math.min(1, i / (FPS * 0.5)));
    opts.drawFrame(ctx2d, p);
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
    throw new Error("Video encoding produced an empty file. Please try again.");
  }
  downloadBlob(blob, opts.filename);
}
