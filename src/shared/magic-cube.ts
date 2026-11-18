/**
 * Magic cube model (written for cv.cm): an N×N×N twisty cube, N = 2, 3 or 4. Cubies sit at integer "doubled"
 * coordinates (2i − (N − 1), so −2..2 step 2 on a 3×3), each with an integer rotation matrix from its solved
 * orientation to now. A sticker's colour is fixed to its body-frame normal; its world normal is R · n.
 *
 * A move turns one layer (or the whole cube) a quarter (±1) or half (2) turn about +x, +y or +z, counter-clockwise
 * looking from the positive end (right-hand rule). Face notation maps onto that: R = −1 about x on the top x layer,
 * U = −1 about y, F = −1 about z; L, D, B are +1 on layer 0. Colours: U white, D yellow, F green, B blue, R red,
 * L orange.
 */

export const CUBE_SIZES = [2, 3, 4] as const;
export type CubeSize = (typeof CUBE_SIZES)[number];
export type Axis = 0 | 1 | 2;
export type Turns = 1 | -1 | 2;
export type Vec = [number, number, number];
/** Row-major 3×3 integer matrix. */
export type Mat = [number, number, number, number, number, number, number, number, number];

export interface Move {
  axis: Axis;
  /** 0..N−1 from the negative side; −1 turns the whole cube. */
  layer: number;
  turns: Turns;
}

export interface Sticker {
  /** Body-frame outward normal (the solved face it belongs to). */
  normal: Vec;
  /** Index into CUBE_COLORS. */
  color: number;
}

export interface Cubie {
  /** Doubled coordinates, each in −(N−1)..N−1. */
  pos: Vec;
  rot: Mat;
  stickers: Sticker[];
}

export interface Cube {
  n: CubeSize;
  cubies: Cubie[];
}

/** Face colours in order +x (R), −x (L), +y (U), −y (D), +z (F), −z (B). */
export const CUBE_COLORS = [0xc81e32, 0xff7a1a, 0xf7f7f2, 0xffd21f, 0x1f9d55, 0x1e5bc6] as const;

const IDENTITY: Mat = [1, 0, 0, 0, 1, 0, 0, 0, 1];

/** +90° about each axis. */
const QUARTER: Record<Axis, Mat> = {
  0: [1, 0, 0, 0, 0, -1, 0, 1, 0],
  1: [0, 0, 1, 0, 1, 0, -1, 0, 0],
  2: [0, -1, 0, 1, 0, 0, 0, 0, 1],
};

export function mul(a: Mat, b: Mat): Mat {
  const r = new Array(9).fill(0) as Mat;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    let s = 0;
    for (let k = 0; k < 3; k++) s += a[i * 3 + k]! * b[k * 3 + j]!;
    r[i * 3 + j] = s;
  }
  return r;
}

export function apply(m: Mat, v: Vec): Vec {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ];
}

/** Rotation matrix for `turns` quarter turns about `axis`. */
export function turnMatrix(axis: Axis, turns: Turns): Mat {
  const q = QUARTER[axis];
  const steps = turns === -1 ? 3 : turns;
  let m = IDENTITY;
  for (let i = 0; i < steps; i++) m = mul(q, m);
  return m;
}

function colorFor(normal: Vec): number {
  if (normal[0] === 1) return 0;
  if (normal[0] === -1) return 1;
  if (normal[1] === 1) return 2;
  if (normal[1] === -1) return 3;
  if (normal[2] === 1) return 4;
  return 5;
}

/** A solved cube. Fully hidden inner cubies (4×4 has 8) are left out. */
export function newCube(n: CubeSize): Cube {
  const cubies: Cubie[] = [];
  const max = n - 1;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) for (let k = 0; k < n; k++) {
    const pos: Vec = [2 * i - max, 2 * j - max, 2 * k - max];
    const stickers: Sticker[] = [];
    for (let a = 0; a < 3; a++) {
      for (const s of [1, -1]) {
        if (pos[a] === s * max) {
          const normal: Vec = [0, 0, 0];
          normal[a] = s;
          stickers.push({ normal, color: colorFor(normal) });
        }
      }
    }
    if (stickers.length) cubies.push({ pos, rot: IDENTITY, stickers });
  }
  return { n, cubies };
}

/** Doubled coordinate of layer `layer` (0 = negative side). */
export function layerCoord(n: number, layer: number): number {
  return 2 * layer - (n - 1);
}

/** Cubie indexes a move turns. */
export function movedCubies(cube: Cube, move: Move): number[] {
  const out: number[] = [];
  const c = layerCoord(cube.n, move.layer);
  cube.cubies.forEach((q, i) => {
    if (move.layer < 0 || q.pos[move.axis] === c) out.push(i);
  });
  return out;
}

/** Turns in place. */
export function applyMove(cube: Cube, move: Move): void {
  const m = turnMatrix(move.axis, move.turns);
  for (const i of movedCubies(cube, move)) {
    const q = cube.cubies[i]!;
    q.pos = apply(m, q.pos);
    q.rot = mul(m, q.rot);
  }
}

export function applyMoves(cube: Cube, moves: readonly Move[]): void {
  for (const mv of moves) applyMove(cube, mv);
}

export function invertMove(move: Move): Move {
  return { ...move, turns: move.turns === 2 ? 2 : (-move.turns as Turns) };
}

export function inverse(moves: readonly Move[]): Move[] {
  return moves.slice().reverse().map(invertMove);
}

/** World normal of a sticker. */
export function stickerNormal(q: Cubie, s: Sticker): Vec {
  return apply(q.rot, s.normal);
}

/** Every outward face shows one colour (whatever way the whole cube is held). */
export function isSolved(cube: Cube): boolean {
  const seen = new Map<string, number>();
  for (const q of cube.cubies) {
    for (const s of q.stickers) {
      const key = stickerNormal(q, s).join(",");
      const had = seen.get(key);
      if (had === undefined) seen.set(key, s.color);
      else if (had !== s.color) return false;
    }
  }
  return true;
}

export function cloneCube(cube: Cube): Cube {
  return { n: cube.n, cubies: cube.cubies.map((q) => ({ pos: [...q.pos] as Vec, rot: [...q.rot] as Mat, stickers: q.stickers })) };
}

/** Same cubie places and turns (for tests and state checks). */
export function sameState(a: Cube, b: Cube): boolean {
  return a.cubies.every((q, i) => {
    const r = b.cubies[i]!;
    return q.pos.every((v, k) => v === r.pos[k]) && q.rot.every((v, k) => v === r.rot[k]);
  });
}

export type Face = "U" | "D" | "L" | "R" | "F" | "B";
export const FACES: readonly Face[] = ["U", "D", "L", "R", "F", "B"];

const FACE_DEF: Record<Face, { axis: Axis; high: boolean }> = {
  R: { axis: 0, high: true },
  L: { axis: 0, high: false },
  U: { axis: 1, high: true },
  D: { axis: 1, high: false },
  F: { axis: 2, high: true },
  B: { axis: 2, high: false },
};

/** Outer-layer face turn: "R", "R'" or "R2" on any size. */
export function faceMove(n: number, face: Face, prime = false, double = false): Move {
  const d = FACE_DEF[face];
  // Clockwise seen from the face: −90° about the axis on the high side, +90° on the low side.
  const cw: Turns = d.high ? -1 : 1;
  const turns: Turns = double ? 2 : prime ? (-cw as Turns) : cw;
  return { axis: d.axis, layer: d.high ? n - 1 : 0, turns };
}

/**
 * Standard notation: U D L R F B with ' or 2; on a 3×3 also M (as L), E (as D), S (as F); x y z whole-cube turns
 * (as R, U, F). Null for anything else.
 */
export function parseNotation(n: number, text: string): Move | null {
  const m = /^([UDLRFBMESxyz])(2|'|)$/.exec(text.trim());
  if (!m) return null;
  const [, letter, suffix] = m as unknown as [string, string, string];
  const prime = suffix === "'";
  const double = suffix === "2";
  if ((FACES as readonly string[]).includes(letter)) return faceMove(n, letter as Face, prime, double);
  const spec: Record<string, { axis: Axis; cw: Turns; whole: boolean }> = {
    M: { axis: 0, cw: 1, whole: false },
    E: { axis: 1, cw: 1, whole: false },
    S: { axis: 2, cw: -1, whole: false },
    x: { axis: 0, cw: -1, whole: true },
    y: { axis: 1, cw: -1, whole: true },
    z: { axis: 2, cw: -1, whole: true },
  };
  const s = spec[letter]!;
  if (!s.whole && n !== 3) return null;
  const turns: Turns = double ? 2 : prime ? (-s.cw as Turns) : s.cw;
  return { axis: s.axis, layer: s.whole ? -1 : 1, turns };
}

export function parseSequence(n: number, text: string): Move[] {
  return text.split(/\s+/).filter(Boolean).map((part) => {
    const mv = parseNotation(n, part);
    if (!mv) throw new Error(`bad move ${part}`);
    return mv;
  });
}

/** Compact save token: axis letter, layer (or *), turns: "x2-", "y*+", "z02". */
export function moveToken(move: Move): string {
  return `${"xyz"[move.axis]}${move.layer < 0 ? "*" : move.layer}${move.turns === 2 ? "2" : move.turns > 0 ? "+" : "-"}`;
}

export function parseToken(n: number, token: string): Move | null {
  const m = /^([xyz])(\*|\d)([+\-2])$/.exec(token);
  if (!m) return null;
  const layer = m[2] === "*" ? -1 : Number(m[2]);
  if (layer >= n) return null;
  return { axis: "xyz".indexOf(m[1]!) as Axis, layer, turns: m[3] === "2" ? 2 : m[3] === "+" ? 1 : -1 };
}

export function scrambleLength(n: CubeSize): number {
  return n === 2 ? 11 : n === 3 ? 25 : 40;
}

/**
 * Random scramble: outer-layer turns (2×2: only R U F, since the other three only re-orient it; 4×4 also the two inner
 * slices), never two in a row on the same axis, so nothing cancels or merges.
 */
export function scramble(n: CubeSize, rand: () => number): Move[] {
  const out: Move[] = [];
  let lastAxis = -1;
  const pick = <T>(list: readonly T[]) => list[Math.min(list.length - 1, Math.floor(rand() * list.length))]!;
  while (out.length < scrambleLength(n)) {
    const axis = pick([0, 1, 2] as const);
    if (axis === lastAxis) continue;
    lastAxis = axis;
    const layers = n === 2 ? [1] : Array.from({ length: n }, (_, i) => i);
    out.push({ axis, layer: pick(layers), turns: pick([1, -1, 2] as const) });
  }
  return out;
}
