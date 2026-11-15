/**
 * Memory (concentration), written for cv.cm: pairs of face-down cards; turn two over, a pair stays up. In a
 * two-player game a pair lets the same player go again and a miss passes the turn.
 */

export const LAYOUTS = { "4x4": { rows: 4, cols: 4 }, "4x5": { rows: 4, cols: 5 }, "6x6": { rows: 6, cols: 6 } } as const;
export type LayoutId = keyof typeof LAYOUTS;
export const LAYOUT_IDS = Object.keys(LAYOUTS) as LayoutId[];

/** 18 faces: 9 shapes, each solid and outlined (and in two colours), so a pair never depends on colour alone. */
export const SHAPES = ["circle", "square", "triangle", "star", "heart", "diamond", "hexagon", "moon", "cross"] as const;
export const FACE_COUNT = SHAPES.length * 2;
export const faceShape = (face: number) => SHAPES[face % SHAPES.length]!;
/** Faces 0–8 are solid, 9–17 outlined. */
export const faceSolid = (face: number) => face < SHAPES.length;

export type Game = {
  layout: LayoutId;
  /** Face id per card position. */
  faces: number[];
  matched: boolean[];
  /** Positions turned up and not yet matched (0–2). */
  open: number[];
  moves: number;
  players: 1 | 2;
  turn: 0 | 1;
  scores: [number, number];
};

function shuffled<T>(list: readonly T[], rand: () => number): T[] {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export function deal(layout: LayoutId, players: 1 | 2, rand: () => number): Game {
  const { rows, cols } = LAYOUTS[layout];
  const pairs = (rows * cols) / 2;
  const faces = shuffled([...Array(FACE_COUNT).keys()], rand).slice(0, pairs);
  const cards = shuffled([...faces, ...faces], rand);
  return { layout, faces: cards, matched: cards.map(() => false), open: [], moves: 0, players, turn: 0, scores: [0, 0] };
}

/** A miss is showing: two open cards that do not match. */
export const missShowing = (g: Game) => g.open.length === 2;

/** Turns a missed pair back down and passes the turn (two players). */
export function settleMiss(g: Game): Game {
  if (!missShowing(g)) return g;
  return { ...g, open: [], turn: g.players === 2 ? ((1 - g.turn) as 0 | 1) : g.turn };
}

/** Turns card `i` over. A miss still showing is put back first, so play never waits for the timer. */
export function flip(prev: Game, i: number): Game {
  let g = prev;
  if (i < 0 || i >= g.faces.length || g.matched[i] || g.open.includes(i) || won(g)) return g;
  if (missShowing(g)) g = settleMiss(g);
  const open = [...g.open, i];
  if (open.length < 2) return { ...g, open };
  const [a, b] = open as [number, number];
  const moves = g.moves + 1;
  if (g.faces[a] === g.faces[b]) {
    const matched = g.matched.slice();
    matched[a] = true;
    matched[b] = true;
    const scores: [number, number] = [...g.scores];
    scores[g.turn]++;
    return { ...g, matched, open: [], moves, scores };
  }
  return { ...g, open, moves };
}

export const won = (g: Game) => g.matched.every(Boolean);

/** A saved game is used only if it is a real deal: every face exactly twice and consistent flags. */
export function fromSaved(raw: unknown): Game | null {
  if (!raw || typeof raw !== "object") return null;
  const g = raw as Partial<Game>;
  if (typeof g.layout !== "string" || !(g.layout in LAYOUTS)) return null;
  const { rows, cols } = LAYOUTS[g.layout as LayoutId];
  const n = rows * cols;
  if (!Array.isArray(g.faces) || g.faces.length !== n || !Array.isArray(g.matched) || g.matched.length !== n) return null;
  const count = new Map<number, number>();
  for (const f of g.faces) {
    if (!Number.isInteger(f) || f < 0 || f >= FACE_COUNT) return null;
    count.set(f, (count.get(f) ?? 0) + 1);
  }
  if ([...count.values()].some((c) => c !== 2)) return null;
  // Matched cards come in matching pairs.
  for (const [f] of count) {
    const at = g.faces.flatMap((x, i) => (x === f ? [i] : []));
    if (g.matched[at[0]!] !== g.matched[at[1]!]) return null;
  }
  const players = g.players === 2 ? 2 : 1;
  const scores: [number, number] = Array.isArray(g.scores) ? [Math.max(0, Number(g.scores[0]) || 0), Math.max(0, Number(g.scores[1]) || 0)] : [0, 0];
  return {
    layout: g.layout as LayoutId,
    faces: g.faces,
    matched: g.matched.map(Boolean),
    open: [],
    moves: Math.max(0, Number(g.moves) || 0),
    players,
    turn: g.turn === 1 && players === 2 ? 1 : 0,
    scores,
  };
}
