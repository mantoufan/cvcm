export const MIN_FREQ = 20;
export const MAX_FREQ = 20000;
export const DEFAULT_FREQ = 440;
/** Steps on the frequency slider; the slider is logarithmic, so each octave gets the same length. */
export const SLIDER_STEPS = 1000;
export const WAVEFORMS = ["sine", "square", "triangle", "sawtooth"] as const;
export type Waveform = (typeof WAVEFORMS)[number];
/** Preset frequencies in Hz: A4 (tuning), middle C, 1 kHz test tone, a low bass and two high tones for hearing checks. */
export const TONE_PRESETS = [440, 261.63, 1000, 50, 100, 8000, 15000] as const;

/** Rounds to 0.01 Hz and keeps the frequency in range; non-numbers become the default. */
export function clampFreq(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_FREQ;
  return Math.round(Math.min(MAX_FREQ, Math.max(MIN_FREQ, value)) * 100) / 100;
}

export function sliderToFreq(step: number): number {
  const s = Math.min(SLIDER_STEPS, Math.max(0, step)) / SLIDER_STEPS;
  return clampFreq(MIN_FREQ * Math.pow(MAX_FREQ / MIN_FREQ, s));
}

export function freqToSlider(freq: number): number {
  return Math.round((Math.log(clampFreq(freq) / MIN_FREQ) / Math.log(MAX_FREQ / MIN_FREQ)) * SLIDER_STEPS);
}

const NOTE_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"] as const;

/** Nearest equal-tempered note (A4 = 440 Hz) and how many cents the frequency is off it. */
export function nearestNote(freq: number): { name: string; cents: number } {
  const midi = 69 + 12 * Math.log2(clampFreq(freq) / 440);
  const n = Math.round(midi);
  const cents = Math.round((midi - n) * 100);
  return { name: `${NOTE_NAMES[((n % 12) + 12) % 12]}${Math.floor(n / 12) - 1}`, cents: cents === 0 ? 0 : cents };
}

/** Wavelength in air at 20 °C (343 m/s), in metres. */
export function wavelength(freq: number): number {
  return 343 / clampFreq(freq);
}
