// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { seeded } from "../src/shared/random";
import {
  BALLS,
  BALL_R,
  BALL_SAVE,
  BUMPERS,
  FLIPPER_LEN,
  FLIPPER_R,
  FLIP_UP,
  LEFT_PIVOT,
  MAX_SPEED,
  NO_INPUT,
  PLUNGER_REST,
  SUBSTEP,
  flipperGeom,
  launchSpeed,
  newGame,
  onPlunger,
  step,
  withBall,
  type Input,
  type Pin,
} from "../src/shared/pinball";
import { mountPinball, unmountPinball } from "../src/client/pinball/ui";

function run(p: Pin, input: Input, seconds: number, frame = 1 / 60): Pin {
  let s = p;
  for (let t = 0; t < seconds - 1e-9; t += frame) s = step(s, input, frame);
  return s;
}

describe("pinball physics", () => {
  it("starts with the ball on the plunger and three balls", () => {
    const s = newGame();
    expect(s.balls).toBe(BALLS);
    expect([s.x, s.y]).toEqual(PLUNGER_REST);
    expect(onPlunger(s)).toBe(true);
    // Left alone it stays there.
    const later = run(s, NO_INPUT, 2);
    expect(onPlunger(later)).toBe(true);
    expect(later.balls).toBe(BALLS);
  });

  it("lets a ball in the middle of the table roll down and drain with no flippers", () => {
    let s = withBall(newGame(), 4.6, 9, 0, 0);
    let drained = false;
    for (let i = 0; i < 60 * 15 && !drained; i++) {
      s = step(s, NO_INPUT, 1 / 60);
      drained = s.balls < BALLS;
    }
    expect(drained).toBe(true);
    expect(s.notice.kind).toBe("lost");
    // The next ball waits on the plunger.
    expect(onPlunger(s)).toBe(true);
  });

  it("maps the plunger pull to the launch speed", () => {
    expect(launchSpeed(0)).toBeLessThan(launchSpeed(0.5));
    expect(launchSpeed(0.5)).toBeLessThan(launchSpeed(1));
    expect(launchSpeed(2)).toBe(launchSpeed(1));
    // Hold for half the charge time, release: the ball leaves the lane upward at that speed.
    let s = run(newGame(), { ...NO_INPUT, plunger: true }, 0.45);
    expect(s.charge).toBeGreaterThan(0.45);
    const charge = s.charge;
    s = step(s, NO_INPUT, SUBSTEP);
    expect(s.notice.kind).toBe("launch");
    expect(s.vy).toBeGreaterThan(launchSpeed(charge) - 1);
    // A full pull gets the ball out of the lane at the top of the table.
    let full = run(newGame(), { ...NO_INPUT, plunger: true }, 1);
    let top = 0;
    for (let i = 0; i < 120; i++) {
      full = step(full, NO_INPUT, 1 / 120);
      top = Math.max(top, full.y);
    }
    expect(top).toBeGreaterThan(17);
  });

  it("sends a ball resting on a flipper up the table when the flipper fires", () => {
    // Ball sitting just above the middle of the lowered left flipper.
    const { pivot, dir } = flipperGeom("left", -0.5);
    const mx = pivot[0] + dir[0] * FLIPPER_LEN * 0.7;
    const my = pivot[1] + dir[1] * FLIPPER_LEN * 0.7 + BALL_R + FLIPPER_R + 0.01;
    let s = withBall(newGame(), mx, my, 0, 0);
    s = run(s, { ...NO_INPUT, left: true }, 0.1, 1 / 120);
    expect(s.vy).toBeGreaterThan(15);
    expect(s.left.a).toBe(FLIP_UP);
    s = run(s, { ...NO_INPUT, left: true }, 0.25, 1 / 120);
    expect(s.y).toBeGreaterThan(6);
  });

  it("never lets a fast ball pass through a swinging flipper", () => {
    const rand = seeded(7);
    for (let n = 0; n < 200; n++) {
      // Ball above the left flipper, aimed down at it at full speed while the flipper swings up.
      const u = 0.15 + rand() * 0.8;
      const { pivot, dir } = flipperGeom("left", -0.5);
      const px = pivot[0] + dir[0] * FLIPPER_LEN * u;
      const py = pivot[1] + dir[1] * FLIPPER_LEN * u;
      const angle = -Math.PI / 2 + (rand() - 0.5) * 0.8;
      const start = 0.6 + rand() * 0.8;
      let s = withBall(newGame(), px - Math.cos(angle) * start, py - Math.sin(angle) * start, Math.cos(angle) * MAX_SPEED, Math.sin(angle) * MAX_SPEED);
      const press = rand() < 0.7;
      for (let i = 0; i < 240; i++) {
        s = step(s, { ...NO_INPUT, left: press }, SUBSTEP);
        if (s.balls < BALLS || s.y < 0) break;
        const g = flipperGeom("left", s.left.a);
        // Side of the flipper line, measured only right over the flipper.
        const ex = g.tip[0] - g.pivot[0], ey = g.tip[1] - g.pivot[1];
        const t = ((s.x - g.pivot[0]) * ex + (s.y - g.pivot[1]) * ey) / (FLIPPER_LEN * FLIPPER_LEN);
        if (t > 0.05 && t < 0.95) {
          const side = (ex * (s.y - g.pivot[1]) - ey * (s.x - g.pivot[0])) / FLIPPER_LEN;
          expect(side, `case ${n} step ${i}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it("scores and kicks the ball off a pop bumper", () => {
    const b = BUMPERS[0]!;
    let s = withBall(newGame(), b.x, b.y + 1.4, 0, -10);
    const before = s.score;
    let away = false;
    for (let i = 0; i < 40 && !away; i++) {
      s = step(s, NO_INPUT, 1 / 240);
      away = s.score > before;
    }
    expect(s.score).toBeGreaterThanOrEqual(before + 100);
    // Moving away from the bumper, fast.
    expect(s.vy).toBeGreaterThan(8);
  });

  it("is deterministic for the same inputs", () => {
    const inputs = (i: number): Input => ({ left: i % 50 < 10, right: i % 70 < 12, plunger: i < 40 });
    const play = () => {
      let s = newGame();
      for (let i = 0; i < 1200; i++) s = step(s, inputs(i), 1 / 60);
      return s;
    };
    const a = play(), b = play();
    expect(a.x).toBe(b.x);
    expect(a.y).toBe(b.y);
    expect(a.score).toBe(b.score);
    expect(a.balls).toBe(b.balls);
  });

  it("gives the ball back once if it drains right after the launch, then not again", () => {
    let s = run(newGame(), { ...NO_INPUT, plunger: true }, 0.2);
    s = step(s, NO_INPUT, SUBSTEP);
    expect(s.saveUntil).toBeCloseTo(s.t + BALL_SAVE, 3);
    // Teleport it to the drain while the save is on.
    s = run(withBall(s, 4.6, 0.2, 0, -10), NO_INPUT, 0.2);
    expect(s.notice.kind).toBe("saved");
    expect(s.balls).toBe(BALLS);
    expect(onPlunger(s)).toBe(true);
    // Launch again: the save was used, so a drain now costs the ball.
    s = run(s, { ...NO_INPUT, plunger: true }, 0.2);
    s = step(s, NO_INPUT, SUBSTEP);
    s = run(withBall(s, 4.6, 0.2, 0, -10), NO_INPUT, 0.2);
    expect(s.balls).toBe(BALLS - 1);
  });

  it("ends the game after the last ball", () => {
    let s = newGame();
    for (let k = 0; k < BALLS; k++) s = run(withBall(s, 4.6, 0.2, 0, -10), NO_INPUT, 0.2);
    expect(s.over).toBe(true);
    expect(s.notice.kind).toBe("over");
    const frozen = step(s, { left: true, right: true, plunger: true }, 1);
    expect(frozen.score).toBe(s.score);
  });

  it("keeps the flipper pivots inside the table", () => {
    expect(LEFT_PIVOT[0]).toBeGreaterThan(0);
    const l = flipperGeom("left", FLIP_UP).tip;
    const r = flipperGeom("right", FLIP_UP).tip;
    expect(l[0]).toBeLessThan(r[0]);
    // At rest there is room for the ball to drain between the tips.
    const lr = flipperGeom("left", -0.5).tip, rr = flipperGeom("right", -0.5).tip;
    expect(rr[0] - lr[0] - 2 * FLIPPER_R).toBeGreaterThan(2 * BALL_R);
  });
});

describe("pinball page", () => {
  it("mounts without WebGL work and shows the Play cover", async () => {
    window.localStorage.clear();
    const host = document.createElement("div");
    document.body.append(host);
    mountPinball(host);
    expect(host.querySelector("canvas")).toBeNull();
    expect(host.querySelector('[data-act="play"]')).not.toBeNull();
    expect(host.querySelector('[data-out="best"]')!.textContent).toBe("0");
    host.querySelector<HTMLButtonElement>('[data-act="play"]')!.click();
    for (let i = 0; i < 100 && host.querySelector('[data-act="play"]')!.textContent !== "Try again"; i++) {
      await new Promise((r) => setTimeout(r, 50));
    }
    expect(host.querySelector<HTMLElement>(".g3d-cover")!.hidden).toBe(false);
    unmountPinball();
    host.remove();
  });
});
