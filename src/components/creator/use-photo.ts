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

/**
 * Attaches drag + wheel-zoom handlers to the preview canvas. Client
 * deltas are converted into canvas pixels through the element's
 * on-screen scale, so the gesture feels 1:1 at any preview size.
 */
export function useCanvasPhotoControls(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  t: PhotoTransform,
  setT: React.Dispatch<React.SetStateAction<PhotoTransform>>,
  active: boolean
) {
  const drag = useRef<{ px: number; py: number } | null>(null);
  const tRef = useRef(t);
  tRef.current = t;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const toCanvasDelta = (dx: number, dy: number) => {
      const rect = canvas.getBoundingClientRect();
      const k = rect.width > 0 ? canvas.width / rect.width : 1;
      return { dx: dx * k, dy: dy * k };
    };

    const down = (e: PointerEvent) => {
      if (!active) return;
      drag.current = { px: e.clientX, py: e.clientY };
      canvas.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!drag.current || !active) return;
      const { dx, dy } = toCanvasDelta(
        e.clientX - drag.current.px,
        e.clientY - drag.current.py
      );
      drag.current = { px: e.clientX, py: e.clientY };
      const clamp = (v: number) =>
        Math.min(PHOTO_OFFSET_LIMIT, Math.max(-PHOTO_OFFSET_LIMIT, v));
      setT((prev) => ({
        ...prev,
        x: clamp(prev.x + dx),
        y: clamp(prev.y + dy),
      }));
    };
    const up = () => {
      drag.current = null;
    };
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
    canvas.addEventListener("pointercancel", up);
    canvas.addEventListener("wheel", wheel, { passive: false });
    return () => {
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      canvas.removeEventListener("wheel", wheel);
    };
  }, [canvasRef, setT, active]);
}
