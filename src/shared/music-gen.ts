/**
 * AI music generator (`/ai-music-generator/`): presets and the pure parts shared by the page, the agent docs and
 * the tests. MusicVAE (trio_4bar) writes melody, bass and drums as quantized notes; the page plays them with its
 * own Web Audio synths and exports WAV or MIDI.
 */

export const MUSIC_STYLES = ["lofi", "pop", "chiptune", "ambient", "dance"] as const;
export type MusicStyle = (typeof MUSIC_STYLES)[number];

export type Wave = "sine" | "triangle" | "square" | "sawtooth";

export type StylePreset = {
  bpm: number;
  /** MusicVAE sampling temperature: higher is more surprising, lower more repetitive. */
  temperature: number;
  lead: { wave: Wave; cutoff: number; attack: number; release: number; gain: number; echo: number };
  bass: { wave: Wave; cutoff: number; gain: number };
  /** Drum loudness, 0 to 1. */
  drums: number;
  /** Late off-beat 16ths, as a share of a 16th (lo-fi shuffle). */
  swing: number;
};

export const STYLE_PRESETS: Record<MusicStyle, StylePreset> = {
  lofi: {
    bpm: 80,
    temperature: 0.5,
    lead: { wave: "triangle", cutoff: 2200, attack: 0.01, release: 0.25, gain: 0.22, echo: 0.25 },
    bass: { wave: "sine", cutoff: 900, gain: 0.35 },
    drums: 0.6,
    swing: 0.3,
  },
  pop: {
    bpm: 108,
    temperature: 0.8,
    lead: { wave: "square", cutoff: 3000, attack: 0.005, release: 0.12, gain: 0.12, echo: 0.15 },
    bass: { wave: "sawtooth", cutoff: 700, gain: 0.22 },
    drums: 0.8,
    swing: 0,
  },
  chiptune: {
    bpm: 140,
    temperature: 0.9,
    lead: { wave: "square", cutoff: 12000, attack: 0.002, release: 0.05, gain: 0.1, echo: 0 },
    bass: { wave: "triangle", cutoff: 12000, gain: 0.3 },
    drums: 0.7,
    swing: 0,
  },
  ambient: {
    bpm: 72,
    temperature: 0.6,
    lead: { wave: "sine", cutoff: 4000, attack: 0.08, release: 0.9, gain: 0.22, echo: 0.45 },
    bass: { wave: "sine", cutoff: 600, gain: 0.3 },
    drums: 0.3,
    swing: 0,
  },
  dance: {
    bpm: 124,
    temperature: 0.9,
    lead: { wave: "sawtooth", cutoff: 4000, attack: 0.005, release: 0.1, gain: 0.1, echo: 0.2 },
    bass: { wave: "square", cutoff: 600, gain: 0.18 },
    drums: 1,
    swing: 0,
  },
};

export const MUSIC_BARS = [4, 8, 16] as const;
export type MusicBars = (typeof MUSIC_BARS)[number];

export const SURPRISE = { calm: 0.7, normal: 1, wild: 1.35 } as const;
export type Surprise = keyof typeof SURPRISE;
export const SURPRISE_IDS: readonly Surprise[] = ["calm", "normal", "wild"];

/** The model writes 16 steps per 4/4 bar (4 per quarter note) and 4 bars per sample. */
export const STEPS_PER_QUARTER = 4;
export const STEPS_PER_BAR = 16;
export const BARS_PER_SAMPLE = 4;

export type Part = "lead" | "bass" | "drums";

/** A note as the page uses it: steps from the start of the piece, MIDI pitch, 0–127 velocity. */
export type Note = { part: Part; pitch: number; start: number; end: number; velocity: number };

/** The fields of a Magenta NoteSequence note the page reads. */
export type ModelNote = {
  pitch?: number | null;
  velocity?: number | null;
  quantizedStartStep?: number | null;
  quantizedEndStep?: number | null;
  instrument?: number | null;
  isDrum?: boolean | null;
};

/** Trio samples put the melody on instrument 0, the bass on 1 and the drums (isDrum) on 2. */
export function toNotes(notes: readonly ModelNote[], offsetSteps = 0): Note[] {
  return notes
    .filter((n) => n.pitch != null && n.quantizedStartStep != null)
    .map((n) => {
      const start = (n.quantizedStartStep ?? 0) + offsetSteps;
      const end = Math.max(start + 1, (n.quantizedEndStep ?? n.quantizedStartStep! + 1) + offsetSteps);
      const part: Part = n.isDrum ? "drums" : n.instrument === 1 ? "bass" : "lead";
      return { part, pitch: n.pitch!, start, end, velocity: n.velocity || 80 };
    });
}

/** How many 4-bar samples a piece of `bars` needs: 8 bars = 2 samples, 16 bars = 4 (morphing from one to another). */
export function samplesFor(bars: MusicBars): number {
  return bars / BARS_PER_SAMPLE;
}

/** Seconds per 16th-note step. */
export function stepSeconds(bpm: number): number {
  return 60 / bpm / STEPS_PER_QUARTER;
}

/** When a step sounds, with swing pushing every second 16th late. */
export function stepTime(step: number, bpm: number, swing: number): number {
  const base = step * stepSeconds(bpm);
  return step % 2 === 1 ? base + swing * stepSeconds(bpm) * 0.5 : base;
}

/** Length of a piece in seconds (the loop length, without the echo tail). */
export function pieceSeconds(bars: number, bpm: number): number {
  return bars * STEPS_PER_BAR * stepSeconds(bpm);
}

export function midiToHz(pitch: number): number {
  return 440 * 2 ** ((pitch - 69) / 12);
}

/** General MIDI drum notes the trio model uses, grouped by how the page synthesizes them. */
export function drumKind(pitch: number): "kick" | "snare" | "hat" | "openhat" | "tom" | "cymbal" {
  if (pitch === 35 || pitch === 36) return "kick";
  if (pitch === 37 || pitch === 38 || pitch === 39 || pitch === 40) return "snare";
  if (pitch === 42 || pitch === 44) return "hat";
  if (pitch === 46) return "openhat";
  if (pitch >= 41 && pitch <= 50 && pitch !== 46 && pitch !== 49) return "tom";
  return "cymbal";
}

// --- MIDI file (format 1: a tempo track, then lead, bass and drums on channels 1, 2 and 10) ---

const TICKS_PER_QUARTER = 480;
const TICKS_PER_STEP = TICKS_PER_QUARTER / STEPS_PER_QUARTER;

function varLen(n: number): number[] {
  const bytes = [n & 0x7f];
  for (n >>= 7; n > 0; n >>= 7) bytes.unshift((n & 0x7f) | 0x80);
  return bytes;
}

/** At the same tick: meta events and program changes first, then note-offs, then note-ons. */
function rank(status: number): number {
  const kind = status & 0xf0;
  return kind === 0x90 ? 2 : kind === 0x80 ? 1 : 0;
}

function track(events: { tick: number; data: number[] }[]): number[] {
  events.sort((a, b) => a.tick - b.tick || rank(a.data[0]) - rank(b.data[0]));
  const body: number[] = [];
  let last = 0;
  for (const e of events) {
    body.push(...varLen(e.tick - last), ...e.data);
    last = e.tick;
  }
  body.push(0, 0xff, 0x2f, 0);
  const n = body.length;
  return [0x4d, 0x54, 0x72, 0x6b, (n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255, ...body];
}

/** MIDI tick of a step, with the same swing as the audio (every second 16th late by swing × half a step). */
function tickOf(step: number, swing: number): number {
  return step * TICKS_PER_STEP + (step % 2 === 1 ? Math.round(swing * 0.5 * TICKS_PER_STEP) : 0);
}

/**
 * A standard MIDI file of the piece, so it can be opened in any DAW and played with other instruments. A note is
 * cut where the next note of the same pitch in its part starts, so one note-off never ends a later note.
 */
export function toMidi(notes: readonly Note[], bpm: number, swing = 0): Uint8Array {
  const tempo = Math.round(60_000_000 / bpm);
  const tracks = [track([{ tick: 0, data: [0xff, 0x51, 3, (tempo >> 16) & 255, (tempo >> 8) & 255, tempo & 255] }])];
  const parts: { part: Part; channel: number; program: number }[] = [
    { part: "lead", channel: 0, program: 80 },
    { part: "bass", channel: 1, program: 33 },
    { part: "drums", channel: 9, program: 0 },
  ];
  for (const { part, channel, program } of parts) {
    const events: { tick: number; data: number[] }[] = part === "drums" ? [] : [{ tick: 0, data: [0xc0 | channel, program] }];
    const own = notes.filter((n) => n.part === part).sort((a, b) => a.start - b.start);
    own.forEach((n, i) => {
      const next = own.slice(i + 1).find((m) => m.pitch === n.pitch && m.start >= n.start);
      const end = next && next.start < n.end ? Math.max(n.start + 1, next.start) : n.end;
      const vel = Math.max(1, Math.min(127, Math.round(n.velocity)));
      events.push({ tick: tickOf(n.start, swing), data: [0x90 | channel, n.pitch, vel] });
      // Note-offs sort before note-ons at the same tick (rank), so repeated notes do not cut each other.
      events.push({ tick: tickOf(end, swing), data: [0x80 | channel, n.pitch, 0] });
    });
    tracks.push(track(events));
  }
  const header = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 1, 0, tracks.length, (TICKS_PER_QUARTER >> 8) & 255, TICKS_PER_QUARTER & 255];
  return new Uint8Array([...header, ...tracks.flat()]);
}
