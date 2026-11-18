// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import {
  KNIGHT_HEAD,
  PHI_MAX,
  PHI_MIN,
  PROFILES,
  cameraRadius,
  clampPhi,
  homeTheta,
  parseSaved,
  squareAt,
  squareToWorld,
  stepCursor,
  viewQuadrant,
  worldToSquare,
} from "../src/shared/chess3d";
import { replay, uci } from "../src/client/chess/rules";
import { mountChess3d, unmountChess3d } from "../src/client/3d-chess/ui";

describe("3d chess board coordinates", () => {
  it("maps every square to its centre and back", () => {
    for (let f = 0; f < 8; f++) {
      for (let r = 0; r < 8; r++) {
        const sq = squareAt(f, r);
        const { x, z } = squareToWorld(sq);
        expect(worldToSquare(x, z)).toBe(sq);
        expect(worldToSquare(x + 0.45, z - 0.45)).toBe(sq);
      }
    }
    expect(squareToWorld("a1")).toEqual({ x: -3.5, z: 3.5 });
    expect(squareToWorld("h8")).toEqual({ x: 3.5, z: -3.5 });
    expect(worldToSquare(4.2, 0)).toBeNull();
    expect(worldToSquare(0, -4.01)).toBeNull();
  });
});

describe("3d chess camera", () => {
  it("puts each side at the bottom and keeps the tilt in range", () => {
    expect(viewQuadrant(homeTheta("w"))).toBe(0);
    expect(viewQuadrant(homeTheta("b"))).toBe(2);
    expect(viewQuadrant(-Math.PI / 2)).toBe(3);
    expect(viewQuadrant(5 * Math.PI)).toBe(2);
    expect(clampPhi(-1)).toBe(PHI_MIN);
    expect(clampPhi(3)).toBe(PHI_MAX);
    expect(cameraRadius(0.6)).toBeGreaterThan(cameraRadius(1.6));
    expect(cameraRadius(0)).toBe(cameraRadius(1));
  });
});

describe("3d chess keyboard cursor", () => {
  it("moves in screen directions for white's and black's view", () => {
    expect(stepCursor("e2", "ArrowUp", 0)).toBe("e3");
    expect(stepCursor("e2", "ArrowRight", 0)).toBe("f2");
    expect(stepCursor("e7", "ArrowUp", Math.PI)).toBe("e6");
    expect(stepCursor("e7", "ArrowRight", Math.PI)).toBe("d7");
  });

  it("follows a side view and stops at the edge", () => {
    // Camera on the h-file side: up the screen goes towards the a-file, right goes up the ranks.
    expect(stepCursor("e4", "ArrowUp", Math.PI / 2)).toBe("d4");
    expect(stepCursor("e4", "ArrowRight", Math.PI / 2)).toBe("e5");
    expect(stepCursor("e4", "ArrowLeft", -Math.PI / 2)).toBe("e5");
    expect(stepCursor("a1", "ArrowLeft", 0)).toBe("a1");
    expect(stepCursor("h8", "ArrowUp", 0)).toBe("h8");
    expect(stepCursor("d4", "Enter", 0)).toBe("d4");
  });

  it("undoes every arrow with the opposite one", () => {
    const opposite: Record<string, string> = { ArrowUp: "ArrowDown", ArrowDown: "ArrowUp", ArrowLeft: "ArrowRight", ArrowRight: "ArrowLeft" };
    for (const theta of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      for (const key of Object.keys(opposite)) {
        expect(stepCursor(stepCursor("d4", key, theta), opposite[key]!, theta)).toBe("d4");
      }
    }
  });
});

describe("3d chess piece profiles", () => {
  it("climbs from the base and closes on the axis", () => {
    for (const [type, points] of Object.entries(PROFILES)) {
      expect(points[0], type).toEqual([0, 0]);
      expect(points.at(-1)![0], type).toBeCloseTo(0, 5);
      for (const [x, y] of points) {
        expect(x, type).toBeGreaterThanOrEqual(0);
        expect(x, type).toBeLessThan(0.45);
        expect(y, type).toBeGreaterThanOrEqual(0);
      }
      // The rook's top is hollow (it steps back down inside the rim); every other outline only climbs.
      if (type !== "r") for (let i = 1; i < points.length; i++) expect(points[i]![1] + 1e-9, type).toBeGreaterThanOrEqual(points[i - 1]![1]);
    }
    const heights = Object.fromEntries(Object.entries(PROFILES).map(([k, p]) => [k, Math.max(...p.map(([, y]) => y))]));
    expect(heights.p).toBeLessThan(heights.r!);
    expect(heights.q).toBeGreaterThan(heights.b!);
    expect(KNIGHT_HEAD.length).toBeGreaterThan(5);
  });
});

describe("3d chess saved game", () => {
  it("keeps valid fields and drops the rest", () => {
    expect(parseSaved(null, 5)).toEqual({ moves: [], mode: "computer", level: 1, side: "w" });
    expect(parseSaved({ moves: ["e2e4", 5, "bad", "e7e8q"], mode: "friend", level: 4, side: "b" }, 5))
      .toEqual({ moves: ["e2e4", "e7e8q"], mode: "friend", level: 4, side: "b" });
    expect(parseSaved({ level: 9 }, 5).level).toBe(1);
    expect(parseSaved({ level: 2.5 }, 5).level).toBe(1);
  });

  it("round-trips a game through UCI moves", () => {
    const game = replay(["e2e4", "e7e5", "g1f3", "b8c6", "f1c4", "g8f6", "e1g1"]);
    const moves = game.history({ verbose: true }).map(uci);
    expect(moves.at(-1)).toBe("e1g1");
    expect(replay(parseSaved({ moves }, 5).moves).fen()).toBe(game.fen());
  });
});

describe("3d chess page", () => {
  it("mounts plain DOM, restores the saved game and falls back without WebGL", async () => {
    window.localStorage.setItem("cvcm.chess3d.v1", JSON.stringify({ moves: ["e2e4", "e7e5"], mode: "friend", level: 3, side: "w" }));
    const host = document.createElement("div");
    document.body.append(host);
    mountChess3d(host);
    expect(host.querySelector("canvas")).toBeNull();
    expect(host.querySelectorAll(".c3-moves li")).toHaveLength(1);
    expect(host.querySelector<HTMLSelectElement>('[data-field="mode"]')!.value).toBe("friend");
    const play = host.querySelector<HTMLButtonElement>('[data-act="play"]')!;
    play.click();
    await new Promise((r) => setTimeout(r, 0));
    // happy-dom has no WebGL, like the prerender: the cover offers a retry and no canvas is added.
    expect(host.querySelector(".g3d-cover")!.hasAttribute("hidden")).toBe(false);
    expect(host.querySelector("canvas")).toBeNull();
    unmountChess3d();
    host.remove();
    window.localStorage.clear();
  });
});
