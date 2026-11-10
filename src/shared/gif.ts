/**
 * Animated GIF encoder for the GIF maker: a median-cut palette per frame, optional Floyd–Steinberg dithering, and
 * GIF LZW with 255-byte sub-blocks. Frames are opaque RGBA (the page draws them over a background colour first).
 */

export type GifOptions = {
  width: number;
  height: number;
  /** null plays once (no loop block); 0 loops forever; n repeats n more times after the first play. */
  loop: number | null;
};

export type FrameOptions = {
  /** Palette size, 2–256. */
  colors: number;
  dither: boolean;
  /** Display time; GIF stores hundredths of a second and browsers slow anything under 2 to 10, so 20 ms is the floor. */
  delayMs: number;
};

/** Hundredths of a second for a delay, never under 2. */
export function delayCs(ms: number): number {
  return Math.max(2, Math.min(65535, Math.round(ms / 10)));
}

/** Growable byte buffer. */
class Bytes {
  buf = new Uint8Array(1 << 16);
  length = 0;
  push(...bytes: number[]): void {
    this.ensure(bytes.length);
    for (const b of bytes) this.buf[this.length++] = b;
  }
  byte(b: number): void {
    if (this.length === this.buf.length) this.ensure(1);
    this.buf[this.length++] = b;
  }
  word(n: number): void {
    this.byte(n & 255);
    this.byte((n >> 8) & 255);
  }
  bytes(data: Uint8Array): void {
    this.ensure(data.length);
    this.buf.set(data, this.length);
    this.length += data.length;
  }
  ensure(extra: number): void {
    if (this.length + extra <= this.buf.length) return;
    let size = this.buf.length * 2;
    while (size < this.length + extra) size *= 2;
    const next = new Uint8Array(size);
    next.set(this.buf.subarray(0, this.length));
    this.buf = next;
  }
  result(): Uint8Array {
    return this.buf.slice(0, this.length);
  }
}

/**
 * Median cut over a 5-bit-per-channel histogram: boxes are split at the pixel-count median of their longest channel,
 * the busiest wide box first, and each colour is the true mean of the pixels in its box. Returns RGB triples.
 */
export function quantize(rgba: Uint8ClampedArray, colors: number): Uint8Array {
  const want = Math.max(2, Math.min(256, Math.round(colors)));
  const count = new Uint32Array(32768);
  const sumR = new Float64Array(32768);
  const sumG = new Float64Array(32768);
  const sumB = new Float64Array(32768);
  for (let i = 0; i < rgba.length; i += 4) {
    const r = rgba[i]!;
    const g = rgba[i + 1]!;
    const b = rgba[i + 2]!;
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    count[key]!++;
    sumR[key]! += r;
    sumG[key]! += g;
    sumB[key]! += b;
  }
  const bins: number[] = [];
  for (let k = 0; k < 32768; k++) if (count[k]) bins.push(k);
  if (bins.length === 0) return new Uint8Array(6);
  const chan = (k: number, c: number) => (c === 0 ? k >> 10 : c === 1 ? (k >> 5) & 31 : k & 31);
  type Box = { bins: number[]; pixels: number; channel: number; range: number };
  const measure = (list: number[]): Box => {
    let pixels = 0;
    const lo = [31, 31, 31];
    const hi = [0, 0, 0];
    for (const k of list) {
      pixels += count[k]!;
      for (let c = 0; c < 3; c++) {
        const v = chan(k, c);
        if (v < lo[c]!) lo[c] = v;
        if (v > hi[c]!) hi[c] = v;
      }
    }
    // Green counts a little more and blue a little less, as the eye does.
    const spans = [(hi[0]! - lo[0]!) * 1.0, (hi[1]! - lo[1]!) * 1.2, (hi[2]! - lo[2]!) * 0.8];
    const channel = spans.indexOf(Math.max(...spans));
    return { bins: list, pixels, channel, range: spans[channel]! };
  };
  const boxes: Box[] = [measure(bins)];
  while (boxes.length < want) {
    let best = -1;
    let score = 0;
    boxes.forEach((b, i) => {
      const s = b.bins.length > 1 ? b.pixels * (b.range + 1) : 0;
      if (s > score) {
        score = s;
        best = i;
      }
    });
    if (best < 0) break;
    const box = boxes[best]!;
    const sorted = [...box.bins].sort((a, b) => chan(a, box.channel) - chan(b, box.channel));
    let acc = 0;
    let cut = 1;
    for (let i = 0; i < sorted.length - 1; i++) {
      acc += count[sorted[i]!]!;
      cut = i + 1;
      if (acc * 2 >= box.pixels) break;
    }
    boxes.splice(best, 1, measure(sorted.slice(0, cut)), measure(sorted.slice(cut)));
  }
  const palette = new Uint8Array(boxes.length * 3);
  boxes.forEach((b, i) => {
    let r = 0;
    let g = 0;
    let bl = 0;
    for (const k of b.bins) {
      r += sumR[k]!;
      g += sumG[k]!;
      bl += sumB[k]!;
    }
    palette[i * 3] = Math.round(r / b.pixels);
    palette[i * 3 + 1] = Math.round(g / b.pixels);
    palette[i * 3 + 2] = Math.round(bl / b.pixels);
  });
  return palette;
}

/** Palette index for every pixel; with `dither`, Floyd–Steinberg spreads each pixel's error to its neighbours. */
export function mapPixels(rgba: Uint8ClampedArray, width: number, height: number, palette: Uint8Array, dither: boolean): Uint8Array {
  const n = palette.length / 3;
  // Nearest colour per 6-bit-per-channel cell, found on first use.
  const cache = new Int16Array(262144).fill(-1);
  const nearest = (r: number, g: number, b: number): number => {
    const key = ((r >> 2) << 12) | ((g >> 2) << 6) | (b >> 2);
    const hit = cache[key]!;
    if (hit >= 0) return hit;
    const cr = (r & ~3) + 2;
    const cg = (g & ~3) + 2;
    const cb = (b & ~3) + 2;
    let best = 0;
    let dist = Infinity;
    for (let i = 0; i < n; i++) {
      const dr = palette[i * 3]! - cr;
      const dg = palette[i * 3 + 1]! - cg;
      const db = palette[i * 3 + 2]! - cb;
      const d = 2 * dr * dr + 4 * dg * dg + 3 * db * db;
      if (d < dist) {
        dist = d;
        best = i;
      }
    }
    cache[key] = best;
    return best;
  };
  const out = new Uint8Array(width * height);
  if (!dither) {
    for (let p = 0, i = 0; p < out.length; p++, i += 4) out[p] = nearest(rgba[i]!, rgba[i + 1]!, rgba[i + 2]!);
    return out;
  }
  // Error carried into this row and the next, per channel.
  let cur = new Float32Array((width + 2) * 3);
  let next = new Float32Array((width + 2) * 3);
  const clamp = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const e = (x + 1) * 3;
      const r = clamp(rgba[i]! + cur[e]!);
      const g = clamp(rgba[i + 1]! + cur[e + 1]!);
      const b = clamp(rgba[i + 2]! + cur[e + 2]!);
      const idx = nearest(r, g, b);
      out[y * width + x] = idx;
      const er = r - palette[idx * 3]!;
      const eg = g - palette[idx * 3 + 1]!;
      const eb = b - palette[idx * 3 + 2]!;
      const spread = (arr: Float32Array, at: number, w: number) => {
        arr[at]! += er * w;
        arr[at + 1]! += eg * w;
        arr[at + 2]! += eb * w;
      };
      spread(cur, e + 3, 7 / 16);
      spread(next, e - 3, 3 / 16);
      spread(next, e, 5 / 16);
      spread(next, e + 3, 1 / 16);
    }
    [cur, next] = [next, cur];
    next.fill(0);
  }
  return out;
}

/** GIF LZW for one frame's indices, as the code-size byte, 255-byte sub-blocks and the empty block. */
export function lzw(indices: Uint8Array, minCodeSize: number): Uint8Array {
  const out = new Bytes();
  writeLzw(indices, minCodeSize, out);
  return out.result();
}

function writeLzw(indices: Uint8Array, minCodeSize: number, out: Bytes): void {
  const clear = 1 << minCodeSize;
  const eoi = clear + 1;
  let codeSize = minCodeSize + 1;
  let next = eoi + 1;
  // Code for prefix code (≤ 4095) followed by index (≤ 255).
  const table = new Int16Array(4096 << 8).fill(-1);
  const block = new Uint8Array(255);
  let blockLen = 0;
  let acc = 0;
  let bits = 0;
  out.byte(minCodeSize);
  const flushBlock = () => {
    out.byte(blockLen);
    out.bytes(block.subarray(0, blockLen));
    blockLen = 0;
  };
  const emit = (code: number) => {
    acc |= code << bits;
    bits += codeSize;
    while (bits >= 8) {
      block[blockLen++] = acc & 255;
      if (blockLen === 255) flushBlock();
      acc >>>= 8;
      bits -= 8;
    }
  };
  emit(clear);
  if (indices.length === 0) {
    emit(eoi);
  } else {
    let prefix = indices[0]!;
    for (let i = 1; i < indices.length; i++) {
      const k = indices[i]!;
      const key = (prefix << 8) | k;
      const code = table[key]!;
      if (code >= 0) {
        prefix = code;
        continue;
      }
      emit(prefix);
      if (next === 4096) {
        // Table full: start over.
        emit(clear);
        table.fill(-1);
        codeSize = minCodeSize + 1;
        next = eoi + 1;
      } else {
        // Grow the code size when the next entry would not fit (the decoder grows at the same moment).
        if (next >= 1 << codeSize) codeSize++;
        table[key] = next++;
      }
      prefix = k;
    }
    emit(prefix);
    emit(eoi);
  }
  if (bits > 0) {
    block[blockLen++] = acc & 255;
    if (blockLen === 255) flushBlock();
  }
  if (blockLen > 0) flushBlock();
  out.byte(0);
}

/** Writes a GIF one frame at a time, so the page can yield between frames. */
export class GifWriter {
  private out = new Bytes();
  private frames = 0;
  constructor(private readonly opts: GifOptions) {
    const { width, height, loop } = opts;
    this.out.push(0x47, 0x49, 0x46, 0x38, 0x39, 0x61);
    this.out.word(width);
    this.out.word(height);
    // No global colour table: every frame carries its own palette.
    this.out.push(0, 0, 0);
    if (loop !== null) {
      this.out.push(0x21, 0xff, 0x0b, ...[..."NETSCAPE2.0"].map((c) => c.charCodeAt(0)), 0x03, 0x01);
      this.out.word(Math.max(0, Math.min(65535, Math.round(loop))));
      this.out.byte(0);
    }
  }

  /** Adds one opaque RGBA frame of the GIF's size. */
  addFrame(rgba: Uint8ClampedArray, frame: FrameOptions): void {
    const { width, height } = this.opts;
    if (rgba.length !== width * height * 4) throw new Error("frame size");
    const palette = quantize(rgba, frame.colors);
    const indices = mapPixels(rgba, width, height, palette, frame.dither);
    // The colour table holds 2^bits entries; unused ones stay black.
    let bits = 1;
    while (1 << bits < palette.length / 3) bits++;
    // Graphic control: keep the frame in place (disposal 1), no transparency.
    this.out.push(0x21, 0xf9, 0x04, 0x04);
    this.out.word(delayCs(frame.delayMs));
    this.out.push(0, 0);
    this.out.byte(0x2c);
    this.out.word(0);
    this.out.word(0);
    this.out.word(width);
    this.out.word(height);
    this.out.byte(0x80 | (bits - 1));
    const table = new Uint8Array((1 << bits) * 3);
    table.set(palette);
    this.out.bytes(table);
    writeLzw(indices, Math.max(2, bits), this.out);
    this.frames++;
  }

  get frameCount(): number {
    return this.frames;
  }

  finish(): Uint8Array {
    this.out.byte(0x3b);
    return this.out.result();
  }
}
