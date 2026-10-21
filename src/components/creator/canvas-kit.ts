/**
 * Shared canvas helpers for the creator template builders. Every
 * builder draws its card on a full-resolution canvas (the same
 * canvas that is exported), so the preview is always exactly what
 * downloads — the reference app works the same way.
 */

export interface PhotoTransform {
  x: number;
  y: number;
  scale: number;
}

export const IDENTITY_TRANSFORM: PhotoTransform = { x: 0, y: 0, scale: 1 };

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function downloadCanvas(canvas: HTMLCanvasElement, name: string) {
  canvas.toBlob((blob) => {
    if (blob) downloadBlob(blob, name);
  }, "image/png");
}

/** The templates' backdrop: radial charcoal centre fading to black. */
export function drawBackdrop(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  cx: number,
  cy: number
) {
  const g = ctx.createRadialGradient(cx, cy, 100, cx, cy, Math.max(w, h) * 0.95);
  g.addColorStop(0, "rgb(38, 38, 38)");
  g.addColorStop(1, "rgb(0, 0, 0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

export function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/**
 * Brand header: the Mewmax logo tile + MEWMAX wordmark, centred as
 * one group — the reference carries its logo and wordmark the same
 * way (minus the store badges, which we do not ship: no listing).
 */
export function drawBrandHeader(
  ctx: CanvasRenderingContext2D,
  logo: HTMLImageElement | null,
  centerX: number,
  centerY: number,
  logoSize: number,
  fontPx: number,
  wordmark = "MEWMAX"
) {
  ctx.save();
  ctx.font = `800 ${fontPx}px Archivo, Inter, system-ui, sans-serif`;
  const textW = ctx.measureText(wordmark).width;
  const gap = logo ? logoSize * 0.26 : 0;
  const total = (logo ? logoSize + gap : 0) + textW;
  let x = centerX - total / 2;
  if (logo) {
    ctx.save();
    roundRectPath(ctx, x, centerY - logoSize / 2, logoSize, logoSize, logoSize * 0.18);
    ctx.clip();
    ctx.drawImage(logo, x, centerY - logoSize / 2, logoSize, logoSize);
    ctx.restore();
    x += logoSize + gap;
  }
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(wordmark, x + textW / 2, centerY + fontPx * 0.04);
  ctx.restore();
}

/**
 * Circular photo slot. With no photo: hairline ring + "Insert Image
 * Here". With a photo: cover-fit inside the circle, transform applied
 * (offsets in canvas px, scale multiplies the cover size), and the
 * reference's white/20 ring on top.
 */
export function drawPhotoCircle(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  t: PhotoTransform,
  cx: number,
  cy: number,
  r: number
) {
  ctx.save();
  if (img) {
    const d = r * 2 * t.scale;
    const aspect = img.width / img.height;
    let w = d;
    let h = d;
    if (aspect > 1) w = d * aspect;
    else h = d / aspect;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(img, cx - w / 2 + t.x, cy - h / 2 + t.y, w, h);
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.font = `${Math.round(r * 0.13)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Insert Image Here", cx, cy);
  }
  ctx.restore();
}

/** One glowing score card: label, big coloured number, tier/verdict
 *  label and a progress bar. `anim` (0–1) drives the video intro:
 *  numbers count up and bars sweep in. */
export function drawScoreCard(
  ctx: CanvasRenderingContext2D,
  opts: {
    x: number;
    y: number;
    w: number;
    h: number;
    label: string;
    score: number;
    tier: string;
    color: string;
    fraction: number;
    anim?: number;
    labelColor?: string;
  }
) {
  const { x, y, w, h } = opts;
  const anim = opts.anim ?? 1;
  ctx.save();
  roundRectPath(ctx, x, y, w, h, 28);
  ctx.fillStyle = "rgba(255, 255, 255, 0.045)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.14)";
  ctx.lineWidth = 2;
  ctx.stroke();

  const pad = w * 0.075;
  // Label (top-left)
  ctx.fillStyle = opts.labelColor ?? "rgba(255, 255, 255, 0.55)";
  ctx.font = `600 ${Math.round(h * 0.115)}px Inter, system-ui, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(opts.label, x + pad, y + h * 0.24);

  // Score (top-right, coloured, counts up under anim)
  const shown = anim < 1 ? 1 + (opts.score - 1) * anim : opts.score;
  ctx.fillStyle = opts.color;
  ctx.font = `800 ${Math.round(h * 0.34)}px Archivo, Inter, system-ui, sans-serif`;
  ctx.textAlign = "right";
  ctx.shadowColor = opts.color;
  ctx.shadowBlur = 18;
  ctx.fillText(formatRatingSafe(shown), x + w - pad, y + h * 0.36);
  ctx.shadowBlur = 0;

  // Tier / verdict (under the label)
  ctx.fillStyle = opts.color;
  ctx.font = `700 ${Math.round(h * 0.125)}px Inter, system-ui, sans-serif`;
  ctx.textAlign = "left";
  ctx.fillText(opts.tier, x + pad, y + h * 0.52);

  // Progress bar
  const barX = x + pad;
  const barW = w - pad * 2;
  const barH = Math.max(14, h * 0.075);
  const barY = y + h - barH - h * 0.14;
  roundRectPath(ctx, barX, barY, barW, barH, barH / 2);
  ctx.fillStyle = "rgba(255, 255, 255, 0.10)";
  ctx.fill();
  const fillW = barW * Math.min(1, Math.max(0, opts.fraction)) * anim;
  if (fillW > 0) {
    roundRectPath(ctx, barX, barY, Math.max(barH, fillW), barH, barH / 2);
    ctx.fillStyle = opts.color;
    ctx.shadowColor = opts.color;
    ctx.shadowBlur = 14;
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  ctx.restore();
}

function formatRatingSafe(v: number): string {
  const r = Math.round(v * 10) / 10;
  return r % 1 === 0 ? r.toFixed(0) : r.toFixed(1);
}
