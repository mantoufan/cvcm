import { describe, expect, it } from "vitest";
import { seeded } from "../src/shared/random";
import { SIZES, clueOf, cluesFor, generate, isSolved, lineDone, solve, solveLine } from "../src/shared/nonogram";
import { FACE_COUNT, deal, flip, fromSaved, missShowing, settleMiss, won, type Game } from "../src/shared/memory-game";

describe("nonogram", () => {
  it("computes clues, with empty lines as []", () => {
    expect(clueOf([1, 1, 0, 1, 0])).toEqual([2, 1]);
    expect(clueOf([0, 0, 0])).toEqual([]);
    expect(clueOf([1, 1, 1])).toEqual([3]);
  });

  it("deduces only what every placement agrees on", () => {
    expect(solveLine([3], [-1, -1, -1, -1])).toEqual([-1, 1, 1, -1]);
    expect(solveLine([2, 1], [-1, -1, -1, -1])).toEqual([1, 1, 0, 1]);
    expect(solveLine([], [-1, -1, -1])).toEqual([0, 0, 0]);
    expect(solveLine([1], [-1, 1, -1])).toEqual([0, 1, 0]);
    expect(solveLine([3], [0, 0, -1, -1])).toBeNull();
    expect(solveLine([1, 1], [1, 1, -1])).toBeNull();
  });

  it("leaves a two-solution puzzle unsolved by line logic", () => {
    // A 2 × 2 diagonal: rows [1][1], cols [1][1] has two solutions.
    const grid = solve([[1], [1]], [[1], [1]]);
    expect(grid).toEqual([-1, -1, -1, -1]);
    expect(solve([[2], [0]], [[1], [0]])).toBeNull();
  });

  it("generates the same puzzle for a number, solvable by logic alone", () => {
    for (const size of SIZES) {
      for (const n of [1, 2, 777, 999_999]) {
        const p = generate(size, n);
        expect(generate(size, n).solution).toEqual(p.solution);
        expect(p.solution).toHaveLength(size * size);
        const { rows, cols } = cluesFor(p.solution, size);
        expect(rows).toEqual(p.rows);
        expect(cols).toEqual(p.cols);
        expect(solve(p.rows, p.cols)).toEqual(p.solution);
      }
    }
    expect(generate(10, 1).solution).not.toEqual(generate(10, 2).solution);
  });

  it("wins on the filled cells alone and greys finished clues", () => {
    const p = generate(5, 1);
    const marks = p.solution.map((v) => (v ? 1 : 2));
    expect(isSolved(marks, p.solution)).toBe(true);
    expect(isSolved(p.solution.map((v) => (v ? 1 : 0)), p.solution)).toBe(true);
    const wrong = p.solution.slice();
    wrong[wrong.indexOf(0)] = 1;
    expect(isSolved(wrong, p.solution)).toBe(false);
    expect(lineDone([1, 1, 2, 1, 0], [2, 1])).toBe(true);
    expect(lineDone([1, 0, 0, 0, 0], [2])).toBe(false);
    expect(lineDone([0, 2, 0], [])).toBe(true);
  });
});

describe("memory game", () => {
  it("deals every face exactly twice, from a fixed seed the same way", () => {
    for (const layout of ["4x4", "4x5", "6x6"] as const) {
      const g = deal(layout, 1, seeded(1));
      const count = new Map<number, number>();
      for (const f of g.faces) count.set(f, (count.get(f) ?? 0) + 1);
      expect([...count.values()].every((c) => c === 2)).toBe(true);
      expect(count.size).toBe(g.faces.length / 2);
      expect(Math.max(...g.faces)).toBeLessThan(FACE_COUNT);
    }
    expect(deal("6x6", 1, seeded(1)).faces).toEqual(deal("6x6", 1, seeded(1)).faces);
  });

  const pairOf = (g: Game, i: number) => g.faces.findIndex((f, j) => j !== i && f === g.faces[i]);
  const missOf = (g: Game, i: number) => g.faces.findIndex((f, j) => j !== i && !g.matched[j] && f !== g.faces[i]);

  it("keeps a match up and turns a miss back on the next tap", () => {
    let g = deal("4x4", 1, seeded(3));
    g = flip(g, 0);
    expect(g.open).toEqual([0]);
    expect(flip(g, 0)).toBe(g); // the same card again does nothing
    g = flip(g, pairOf(g, 0));
    expect(g.matched[0]).toBe(true);
    expect(g.open).toEqual([]);
    expect(g.moves).toBe(1);
    const a = g.faces.findIndex((_, j) => !g.matched[j]);
    const b = missOf(g, a);
    g = flip(flip(g, a), b);
    expect(missShowing(g)).toBe(true);
    expect(g.moves).toBe(2);
    const c = g.faces.findIndex((_, j) => !g.matched[j] && j !== a && j !== b);
    g = flip(g, c);
    expect(g.open).toEqual([c]);
    expect(won(g)).toBe(false);
  });

  it("gives two players turns: a match plays again, a miss passes", () => {
    let g = deal("4x4", 2, seeded(5));
    g = flip(flip(g, 0), pairOf(g, 0));
    expect(g.scores).toEqual([1, 0]);
    expect(g.turn).toBe(0);
    const a = g.faces.findIndex((_, j) => !g.matched[j]);
    g = flip(flip(g, a), missOf(g, a));
    g = settleMiss(g);
    expect(g.turn).toBe(1);
    expect(g.open).toEqual([]);
  });

  it("finishes the board and rejects saves that are not real deals", () => {
    let g = deal("4x4", 1, seeded(9));
    for (let i = 0; i < g.faces.length; i++) if (!g.matched[i]) g = flip(flip(g, i), pairOf(g, i));
    expect(won(g)).toBe(true);
    expect(g.moves).toBe(8);
    expect(fromSaved({ ...g })).not.toBeNull();
    expect(fromSaved({ ...g, faces: g.faces.map(() => 0) })).toBeNull();
    const bad = g.matched.slice();
    bad[0] = false;
    expect(fromSaved({ ...g, matched: bad })).toBeNull();
  });
});
