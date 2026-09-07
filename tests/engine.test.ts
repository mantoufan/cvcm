import { describe, expect, it } from "vitest";
import { boxAtAnchor, boxAtFree, fitExportSize, tilePitch } from "../src/client/watermark/engine";

describe("boxAtAnchor", () => {
  it("places a box on the nine-cell grid", () => {
    expect(boxAtAnchor("tl", 1000, 800, 100, 50, 20)).toEqual({ x: 20, y: 20 });
    expect(boxAtAnchor("tr", 1000, 800, 100, 50, 20)).toEqual({ x: 880, y: 20 });
    expect(boxAtAnchor("mc", 1000, 800, 100, 50, 20)).toEqual({ x: 450, y: 375 });
    expect(boxAtAnchor("br", 1000, 800, 100, 50, 20)).toEqual({ x: 880, y: 730 });
  });
});

describe("boxAtFree", () => {
  it("centers the box on a relative point", () => {
    expect(boxAtFree(0.5, 0.5, 1000, 800, 100, 50)).toEqual({ x: 450, y: 375 });
  });
});

describe("tilePitch", () => {
  it("keeps marks from overlapping at the minimum spacing", () => {
    const pitch = tilePitch(120, 24, 0);
    expect(pitch.x).toBeGreaterThanOrEqual(120);
    expect(pitch.y).toBeGreaterThanOrEqual(24);
  });

  it("is tighter than the old canvas-sized extra gap", () => {
    const pitch = tilePitch(120, 24, 0.08);
    expect(pitch.x).toBeLessThan(120 + 1000 * 0.08);
  });
});

describe("fitExportSize", () => {
  it("scales images that exceed the pixel cap", () => {
    const fit = fitExportSize(10000, 10000, 25_000_000);
    expect(fit.scaled).toBe(true);
    expect(fit.width * fit.height).toBeLessThanOrEqual(25_000_000);
  });

  it("leaves small images alone", () => {
    expect(fitExportSize(800, 600)).toEqual({ width: 800, height: 600, scaled: false });
  });
});
