/** Sound level meter maths: A-weighting filter, time weighting, Leq and the loudness bands. */

/**
 * Default dB SPL of a full-scale (0 dBFS) sine. Phone and laptop microphones differ by ±10 dB or more,
 * so the page offers a calibration offset on top of this. 100 puts a quiet room (about −60 dBFS) near 40 dB and leaves
 * room above 100 dB before the input clips.
 */
export const DEFAULT_FULL_SCALE_DB = 100;
export const CALIBRATION_MIN = -30;
export const CALIBRATION_MAX = 30;

/** Below this the meter reads as its floor. */
export const FLOOR_DBFS = -100;

/** Time constants in seconds (IEC 61672): Fast 125 ms, Slow 1 s. */
export const TIME_WEIGHTS = { fast: 0.125, slow: 1 } as const;
export type TimeWeight = keyof typeof TIME_WEIGHTS;

export const WEIGHTINGS = ["a", "z"] as const;
export type Weighting = (typeof WEIGHTINGS)[number];

/** Loudness bands for the readout, with their lower bounds in dB. */
export const BANDS = [
  { id: "faint", from: -Infinity },
  { id: "quiet", from: 40 },
  { id: "moderate", from: 55 },
  { id: "loud", from: 70 },
  { id: "veryLoud", from: 85 },
  { id: "harmful", from: 100 },
] as const;
export type BandId = (typeof BANDS)[number]["id"];

/** Example sounds shown next to the meter (typical values; they vary a lot with distance). */
export const EXAMPLES = [
  { id: "breathing", db: 10 },
  { id: "whisper", db: 30 },
  { id: "library", db: 40 },
  { id: "office", db: 50 },
  { id: "conversation", db: 60 },
  { id: "vacuum", db: 70 },
  { id: "traffic", db: 85 },
  { id: "motorcycle", db: 95 },
  { id: "concert", db: 110 },
  { id: "siren", db: 120 },
] as const;

export function bandOf(db: number): BandId {
  let band: BandId = "faint";
  for (const b of BANDS) if (db >= b.from) band = b.id;
  return band;
}

/** dBFS of a mean square (power) value, never below the floor. A full-scale sine has mean square 1/2 → −3 dBFS here, so add 3 back. */
export function powerToDbfs(meanSquare: number): number {
  if (!(meanSquare > 0)) return FLOOR_DBFS;
  // 10·log10(2·ms): a full-scale sine reads 0 dBFS, as sound level meters are calibrated with a sine.
  return Math.max(FLOOR_DBFS, 10 * Math.log10(2 * meanSquare));
}

/** Calibrated reading in dB from dBFS and the user's offset. */
export function toDb(dbfs: number, calibration: number): number {
  return dbfs + DEFAULT_FULL_SCALE_DB + calibration;
}

export function clampCalibration(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(CALIBRATION_MIN, Math.min(CALIBRATION_MAX, Math.round(v * 10) / 10));
}

/** Exponential time weighting: blend a new mean square `x` over `dt` seconds into the running value `y`. */
export function timeWeight(y: number, x: number, dt: number, tau: number): number {
  if (!(dt > 0)) return y;
  const k = 1 - Math.exp(-dt / tau);
  return y + (x - y) * k;
}

/** Running energy average (Leq) plus min and max of the time-weighted level, all in dBFS so calibration applies at display. */
export class LevelStats {
  private energy = 0;
  private time = 0;
  min = Infinity;
  max = -Infinity;

  add(meanSquare: number, weightedDbfs: number, dt: number): void {
    if (dt > 0 && Number.isFinite(meanSquare)) {
      this.energy += meanSquare * dt;
      this.time += dt;
    }
    if (Number.isFinite(weightedDbfs)) {
      this.min = Math.min(this.min, weightedDbfs);
      this.max = Math.max(this.max, weightedDbfs);
    }
  }

  /** Leq as dBFS (energy mean over the time measured); null before any audio. */
  leqDbfs(): number | null {
    return this.time > 0 ? powerToDbfs(this.energy / this.time) : null;
  }

  seconds(): number {
    return this.time;
  }
}

export type Biquad = { b: [number, number, number]; a: [number, number, number] };

/** Bilinear transform of H(s) = (n2 s² + n1 s + n0) / (d2 s² + d1 s + d0), normalised so a0 = 1. */
export function bilinear(n: [number, number, number], d: [number, number, number], sampleRate: number): Biquad {
  const k = 2 * sampleRate;
  const k2 = k * k;
  const [n2, n1, n0] = n;
  const [d2, d1, d0] = d;
  const a0 = d2 * k2 + d1 * k + d0;
  return {
    b: [(n2 * k2 + n1 * k + n0) / a0, (2 * n0 - 2 * n2 * k2) / a0, (n2 * k2 - n1 * k + n0) / a0],
    a: [1, (2 * d0 - 2 * d2 * k2) / a0, (d2 * k2 - d1 * k + d0) / a0],
  };
}

/** Pole frequencies of the A-weighting curve (IEC 61672-1), in Hz. */
const F1 = 20.598997;
const F2 = 107.65265;
const F3 = 737.86223;
const F4 = 12194.217;

/**
 * A-weighting as three biquads (for Web Audio IIRFilterNodes), scaled to 0 dB at 1 kHz.
 * Sections 1–2 (the low-frequency poles) are bilinear transforms of s² / (s + ω1)² and s² / ((s + ω2)(s + ω3)).
 * The double pole at 12.2 kHz sits close to Nyquist, where a bilinear pair (zeros at Nyquist) cuts 16 kHz about 3 dB
 * too much and a matched-z pair too little; one of each is within about 0.1 dB of IEC 61672 up to 10 kHz, then reads
 * low by about 0.5–0.7 dB at 12.5 kHz and 2–2.6 dB at 16 kHz (inside the class 1 tolerance of +3.5 / −17 dB there).
 */
export function aWeighting(sampleRate: number): Biquad[] {
  const w = (f: number) => 2 * Math.PI * f;
  const w1 = w(F1);
  const w2 = w(F2);
  const w3 = w(F3);
  const w4 = w(F4);
  const k = 2 * sampleRate;
  // Bilinear first-order ω4 / (s + ω4): b = [g, g], a = [1, q].
  const g = w4 / (k + w4);
  const q = (w4 - k) / (k + w4);
  // Matched-z first-order: (1 − p) / (1 − p z⁻¹).
  const p = Math.exp(-w4 / sampleRate);
  const sections: Biquad[] = [
    bilinear([1, 0, 0], [1, 2 * w1, w1 * w1], sampleRate),
    bilinear([1, 0, 0], [1, w2 + w3, w2 * w3], sampleRate),
    { b: [g * (1 - p), g * (1 - p), 0], a: [1, q - p, -p * q] },
  ];
  const gain = 1 / magnitude(sections, 1000, sampleRate);
  sections[0].b = sections[0].b.map((v) => v * gain) as [number, number, number];
  return sections;
}

/** |H(e^jω)| of a cascade of biquads at `freq` Hz. */
export function magnitude(sections: Biquad[], freq: number, sampleRate: number): number {
  const w = (2 * Math.PI * freq) / sampleRate;
  let mag = 1;
  for (const { b, a } of sections) {
    const num = complexPoly(b, w);
    const den = complexPoly(a, w);
    mag *= Math.hypot(num[0], num[1]) / Math.hypot(den[0], den[1]);
  }
  return mag;
}

function complexPoly(c: readonly number[], w: number): [number, number] {
  let re = 0;
  let im = 0;
  for (let i = 0; i < c.length; i++) {
    re += c[i] * Math.cos(-w * i);
    im += c[i] * Math.sin(-w * i);
  }
  return [re, im];
}

/** Whole-dB text with −0 as 0. */
export function dbText(db: number): string {
  return String(Math.round(db) || 0);
}
