// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { mountPingPong, unmountPingPong } from "../src/client/ping-pong/ui";
import {
  BALL_R,
  LEVELS,
  POINT_PAUSE,
  TABLE_L,
  cleanRecord,
  matchWinner,
  newGame,
  serverFor,
  step,
  type Game,
  type Input,
} from "../src/shared/ping-pong";

/** Paddle parked far out of the way. */
const AWAY: Input = { x: -2, y: -TABLE_L / 2 - 0.9, swing: false };

/** A rally state: the computer hit last and the ball is in flight (no bounce yet on the player's side). */
function rally(ball: Partial<Game["ball"]>, patch: Partial<Game> = {}): Game {
  const g = newGame(1, 3);
  return {
    ...g,
    phase: "rally",
    serveStage: 2,
    lastHitter: "c",
    bounces: 0,
    ball: { x: 0, y: -0.6, z: 0.3, vx: 0, vy: 0, vz: 0, spin: 0, ...ball },
    ...patch,
  };
}

function run(g: Game, input: Input, seconds: number, until?: (g: Game) => boolean): Game {
  for (let i = 0; i < seconds * 120; i++) {
    g = step(g, input, 1 / 120);
    if (until?.(g)) break;
  }
  return g;
}

/** A player that follows the ball across and stands a little behind the end line. */
const tracker = (g: Game): Input => ({ x: g.ball.vy < 0 ? g.ball.x : 0, y: -TABLE_L / 2 - 0.3, swing: false });

describe("ping pong physics", () => {
  it("loses height on each bounce, and two bounces on one side end the point", () => {
    let g = rally({ y: -0.6, z: 0.5 });
    let peak = 0;
    let bounced = false;
    for (let i = 0; i < 240 && g.phase === "rally"; i++) {
      g = step(g, AWAY, 1 / 120);
      if (g.bounces === 1) bounced = true;
      if (bounced) peak = Math.max(peak, g.ball.z);
    }
    expect(bounced).toBe(true);
    expect(peak).toBeLessThan(0.5);
    expect(peak).toBeGreaterThan(0.25);
    expect(g.phase).toBe("point");
    expect(g.lastPoint).toEqual({ winner: "c", reason: "double" });
  });

  it("stops a low ball at the net and gives the point against the hitter", () => {
    let g = rally({ y: -0.5, z: 0.08, vy: 5, vz: 0.2 }, { lastHitter: "p" });
    g = run(g, AWAY, 1, (s) => s.phase !== "rally");
    expect(g.lastPoint).toEqual({ winner: "c", reason: "net" });
    expect(g.ball.y).toBeLessThan(0.05);
  });

  it("calls a long ball out against the hitter", () => {
    let g = rally({ y: -1, z: 0.3, vy: 9, vz: 1.5 }, { lastHitter: "p" });
    g = run(g, AWAY, 3, (s) => s.phase !== "rally");
    expect(g.lastPoint?.winner).toBe("c");
    expect(g.lastPoint?.reason).toBe("out");
  });

  it("returns the ball over the net onto the far half when the paddle meets it", () => {
    // The computer serves (score 0–2), the player's paddle follows the ball.
    let g: Game = { ...newGame(1, 5), score: [0, 2], phase: "point", timer: POINT_PAUSE };
    g = step(g, tracker(g), 1 / 120);
    expect(g.server).toBe("c");
    let returned = false;
    let landed = false;
    for (let i = 0; i < 6 * 120 && !landed && g.phase !== "point"; i++) {
      g = step(g, tracker(g), 1 / 120);
      if (g.lastHitter === "p" && g.phase === "rally") returned = true;
      if (returned && g.bounces === 1 && g.ball.y > 0) landed = true;
    }
    expect(returned).toBe(true);
    expect(landed).toBe(true);
  });

  it("never lets a fast ball pass through a paddle in its path", () => {
    for (const speed of [6, 10, 14, 18]) {
      // Bounced on the player's side already, flying fast straight at the paddle.
      let g = rally({ x: 0.1, y: -1.2, z: 0.25, vy: -speed, vz: 0 }, { bounces: 1 });
      g = { ...g, player: { ...g.player, x: 0.1, y: -1.65, z: 0.25 } };
      let hit = false;
      for (let i = 0; i < 120 && !hit; i++) {
        g = step(g, { x: 0.1, y: -1.65, swing: false }, 1 / 120);
        if (g.lastHitter === "p") hit = true;
      }
      expect(hit, `speed ${speed}`).toBe(true);
    }
  });

  it("ends the point when the ball dies on the table, within a few seconds", () => {
    let g = rally({ y: -0.8, z: BALL_R, vy: 0, vz: 0 }, { bounces: 0 });
    g = run(g, AWAY, 5, (s) => s.phase !== "rally");
    expect(g.phase).toBe("point");
    expect(g.lastPoint?.winner).toBe("c");
    // And a ball resting on the floor is out of play at once.
    let floor = rally({ y: -2, z: -0.7, vy: 0, vz: 0 }, { bounces: 1 });
    floor = step(floor, AWAY, 1 / 60);
    expect(floor.phase).toBe("point");
  });

  it("steps the same way for the same inputs", () => {
    const play = () => {
      let g = newGame(2, 11);
      for (let i = 0; i < 60 * 20; i++) g = step(g, { ...tracker(g), swing: i % 60 === 0 }, 1 / 60);
      return JSON.stringify(g);
    };
    expect(play()).toBe(play());
  });
});

describe("ping pong rules", () => {
  it("changes serve every two points, and every point from 10–10", () => {
    expect(serverFor([0, 0])).toBe("p");
    expect(serverFor([1, 0])).toBe("p");
    expect(serverFor([1, 1])).toBe("c");
    expect(serverFor([2, 1])).toBe("c");
    expect(serverFor([2, 2])).toBe("p");
    expect(serverFor([10, 10])).toBe("p");
    expect(serverFor([11, 10])).toBe("c");
    expect(serverFor([11, 11])).toBe("p");
  });

  it("needs 11 points and two clear to win", () => {
    expect(matchWinner([11, 5])).toBe("p");
    expect(matchWinner([11, 10])).toBe(null);
    expect(matchWinner([12, 10])).toBe("p");
    expect(matchWinner([9, 11])).toBe("c");
    expect(matchWinner([10, 10])).toBe(null);
  });

  it("plays a whole match to a winner with legal serves (no endless lets or stuck points)", () => {
    let g = newGame(0, 21);
    for (let i = 0; i < 60 * 600 && g.phase !== "over"; i++) {
      const swing = g.phase === "serve" && g.server === "p";
      g = step(g, { ...tracker(g), swing }, 1 / 60);
    }
    expect(g.phase).toBe("over");
    expect(g.winner).not.toBeNull();
  });

  it("has the computer on hard return most balls a steady player sends", () => {
    let g = newGame(2, 31);
    let cpuShots = 0;
    let cpuErrors = 0;
    let last = g.lastHitter;
    let rallies = g.rallies;
    for (let i = 0; i < 60 * 180 && g.phase !== "over"; i++) {
      const swing = g.phase === "serve" && g.server === "p";
      g = step(g, { ...tracker(g), swing }, 1 / 60);
      if (g.lastHitter !== last) {
        if (g.lastHitter === "c" && g.serveStage === 2) cpuShots++;
        last = g.lastHitter;
      }
      if (g.rallies !== rallies) {
        rallies = g.rallies;
        if (g.lastPoint?.winner === "p") cpuErrors++;
      }
    }
    expect(cpuShots).toBeGreaterThan(30);
    expect(cpuErrors / cpuShots).toBeLessThan(0.15);
  });

  it("reads back a saved record and drops bad values", () => {
    expect(cleanRecord({ wins: [1, 2, 3], losses: [0, 0, 4], level: 2 })).toEqual({ wins: [1, 2, 3], losses: [0, 0, 4], level: 2 });
    expect(cleanRecord({ wins: [1, -2, "x"], level: 7 })).toEqual({ wins: [0, 0, 0], losses: [0, 0, 0], level: 1 });
    expect(cleanRecord(null).level).toBe(1);
    expect(LEVELS).toEqual([0, 1, 2]);
  });
});

describe("ping pong page", () => {
  it("mounts without WebGL or three.js, and Play falls back to the retry cover", async () => {
    window.localStorage.clear();
    const host = document.createElement("div");
    document.body.append(host);
    mountPingPong(host);
    expect(host.querySelector("h1")).not.toBeNull();
    expect(host.querySelector("[data-out=stage]")).not.toBeNull();
    expect(host.querySelector("canvas")).toBeNull();
    expect(host.querySelector("[data-out=you]")!.textContent).toBe("0");
    // New match before Play keeps the cover (its Play button is the only way in).
    host.querySelector<HTMLButtonElement>("[data-act=restart]")!.click();
    expect(host.querySelector(".g3d-cover")?.hasAttribute("hidden")).toBe(false);
    const play = host.querySelector<HTMLButtonElement>("[data-act=play]")!;
    play.click();
    for (let i = 0; i < 100 && play.textContent !== "Try again"; i++) await new Promise((r) => setTimeout(r, 50));
    expect(host.querySelector("canvas")).toBeNull();
    expect(host.querySelector(".g3d-cover")?.hasAttribute("hidden")).toBe(false);
    // The level is kept for the next visit.
    const sel = host.querySelector<HTMLSelectElement>("[data-in=level]")!;
    sel.value = "2";
    sel.dispatchEvent(new Event("change"));
    expect(JSON.parse(window.localStorage.getItem("cvcm.pingpong.v1")!).level).toBe(2);
    unmountPingPong();
    host.remove();
  });
});
