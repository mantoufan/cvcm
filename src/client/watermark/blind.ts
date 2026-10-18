/**
 * Invisible ("blind") watermark: low-frequency quantization index modulation (QIM,
 * Chen & Wornell) with repetition coding and a CRC, read without the original image.
 *
 * - Luma is resampled onto a fixed 384×384 grid, so marks survive resizing and
 *   aspect changes (screenshots, chat-app downscales). Crops and rotations are not survived.
 * - The grid is cut into 2304 blocks of 8×8. Each block's sin²-windowed mean luma
 *   (a matched filter, ≈ the block's low-frequency DCT energy) is quantized with step D.
 *   A 160-bit frame (magic, length, 16 bytes of UTF-8, CRC-16) repeats across shuffled
 *   blocks; decoding is a texture-weighted soft vote with a brightness/contrast search.
 * - Perceptual masking: flat or near-white blocks are left alone and, inside a block,
 *   the change follows texture, so plain paper and skin stay clean.
 * - Only a smooth luma residual is added back to the full-resolution pixels.
 *   Embedding is closed-loop: it re-measures and corrects until the frame decodes.
 */

export interface Pixels {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export interface BlindResult {
  text: string;
}

export const BLIND_MAX_BYTES = 16;

const CANON = 384;
/** Side of the grid marks live on; size a shared `spent` buffer as BLIND_GRID². */
export const BLIND_GRID = CANON;
const P = 8;
const GRID = CANON / P;
const BLOCKS = GRID * GRID;
const D = 8;
/** Blocks flatter than this (luma std-dev) are not marked; decoding down-weights them. */
const FLAT = 2.5;
/** Luma at and above which pixels count as blank paper and are never changed. */
const PAPER = 245;
/** Largest luma change per canonical pixel per round, and summed over one embed call. */
const MAX_STEP = 6;
const MAX_TOTAL = 20;
const MAGIC = 0xc7;
const FRAME_BITS = 8 + 8 + BLIND_MAX_BYTES * 8 + 16;

// ---------- payload framing ----------

export function clipUtf8(text: string, max = BLIND_MAX_BYTES): string {
  const enc = new TextEncoder();
  let out = "";
  for (const ch of text) {
    if (enc.encode(out + ch).length > max) break;
    out += ch;
  }
  return out;
}

function crc16(bytes: Uint8Array): number {
  let crc = 0xffff;
  for (const b of bytes) {
    crc ^= b << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc;
}

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const WHITEN = (() => {
  const r = rng(0x63766d01);
  return Uint8Array.from({ length: FRAME_BITS }, () => (r() < 0.5 ? 1 : 0));
})();

/** Block index → frame bit index, spread so local damage hits many different bits. */
const BIT_OF_BLOCK = (() => {
  const perm = Int32Array.from({ length: BLOCKS }, (_, i) => i);
  const r = rng(0x63766d02);
  for (let i = BLOCKS - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  return perm.map((p) => p % FRAME_BITS);
})();

function frameBits(text: string): Uint8Array {
  const data = new TextEncoder().encode(clipUtf8(text));
  const head = new Uint8Array(2 + BLIND_MAX_BYTES);
  head[0] = MAGIC;
  head[1] = data.length;
  head.set(data, 2);
  const crc = crc16(head);
  const bytes = new Uint8Array(head.length + 2);
  bytes.set(head);
  bytes[head.length] = crc >> 8;
  bytes[head.length + 1] = crc & 0xff;
  const bits = new Uint8Array(FRAME_BITS);
  for (let i = 0; i < FRAME_BITS; i++) bits[i] = ((bytes[i >> 3] >> (7 - (i & 7))) & 1) ^ WHITEN[i];
  return bits;
}

function parseFrame(bits: Uint8Array): string | null {
  const bytes = new Uint8Array(FRAME_BITS / 8);
  for (let i = 0; i < FRAME_BITS; i++) bytes[i >> 3] |= (bits[i] ^ WHITEN[i]) << (7 - (i & 7));
  const head = bytes.subarray(0, 2 + BLIND_MAX_BYTES);
  if (head[0] !== MAGIC || head[1] > BLIND_MAX_BYTES) return null;
  const crc = (bytes[head.length] << 8) | bytes[head.length + 1];
  if (crc !== crc16(head)) return null;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(head.subarray(2, 2 + head[1]));
  } catch {
    return null;
  }
}

// ---------- resampling (area when shrinking, bilinear when enlarging) ----------

type Taps = { start: Int32Array; idx: Int32Array; w: Float32Array };

function taps(src: number, dst: number): Taps {
  const start = new Int32Array(dst + 1);
  const idx: number[] = [];
  const w: number[] = [];
  const push = (i: number, weight: number) => {
    idx.push(Math.min(src - 1, Math.max(0, i)));
    w.push(weight);
  };
  for (let o = 0; o < dst; o++) {
    start[o] = idx.length;
    if (dst <= src) {
      const scale = src / dst;
      const lo = o * scale;
      const hi = lo + scale;
      for (let i = Math.floor(lo); i < Math.ceil(hi); i++) {
        const cover = Math.min(hi, i + 1) - Math.max(lo, i);
        if (cover > 0) push(i, cover / scale);
      }
    } else {
      const x = ((o + 0.5) * src) / dst - 0.5;
      const i0 = Math.floor(x);
      const f = x - i0;
      push(i0, 1 - f);
      push(i0 + 1, f);
    }
  }
  start[dst] = idx.length;
  return { start, idx: Int32Array.from(idx), w: Float32Array.from(w) };
}

/** Luma as seen flattened onto white (how chat apps show a transparent PNG). */
function luma(d: Uint8ClampedArray, i: number): number {
  const y = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
  const a = d[i + 3];
  return a === 255 ? y : (y * a + 255 * (255 - a)) / 255;
}

/** Luma of the whole image on the CANON×CANON grid, row-streamed to keep memory flat. */
function canonical(px: Pixels): Float32Array {
  const { data, width, height } = px;
  const hx = taps(width, CANON);
  const vy = taps(height, CANON);
  const rows = new Float32Array(height * CANON);
  const row = new Float32Array(width);
  for (let y = 0; y < height; y++) {
    const base = y * width * 4;
    for (let x = 0; x < width; x++) row[x] = luma(data, base + x * 4);
    const out = y * CANON;
    for (let o = 0; o < CANON; o++) {
      let s = 0;
      for (let k = hx.start[o]; k < hx.start[o + 1]; k++) s += row[hx.idx[k]] * hx.w[k];
      rows[out + o] = s;
    }
  }
  const canon = new Float32Array(CANON * CANON);
  for (let o = 0; o < CANON; o++) {
    const out = o * CANON;
    for (let k = vy.start[o]; k < vy.start[o + 1]; k++) {
      const src = vy.idx[k] * CANON;
      const wk = vy.w[k];
      for (let x = 0; x < CANON; x++) canon[out + x] += rows[src + x] * wk;
    }
  }
  return canon;
}

/** Spread a CANON×CANON luma residual over the full image (added equally to R, G, B), sparing paper white. */
function applyResidual(px: Pixels, res: Float32Array): void {
  const { data, width, height } = px;
  const vy = taps(CANON, height);
  const hx = taps(CANON, width);
  const line = new Float32Array(CANON);
  for (let y = 0; y < height; y++) {
    line.fill(0);
    for (let k = vy.start[y]; k < vy.start[y + 1]; k++) {
      const src = vy.idx[k] * CANON;
      const wk = vy.w[k];
      for (let x = 0; x < CANON; x++) line[x] += res[src + x] * wk;
    }
    const base = y * width * 4;
    for (let x = 0; x < width; x++) {
      let r = 0;
      for (let k = hx.start[x]; k < hx.start[x + 1]; k++) r += line[hx.idx[k]] * hx.w[k];
      if (r > -0.05 && r < 0.05) continue;
      const i = base + x * 4;
      // Transparent pixels lose RGB to premultiplication; leave them alone.
      if (data[i + 3] !== 255) continue;
      // Full-resolution paper gate: one canonical pixel spans several real ones, and the
      // white ones between ink strokes must stay white.
      const paper = (PAPER - luma(data, i)) / 15;
      if (paper <= 0) continue;
      if (paper < 1) r *= paper;
      data[i] = data[i] + r;
      data[i + 1] = data[i + 1] + r;
      data[i + 2] = data[i + 2] + r;
    }
  }
}

// ---------- smooth block statistic ----------

/** sin² taper: ~0 at block edges, so neighbouring blocks never meet at a hard step. */
const WIN = Float64Array.from({ length: P }, (_, i) => Math.sin((Math.PI * (i + 0.5)) / P) ** 2);
const WSUM = WIN.reduce((n, w) => n + w, 0) ** 2;

/** Std-dev of canonical luma inside one block: how much texture can hide a change. */
function blockActivity(canon: Float32Array, bx: number, by: number): number {
  let s = 0;
  let s2 = 0;
  for (let r = 0; r < P; r++) {
    const row = (by * P + r) * CANON + bx * P;
    for (let c = 0; c < P; c++) {
      const v = canon[row + c];
      s += v;
      s2 += v * v;
    }
  }
  const n = P * P;
  return Math.sqrt(Math.max(0, s2 / n - (s / n) ** 2));
}

/**
 * Per-pixel masking weight on the canonical grid (0.1 flat … 1 textured): local gradient,
 * box-blurred so the weight itself never draws an edge. Paper-white pixels get 0: a few
 * levels of grey on white paper is the one place the mark would show.
 */
function textureMask(canon: Float32Array): Float32Array {
  const g = new Float32Array(CANON * CANON);
  for (let y = 0; y < CANON; y++)
    for (let x = 0; x < CANON; x++) {
      const i = y * CANON + x;
      const dx = canon[y * CANON + Math.min(CANON - 1, x + 1)] - canon[y * CANON + Math.max(0, x - 1)];
      const dy = canon[Math.min(CANON - 1, y + 1) * CANON + x] - canon[Math.max(0, y - 1) * CANON + x];
      g[i] = Math.hypot(dx, dy) / 2;
    }
  const m = new Float32Array(CANON * CANON);
  for (let y = 0; y < CANON; y++)
    for (let x = 0; x < CANON; x++) {
      let s = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const yy = Math.min(CANON - 1, Math.max(0, y + dy));
          const xx = Math.min(CANON - 1, Math.max(0, x + dx));
          s += g[yy * CANON + xx];
        }
      const paper = Math.min(1, Math.max(0, (PAPER - canon[y * CANON + x]) / 15));
      m[y * CANON + x] = Math.min(1, Math.max(0.1, s / 9 / 3)) * paper;
    }
  return m;
}

/** Window-weighted mean luma of one block (matched filter for the bump below). */
function blockStat(canon: Float32Array, bx: number, by: number): number {
  let s = 0;
  for (let r = 0; r < P; r++) {
    const row = (by * P + r) * CANON + bx * P;
    for (let c = 0; c < P; c++) s += canon[row + c] * WIN[r] * WIN[c];
  }
  return s / WSUM;
}

function phase(s: number): number {
  return (((s % D) + D) % D) / D;
}

/** +1 = bit 1, −1 = bit 0. */
function soft(s: number): number {
  return -Math.cos(2 * Math.PI * (phase(s) - 0.25));
}

// ---------- public API ----------

export interface EmbedOptions {
  /** Closed-loop rounds (default 4). */
  rounds?: number;
  /** Correct against this re-decoded lossy copy (JPEG / WebP) on the first round; any size. */
  measure?: Pixels;
  /** Per-pixel change already spent (BLIND_GRID² floats); share it across calls so MAX_TOTAL holds. */
  spent?: Float32Array;
  /** Decode the result and report success (default true). */
  verify?: boolean;
}

/**
 * Embed `text` (≤ 16 UTF-8 bytes) into `px` in place.
 * Returns true when the result decodes back to `text` (always false with `verify` off).
 */
export function embedBlind(px: Pixels, text: string, opts: EmbedOptions = {}): boolean {
  const { rounds = 4, measure, verify = true } = opts;
  const bits = frameBits(text);
  const want = clipUtf8(text);
  const spent = opts.spent ?? new Float32Array(CANON * CANON);
  for (let round = 0; round < rounds; round++) {
    const canon = canonical(round === 0 && measure ? measure : px);
    const mask = textureMask(canon);
    const res = new Float32Array(CANON * CANON);
    let moved = 0;
    for (let i = 0; i < BLOCKS; i++) {
      const bx = i % GRID;
      const by = (i / GRID) | 0;
      // Texture masking: flat blocks stay untouched (a change there is visible); white paper is masked per pixel.
      if (blockActivity(canon, bx, by) < FLAT) continue;
      const stat = blockStat(canon, bx, by);
      const bit = bits[BIT_OF_BLOCK[i]];
      const off = bit ? 0.75 * D : 0.25 * D;
      // Already well inside the right cell: leave it alone.
      if (Math.abs(phase(stat) * D - off) < D * 0.08) continue;
      let target = Math.round((stat - off) / D) * D + off;
      if (target < 0) target += D;
      // Bright blocks cannot get much brighter; take the cell below. (Lower thresholds force
      // whole-cell steps on light photos and cost ~2 dB; the few blocks between PAPER and 250
      // that cannot converge just cast a wrong vote, which the repetition absorbs.)
      if (target > stat && target > 250 && target - D >= 0) target -= D;
      // Shape the bump by the mask: the change lands on texture, not on flat skin or paper.
      let gain = 0;
      for (let r = 0; r < P; r++) {
        const row = (by * P + r) * CANON + bx * P;
        for (let c = 0; c < P; c++) gain += WIN[r] * WIN[c] * WIN[r] * WIN[c] * mask[row + c];
      }
      // Nothing here can carry the change (e.g. a text block on white paper with no ink pixels).
      if (gain < 1e-3) continue;
      const amp = (target - stat) / (gain / WSUM);
      for (let r = 0; r < P; r++) {
        const row = (by * P + r) * CANON + bx * P;
        for (let c = 0; c < P; c++) {
          const j = row + c;
          const d = Math.max(-MAX_STEP, Math.min(MAX_STEP, amp * WIN[r] * WIN[c] * mask[j]));
          // Rounds keep pushing pixels that undershoot (e.g. ink next to paper); cap the sum.
          const next = Math.max(-MAX_TOTAL, Math.min(MAX_TOTAL, spent[j] + d));
          res[j] += next - spent[j];
          spent[j] = next;
        }
      }
      moved++;
    }
    if (moved === 0) break;
    applyResidual(px, res);
  }
  return verify && decodeBlind(px)?.text === want;
}

function vote(
  stats: Float64Array,
  weights: Float64Array,
  total: number,
  gain: number,
  shift: number,
): { bits: Uint8Array; score: number } {
  const votes = new Float64Array(FRAME_BITS);
  for (let i = 0; i < BLOCKS; i++) votes[BIT_OF_BLOCK[i]] += weights[i] * soft(stats[i] * gain + shift);
  const bits = new Uint8Array(FRAME_BITS);
  let score = 0;
  for (let k = 0; k < FRAME_BITS; k++) {
    bits[k] = votes[k] > 0 ? 1 : 0;
    score += Math.abs(votes[k]);
  }
  return { bits, score: score / Math.max(1, total) };
}

/**
 * Read an invisible mark, or null when none (or too damaged).
 * Brightness / contrast edits move every block's statistic by s·g + c, so when the
 * plain read fails we scan (g, c), rank by vote agreement and CRC-check the best few.
 */
export function decodeBlind(px: Pixels): BlindResult | null {
  if (px.width < 16 || px.height < 16) return null;
  const text = readCanon(canonical(px));
  return text === null ? null : { text };
}

function readCanon(canon: Float32Array): string | null {
  const stats = new Float64Array(BLOCKS);
  const weights = new Float64Array(BLOCKS);
  for (let i = 0; i < BLOCKS; i++) {
    const bx = i % GRID;
    const by = (i / GRID) | 0;
    stats[i] = blockStat(canon, bx, by);
    weights[i] = Math.min(1, Math.max(0.05, (blockActivity(canon, bx, by) - FLAT / 2) / FLAT));
  }
  let total = 0;
  for (let i = 0; i < BLOCKS; i++) total += weights[i];
  const plain = vote(stats, weights, total, 1, 0);
  const direct = parseFrame(plain.bits);
  if (direct !== null) return direct;
  const ranked: { gain: number; shift: number; score: number }[] = [];
  for (let g = 0; g <= 60; g++) {
    // 1/gain from 0.85 to 1.15 undoes a contrast change of about ±15 %.
    // A 0.005 step is off by at most 0.0025 × 255 ≈ 0.6 levels, well inside a D/4 margin.
    const gain = 0.85 + g * 0.005;
    for (let c = 0; c < 16; c++) {
      const shift = (c * D) / 16;
      ranked.push({ gain, shift, score: vote(stats, weights, total, gain, shift).score });
    }
  }
  ranked.sort((a, b) => b.score - a.score);
  for (const cand of ranked.slice(0, 6)) {
    const r = vote(stats, weights, total, cand.gain, cand.shift);
    const text = parseFrame(r.bits);
    if (text !== null) return text;
  }
  return null;
}
