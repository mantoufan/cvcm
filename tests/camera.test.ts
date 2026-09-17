import { describe, expect, it } from "vitest";
import {
  circleOfConfusionMm,
  cocDiameterPx,
  composeGrade,
  exposureValue,
  filterGrade,
  gaussianSigmaPx,
  handshakePx,
  solveAv,
  solveP,
  teachingHints,
} from "../src/shared/camera";
import {
  EXPORT_LONG_EDGE_PX,
  FRAME_LIVE,
  MATCH,
  catalog,
  clampDistance,
  defaultSimState,
  exportGeometry,
  frameCropFrom32,
  parseSimQuery,
  serializeSimQuery,
  sensorSourceRect,
  sitterDest32,
  subjectScale,
} from "../src/shared/portrait-sim";

const FF = { maxAperture: 1.8, minAperture: 16, apertureLocked: false };
const PHONE = { maxAperture: 1.8, minAperture: 1.8, apertureLocked: true };
const SENSOR = FRAME_LIVE["3-2"];
const WINDOW = catalog.scenes.window;
const MIRA_STAND = catalog.cutouts.find((c) => c.person === "mira" && c.pose === "stand34")!;

describe("exposure", () => {
  it("puts sunny 16 near EV 15 at ISO 100", () => {
    expect(exposureValue(16, 1 / 100, 100)).toBeCloseTo(14.64, 1);
  });
});

describe("CoC", () => {
  it("uses millimetres and (s - f) for the window plane", () => {
    const wide = circleOfConfusionMm({
      focalMm: 50,
      sensorWidthMm: 36,
      aperture: 1.8,
      focusM: 2.2,
      planeM: 4.5,
    });
    const narrow = circleOfConfusionMm({
      focalMm: 50,
      sensorWidthMm: 36,
      aperture: 8,
      focusM: 2.2,
      planeM: 4.5,
    });
    expect(wide).toBeCloseTo(0.33, 2);
    const widePx = cocDiameterPx(wide, 1440);
    const narrowPx = cocDiameterPx(narrow, 1440);
    expect(widePx).toBeCloseTo(13.2, 1);
    expect(gaussianSigmaPx(widePx)).toBeCloseTo(6.6, 1);
    expect(widePx).toBeLessThan(48);
    expect(narrowPx).toBeLessThan(5);
    expect(widePx).toBeGreaterThan(10);
    expect(widePx / narrowPx).toBeCloseTo(8 / 1.8, 1);
  });

  it("gives the phone deeper DOF than 85 mm full-frame", () => {
    const opts = { aperture: 1.8, focusM: 2.2, planeM: 4.5 };
    const phone = cocDiameterPx(
      circleOfConfusionMm({ ...opts, focalMm: 26, sensorWidthMm: 6.4 }),
      1440,
      6.4,
    );
    const portrait = cocDiameterPx(
      circleOfConfusionMm({ ...opts, focalMm: 85, sensorWidthMm: 36 }),
      1440,
    );
    expect(phone).toBeLessThan(portrait);
  });
});

describe("P / Av", () => {
  it("solves the locked P table", () => {
    const window = solveP(11, FF, false, true, 200, 50);
    expect(window.aperture).toBe(4);
    expect(window.iso).toBe(100);
    expect(window.shutterSec).toBeCloseTo(1 / 125, 8);

    const sunny = solveP(15, FF, false, true, 200, 50);
    expect(sunny.aperture).toBe(4);
    expect(sunny.iso).toBe(100);
    expect(sunny.shutterSec).toBeCloseTo(1 / 2000, 8);

    const dim = solveP(8, FF, false, true, 200, 85);
    expect(dim.aperture).toBe(4);
    expect(dim.iso).toBe(800);
    expect(dim.shutterSec).toBeCloseTo(1 / 125, 8);
  });

  it("keeps the phone at f/1.8 in P and Av", () => {
    expect(solveP(11, PHONE, false, true, 200, 26).aperture).toBe(1.8);
    expect(solveAv(11, PHONE, 4, 200).aperture).toBe(1.8);
  });

  it("does not climb ISO in Av", () => {
    const av = solveAv(8, FF, 2.8, 200);
    expect(av.iso).toBe(200);
  });
});

describe("handshake and grade", () => {
  it("is zero on a tripod", () => {
    expect(handshakePx({ tripod: true, focalMm: 85, shutterSec: 1 / 15, viewWidthPx: 1440 })).toBe(0);
  });

  it("treats UV as identity", () => {
    expect(filterGrade("uv")).toEqual(filterGrade("none"));
    const grade = composeGrade("overcast", "uv", 1);
    expect(grade.matrix).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);
    expect(grade.gain).toBe(1);
    expect(grade.bloom).toBe(0);
  });

  it("snapshots warm and cool diagonals and light-then-filter order", () => {
    expect(filterGrade("warm").matrix).toEqual([1.2, 0, 0, 0, 1, 0, 0, 0, 0.72]);
    expect(filterGrade("cool").matrix).toEqual([0.88, 0, 0, 0, 0.98, 0, 0, 0, 1.18]);
    const composed = composeGrade("sunny", "warm", 1);
    expect(composed.matrix[0]).toBeCloseTo(1.08 * 1.2, 8);
    expect(composed.matrix[8]).toBeCloseTo(0.92 * 0.72, 8);
    expect(composed.contrast).toBe(1.15);
  });
});

describe("hints", () => {
  it("caps at two and treats wideClose as copy-only", () => {
    const hints = teachingHints({
      deltaEV: 2,
      handshake: 3,
      focalMm: 24,
      distanceM: 1.2,
      cocDiameterPx: 0.4,
      filter: "uv",
      light: "sunny",
      defaultLight: "window",
    });
    expect(hints).toHaveLength(2);
    expect(hints[0]).toBe("underexposed");
    expect(hints[1]).toBe("handshake");
  });
});

describe("catalog", () => {
  it("has twelve adult cutouts and matching pose distances", () => {
    expect(catalog.cutouts).toHaveLength(12);
    expect(MATCH.destHPx).toBe(1080);
    expect(EXPORT_LONG_EDGE_PX["135"]).toBe(1280);
    expect(catalog.lenses.phone.minAperture).toBe(1.8);
    expect(catalog.lenses.phone.sensorWidthMm).toBe(6.4);
    for (const item of catalog.cutouts) {
      expect(item.subjectDistanceM).toBe(catalog.poses[item.pose].subjectDistanceM);
    }
    expect(catalog.scenes.cafe.plates.wide.fgSrc).toBeTruthy();
    expect(catalog.scenes.cafe.plates.tele.fgSrc).toBeTruthy();
    expect(catalog.scenes.cafe.plates.wide.fgSrc).not.toBe(catalog.scenes.cafe.plates.tele.fgSrc);
    expect(catalog.scenes.indoor.plates.wide.fgSrc).toBeNull();
    expect(catalog.scenes.shade.plates.tele.fgSrc).toBeNull();
    for (const scene of Object.values(catalog.scenes)) {
      expect(scene.distanceMinM).toBeLessThan(scene.distanceMaxM);
      expect(scene.distanceMaxM).toBeLessThanOrEqual(scene.bgDistanceM - 0.3 + 1e-9);
      if (scene.fgDistanceM !== null) {
        expect(scene.distanceMinM).toBeGreaterThanOrEqual(scene.fgDistanceM + 0.2 - 1e-9);
      }
      expect(clampDistance(scene.id, MATCH.distanceM)).toBe(MATCH.distanceM);
    }
  });
});

describe("3:2 geometry", () => {
  it("keeps destH independent of frame and lifts MATCH eyes into the crop", () => {
    const src = sensorSourceRect(WINDOW.plates.wide, 50);
    const scale = subjectScale(50, 2.2);
    expect(scale).toBe(1);
    const frames = ["3-2", "4-5", "16-9"] as const;
    const heights = frames.map((frame) => {
      const dest = sitterDest32(MIRA_STAND, scale, WINDOW, src, WINDOW.plates.wide.heightPx, SENSOR, frame);
      const crop = frameCropFrom32(frame, SENSOR);
      const eyeY = dest.y + dest.h * MIRA_STAND.eye.y;
      expect(eyeY).toBeGreaterThanOrEqual(crop.y + MATCH.eyeHeadroom * crop.h - 1e-6);
      expect(eyeY).toBeLessThan(crop.y + crop.h);
      return dest.h;
    });
    expect(heights[0]).toBeCloseTo(1080, 6);
    expect(heights[1]).toBeCloseTo(heights[0], 6);
    expect(heights[2]).toBeCloseTo(heights[0], 6);
    const crop45 = frameCropFrom32("4-5", SENSOR);
    expect(crop45.w).toBeCloseTo(768, 5);
    expect(crop45.x).toBeCloseTo(336, 5);
    const crop169 = frameCropFrom32("16-9", SENSOR);
    expect(crop169.h).toBeCloseTo(810, 5);
    expect(crop169.y).toBeCloseTo(75, 5);
  });

  it("keeps 24 mm feet on the floor and magnifies tele at MATCH", () => {
    const src = sensorSourceRect(WINDOW.plates.wide, 24);
    const dest = sitterDest32(
      MIRA_STAND,
      subjectScale(24, 2.2),
      WINDOW,
      src,
      WINDOW.plates.wide.heightPx,
      SENSOR,
      "3-2",
    );
    expect(dest.y).toBeGreaterThanOrEqual(0);
    const floorInSrc = (WINDOW.floorY * WINDOW.plates.wide.heightPx - src.y) / src.h;
    const floorPx = floorInSrc * SENSOR.h;
    expect(dest.y + dest.h * MIRA_STAND.feetY).toBeCloseTo(floorPx, 5);

    const h50 = MATCH.destHPx * subjectScale(50, 2.2);
    const h85 = MATCH.destHPx * subjectScale(85, 2.2);
    const h135 = MATCH.destHPx * subjectScale(135, 2.2);
    expect(h135).toBeGreaterThan(h85);
    expect(h85).toBeGreaterThan(h50);
  });

  it("never upscales export", () => {
    for (const lens of Object.values(catalog.lenses)) {
      for (const frame of ["3-2", "4-5", "16-9"] as const) {
        const plate = WINDOW.plates[lens.plate];
        const geo = exportGeometry(plate, lens.focalMm, frame, lens.id);
        const srcFrame = frameCropFrom32(frame, { w: geo.nativeSrc.w, h: geo.nativeSrc.h });
        expect(geo.output.w).toBeLessThanOrEqual(srcFrame.w + 1);
        expect(geo.output.h).toBeLessThanOrEqual(srcFrame.h + 1);
        expect(Math.max(geo.output.w, geo.output.h)).toBeLessThanOrEqual(EXPORT_LONG_EDGE_PX[lens.id]);
        expect(geo.output.w / geo.output.h).toBeCloseTo(FRAME_ASPECT_SAFE(frame), 2);
      }
    }
  });
});

function FRAME_ASPECT_SAFE(frame: "3-2" | "4-5" | "16-9"): number {
  return frame === "3-2" ? 1.5 : frame === "4-5" ? 0.8 : 16 / 9;
}

describe("query", () => {
  it("parses valid keys and ignores junk", () => {
    const parsed = parseSimQuery("?lens=85&scene=cafe&frame=4-5&nope=1&iso=abc");
    expect(parsed.lens).toBe("85");
    expect(parsed.scene).toBe("cafe");
    expect(parsed.frame).toBe("4-5");
    expect(parsed.iso).toBeUndefined();
    const text = serializeSimQuery(defaultSimState());
    expect(text.startsWith("?")).toBe(true);
    expect(text).toContain("person=mira");
  });
});
