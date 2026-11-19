// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { mountAirHockey, unmountAirHockey } from "../src/client/air-hockey/ui";
import {
  GOAL_W,
  LEVELS,
  MALLET_R,
  PUCK_R,
  TABLE_L,
  TABLE_W,
  WIN_SCORE,
  cleanRecord,
  clampPlayer,
  collide,
  newMatch,
  step,
  type Match,
} from "../src/shared/air-hockey";

/** A match with the puck already in play (no serve pause). */
function live(patch: Partial<Match> = {}): Match {
  return { ...newMatch(), serve: 0, ...patch };
}

const PARK = { x: -TABLE_W / 2 + MALLET_R, y: -TABLE_L / 2 + MALLET_R };

describe("air hockey physics", () => {
  it("bounces the puck off a side rail, losing a little speed", () => {
    let m = live({ puck: { x: 0.3, y: -0.3, vx: 2, vy: 0 } });
    m = step(m, PARK, 0, 0.2);
    expect(m.puck.vx).toBeLessThan(0);
    expect(Math.abs(m.puck.vx)).toBeLessThan(2);
    expect(m.puck.x).toBeLessThanOrEqual(TABLE_W / 2 - PUCK_R + 1e-9);
  });

  it("bounces off the end rail beside the goal, but scores through the goal mouth", () => {
    let wall = live({ puck: { x: 0.4, y: 0.6, vx: 0, vy: 2 } });
    wall = step(wall, PARK, 0, 0.2);
    expect(wall.puck.vy).toBeLessThan(0);
    expect(wall.score).toEqual([0, 0]);

    let goal = live({ puck: { x: 0, y: -0.5, vx: 0, vy: -3 }, player: { x: 0.4, y: -0.3, vx: 0, vy: 0 } });
    goal = step(goal, { x: 0.4, y: -0.3 }, 0, 0.3);
    expect(goal.score).toEqual([0, 1]);
    expect(goal.lastGoal).toBe("ai");
    // The puck waits on the conceding (player's) side for the serve.
    expect(goal.puck.y).toBeLessThan(0);
    expect(goal.serve).toBeGreaterThan(0);
  });

  it("does not let a fast mallet pass through the puck", () => {
    // Mallet sweeps right at full speed through where the puck rests.
    let m = live({ puck: { x: 0, y: -0.4, vx: 0, vy: 0 }, player: { x: -0.4, y: -0.4, vx: 0, vy: 0 } });
    m = step(m, { x: 0.4, y: -0.4 }, 0, 0.1);
    expect(m.puck.vx).toBeGreaterThan(0.5);
    expect(m.puck.x).toBeGreaterThan(m.player.x);
  });

  it("passes the mallet's velocity to the puck", () => {
    const puck = { x: 0, y: 0.09, vx: 0, vy: 0 };
    const mallet = { x: 0, y: 0, vx: 0, vy: 3 };
    expect(collide(puck, mallet)).toBe(true);
    expect(puck.vy).toBeGreaterThan(3);
    expect(puck.y).toBeCloseTo(PUCK_R + MALLET_R, 9);
    const still = { x: 0, y: 0.09, vx: 0, vy: 0 };
    collide(still, { x: 0, y: 0, vx: 0, vy: 0 });
    expect(still.vy).toBe(0);
  });

  it("keeps the player's mallet in its own half", () => {
    expect(clampPlayer(0, 0.5).y).toBeLessThan(0);
    expect(clampPlayer(9, -9)).toEqual({ x: TABLE_W / 2 - MALLET_R, y: -TABLE_L / 2 + MALLET_R });
  });

  it("is deterministic and independent of the frame rate", () => {
    const start = live({ puck: { x: 0.1, y: 0.2, vx: -1.3, vy: 0.7 } });
    let a = start;
    let b = start;
    for (let i = 0; i < 60; i++) a = step(a, { x: 0.1, y: -0.4 }, 2, 1 / 30);
    for (let i = 0; i < 240; i++) b = step(b, { x: 0.1, y: -0.4 }, 2, 1 / 120);
    expect(a.puck.x).toBeCloseTo(b.puck.x, 6);
    expect(a.puck.y).toBeCloseTo(b.puck.y, 6);
    expect(a.score).toEqual(b.score);
  });
});

describe("air hockey computer player", () => {
  it("strikes a resting puck in its half toward the player's goal", () => {
    for (const level of [0, 1, 2] as const) {
      let m = live({ puck: { x: 0.12, y: 0.3, vx: 0, vy: 0 } });
      let shot = false;
      for (let i = 0; i < 120 && !shot; i++) {
        m = step(m, PARK, level, 1 / 60);
        if (m.puck.vy < -0.3) shot = true;
      }
      expect(shot, `level ${level}`).toBe(true);
      // Heading toward the player's end: project to the goal line ignoring rail bounces, folded into the table.
      const t = (m.puck.y + TABLE_L / 2) / -m.puck.vy;
      let x = m.puck.x + m.puck.vx * t;
      const w = TABLE_W - 2 * PUCK_R;
      x = ((((x + w / 2) % (2 * w)) + 2 * w) % (2 * w)) - w / 2;
      if (x > w / 2) x = w - x;
      expect(Math.abs(x), `level ${level}`).toBeLessThan(GOAL_W);
    }
  });

  it("ends the match at seven goals", () => {
    let m = live({ score: [WIN_SCORE - 1, 3], puck: { x: 0, y: 0.6, vx: 0, vy: 3 }, ai: { x: 0.4, y: 0.6, vx: 0, vy: 0 }, aiTarget: { x: 0.4, y: 0.6 }, aiThink: 9 });
    m = step(m, PARK, 0, 0.5);
    expect(m.score[0]).toBe(WIN_SCORE);
    expect(m.winner).toBe("player");
    const frozen = step(m, { x: 0, y: -0.2 }, 0, 1);
    expect(frozen.puck).toEqual(m.puck);
  });

  it("reads saved records defensively", () => {
    expect(cleanRecord(null)).toEqual({ wins: [0, 0, 0], losses: [0, 0, 0], level: 1 });
    expect(cleanRecord({ wins: [1, 2, 3], losses: [0, -1, 2], level: 2 })).toEqual({ wins: [1, 2, 3], losses: [0, 0, 0], level: 2 });
  });
});

describe("air hockey page", () => {
  it("mounts without WebGL or three.js, and Play falls back to the retry cover", async () => {
    window.localStorage.clear();
    const host = document.createElement("div");
    document.body.append(host);
    mountAirHockey(host);
    expect(host.querySelector("h1")).not.toBeNull();
    expect(host.querySelector("[data-out=stage]")).not.toBeNull();
    expect(host.querySelector("canvas")).toBeNull();
    expect(host.querySelector("[data-out=you]")!.textContent).toBe("0");
    const play = host.querySelector<HTMLButtonElement>("[data-act=play]")!;
    play.click();
    for (let i = 0; i < 100 && play.textContent !== "Try again"; i++) await new Promise((r) => setTimeout(r, 50));
    expect(host.querySelector("canvas")).toBeNull();
    expect(host.querySelector(".g3d-cover")?.hasAttribute("hidden")).toBe(false);
    // The level is kept for the next visit.
    const sel = host.querySelector<HTMLSelectElement>("[data-in=level]")!;
    sel.value = "2";
    sel.dispatchEvent(new Event("change"));
    expect(JSON.parse(window.localStorage.getItem("cvcm.airhockey.v1")!).level).toBe(2);
    unmountAirHockey();
    host.remove();
  });

  it("never leaves a resting puck stuck in the computer's back corners", () => {
    for (const start of [{ x: 0.42, y: 0.75 }, { x: -0.44, y: 0.74 }, { x: 0.45, y: 0.76 }, { x: -0.3, y: 0.76 }]) {
      for (const level of LEVELS) {
        let m = newMatch();
        m = { ...m, serve: 0, puck: { ...start, vx: 0, vy: 0 } };
        let moved = false;
        for (let i = 0; i < 600 && !moved; i++) {
          m = step(m, { x: 0, y: -0.6 }, level, 1 / 60);
          moved = Math.hypot(m.puck.x - start.x, m.puck.y - start.y) > 0.1 || m.score[0] + m.score[1] > 0;
        }
        expect(moved, `${JSON.stringify(start)} level ${level}`).toBe(true);
      }
    }
  });

  it("keeps a puck that is already in the goal mouth inside the goal", () => {
    // Just past the line near a post, drifting sideways: it goes in, it is not thrown back through the post.
    let m = live({ puck: { x: GOAL_W / 2 - PUCK_R, y: -TABLE_L / 2 + PUCK_R - 0.005, vx: 0.4, vy: -0.25 } });
    for (let i = 0; i < 120 && m.score[1] === 0; i++) m = step(m, { x: 0, y: -0.6 }, 0, 1 / 60);
    expect(m.score[1]).toBe(1);
  });

  it("does not walk away from a slow puck rolling toward its own goal", () => {
    for (const level of LEVELS) {
      let m = live({ puck: { x: 0.05, y: 0.6, vx: 0, vy: 0.4 } });
      for (let i = 0; i < 240 && m.score[0] === 0; i++) m = step(m, { x: 0, y: -0.6 }, level, 1 / 60);
      expect(m.score[0], `level ${level}`).toBe(0);
    }
  });
});

