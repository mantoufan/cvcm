import { rms } from "./mic";

/** Instrument tunings as MIDI note numbers, lowest string first (A4 = 69). */
export const TUNINGS = {
  "guitar": [40, 45, 50, 55, 59, 64],
  "guitar-drop-d": [38, 45, 50, 55, 59, 64],
  "guitar-half-down": [39, 44, 49, 54, 58, 63],
  "guitar-dadgad": [38, 45, 50, 55, 57, 62],
  "guitar-open-g": [38, 43, 50, 55, 59, 62],
  "bass": [28, 33, 38, 43],
  "bass-5": [23, 28, 33, 38, 43],
  "ukulele": [67, 60, 64, 69],
  "violin": [55, 62, 69, 76],
  "cello": [36, 43, 50, 57],
  "chromatic": [],
} as const satisfies Record<string, readonly number[]>;

export type TuningId = keyof typeof TUNINGS;
export const TUNING_IDS = Object.keys(TUNINGS) as TuningId[];

export const DEFAULT_A4 = 440;
export const MIN_A4 = 415;
export const MAX_A4 = 466;
/** Within this many cents the string counts as in tune. */
export const IN_TUNE_CENTS = 5;

export type Notation = "letter" | "solfege";

const LETTER_SHARP = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const LETTER_FLAT = ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"];
const SOLFEGE_SHARP = ["Do", "Do♯", "Re", "Re♯", "Mi", "Fa", "Fa♯", "Sol", "Sol♯", "La", "La♯", "Si"];
const SOLFEGE_FLAT = ["Do", "Re♭", "Re", "Mi♭", "Mi", "Fa", "Sol♭", "Sol", "La♭", "La", "Si♭", "Si"];

/** Note name with octave (scientific pitch: middle C = C4). Tunings tuned down (E♭ standard) read in flats. */
export function noteName(midi: number, notation: Notation = "letter", flats = false, octave = true): string {
  const names = notation === "solfege" ? (flats ? SOLFEGE_FLAT : SOLFEGE_SHARP) : flats ? LETTER_FLAT : LETTER_SHARP;
  const n = Math.round(midi);
  return `${names[((n % 12) + 12) % 12]}${octave ? Math.floor(n / 12) - 1 : ""}`;
}

export function midiToFreq(midi: number, a4 = DEFAULT_A4): number {
  return a4 * Math.pow(2, (midi - 69) / 12);
}

/** Fractional MIDI number of a frequency. */
export function freqToMidi(freq: number, a4 = DEFAULT_A4): number {
  return 69 + 12 * Math.log2(freq / a4);
}

/** Cents from `freq` to the target note (positive = sharp). */
export function centsOff(freq: number, targetMidi: number, a4 = DEFAULT_A4): number {
  return (freqToMidi(freq, a4) - targetMidi) * 100;
}

/** Which string the sound is closest to, or the nearest chromatic note when the tuning has no strings. */
export function nearestTarget(freq: number, tuning: TuningId, a4 = DEFAULT_A4): number {
  const m = freqToMidi(freq, a4);
  const strings = TUNINGS[tuning] as readonly number[];
  if (!strings.length) return Math.round(m);
  let best = strings[0]!;
  for (const s of strings) if (Math.abs(m - s) < Math.abs(m - best)) best = s;
  return best;
}

/** Lowest and highest frequency worth searching for this instrument (a fifth below the lowest string, 2.5× the top string). */
export function searchRange(tuning: TuningId, a4 = DEFAULT_A4): { min: number; max: number } {
  const strings = TUNINGS[tuning] as readonly number[];
  if (!strings.length) return { min: 27.5, max: 2100 };
  return { min: midiToFreq(Math.min(...strings) - 7, a4), max: Math.min(2100, midiToFreq(Math.max(...strings), a4) * 2.5) };
}

/** Below this RMS level the tuner ignores the input (room noise). */
export const MIN_LEVEL = 0.008;

export type Pitch = { freq: number; clarity: number };

let scratchD = new Float64Array(0);
let scratchC = new Float64Array(0);
let scratchHalf = new Float32Array(0);

/**
 * YIN pitch detection (de Cheveigné & Kawahara, 2002): cumulative mean normalised difference, first dip below 0.15,
 * parabolic interpolation. Returns null for silence or noise with no clear period.
 */
export function detectPitch(input: ArrayLike<number>, rate: number, minFreq = 27.5, maxFreq = 2100): Pitch | null {
  if (rms(input) < MIN_LEVEL) return null;
  // Above 50 kHz, average sample pairs first: half the samples and half the lags, a quarter of the work, still 44+ kHz.
  let buf = input;
  let sampleRate = rate;
  if (rate > 50000) {
    if (scratchHalf.length !== input.length >> 1) scratchHalf = new Float32Array(input.length >> 1);
    const half = scratchHalf;
    for (let i = 0; i < half.length; i++) half[i] = (input[2 * i]! + input[2 * i + 1]!) / 2;
    buf = half;
    sampleRate = rate / 2;
  }
  const maxLag = Math.min(Math.floor(sampleRate / minFreq), Math.floor(buf.length / 2));
  const minLag = Math.max(2, Math.floor(sampleRate / maxFreq));
  // Summing over about two of the longest periods is enough; a longer window only costs time.
  const w = Math.min(buf.length - maxLag, 2 * maxLag);
  if (maxLag <= minLag) return null;
  // Reused between calls (the tuner runs this ~20 times a second).
  if (scratchD.length < maxLag + 1) {
    scratchD = new Float64Array(maxLag + 1);
    scratchC = new Float64Array(maxLag + 1);
  }
  const d = scratchD;
  for (let tau = 1; tau <= maxLag; tau++) {
    let sum = 0;
    for (let j = 0; j < w; j++) {
      const diff = buf[j]! - buf[j + tau]!;
      sum += diff * diff;
    }
    d[tau] = sum;
  }
  const cmnd = scratchC;
  cmnd[0] = 1;
  let running = 0;
  for (let tau = 1; tau <= maxLag; tau++) {
    running += d[tau]!;
    cmnd[tau] = running ? (d[tau]! * tau) / running : 1;
  }
  const THRESHOLD = 0.15;
  let tau = -1;
  for (let t = minLag; t <= maxLag; t++) {
    if (cmnd[t]! < THRESHOLD) {
      while (t + 1 <= maxLag && cmnd[t + 1]! < cmnd[t]!) t++;
      tau = t;
      break;
    }
  }
  if (tau < 0) return null;
  // A phone mic rolls off a low string, so its second harmonic can dip below the threshold half a period in. The real
  // period then dips much deeper at double the lag; in a note that really is this high, the two dips are about equal.
  if (cmnd[tau]! > 0.01 && 2 * tau + 2 <= maxLag) {
    let deep = 2 * tau - 2;
    for (let t = deep + 1; t <= 2 * tau + 2; t++) if (cmnd[t]! < cmnd[deep]!) deep = t;
    if (cmnd[deep]! < 0.5 * cmnd[tau]!) tau = deep;
  }
  const y0 = cmnd[tau - 1]!;
  const y1 = cmnd[tau]!;
  const y2 = tau + 1 <= maxLag ? cmnd[tau + 1]! : y1;
  const denom = y0 + y2 - 2 * y1;
  const shift = denom ? (y0 - y2) / (2 * denom) : 0;
  const period = tau + (Math.abs(shift) < 1 ? shift : 0);
  const freq = sampleRate / period;
  if (freq < minFreq || freq > maxFreq) return null;
  return { freq, clarity: Math.max(0, Math.min(1, 1 - y1)) };
}

/** Median of the last readings, so one bad frame does not move the needle. */
export function median(values: readonly number[]): number {
  if (!values.length) return Number.NaN;
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

export function clampA4(v: number): number {
  if (!Number.isFinite(v)) return DEFAULT_A4;
  return Math.round(Math.min(MAX_A4, Math.max(MIN_A4, v)) * 10) / 10;
}

/** Whole cents with a sign: "+3", "−12", "0". */
export function centsText(cents: number): string {
  const c = Math.round(cents);
  if (c === 0) return "0";
  return `${c > 0 ? "+" : "−"}${Math.abs(c)}`;
}
