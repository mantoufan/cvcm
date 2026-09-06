import { describe, expect, it } from "vitest";
import { cellsFor, pixelRect } from "../src/client/collage/engine";

describe("collage layouts", () => {
  it("has the expected cell counts", () => {
    expect(cellsFor("2h")).toHaveLength(2);
    expect(cellsFor("2x2")).toHaveLength(4);
    expect(cellsFor("3x3")).toHaveLength(9);
    expect(cellsFor("l1r2")).toHaveLength(3);
    expect(cellsFor("t1b3")).toHaveLength(4);
  });

  it("splits a two-across canvas with a gap", () => {
    const [left, right] = cellsFor("2h").map((c) => pixelRect(c, 1000, 500, 20));
    expect(left.x).toBe(0);
    expect(left.w).toBe(490);
    expect(right.x).toBe(510);
    expect(right.w).toBe(490);
    expect(left.h).toBe(500);
  });
});
