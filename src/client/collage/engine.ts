export const LAYOUTS = [
  "2h",
  "2v",
  "2x2",
  "3h",
  "3v",
  "3x3",
  "l1r2",
  "t1b2",
  "t1b3",
] as const;

export type LayoutId = (typeof LAYOUTS)[number];

export type Cell = { x: number; y: number; w: number; h: number };

function cell(x: number, y: number, w: number, h: number): Cell {
  return { x, y, w, h };
}

export function cellsFor(layout: LayoutId): Cell[] {
  switch (layout) {
    case "2h":
      return [cell(0, 0, 0.5, 1), cell(0.5, 0, 0.5, 1)];
    case "2v":
      return [cell(0, 0, 1, 0.5), cell(0, 0.5, 1, 0.5)];
    case "2x2":
      return [
        cell(0, 0, 0.5, 0.5),
        cell(0.5, 0, 0.5, 0.5),
        cell(0, 0.5, 0.5, 0.5),
        cell(0.5, 0.5, 0.5, 0.5),
      ];
    case "3h":
      return [cell(0, 0, 1 / 3, 1), cell(1 / 3, 0, 1 / 3, 1), cell(2 / 3, 0, 1 / 3, 1)];
    case "3v":
      return [cell(0, 0, 1, 1 / 3), cell(0, 1 / 3, 1, 1 / 3), cell(0, 2 / 3, 1, 1 / 3)];
    case "3x3": {
      const out: Cell[] = [];
      for (let y = 0; y < 3; y++) {
        for (let x = 0; x < 3; x++) out.push(cell(x / 3, y / 3, 1 / 3, 1 / 3));
      }
      return out;
    }
    case "l1r2":
      return [cell(0, 0, 0.55, 1), cell(0.55, 0, 0.45, 0.5), cell(0.55, 0.5, 0.45, 0.5)];
    case "t1b2":
      return [cell(0, 0, 1, 0.55), cell(0, 0.55, 0.5, 0.45), cell(0.5, 0.55, 0.5, 0.45)];
    case "t1b3":
      return [
        cell(0, 0, 1, 0.58),
        cell(0, 0.58, 1 / 3, 0.42),
        cell(1 / 3, 0.58, 1 / 3, 0.42),
        cell(2 / 3, 0.58, 1 / 3, 0.42),
      ];
  }
}

export function pixelRect(
  cell: Cell,
  canvasW: number,
  canvasH: number,
  gap: number,
): { x: number; y: number; w: number; h: number } {
  const x = cell.x * canvasW;
  const y = cell.y * canvasH;
  const w = cell.w * canvasW;
  const h = cell.h * canvasH;
  const left = cell.x > 0.001 ? gap / 2 : 0;
  const top = cell.y > 0.001 ? gap / 2 : 0;
  const right = cell.x + cell.w < 0.999 ? gap / 2 : 0;
  const bottom = cell.y + cell.h < 0.999 ? gap / 2 : 0;
  return {
    x: x + left,
    y: y + top,
    w: Math.max(1, w - left - right),
    h: Math.max(1, h - top - bottom),
  };
}

export const ASPECTS = {
  square: { w: 1800, h: 1800 },
  story: { w: 1080, h: 1920 },
  portrait: { w: 1440, h: 1800 },
  landscape: { w: 1920, h: 1080 },
} as const;

export type AspectId = keyof typeof ASPECTS;
export type FitMode = "cover" | "contain";

export type Slot = {
  image: CanvasImageSource;
  naturalWidth: number;
  naturalHeight: number;
} | null;

export function renderCollage(
  slots: Slot[],
  layout: LayoutId,
  opts: {
    width: number;
    height: number;
    gap: number;
    radius: number;
    background: string;
    fit: FitMode;
  },
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(opts.width));
  canvas.height = Math.max(1, Math.round(opts.height));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.fillStyle = opts.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const cells = cellsFor(layout);
  cells.forEach((c, i) => {
    const rect = pixelRect(c, canvas.width, canvas.height, opts.gap);
    const slot = slots[i] ?? null;
    roundRect(ctx, rect.x, rect.y, rect.w, rect.h, opts.radius);
    ctx.save();
    ctx.clip();
    if (slot) {
      drawFitted(
        ctx,
        slot.image,
        slot.naturalWidth,
        slot.naturalHeight,
        rect.x,
        rect.y,
        rect.w,
        rect.h,
        opts.fit,
      );
    }
    ctx.restore();
  });
  return canvas;
}

export function drawFitted(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  nw: number,
  nh: number,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  fit: FitMode,
): void {
  const scale = fit === "contain" ? Math.min(dw / nw, dh / nh) : Math.max(dw / nw, dh / nh);
  const w = nw * scale;
  const h = nh * scale;
  const x = dx + (dw - w) / 2;
  const y = dy + (dh - h) / 2;
  ctx.drawImage(image, x, y, w, h);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}
