import { describe, expect, it } from "vitest";
import { FADE_OUT_S, NOISE_COLORS, TARGET_RMS, bandPass, fillNoise, noiseLoop, seamlessLoop, timerText } from "../src/shared/noise";
import { LevelStats, aWeighting, bandOf, clampCalibration, magnitude, powerToDbfs, timeWeight, toDb } from "../src/shared/decibel";
import { clockText, elapsedMs, extensionFor, pickType, recordingName, AUDIO_TYPES } from "../src/shared/recorder";
import { fmt, layout, solveTriangle } from "../src/shared/triangle";

/** Deterministic uniform values (mulberry32), so spectra are the same every run. */
function seeded(seed = 1): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Power in a band from a naive DFT over a few bins (enough to compare octaves). */
function bandPower(x: Float32Array, rate: number, lo: number, hi: number): number {
  const n = 8192;
  let total = 0;
  let bins = 0;
  for (let k = Math.ceil((lo * n) / rate); k <= Math.floor((hi * n) / rate); k += 4) {
    let re = 0;
    let im = 0;
    for (let i = 0; i < n; i++) {
      const w = (2 * Math.PI * k * i) / n;
      re += x[i] * Math.cos(w);
      im -= x[i] * Math.sin(w);
    }
    total += re * re + im * im;
    bins++;
  }
  return total / bins;
}

const rms = (x: Float32Array) => Math.sqrt(x.reduce((s, v) => s + v * v, 0) / x.length);

describe("noise", () => {
  const rate = 48000;

  it("scales every colour to the same RMS without clipping", () => {
    for (const color of NOISE_COLORS) {
      const out = new Float32Array(rate);
      fillNoise(color, out, rate, seeded(7));
      expect(rms(out)).toBeGreaterThan(TARGET_RMS * 0.97);
      expect(rms(out)).toBeLessThan(TARGET_RMS * 1.03);
      expect(Math.max(...out.map(Math.abs))).toBeLessThan(1);
    }
  });

  it("gives each colour its slope", () => {
    const octave = (color: (typeof NOISE_COLORS)[number]) => {
      const out = new Float32Array(rate);
      fillNoise(color, out, rate, seeded(3));
      // dB change from the 500–1000 Hz octave to the 2000–4000 Hz one (two octaves up).
      return 10 * Math.log10(bandPower(out, rate, 2000, 4000) / bandPower(out, rate, 500, 1000));
    };
    expect(Math.abs(octave("white"))).toBeLessThan(1.5);
    expect(octave("pink")).toBeGreaterThan(-8);
    expect(octave("pink")).toBeLessThan(-4);
    expect(octave("brown")).toBeGreaterThan(-14);
    expect(octave("brown")).toBeLessThan(-10);
  });

  it("peaks the green band-pass at 500 Hz", () => {
    const { b0, b1, b2, a1, a2 } = bandPass(500, 0.5, rate);
    const gainAt = (f: number) => {
      const w = (2 * Math.PI * f) / rate;
      const num = Math.hypot(b0 + b1 * Math.cos(w) + b2 * Math.cos(2 * w), -(b1 * Math.sin(w) + b2 * Math.sin(2 * w)));
      const den = Math.hypot(1 + a1 * Math.cos(w) + a2 * Math.cos(2 * w), -(a1 * Math.sin(w) + a2 * Math.sin(2 * w)));
      return num / den;
    };
    expect(gainAt(500)).toBeCloseTo(1, 3);
    expect(gainAt(5000)).toBeLessThan(0.2);
    expect(gainAt(50)).toBeLessThan(0.2);
  });

  it("crossfades the loop seam", () => {
    const src = Float32Array.from({ length: 110 }, (_, i) => (i < 100 ? 1 : -1));
    const out = seamlessLoop(src, 10);
    expect(out).toHaveLength(100);
    // The start fades in from the tail (−1) towards the head (1); the end is untouched.
    expect(out[0]).toBeLessThan(-0.8);
    expect(out[9]).toBeGreaterThan(0.8);
    expect(out[99]).toBe(1);
    expect(noiseLoop("white", 8000, seeded(1))).toHaveLength(8000 * 12);
  });

  it("formats the timer", () => {
    expect(timerText(0)).toBe("0:00");
    expect(timerText(59.2)).toBe("1:00");
    expect(timerText(3600)).toBe("1:00:00");
    expect(timerText(-5)).toBe("0:00");
    expect(FADE_OUT_S).toBe(30);
  });
});

describe("decibel", () => {
  it("matches the A-weighting table", () => {
    for (const rate of [44100, 48000]) {
      const a = aWeighting(rate);
      const db = (f: number) => 20 * Math.log10(magnitude(a, f, rate));
      expect(db(1000)).toBeCloseTo(0, 6);
      expect(db(100)).toBeCloseTo(-19.1, 0);
      expect(db(50)).toBeCloseTo(-30.2, 0);
      expect(db(500)).toBeCloseTo(-3.2, 0);
      expect(db(2000)).toBeCloseTo(1.2, 0);
      expect(db(4000)).toBeCloseTo(1.0, 0);
      expect(db(8000)).toBeCloseTo(-1.1, 0);
      expect(db(10000)).toBeCloseTo(-2.5, 0);
      // IEC 61672 class 1 allows +3.5 / −17 dB at 16 kHz; the standard value is −6.6.
      expect(Math.abs(db(16000) - -6.6)).toBeLessThan(3);
    }
  });

  it("reads a full-scale sine as 0 dBFS and calibrates", () => {
    expect(powerToDbfs(0.5)).toBeCloseTo(0, 9);
    expect(powerToDbfs(0)).toBe(-100);
    expect(toDb(-40, 0)).toBe(60);
    expect(toDb(-40, -5)).toBe(55);
    expect(clampCalibration(99)).toBe(30);
    expect(clampCalibration(Number.NaN)).toBe(0);
    expect(clampCalibration(2.345)).toBe(2.3);
  });

  it("time-weights, averages energy and bands", () => {
    // After one time constant the reading has moved 63% of the way.
    expect(timeWeight(0, 1, 0.125, 0.125)).toBeCloseTo(1 - Math.exp(-1), 9);
    const stats = new LevelStats();
    stats.add(0.5, 0, 1);
    stats.add(0.005, -20, 1);
    // Energy mean of 0 dBFS and −20 dBFS for a second each.
    expect(stats.leqDbfs()!).toBeCloseTo(10 * Math.log10(0.505), 6);
    expect(stats.min).toBe(-20);
    expect(stats.max).toBe(0);
    expect(new LevelStats().leqDbfs()).toBeNull();
    expect(bandOf(20)).toBe("faint");
    expect(bandOf(55)).toBe("moderate");
    expect(bandOf(84.9)).toBe("loud");
    expect(bandOf(100)).toBe("harmful");
  });
});

describe("recorder helpers", () => {
  it("picks the first supported type and names the file", () => {
    expect(pickType(AUDIO_TYPES, (t) => t.startsWith("audio/mp4"))).toBe("audio/mp4;codecs=mp4a.40.2");
    expect(pickType(AUDIO_TYPES, () => { throw new Error("x"); })).toBe("");
    expect(extensionFor("audio/webm;codecs=opus")).toBe("webm");
    expect(extensionFor("audio/mp4")).toBe("m4a");
    expect(extensionFor("video/mp4;codecs=avc1")).toBe("mp4");
    expect(extensionFor("audio/ogg;codecs=opus")).toBe("ogg");
    expect(recordingName("recording", new Date(2026, 10, 10, 9, 5, 7), "webm")).toBe("recording-2026-11-10-090507.webm");
  });

  it("formats time and elapsed time", () => {
    expect(clockText(0)).toBe("0:00");
    expect(clockText(61_999)).toBe("1:01");
    expect(clockText(3_600_000)).toBe("1:00:00");
    expect(elapsedMs(1000, null, 5000)).toBe(1000);
    expect(elapsedMs(1000, 4000, 5000)).toBe(2000);
  });
});

describe("triangle", () => {
  const one = (r: ReturnType<typeof solveTriangle>) => {
    if (!r.ok) throw new Error(r.error);
    return r.solutions[0];
  };

  it("solves SSS 3-4-5 as a right triangle", () => {
    const t = one(solveTriangle({ a: 3, b: 4, c: 5 }));
    expect(t.C).toBeCloseTo(90, 9);
    expect(t.A).toBeCloseTo(36.8699, 4);
    expect(t.area).toBeCloseTo(6, 9);
    expect(t.perimeter).toBe(12);
    expect(t.byAngles).toBe("right");
    expect(t.bySides).toBe("scalene");
    expect(t.inradius).toBeCloseTo(1, 9);
    expect(t.circumradius).toBeCloseTo(2.5, 9);
    expect(t.hc).toBeCloseTo(2.4, 9);
  });

  it("solves SAS, ASA and AAS", () => {
    const sas = solveTriangle({ a: 5, b: 7, C: 60 });
    expect(sas.ok && sas.case).toBe("sas");
    expect(one(sas).c).toBeCloseTo(Math.sqrt(39), 9);
    const asa = solveTriangle({ A: 50, B: 60, c: 10 });
    expect(asa.ok && asa.case).toBe("asa");
    expect(one(asa).C).toBeCloseTo(70, 9);
    expect(one(asa).a).toBeCloseTo((10 * Math.sin((50 * Math.PI) / 180)) / Math.sin((70 * Math.PI) / 180), 9);
    const aas = solveTriangle({ A: 50, B: 60, a: 10 });
    expect(aas.ok && aas.case).toBe("aas");
    const eq = one(solveTriangle({ A: 60, B: 60, a: 2 }));
    expect(eq.bySides).toBe("equilateral");
    expect(one(solveTriangle({ a: 4, b: 4, C: 100 })).byAngles).toBe("obtuse");
  });

  it("handles the ambiguous SSA case", () => {
    const two = solveTriangle({ a: 6, b: 8, A: 30 });
    expect(two.ok && two.solutions).toHaveLength(2);
    if (!two.ok) return;
    expect(two.solutions[0].B).toBeCloseTo(41.8103, 4);
    expect(two.solutions[1].B).toBeCloseTo(138.1897, 4);
    const single = solveTriangle({ a: 10, b: 8, A: 30 });
    expect(single.ok && single.solutions).toHaveLength(1);
    expect(solveTriangle({ a: 3, b: 8, A: 30 })).toEqual({ ok: false, error: "noTriangle" });
    // Height exactly equal to a: one right triangle.
    const touch = solveTriangle({ a: 4, b: 8, A: 30 });
    expect(touch.ok && touch.solutions).toHaveLength(1);
    expect(one(touch).B).toBeCloseTo(90, 6);
  });

  it("solves right triangles from two values", () => {
    expect(one(solveTriangle({ a: 3, b: 4 }, true)).c).toBeCloseTo(5, 12);
    expect(one(solveTriangle({ a: 5, c: 13 }, true)).b).toBeCloseTo(12, 12);
    expect(one(solveTriangle({ b: 12, c: 13 }, true)).a).toBeCloseTo(5, 12);
    const angle = one(solveTriangle({ A: 30, c: 10 }, true));
    expect(angle.a).toBeCloseTo(5, 12);
    expect(angle.B).toBeCloseTo(60, 12);
    expect(one(solveTriangle({ B: 30, a: 10 }, true)).c).toBeCloseTo(20 / Math.sqrt(3), 12);
    expect(one(solveTriangle({ A: 30, b: 10 }, true)).c).toBeCloseTo(20 / Math.sqrt(3), 12);
    expect(solveTriangle({ a: 13, c: 5 }, true)).toEqual({ ok: false, error: "hypotenuse" });
    expect(solveTriangle({ A: 30, B: 60 }, true)).toEqual({ ok: false, error: "needSide" });
    expect(solveTriangle({ a: 3, b: 4, c: 5 }, true)).toEqual({ ok: false, error: "rightTooMany" });
    expect(solveTriangle({ a: 3 }, true)).toEqual({ ok: false, error: "needThree" });
  });

  it("rejects impossible input", () => {
    expect(solveTriangle({ a: 1, b: 2, c: 3 })).toEqual({ ok: false, error: "inequality" });
    expect(solveTriangle({ A: 90, B: 90, c: 3 })).toEqual({ ok: false, error: "angleSum" });
    expect(solveTriangle({ A: 30, B: 60, C: 90 })).toEqual({ ok: false, error: "needSide" });
    expect(solveTriangle({ a: 3, b: 4 })).toEqual({ ok: false, error: "needThree" });
    expect(solveTriangle({ a: 3, b: 4, c: 5, A: 30 })).toEqual({ ok: false, error: "tooMany" });
    expect(solveTriangle({ a: -3, b: 4, c: 5 })).toEqual({ ok: false, error: "positive" });
    expect(solveTriangle({ a: 3, b: 4, A: 200 })).toEqual({ ok: false, error: "angleRange" });
  });

  it("formats and lays out", () => {
    expect(fmt(36.86989764584402)).toBe("36.8699");
    expect(fmt(5)).toBe("5");
    expect(fmt(-0.00001)).toBe("-1e-5");
    expect(fmt(-0.000001, 4)).toBe("-1e-6");
    const t = one(solveTriangle({ a: 3, b: 4, c: 5 }));
    const p = layout(t, 300, 200, 20);
    for (const [x, y] of [p.A, p.B, p.C]) {
      expect(x).toBeGreaterThanOrEqual(19.99);
      expect(x).toBeLessThanOrEqual(280.01);
      expect(y).toBeGreaterThanOrEqual(19.99);
      expect(y).toBeLessThanOrEqual(180.01);
    }
  });
});
