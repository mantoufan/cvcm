export type Point = { x: number; y: number };
export type Stroke = Point[];
export type Bounds = { x: number; y: number; w: number; h: number };

export function strokeBounds(strokes: Stroke[], pad = 16): Bounds | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let any = false;
  for (const stroke of strokes) {
    for (const point of stroke) {
      any = true;
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
  }
  if (!any) return null;
  return {
    x: Math.floor(minX - pad),
    y: Math.floor(minY - pad),
    w: Math.ceil(maxX - minX + pad * 2),
    h: Math.ceil(maxY - minY + pad * 2),
  };
}

export function clampBounds(bounds: Bounds, width: number, height: number): Bounds {
  const x = Math.max(0, Math.min(width - 1, bounds.x));
  const y = Math.max(0, Math.min(height - 1, bounds.y));
  const w = Math.max(1, Math.min(width - x, bounds.w));
  const h = Math.max(1, Math.min(height - y, bounds.h));
  return { x, y, w, h };
}

export function hasInk(strokes: Stroke[]): boolean {
  return strokes.some((stroke) => stroke.length > 0);
}
