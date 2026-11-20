// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import {
  BALL_R,
  BOARD_BOTTOM,
  BOARD_TOP,
  BOARD_W,
  BOARD_Z,
  MAX_SPEED,
  MAX_YAW,
  RELOAD,
  RIM_TUBE,
  SHOT_MAX,
  SPOTS,
  STREAK_BONUS_FROM,
  SUBSTEP,
  TIME_LIMIT,
  cleanSaved,
  launch,
  newGame,
  pointsFor,
  resultOf,
  rimDistance,
  shoot,
  step,
  stepBall,
  type Ball,
} from "../src/shared/basketball-game";
import { seeded } from "../src/shared/random";
import { mountBasketballGame, unmountBasketballGame } from "../src/client/basketball-game/ui";

function fly(b: Ball): Ball {
  let x = b;
  for (let i = 0; i < 600 && !x.done; i++) x = stepBall(x, 1 / 120);
  return x;
}

/** The power (0–1) that drops the ball through the hoop without touching anything, found by search. */
function swishPower(spot: number): number | null {
  for (let i = 0; i <= 1000; i++) {
    const p = i / 1000;
    const b = fly(launch(spot, 0, p));
    if (resultOf(b) === "swish") return p;
  }
  return null;
}

describe("basketball physics", () => {
  it("drops a straight shot through the hoop from every spot", () => {
    for (let s = 0; s < SPOTS.length; s++) {
      const p = swishPower(s);
      expect(p, `spot ${s}`).not.toBeNull();
      const b = fly(launch(s, 0, p!));
      expect(b.made).toBe(true);
      expect(resultOf(b)).toBe("swish");
    }
  });

  it("bounces a short shot off the rim and out", () => {
    const p = swishPower(2)!;
    let rimOut = false;
    for (let d = 0.005; d < 0.08 && !rimOut; d += 0.002) {
      const b = fly(launch(2, 0, p - d));
      if (b.rim && !b.made) rimOut = true;
    }
    expect(rimOut).toBe(true);
  });

  it("banks a long shot in off the board", () => {
    let bank = false;
    for (let s = 0; s < SPOTS.length && !bank; s++) {
      const p = swishPower(s)!;
      for (let d = 0.004; d < 0.12 && !bank; d += 0.002) {
        for (const yaw of [0, 0.01, -0.01, 0.02, -0.02]) {
          const b = fly(launch(s, yaw, p + d));
          if (resultOf(b) === "bank") bank = true;
        }
      }
    }
    expect(bank).toBe(true);
  });

  it("never lets the ball through the rim or the board, even at full power", () => {
    const rand = seeded(7);
    for (let n = 0; n < 300; n++) {
      let b = launch(Math.floor(rand() * SPOTS.length), (rand() * 2 - 1) * MAX_YAW, rand() < 0.3 ? 1 : rand());
      // The worst rim and board clearance over the shot, checked once per shot: an expect() per substep made this test
      // slow enough to time out on a busy CI runner.
      let rimGap = Infinity;
      let boardGap = Infinity;
      let rimAt = "";
      let boardAt = "";
      for (let i = 0; i < (SHOT_MAX / SUBSTEP) && !b.done; i++) {
        const prevZ = b.z;
        b = stepBall(b, SUBSTEP);
        // Never inside the rim tube.
        const rim = rimDistance(b.x, b.y, b.z);
        if (rim < rimGap) { rimGap = rim; rimAt = `step ${i} at (${b.x.toFixed(3)}, ${b.y.toFixed(3)}, ${b.z.toFixed(3)})`; }
        // Never behind the board face while level with it (coming from the front).
        const level = Math.abs(b.x) < BOARD_W / 2 - BALL_R && b.y > BOARD_BOTTOM && b.y < BOARD_TOP;
        if (level && prevZ > BOARD_Z && b.z - BALL_R < boardGap) {
          boardGap = b.z - BALL_R;
          boardAt = `step ${i} at (${b.x.toFixed(3)}, ${b.y.toFixed(3)}, ${b.z.toFixed(3)})`;
        }
      }
      expect(rimGap, `shot ${n}, ${rimAt}: inside the rim`).toBeGreaterThanOrEqual(BALL_R + RIM_TUBE - 1e-6);
      expect(boardGap, `shot ${n}, ${boardAt}: through the board`).toBeGreaterThanOrEqual(BOARD_Z - 1e-6);
    }
  });

  it("always ends a shot: no ball can stay in play for good", () => {
    const rand = seeded(11);
    for (let n = 0; n < 300; n++) {
      let b = launch(Math.floor(rand() * SPOTS.length), (rand() * 2 - 1) * MAX_YAW, rand());
      for (let i = 0; i < 1000 && !b.done; i++) b = stepBall(b, 1 / 60);
      expect(b.done).toBe(true);
      expect(b.t).toBeLessThanOrEqual(SHOT_MAX + 1e-6);
    }
    // A ball dropped dead still onto the top of the rim also ends.
    let rest: Ball = { ...launch(0, 0, 0), x: 0.2286, y: 3.05 + BALL_R + RIM_TUBE + 0.001, z: 0, vx: 0, vy: 0, vz: 0 };
    for (let i = 0; i < 1000 && !rest.done; i++) rest = stepBall(rest, 1 / 60);
    expect(rest.done).toBe(true);
  });

  it("caps the launch speed", () => {
    const b = launch(4, 0, 5);
    expect(Math.hypot(b.vx, b.vy, b.vz)).toBeCloseTo(MAX_SPEED, 6);
  });

  it("gives the same flight for the same shot at any frame rate", () => {
    let a = launch(3, 0.1, 0.6);
    let b = launch(3, 0.1, 0.6);
    for (let i = 0; i < 30; i++) a = stepBall(a, 1 / 30);
    for (let i = 0; i < 120; i++) b = stepBall(b, 1 / 120);
    expect(a.x).toBeCloseTo(b.x, 9);
    expect(a.y).toBeCloseTo(b.y, 9);
    expect(a.z).toBeCloseTo(b.z, 9);
  });
});

describe("basketball game", () => {
  it("scores 2, 3 beyond the arc, and a streak bonus", () => {
    expect(pointsFor(4.6, 1)).toBe(2);
    expect(pointsFor(7.0, 1)).toBe(3);
    expect(pointsFor(4.6, STREAK_BONUS_FROM)).toBe(3);
    expect(pointsFor(7.0, STREAK_BONUS_FROM + 2)).toBe(4);
  });

  it("counts a streak of baskets and resets it on a miss", () => {
    let g = newGame("practice", 0);
    const p = swishPower(0)!;
    const settle = () => {
      for (let i = 0; i < 400 && g.balls.length; i++) g = step(g, 1 / 60).game;
      g = step(g, RELOAD).game;
    };
    for (let k = 0; k < STREAK_BONUS_FROM; k++) {
      g = shoot(g, 0, p);
      settle();
    }
    expect(g.streak).toBe(STREAK_BONUS_FROM);
    expect(g.score).toBe(2 * (STREAK_BONUS_FROM - 1) + 3);
    g = shoot(g, MAX_YAW, 0);
    settle();
    expect(g.streak).toBe(0);
    expect(g.bestStreak).toBe(STREAK_BONUS_FROM);
    expect(g.shots).toBe(STREAK_BONUS_FROM + 1);
  });

  it("waits RELOAD seconds between throws", () => {
    let g = shoot(newGame("practice"), 0, 0.5);
    expect(g.balls).toHaveLength(1);
    g = shoot(g, 0, 0.5);
    expect(g.balls).toHaveLength(1);
    g = step(g, RELOAD).game;
    g = shoot(g, 0, 0.5);
    expect(g.shots).toBe(2);
  });

  it("ends a timed game at 60 seconds once the balls are down, and never in practice", () => {
    let g = newGame("timed");
    expect(g.timeLeft).toBe(TIME_LIMIT);
    for (let i = 0; i < TIME_LIMIT * 10 - 1; i++) g = step(g, 0.1).game;
    expect(g.over).toBe(false);
    g = shoot(g, 0, 0.5);
    g = step(g, 0.2).game;
    // Time is up but a ball is still in the air: it lands first.
    expect(g.timeLeft).toBe(0);
    expect(g.over).toBe(false);
    expect(shoot(g, 0, 0.5).shots).toBe(g.shots);
    for (let i = 0; i < 100 && !g.over; i++) g = step(g, 0.1).game;
    expect(g.over).toBe(true);
    let p = newGame("practice");
    for (let i = 0; i < 1000; i++) p = step(p, 0.1).game;
    expect(p.over).toBe(false);
    expect(p.timeLeft).toBeNull();
  });

  it("moves to the next spot after three baskets in timed mode", () => {
    let g = newGame("timed");
    for (let k = 0; k < 3; k++) {
      g = shoot(g, 0, swishPower(g.spot)!);
      for (let i = 0; i < 400 && g.balls.length; i++) g = step(g, 1 / 60).game;
      g = step(g, RELOAD).game;
    }
    expect(g.makes).toBe(3);
    expect(g.spot).toBe(1);
  });

  it("is deterministic", () => {
    const run = () => {
      let g = newGame("timed");
      const rand = seeded(3);
      for (let i = 0; i < 900; i++) {
        if (i % 40 === 0) g = shoot(g, (rand() * 2 - 1) * 0.1, rand());
        g = step(g, 1 / 60).game;
      }
      return g;
    };
    expect(run()).toEqual(run());
  });

  it("reads a saved record defensively", () => {
    expect(cleanSaved(null)).toEqual({ mode: "timed", spot: 0, best: 0 });
    expect(cleanSaved({ mode: "practice", spot: 3, best: 41.7 })).toEqual({ mode: "practice", spot: 3, best: 41 });
    expect(cleanSaved({ mode: "x", spot: 99, best: -5 })).toEqual({ mode: "timed", spot: 0, best: 0 });
  });
});

describe("basketball page", () => {
  it("mounts without WebGL or three.js, and Play falls back to the retry cover", async () => {
    window.localStorage.clear();
    const host = document.createElement("div");
    document.body.append(host);
    mountBasketballGame(host);
    expect(host.querySelector("h1")).not.toBeNull();
    expect(host.querySelector("[data-out=stage]")).not.toBeNull();
    expect(host.querySelector("canvas")).toBeNull();
    // Changing the mode before Play keeps the cover (it holds the only Play button) and is saved.
    const mode = host.querySelector<HTMLSelectElement>("[data-in=mode]")!;
    mode.value = "practice";
    mode.dispatchEvent(new Event("change"));
    expect(host.querySelector(".g3d-cover")?.hasAttribute("hidden")).toBe(false);
    expect(JSON.parse(window.localStorage.getItem("cvcm.basketballgame.v1")!).mode).toBe("practice");
    const play = host.querySelector<HTMLButtonElement>("[data-act=play]")!;
    play.click();
    for (let i = 0; i < 100 && play.textContent !== "Try again"; i++) await new Promise((r) => setTimeout(r, 50));
    expect(host.querySelector("canvas")).toBeNull();
    expect(host.querySelector(".g3d-cover")?.hasAttribute("hidden")).toBe(false);
    unmountBasketballGame();
    host.remove();
  });

  it("aims to the shooter's right for a positive yaw", () => {
    // Camera behind the shooter looking at the hoop: right = forward × up.
    for (let spot = 0; spot < SPOTS.length; spot++) {
      const s = SPOTS[spot]!;
      const fx = -s.x, fz = -s.z;
      const rx = -fz, rz = fx; // forward × (0,1,0) in a right-handed y-up frame
      const b = launch(spot, 0.2, 0.5);
      expect(b.vx * rx + b.vz * rz, `spot ${spot}`).toBeGreaterThan(0);
    }
  });

  it("plays a shot the same at 60 Hz and 144 Hz", () => {
    let a = launch(2, 0.1, 0.6);
    let b = launch(2, 0.1, 0.6);
    for (let i = 0; i < 60 && !a.done; i++) a = stepBall(a, 1 / 60);
    for (let i = 0; i < 144 && !b.done; i++) b = stepBall(b, 1 / 144);
    expect(resultOf(a)).toBe(resultOf(b));
    expect(a.made).toBe(b.made);
  });
});

