import { describe, expect, it } from "vitest";
import { boxAtAnchor, boxAtFree, fitExportSize, mosaicCell, pixelate, redactionBox, tilePitch } from "../src/client/watermark/engine";

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

describe("redactionBox", () => {
  it("maps ratios to pixels and normalizes a box dragged up-left", () => {
    expect(redactionBox({ x: 0.5, y: 0.5, w: -0.25, h: -0.25 }, 1000, 800)).toEqual({ x: 250, y: 200, w: 250, h: 200 });
  });

  it("clamps to the canvas and drops empty boxes", () => {
    expect(redactionBox({ x: 0.9, y: 0.9, w: 0.5, h: 0.5 }, 100, 100)).toEqual({ x: 90, y: 90, w: 10, h: 10 });
    expect(redactionBox({ x: 1.2, y: 0, w: 0.1, h: 0.1 }, 100, 100)).toBeNull();
  });
});

describe("mosaic", () => {
  it("never uses a cell smaller than 6 px", () => {
    expect(mosaicCell(100, 100, 0.01)).toBe(6);
    expect(mosaicCell(2000, 1000, 0.03)).toBe(30);
  });

  it("replaces each block with its exact mean", () => {
    const data = new Uint8ClampedArray([
      0, 0, 0, 255, 200, 100, 40, 255,
      100, 50, 20, 255, 100, 50, 20, 255,
    ]);
    pixelate(data, 2, 2, 2);
    for (let i = 0; i < 16; i += 4) {
      expect([...data.slice(i, i + 4)]).toEqual([100, 50, 20, 255]);
    }
  });
});
