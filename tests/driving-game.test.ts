import { describe, expect, it } from "vitest";
import {
  CHECKPOINTS,
  NO_INPUT,
  OFFROAD_TOP,
  RUNOFF,
  SAMPLES,
  TOP_SPEED,
  TRACK_COUNT,
  advance,
  buildTrack,
  carAt,
  cleanBests,
  driftScore,
  driftStep,
  formatLap,
  forwardSpeed,
  locate,
  slipAngle,
  speedOf,
  startDrift,
  startLaps,
  startWorld,
  step,
  updateLaps,
  type Car,
  type Input,
} from "../src/shared/driving-game";

const run = (car: Car, input: Input, seconds: number, onRoad = true) => {
  let c = car;
  for (let i = 0; i < seconds * 120; i++) c = step(c, input, 1 / 120, onRoad);
  return c;
};
const gas: Input = { ...NO_INPUT, throttle: true };
const still: Car = { x: 0, z: 0, heading: 0, vx: 0, vz: 0, steer: 0 };

describe("driving game physics", () => {
  it("accelerates to a capped top speed", () => {
    const c = run(still, gas, 30);
    expect(speedOf(c)).toBeGreaterThan(TOP_SPEED * 0.85);
    expect(speedOf(c)).toBeLessThanOrEqual(TOP_SPEED + 0.5);
    expect(c.z).toBeGreaterThan(100);
  });

  it("brakes to a stop and then reverses", () => {
    const fast = run(still, gas, 6);
    expect(forwardSpeed(fast)).toBeGreaterThan(20);
    let stopped = fast;
    let steps = 0;
    while (forwardSpeed(stopped) > 0.5 && steps < 600) {
      stopped = step(stopped, { ...NO_INPUT, brake: true }, 1 / 120, true);
      steps++;
    }
    expect(steps / 120).toBeLessThan(2.5);
    const back = run(stopped, { ...NO_INPUT, brake: true }, 4);
    expect(forwardSpeed(back)).toBeLessThan(-1);
  });

  it("steers at speed", () => {
    const fast = run(still, gas, 5);
    const turned = run(fast, { ...gas, steer: 1 }, 1);
    expect(turned.heading).toBeGreaterThan(fast.heading + 0.3);
    const left = run(fast, { ...gas, steer: -1 }, 1);
    expect(left.heading).toBeLessThan(fast.heading - 0.3);
  });

  it("slides more with the handbrake", () => {
    const fast = run(still, gas, 6);
    const grip = run(fast, { ...gas, steer: 0.6 }, 0.6);
    const slide = run(fast, { ...gas, steer: 0.6, handbrake: true }, 0.6);
    expect(slipAngle(slide)).toBeGreaterThan(slipAngle(grip) + 5);
  });

  it("is slower on the grass", () => {
    const grass = run(still, gas, 30, false);
    expect(speedOf(grass)).toBeLessThanOrEqual(OFFROAD_TOP + 0.5);
    expect(speedOf(grass)).toBeLessThan(TOP_SPEED * 0.6);
  });

  it("gives the same result for the same input whatever the frame rate", () => {
    const track = buildTrack(0);
    let a = startWorld(track);
    let b = startWorld(track);
    for (let i = 0; i < 60; i++) a = advance(track, a, gas, 1 / 30);
    for (let i = 0; i < 240; i++) b = advance(track, b, gas, 1 / 120);
    expect(a.car.x).toBeCloseTo(b.car.x, 6);
    expect(a.car.z).toBeCloseTo(b.car.z, 6);
  });
});

describe("driving game tracks", () => {
  it("builds three closed loops with evenly spaced samples", () => {
    for (let i = 0; i < TRACK_COUNT; i++) {
      const t = buildTrack(i);
      expect(t.points).toHaveLength(SAMPLES);
      const gap = (a: number, b: number) => Math.hypot(t.points[a]!.x - t.points[b]!.x, t.points[a]!.z - t.points[b]!.z);
      const spacing = t.length / SAMPLES;
      expect(gap(SAMPLES - 1, 0)).toBeLessThan(spacing * 1.5);
      expect(gap(0, 1)).toBeCloseTo(spacing, 0);
      expect(t.length).toBeGreaterThan(400);
    }
    expect(buildTrack(1).points[5]).toEqual(buildTrack(1).points[5]);
    expect(buildTrack(0).length).not.toBeCloseTo(buildTrack(2).length, 0);
  });

  it("orders checkpoints from the start line", () => {
    const t = buildTrack(1);
    expect(t.checkpoints).toHaveLength(CHECKPOINTS);
    expect(t.checkpoints[0]).toBe(0);
    for (let c = 1; c < CHECKPOINTS; c++) expect(t.checkpoints[c]!).toBeGreaterThan(t.checkpoints[c - 1]!);
  });

  it("locates the car beside the centre line", () => {
    const t = buildTrack(2);
    const car = carAt(t, 100);
    const tg = t.tangents[100]!;
    const loc = locate(t, car.x + tg.z * 3, car.z - tg.x * 3, 98);
    expect(loc.index).toBe(100);
    expect(loc.lateral).toBeCloseTo(3, 0);
  });

  it("counts a lap only after every checkpoint in order", () => {
    const t = buildTrack(0);
    let laps = startLaps();
    // Straight back across the line: no lap.
    let r = updateLaps(t, laps, SAMPLES - 2);
    r = updateLaps(t, r.laps, 0);
    expect(r.lapDone).toBe(false);
    // Skipping checkpoint 3 stalls progress.
    laps = startLaps();
    for (const c of [1, 2, 4, 5, 6, 7, 0]) laps = updateLaps(t, laps, t.checkpoints[c]! + 1).laps;
    expect(laps.lap).toBe(0);
    // All of them in order: one lap.
    laps = startLaps();
    let done = false;
    for (let s = 0; s <= SAMPLES; s += 3) {
      const u = updateLaps(t, laps, s % SAMPLES);
      laps = u.laps;
      done ||= u.lapDone;
    }
    expect(done).toBe(true);
    expect(laps.lap).toBe(1);
  });
});

describe("driving game scoring", () => {
  it("scores a slide, banks it and drops it off the road", () => {
    let d = startDrift();
    for (let i = 0; i < 60; i++) d = driftStep(d, 30, 20, true, false, 1 / 60);
    expect(d.chain).toBeGreaterThan(20);
    for (let i = 0; i < 60; i++) d = driftStep(d, 0, 20, true, false, 1 / 60);
    expect(d.chain).toBe(0);
    const banked = d.total;
    expect(banked).toBeGreaterThan(20);
    for (let i = 0; i < 30; i++) d = driftStep(d, 30, 20, true, false, 1 / 60);
    for (let i = 0; i < 70; i++) d = driftStep(d, 30, 20, false, false, 1 / 60);
    expect(d.chain).toBe(0);
    expect(driftScore(d)).toBe(Math.floor(banked));
    expect(driftStep(d, 10, 30, true, false, 1).chain).toBe(0);
  });

  it("formats lap times and cleans saved bests", () => {
    expect(formatLap(65320)).toBe("1:05.32");
    expect(formatLap(9000)).toBe("0:09.00");
    expect(cleanBests({ lap: { 0: 50000, 7: 1, 1: "x" }, drift: { 2: 900 } })).toEqual({ lap: { 0: 50000 }, drift: { 2: 900 } });
    expect(cleanBests(null)).toEqual({ lap: {}, drift: {} });
  });

  it("bounces off the tyre wall instead of sticking to it", () => {
    const track = buildTrack(0);
    const tg = track.tangents[0]!;
    const nx = tg.z, nz = -tg.x;
    const start = startWorld(track);
    // Driving straight at the wall on the +side at 30 m/s.
    let w = { ...start, car: { ...start.car, heading: Math.atan2(nx, nz), vx: nx * 30, vz: nz * 30 } };
    let hits = 0;
    for (let i = 0; i < 60; i++) {
      w = advance(track, { ...w, hit: false }, NO_INPUT, 1 / 60);
      if (w.hit) hits++;
    }
    expect(hits).toBeGreaterThan(0);
    // One impact, then the car is moving away from the wall, not grinding into it every frame.
    expect(hits).toBeLessThanOrEqual(2);
    expect(Math.abs(w.lateral)).toBeLessThanOrEqual(track.width / 2 + RUNOFF);
  });
});
