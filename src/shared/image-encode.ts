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

function quantIndex(r: number, g: number, b: number): number {
  return ((r >> 5) << 5) | ((g >> 5) << 2) | (b >> 6);
}

export function encodeGif(px: Pixels): Uint8Array {
  const w = px.width;
  const h = px.height;
  const palette = new Uint8Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    palette[i * 3] = ((i >> 5) & 7) * 36;
    palette[i * 3 + 1] = ((i >> 2) & 7) * 36;
    palette[i * 3 + 2] = (i & 3) * 85;
  }
  const index = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const o = i * 4;
    index[i] = quantIndex(px.data[o], px.data[o + 1], px.data[o + 2]);
  }
  const lzw = lzwGif(index, 8);
  const out = new Uint8Array(13 + 768 + 10 + lzw.length + 1);
  out.set([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, w & 255, w >> 8, h & 255, h >> 8, 0xf7, 0, 0]);
  out.set(palette, 13);
  const img = 13 + 768;
  out[img] = 0x2c;
  out[img + 5] = w & 255;
  out[img + 6] = w >> 8;
  out[img + 7] = h & 255;
  out[img + 8] = h >> 8;
  out.set(lzw, img + 10);
  out[out.length - 1] = 0x3b;
  return out;
}

function lzwGif(index: Uint8Array, minSize: number): Uint8Array {
  const clear = 1 << minSize;
  const eoi = clear + 1;
  const bytes: number[] = [minSize];
  let buf = 0;
  let bits = 0;
  let codeSize = minSize + 1;
  let next = eoi + 1;
  const dict = new Map<string, number>();
  const flush = (code: number, size: number) => {
    buf |= code << bits;
    bits += size;
    while (bits >= 8) {
      bytes.push(buf & 255);
      buf >>= 8;
      bits -= 8;
    }
  };
  const reset = () => {
    dict.clear();
    codeSize = minSize + 1;
    next = eoi + 1;
  };
  reset();
  flush(clear, codeSize);
  let w = String(index[0]);
  for (let i = 1; i < index.length; i++) {
    const k = String(index[i]);
    const wk = `${w},${k}`;
    if (dict.has(wk)) {
      w = wk;
      continue;
    }
    const code = w.includes(",") ? dict.get(w)! : Number(w);
    flush(code, codeSize);
    if (next < 4096) {
      dict.set(wk, next++);
      if (next === 1 << codeSize && codeSize < 12) codeSize++;
    } else {
      flush(clear, codeSize);
      reset();
    }
    w = k;
  }
  flush(w.includes(",") ? dict.get(w)! : Number(w), codeSize);
  flush(eoi, codeSize);
  if (bits) bytes.push(buf & 255);
  const out: number[] = [];
  for (let i = 1; i < bytes.length; i += 255) {
    const chunk = bytes.slice(i, i + 255);
    out.push(chunk.length, ...chunk);
  }
  out.push(0);
  return new Uint8Array([bytes[0], ...out]);
}
