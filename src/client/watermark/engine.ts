export type Anchor =
  | "tl"
  | "tc"
  | "tr"
  | "ml"
  | "mc"
  | "mr"
  | "bl"
  | "bc"
  | "br";

export type Position =
  | { mode: "anchor"; anchor: Anchor }
  | { mode: "free"; x: number; y: number };

export interface TextSpec {
  text: string;
  fontFamily: string;
  fontWeight: string;
  fontSizeRatio: number;
  color: string;
  opacity: number;
  rotate: number;
  stroke: boolean;
  strokeColor: string;
}

export interface LogoSpec {
  image: CanvasImageSource;
  naturalWidth: number;
  naturalHeight: number;
  scale: number;
  opacity: number;
  rotate: number;
}

export interface WatermarkSpec {
  text: TextSpec | null;
  logo: LogoSpec | null;
  position: Position;
  tiled: boolean;
  tileGapRatio: number;
}

export const MAX_PIXELS = 25_000_000;

export function boxAtAnchor(
  anchor: Anchor,
  canvasW: number,
  canvasH: number,
  boxW: number,
  boxH: number,
  pad: number,
): { x: number; y: number } {
  const maxX = Math.max(pad, canvasW - boxW - pad);
  const maxY = Math.max(pad, canvasH - boxH - pad);
  const cx = (canvasW - boxW) / 2;
  const cy = (canvasH - boxH) / 2;
  const x =
    anchor.endsWith("l") ? pad : anchor.endsWith("r") ? maxX : cx;
  const y =
    anchor.startsWith("t") ? pad : anchor.startsWith("b") ? maxY : cy;
  return { x, y };
}

export function boxAtFree(
  xRatio: number,
  yRatio: number,
  canvasW: number,
  canvasH: number,
  boxW: number,
  boxH: number,
): { x: number; y: number } {
  const x = xRatio * canvasW - boxW / 2;
  const y = yRatio * canvasH - boxH / 2;
  return { x, y };
}

export function fitExportSize(
  width: number,
  height: number,
  maxPixels = MAX_PIXELS,
): { width: number; height: number; scaled: boolean } {
  const pixels = width * height;
  if (pixels <= maxPixels || pixels <= 0) {
    return { width, height, scaled: false };
  }
  const scale = Math.sqrt(maxPixels / pixels);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    scaled: true,
  };
}

export function renderWatermark(
  source: CanvasImageSource,
  sourceW: number,
  sourceH: number,
  spec: WatermarkSpec,
  targetW = sourceW,
  targetH = sourceH,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(targetW));
  canvas.height = Math.max(1, Math.round(targetH));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  if (spec.logo) drawLogo(ctx, canvas.width, canvas.height, spec, spec.logo);
  if (spec.text && spec.text.text.trim()) {
    drawText(ctx, canvas.width, canvas.height, spec, spec.text);
  }
  return canvas;
}

function minDim(w: number, h: number): number {
  return Math.min(w, h);
}

/** Grid pitch for tiled marks. Ratio 0 is tight but not overlapping; higher is looser. */
export function tilePitch(
  boxW: number,
  boxH: number,
  ratio: number,
): { x: number; y: number } {
  const t = Math.max(0, ratio);
  return {
    x: Math.max(8, boxW * (1.08 + t * 1.6)),
    y: Math.max(8, boxH * (1.2 + t * 1.6)),
  };
}

function drawText(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  spec: WatermarkSpec,
  text: TextSpec,
): void {
  const size = Math.max(8, minDim(w, h) * text.fontSizeRatio);
  const font = `${text.fontWeight} ${size}px ${text.fontFamily}`;
  const lines = text.text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length === 0) return;

  ctx.save();
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const lineHeight = size * 1.25;
  const widths = lines.map((line) => ctx.measureText(line).width);
  const boxW = Math.max(...widths);
  const boxH = lineHeight * lines.length;
  const paint = () => {
    ctx.font = font;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = text.color;
    ctx.strokeStyle = text.strokeColor;
    ctx.lineWidth = Math.max(1, size * 0.08);
    ctx.lineJoin = "round";
    lines.forEach((line, i) => {
      const y = (i - (lines.length - 1) / 2) * lineHeight;
      if (text.stroke) ctx.strokeText(line, 0, y);
      ctx.fillText(line, 0, y);
    });
  };

  stamp(ctx, w, h, spec, boxW, boxH, text.opacity, text.rotate, paint);
  ctx.restore();
}

function drawLogo(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  spec: WatermarkSpec,
  logo: LogoSpec,
): void {
  const markW = Math.max(1, w * logo.scale);
  const ratio = logo.naturalHeight / Math.max(1, logo.naturalWidth);
  const markH = Math.max(1, markW * ratio);
  const paint = () => {
    ctx.drawImage(logo.image, -markW / 2, -markH / 2, markW, markH);
  };
  stamp(ctx, w, h, spec, markW, markH, logo.opacity, logo.rotate, paint);
}

function stamp(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  spec: WatermarkSpec,
  boxW: number,
  boxH: number,
  opacity: number,
  rotate: number,
  paint: () => void,
): void {
  ctx.save();
  ctx.globalAlpha = clamp(opacity, 0, 1);
  const rad = (rotate * Math.PI) / 180;

  if (spec.tiled) {
    const pitch = tilePitch(boxW, boxH, spec.tileGapRatio);
    const diag = Math.hypot(w, h);
    ctx.translate(w / 2, h / 2);
    ctx.rotate(rad);
    for (let y = -diag; y <= diag; y += pitch.y) {
      for (let x = -diag; x <= diag; x += pitch.x) {
        ctx.save();
        ctx.translate(x, y);
        paint();
        ctx.restore();
      }
    }
  } else {
    const pad = minDim(w, h) * 0.04;
    const topLeft =
      spec.position.mode === "anchor"
        ? boxAtAnchor(spec.position.anchor, w, h, boxW, boxH, pad)
        : boxAtFree(spec.position.x, spec.position.y, w, h, boxW, boxH);
    ctx.translate(topLeft.x + boxW / 2, topLeft.y + boxH / 2);
    ctx.rotate(rad);
    paint();
  }
  ctx.restore();
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
