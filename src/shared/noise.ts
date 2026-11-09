/** Noise colours for the white noise generator: sample generators, a seamless loop, and the sleep timer. */

import { shortClock } from "./subtitles";

export const NOISE_COLORS = ["white", "pink", "brown", "green"] as const;
export type NoiseColor = (typeof NOISE_COLORS)[number];

/** Sleep timer choices in minutes; 0 plays until stopped. */
export const TIMER_MINUTES = [0, 15, 30, 60, 120, 480] as const;

/** The sound fades out over this many seconds before the timer ends. */
export const FADE_OUT_S = 30;

/** Seconds of noise per loop, and the crossfade that hides the seam. */
export const LOOP_S = 12;
export const SEAM_S = 0.5;

/** Every colour is scaled to this RMS, so switching colour keeps about the same loudness. */
export const TARGET_RMS = 0.18;

export function isNoiseColor(v: string): v is NoiseColor {
  return (NOISE_COLORS as readonly string[]).includes(v);
}

/**
 * Fills `out` with one colour of noise from uniform `rand()` values in [0, 1).
 * - white: flat spectrum.
 * - pink: −3 dB per octave (Paul Kellet's refined filter).
 * - brown: −6 dB per octave (leaky integrator of white noise).
 * - green: white noise through a band-pass around 500 Hz (the middle of the audible range).
 */
export function fillNoise(color: NoiseColor, out: Float32Array, sampleRate: number, rand: () => number = Math.random): void {
  const white = () => rand() * 2 - 1;
  if (color === "white") {
    for (let i = 0; i < out.length; i++) out[i] = white();
  } else if (color === "pink") {
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < out.length; i++) {
      const w = white();
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      out[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362;
      b6 = w * 0.115926;
    }
  } else if (color === "brown") {
    // A leak pulls the walk back to 0, so it never drifts into a DC offset.
    const leak = Math.exp((-2 * Math.PI * 10) / sampleRate);
    let last = 0;
    for (let i = 0; i < out.length; i++) {
      last = leak * last + white() * 0.02;
      out[i] = last;
    }
  } else {
    const { b0, b1, b2, a1, a2 } = bandPass(500, 0.5, sampleRate);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < out.length; i++) {
      const x = white();
      const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1;
      x1 = x;
      y2 = y1;
      y1 = y;
      out[i] = y;
    }
  }
  normalize(out, TARGET_RMS);
}

/** RBJ cookbook band-pass (constant 0 dB peak), normalised so a0 = 1. */
export function bandPass(freq: number, q: number, sampleRate: number): { b0: number; b1: number; b2: number; a1: number; a2: number } {
  const w = (2 * Math.PI * freq) / sampleRate;
  const alpha = Math.sin(w) / (2 * q);
  const a0 = 1 + alpha;
  return { b0: alpha / a0, b1: 0, b2: -alpha / a0, a1: (-2 * Math.cos(w)) / a0, a2: (1 - alpha) / a0 };
}

/** Scales samples to a target RMS, then clamps the rare peak so nothing clips. */
export function normalize(out: Float32Array, target: number): void {
  let sum = 0;
  for (let i = 0; i < out.length; i++) sum += out[i] * out[i];
  const rms = Math.sqrt(sum / Math.max(1, out.length));
  if (!(rms > 0)) return;
  const k = target / rms;
  for (let i = 0; i < out.length; i++) out[i] = Math.max(-0.99, Math.min(0.99, out[i] * k));
}

/**
 * Makes a buffer loop without a click: `src` holds `loop + seam` samples; the last `seam` samples are
 * crossfaded (equal power) into the start, and the result is `loop` samples long.
 */
export function seamlessLoop(src: Float32Array<ArrayBuffer>, seam: number): Float32Array<ArrayBuffer> {
  const loop = src.length - seam;
  if (seam <= 0 || loop <= seam) return src.slice(0, Math.max(0, loop));
  const out = src.slice(0, loop);
  for (let i = 0; i < seam; i++) {
    const t = (i + 0.5) / seam;
    out[i] = src[i] * Math.sin((t * Math.PI) / 2) + src[loop + i] * Math.cos((t * Math.PI) / 2);
  }
  return out;
}

/** One channel of loopable noise. */
export function noiseLoop(color: NoiseColor, sampleRate: number, rand: () => number = Math.random): Float32Array<ArrayBuffer> {
  const seam = Math.round(SEAM_S * sampleRate);
  const raw = new Float32Array(Math.round(LOOP_S * sampleRate) + seam);
  fillNoise(color, raw, sampleRate, rand);
  return seamlessLoop(raw, seam);
}

/** Timer text "m:ss" or "h:mm:ss" for the seconds left (rounded up, never negative). */
export function timerText(seconds: number): string {
  return shortClock(Math.ceil(seconds));
}
