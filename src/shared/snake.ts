/**
 * Snake, written for cv.cm: a 20 × 20 grid, one step per tick. Turns wait in a queue of at most two so a quick
 * "up, left" is not lost between ticks; a turn straight back into the snake's own neck is ignored. With walls on,
 * leaving the grid ends the game; with walls off the snake comes out the other side. Plain data, so a step is testable.
 */

export const COLS = 20;
export const ROWS = 20;
export type Dir = "up" | "right" | "down" | "left";
export type Point = { x: number; y: number };
export type Snake = {
  /** Head first. */
  body: Point[];
  dir: Dir;
  queue: Dir[];
  food: Point;
  walls: boolean;
  score: number;
  over: boolean;
};

const VEC: Record<Dir, Point> = { up: { x: 0, y: -1 }, right: { x: 1, y: 0 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 } };
const OPPOSITE: Record<Dir, Dir> = { up: "down", down: "up", left: "right", right: "left" };
export const MAX_QUEUE = 2;

/** `rand()` is uniform in [0, 1). Returns null when the snake fills the grid. */
export function placeFood(body: readonly Point[], rand: () => number): Point | null {
  const taken = new Set(body.map((p) => p.y * COLS + p.x));
  const free: number[] = [];
  for (let i = 0; i < COLS * ROWS; i++) if (!taken.has(i)) free.push(i);
  if (!free.length) return null;
  const i = free[Math.min(free.length - 1, Math.floor(rand() * free.length))]!;
  return { x: i % COLS, y: Math.floor(i / COLS) };
}

export function newSnake(walls: boolean, rand: () => number): Snake {
  const y = Math.floor(ROWS / 2);
  const body = [{ x: 5, y }, { x: 4, y }, { x: 3, y }];
  return { body, dir: "right", queue: [], food: placeFood(body, rand)!, walls, score: 0, over: false };
}

/** Queues a turn; ignored when it repeats or reverses the direction it would follow, or the queue is full. */
export function turn(s: Snake, dir: Dir): Snake {
  if (s.over) return s;
  const last = s.queue.length ? s.queue[s.queue.length - 1]! : s.dir;
  if (dir === last || dir === OPPOSITE[last] || s.queue.length >= MAX_QUEUE) return s;
  return { ...s, queue: [...s.queue, dir] };
}

export type StepResult = { snake: Snake; ate: boolean };

export function step(s: Snake, rand: () => number): StepResult {
  if (s.over) return { snake: s, ate: false };
  const [next, ...queue] = s.queue;
  const dir = next ?? s.dir;
  const v = VEC[dir];
  const head = s.body[0]!;
  let nx = head.x + v.x;
  let ny = head.y + v.y;
  if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) {
    if (s.walls) return { snake: { ...s, dir, queue, over: true }, ate: false };
    nx = (nx + COLS) % COLS;
    ny = (ny + ROWS) % ROWS;
  }
  const ate = nx === s.food.x && ny === s.food.y;
  // The tail moves away this tick unless the snake grows, so the head may take the tail's old cell.
  const keep = ate ? s.body : s.body.slice(0, -1);
  if (keep.some((p) => p.x === nx && p.y === ny)) return { snake: { ...s, dir, queue, over: true }, ate: false };
  const body = [{ x: nx, y: ny }, ...keep];
  if (!ate) return { snake: { ...s, body, dir, queue }, ate };
  const food = placeFood(body, rand);
  // A full grid ends the game as a win (food is null): keep the old food out of the way.
  return { snake: { ...s, body, dir, queue, score: s.score + 1, food: food ?? s.food, over: !food }, ate };
}
