/**
 * Invisible ("blind") watermark: low-frequency quantization index modulation (QIM,
 * Chen & Wornell) with repetition coding and a CRC, read without the original image.
 *
 * - Luma is resampled onto a fixed 384×384 grid, so marks survive resizing and
 *   aspect changes (screenshots, chat-app downscales). Crops and rotations are not survived.
 * - The grid is cut into 2304 blocks of 8×8. Each block's sin²-windowed mean luma
 *   (a matched filter, ≈ the block's low-frequency DCT energy) is quantized with step D.
 *   A variable-length frame (marker, encoding/length, date, up to 40 bytes of text packed with a
 *   watermark-phrase dictionary, CRC-32)
 *   repeats across shuffled blocks, so short text repeats more; decoding is a texture-weighted
 *   soft vote over every frame size, with a brightness/contrast search.
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

/** What a mark carries. "cv.cm" is implied by the frame marker itself. */
export interface BlindPayload {
  text: string;
  /** Export date, YYYY-MM-DD. */
  date: string;
}


/** Encoded text bytes. Preset phrases pack to one byte each; longer text means fewer repeats. */
export const BLIND_MAX_BYTES = 40;

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
/** v2 frame: marker, encoding + length, date, text, CRC-32. Its length follows the text. */
const MAGIC = 0xc8;
const HEAD = 4;
const FRAME_MAX_BITS = (HEAD + BLIND_MAX_BYTES + 4) * 8;
/** First release (2026-10-18): fixed 160-bit frame, ≤ 16 UTF-8 bytes, CRC-16. Read-only. */
const LEGACY_MAGIC = 0xc7;
const LEGACY_BITS = 160;
const EPOCH = Date.UTC(2020, 0, 1);

// ---------- payload framing ----------

/**
 * Phrase dictionary for the packed encoding: the identity presets of all 8 locales plus
 * common purposes and characters. Each entry costs one byte. Order is part of the format:
 * only ever append (126 slots, 0x80–0xFD).
 */
const DICT = [
  "仅供", "办理使用", "他用无效", "使用", "办理", "仅限", "复印件", "再次复印无效", "专用", "有效", "无效",
  "银行", "开户", "租房", "入职", "签证", "贷款", "申请", "报名", "身份证", "护照", "驾驶证", "营业执照",
  "户口本", "学生证", "房产证", "社保", "公积金", "公司", "学校", "医院", "酒店", "快递", "实名", "认证",
  "审核", "备案", "业务", "中国", "招商", "工商", "建设", "农业", "交通", "邮政", "微信", "支付宝",
  "僅供", "辦理使用", "他用無效", "僅限", "影本", "專用", "銀行", "開戶", "申請", "身分證", "護照", "駕照",
  "関係者限り", "目的外使用不可", "提出用", "以外", "本人確認",
  "지정 용도 한정", "다른 용도 무효", "제출용", "용도", "무효",
  "CHỈ DÙNG CHO ", "DÙNG KHÁC KHÔNG HỢP LỆ", "[TỔ CHỨC]",
  "HANYA UNTUK ", "TIDAK BERLAKU UNTUK HAL LAIN",
  "SOLO PARA ", "NO VÁLIDO PARA OTRO USO",
  "FOR ", "USE ONLY", "NOT VALID OTHERWISE", "[ORG]", "ONLY", "COPY",
  "的", "于", "给", "在", "与", "和", "用", "供", "仅", "理", "办", "效", "他", "无", "年", "月", "日",
  "号", "证", "行", "户", "件", "印", "复", "本", "限", "专", "司", "公", "学", "校", "部", "局", "处",
  "科", "所", "院", "店", "市", "省", "区", "县",
];
const DICT_BASE = 0x80;
const ESCAPE = 0xfe;
/** Longest entries first, so greedy matching takes "办理使用" before "办理". */
const DICT_ORDER = DICT.map((w, i) => ({ w, i })).sort((a, b) => b.w.length - a.w.length);

type Token = { text: string; bytes: number[] };

/** Packed tokens: ASCII as itself, dictionary phrases as one byte, anything else as 0xFE + UTF-16. */
function packTokens(s: string): Token[] {
  const out: Token[] = [];
  for (let i = 0; i < s.length; ) {
    const hit = DICT_ORDER.find(({ w }) => s.startsWith(w, i));
    if (hit) {
      out.push({ text: hit.w, bytes: [DICT_BASE + hit.i] });
      i += hit.w.length;
      continue;
    }
    const c = s.charCodeAt(i);
    out.push({ text: s[i], bytes: c < 0x80 ? [c] : [ESCAPE, c >> 8, c & 0xff] });
    i += 1;
  }
  return out;
}

function unpackText(b: Uint8Array): string | null {
  let s = "";
  for (let i = 0; i < b.length; ) {
    const v = b[i];
    if (v < 0x80) {
      s += String.fromCharCode(v);
      i += 1;
    } else if (v === ESCAPE) {
      if (i + 2 >= b.length) return null;
      s += String.fromCharCode((b[i + 1] << 8) | b[i + 2]);
      i += 3;
    } else {
      const w = DICT[v - DICT_BASE];
      if (w === undefined) return null;
      s += w;
      i += 1;
    }
  }
  return s;
}

function utf16Units(ch: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < ch.length; i++) out.push(ch.charCodeAt(i) >> 8, ch.charCodeAt(i) & 0xff);
  return out;
}

/** Per-character tokens (code points stay whole). */
function charTokens(s: string, enc: (ch: string) => number[]): Token[] {
  return [...s].map((ch) => ({ text: ch, bytes: enc(ch) }));
}

const TOKENIZERS: ((s: string) => Token[])[] = [
  (s) => charTokens(s, (ch) => [...new TextEncoder().encode(ch)]),
  (s) => charTokens(s, utf16Units),
  packTokens,
];

/** Lone surrogates would not survive UTF-8 and would never verify; drop them. */
function wellFormed(text: string): string {
  return text.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "");
}

let lastEncoded: { input: string; out: { bytes: Uint8Array; mode: number; text: string } } | null = null;

/**
 * Text as stored: whichever of UTF-8 / UTF-16 / packed keeps the most text in the fewest bytes.
 * Cutting happens between tokens, so a phrase that packs to one byte is never split.
 */
function encodeText(input: string): { bytes: Uint8Array; mode: number; text: string } {
  if (lastEncoded?.input === input) return lastEncoded.out;
  const text = wellFormed(input);
  let best: { bytes: Uint8Array; mode: number; text: string } | null = null;
  TOKENIZERS.forEach((tokenize, mode) => {
    let kept = "";
    const bytes: number[] = [];
    for (const tok of tokenize(text)) {
      if (bytes.length + tok.bytes.length > BLIND_MAX_BYTES) break;
      kept += tok.text;
      bytes.push(...tok.bytes);
    }
    if (!best || kept.length > best.text.length || (kept.length === best.text.length && bytes.length < best.bytes.length)) {
      best = { bytes: Uint8Array.from(bytes), mode, text: kept };
    }
  });
  lastEncoded = { input, out: best! };
  return best!;
}

function decodeText(mode: number, data: Uint8Array): string | null {
  if (mode === 0) {
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(data);
    } catch {
      return null;
    }
  }
  if (mode === 1) {
    if (data.length % 2) return null;
    let s = "";
    for (let i = 0; i < data.length; i += 2) s += String.fromCharCode((data[i] << 8) | data[i + 1]);
    return s;
  }
  if (mode === 2) return unpackText(data);
  return null;
}

/** The part of `text` a mark can hold, and its size in bytes. */
export function fitBlindText(text: string): { text: string; bytes: number } {
  const e = encodeText(text);
  return { text: e.text, bytes: e.bytes.length };
}

function crc16(bytes: Uint8Array): number {
  let crc = 0xffff;
  for (const b of bytes) {
    crc ^= b << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc;
}

const CRC32 = Uint32Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC32[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
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
  return Uint8Array.from({ length: Math.max(FRAME_MAX_BITS, LEGACY_BITS) }, () => (r() < 0.5 ? 1 : 0));
})();

/** Shuffled block order; block i carries frame bit PERM[i] % frameBits, so short frames repeat more. */
const PERM = (() => {
  const perm = Int32Array.from({ length: BLOCKS }, (_, i) => i);
  const r = rng(0x63766d02);
  for (let i = BLOCKS - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  return perm;
})();

function toDay(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  const day = Math.round((Date.UTC(y, m - 1, d) - EPOCH) / 86_400_000);
  return Number.isFinite(day) ? Math.min(0xffff, Math.max(0, day)) : 0;
}

function fromDay(day: number): string {
  return new Date(EPOCH + day * 86_400_000).toISOString().slice(0, 10);
}

/** Normalized payload as it will read back (text clipped to fit). */
export function blindPayloadOf(text: string, date: string): BlindPayload {
  return { text: encodeText(text).text, date: fromDay(toDay(date)) };
}

function frameBits(p: BlindPayload): Uint8Array {
  const enc = encodeText(p.text);
  const day = toDay(p.date);
  const body = new Uint8Array(HEAD + enc.bytes.length);
  body[0] = MAGIC;
  // Byte 1: encoding in the top 2 bits, text length (≤ 63) below.
  body[1] = (enc.mode << 6) | enc.bytes.length;
  body[2] = day >> 8;
  body[3] = day & 0xff;
  body.set(enc.bytes, HEAD);
  const crc = crc32(body);
  const bytes = new Uint8Array(body.length + 4);
  bytes.set(body);
  bytes.set([crc >>> 24, (crc >>> 16) & 0xff, (crc >>> 8) & 0xff, crc & 0xff], body.length);
  const n = bytes.length * 8;
  const bits = new Uint8Array(n);
  for (let i = 0; i < n; i++) bits[i] = ((bytes[i >> 3] >> (7 - (i & 7))) & 1) ^ WHITEN[i];
  return bits;
}

function unwhiten(bits: Uint8Array): Uint8Array {
  const bytes = new Uint8Array(bits.length / 8);
  for (let i = 0; i < bits.length; i++) bytes[i >> 3] |= (bits[i] ^ WHITEN[i]) << (7 - (i & 7));
  return bytes;
}

function parseFrame(bits: Uint8Array): BlindPayload | null {
  const bytes = unwhiten(bits);
  const len = bytes[1] & 0x3f;
  if (bytes[0] !== MAGIC || bytes.length !== HEAD + len + 4) return null;
  const body = bytes.subarray(0, HEAD + len);
  const crc = ((bytes[HEAD + len] << 24) | (bytes[HEAD + len + 1] << 16) | (bytes[HEAD + len + 2] << 8) | bytes[HEAD + len + 3]) >>> 0;
  if (crc !== crc32(body)) return null;
  const text = decodeText(bytes[1] >> 6, body.subarray(HEAD));
  if (text === null) return null;
  return { text, date: fromDay((bytes[2] << 8) | bytes[3]) };
}

/** Marks from the first release: magic 0xc7, length, 16 bytes, CRC-16; no date field. */
function parseLegacy(bits: Uint8Array): BlindPayload | null {
  const bytes = unwhiten(bits);
  const head = bytes.subarray(0, 18);
  if (head[0] !== LEGACY_MAGIC || head[1] > 16) return null;
  if (((bytes[18] << 8) | bytes[19]) !== crc16(head)) return null;
  try {
    return { text: new TextDecoder("utf-8", { fatal: true }).decode(head.subarray(2, 2 + head[1])), date: "" };
  } catch {
    return null;
  }
}

/** Every frame size a reader must try, with its parsers (v2 length 12 and legacy share 160 bits). */
const FRAMES: { bits: number; parsers: ((bits: Uint8Array) => BlindPayload | null)[] }[] = (() => {
  const bySize = new Map<number, ((bits: Uint8Array) => BlindPayload | null)[]>();
  const add = (bits: number, parse: (bits: Uint8Array) => BlindPayload | null) =>
    bySize.set(bits, [...(bySize.get(bits) ?? []), parse]);
  for (let len = 0; len <= BLIND_MAX_BYTES; len++) add((HEAD + len + 4) * 8, parseFrame);
  add(LEGACY_BITS, parseLegacy);
  return [...bySize].map(([bits, parsers]) => ({ bits, parsers }));
})();

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
 * Embed `payload` into `px` in place (text clipped to BLIND_MAX_BYTES).
 * Returns true when the result decodes back to it (always false with `verify` off).
 */
export function embedBlind(px: Pixels, payload: BlindPayload, opts: EmbedOptions = {}): boolean {
  const { rounds = 4, measure, verify = true } = opts;
  const bits = frameBits(payload);
  const want = blindPayloadOf(payload.text, payload.date);
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
      const bit = bits[PERM[i] % bits.length];
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
  return verify && sameBlind(decodeBlind(px), want);
}

export function sameBlind(a: BlindPayload | null, b: BlindPayload): boolean {
  return a !== null && a.text === b.text && a.date === b.date;
}

/** Per-block soft bits for one brightness/contrast guess. */
function softs(stats: Float64Array, weights: Float64Array, gain: number, shift: number): Float64Array {
  const out = new Float64Array(BLOCKS);
  for (let i = 0; i < BLOCKS; i++) out[i] = weights[i] * soft(stats[i] * gain + shift);
  return out;
}

/** Try every frame size against one set of soft bits. */
function readSofts(sb: Float64Array): BlindPayload | null {
  const votes = new Float64Array(FRAME_MAX_BITS);
  for (const frame of FRAMES) {
    votes.fill(0, 0, frame.bits);
    for (let i = 0; i < BLOCKS; i++) votes[PERM[i] % frame.bits] += sb[i];
    const bits = new Uint8Array(frame.bits);
    for (let k = 0; k < frame.bits; k++) bits[k] = votes[k] > 0 ? 1 : 0;
    for (const parse of frame.parsers) {
      const found = parse(bits);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Read an invisible mark, or null when none (or too damaged).
 * Brightness / contrast edits move every block's statistic by s·g + c, so when the
 * plain read fails we scan (g, c), rank by how close blocks sit to lattice centres
 * (independent of the frame size), and CRC-check the best few.
 */
export function decodeBlind(px: Pixels): BlindPayload | null {
  if (px.width < 16 || px.height < 16) return null;
  return readCanon(canonical(px));
}

function readCanon(canon: Float32Array): BlindPayload | null {
  const stats = new Float64Array(BLOCKS);
  const weights = new Float64Array(BLOCKS);
  for (let i = 0; i < BLOCKS; i++) {
    const bx = i % GRID;
    const by = (i / GRID) | 0;
    stats[i] = blockStat(canon, bx, by);
    weights[i] = Math.min(1, Math.max(0.05, (blockActivity(canon, bx, by) - FLAT / 2) / FLAT));
  }
  const direct = readSofts(softs(stats, weights, 1, 0));
  if (direct) return direct;
  const ranked: { gain: number; shift: number; score: number }[] = [];
  for (let g = 0; g <= 60; g++) {
    // 1/gain from 0.85 to 1.15 undoes a contrast change of about ±15 %.
    // A 0.005 step is off by at most 0.0025 × 255 ≈ 0.6 levels, well inside a D/4 margin.
    const gain = 0.85 + g * 0.005;
    for (let c = 0; c < 16; c++) {
      const shift = (c * D) / 16;
      let score = 0;
      for (let i = 0; i < BLOCKS; i++) score += weights[i] * Math.abs(soft(stats[i] * gain + shift));
      ranked.push({ gain, shift, score });
    }
  }
  ranked.sort((a, b) => b.score - a.score);
  for (const cand of ranked.slice(0, 6)) {
    const found = readSofts(softs(stats, weights, cand.gain, cand.shift));
    if (found) return found;
  }
  return null;
}
