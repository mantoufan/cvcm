/** Virtual piano: note numbers, names, the computer-keyboard map and a recorded take. */

/** MIDI note number → frequency in equal temperament with A4 = 440 Hz. */
export function noteFrequency(midi: number, a4 = 440): number {
  return a4 * 2 ** ((midi - 69) / 12);
}

const LETTERS = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"] as const;
const SOLFEGE = ["Do", "Do♯", "Re", "Re♯", "Mi", "Fa", "Fa♯", "Sol", "Sol♯", "La", "La♯", "Si"] as const;

export const isBlack = (midi: number) => [1, 3, 6, 8, 10].includes(((midi % 12) + 12) % 12);

/** Scientific pitch name: 60 is C4 (middle C), 69 is A4. */
export function noteName(midi: number, style: "letters" | "solfege" = "letters"): string {
  const pc = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return `${(style === "solfege" ? SOLFEGE : LETTERS)[pc]}${style === "letters" ? octave : ""}`;
}

/**
 * Computer keys by physical position (KeyboardEvent.code, so AZERTY and QWERTZ boards play the same places), two
 * octaves laid out like a piano: the Z row plays the lower octave with black keys on the A row, the Q row plays the
 * upper octave with black keys on the number row. Offsets are semitones above the keyboard's base C.
 */
export const KEY_MAP: Readonly<Record<string, number>> = {
  KeyZ: 0, KeyS: 1, KeyX: 2, KeyD: 3, KeyC: 4, KeyV: 5, KeyG: 6, KeyB: 7, KeyH: 8, KeyN: 9, KeyJ: 10, KeyM: 11,
  Comma: 12, KeyL: 13, Period: 14, Semicolon: 15, Slash: 16,
  KeyQ: 12, Digit2: 13, KeyW: 14, Digit3: 15, KeyE: 16, KeyR: 17, Digit5: 18, KeyT: 19, Digit6: 20, KeyY: 21, Digit7: 22, KeyU: 23,
  KeyI: 24, Digit9: 25, KeyO: 26, Digit0: 27, KeyP: 28, BracketLeft: 29, Equal: 30, BracketRight: 31,
};

/** The key cap printed for each code on a US layout, shown on the piano keys. */
export const KEY_CAP: Readonly<Record<string, string>> = Object.fromEntries(
  Object.keys(KEY_MAP).map((code) => [
    code,
    code.startsWith("Key") ? code.slice(3) : code.startsWith("Digit") ? code.slice(5) : ({ Comma: ",", Period: ".", Semicolon: ";", Slash: "/", BracketLeft: "[", BracketRight: "]", Equal: "=" } as Record<string, string>)[code],
  ]),
);

/** For each note above the base C, the first key cap that plays it (the Q row wins over the Z row's top). */
export function capsFor(base: number): Map<number, string> {
  const out = new Map<number, string>();
  const codes = Object.keys(KEY_MAP).sort((a, b) => Number(b.startsWith("Key") && "QWERTYUIOP".includes(b.slice(3))) - Number(a.startsWith("Key") && "QWERTYUIOP".includes(a.slice(3))));
  for (const code of codes) {
    const midi = base + KEY_MAP[code];
    if (!out.has(midi)) out.set(midi, KEY_CAP[code]);
  }
  return out;
}

/** Lowest and highest notes of the 88-key piano (A0 and C8), the range the keyboard can be moved within. */
export const LOWEST = 21;
export const HIGHEST = 108;

/** The keys on screen: `octaves` octaves from C at `startOctave`, plus the top C. */
export function keyRange(startOctave: number, octaves: number): number[] {
  const first = (startOctave + 1) * 12;
  const out: number[] = [];
  for (let m = first; m <= first + octaves * 12; m++) if (m >= LOWEST && m <= HIGHEST) out.push(m);
  return out;
}

export type TakeEvent = { t: number; midi: number; on: boolean };

/** Most notes a take keeps (about 20 minutes of busy playing). */
export const MAX_TAKE = 20_000;

/** Closes notes still held at the end of a take, so playback does not leave them ringing. */
export function closeTake(events: readonly TakeEvent[], end: number): TakeEvent[] {
  const held = new Set<number>();
  for (const e of events) {
    if (e.on) held.add(e.midi);
    else held.delete(e.midi);
  }
  return [...events, ...[...held].map((midi) => ({ t: end, midi, on: false }))];
}
