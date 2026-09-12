export type QrEcLevel = "L" | "M" | "Q" | "H";

const EC_INDEX: Record<QrEcLevel, number> = { L: 0, M: 1, Q: 2, H: 3 };

/** [ecPerBlock, g1Blocks, g1Data, g2Blocks, g2Data] for versions 1-20 × L/M/Q/H */
const ECC = [
  [[7, 1, 19, 0, 0], [10, 1, 16, 0, 0], [13, 1, 13, 0, 0], [17, 1, 9, 0, 0]],
  [[10, 1, 34, 0, 0], [16, 1, 28, 0, 0], [22, 1, 22, 0, 0], [28, 1, 16, 0, 0]],
  [[15, 1, 55, 0, 0], [26, 1, 44, 0, 0], [18, 2, 17, 0, 0], [22, 2, 13, 0, 0]],
  [[20, 1, 80, 0, 0], [18, 2, 32, 0, 0], [26, 2, 24, 0, 0], [16, 4, 9, 0, 0]],
  [[26, 1, 108, 0, 0], [24, 2, 43, 0, 0], [18, 2, 15, 2, 16], [22, 2, 11, 2, 12]],
  [[18, 2, 68, 0, 0], [16, 4, 27, 0, 0], [24, 4, 19, 0, 0], [28, 4, 15, 0, 0]],
  [[20, 2, 78, 0, 0], [18, 4, 31, 0, 0], [18, 2, 14, 4, 15], [26, 4, 13, 1, 14]],
  [[24, 2, 97, 0, 0], [22, 2, 38, 2, 39], [22, 4, 18, 2, 19], [26, 4, 14, 2, 15]],
  [[30, 2, 116, 0, 0], [22, 3, 36, 2, 37], [20, 4, 16, 4, 17], [24, 4, 12, 4, 13]],
  [[18, 2, 68, 2, 69], [26, 4, 43, 1, 44], [24, 6, 19, 2, 20], [28, 6, 15, 2, 16]],
  [[20, 4, 81, 0, 0], [30, 1, 50, 4, 51], [28, 4, 22, 4, 23], [24, 3, 12, 8, 13]],
  [[24, 2, 92, 2, 93], [22, 6, 36, 2, 37], [26, 4, 20, 6, 21], [28, 7, 14, 4, 15]],
  [[26, 4, 107, 0, 0], [22, 8, 37, 1, 38], [24, 8, 20, 4, 21], [22, 12, 11, 4, 12]],
  [[30, 3, 115, 1, 116], [24, 4, 40, 5, 41], [20, 11, 16, 5, 17], [24, 11, 12, 5, 13]],
  [[22, 5, 87, 1, 88], [24, 5, 41, 5, 42], [30, 5, 24, 7, 25], [24, 11, 12, 7, 13]],
  [[24, 5, 98, 1, 99], [28, 7, 45, 3, 46], [24, 15, 19, 2, 20], [30, 3, 15, 13, 16]],
  [[28, 1, 107, 5, 108], [28, 10, 46, 1, 47], [28, 1, 22, 15, 23], [28, 2, 14, 17, 15]],
  [[30, 5, 120, 1, 121], [26, 9, 43, 4, 44], [28, 17, 22, 1, 23], [28, 2, 14, 19, 15]],
  [[28, 3, 113, 4, 114], [26, 3, 44, 11, 45], [26, 17, 21, 4, 22], [26, 9, 13, 16, 14]],
  [[28, 3, 107, 5, 108], [26, 3, 41, 13, 42], [30, 15, 24, 5, 25], [28, 15, 15, 10, 16]],
] as const;

const ALIGN = [
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
  [6, 30, 54],
  [6, 32, 58],
  [6, 34, 62],
  [6, 26, 46, 66],
  [6, 26, 48, 70],
  [6, 26, 50, 74],
  [6, 30, 54, 78],
  [6, 30, 56, 82],
  [6, 30, 58, 86],
  [6, 34, 62, 90],
];

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();

function gfMul(a: number, b: number): number {
  if (!a || !b) return 0;
  return EXP[LOG[a] + LOG[b]];
}

function rsEncode(data: Uint8Array, ecCount: number): Uint8Array {
  const gen = new Uint8Array(ecCount + 1);
  gen[0] = 1;
  for (let i = 0; i < ecCount; i++) {
    for (let j = i; j >= 0; j--) gen[j + 1] ^= gfMul(gen[j], EXP[i]);
  }
  const out = new Uint8Array(ecCount);
  for (const byte of data) {
    const factor = byte ^ out[0];
    out.copyWithin(0, 1);
    out[ecCount - 1] = 0;
    if (!factor) continue;
    for (let i = 0; i < ecCount; i++) out[i] ^= gfMul(gen[i + 1], factor);
  }
  return out;
}

function dataCapacity(version: number, ec: QrEcLevel): number {
  const spec = ECC[version - 1][EC_INDEX[ec]];
  return spec[1] * spec[2] + spec[3] * spec[4];
}

function countBits(version: number): number {
  return version <= 9 ? 8 : 16;
}

function chooseVersion(bytes: number, ec: QrEcLevel): number {
  for (let v = 1; v <= 20; v++) {
    const bits = 4 + countBits(v) + bytes * 8 + 4;
    if (Math.ceil(bits / 8) <= dataCapacity(v, ec)) return v;
  }
  throw new Error("qr-too-long");
}

function pushBits(into: number[], value: number, n: number): void {
  for (let i = n - 1; i >= 0; i--) into.push((value >>> i) & 1);
}

function encodeData(bytes: Uint8Array, version: number, ec: QrEcLevel): Uint8Array {
  const cap = dataCapacity(version, ec);
  const bits: number[] = [];
  pushBits(bits, 0b0100, 4);
  pushBits(bits, bytes.length, countBits(version));
  for (const b of bytes) pushBits(bits, b, 8);
  const maxBits = cap * 8;
  const term = Math.min(4, maxBits - bits.length);
  for (let i = 0; i < term; i++) bits.push(0);
  while (bits.length % 8) bits.push(0);
  const pad = [0xec, 0x11];
  let p = 0;
  while (bits.length < maxBits) pushBits(bits, pad[p++ % 2], 8);
  const data = new Uint8Array(cap);
  for (let i = 0; i < cap; i++) {
    let v = 0;
    for (let b = 0; b < 8; b++) v = (v << 1) | bits[i * 8 + b];
    data[i] = v;
  }
  return data;
}

function interleave(data: Uint8Array, version: number, ec: QrEcLevel): Uint8Array {
  const spec = ECC[version - 1][EC_INDEX[ec]];
  const ecPer = spec[0];
  const blocks: { data: Uint8Array; ec: Uint8Array }[] = [];
  let offset = 0;
  const add = (count: number, dataLen: number) => {
    for (let i = 0; i < count; i++) {
      const slice = data.subarray(offset, offset + dataLen);
      offset += dataLen;
      blocks.push({ data: slice, ec: rsEncode(slice, ecPer) });
    }
  };
  add(spec[1], spec[2]);
  add(spec[3], spec[4]);
  const maxData = Math.max(...blocks.map((b) => b.data.length));
  const out: number[] = [];
  for (let i = 0; i < maxData; i++) {
    for (const b of blocks) if (i < b.data.length) out.push(b.data[i]!);
  }
  for (let i = 0; i < ecPer; i++) {
    for (const b of blocks) out.push(b.ec[i]!);
  }
  return new Uint8Array(out);
}

function sizeOf(version: number): number {
  return 21 + 4 * (version - 1);
}

type Grid = { n: number; dark: Uint8Array; reserved: Uint8Array };

function idx(g: Grid, x: number, y: number): number {
  return y * g.n + x;
}

function setModule(g: Grid, x: number, y: number, dark: boolean, reserved = true): void {
  if (x < 0 || y < 0 || x >= g.n || y >= g.n) return;
  const i = idx(g, x, y);
  g.dark[i] = dark ? 1 : 0;
  if (reserved) g.reserved[i] = 1;
}

function finder(g: Grid, left: number, top: number): void {
  for (let y = -1; y <= 7; y++) {
    for (let x = -1; x <= 7; x++) {
      const xx = left + x;
      const yy = top + y;
      if (xx < 0 || yy < 0 || xx >= g.n || yy >= g.n) continue;
      const dark =
        x >= 0 && x <= 6 && y >= 0 && y <= 6 &&
        (x === 0 || y === 0 || x === 6 || y === 6 || (x >= 2 && x <= 4 && y >= 2 && y <= 4));
      setModule(g, xx, yy, dark);
    }
  }
}

function alignment(g: Grid, cx: number, cy: number): void {
  for (let y = -2; y <= 2; y++) {
    for (let x = -2; x <= 2; x++) {
      setModule(g, cx + x, cy + y, Math.max(Math.abs(x), Math.abs(y)) !== 1);
    }
  }
}

function paintFunctions(g: Grid, version: number): void {
  const n = g.n;
  finder(g, 0, 0);
  finder(g, n - 7, 0);
  finder(g, 0, n - 7);
  for (let i = 8; i < n - 8; i++) {
    setModule(g, i, 6, i % 2 === 0);
    setModule(g, 6, i, i % 2 === 0);
  }
  for (const cy of ALIGN[version - 1]) {
    for (const cx of ALIGN[version - 1]) {
      if ((cx < 9 && cy < 9) || (cx > n - 10 && cy < 9) || (cx < 9 && cy > n - 10)) continue;
      alignment(g, cx, cy);
    }
  }
  for (let i = 0; i < 9; i++) {
    setModule(g, i, 8, false);
    setModule(g, 8, i, false);
  }
  for (let i = 0; i < 8; i++) {
    setModule(g, n - 1 - i, 8, false);
    setModule(g, 8, n - 1 - i, false);
  }
  setModule(g, 8, n - 8, true);
  if (version >= 7) {
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 3; j++) {
        setModule(g, n - 11 + j, i, false);
        setModule(g, i, n - 11 + j, false);
      }
    }
  }
}

function maskBit(mask: number, x: number, y: number): boolean {
  switch (mask) {
    case 0: return (x + y) % 2 === 0;
    case 1: return y % 2 === 0;
    case 2: return x % 3 === 0;
    case 3: return (x + y) % 3 === 0;
    case 4: return (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0;
    case 5: return ((x * y) % 2) + ((x * y) % 3) === 0;
    case 6: return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
    default: return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
  }
}

function placeData(g: Grid, data: Uint8Array): void {
  const bits: number[] = [];
  for (const b of data) for (let i = 7; i >= 0; i--) bits.push((b >> i) & 1);
  let k = 0;
  let dir = -1;
  const n = g.n;
  for (let x = n - 1; x > 0; x -= 2) {
    if (x === 6) x--;
    for (let i = 0; i < n; i++) {
      const y = dir < 0 ? n - 1 - i : i;
      for (let dx = 0; dx < 2; dx++) {
        const xx = x - dx;
        if (g.reserved[idx(g, xx, y)]) continue;
        setModule(g, xx, y, (bits[k] ?? 0) === 1, false);
        k++;
      }
    }
    dir *= -1;
  }
}

function cloneGrid(g: Grid): Grid {
  return { n: g.n, dark: g.dark.slice(), reserved: g.reserved.slice() };
}

function applyMask(g: Grid, mask: number): void {
  const n = g.n;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = idx(g, x, y);
      if (g.reserved[i]) continue;
      if (maskBit(mask, x, y)) g.dark[i] ^= 1;
    }
  }
}

const FORMAT_MASK = 0x5412;
const FORMAT_EC = { L: 1, M: 0, Q: 3, H: 2 };

function formatBits(ec: QrEcLevel, mask: number): number {
  const data = (FORMAT_EC[ec] << 3) | mask;
  let rem = data << 10;
  for (let i = 14; i >= 10; i--) {
    if ((rem >>> i) & 1) rem ^= 0x537 << (i - 10);
  }
  return ((data << 10) | rem) ^ FORMAT_MASK;
}

function versionBits(version: number): number {
  let rem = version << 12;
  for (let i = 17; i >= 12; i--) {
    if ((rem >>> i) & 1) rem ^= 0x1f25 << (i - 12);
  }
  return (version << 12) | rem;
}

function drawFormat(g: Grid, bits: number): void {
  const n = g.n;
  const a: Array<[number, number]> = [
    [0, 8], [1, 8], [2, 8], [3, 8], [4, 8], [5, 8], [7, 8], [8, 8],
    [8, 7], [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0],
  ];
  const b: Array<[number, number]> = [
    [8, n - 1], [8, n - 2], [8, n - 3], [8, n - 4], [8, n - 5], [8, n - 6], [8, n - 7],
    [n - 8, 8], [n - 7, 8], [n - 6, 8], [n - 5, 8], [n - 4, 8], [n - 3, 8], [n - 2, 8], [n - 1, 8],
  ];
  for (let i = 0; i < 15; i++) {
    const bit = ((bits >> i) & 1) === 1;
    setModule(g, a[i]![0], a[i]![1], bit);
    setModule(g, b[i]![0], b[i]![1], bit);
  }
  setModule(g, 8, n - 8, true);
}

function drawVersion(g: Grid, bits: number): void {
  const n = g.n;
  let k = 0;
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 3; j++) {
      const bit = ((bits >> k) & 1) === 1;
      setModule(g, n - 11 + j, i, bit);
      setModule(g, i, n - 11 + j, bit);
      k++;
    }
  }
}

function penalty(g: Grid): number {
  const n = g.n;
  const at = (x: number, y: number) => g.dark[idx(g, x, y)];
  let score = 0;
  for (let y = 0; y < n; y++) {
    let run = 1;
    for (let x = 1; x <= n; x++) {
      if (x < n && at(x, y) === at(x - 1, y)) run++;
      else {
        if (run >= 5) score += 3 + (run - 5);
        run = 1;
      }
    }
  }
  for (let x = 0; x < n; x++) {
    let run = 1;
    for (let y = 1; y <= n; y++) {
      if (y < n && at(x, y) === at(x, y - 1)) run++;
      else {
        if (run >= 5) score += 3 + (run - 5);
        run = 1;
      }
    }
  }
  for (let y = 0; y < n - 1; y++) {
    for (let x = 0; x < n - 1; x++) {
      const v = at(x, y);
      if (v === at(x + 1, y) && v === at(x, y + 1) && v === at(x + 1, y + 1)) score += 3;
    }
  }
  const finder = [1, 0, 1, 1, 1, 0, 1];
  const scan = (seq: number[]) => {
    for (let i = 0; i <= seq.length - 7; i++) {
      let ok = true;
      for (let j = 0; j < 7; j++) if (seq[i + j] !== finder[j]) ok = false;
      if (!ok) continue;
      const left = i >= 4 && seq.slice(i - 4, i).every((b) => b === 0);
      const right = i + 11 <= seq.length && seq.slice(i + 7, i + 11).every((b) => b === 0);
      if (left || right) score += 40;
    }
  };
  for (let y = 0; y < n; y++) {
    const row: number[] = [];
    for (let x = 0; x < n; x++) row.push(at(x, y));
    scan(row);
  }
  for (let x = 0; x < n; x++) {
    const col: number[] = [];
    for (let y = 0; y < n; y++) col.push(at(x, y));
    scan(col);
  }
  let dark = 0;
  for (let i = 0; i < g.dark.length; i++) dark += g.dark[i]!;
  score += Math.floor(Math.abs((dark * 100) / (n * n) - 50) / 5) * 10;
  return score;
}

export function encodeQr(text: string, ec: QrEcLevel = "M"): boolean[][] {
  const bytes = new TextEncoder().encode(text);
  const version = chooseVersion(bytes.length, ec);
  const interleaved = interleave(encodeData(bytes, version, ec), version, ec);
  const n = sizeOf(version);
  const base: Grid = { n, dark: new Uint8Array(n * n), reserved: new Uint8Array(n * n) };
  paintFunctions(base, version);
  placeData(base, interleaved);

  let best: Grid | null = null;
  let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const g = cloneGrid(base);
    applyMask(g, mask);
    drawFormat(g, formatBits(ec, mask));
    if (version >= 7) drawVersion(g, versionBits(version));
    const score = penalty(g);
    if (score < bestScore) {
      bestScore = score;
      best = g;
    }
  }
  const matrix: boolean[][] = [];
  for (let y = 0; y < n; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < n; x++) row.push(best!.dark[idx(best!, x, y)] === 1);
    matrix.push(row);
  }
  return matrix;
}

export function qrVersion(text: string, ec: QrEcLevel = "M"): number {
  return chooseVersion(new TextEncoder().encode(text).length, ec);
}

export function qrSize(text: string, ec: QrEcLevel = "M"): number {
  return sizeOf(qrVersion(text, ec));
}
