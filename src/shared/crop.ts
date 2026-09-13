export type Rect = { x: number; y: number; w: number; h: number };

export function clampRect(rect: Rect, imgW: number, imgH: number): Rect {
  const w = Math.max(1, Math.min(rect.w, imgW));
  const h = Math.max(1, Math.min(rect.h, imgH));
  const x = Math.max(0, Math.min(rect.x, imgW - w));
  const y = Math.max(0, Math.min(rect.y, imgH - h));
  return { x, y, w, h };
}

export function fitContain(
  imgW: number,
  imgH: number,
  boxW: number,
  boxH: number,
): { x: number; y: number; w: number; h: number } {
  const s = Math.min(boxW / imgW, boxH / imgH);
  const w = imgW * s;
  const h = imgH * s;
  return { x: (boxW - w) / 2, y: (boxH - h) / 2, w, h };
}

export function applyAspect(rect: Rect, aspect: number | null, imgW: number, imgH: number): Rect {
  if (!aspect || aspect <= 0) return clampRect(rect, imgW, imgH);
  let w = rect.w;
  let h = w / aspect;
  if (h > imgH) {
    h = imgH;
    w = h * aspect;
  }
  if (w > imgW) {
    w = imgW;
    h = w / aspect;
  }
  return clampRect({ x: rect.x, y: rect.y, w, h }, imgW, imgH);
}

export function mapPoint(
  px: number,
  py: number,
  display: { x: number; y: number; w: number; h: number },
  imgW: number,
  imgH: number,
): { x: number; y: number } {
  const x = ((px - display.x) / display.w) * imgW;
  const y = ((py - display.y) / display.h) * imgH;
  return {
    x: Math.max(0, Math.min(imgW, x)),
    y: Math.max(0, Math.min(imgH, y)),
  };
}
