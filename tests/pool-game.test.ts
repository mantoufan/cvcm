// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { mountPoolGame, unmountPoolGame } from "../src/client/pool-game/ui";
import { seeded } from "../src/shared/random";
import {
  HEAD_SPOT,
  POCKETS,
  R,
  TABLE_L,
  TABLE_W,
  chooseShot,
  emptyEvents,
  legalTargets,
  newGame,
  newRack,
  parseSaved,
  resolve,
  simulate,
  step,
  type Ball,
  type PoolState,
} from "../src/shared/pool-game";

const ball = (id: number, x: number, y: number, vx = 0, vy = 0): Ball => ({ id, x, y, vx, vy, on: true });
/** A table with only the given balls on it (the rest pocketed). */
function table(on: Ball[]): Ball[] {
  const ids = new Set(on.map((b) => b.id));
  const rest = Array.from({ length: 16 }, (_, id) => id).filter((id) => !ids.has(id)).map((id) => ({ ...ball(id, 0, 0), on: false }));
  return [...on, ...rest].sort((a, b) => a.id - b.id);
}

describe("pool physics", () => {
  it("racks 15 balls plus the cue ball without overlaps", () => {
    const balls = newRack();
    expect(balls).toHaveLength(16);
    for (let i = 0; i < 16; i++) for (let j = i + 1; j < 16; j++) {
      expect(Math.hypot(balls[i]!.x - balls[j]!.x, balls[i]!.y - balls[j]!.y)).toBeGreaterThanOrEqual(2 * R);
    }
  });

  it("passes the cue ball's speed to the object ball on a head-on hit", () => {
    const balls = table([ball(0, -0.3, 0, 2, 0), ball(1, 0, 0)]);
    const ev = emptyEvents();
    step(balls, 0.18, ev);
    expect(ev.first).toBe(1);
    expect(Math.abs(balls[0]!.vx)).toBeLessThan(0.15);
    expect(balls[1]!.vx).toBeGreaterThan(1.5);
  });

  it("reflects off a cushion", () => {
    const balls = table([ball(0, 0.5, TABLE_W / 2 - 0.1, 0, 1.5)]);
    step(balls, 0.12, emptyEvents());
    expect(balls[0]!.vy).toBeLessThan(0);
    expect(balls[0]!.y).toBeLessThanOrEqual(TABLE_W / 2 - R + 1e-9);
  });

  it("stops by friction", () => {
    const { balls } = simulate(table([ball(0, -0.8, 0)]), { angle: 0.3, power: 0.4 });
    expect(balls[0]!.on).toBe(true);
    expect(Math.abs(balls[0]!.x)).toBeLessThan(TABLE_L / 2);
  });

  it("pockets a ball sent straight at a corner", () => {
    const pk = POCKETS[1]!;
    const sx = 0.4, sy = -0.1;
    const angle = Math.atan2(pk.ay - sy, pk.ax - sx);
    const { ev } = simulate(table([ball(0, sx, sy)]), { angle, power: 0.6 });
    expect(ev.pocketed).toEqual([0]);
  });

  it("is deterministic", () => {
    const a = simulate(newRack(), { angle: 0.004, power: 1 });
    const b = simulate(newRack(), { angle: 0.004, power: 1 });
    expect(a.balls).toEqual(b.balls);
    expect(a.ev).toEqual(b.ev);
  });

  it("does not let a hard break pass balls through each other", () => {
    const { balls } = simulate(newRack(), { angle: 0, power: 1 });
    const on = balls.filter((b) => b.on);
    for (let i = 0; i < on.length; i++) for (let j = i + 1; j < on.length; j++) {
      expect(Math.hypot(on[i]!.x - on[j]!.x, on[i]!.y - on[j]!.y)).toBeGreaterThan(2 * R * 0.97);
    }
    for (const b of on) {
      expect(Math.abs(b.x)).toBeLessThanOrEqual(TABLE_L / 2);
      expect(Math.abs(b.y)).toBeLessThanOrEqual(TABLE_W / 2);
    }
  });
});

describe("8-ball rules", () => {
  const afterBreak = (over: Partial<PoolState> = {}): PoolState => ({ ...newGame(), breakShot: false, ...over });

  it("gives ball in hand after a scratch", () => {
    const s = afterBreak();
    const { state, outcome } = resolve(s, s.balls.map((b) => (b.id === 0 ? { ...b, on: false } : b)), { first: 1, railAfter: true, pocketed: [0] });
    expect(outcome).toEqual({ kind: "pass", foul: "scratch" });
    expect(state.turn).toBe(1);
    expect(state.ballInHand).toBe(true);
    expect(state.balls[0]!.on).toBe(true);
  });

  it("assigns groups on the first legal pot and keeps the turn", () => {
    const s = afterBreak();
    const after = s.balls.map((b) => (b.id === 11 ? { ...b, on: false } : b));
    const { state, outcome } = resolve(s, after, { first: 11, railAfter: true, pocketed: [11] });
    expect(outcome.kind).toBe("continue");
    expect(state.groups).toEqual(["stripes", "solids"]);
    expect(state.turn).toBe(0);
  });

  it("calls hitting the opponent's group first a foul", () => {
    const s = afterBreak({ groups: ["solids", "stripes"] });
    const { outcome } = resolve(s, s.balls, { first: 12, railAfter: true, pocketed: [] });
    expect(outcome).toEqual({ kind: "pass", foul: "wrongBall" });
  });

  it("calls no cushion after contact a foul", () => {
    const s = afterBreak({ groups: ["solids", "stripes"] });
    const { outcome } = resolve(s, s.balls, { first: 3, railAfter: false, pocketed: [] });
    expect(outcome).toEqual({ kind: "pass", foul: "noRail" });
  });

  it("loses on the 8 before the group is cleared, and wins once it is", () => {
    const s = afterBreak({ groups: ["solids", "stripes"] });
    const early = resolve(s, s.balls.map((b) => (b.id === 8 ? { ...b, on: false } : b)), { first: 3, railAfter: true, pocketed: [8] });
    expect(early.outcome).toEqual({ kind: "win", player: 1, reason: "eightEarly" });
    const cleared = afterBreak({ groups: ["solids", "stripes"], balls: newRack().map((b) => (b.id >= 1 && b.id <= 7 ? { ...b, on: false } : b)) });
    expect(legalTargets(cleared, 0)).toEqual([8]);
    const win = resolve(cleared, cleared.balls.map((b) => (b.id === 8 ? { ...b, on: false } : b)), { first: 8, railAfter: true, pocketed: [8] });
    expect(win.outcome).toEqual({ kind: "win", player: 0, reason: "eight" });
  });

  it("spots the 8 again when it drops on the break", () => {
    const s = newGame();
    const { state, outcome } = resolve(s, s.balls.map((b) => (b.id === 8 || b.id === 3 ? { ...b, on: false } : b)), { first: 1, railAfter: true, pocketed: [3, 8] });
    expect(state.balls.find((b) => b.id === 8)!.on).toBe(true);
    expect(outcome.kind).toBe("continue");
    expect(state.groups).toEqual([null, null]);
  });

  it("lets the computer find a legal shot after the break on easy", () => {
    const s0 = newGame();
    const brk = simulate(s0.balls, { angle: 0, power: 1 });
    let { state } = resolve(s0, brk.balls, brk.ev);
    state = { ...state, turn: 1, ballInHand: false };
    const rand = seeded(7);
    const shot = chooseShot(state, 0, rand);
    const { balls, ev } = simulate(state.balls, shot);
    const { outcome } = resolve(state, balls, ev);
    expect(outcome.kind === "pass" ? outcome.foul : null).toBeNull();
  });

  it("reads back a saved game and rejects a broken one", () => {
    const s = newGame();
    expect(parseSaved(JSON.parse(JSON.stringify(s)))).toEqual(s);
    expect(parseSaved({ ...s, balls: s.balls.slice(1) })).toBeNull();
    expect(parseSaved({ ...s, turn: 2 })).toBeNull();
    expect(HEAD_SPOT.x).toBeLessThan(0);
  });
});

describe("pool game page", () => {
  it("mounts without a canvas, restores a saved game and falls back without WebGL", async () => {
    window.localStorage.clear();
    const saved = { ...newGame(), breakShot: false, groups: ["stripes", "solids"] };
    window.localStorage.setItem("cvcm.poolgame.v1", JSON.stringify({ game: saved, mode: "friend", level: 2, wins: 3, losses: 1 }));
    const host = document.createElement("div");
    document.body.append(host);
    mountPoolGame(host);
    expect(host.querySelector("canvas")).toBeNull();
    expect(host.querySelector<HTMLSelectElement>('[data-in="mode"]')!.value).toBe("friend");
    expect(host.querySelector<HTMLButtonElement>('[data-act="shoot"]')!.disabled).toBe(true);
    // Keys before Play do nothing and do not throw.
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" }));
    host.querySelector<HTMLButtonElement>('[data-act="play"]')!.click();
    for (let i = 0; i < 100 && host.querySelector('[data-act="play"]')!.textContent === "game3d.loading"; i++) {
      await new Promise((r) => setTimeout(r, 50));
    }
    await new Promise((r) => setTimeout(r, 300));
    expect(host.querySelector(".g3d-cover")!.hasAttribute("hidden")).toBe(false);
    expect(host.querySelector("canvas")).toBeNull();
    unmountPoolGame();
    host.remove();
    window.localStorage.clear();
  });
});
