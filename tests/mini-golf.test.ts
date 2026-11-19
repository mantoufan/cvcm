// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { mountMiniGolf, unmountMiniGolf } from "../src/client/mini-golf/ui";
import {
  BALL_R,
  CAPTURE_SPEED,
  COURSE_PAR,
  CUP_R,
  FRICTION,
  HOLES,
  MAX_SPEED,
  MAX_STROKES,
  SHOT_LIMIT,
  advance,
  ballAt,
  cleanSaved,
  newRound,
  outOfBounds,
  putt,
  scoreName,
  simulate,
  type Ball,
  type Hole,
} from "../src/shared/mini-golf";

const FLAT: Hole = {
  par: 2, tee: [0, 0.5], cup: [0, 9], green: [[-1, 0], [1, 0], [1, 10], [-1, 10]],
  blocks: [], bumpers: [], slopes: [], water: [], mover: null,
};

const moving = (b: Partial<Ball>): Ball => ({ ...ballAt(0, 0), moving: true, ...b });

/** A greedy putter: tries 72 directions × 12 powers and plays the one that holes or ends nearest the cup. */
function playHole(hole: Hole): { strokes: number; holed: boolean } {
  let b = ballAt(hole.tee[0], hole.tee[1]);
  let strokes = 0;
  while (strokes < MAX_STROKES) {
    let best: Ball | null = null;
    let bd = Infinity;
    for (let a = 0; a < 72 && bd >= 0; a++) {
      for (let p = 1; p <= 12; p++) {
        const r = simulate(hole, putt(b, (a / 72) * Math.PI * 2, p / 12));
        expect(r.moving).toBe(false);
        const d = r.holed ? -1 : r.wet ? 99 : Math.hypot(r.x - hole.cup[0], r.z - hole.cup[1]);
        if (d < bd) {
          bd = d;
          best = r;
        }
        if (r.holed) break;
      }
    }
    strokes++;
    if (best!.holed) return { strokes, holed: true };
    if (!best!.wet) b = { ...best!, moving: false };
  }
  return { strokes, holed: false };
}

describe("mini golf physics", () => {
  it("stops a putt on a flat green through friction alone", () => {
    const end = simulate(FLAT, putt(ballAt(0, 0.5), 0, 0.3));
    expect(end.moving).toBe(false);
    expect(end.holed).toBe(false);
    // v² / 2a is the stopping distance with drag; drag only shortens it.
    const v = 0.35 + (MAX_SPEED - 0.35) * 0.3;
    expect(end.z - 0.5).toBeLessThan((v * v) / (2 * FRICTION));
    expect(end.z - 0.5).toBeGreaterThan(0.3);
  });

  it("reflects off a wall, losing some speed, without passing through it", () => {
    let b = moving({ x: 0.8, z: 5, vx: 4, vz: 0 });
    let maxX = 0;
    for (let i = 0; i < 60; i++) {
      b = advance(FLAT, b, 1 / 120);
      maxX = Math.max(maxX, b.x);
    }
    expect(maxX).toBeLessThanOrEqual(1 - BALL_R + 1e-9);
    expect(b.vx).toBeLessThan(0);
    expect(Math.abs(b.vx)).toBeLessThan(4);
  });

  it("never tunnels through a wall at full speed", () => {
    for (let k = 0; k < 40; k++) {
      const a = (k / 40) * Math.PI * 2;
      const end = simulate(FLAT, putt(ballAt(0, 5), a, 1));
      expect(outOfBounds(FLAT, end.x, end.z)).toBe(false);
      expect(end.wet).toBe(false);
    }
  });

  it("speeds a ball rolling down a slope and slows one rolling up it", () => {
    const slope: Hole = { ...FLAT, slopes: [{ x0: -1, z0: 0, x1: 1, z1: 10, ax: 0, az: 0.5 }] };
    const down = advance(slope, moving({ z: 2, vz: 1 }), 1);
    const flat = advance(FLAT, moving({ z: 2, vz: 1 }), 1);
    const up = advance(slope, moving({ z: 2, vz: -1 }), 0.5);
    const upFlat = advance(FLAT, moving({ z: 2, vz: -1 }), 0.5);
    expect(down.vz).toBeGreaterThan(flat.vz);
    expect(Math.abs(up.vz)).toBeLessThan(Math.abs(upFlat.vz));
    // Weaker than friction: a ball at rest on the slope stays put.
    const rest = advance(slope, ballAt(0, 5), 2);
    expect(rest.z).toBe(5);
    for (const h of HOLES) for (const s of h.slopes) expect(Math.hypot(s.ax, s.az)).toBeLessThan(FRICTION);
  });

  it("drops a slow ball into the cup and lets a fast one lip out", () => {
    const slow = simulate(FLAT, { ...moving({ z: 8.75, vz: CAPTURE_SPEED * 0.6 }) });
    expect(slow.holed).toBe(true);
    const fast = simulate(FLAT, { ...moving({ z: 8.6, vz: 4 }) });
    expect(fast.holed).toBe(false);
    // It passed over the cup and carried on toward the end wall.
    expect(Math.abs(fast.z - 9)).toBeGreaterThan(CUP_R);
  });

  it("marks a ball that ends in the water", () => {
    const pond: Hole = { ...FLAT, water: [{ x0: -1, z0: 3, x1: 1, z1: 4 }] };
    const end = simulate(pond, putt(ballAt(0, 0.5), 0, 0.6));
    expect(end.wet).toBe(true);
    expect(end.moving).toBe(false);
  });

  it("is deterministic and the same at any frame rate", () => {
    const hole = HOLES[4]!;
    let a = putt(ballAt(0.1, 0.5), 0.05, 0.8);
    let b = a;
    for (let i = 0; i < 120; i++) a = advance(hole, a, 1 / 60);
    for (let i = 0; i < 240; i++) b = advance(hole, b, 1 / 120);
    expect(a.x).toBeCloseTo(b.x, 9);
    expect(a.z).toBeCloseTo(b.z, 9);
  });

  it("ends every putt within the time limit, even with the turning blocker", () => {
    const hole = HOLES[4]!;
    for (let k = 0; k < 24; k++) {
      const end = simulate(hole, putt(ballAt(0, 0.5, k * 0.37), (k / 24) * Math.PI * 2, 1));
      expect(end.moving).toBe(false);
      expect(end.shotTime).toBeLessThanOrEqual(SHOT_LIMIT + 0.1);
    }
  });

  it("can play all nine holes within the stroke limit", () => {
    expect(HOLES).toHaveLength(9);
    expect(COURSE_PAR).toBe(24);
    for (const [i, hole] of HOLES.entries()) {
      expect(outOfBounds(hole, hole.tee[0], hole.tee[1]), `tee ${i + 1}`).toBe(false);
      expect(outOfBounds(hole, hole.cup[0], hole.cup[1]), `cup ${i + 1}`).toBe(false);
      const r = playHole(hole);
      expect(r.holed, `hole ${i + 1}`).toBe(true);
      expect(r.strokes).toBeLessThanOrEqual(hole.par + 1);
    }
  });

  it("names scores against par", () => {
    expect(scoreName(1, 3)).toBe("ace");
    expect(scoreName(2, 4)).toBe("eagle");
    expect(scoreName(2, 3)).toBe("birdie");
    expect(scoreName(3, 3)).toBe("par");
    expect(scoreName(4, 3)).toBe("bogey");
    expect(scoreName(6, 3)).toBe("over");
  });

  it("reads saved rounds and rejects odd ones", () => {
    const r = newRound();
    expect(cleanSaved(null).round).toEqual(r);
    const mid = { round: { hole: 2, strokes: [2, 3, 1, 0, 0, 0, 0, 0, 0], x: 0.2, z: 1 }, best: 30 };
    expect(cleanSaved(mid)).toEqual(mid);
    // Strokes on holes not reached, a finished round, a ball off the green, a silly best: all cleaned.
    expect(cleanSaved({ round: { ...mid.round, strokes: [2, 3, 1, 4, 0, 0, 0, 0, 0] } }).round).toEqual(r);
    expect(cleanSaved({ round: { ...mid.round, hole: 9 } }).round).toEqual(r);
    expect(cleanSaved({ round: { ...mid.round, x: 5 } }).round).toMatchObject({ hole: 2, x: HOLES[2]!.tee[0], z: HOLES[2]!.tee[1] });
    expect(cleanSaved({ ...mid, best: 3 }).best).toBeNull();
    expect(cleanSaved({ round: { ...mid.round, strokes: [MAX_STROKES + 1, 0, 0, 0, 0, 0, 0, 0, 0] } }).round).toEqual(r);
  });
});

describe("mini golf page", () => {
  afterEach(() => {
    unmountMiniGolf();
    document.body.innerHTML = "";
    window.localStorage.clear();
  });

  it("mounts without three.js, restores the round, and falls back without WebGL", async () => {
    window.localStorage.setItem("cvcm.minigolf.v1", JSON.stringify({ round: { hole: 3, strokes: [2, 3, 2, 1, 0, 0, 0, 0, 0], x: 0, z: 2 }, best: 26 }));
    const host = document.createElement("div");
    document.body.append(host);
    mountMiniGolf(host);
    expect(host.querySelector("h1")).not.toBeNull();
    expect(host.querySelector("canvas")).toBeNull();
    expect(host.querySelector<HTMLButtonElement>("[data-act=putt]")!.disabled).toBe(true);
    const card = host.querySelector("[data-out=card]")!.textContent!;
    expect(card).toContain("24");
    const play = host.querySelector<HTMLButtonElement>("[data-act=play]")!;
    play.click();
    for (let i = 0; i < 100 && play.textContent !== "Try again"; i++) await new Promise((r) => setTimeout(r, 50));
    expect(host.querySelector("canvas")).toBeNull();
    expect(host.querySelector(".g3d-cover")?.hasAttribute("hidden")).toBe(false);
    // New round before a 3D view exists keeps the cover (its Play button is the only way in).
    host.querySelector<HTMLButtonElement>("[data-act=new]")!.click();
    expect(host.querySelector(".g3d-cover")?.hasAttribute("hidden")).toBe(false);
    unmountMiniGolf();
    const saved = JSON.parse(window.localStorage.getItem("cvcm.minigolf.v1")!);
    expect(saved.round.hole).toBe(0);
    expect(saved.best).toBe(26);
  });
});
