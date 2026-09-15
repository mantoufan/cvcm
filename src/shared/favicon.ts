export const PNG_SIZES = [16, 32, 48, 180, 192, 512] as const;
export const ICO_SIZES = [16, 32, 48] as const;
export type FitMode = "cover" | "contain";

export type SourceRect = { sx: number; sy: number; sw: number; sh: number };
export type DestRect = { dx: number; dy: number; dw: number; dh: number };

export function squareSource(srcW: number, srcH: number, mode: FitMode): SourceRect {
  const w = Math.max(1, srcW);
  const h = Math.max(1, srcH);
  if (mode === "contain") return { sx: 0, sy: 0, sw: w, sh: h };
  const side = Math.min(w, h);
  return {
    sx: Math.floor((w - side) / 2),
    sy: Math.floor((h - side) / 2),
    sw: side,
    sh: side,
  };
}

export function squareDest(srcW: number, srcH: number, size: number, mode: FitMode): DestRect {
  const out = Math.max(1, Math.round(size));
  if (mode === "cover") return { dx: 0, dy: 0, dw: out, dh: out };
  const s = Math.min(out / Math.max(1, srcW), out / Math.max(1, srcH));
  const dw = Math.max(1, srcW * s);
  const dh = Math.max(1, srcH * s);
  return { dx: (out - dw) / 2, dy: (out - dh) / 2, dw, dh };
}

export type IcoPng = { width: number; height: number; png: Uint8Array };

export function packIco(images: IcoPng[]): Uint8Array {
  if (images.length === 0) throw new Error("ico-empty");
  if (images.length > 16) throw new Error("ico-count");
  const count = images.length;
  const header = 6 + 16 * count;
  let offset = header;
  const entries = images.map((img) => {
    const entry = { ...img, offset };
    offset += img.png.length;
    return entry;
  });
  const out = new Uint8Array(offset);
  const view = new DataView(out.buffer);
  view.setUint16(0, 0, true);
  view.setUint16(2, 1, true);
  view.setUint16(4, count, true);
  entries.forEach((img, i) => {
    const o = 6 + i * 16;
    out[o] = img.width >= 256 ? 0 : img.width;
    out[o + 1] = img.height >= 256 ? 0 : img.height;
    out[o + 2] = 0;
    out[o + 3] = 0;
    view.setUint16(o + 4, 1, true);
    view.setUint16(o + 6, 32, true);
    view.setUint32(o + 8, img.png.length, true);
    view.setUint32(o + 12, img.offset, true);
    out.set(img.png, img.offset);
  });
  return out;
}
