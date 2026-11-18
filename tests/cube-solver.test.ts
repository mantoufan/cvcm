// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { SOLVED, cleanFacelets, colourCounts, faceletsOf, parseSolution, randomState, solvedCube, validate } from "../src/shared/cube-solver";
import { applyMoves, isSolved, parseSequence } from "../src/shared/magic-cube";
import { seeded } from "../src/shared/random";
import { mountCubeSolver, unmountCubeSolver } from "../src/client/cube-solver/ui";
import Cube from "../src/vendor/cubejs/cube.js";

// The page runs the vendored cubejs in a worker; the tests call it directly.

const FACE_MOVES = ["U", "R", "F", "D", "L", "B"];
function randomAlg(rand: () => number, n = 25): string {
  const out: string[] = [];
  for (let i = 0; i < n; i++) out.push(FACE_MOVES[Math.floor(rand() * 6)]! + ["", "'", "2"][Math.floor(rand() * 3)]!);
  return out.join(" ");
}

function swap(s: string, a: number, b: number): string {
  const c = s.split("");
  [c[a], c[b]] = [c[b]!, c[a]!];
  return c.join("");
}

describe("cube solver model", () => {
  it("lays facelets out exactly as cubejs does", () => {
    const rand = seeded(7);
    expect(faceletsOf(solvedCube())).toBe(SOLVED);
    for (let k = 0; k < 20; k++) {
      const alg = randomAlg(rand);
      const ours = solvedCube();
      applyMoves(ours, parseSequence(3, alg));
      expect(faceletsOf(ours), alg).toBe(new Cube().move(alg).asString());
    }
  });

  it("accepts every reachable cube and names what is wrong with impossible ones", () => {
    const rand = seeded(11);
    const state = new Cube().move(randomAlg(rand)).asString();
    expect(validate(state)).toBeNull();
    expect(validate(SOLVED)).toBeNull();
    // A painted sticker missing, then a wrong colour count.
    expect(validate("?" + SOLVED.slice(1))).toEqual({ kind: "blank", n: 1 });
    expect(validate("R" + SOLVED.slice(1))?.kind).toBe("count");
    // Twisted corner (URF stickers rotated), flipped edge (UF), two corners swapped (parity).
    const twisted = SOLVED.split("");
    [twisted[8], twisted[9], twisted[20]] = [SOLVED[20]!, SOLVED[8]!, SOLVED[9]!];
    expect(validate(twisted.join(""))?.kind).toBe("twist");
    expect(validate(swap(SOLVED, 7, 19))?.kind).toBe("flip");
    const corners = swap(swap(swap(SOLVED, 8, 6), 9, 18), 20, 38);
    expect(validate(corners)?.kind).toMatch(/parity|corner/);
  });

  it("makes random states with fixed centres that always pass the check", () => {
    const rand = seeded(5);
    for (let k = 0; k < 50; k++) {
      const s = randomState(rand);
      expect(validate(s), s).toBeNull();
      expect([4, 13, 22, 31, 40, 49].map((i) => s[i]).join("")).toBe("URFDLB");
    }
  });

  it("cleans saved states and counts colours", () => {
    expect(cleanFacelets("x")).toBeNull();
    expect(cleanFacelets("?".repeat(54))!.split("").filter((c) => c !== "?")).toEqual(["U", "R", "F", "D", "L", "B"]);
    expect(colourCounts(SOLVED).U).toBe(9);
  });

  it("solves a scrambled cube: applying the solution returns it to solved", () => {
    Cube.initSolver();
    const rand = seeded(3);
    for (let k = 0; k < 3; k++) {
      const alg = randomAlg(rand);
      const state = new Cube().move(alg).asString();
      const { tokens, moves } = parseSolution(Cube.fromString(state).solve());
      expect(tokens.length).toBeLessThanOrEqual(22);
      const model = solvedCube();
      applyMoves(model, parseSequence(3, alg));
      applyMoves(model, moves);
      expect(isSolved(model)).toBe(true);
    }
  }, 60_000);
});

describe("cube solver page", () => {
  afterEach(() => {
    unmountCubeSolver();
    document.body.innerHTML = "";
    window.localStorage.clear();
  });

  const mount = () => {
    const host = document.createElement("div");
    document.body.append(host);
    mountCubeSolver(host);
    return host;
  };

  it("mounts a solved net, paints stickers, saves, and reports an impossible cube without a worker", () => {
    const host = mount();
    const stickers = host.querySelectorAll<HTMLButtonElement>(".cs-sticker");
    expect(stickers).toHaveLength(54);
    // Pick red (2nd swatch) and paint U1.
    host.querySelectorAll<HTMLButtonElement>(".cs-swatch")[1]!.click();
    stickers[0]!.click();
    expect(stickers[0]!.dataset.c).toBe("R");
    expect(JSON.parse(window.localStorage.getItem("cvcm.cubesolver.v1")!).facelets[0]).toBe("R");
    host.querySelector<HTMLButtonElement>('[data-act="solve"]')!.click();
    expect(host.querySelector('[data-out="status"]')!.textContent).not.toBe("");
    // Centres cannot be painted.
    stickers[4]!.click();
    expect(stickers[4]!.dataset.c).toBe("U");
    host.querySelector<HTMLButtonElement>('[data-act="clear"]')!.click();
    expect(host.querySelectorAll('.cs-sticker[data-c="?"]')).toHaveLength(48);
  });
});
