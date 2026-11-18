// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { formatTime, mountMagicCube, unmountMagicCube } from "../src/client/magic-cube/ui";
import {
  applyMove, applyMoves, cloneCube, CUBE_SIZES, faceMove, FACES, inverse, isSolved, movedCubies, moveToken, newCube,
  parseNotation, parseSequence, parseToken, sameState, scramble, scrambleLength, type Move,
} from "../src/shared/magic-cube";
import { seeded } from "../src/shared/random";

describe("magic cube model", () => {
  it("builds the visible cubies", () => {
    expect(newCube(2).cubies).toHaveLength(8);
    expect(newCube(3).cubies).toHaveLength(26);
    expect(newCube(4).cubies).toHaveLength(56);
    for (const n of CUBE_SIZES) expect(isSolved(newCube(n))).toBe(true);
  });

  it("returns to start after any quarter turn four times", () => {
    for (const n of CUBE_SIZES) {
      for (const axis of [0, 1, 2] as const) {
        for (let layer = -1; layer < n; layer++) {
          const cube = newCube(n);
          const mv: Move = { axis, layer, turns: 1 };
          applyMove(cube, mv);
          if (layer >= 0) expect(isSolved(cube)).toBe(false);
          for (let i = 0; i < 3; i++) applyMove(cube, mv);
          expect(sameState(cube, newCube(n))).toBe(true);
        }
      }
    }
  });

  it("(R U R' U') six times is the identity on 3×3", () => {
    const cube = newCube(3);
    const sexy = parseSequence(3, "R U R' U'");
    for (let i = 0; i < 5; i++) applyMoves(cube, sexy);
    expect(isSolved(cube)).toBe(false);
    applyMoves(cube, sexy);
    expect(sameState(cube, newCube(3))).toBe(true);
  });

  it("undoes a scramble with its inverse", () => {
    for (const n of CUBE_SIZES) {
      const rand = seeded(7 + n);
      const s = scramble(n, rand);
      expect(s).toHaveLength(scrambleLength(n));
      for (let i = 1; i < s.length; i++) expect(s[i]!.axis).not.toBe(s[i - 1]!.axis);
      const cube = newCube(n);
      applyMoves(cube, s);
      expect(isSolved(cube)).toBe(false);
      applyMoves(cube, inverse(s));
      expect(sameState(cube, newCube(n))).toBe(true);
    }
  });

  it("counts a whole-cube turn as solved", () => {
    const cube = newCube(3);
    applyMoves(cube, parseSequence(3, "x y2 z'"));
    expect(sameState(cube, newCube(3))).toBe(false);
    expect(isSolved(cube)).toBe(true);
    // A 3×3 M E S cycle moved with matching faces is a whole-cube turn too.
    const c2 = newCube(3);
    applyMoves(c2, parseSequence(3, "R M' L'"));
    expect(isSolved(c2)).toBe(true);
  });

  it("turns inner slices on 4×4 and the one layer of a 2×2", () => {
    const four = newCube(4);
    expect(movedCubies(four, { axis: 0, layer: 1, turns: 1 })).toHaveLength(12);
    expect(movedCubies(four, { axis: 0, layer: 0, turns: 1 })).toHaveLength(16);
    applyMove(four, { axis: 0, layer: 1, turns: 1 });
    applyMove(four, { axis: 0, layer: 2, turns: -1 });
    expect(isSolved(four)).toBe(false);
    applyMove(four, { axis: 0, layer: 2, turns: 1 });
    applyMove(four, { axis: 0, layer: 1, turns: -1 });
    expect(sameState(four, newCube(4))).toBe(true);
    const two = newCube(2);
    applyMove(two, faceMove(2, "R"));
    applyMove(two, faceMove(2, "L", true));
    expect(isSolved(two)).toBe(true);
  });

  it("maps notation and save tokens", () => {
    expect(parseNotation(3, "R")).toEqual({ axis: 0, layer: 2, turns: -1 });
    expect(parseNotation(3, "L'")).toEqual({ axis: 0, layer: 0, turns: -1 });
    expect(parseNotation(3, "U2")).toEqual({ axis: 1, layer: 2, turns: 2 });
    expect(parseNotation(4, "M")).toBeNull();
    expect(parseNotation(3, "Q")).toBeNull();
    for (const f of FACES) {
      const mv = faceMove(4, f, true);
      expect(parseToken(4, moveToken(mv))).toEqual(mv);
    }
    expect(parseToken(3, "x3+")).toBeNull();
    expect(parseToken(3, "y*2")).toEqual({ axis: 1, layer: -1, turns: 2 });
    const a = newCube(3);
    const b = cloneCube(a);
    applyMove(b, faceMove(3, "F"));
    expect(sameState(a, newCube(3))).toBe(true);
  });
});

describe("magic cube page", () => {
  afterEach(() => {
    unmountMagicCube();
    document.body.innerHTML = "";
    window.localStorage.clear();
  });

  const mount = () => {
    const host = document.createElement("div");
    document.body.append(host);
    mountMagicCube(host);
    return host;
  };

  it("formats times", () => {
    expect(formatTime(0)).toBe("0:00.00");
    expect(formatTime(83456)).toBe("1:23.45");
  });

  it("scrambles, ignores turn buttons before Play, restores a save, and falls back without WebGL", async () => {
    let host = mount();
    const undo = host.querySelector<HTMLButtonElement>('[data-act="undo"]')!;
    expect(undo.disabled).toBe(true);
    host.querySelector<HTMLButtonElement>('[data-act="scramble"]')!.click();
    // No cube is drawn before Play, so the turn buttons do nothing (and the solve clock does not start).
    host.querySelector<HTMLButtonElement>('[data-move="R"]')!.click();
    expect(host.querySelector('[data-out="moves"]')!.textContent).toBe("0");
    const saved = JSON.parse(window.localStorage.getItem("cvcm.magiccube.v1")!);
    expect(saved.scramble).toHaveLength(25);
    expect(saved.moves).toEqual([]);
    unmountMagicCube();
    host.remove();
    // A save with two turns is replayed on the next visit.
    window.localStorage.setItem("cvcm.magiccube.v1", JSON.stringify({ ...saved, moves: ["x2-", "y2+"], timing: true }));
    host = mount();
    expect(host.querySelector('[data-out="moves"]')!.textContent).toBe("2");
    host.querySelector<HTMLButtonElement>('[data-act="undo"]')!.click();
    expect(host.querySelector('[data-out="moves"]')!.textContent).toBe("1");
    // No WebGL in happy-dom: Play ends on the retry cover, the page keeps working.
    host.querySelector<HTMLButtonElement>('[data-act="play"]')!.click();
    for (let i = 0; i < 100 && host.querySelector('[data-act="play"]')!.textContent !== "Try again"; i++) {
      await new Promise((r) => setTimeout(r, 50));
    }
    expect(host.querySelector<HTMLElement>(".g3d-cover")!.hidden).toBe(false);
    expect(host.querySelector('[data-act="play"]')!.textContent).toBe("Try again");
  });

  it("starts over on a size change", () => {
    const host = mount();
    const sel = host.querySelector<HTMLSelectElement>('[data-in="size"]')!;
    sel.value = "4";
    sel.dispatchEvent(new Event("change"));
    host.querySelector<HTMLButtonElement>('[data-act="scramble"]')!.click();
    const saved = JSON.parse(window.localStorage.getItem("cvcm.magiccube.v1")!);
    expect(saved.size).toBe(4);
    expect(saved.scramble).toHaveLength(40);
  });
});
