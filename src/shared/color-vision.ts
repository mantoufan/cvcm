/**
 * Colour vision screening plates drawn for cv.cm (not copies of any published test).
 *
 * Each plate is a disc of dots. The figure (a number) differs from the background in one cone type's response only:
 * L for a protan plate, M for a deutan plate, S for a tritan plate. People missing that cone cannot tell the two
 * colours apart (they lie on one confusion line), while everyone else sees the number. Every dot also gets a random
 * brightness, the same spread for figure and background, so the number cannot be read from lightness alone.
 * Cone responses use the Viénot, Brettel & Mollon (1999) matrix from linear sRGB.
 */
import { seeded } from "./random";
import { shuffle } from "./teams";

export const PLATE_KINDS = ["protan", "deutan", "tritan"] as const;
export type PlateKind = (typeof PLATE_KINDS)[number];
export type Plate = {
  kind: PlateKind | "demo";
  /** 0 strongest … 3 subtlest (the demo plate is 0). */
  level: number;
  number: number;
  dots: Dot[];
};
export type Dot = { x: number; y: number; r: number; fill: string };

/** Cone contrast of the figure against the background at each level, per plate kind (S cones need more). */
export const STRENGTH: Record<PlateKind, readonly number[]> = {
  protan: [0.24, 0.14, 0.09, 0.06],
  deutan: [0.3, 0.18, 0.11, 0.07],
  tritan: [1.1, 0.8, 0.6, 0.45],
};

/** Background colours (sRGB) the figure is built from: warm greys for red–green plates, a lilac grey for tritan ones. */
const BASE: Record<PlateKind, readonly [number, number, number]> = {
  protan: [168, 150, 104],
  deutan: [164, 152, 106],
  tritan: [150, 140, 150],
};

const RGB_TO_LMS = [
  [17.8824, 43.5161, 4.11935],
  [3.45565, 27.1554, 3.86714],
  [0.0299566, 0.184309, 1.46709],
] as const;

function invert3(m: readonly (readonly number[])[]): number[][] {
  const [a, b, c] = m[0]!;
  const [d, e, f] = m[1]!;
  const [g, h, i] = m[2]!;
  const A = e! * i! - f! * h!, B = -(d! * i! - f! * g!), C = d! * h! - e! * g!;
  const det = a! * A + b! * B + c! * C;
  return [
    [A / det, -(b! * i! - c! * h!) / det, (b! * f! - c! * e!) / det],
    [B / det, (a! * i! - c! * g!) / det, -(a! * f! - c! * d!) / det],
    [C / det, -(a! * h! - b! * g!) / det, (a! * e! - b! * d!) / det],
  ];
}

const LMS_TO_RGB = invert3(RGB_TO_LMS);
const mulv = (m: readonly (readonly number[])[], v: readonly number[]) => m.map((row) => row[0]! * v[0]! + row[1]! * v[1]! + row[2]! * v[2]!);

const toLinear = (c: number) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const toSrgb = (v: number) => {
  const c = v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
  return Math.round(Math.min(1, Math.max(0, c)) * 255);
};

export function rgbToLms(rgb: readonly [number, number, number]): number[] {
  return mulv(RGB_TO_LMS, rgb.map(toLinear));
}

/** LMS back to sRGB; null when it falls outside the screen's gamut. */
export function lmsToRgb(lms: readonly number[]): [number, number, number] | null {
  const lin = mulv(LMS_TO_RGB, lms);
  if (lin.some((v) => v < -1e-6 || v > 1 + 1e-6)) return null;
  return lin.map(toSrgb) as [number, number, number];
}

const hex = (rgb: readonly number[]) => `#${rgb.map((v) => v.toString(16).padStart(2, "0")).join("")}`;

const CONE: Record<PlateKind, number> = { protan: 0, deutan: 1, tritan: 2 };

/**
 * Background and figure colour (as LMS) for a plate: the figure is the background with one cone's response moved by
 * `strength` (up or down by `sign`). To stay in gamut it tries the other sign at full strength first, and only then
 * smaller steps.
 */
export function plateColours(kind: PlateKind, strength: number, sign: 1 | -1): { bg: number[]; fig: number[] } {
  const bg = rgbToLms(BASE[kind]);
  for (let k = strength; k > strength / 4; k *= 0.9) {
    for (const s of [sign, -sign]) {
      const fig = bg.slice();
      fig[CONE[kind]] = bg[CONE[kind]]! * (1 + s * k);
      // Room for the brightness spread too.
      if (lmsToRgb(fig.map((v) => v * BRIGHT[1])) && lmsToRgb(fig.map((v) => v * BRIGHT[0])) && lmsToRgb(bg.map((v) => v * BRIGHT[1]))) return { bg, fig };
    }
  }
  return { bg, fig: bg.slice() };
}

/** Brightness spread applied to every dot (a factor on all three cone responses). */
const BRIGHT = [0.72, 1.12] as const;

/** Digit strokes on a 0–1 × 0–1 box (y down), as polylines; drawn with a thick round pen. */
const GLYPHS: Record<number, readonly (readonly [number, number])[][]> = {
  0: [[[0.5, 0], [0.12, 0.18], [0.08, 0.5], [0.12, 0.82], [0.5, 1], [0.88, 0.82], [0.92, 0.5], [0.88, 0.18], [0.5, 0]]],
  1: [[[0.3, 0.2], [0.58, 0], [0.58, 1]]],
  2: [[[0.12, 0.2], [0.4, 0], [0.75, 0.03], [0.9, 0.25], [0.8, 0.5], [0.1, 1], [0.92, 1]]],
  3: [[[0.12, 0.08], [0.5, 0], [0.85, 0.15], [0.82, 0.38], [0.45, 0.5], [0.88, 0.62], [0.88, 0.85], [0.5, 1], [0.1, 0.92]]],
  4: [[[0.72, 1], [0.72, 0], [0.08, 0.68], [0.95, 0.68]]],
  5: [[[0.88, 0], [0.18, 0], [0.12, 0.45], [0.55, 0.4], [0.9, 0.6], [0.85, 0.88], [0.5, 1], [0.1, 0.9]]],
  6: [[[0.82, 0.05], [0.45, 0], [0.15, 0.3], [0.1, 0.7], [0.3, 0.98], [0.7, 0.98], [0.9, 0.72], [0.75, 0.45], [0.4, 0.42], [0.12, 0.62]]],
  7: [[[0.08, 0], [0.92, 0], [0.4, 1]]],
  8: [[[0.5, 0.48], [0.15, 0.3], [0.2, 0.06], [0.5, 0], [0.8, 0.06], [0.85, 0.3], [0.5, 0.48], [0.1, 0.7], [0.18, 0.95], [0.5, 1], [0.82, 0.95], [0.9, 0.7], [0.5, 0.48]]],
  9: [[[0.88, 0.38], [0.6, 0.58], [0.25, 0.55], [0.1, 0.3], [0.3, 0.02], [0.7, 0.02], [0.9, 0.3], [0.85, 0.7], [0.55, 1], [0.18, 0.95]]],
};

function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** The number's strokes in plate coordinates (the plate is the disc of radius 1 around 0, 0). */
function numberStrokes(n: number): Array<[number, number, number, number]> {
  const digits = String(n).split("").map(Number);
  const w = 0.5, gap = 0.14, hgt = 0.95;
  const total = digits.length * w + (digits.length - 1) * gap;
  const out: Array<[number, number, number, number]> = [];
  digits.forEach((d, k) => {
    const x0 = -total / 2 + k * (w + gap);
    for (const line of GLYPHS[d]!) {
      for (let i = 1; i < line.length; i++) {
        const [ax, ay] = line[i - 1]!;
        const [bx, by] = line[i]!;
        out.push([x0 + ax * w, -hgt / 2 + ay * hgt, x0 + bx * w, -hgt / 2 + by * hgt]);
      }
    }
  });
  return out;
}

const PEN = 0.085;

export function inNumber(strokes: ReadonlyArray<readonly [number, number, number, number]>, x: number, y: number): boolean {
  return strokes.some(([ax, ay, bx, by]) => segDist(x, y, ax, ay, bx, by) <= PEN);
}

/** Dots packed in the unit disc by dart throwing (seeded), large first; about 700 for a plate. */
export function packDots(rand: () => number): Array<{ x: number; y: number; r: number }> {
  const dots: Array<{ x: number; y: number; r: number }> = [];
  const cell = 0.1;
  const grid = new Map<string, number[]>();
  const key = (gx: number, gy: number) => `${gx},${gy}`;
  for (const [rMax, tries] of [[0.05, 1400], [0.036, 2600], [0.026, 4200], [0.018, 5200]] as const) {
    for (let k = 0; k < tries; k++) {
      const r = rMax * (0.8 + rand() * 0.2);
      const a = rand() * Math.PI * 2;
      const d = Math.sqrt(rand()) * (1 - r);
      const x = Math.cos(a) * d, y = Math.sin(a) * d;
      const gx = Math.floor(x / cell), gy = Math.floor(y / cell);
      let free = true;
      for (let i = gx - 1; free && i <= gx + 1; i++) {
        for (let j = gy - 1; free && j <= gy + 1; j++) {
          for (const idx of grid.get(key(i, j)) ?? []) {
            const o = dots[idx]!;
            if (Math.hypot(o.x - x, o.y - y) < o.r + r + 0.006) {
              free = false;
              break;
            }
          }
        }
      }
      if (!free) continue;
      grid.set(key(gx, gy), [...(grid.get(key(gx, gy)) ?? []), dots.length]);
      dots.push({ x, y, r });
    }
  }
  return dots;
}

/** One plate: dots coloured as figure or background, each with its own brightness. */
export function makePlate(kind: PlateKind | "demo", level: number, number: number, rand: () => number): Plate {
  const strokes = numberStrokes(number);
  let bg: number[], fig: number[];
  if (kind === "demo") {
    // Everyone can read the demo plate: the figure is plainly darker and redder.
    bg = rgbToLms([150, 170, 120]);
    fig = rgbToLms([205, 95, 60]);
  } else {
    ({ bg, fig } = plateColours(kind, STRENGTH[kind][level]!, rand() < 0.5 ? 1 : -1));
  }
  const dots = packDots(rand).map((d) => {
    const isFig = inNumber(strokes, d.x, d.y);
    const k = BRIGHT[0] + rand() * (BRIGHT[1] - BRIGHT[0]);
    const base = isFig ? fig : bg;
    const rgb = lmsToRgb(base.map((v) => v * k)) ?? lmsToRgb(base)!;
    return { ...d, fill: hex(rgb) };
  });
  return { kind, level, number, dots };
}

/** Two-digit numbers for the plates, never repeating within a test and never a mirrored or easily misread pair. */
function pickNumbers(count: number, rand: () => number): number[] {
  const pool: number[] = [];
  for (let n = 12; n <= 98; n++) if (n % 10 !== 0 && n % 11 !== 0) pool.push(n);
  const out: number[] = [];
  while (out.length < count) {
    const n = pool.splice(Math.floor(rand() * pool.length), 1)[0]!;
    out.push(n);
  }
  return out;
}

export const PLATE_COUNT = 1 + PLATE_KINDS.length * 4;

/**
 * A whole test for `seed`: the demo plate first, then four plates of each kind (strongest to subtlest) in a shuffled
 * order. Same seed, same test.
 */
export function makeTest(seed: number): Plate[] {
  const rand = seeded(seed * 2_654_435_761);
  const numbers = pickNumbers(PLATE_COUNT, rand);
  const specs = shuffle(PLATE_KINDS.flatMap((kind) => [0, 1, 2, 3].map((level) => ({ kind, level }))), (n) => Math.floor(rand() * n));
  return [makePlate("demo", 0, numbers[0]!, rand), ...specs.map((s, i) => makePlate(s.kind, s.level, numbers[i + 1]!, rand))];
}

export type Verdict = { kind: PlateKind; correct: number; total: number; grade: "normal" | "mild" | "strong" };

/**
 * Per kind: plates read right out of four. Missing only the subtlest is normal on most screens; missing two is a
 * sign of a mild deficiency, three or four of a strong one.
 */
export function score(plates: readonly Plate[], answers: readonly (number | null)[]): Verdict[] {
  return PLATE_KINDS.map((kind) => {
    let correct = 0, total = 0;
    plates.forEach((p, i) => {
      if (p.kind !== kind) return;
      total++;
      if (answers[i] === p.number) correct++;
    });
    const missed = total - correct;
    return { kind, correct, total, grade: missed <= 1 ? "normal" : missed === 2 ? "mild" : "strong" };
  });
}
