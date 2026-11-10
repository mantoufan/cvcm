import { GifWriter, newScratch, type GifScratch } from "./gif";
export type Pixels = { data: Uint8ClampedArray; width: number; height: number };

export function blobFromBytes(data: Uint8Array, type: string): Blob {
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  return new Blob([copy.buffer], { type });
}

function u16(n: number): Uint8Array {
  const b = new Uint8Array(2);
  b[0] = n & 255;
  b[1] = (n >> 8) & 255;
  return b;
}

function u32(n: number): Uint8Array {
  const b = new Uint8Array(4);
  b[0] = n & 255;
  b[1] = (n >> 8) & 255;
  b[2] = (n >> 16) & 255;
  b[3] = (n >> 24) & 255;
  return b;
}

export function encodeBmp(px: Pixels): Uint8Array {
  const w = px.width;
  const h = px.height;
  const row = w * 3;
  const stride = (row + 3) & ~3;
  const pixels = stride * h;
  const off = 54;
  const out = new Uint8Array(off + pixels);
  out.set([0x42, 0x4d]);
  out.set(u32(out.length), 2);
  out.set(u32(off), 10);
  out.set(u32(40), 14);
  out.set(u32(w), 18);
  out.set(u32(h), 22);
  out.set(u16(1), 26);
  out.set(u16(24), 28);
  out.set(u32(pixels), 34);
  for (let y = 0; y < h; y++) {
    const srcY = h - 1 - y;
    let d = off + y * stride;
    for (let x = 0; x < w; x++) {
      const i = (srcY * w + x) * 4;
      out[d++] = px.data[i + 2];
      out[d++] = px.data[i + 1];
      out[d++] = px.data[i];
    }
  }
  return out;
}

export function encodeIco(png: Uint8Array, width: number, height: number): Uint8Array {
  const w = Math.min(256, Math.max(1, width));
  const h = Math.min(256, Math.max(1, height));
  const out = new Uint8Array(22 + png.length);
  out.set(u16(0), 0);
  out.set(u16(1), 2);
  out.set(u16(1), 4);
  out[6] = w === 256 ? 0 : w;
  out[7] = h === 256 ? 0 : h;
  out[8] = 0;
  out[9] = 0;
  out.set(u16(1), 10);
  out.set(u16(32), 12);
  out.set(u32(png.length), 14);
  out.set(u32(22), 18);
  out.set(png, 22);
  return out;
}

/**
 * Reused by every still GIF (the convert page's size estimate runs often); dropped when the page leaves. Made on first
 * use, so modules that import this file only for BMP, ICO or blobFromBytes can drop the GIF encoder.
 */
let stillScratch: GifScratch | null = null;

export function releaseGifScratch(): void {
  stillScratch = null;
}

/**
 * A still GIF: one frame with its own median-cut palette (src/shared/gif.ts, the GIF maker's encoder). Transparent
 * pixels come out as their colour channels, as before; the page draws the picture over its canvas first.
 */
export function encodeGif(px: Pixels): Uint8Array {
  stillScratch ??= newScratch();
  const writer = new GifWriter({ width: px.width, height: px.height, loop: null }, stillScratch);
  writer.addFrame(px.data, { colors: 256, dither: false, delayMs: 0 });
  return writer.finish();
}
