"use client";

import { useEffect, useRef, useState } from "react";
import {
  IDENTITY_TRANSFORM,
  PHOTO_OFFSET_LIMIT,
  loadImage,
  type PhotoTransform,
} from "./canvas-kit";

/**
 * Photo state for a template builder: the uploaded image element plus
 * its transform, and the canvas pointer wiring — drag to reposition,
 * scroll to zoom — exactly the reference's interaction model.
 */
export function usePhoto() {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [t, setT] = useState<PhotoTransform>(IDENTITY_TRANSFORM);

  const onFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    loadImage(url)
      .then((el) => {
        setImg(el);
        setT(IDENTITY_TRANSFORM);
      })
      .catch(() => {});
  };

  return { img, t, setT, onFile };
}

/** A press that travels no further than this (CSS px) is a click,
 *  not a drag — the picker opens only for true clicks. */
const CLICK_SLOP_PX = 6;

/** The photo circle's geometry in canvas pixels. */
export interface PhotoCircleGeometry {
  cx: number;
  cy: number;
  r: number;
}

export interface CanvasPhotoControlOptions {
  /** The photo circle, in canvas pixels — clicks inside it open
   *  the file picker (empty state and filled state alike). */
  circle: PhotoCircleGeometry;
  /** Fired on a true click inside the circle: press + release with
   *  no meaningful movement. A drag never fires it. */
  onCircleClick?: () => void;
  /** Fired when the pointer starts / stops hovering the circle, so
   *  the preview can brighten the ring and show a pointer cursor. */
  onCircleHoverChange?: (hovering: boolean) => void;
}

interface PressState {
  /** Press origin (client px) — displacement is measured from here. */
  sx: number;
  sy: number;
  /** Last pointer position (client px) — drag deltas come from here. */
  lx: number;
  ly: number;
  inCircle: boolean;
  /** True once displacement passes the slop: the gesture is a drag,
   *  so the transform follows and the release is not a click. */
  dragging: boolean;
}

/**
 * Attaches drag + wheel-zoom handlers to the preview canvas, plus
 * click-to-upload and hover tracking for the photo circle. Client
 * deltas are converted into canvas pixels through the element's
 * on-screen scale, so the gesture feels 1:1 at any preview size.
 */
export function useCanvasPhotoControls(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  t: PhotoTransform,
  setT: React.Dispatch<React.SetStateAction<PhotoTransform>>,
  active: boolean,
  options: CanvasPhotoControlOptions
) {
  const press = useRef<PressState | null>(null);
  const hovering = useRef(false);
  const tRef = useRef(t);
  tRef.current = t;
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const toCanvasDelta = (dx: number, dy: number) => {
      const rect = canvas.getBoundingClientRect();
      const k = rect.width > 0 ? canvas.width / rect.width : 1;
      return { dx: dx * k, dy: dy * k };
    };
    const insideCircle = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      const kx = rect.width > 0 ? canvas.width / rect.width : 1;
      const ky = rect.height > 0 ? canvas.height / rect.height : 1;
      const px = (clientX - rect.left) * kx;
      const py = (clientY - rect.top) * ky;
      const { cx, cy, r } = optionsRef.current.circle;
      const dx = px - cx;
      const dy = py - cy;
      return dx * dx + dy * dy <= r * r;
    };
    const setHover = (h: boolean) => {
      if (hovering.current === h) return;
      hovering.current = h;
      optionsRef.current.onCircleHoverChange?.(h);
    };

    const down = (e: PointerEvent) => {
      press.current = {
        sx: e.clientX,
        sy: e.clientY,
        lx: e.clientX,
        ly: e.clientY,
        inCircle: insideCircle(e.clientX, e.clientY),
        dragging: false,
      };
      canvas.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      const p = press.current;
      if (!p || e.buttons === 0) {
        // No live press: this move is hover tracking.
        press.current = null;
        setHover(insideCircle(e.clientX, e.clientY));
        return;
      }
      if (!active) return;
      if (!p.dragging) {
        // Hold the transform still until the gesture proves it is a
        // drag — a click must not nudge the photo on its way out.
        if (Math.hypot(e.clientX - p.sx, e.clientY - p.sy) <= CLICK_SLOP_PX) {
          p.lx = e.clientX;
          p.ly = e.clientY;
          return;
        }
        p.dragging = true;
        setHover(false);
      }
      const { dx, dy } = toCanvasDelta(e.clientX - p.lx, e.clientY - p.ly);
      p.lx = e.clientX;
      p.ly = e.clientY;
      const clamp = (v: number) =>
        Math.min(PHOTO_OFFSET_LIMIT, Math.max(-PHOTO_OFFSET_LIMIT, v));
      setT((prev) => ({
        ...prev,
        x: clamp(prev.x + dx),
        y: clamp(prev.y + dy),
      }));
    };
    const up = (e: PointerEvent) => {
      const p = press.current;
      press.current = null;
      if (!p || !p.inCircle || p.dragging) return;
      const moved = Math.hypot(e.clientX - p.sx, e.clientY - p.sy);
      if (moved <= CLICK_SLOP_PX) optionsRef.current.onCircleClick?.();
    };
    const cancel = () => {
      press.current = null;
    };
    const leave = () => setHover(false);
    const wheel = (e: WheelEvent) => {
      if (!active) return;
      e.preventDefault();
      setT((prev) => ({
        ...prev,
        scale: Math.min(4, Math.max(1, prev.scale * Math.exp(-e.deltaY * 0.0015))),
      }));
    };

    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", cancel);
    canvas.addEventListener("pointerleave", leave);
    canvas.addEventListener("wheel", wheel, { passive: false });
    return () => {
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", cancel);
      canvas.removeEventListener("pointerleave", leave);
      canvas.removeEventListener("wheel", wheel);
    };
  }, [canvasRef, setT, active]);
}
