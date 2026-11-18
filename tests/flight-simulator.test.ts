// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { Mesh, MeshBasicMaterial, PlaneGeometry, Raycaster, Vector3 } from "three";
import { mountFlightSimulator, unmountFlightSimulator } from "../src/client/flight-simulator/ui";
import {
  NO_INPUT,
  GEAR,
  TERRAIN_SEGMENTS,
  meshHeight,
  RING_COUNT,
  RUNWAY_WIDTH,
  RUNWAY_Y,
  STALL_SPEED,
  WORLD,
  airborneStart,
  formatFlightTime,
  heading,
  onRunwayStart,
  ringCourse,
  step,
  surfaceHeight,
  terrainHeight,
  throughRing,
  type Controls,
  type Plane,
} from "../src/shared/flight-simulator";

function fly(p: Plane, c: Controls, seconds: number): Plane {
  for (let i = 0; i < seconds * 10; i++) p = step(p, c, 0.1);
  return p;
}

describe("flight simulator terrain", () => {
  it("is deterministic, level on the runway and sea past the island", () => {
    expect(terrainHeight(812.5, -431)).toBe(terrainHeight(812.5, -431));
    expect(terrainHeight(0, 0)).toBeCloseTo(RUNWAY_Y, 6);
    expect(terrainHeight(10, 300)).toBeCloseTo(RUNWAY_Y, 6);
    for (const [x, z] of [[WORLD, 0], [0, -WORLD], [-WORLD, WORLD], [2900, 900]]) {
      expect(terrainHeight(x!, z!)).toBeLessThan(0);
      expect(surfaceHeight(x!, z!)).toBe(0);
    }
    // Hills somewhere inland.
    let peak = 0;
    for (let x = -2000; x <= 2000; x += 100) for (let z = -2000; z <= 2000; z += 100) peak = Math.max(peak, terrainHeight(x, z));
    expect(peak).toBeGreaterThan(200);
  });
});

describe("flight simulator physics", () => {
  it("gains speed to a cap at full throttle in level flight", () => {
    let p = { ...airborneStart(), y: 1200, throttle: 1 };
    const s0 = p.speed;
    p = fly(p, NO_INPUT, 10);
    expect(p.speed).toBeGreaterThan(s0);
    const s1 = p.speed;
    p = fly(p, NO_INPUT, 40);
    expect(p.speed).toBeLessThan(80);
    expect(p.speed - s1).toBeLessThan(15);
    expect(p.crashed).toBeNull();
  });

  it("loses speed and stalls with the throttle closed", () => {
    let p = { ...airborneStart(), y: 1500, throttle: 0 };
    let stalled = false;
    for (let i = 0; i < 600 && !stalled; i++) {
      p = step(p, { ...NO_INPUT, throttle: -1, pitch: 0.4 }, 0.1);
      stalled = p.stalled;
    }
    expect(stalled).toBe(true);
    expect(p.speed).toBeLessThan(STALL_SPEED);
  });

  it("climbs when pitching up and turns when banked", () => {
    const start = { ...airborneStart(), y: 600, throttle: 1 };
    const up = fly(start, { ...NO_INPUT, pitch: 1 }, 1.5);
    const climbed = fly(up, NO_INPUT, 3);
    expect(climbed.y).toBeGreaterThan(start.y + 20);

    const banked = fly(start, { ...NO_INPUT, roll: 1 }, 0.8);
    expect(banked.roll).toBeGreaterThan(0.3);
    const turned = fly(banked, { ...NO_INPUT, pitch: 0.3 }, 4);
    expect(heading(turned)).toBeGreaterThan(20);
    expect(heading(turned)).toBeLessThan(180);
  });

  it("takes off from the runway with throttle and a pull", () => {
    let p = onRunwayStart();
    p = fly(p, { ...NO_INPUT, throttle: 1 }, 3);
    expect(p.onGround).toBe(true);
    for (let i = 0; i < 300 && p.onGround; i++) p = step(p, { ...NO_INPUT, throttle: 1, pitch: 1 }, 0.1);
    expect(p.onGround).toBe(false);
    expect(p.crashed).toBeNull();
    p = fly(p, { ...NO_INPUT, throttle: 1 }, 4);
    expect(p.y).toBeGreaterThan(RUNWAY_Y + 15);
  });

  it("crashes into water and into terrain, lands gently on the runway", () => {
    const sea = step({ ...airborneStart(), x: 3000, z: 0, y: 3, pitch: -0.3 }, NO_INPUT, 0.5);
    expect(sea.crashed).toBe("water");
    const dive = step({ ...airborneStart(), x: 0, z: -1200, y: terrainHeight(0, -1200) + 3, pitch: -0.8, speed: 60 }, NO_INPUT, 0.5);
    expect(dive.crashed).toBe("hard");
    // A slow, shallow touchdown on the runway, then braking to a stop.
    let p: Plane = { ...airborneStart(), x: 0, z: 200, y: RUNWAY_Y + 2.5, pitch: 0.02, speed: 36, throttle: 0, sink: -1 };
    p = fly(p, { ...NO_INPUT, throttle: -1 }, 25);
    expect(p.crashed).toBeNull();
    expect(p.onGround).toBe(true);
    expect(p.landed).toBe(true);
  });
});

describe("flight simulator rings", () => {
  it("builds the same course each time, above the ground", () => {
    const a = ringCourse(1);
    expect(a).toHaveLength(RING_COUNT);
    expect(ringCourse(1)).toEqual(a);
    for (const r of a) {
      expect(r.y - terrainHeight(r.x, r.z)).toBeGreaterThanOrEqual(89);
      expect(Math.hypot(r.nx, r.ny, r.nz)).toBeCloseTo(1, 6);
    }
  });

  it("counts a segment through the disc only", () => {
    const ring = { x: 0, y: 100, z: 0, nx: 0, ny: 0, nz: -1 };
    expect(throughRing(ring, [0, 100, 5], [0, 100, -5])).toBe(true);
    expect(throughRing(ring, [10, 110, -5], [10, 110, 5])).toBe(true);
    expect(throughRing(ring, [30, 100, 5], [30, 100, -5])).toBe(false);
    expect(throughRing(ring, [0, 100, 5], [0, 100, 1])).toBe(false);
  });

  it("formats times", () => {
    expect(formatFlightTime(0)).toBe("0:00.0");
    expect(formatFlightTime(83_456)).toBe("1:23.4");
  });
});

describe("flight simulator page", () => {
  it("mounts without WebGL or three.js, and Play reports a missing WebGL", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    mountFlightSimulator(host);
    expect(host.querySelector("h1")).not.toBeNull();
    expect(host.querySelector("[data-out=stage]")).not.toBeNull();
    expect(host.querySelector("canvas")).toBeNull();
    expect(host.querySelectorAll(".g3d-pad button")).toHaveLength(6);
    const play = host.querySelector<HTMLButtonElement>("[data-act=play]")!;
    play.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(host.querySelector("canvas")).toBeNull();
    expect(host.querySelector(".g3d-cover")?.hasAttribute("hidden")).toBe(false);
    unmountFlightSimulator();
    host.remove();
  });

  it("rolls slowly off the runway edge onto the grass on its wheels, following the ground", () => {
    let p: Plane = { ...onRunwayStart(), yaw: Math.PI / 2, speed: 12 };
    p = fly(p, NO_INPUT, 4);
    expect(p.crashed).toBeNull();
    expect(p.onGround).toBe(true);
    expect(Math.abs(p.x)).toBeGreaterThan(RUNWAY_WIDTH / 2);
    expect(Math.abs(p.y - GEAR - surfaceHeight(p.x, p.z))).toBeLessThan(0.5);
  });

  it("collides with exactly the terrain mesh the page draws", () => {
    // Build the page's terrain grid with three and ray-cast down: the physics surface must match it.
    const plane = new PlaneGeometry(WORLD * 2, WORLD * 2, TERRAIN_SEGMENTS, TERRAIN_SEGMENTS);
    plane.rotateX(-Math.PI / 2);
    const pos = plane.attributes.position!;
    for (let i = 0; i < pos.count; i++) pos.setY(i, terrainHeight(pos.getX(i), pos.getZ(i)));
    const mesh = new Mesh(plane, new MeshBasicMaterial({ side: 2 }));
    const ray = new Raycaster();
    for (const [x, z] of [[1234.5, -987.6], [-2111, 1555.3], [30.2, 700.7], [-600.1, -1900.9], [2500.4, 333.3]] as const) {
      ray.set(new Vector3(x, 2000, z), new Vector3(0, -1, 0));
      const hit = ray.intersectObject(mesh)[0]!;
      expect(meshHeight(x, z)).toBeCloseTo(hit.point.y, 3);
    }
  });
});
