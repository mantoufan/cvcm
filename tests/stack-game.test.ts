import { describe, expect, it } from "vitest";
import { COMBO_TO_GROW, START_SIZE, SLIDE_RANGE, axisFor, growSlab, hueFor, placeSlab, slideOffset, speed, type Slab } from "../src/shared/stack-game";

const base: Slab = { x: 0, z: 0, w: 3, d: 3 };
const close = (a: number, b: number) => expect(a).toBeCloseTo(b, 9);

describe("stack game placement", () => {
  it("keeps the whole slab on an exact overlap", () => {
    const r = placeSlab(base, { ...base }, "x");
    expect(r).toMatchObject({ perfect: true, missed: false, cut: null });
    expect(r.kept).toEqual(base);
  });

  it("snaps a drop within the tolerance onto the slab below", () => {
    const r = placeSlab(base, { ...base, z: 0.05 }, "z", 0.08);
    expect(r.perfect).toBe(true);
    expect(r.kept).toEqual(base);
  });

  for (const axis of ["x", "z"] as const) {
    const size = (s: Slab) => (axis === "x" ? s.w : s.d);
    it(`cuts the right overhang on ${axis}`, () => {
      const r = placeSlab(base, { ...base, [axis]: 1 }, axis);
      expect(r.perfect).toBe(false);
      close(r.kept![axis], 0.5);
      close(size(r.kept!), 2);
      close(r.cut![axis], 2);
      close(size(r.cut!), 1);
      // The other axis is untouched.
      expect(axis === "x" ? r.kept!.d : r.kept!.w).toBe(3);
    });

    it(`cuts the left overhang on ${axis}`, () => {
      const r = placeSlab(base, { ...base, [axis]: -1.2 }, axis);
      close(r.kept![axis], -0.6);
      close(size(r.kept!), 1.8);
      close(r.cut![axis], -2.1);
      close(size(r.cut!), 1.2);
    });

    it(`misses when nothing overlaps on ${axis}`, () => {
      const r = placeSlab(base, { ...base, [axis]: 3 }, axis);
      expect(r).toMatchObject({ kept: null, missed: true, perfect: false });
      expect(r.cut).toEqual({ ...base, [axis]: 3 });
    });
  }

  it("keeps a thin slab in place on a narrower tower", () => {
    const prev: Slab = { x: 0.5, z: 0, w: 1, d: 3 };
    const r = placeSlab(prev, { x: 0.9, z: 0, w: 1, d: 3 }, "x");
    close(r.kept!.x, 0.7);
    close(r.kept!.w, 0.6);
  });
});

describe("stack game combo and pace", () => {
  it("grows only from the combo and never past the start size", () => {
    const small: Slab = { x: 0, z: 0, w: 2, d: 1 };
    expect(growSlab(small, COMBO_TO_GROW - 1)).toEqual(small);
    const grown = growSlab(small, COMBO_TO_GROW);
    expect(grown.w).toBeGreaterThan(2);
    expect(grown.d).toBeGreaterThan(1);
    let s = small;
    for (let i = 0; i < 50; i++) s = growSlab(s, COMBO_TO_GROW + i);
    expect(s.w).toBe(START_SIZE);
    expect(s.d).toBe(START_SIZE);
  });

  it("speeds up with height and then levels off", () => {
    expect(speed(10)).toBeGreaterThan(speed(1));
    expect(speed(200)).toBe(speed(60));
  });

  it("slides back and forth between the two ends", () => {
    expect(slideOffset(0)).toBe(-SLIDE_RANGE);
    close(slideOffset(2 * SLIDE_RANGE), SLIDE_RANGE);
    close(slideOffset(4 * SLIDE_RANGE), -SLIDE_RANGE);
    close(slideOffset(SLIDE_RANGE), 0);
    close(slideOffset(3 * SLIDE_RANGE), 0);
  });

  it("alternates axes and keeps hues in the pastel range", () => {
    expect([1, 2, 3, 4].map(axisFor)).toEqual(["x", "z", "x", "z"]);
    for (let l = 0; l < 100; l++) {
      const hue = hueFor(l);
      expect(hue >= 300 || hue <= 20).toBe(true);
    }
  });
});
