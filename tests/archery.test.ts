// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { mountArchery, unmountArchery } from "../src/client/archery/ui";
import {
  ARROW_R,
  ARROWS_PER_END,
  DISTANCES,
  ENDS,
  FACE_Y,
  FULL_SPEED,
  RELEASE_Y,
  addArrow,
  arrowsShot,
  better,
  cleanBests,
  currentEnd,
  drawOf,
  faceRadius,
  fly,
  launch,
  newRound,
  roundDone,
  roundTotal,
  scoreAt,
  sightFor,
  speedOf,
  stepArrow,
  swayAmplitude,
  windFor,
  xCount,
  type Arrow,
  type Score,
} from "../src/shared/archery";

const s = (value: number, x = false): Score => ({ value, x });

describe("archery scoring", () => {
  const R = faceRadius(18); // 0.2 m: rings 2 cm wide
  const w = R / 10;

  it("scores the rings from the centre out, with the X inside the 10", () => {
    expect(scoreAt(0, R)).toEqual({ value: 10, x: true });
    expect(scoreAt(w * 0.5 + ARROW_R - 1e-6, R)).toEqual({ value: 10, x: true });
    expect(scoreAt(w * 0.5 + ARROW_R + 0.001, R)).toEqual({ value: 10, x: false });
    expect(scoreAt(w * 1.5, R).value).toBe(9);
    expect(scoreAt(w * 5.5, R).value).toBe(5);
    expect(scoreAt(w * 9.5, R).value).toBe(1);
    expect(scoreAt(R + ARROW_R + 0.001, R).value).toBe(0);
  });

  it("gives the higher ring to an arrow that touches the line", () => {
    // Centre 1 mm outside the 9/8 line: the shaft (2.75 mm radius) still cuts it.
    expect(scoreAt(w * 2 + 0.001, R).value).toBe(9);
    // Clear of the line by more than the shaft's radius: the lower ring.
    expect(scoreAt(w * 2 + ARROW_R + 0.001, R).value).toBe(8);
    // Just touching the outer edge of the 1 still scores.
    expect(scoreAt(R + ARROW_R - 0.0005, R).value).toBe(1);
  });
});

describe("archery flight", () => {
  it("sets the sight so a full draw in still air hits the aimed point at every distance", () => {
    for (const d of DISTANCES) {
      const dir = sightFor(0, 0, d);
      const land = fly(launch(dir.yaw, dir.pitch, FULL_SPEED), d, 0);
      expect(land.kind, `${d} m`).toBe("face");
      if (land.kind === "face") expect(land.score, `${d} m`).toEqual({ value: 10, x: true });
      // Longer distances need more elevation.
      expect(dir.pitch).toBeGreaterThan(0);
    }
    expect(sightFor(0, 0, 70).pitch).toBeGreaterThan(sightFor(0, 0, 18).pitch);
  });

  it("drops a flat shot below the line of release, more over longer distances", () => {
    const drop = (d: 18 | 30 | 50 | 70) => {
      const land = fly(launch(0, 0, FULL_SPEED), d, 0);
      return land.kind === "face" || land.kind === "boss" ? RELEASE_Y - (FACE_Y + land.y) : RELEASE_Y;
    };
    expect(drop(18)).toBeGreaterThan(0.3);
    expect(drop(30)).toBeGreaterThan(drop(18));
  });

  it("drops an early release low", () => {
    const dir = sightFor(0, 0, 18);
    const full = fly(launch(dir.yaw, dir.pitch, speedOf(drawOf(2))), 18, 0);
    const half = fly(launch(dir.yaw, dir.pitch, speedOf(drawOf(0.3))), 18, 0);
    expect(full.kind).toBe("face");
    const halfY = half.kind === "face" || half.kind === "boss" ? half.y : -Infinity;
    expect(halfY).toBeLessThan(-0.05);
  });

  it("drifts with the wind, further at longer distances", () => {
    const drift = (d: 18 | 70, wind: number) => {
      const dir = sightFor(0, 0, d);
      const land = fly(launch(dir.yaw, dir.pitch, FULL_SPEED), d, wind);
      return land.kind === "face" || land.kind === "boss" ? land.x : NaN;
    };
    expect(drift(18, 2)).toBeGreaterThan(0);
    expect(drift(18, -2)).toBeLessThan(0);
    expect(drift(70, 2)).toBeGreaterThan(drift(18, 2) * 3);
  });

  it("never lets a fast arrow pass through the face (swept crossing)", () => {
    // Far faster than any bow: 2 m per step, ten times the face's thickness of nothing.
    for (let k = 0; k < 20; k++) {
      const a: Arrow = { x: (k - 10) * 0.01, y: FACE_Y, z: -10 + k * 0.137, vx: 0, vy: 0, vz: -480 };
      const land = fly(a, 18, 0);
      expect(land.kind).toBe("face");
    }
  });

  it("is deterministic", () => {
    const dir = sightFor(0.05, -0.03, 50);
    const a = fly(launch(dir.yaw, dir.pitch, speedOf(0.8)), 50, 1.7);
    const b = fly(launch(dir.yaw, dir.pitch, speedOf(0.8)), 50, 1.7);
    expect(a).toEqual(b);
    const one = stepArrow(launch(0, 0.05, 50), 1, 1 / 240);
    expect(stepArrow(launch(0, 0.05, 50), 1, 1 / 240)).toEqual(one);
  });

  it("lands in the ground when the arrow falls short", () => {
    expect(fly(launch(0, -0.2, FULL_SPEED), 70, 0).kind).toBe("ground");
  });

  it("settles the sway after about a second and shakes again after four", () => {
    expect(swayAmplitude(1.5)).toBeLessThan(swayAmplitude(0));
    expect(swayAmplitude(6)).toBeGreaterThan(swayAmplitude(2));
  });

  it("gives every end a wind within the distance's range, the same for the same seed", () => {
    for (let e = 0; e < ENDS; e++) {
      expect(Math.abs(windFor(7, e, 18))).toBeLessThanOrEqual(1);
      expect(Math.abs(windFor(7, e, 70))).toBeLessThanOrEqual(4);
      expect(windFor(7, e, 50)).toBe(windFor(7, e, 50));
    }
  });
});

describe("archery round", () => {
  it("runs six ends of three arrows and totals them with the Xs", () => {
    let r = newRound(30, 1);
    for (let i = 0; i < ENDS * ARROWS_PER_END; i++) {
      expect(roundDone(r)).toBe(false);
      r = addArrow(r, i % 3 === 0 ? s(10, true) : s(i % 3 === 1 ? 9 : 0));
    }
    expect(roundDone(r)).toBe(true);
    expect(arrowsShot(r)).toBe(18);
    expect(r.ends).toHaveLength(ENDS);
    expect(roundTotal(r)).toBe(6 * (10 + 9 + 0));
    expect(xCount(r)).toBe(6);
    // A finished round takes no more arrows.
    expect(addArrow(r, s(10))).toBe(r);
  });

  it("opens the next end after the third arrow", () => {
    let r = newRound(18, 1);
    r = addArrow(addArrow(addArrow(r, s(8)), s(7)), s(6));
    expect(currentEnd(r)).toBe(1);
    expect(r.ends[1]).toEqual([]);
  });

  it("keeps only sensible saved bests and compares by score, then Xs", () => {
    expect(cleanBests({ 18: { score: 170, x: 5 }, 30: { score: 999, x: 1 }, 50: "x" })).toEqual({ 18: { score: 170, x: 5 } });
    expect(better({ score: 150, x: 2 }, { score: 150, x: 1 })).toBe(true);
    expect(better({ score: 150, x: 1 }, { score: 151, x: 0 })).toBe(false);
    expect(better({ score: 1, x: 0 }, undefined)).toBe(true);
  });
});

describe("archery page", () => {
  afterEach(() => {
    unmountArchery();
    document.body.innerHTML = "";
    window.localStorage.clear();
  });

  it("mounts without WebGL, keeps the distance and falls back on Play", async () => {
    window.localStorage.setItem("cvcm.archery.v1", JSON.stringify({ distance: 50, best: { 50: { score: 140, x: 3 } } }));
    const host = document.createElement("div");
    document.body.append(host);
    mountArchery(host);
    expect(host.querySelector(".g3d-canvas")).toBeNull();
    const sel = host.querySelector<HTMLSelectElement>('[data-in="distance"]')!;
    expect(sel.value).toBe("50");
    sel.value = "70";
    sel.dispatchEvent(new Event("change"));
    const stored = JSON.parse(window.localStorage.getItem("cvcm.archery.v1")!);
    expect(stored.distance).toBe(70);
    // The best at 50 m survives the change.
    expect(stored.best["50"]).toEqual({ score: 140, x: 3 });
    // The cover keeps its Play button: nothing hides it before the 3D view exists.
    expect(host.querySelector<HTMLElement>(".g3d-cover")!.hidden).toBe(false);
    host.querySelector<HTMLButtonElement>('[data-act="new"]')!.click();
    expect(host.querySelector<HTMLElement>(".g3d-cover")!.hidden).toBe(false);
    host.querySelector<HTMLButtonElement>('[data-act="play"]')!.click();
    for (let i = 0; i < 100 && !host.querySelector('[data-act="play"]:not([disabled])'); i++) await new Promise((r) => setTimeout(r, 50));
    expect(host.querySelector<HTMLElement>(".g3d-cover")!.hidden).toBe(false);
  });
});
