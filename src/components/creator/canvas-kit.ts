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

/** Drag/slider bounds for the photo offset (canvas px) — the
 *  "Adjust Image Position & Size" panel and the pointer controls
 *  share this state, so they share its limits too. */
export const PHOTO_OFFSET_LIMIT = 350;

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

/** The templates' backdrop: near-black with a barely-there radial
 *  lift in the centre — the reference export reads as pure black. */
export function drawBackdrop(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  cx: number,
  cy: number
) {
  const g = ctx.createRadialGradient(cx, cy, 100, cx, cy, Math.max(w, h) * 0.95);
  g.addColorStop(0, "rgb(24, 24, 24)");
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
 * reference's white/20 ring on top. `hover` (preview only) brightens
 * the ring and placeholder so the slot reads as clickable — exports
 * always draw with it off.
 */
export function drawPhotoCircle(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  t: PhotoTransform,
  cx: number,
  cy: number,
  r: number,
  hover = false
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
    ctx.strokeStyle = hover
      ? "rgba(255, 255, 255, 0.65)"
      : "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.strokeStyle = hover
      ? "rgba(255, 255, 255, 0.55)"
      : "rgba(255, 255, 255, 0.2)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    // Placeholder: a small image glyph over "Insert Image Here",
    // like the reference's empty slot.
    const s = r * 0.36;
    const ix = cx - s / 2;
    const iy = cy - s * 0.78;
    ctx.strokeStyle = hover
      ? "rgba(255, 255, 255, 0.75)"
      : "rgba(255, 255, 255, 0.45)";
    ctx.lineWidth = Math.max(3, r * 0.022);
    roundRectPath(ctx, ix, iy, s, s * 0.8, s * 0.08);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(ix + s * 0.3, iy + s * 0.26, s * 0.09, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ix + s * 0.08, iy + s * 0.72);
    ctx.lineTo(ix + s * 0.38, iy + s * 0.44);
    ctx.lineTo(ix + s * 0.58, iy + s * 0.62);
    ctx.lineTo(ix + s * 0.72, iy + s * 0.5);
    ctx.lineTo(ix + s * 0.92, iy + s * 0.72);
    ctx.stroke();
    const plus = s * 0.13;
    ctx.beginPath();
    ctx.moveTo(ix + s + plus * 0.4, iy - plus * 1.5);
    ctx.lineTo(ix + s + plus * 0.4, iy - plus * 0.1);
    ctx.moveTo(ix + s - plus * 0.3, iy - plus * 0.8);
    ctx.lineTo(ix + s + plus * 1.1, iy - plus * 0.8);
    ctx.stroke();
    ctx.fillStyle = hover
      ? "rgba(255, 255, 255, 0.7)"
      : "rgba(255, 255, 255, 0.4)";
    ctx.font = `${Math.round(r * 0.115)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Insert Image Here", cx, cy + r * 0.3);
  }
  ctx.restore();
}

/** The reference card's teal — labels and the glowing outline. */
export const CARD_TEAL = "#75fff1";

/**
 * One score card, drawn to the reference export's geometry (measured
 * from a 1080×1920 export): near-black gradient surface with a
 * glowing teal outline; bold teal label top-left; a large WHITE
 * numeral with the tier in white on the same line, separated by a
 * small dot in the tier colour (wrapping to a second line when the
 * pair runs long, like the reference); a thick glowing progress bar
 * low in the card. `anim` (0–1) drives the video intro: numbers
 * count up and bars sweep in.
 */
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

  // Surface: dark charcoal gradient with subtle inner depth.
  roundRectPath(ctx, x, y, w, h, 30);
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, "#2b2f2f");
  g.addColorStop(1, "#1d2020");
  ctx.fillStyle = g;
  ctx.fill();

  // Glowing teal outline: a shadowed stroke for the halo, then a
  // bright core stroke so the edge itself stays crisp.
  ctx.save();
  ctx.shadowColor = "rgba(117, 255, 241, 0.55)";
  ctx.shadowBlur = 22;
  ctx.strokeStyle = "rgba(117, 255, 241, 0.85)";
  ctx.lineWidth = 3;
  roundRectPath(ctx, x, y, w, h, 30);
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = "rgba(213, 255, 249, 0.9)";
  ctx.lineWidth = 1.5;
  roundRectPath(ctx, x, y, w, h, 30);
  ctx.stroke();

  const pad = w * 0.098;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  // Label (top-left, bold teal — or the caller's override, e.g. the
  // POTENTIAL card's yellow)
  ctx.fillStyle = opts.labelColor ?? CARD_TEAL;
  ctx.font = `800 ${Math.round(h * 0.117)}px Archivo, Inter, system-ui, sans-serif`;
  ctx.fillText(opts.label, x + pad, y + h * 0.356);

  // Number line: white numeral, tier-coloured dot, white tier text.
  const shown = anim < 1 ? 1 + (opts.score - 1) * anim : opts.score;
  const numFont = Math.round(h * 0.215);
  const baseY = y + h * 0.612;
  ctx.font = `800 ${numFont}px Archivo, Inter, system-ui, sans-serif`;
  ctx.fillStyle = "#ffffff";
  const numText = formatRatingSafe(shown);
  ctx.fillText(numText, x + pad, baseY);
  const numW = ctx.measureText(numText).width;

  const dotR = Math.max(7, h * 0.027);
  const dotCx = x + pad + numW + h * 0.078;
  const dotCy = baseY - numFont * 0.35;
  ctx.save();
  ctx.fillStyle = opts.color;
  ctx.shadowColor = opts.color;
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.arc(dotCx, dotCy, dotR, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const tierFont = Math.round(h * 0.09);
  ctx.font = `500 ${tierFont}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = "#ffffff";
  const tierX = dotCx + dotR + h * 0.055;
  const tierAvail = x + w - pad - tierX;
  if (ctx.measureText(opts.tier).width <= tierAvail) {
    ctx.fillText(opts.tier, tierX, baseY - h * 0.022);
  } else {
    // Long tier names wrap like the reference: first words ride the
    // number line, the rest drop to a second line at the left edge.
    const words = opts.tier.split(" ");
    let line1 = "";
    for (const word of words) {
      const next = line1 ? `${line1} ${word}` : word;
      if (line1 && ctx.measureText(next).width > tierAvail) break;
      line1 = next;
    }
    const line2 = opts.tier.slice(line1.length).trim();
    ctx.fillText(line1, tierX, baseY - h * 0.022);
    if (line2) ctx.fillText(line2, x + pad, baseY + tierFont * 1.18);
  }

  // Progress bar: thick, rounded, tier-coloured, glowing.
  const barX = x + pad;
  const barW = w - pad * 2;
  const barH = Math.max(16, h * 0.056);
  const barY = y + h - barH - h * 0.215;
  roundRectPath(ctx, barX, barY, barW, barH, barH / 2);
  ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
  ctx.fill();
  const fillW = barW * Math.min(1, Math.max(0, opts.fraction)) * anim;
  if (fillW > 0) {
    roundRectPath(ctx, barX, barY, Math.max(barH, fillW), barH, barH / 2);
    ctx.fillStyle = opts.color;
    ctx.shadowColor = opts.color;
    ctx.shadowBlur = 16;
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  ctx.restore();
}

function formatRatingSafe(v: number): string {
  const r = Math.round(v * 10) / 10;
  return r % 1 === 0 ? r.toFixed(0) : r.toFixed(1);
}
