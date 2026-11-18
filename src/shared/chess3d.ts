/**
 * Pure helpers of the 3D chess page (src/client/3d-chess/): board coordinates, the camera orbit, keyboard cursor moves
 * that follow the view, piece profiles for three's LatheGeometry and the saved game. No three.js or DOM here.
 */

export type Side = "w" | "b";
export type Mode = "computer" | "friend";
export type Sq = `${"a" | "b" | "c" | "d" | "e" | "f" | "g" | "h"}${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}`;

const FILES = "abcdefgh";


export function squareAt(file: number, rank: number): Sq {
  return `${FILES[file]}${rank + 1}` as Sq;
}

/** World position (x, z) of a square's centre: squares are 1 unit, a1 at (-3.5, 3.5), white's side at +z. */
export function squareToWorld(sq: Sq): { x: number; z: number } {
  const file = FILES.indexOf(sq[0]!);
  const rank = Number(sq[1]) - 1;
  return { x: file - 3.5, z: 3.5 - rank };
}

/** The square under a point on the board plane, or null off the board. */
export function worldToSquare(x: number, z: number): Sq | null {
  const file = Math.floor(x + 4);
  const rank = Math.floor(4 - z);
  if (file < 0 || file > 7 || rank < 0 || rank > 7) return null;
  return squareAt(file, rank);
}

/** Camera azimuth that puts `side` at the bottom of the screen (camera on white's side at 0). */
export function homeTheta(side: Side): number {
  return side === "w" ? 0 : Math.PI;
}

/** Which quarter turn the view is closest to: 0 = white at the bottom, 1 = camera on the h-file side, 2, 3. */
export function viewQuadrant(theta: number): 0 | 1 | 2 | 3 {
  const q = Math.round(theta / (Math.PI / 2));
  return ((((q % 4) + 4) % 4) as 0 | 1 | 2 | 3);
}

const UP: Record<0 | 1 | 2 | 3, [number, number]> = { 0: [0, 1], 1: [-1, 0], 2: [0, -1], 3: [1, 0] };

/** The square an arrow key moves the cursor to, in screen directions for the current view; the edge stops it. */
export function stepCursor(sq: Sq, key: string, theta: number): Sq {
  const [uf, ur] = UP[viewQuadrant(theta)];
  // Screen right is the up direction turned a quarter clockwise.
  const dir: Record<string, [number, number]> = {
    ArrowUp: [uf, ur],
    ArrowDown: [-uf, -ur],
    ArrowRight: [ur, -uf],
    ArrowLeft: [-ur, uf],
  };
  const d = dir[key];
  if (!d) return sq;
  const file = FILES.indexOf(sq[0]!) + d[0];
  const rank = Number(sq[1]) - 1 + d[1];
  if (file < 0 || file > 7 || rank < 0 || rank > 7) return sq;
  return squareAt(file, rank);
}

/** The camera's height angle from straight above, kept between a steep and a low view. */
export const PHI_MIN = 0.3;
export const PHI_MAX = 1.2;
export const PHI_HOME = 0.82;

export function clampPhi(phi: number): number {
  return Math.min(PHI_MAX, Math.max(PHI_MIN, phi));
}

/** Camera distance so the whole board fits: further away on a narrow (portrait) stage. */
export function cameraRadius(aspect: number): number {
  const a = aspect > 0 ? aspect : 1;
  return 14.5 * Math.max(1, 1.15 / a) ** 0.85;
}

/** Points along a circle arc (radius r around (0, cy)) from angle a0 to a1, for round piece tops. */
function arc(cy: number, r: number, a0: number, a1: number, n: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    out.push([Math.max(0, Math.cos(a) * r), cy + Math.sin(a) * r]);
  }
  return out;
}

const BASE: [number, number][] = [[0, 0], [0.36, 0], [0.36, 0.06], [0.31, 0.09], [0.27, 0.12]];

/**
 * Silhouettes as (radius, height) points from the bottom up, ending on the axis, for LatheGeometry. A square is 1
 * unit wide. The knight is a short turned base; its head is an extruded side shape (KNIGHT_HEAD).
 */
export const PROFILES: Record<"p" | "r" | "b" | "q" | "k" | "n", [number, number][]> = {
  p: [...BASE, [0.17, 0.17], [0.12, 0.3], [0.18, 0.34], [0.1, 0.38], ...arc(0.47, 0.11, -Math.PI / 2 + 0.9, Math.PI / 2, 8)],
  r: [...BASE, [0.22, 0.16], [0.19, 0.48], [0.26, 0.52], [0.26, 0.66], [0.17, 0.66], [0.17, 0.6], [0, 0.6]],
  b: [...BASE, [0.16, 0.2], [0.11, 0.5], [0.18, 0.54], [0.1, 0.58], [0.14, 0.64], [0.13, 0.72], [0.08, 0.79], [0.03, 0.83], ...arc(0.87, 0.045, -Math.PI / 2 + 0.6, Math.PI / 2, 5)],
  q: [...BASE, [0.18, 0.22], [0.12, 0.6], [0.2, 0.64], [0.12, 0.68], [0.21, 0.84], [0.15, 0.86], [0.06, 0.88], ...arc(0.93, 0.055, -Math.PI / 2 + 0.6, Math.PI / 2, 5)],
  k: [...BASE, [0.19, 0.22], [0.13, 0.66], [0.21, 0.7], [0.13, 0.74], [0.19, 0.9], [0.08, 0.93], [0, 0.93]],
  n: [...BASE, [0.21, 0.16], [0.2, 0.22], [0, 0.22]],
};

/** Side view of the knight's head (forward, up), extruded sideways; forward is towards the opponent. */
export const KNIGHT_HEAD: [number, number][] = [
  [-0.17, 0.2], [0.15, 0.2], [0.1, 0.36], [0.23, 0.46], [0.25, 0.56], [0.17, 0.62], [0.05, 0.72], [-0.01, 0.78],
  [-0.05, 0.7], [-0.14, 0.63], [-0.19, 0.44],
];


export type Saved = { moves: string[]; mode: Mode; level: number; side: Side };

/** Reads a stored game defensively: unknown fields fall back to a new game against the computer at level 2. */
export function parseSaved(raw: unknown, levels: number): Saved {
  const s = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof Saved, unknown>>;
  const level = Number.isInteger(s.level) && (s.level as number) >= 0 && (s.level as number) < levels ? (s.level as number) : 1;
  return {
    moves: Array.isArray(s.moves) ? s.moves.filter((m): m is string => typeof m === "string" && /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(m)) : [],
    mode: s.mode === "friend" ? "friend" : "computer",
    level,
    side: s.side === "b" ? "b" : "w",
  };
}
