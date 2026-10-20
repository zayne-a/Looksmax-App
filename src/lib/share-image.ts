/**
 * Shareable PNG cards, drawn on a canvas in the browser — the
 * milestone card and the weekly report card. No image service, no
 * upload: the card is generated on the user's device from their own
 * numbers, which keeps the privacy promise intact.
 */

const W = 1080;
const H = 1350;
const INK = "#0d0b08";
const PANEL = "#171310";
const GOLD = "#e3b94e";
const GOLD_SOFT = "#f0d48a";
const BONE = "#f3ead8";
const MUTED = "#a89c86";

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function base(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = PANEL;
  ctx.fillRect(48, 48, W - 96, H - 96);
  ctx.strokeStyle = "rgba(227,185,78,0.45)";
  ctx.lineWidth = 2;
  ctx.strokeRect(48, 48, W - 96, H - 96);
  ctx.fillStyle = GOLD;
  ctx.font = "700 34px system-ui, sans-serif";
  ctx.fillText("A S C E N D", 96, 140);
  return [canvas, ctx];
}

function download(canvas: HTMLCanvasElement, name: string) {
  const a = document.createElement("a");
  a.download = name;
  a.href = canvas.toDataURL("image/png");
  a.click();
}

export function downloadMilestoneCard(input: {
  headline: string;
  score: number | null;
  delta: number | null;
  streak: number;
  week: number | null;
}) {
  const [canvas, ctx] = base();
  ctx.fillStyle = MUTED;
  ctx.font = "600 30px system-ui, sans-serif";
  ctx.fillText("MILESTONE", 96, 230);

  ctx.fillStyle = BONE;
  ctx.font = "800 64px system-ui, sans-serif";
  let y = 320;
  for (const line of wrap(ctx, input.headline, W - 192).slice(0, 3)) {
    ctx.fillText(line, 96, y);
    y += 76;
  }

  if (input.score !== null) {
    ctx.fillStyle = GOLD;
    ctx.font = "800 190px system-ui, sans-serif";
    ctx.fillText(`${Math.round(input.score)}`, 96, y + 190);
    ctx.fillStyle = GOLD_SOFT;
    ctx.font = "700 40px system-ui, sans-serif";
    const label =
      input.delta !== null && input.delta !== 0
        ? `overall score  (${input.delta > 0 ? "+" : ""}${input.delta.toFixed(1)} since last scan)`
        : "overall score";
    ctx.fillText(label, 100, y + 268);
    y += 330;
  }

  ctx.fillStyle = BONE;
  ctx.font = "700 44px system-ui, sans-serif";
  const facts: string[] = [];
  if (input.streak > 0) facts.push(`🔥 ${input.streak}-day streak`);
  if (input.week) facts.push(`Week ${input.week} of the 12-week protocol`);
  facts.push("Measured on-device · photos never uploaded");
  let fy = Math.max(y + 60, 880);
  for (const f of facts) {
    ctx.fillText(f, 96, fy);
    fy += 62;
  }

  ctx.fillStyle = MUTED;
  ctx.font = "500 30px system-ui, sans-serif";
  ctx.fillText("looksmax-app-echo-mint.vercel.app", 96, H - 120);
  download(canvas, "ascend-milestone.png");
}

export function downloadWeeklyReport(input: {
  week: number | null;
  improved: string[];
  slipped: string[];
  topMoveTitle: string;
  topMoveDetail: string;
  daysActive: number;
  streak: number;
}) {
  const [canvas, ctx] = base();
  ctx.fillStyle = MUTED;
  ctx.font = "600 30px system-ui, sans-serif";
  ctx.fillText(
    input.week ? `WEEKLY REPORT · WEEK ${input.week} OF 12` : "WEEKLY REPORT",
    96,
    230
  );
  ctx.fillStyle = BONE;
  ctx.font = "700 40px system-ui, sans-serif";
  ctx.fillText(
    `${input.daysActive} active days · 🔥 ${input.streak} streak`,
    96,
    292
  );

  let y = 400;
  const section = (title: string, color: string, lines: string[]) => {
    ctx.fillStyle = color;
    ctx.font = "700 32px system-ui, sans-serif";
    ctx.fillText(title, 96, y);
    y += 52;
    ctx.fillStyle = BONE;
    ctx.font = "500 34px system-ui, sans-serif";
    for (const item of lines.slice(0, 3)) {
      for (const line of wrap(ctx, `•  ${item}`, W - 192).slice(0, 2)) {
        ctx.fillText(line, 96, y);
        y += 46;
      }
      y += 10;
    }
    y += 26;
  };

  section("WHAT IMPROVED", GOLD_SOFT, input.improved.length ? input.improved : ["A steady week — nothing regressed."]);
  section("WHAT SLIPPED", "#e8a0a0", input.slipped.length ? input.slipped : ["Nothing slipped. Clean week."]);

  ctx.fillStyle = GOLD;
  ctx.font = "700 32px system-ui, sans-serif";
  ctx.fillText("YOUR #1 MOVE", 96, y);
  y += 54;
  ctx.fillStyle = BONE;
  ctx.font = "800 44px system-ui, sans-serif";
  for (const line of wrap(ctx, input.topMoveTitle, W - 192).slice(0, 2)) {
    ctx.fillText(line, 96, y);
    y += 54;
  }
  ctx.font = "500 32px system-ui, sans-serif";
  ctx.fillStyle = MUTED;
  for (const line of wrap(ctx, input.topMoveDetail, W - 192).slice(0, 3)) {
    ctx.fillText(line, 96, y);
    y += 44;
  }

  ctx.fillStyle = MUTED;
  ctx.font = "500 30px system-ui, sans-serif";
  ctx.fillText("Ascend · your 12-week adaptive protocol", 96, H - 120);
  download(canvas, "ascend-weekly-report.png");
}
