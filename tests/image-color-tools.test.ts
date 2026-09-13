import { describe, expect, it } from "vitest";
import { contrastRatio, hexToRgb, parseColor, rgbToHex, rgbToHsl, hslToRgb } from "../src/shared/color";
import { clampRect, applyAspect, fitContain } from "../src/shared/crop";
import { targetSize, formatBytes } from "../src/shared/resize";
import { appHref, parseAppPath } from "../src/shared/path";

describe("color", () => {
  it("parses hex and rgb and keeps contrast math sane", () => {
    expect(hexToRgb("#f7b")).toEqual({ r: 255, g: 119, b: 187 });
    expect(rgbToHex({ r: 255, g: 0, b: 128 })).toBe("#ff0080");
    expect(parseColor("rgb(10, 20, 30)")).toEqual({ r: 10, g: 20, b: 30 });
    const rgb = { r: 247, g: 182, b: 203 };
    const back = hslToRgb(rgbToHsl(rgb));
    expect(back.r).toBeGreaterThan(240);
    expect(contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 })).toBeCloseTo(21, 5);
  });
});

describe("resize", () => {
  it("caps the long edge and scales by percent", () => {
    expect(targetSize(4000, 2000, { kind: "max-edge", edge: 1000 })).toEqual({ width: 1000, height: 500 });
    expect(targetSize(200, 100, { kind: "percent", pct: 50 })).toEqual({ width: 100, height: 50 });
    expect(targetSize(200, 100, { kind: "exact", width: 80, height: 80, lock: true })).toEqual({ width: 80, height: 40 });
    expect(formatBytes(2048)).toBe("2.0 KB");
  });
});

describe("crop", () => {
  it("clamps the rectangle and locks aspect", () => {
    expect(clampRect({ x: -10, y: -10, w: 500, h: 500 }, 100, 80)).toEqual({ x: 0, y: 0, w: 100, h: 80 });
    const square = applyAspect({ x: 0, y: 0, w: 80, h: 40 }, 1, 100, 100);
    expect(square.w).toBeCloseTo(square.h);
    const box = fitContain(200, 100, 100, 100);
    expect(box.w).toBeCloseTo(100);
    expect(box.h).toBeCloseTo(50);
  });
});

describe("new image routes", () => {
  it("parses color, resize, and crop paths", () => {
    expect(parseAppPath("/en/color/")).toEqual({ kind: "app", locale: "en", tool: "color" });
    expect(parseAppPath("/zh-CN/resize/")).toEqual({ kind: "app", locale: "zh-CN", tool: "resize" });
    expect(parseAppPath("/es/crop/")).toEqual({ kind: "app", locale: "es", tool: "crop" });
    expect(appHref("ja", "resize")).toBe("/ja/resize/");
  });
});
