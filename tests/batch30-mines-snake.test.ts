import { describe, expect, it } from "vitest";
import { seeded } from "../src/shared/random";
import { LEVELS, chord, clampSize, count, flagsLeft, neighbours, newBoard, reveal, toggleFlag, type Board } from "../src/shared/minesweeper";
import { COLS, ROWS, newSnake, step, turn, type Snake } from "../src/shared/snake";

const below = (seed: number) => {
  const r = seeded(seed);
  return (n: number) => Math.floor(r() * n);
};

/** A board with mines exactly where given (status playing). */
function fixed(rows: number, cols: number, mines: number[]): Board {
  const b = newBoard(rows, cols, mines.length);
  b.mine = new Array<boolean>(rows * cols).fill(false);
  for (const m of mines) b.mine[m] = true;
  b.status = "playing";
  return b;
}

describe("minesweeper", () => {
  it("never puts a mine on the first click or its neighbours", () => {
    for (const lvl of Object.values(LEVELS)) {
      for (let seed = 1; seed <= 30; seed++) {
        const first = seed % (lvl.rows * lvl.cols);
        const b = reveal(newBoard(lvl.rows, lvl.cols, lvl.mines), first, below(seed));
        expect(b.mine.filter(Boolean)).toHaveLength(lvl.mines);
        for (const i of [first, ...neighbours(b, first)]) expect(b.mine[i]).toBe(false);
        expect(b.status).not.toBe("lost");
        // The first click is a zero, so it opened an area.
        expect(b.state.filter((s) => s === "open").length).toBeGreaterThan(1);
      }
    }
  });

  it("flood-fills zeros up to the numbers", () => {
    // 3 × 3, one mine in the corner: opening the far corner opens everything else.
    const b = reveal(fixed(3, 3, [0]), 8, () => 0);
    expect(b.state.filter((s) => s === "open")).toHaveLength(8);
    expect(b.status).toBe("won");
    expect(b.state[0]).toBe("flag");
  });

  it("chords only with the right number of flags", () => {
    // 3 × 4: mines at 0 and 3; open the 1 at index 1.
    let b = fixed(3, 4, [0, 3]);
    b = reveal(b, 1, () => 0);
    expect(count(b, 1)).toBe(1);
    expect(chord(b, 1)).toBe(b);
    b = toggleFlag(b, 0);
    const c = chord(b, 1);
    expect(c.state[4]).toBe("open");
    expect(c.status).toBe("playing");
  });

  it("a wrong flag makes a chord set off a mine", () => {
    let b = fixed(3, 4, [0, 3]);
    b = reveal(b, 1, () => 0);
    b = toggleFlag(b, 4);
    const c = chord(b, 1);
    expect(c.status).toBe("lost");
    expect(c.hit).toBe(0);
  });

  it("opening a mine loses; flags block reveals; no moves after the end", () => {
    let b = fixed(2, 2, [3]);
    b = toggleFlag(b, 3);
    expect(reveal(b, 3, () => 0)).toBe(b);
    expect(flagsLeft(b)).toBe(0);
    b = toggleFlag(b, 3);
    const lost = reveal(b, 3, () => 0);
    expect(lost.status).toBe("lost");
    expect(reveal(lost, 0, () => 0)).toBe(lost);
  });

  it("clamps custom sizes", () => {
    expect(clampSize(2, 99, 9999)).toEqual({ rows: 5, cols: 40, mines: 5 * 40 - 9 });
    expect(clampSize(10, 10, 0)).toEqual({ rows: 10, cols: 10, mines: 1 });
    expect(clampSize(NaN, 12.4, 20)).toEqual({ rows: 5, cols: 12, mines: 20 });
  });
});

const seq = (...values: number[]) => () => values.shift() ?? 0;

describe("snake", () => {
  it("moves, grows on food and places new food on a free cell", () => {
    let s = newSnake(true, seeded(20));
    s = { ...s, food: { x: 6, y: s.body[0]!.y } };
    const r = step(s, seq(0));
    expect(r.ate).toBe(true);
    expect(r.snake.body).toHaveLength(4);
    expect(r.snake.score).toBe(1);
    expect(r.snake.body.some((p) => p.x === r.snake.food.x && p.y === r.snake.food.y)).toBe(false);
    const moved = step({ ...r.snake, food: { x: 0, y: 0 } }, seq(0)).snake;
    expect(moved.body).toHaveLength(4);
    expect(moved.body[0]).toEqual({ x: 7, y: s.body[0]!.y });
  });

  it("ends at a wall, or wraps without walls", () => {
    const base = newSnake(true, seeded(1));
    const atEdge: Snake = { ...base, body: [{ x: COLS - 1, y: 3 }, { x: COLS - 2, y: 3 }], food: { x: 0, y: 0 } };
    expect(step(atEdge, seq()).snake.over).toBe(true);
    const wrapped = step({ ...atEdge, walls: false, food: { x: 5, y: 5 } }, seq()).snake;
    expect(wrapped.over).toBe(false);
    expect(wrapped.body[0]).toEqual({ x: 0, y: 3 });
    const top: Snake = { ...base, walls: false, dir: "up", body: [{ x: 4, y: 0 }, { x: 4, y: 1 }], food: { x: 9, y: 9 } };
    expect(step(top, seq()).snake.body[0]).toEqual({ x: 4, y: ROWS - 1 });
  });

  it("ends when the head hits the body, but may follow its own tail", () => {
    const base = newSnake(true, seeded(1));
    // A 2 × 2 loop: moving into the tail's cell is fine because the tail moves away.
    const loop: Snake = { ...base, dir: "up", body: [{ x: 5, y: 5 }, { x: 6, y: 5 }, { x: 6, y: 4 }, { x: 5, y: 4 }], food: { x: 0, y: 0 } };
    expect(step(loop, seq()).snake.over).toBe(false);
    const hit: Snake = { ...loop, body: [{ x: 5, y: 5 }, { x: 6, y: 5 }, { x: 6, y: 4 }, { x: 5, y: 4 }, { x: 4, y: 4 }] };
    expect(step(hit, seq()).snake.over).toBe(true);
  });

  it("ignores reversing and keeps at most two queued turns", () => {
    let s = newSnake(true, seeded(1));
    expect(turn(s, "left")).toBe(s);
    expect(turn(s, "right")).toBe(s);
    s = turn(turn(s, "up"), "left");
    expect(s.queue).toEqual(["up", "left"]);
    expect(turn(s, "down")).toBe(s);
    const head = s.body[0]!;
    s = { ...s, food: { x: 0, y: 0 } };
    s = step(s, seq()).snake;
    expect(s.body[0]).toEqual({ x: head.x, y: head.y - 1 });
    s = step(s, seq()).snake;
    expect(s.body[0]).toEqual({ x: head.x - 1, y: head.y - 1 });
    expect(s.dir).toBe("left");
  });

  it("the first food is the same for the same seed", () => {
    expect(newSnake(true, seeded(20)).food).toEqual(newSnake(true, seeded(20)).food);
  });
});
