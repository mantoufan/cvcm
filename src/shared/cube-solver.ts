/**
 * Cube solver model (written for cv.cm): the 54 painted stickers of a 3×3 cube as a facelet string in the standard
 * U R F D L B order (9 per face, row by row as each face is seen in the usual unfolded net), checked to be a cube
 * that can exist before it goes to the solver (cubejs, Kociemba's two-phase algorithm, in a worker).
 *
 * Face letters are also the colours: centre U white, R red, F green, D yellow, L orange, B blue (the scheme of
 * shared/magic-cube.ts). "?" is an unpainted sticker.
 */
import { CUBE_COLORS, applyMoves, newCube, parseNotation, stickerNormal, type Axis, type Cube, type Move, type Turns, type Vec } from "./magic-cube";

export const FACE_ORDER = ["U", "R", "F", "D", "L", "B"] as const;
export type FaceLetter = (typeof FACE_ORDER)[number];
export type Facelet = FaceLetter | "?";

/** Sticker colour of each face letter (hex), taken from the 3D cube so both pages show the same colours. */
export const FACE_COLOR: Record<FaceLetter, number> = {
  U: CUBE_COLORS[2],
  R: CUBE_COLORS[0],
  F: CUBE_COLORS[4],
  D: CUBE_COLORS[3],
  L: CUBE_COLORS[1],
  B: CUBE_COLORS[5],
};

export const SOLVED = FACE_ORDER.map((f) => f.repeat(9)).join("");

/** Index of the centre sticker of face `f` (0..5 in FACE_ORDER). */
export const centreIndex = (f: number): number => f * 9 + 4;

/** Corner slots as facelet indexes (U/D sticker first, then clockwise), and the colours of each solved corner. */
const CORNER_FACELETS: readonly (readonly [number, number, number])[] = [
  [8, 9, 20], [6, 18, 38], [0, 36, 47], [2, 45, 11], [29, 26, 15], [27, 44, 24], [33, 53, 42], [35, 17, 51],
];
const CORNER_COLORS: readonly (readonly [FaceLetter, FaceLetter, FaceLetter])[] = [
  ["U", "R", "F"], ["U", "F", "L"], ["U", "L", "B"], ["U", "B", "R"], ["D", "F", "R"], ["D", "L", "F"], ["D", "B", "L"], ["D", "R", "B"],
];
const EDGE_FACELETS: readonly (readonly [number, number])[] = [
  [5, 10], [7, 19], [3, 37], [1, 46], [32, 16], [28, 25], [30, 43], [34, 52], [23, 12], [21, 41], [50, 39], [48, 14],
];
const EDGE_COLORS: readonly (readonly [FaceLetter, FaceLetter])[] = [
  ["U", "R"], ["U", "F"], ["U", "L"], ["U", "B"], ["D", "R"], ["D", "F"], ["D", "L"], ["D", "B"], ["F", "R"], ["F", "L"], ["B", "L"], ["B", "R"],
];

export type CubeError =
  | { kind: "blank"; n: number }
  | { kind: "count"; face: FaceLetter; n: number }
  | { kind: "corner" }
  | { kind: "edge" }
  | { kind: "twist" }
  | { kind: "flip" }
  | { kind: "parity" };

/** Clean a saved or typed state: 54 characters of URFDLB?, centres forced to their face. Null when unusable. */
export function cleanFacelets(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length !== 54 || !/^[URFDLB?]+$/.test(raw)) return null;
  const chars = raw.split("");
  FACE_ORDER.forEach((f, i) => { chars[centreIndex(i)] = f; });
  return chars.join("");
}

export function colourCounts(facelets: string): Record<FaceLetter, number> {
  const out = { U: 0, R: 0, F: 0, D: 0, L: 0, B: 0 } as Record<FaceLetter, number>;
  for (const ch of facelets) if (ch !== "?") out[ch as FaceLetter]++;
  return out;
}

function parity(perm: readonly number[]): number {
  let p = 0;
  const seen = new Array(perm.length).fill(false);
  for (let i = 0; i < perm.length; i++) {
    if (seen[i]) continue;
    let len = 0;
    for (let j = i; !seen[j]; j = perm[j]!) { seen[j] = true; len++; }
    p += len - 1;
  }
  return p % 2;
}

/**
 * Whether the painted cube can exist: every sticker painted, nine of each colour, every corner and edge a real piece
 * used once, corner twist and edge flip sums whole, and corner and edge permutations of the same parity.
 */
export function validate(facelets: string): CubeError | null {
  const blank = facelets.split("").filter((c) => c === "?").length;
  if (blank) return { kind: "blank", n: blank };
  const counts = colourCounts(facelets);
  for (const f of FACE_ORDER) if (counts[f] !== 9) return { kind: "count", face: f, n: counts[f] };

  const cp: number[] = [];
  let twist = 0;
  for (const slot of CORNER_FACELETS) {
    const cols = slot.map((i) => facelets[i]) as FaceLetter[];
    const ori = cols.findIndex((c) => c === "U" || c === "D");
    if (ori < 0) return { kind: "corner" };
    const c1 = cols[(ori + 1) % 3];
    const c2 = cols[(ori + 2) % 3];
    const piece = CORNER_COLORS.findIndex((cc) => cc[0] === cols[ori] && cc[1] === c1 && cc[2] === c2);
    if (piece < 0) return { kind: "corner" };
    cp.push(piece);
    twist += ori;
  }
  if (new Set(cp).size !== 8) return { kind: "corner" };

  const ep: number[] = [];
  let flip = 0;
  for (const [a, b] of EDGE_FACELETS) {
    const x = facelets[a] as FaceLetter;
    const y = facelets[b] as FaceLetter;
    let piece = EDGE_COLORS.findIndex((e) => e[0] === x && e[1] === y);
    let ori = 0;
    if (piece < 0) {
      piece = EDGE_COLORS.findIndex((e) => e[0] === y && e[1] === x);
      ori = 1;
    }
    if (piece < 0) return { kind: "edge" };
    ep.push(piece);
    flip += ori;
  }
  if (new Set(ep).size !== 12) return { kind: "edge" };
  if (twist % 3) return { kind: "twist" };
  if (flip % 2) return { kind: "flip" };
  if (parity(cp) !== parity(ep)) return { kind: "parity" };
  return null;
}

/**
 * Where facelet `i` sits on a 3×3 of shared/magic-cube.ts (doubled coordinates, +x = R, +y = U, +z = F) and which
 * way it faces. Rows and columns follow the standard net: U seen from above with B at the top, D from below with F
 * at the top, the four sides from outside with U at the top.
 */
export function faceletPlace(i: number): { pos: Vec; normal: Vec } {
  const face = FACE_ORDER[Math.floor(i / 9)]!;
  const r = Math.floor((i % 9) / 3) - 1;
  const c = (i % 3) - 1;
  const at = (x: number, y: number, z: number): Vec => [2 * x, 2 * y, 2 * z];
  switch (face) {
    case "U": return { pos: at(c, 1, r), normal: [0, 1, 0] };
    case "R": return { pos: at(1, -r, -c), normal: [1, 0, 0] };
    case "F": return { pos: at(c, -r, 1), normal: [0, 0, 1] };
    case "D": return { pos: at(c, -1, -r), normal: [0, -1, 0] };
    case "L": return { pos: at(-1, -r, c), normal: [-1, 0, 0] };
    default: return { pos: at(-c, -r, -1), normal: [0, 0, -1] };
  }
}

/** Face letter of each CUBE_COLORS index. */
const COLOR_FACE: readonly FaceLetter[] = ["R", "L", "U", "D", "F", "B"];

/** The facelet string of a 3×3 cube model (what the 3D view shows). */
export function faceletsOf(cube: Cube): string {
  let out = "";
  for (let i = 0; i < 54; i++) {
    const { pos, normal } = faceletPlace(i);
    let letter: FaceLetter = "U";
    for (const q of cube.cubies) {
      if (q.pos[0] !== pos[0] || q.pos[1] !== pos[1] || q.pos[2] !== pos[2]) continue;
      for (const s of q.stickers) {
        const nw = stickerNormal(q, s);
        if (nw[0] === normal[0] && nw[1] === normal[1] && nw[2] === normal[2]) letter = COLOR_FACE[s.color]!;
      }
    }
    out += letter;
  }
  return out;
}

/** Solver output ("R U2 F' …") as cube moves; tokens it cannot read are an error. */
export function parseSolution(text: string): { tokens: string[]; moves: Move[] } {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  const moves = tokens.map((tok) => {
    const mv = parseNotation(3, tok);
    if (!mv || !/^[URFDLB]/.test(tok)) throw new Error(`bad move ${tok}`);
    return mv;
  });
  return { tokens, moves };
}

/** A solved 3×3 model, for the 3D view. */
export const solvedCube = (): Cube => newCube(3);

/**
 * A random reachable state: 25 outer-face turns, never the same axis twice in a row. Outer layers only (not
 * shared/magic-cube's scramble, which also turns the middle slice and so moves the centres the net keeps fixed).
 */
export function randomState(rand: () => number): string {
  const moves: Move[] = [];
  let last = -1;
  while (moves.length < 25) {
    const axis = Math.min(2, Math.floor(rand() * 3)) as Axis;
    if (axis === last) continue;
    last = axis;
    const turns = ([1, -1, 2] as const)[Math.min(2, Math.floor(rand() * 3))] as Turns;
    moves.push({ axis, layer: rand() < 0.5 ? 0 : 2, turns });
  }
  const cube = solvedCube();
  applyMoves(cube, moves);
  return faceletsOf(cube);
}
