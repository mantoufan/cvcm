import { describe, expect, it } from "vitest";
import { aspectText, framesPerSecond, resolutionName, sizeText, videoConstraints } from "../src/shared/webcam";
import { axisText, buttonLabel, restVerdict, stickDistance } from "../src/shared/gamepad";
import { SCREEN_COLORS, labelInk, stepColor } from "../src/shared/dead-pixel";
import { countSkipped, hzFromInterval, medianInterval, nearestStandardRate, steadyInterval } from "../src/shared/refresh-rate";
import { TOUCH_COLS, TOUCH_ROWS, cellAt, cellsAlong, coveragePercent } from "../src/shared/touch";

describe("webcam-test", () => {
  it("builds constraints and names frame sizes", () => {
    expect(videoConstraints("auto", "")).toEqual({});
    expect(videoConstraints("1080p", "cam1")).toEqual({ deviceId: { exact: "cam1" }, width: { ideal: 1920 }, height: { ideal: 1080 } });
    expect(resolutionName(1280, 720)).toBe("720p");
    expect(resolutionName(720, 1280)).toBe("720p");
    expect(resolutionName(1366, 768)).toBe("");
    expect(sizeText(1920, 1080)).toBe("1920 × 1080 (1080p)");
    expect(sizeText(0, 0)).toBe("—");
    expect([aspectText(1280, 720), aspectText(640, 480), aspectText(1366, 768), aspectText(1000, 300)]).toEqual(["16:9", "4:3", "16:9", "10:3"]);
  });
  it("measures frames per second over the last second", () => {
    expect(framesPerSecond([], 5000)).toBe(0);
    const times = Array.from({ length: 61 }, (_, i) => 1000 + i * (1000 / 30));
    expect(framesPerSecond(times, 3000)).toBe(30);
    // The camera froze two seconds ago: no frames in the window.
    expect(framesPerSecond(times, 5100)).toBe(0);
  });
});

describe("gamepad-test", () => {
  it("labels buttons and reads stick drift", () => {
    expect(buttonLabel(0, true)).toBe("A / ✕");
    expect(buttonLabel(16, true)).toBe("Home");
    expect(buttonLabel(17, true)).toBe("B17");
    expect(buttonLabel(0, false)).toBe("B0");
    expect(stickDistance(0.03, 0.04)).toBe(0.05);
    expect(stickDistance(Number.NaN, 0)).toBe(0);
    expect([restVerdict(0.02), restVerdict(0.05), restVerdict(0.15)]).toEqual(["centered", "slight", "drift"]);
    expect([axisText(0.254), axisText(-1), axisText(-0.001)]).toEqual(["+0.25", "−1.00", "0.00"]);
  });
});

describe("dead-pixel", () => {
  it("cycles colours both ways and picks readable label ink", () => {
    const n = SCREEN_COLORS.length;
    expect(stepColor(0, 1)).toBe(1);
    expect(stepColor(n - 1, 1)).toBe(0);
    expect(stepColor(0, -1)).toBe(n - 1);
    expect(labelInk("#ffffff")).toBe("#000000");
    expect(labelInk("#000000")).toBe("#ffffff");
    expect(labelInk("#0000ff")).toBe("#ffffff");
    expect(labelInk("#00ff00")).toBe("#000000");
  });
});

describe("refresh-rate", () => {
  it("estimates Hz from frame intervals", () => {
    expect(medianInterval([])).toBe(0);
    expect(medianInterval([16, 17, 1000, 16.5])).toBe(16.5);
    expect(hzFromInterval(1000 / 144)).toBe(144);
    expect(nearestStandardRate(143.6)).toBe(144);
    expect(nearestStandardRate(59.9)).toBe(60);
    expect(nearestStandardRate(110)).toBeNull();
    // Frame times rounded to whole ms at 240 Hz: the median says 4 ms (250 Hz), the steady mean 4.17 ms.
    const rounded = Array.from({ length: 240 }, (_, i) => Math.round((i + 1) * (1000 / 240)) - Math.round(i * (1000 / 240)));
    expect(medianInterval(rounded)).toBe(4);
    expect(nearestStandardRate(hzFromInterval(steadyInterval(rounded)))).toBe(240);
    expect(steadyInterval([16.7, 16.7, 33.4])).toBeCloseTo(16.7, 5);
    // 480 Hz rounded to whole ms: 2 and 3 ms intervals average to 2.08 ms, and none is a skipped frame.
    const r480 = Array.from({ length: 480 }, (_, i) => Math.round((i + 1) * (1000 / 480)) - Math.round(i * (1000 / 480)));
    expect(nearestStandardRate(hzFromInterval(steadyInterval(r480)))).toBe(480);
    expect(countSkipped(r480, medianInterval(r480))).toBe(0);
    expect(countSkipped([6.9, 6.9, 13.9, 20.8, 7], 6.9)).toBe(2);
  });
});

describe("touch-test", () => {
  it("maps points to grid cells and fills a swipe without gaps", () => {
    expect(cellAt(0, 0, 800, 1200)).toBe(0);
    expect(cellAt(800, 1200, 800, 1200)).toBe(TOUCH_COLS * TOUCH_ROWS - 1);
    expect(cellAt(-1, 5, 800, 1200)).toBe(-1);
    expect(cellsAlong(0, 50, 800, 50, 800, 1200)).toHaveLength(TOUCH_COLS);
    expect(coveragePercent(48)).toBe(50);
    expect(coveragePercent(500)).toBe(100);
  });
});
