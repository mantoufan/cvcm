import { armAudio, resumeIfPaused } from "../audio";
import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { HIGHEST, KEY_MAP, LOWEST, MAX_TAKE, capsFor, closeTake, isBlack, keyRange, noteFrequency, noteName, type TakeEvent } from "../../shared/piano";

export const SOUNDS = ["piano", "epiano", "organ", "synth"] as const;
type Sound = (typeof SOUNDS)[number];
const LABELS = ["letters", "solfege", "keys", "none"] as const;
type LabelMode = (typeof LABELS)[number];
const OCTAVE_CHOICES = [1, 2, 3, 4] as const;

type Voice = { /** Audio-clock time the sound is over (Infinity while held). */ endsAt: number; release: (at: number) => void; /** Fades out now, even a note scheduled ahead or already given a release time. */ cut: () => void; kill: () => void };

type State = {
  ctx: AudioContext | null;
  master: GainNode | null;
  sound: Sound;
  volume: number;
  sustain: boolean;
  /** Space held down: the pedal. */
  pedal: boolean;
  startOctave: number;
  octaves: number;
  labels: LabelMode;
  /** Sounding notes; a note may be held by several sources (two fingers, a key and the mouse). */
  voices: Map<number, Voice>;
  holders: Map<number, Set<string>>;
  /** Released while the pedal or sustain held them: they stop when it lifts. */
  pedalled: Set<number>;
  keysEl: HTMLElement;
  keyEls: Map<number, HTMLElement>;
  pointers: Map<number, number>;
  recording: boolean;
  recStart: number;
  take: TakeEvent[];
  /** Pending playback timers (the scheduler interval and key lights); each removes itself when it fires. */
  playTimers: Set<number>;
  playVoices: Voice[];
  status: HTMLElement;
  buttons: Record<"record" | "play" | "clear", HTMLButtonElement>;
  rangeEl: HTMLElement;
};

let s: State | null = null;

/** Lowest start octave and highest, so the shown keys stay within A0–C8. */
const MIN_START = 0;
const MAX_START = 7;

export function mountPiano(host: HTMLElement): void {
  unmountPiano();
  const keysEl = h("div", { class: "piano-keys", role: "group", "aria-label": t("piano.keysLabel"), "data-out": "keys" });
  const status = h("p", { class: "hint", "aria-live": "polite", "data-out": "status" });
  const btn = (action: string, label: string, onClick: () => void) => h("button", { type: "button", class: "btn ghost", "data-action": action, onClick }, label);
  const buttons = {
    record: btn("record", t("piano.record"), () => toggleRecord()),
    play: btn("play", t("piano.play"), () => togglePlay()),
    clear: btn("clear", t("piano.clear"), () => clearTake()),
  };
  const rangeEl = h("span", { class: "piano-range", "data-out": "range" });
  s = {
    ctx: null,
    master: null,
    sound: "piano",
    volume: 0.7,
    sustain: false,
    pedal: false,
    // The same keyboard everywhere (the prerendered page must match the mount): two octaves from C3, the Q key on
    // middle C. Keys never get narrower than a finger (CSS); a narrow screen scrolls to middle C instead.
    startOctave: 3,
    octaves: 2,
    // Spanish and Vietnamese schools name notes Do Re Mi; the others mostly read C D E on a keyboard.
    labels: locale() === "es" || locale() === "vi" ? "solfege" : "letters",
    voices: new Map(),
    holders: new Map(),
    pedalled: new Set(),
    keysEl,
    keyEls: new Map(),
    pointers: new Map(),
    recording: false,
    recStart: 0,
    take: [],
    playTimers: new Set(),
    playVoices: [],
    status,
    buttons,
    rangeEl,
  };
  const st = s;
  const select = <T extends string | number>(field: string, values: readonly T[], value: T, label: (v: T) => string, onChange: (v: string) => void) => {
    const el = h("select", { "data-field": field, onChange: () => onChange(el.value) }, ...values.map((v) => h("option", { value: String(v), selected: v === value }, label(v))));
    return el;
  };
  const soundSel = select("sound", SOUNDS, st.sound, (v) => t(`piano.sound_${v}`), (v) => { st.sound = v as Sound; });
  const labelSel = select("labels", LABELS, st.labels, (v) => t(`piano.label_${v}`), (v) => { st.labels = v as LabelMode; buildKeys(); });
  const octSel = select("octaves", OCTAVE_CHOICES, st.octaves as (typeof OCTAVE_CHOICES)[number], (v) => String(v), (v) => {
    st.octaves = Number(v);
    st.startOctave = Math.min(st.startOctave, MAX_START + 1 - st.octaves);
    buildKeys();
  });
  const volume = h("input", { type: "range", min: "0", max: "100", step: "1", value: String(st.volume * 100), "data-field": "volume", "aria-label": t("piano.volume"), onInput: () => {
    st.volume = Number(volume.value) / 100;
    if (st.master && st.ctx) st.master.gain.setTargetAtTime(st.volume, st.ctx.currentTime, 0.02);
  } });
  const sustain = h("input", { type: "checkbox", "data-field": "sustain", onChange: () => { st.sustain = sustain.checked; if (!st.sustain) liftPedal(); } });
  const shift = (d: number) => {
    // When the keyboard is wider than the screen (fingers need wide keys, and keys swallow swipes), ◀ ▶ first scroll
    // to the keys out of view, then move the octaves.
    const scroller = st.keysEl.parentElement;
    if (scroller && scroller.scrollWidth > scroller.clientWidth) {
      const max = scroller.scrollWidth - scroller.clientWidth;
      const room = d < 0 ? scroller.scrollLeft : max - scroller.scrollLeft;
      if (room > 1) {
        scroller.scrollLeft += d * Math.min(room, (scroller.scrollWidth / st.octaves));
        return;
      }
    }
    const next = Math.max(MIN_START, Math.min(MAX_START + 1 - st.octaves, st.startOctave + d));
    if (next === st.startOctave) return;
    releaseAll();
    st.startOctave = next;
    buildKeys();
  };
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("piano.back")),
      h("h1", null, t("piano.title")),
      h("p", { class: "lede" }, t("piano.privacyNote")),
    ),
    h("div", { class: "piano-bar" },
      h("button", { type: "button", class: "chip", "data-action": "octave-down", "aria-label": t("piano.octaveDown"), onClick: () => shift(-1) }, "◀"),
      rangeEl,
      h("button", { type: "button", class: "chip", "data-action": "octave-up", "aria-label": t("piano.octaveUp"), onClick: () => shift(1) }, "▶"),
    ),
    h("div", { class: "piano-scroll" }, keysEl),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("piano.options")),
          h("label", { class: "field" }, h("span", null, t("piano.sound")), soundSel),
          h("label", { class: "field" }, h("span", null, t("piano.labels")), labelSel),
          h("label", { class: "field" }, h("span", null, t("piano.octaves")), octSel),
          h("label", { class: "field" }, h("span", null, t("piano.volume")), volume),
          h("label", { class: "check" }, sustain, h("span", null, t("piano.sustain"))),
        ),
      ),
      h("div", { class: "rail" },
        h("h2", null, t("piano.takeTitle")),
        h("div", { class: "stage-actions" }, buttons.record, buttons.play, buttons.clear),
        status,
        h("p", { class: "hint" }, t("piano.keyboardHint")),
      ),
    ),
  );
  keysEl.addEventListener("pointerdown", onPointerDown);
  keysEl.addEventListener("pointermove", onPointerMove);
  keysEl.addEventListener("pointerup", onPointerUp);
  keysEl.addEventListener("pointercancel", onPointerUp);
  keysEl.addEventListener("lostpointercapture", onPointerUp);
  // A long press on a key should not open the text-selection or context menu on phones.
  keysEl.addEventListener("contextmenu", (e) => e.preventDefault());
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", releaseAll);
  document.addEventListener("visibilitychange", onHidden);
  buildKeys();
  syncTake();
  requestAnimationFrame(() => showMiddleC());
}

/** On a screen too narrow for the whole keyboard, scroll so the octave from middle C is in view. */
function showMiddleC(): void {
  const scroller = s?.keysEl.parentElement;
  const c4 = s?.keyEls.get(60);
  if (!scroller || !c4 || scroller.scrollWidth <= scroller.clientWidth) return;
  scroller.scrollLeft = c4.offsetLeft;
}

export function unmountPiano(): void {
  if (!s) return;
  stopPlayback();
  for (const v of s.voices.values()) v.kill();
  window.removeEventListener("keydown", onKeyDown);
  window.removeEventListener("keyup", onKeyUp);
  window.removeEventListener("blur", releaseAll);
  document.removeEventListener("visibilitychange", onHidden);
  void s.ctx?.close().catch(() => undefined);
  s = null;
}

function onHidden(): void {
  if (document.hidden) releaseAll();
}

function buildKeys(): void {
  if (!s) return;
  const st = s;
  const notes = keyRange(st.startOctave, st.octaves);
  const whites = notes.filter((m) => !isBlack(m));
  const caps = capsFor((st.startOctave + 1) * 12);
  st.keyEls.clear();
  const els: HTMLElement[] = [];
  let whiteIndex = 0;
  for (const midi of notes) {
    const black = isBlack(midi);
    const label = st.labels === "none" ? "" : st.labels === "keys" ? caps.get(midi) ?? "" : black ? "" : noteName(midi, st.labels);
    const el = h("div", {
      class: black ? "piano-key black" : "piano-key white",
      "data-midi": String(midi),
      role: "button",
      "aria-label": noteName(midi),
      style: black
        ? { left: `calc(${(whiteIndex / whites.length) * 100}% - var(--piano-black) / 2)` }
        : { left: `${(whiteIndex / whites.length) * 100}%`, width: `${100 / whites.length}%` },
    }, label ? h("span", { class: "piano-label" }, label) : null);
    if (!black) whiteIndex++;
    st.keyEls.set(midi, el);
    els.push(el);
    // Down only while something holds the key; a note the pedal keeps ringing is not pressed.
    if (st.holders.get(midi)?.size) el.classList.add("down");
  }
  st.keysEl.style.setProperty("--piano-whites", String(whites.length));
  st.keysEl.replaceChildren(...els);
  st.rangeEl.textContent = `${noteName(notes[0])} – ${noteName(notes[notes.length - 1])}`;
}

function ensureAudio(): AudioContext | null {
  if (!s) return null;
  const ctx = armAudio(s.ctx);
  if (!ctx) {
    s.status.textContent = t("piano.noAudio");
    return null;
  }
  if (!s.master || s.ctx !== ctx) {
    s.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.ratio.value = 4;
    const master = ctx.createGain();
    master.gain.value = s.volume;
    master.connect(comp).connect(ctx.destination);
    s.master = master;
  }
  return ctx;
}

/** One note of the chosen sound, starting at `at`, into `out`. */
function voice(ctx: AudioContext, out: AudioNode, sound: Sound, midi: number, at: number, velocity = 0.8): Voice {
  const f = noteFrequency(midi);
  const env = ctx.createGain();
  env.connect(out);
  const nodes: AudioScheduledSourceNode[] = [];
  const osc = (type: OscillatorType, freq: number, gain: number, decay: number | null, dest: AudioNode = env) => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(gain, at + 0.004);
    if (decay !== null) g.gain.setTargetAtTime(gain * 0.0001, at + 0.004, decay);
    o.connect(g).connect(dest);
    o.start(at);
    nodes.push(o);
    return o;
  };
  // Higher notes ring for less time, as on a real piano.
  const ring = Math.max(0.6, 4.5 * 2 ** (-(midi - 48) / 24));
  let releaseTime = 0.25;
  env.gain.value = velocity;
  switch (sound) {
    case "piano": {
      // Partials with slight stretch (inharmonicity), the upper ones dying faster; a lowpass softens the attack.
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(Math.min(16000, f * 9), at);
      lp.frequency.setTargetAtTime(Math.min(8000, f * 3), at + 0.01, ring / 4);
      lp.connect(env);
      const partials = [1, 0.55, 0.3, 0.18, 0.1, 0.06];
      partials.forEach((amp, i) => {
        const k = i + 1;
        if (f * k > 18000) return;
        osc(i === 0 ? "triangle" : "sine", f * k * (1 + 0.0004 * k * k), amp * 0.35, ring / (1 + i * 0.8), lp);
      });
      break;
    }
    case "epiano": {
      // Two-operator FM: a sine modulating a sine at the same pitch, the brightness fading like a tine.
      const carrier = ctx.createOscillator();
      carrier.frequency.value = f;
      const mod = ctx.createOscillator();
      mod.frequency.value = f;
      const index = ctx.createGain();
      index.gain.setValueAtTime(f * 1.8, at);
      index.gain.setTargetAtTime(f * 0.15, at, 0.25);
      mod.connect(index).connect(carrier.frequency);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(0.4, at + 0.003);
      g.gain.setTargetAtTime(0.0001, at + 0.003, ring * 0.7);
      carrier.connect(g).connect(env);
      carrier.start(at);
      mod.start(at);
      nodes.push(carrier, mod);
      break;
    }
    case "organ":
      // Drawbars 8′ 4′ 2⅔′ 2′: steady sines that hold as long as the key.
      for (const [k, amp] of [[1, 0.3], [2, 0.2], [3, 0.12], [4, 0.1]] as const) if (f * k < 18000) osc("sine", f * k, amp, null);
      releaseTime = 0.06;
      break;
    case "synth": {
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.Q.value = 4;
      lp.frequency.setValueAtTime(Math.min(12000, f * 12), at);
      lp.frequency.setTargetAtTime(Math.min(6000, f * 3), at + 0.01, 0.3);
      lp.connect(env);
      osc("sawtooth", f, 0.18, null, lp);
      osc("sawtooth", f * 1.006, 0.12, null, lp);
      releaseTime = 0.18;
      break;
    }
  }
  let done = false;
  const stopAll = (when: number) => {
    for (const n of nodes) {
      try {
        n.stop(when);
      } catch {
        /* already stopped */
      }
    }
  };
  // Free the nodes once the sound has died away even if the key is held.
  const decays = sound === "piano" || sound === "epiano";
  if (decays) stopAll(at + ring * 6);
  const v: Voice = {
    endsAt: decays ? at + ring * 6 : Infinity,
    release(when: number) {
      if (done) return;
      done = true;
      const from = Math.max(when, ctx.currentTime);
      env.gain.cancelScheduledValues(from);
      env.gain.setValueAtTime(env.gain.value, from);
      env.gain.setTargetAtTime(0, from, releaseTime / 4);
      stopAll(from + releaseTime * 2);
      v.endsAt = Math.min(v.endsAt, from + releaseTime * 2);
    },
    cut() {
      done = true;
      const now = ctx.currentTime;
      env.gain.cancelScheduledValues(0);
      env.gain.setValueAtTime(env.gain.value, now);
      env.gain.linearRampToValueAtTime(0, now + 0.03);
      stopAll(now + 0.05);
      v.endsAt = Math.min(v.endsAt, now + 0.05);
    },
    kill() {
      done = true;
      stopAll(ctx.currentTime);
      v.endsAt = ctx.currentTime;
      env.disconnect();
    },
  };
  return v;
}

function press(midi: number, source: string): void {
  if (!s) return;
  const ctx = ensureAudio();
  if (!ctx || !s.master) return;
  let holders = s.holders.get(midi);
  if (!holders) s.holders.set(midi, (holders = new Set()));
  const fresh = holders.size === 0;
  holders.add(source);
  if (!fresh) return;
  // Striking a note again restarts it, as a hammer does, even if the pedal still holds the last one.
  const ringing = s.voices.get(midi);
  if (ringing && s.recording) addEvent(midi, false);
  ringing?.release(ctx.currentTime);
  s.pedalled.delete(midi);
  s.voices.set(midi, voice(ctx, s.master, s.sound, midi, ctx.currentTime));
  s.keyEls.get(midi)?.classList.add("down");
  if (s.recording) addEvent(midi, true);
}

function release(midi: number, source: string): void {
  if (!s) return;
  const holders = s.holders.get(midi);
  if (!holders?.delete(source) || holders.size > 0) return;
  s.keyEls.get(midi)?.classList.remove("down");
  // A take records when a note stops sounding, so notes the pedal holds play back held too.
  if (s.sustain || s.pedal) {
    s.pedalled.add(midi);
    return;
  }
  stopVoice(midi);
}

function stopVoice(midi: number): void {
  if (!s?.ctx) return;
  const v = s.voices.get(midi);
  if (!v) return;
  if (s.recording) addEvent(midi, false);
  v.release(s.ctx.currentTime);
  s.voices.delete(midi);
}

function liftPedal(): void {
  if (!s || s.sustain || s.pedal) return;
  for (const midi of s.pedalled) if (!s.holders.get(midi)?.size) stopVoice(midi);
  s.pedalled.clear();
}

function releaseAll(): void {
  if (!s) return;
  for (const [midi, holders] of s.holders) for (const src of [...holders]) release(midi, src);
  s.pointers.clear();
  s.pedal = false;
  liftPedal();
}

function midiAt(x: number, y: number): number | null {
  const el = document.elementFromPoint?.(x, y)?.closest<HTMLElement>(".piano-key");
  return el && s?.keysEl.contains(el) ? Number(el.dataset.midi) : null;
}

function onPointerDown(e: PointerEvent): void {
  if (!s || (e.pointerType === "mouse" && e.button !== 0)) return;
  const key = (e.target as HTMLElement).closest<HTMLElement>(".piano-key");
  if (!key) return;
  e.preventDefault();
  // preventDefault keeps focus where it was: leave a menu, or its letters would pick options instead of notes.
  (document.activeElement as HTMLElement | null)?.blur?.();
  // Capture so the release arrives even off the keys; moves are hit-tested by position, so a slide still glides.
  try {
    s.keysEl.setPointerCapture(e.pointerId);
  } catch {
    /* not capturable */
  }
  const midi = Number(key.dataset.midi);
  s.pointers.set(e.pointerId, midi);
  press(midi, `p${e.pointerId}`);
}

function onPointerMove(e: PointerEvent): void {
  if (!s) return;
  const current = s.pointers.get(e.pointerId);
  if (current === undefined) return;
  const midi = midiAt(e.clientX, e.clientY);
  if (midi === null || midi === current) return;
  release(current, `p${e.pointerId}`);
  s.pointers.set(e.pointerId, midi);
  press(midi, `p${e.pointerId}`);
}

function onPointerUp(e: PointerEvent): void {
  if (!s) return;
  // A touch pointerdown does not count as a user gesture for audio; its pointerup does, so wake the context here too.
  if (s.ctx) resumeIfPaused(s.ctx);
  const midi = s.pointers.get(e.pointerId);
  if (midi === undefined) return;
  s.pointers.delete(e.pointerId);
  release(midi, `p${e.pointerId}`);
}

function typing(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement | null;
  return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) && !(el instanceof HTMLInputElement && (el.type === "range" || el.type === "checkbox"));
}

function onControl(e: KeyboardEvent): boolean {
  return !!(e.target as HTMLElement | null)?.closest?.("button, input, select, textarea, a, [contenteditable]");
}

function onKeyDown(e: KeyboardEvent): void {
  if (!s || e.ctrlKey || e.metaKey || e.altKey || typing(e)) return;
  if (e.code === "Space") {
    // A focused button, checkbox or link keeps Space for itself (keyboard users press them with it).
    if (onControl(e)) return;
    // Space is the sustain pedal while held (and must not scroll the page or press a focused button).
    e.preventDefault();
    s.pedal = true;
    return;
  }
  const offset = KEY_MAP[e.code];
  if (offset === undefined) return;
  e.preventDefault();
  if (e.repeat) return;
  // The two rows reach past a one-octave screen: those notes still play, they just have no key on show.
  const midi = (s.startOctave + 1) * 12 + offset;
  if (midi < LOWEST || midi > HIGHEST) return;
  press(midi, `k${e.code}`);
}

function onKeyUp(e: KeyboardEvent): void {
  if (!s) return;
  if (e.code === "Space") {
    // The pedal always lifts, even if focus moved to a button while Space was held.
    s.pedal = false;
    liftPedal();
    return;
  }
  // Release whatever this key started, even if the octave moved while it was down.
  for (const [midi, holders] of s.holders) if (holders.has(`k${e.code}`)) release(midi, `k${e.code}`);
}

function addEvent(midi: number, on: boolean): void {
  if (!s) return;
  if (s.take.length >= MAX_TAKE) {
    toggleRecord();
    return;
  }
  s.take.push({ t: performance.now() / 1000 - s.recStart, midi, on });
}

function toggleRecord(): void {
  if (!s) return;
  if (s.recording) {
    s.recording = false;
    s.take = closeTake(s.take, performance.now() / 1000 - s.recStart);
  } else {
    stopPlayback();
    s.take = [];
    s.recording = true;
    s.recStart = performance.now() / 1000;
    // Notes already down when recording starts are in the take from its first moment.
    // So do notes the pedal or Sustain keeps ringing: the take starts with what is heard.
    for (const midi of s.voices.keys()) s.take.push({ t: 0, midi, on: true });
  }
  syncTake();
}

/** How far ahead playback puts notes on the audio clock, and how often it tops up. */
const PLAY_AHEAD = 1.5;
const PLAY_TICK_MS = 250;

function togglePlay(): void {
  if (!s) return;
  if (s.playTimers.size) {
    stopPlayback();
    syncTake();
    return;
  }
  if (s.recording) toggleRecord();
  const ctx = ensureAudio();
  if (!ctx || !s.master || !s.take.length) return;
  const st = s;
  const start = ctx.currentTime + 0.1;
  const take = [...st.take];
  const open = new Map<number, Voice>();
  let next = 0;
  // A look-ahead scheduler: only the next PLAY_AHEAD seconds of notes exist as audio nodes, so a long take does not
  // build thousands of voices at once. Notes go on the audio clock; timers only light the keys.
  const tick = () => {
    if (!s || s !== st || !st.master) return;
    const horizon = ctx.currentTime + PLAY_AHEAD;
    while (next < take.length && start + take[next].t < horizon) {
      const e = take[next++];
      const at = start + e.t;
      open.get(e.midi)?.release(at);
      if (e.on) {
        const v = voice(ctx, st.master, st.sound, e.midi, at);
        open.set(e.midi, v);
        st.playVoices.push(v);
      } else open.delete(e.midi);
      const id = window.setTimeout(() => {
        st.playTimers.delete(id);
        st.keyEls.get(e.midi)?.classList.toggle("playing", e.on);
      }, Math.max(0, (at - ctx.currentTime) * 1000));
      st.playTimers.add(id);
    }
    // Voices that have finished are dropped from the list Stop has to cut; held ones stay however many came after.
    st.playVoices = st.playVoices.filter((v) => v.endsAt > ctx.currentTime);
    if (next >= take.length) {
      clearInterval(timer);
      st.playTimers.delete(timer);
      st.playTimers.add(window.setTimeout(() => { stopPlayback(true); syncTake(); }, Math.max(0, (start + take[take.length - 1].t - ctx.currentTime + 0.5) * 1000)));
    }
  };
  const timer = window.setInterval(tick, PLAY_TICK_MS);
  // Kept with the timeouts: clearTimeout and clearInterval share one id space.
  st.playTimers.add(timer);
  tick();
  syncTake();
}

function stopPlayback(finished = false): void {
  if (!s) return;
  for (const id of s.playTimers) {
    clearTimeout(id);
    clearInterval(id);
  }
  s.playTimers.clear();
  // Cut notes already scheduled ahead, even those whose release time is set.
  if (!finished) for (const v of s.playVoices) v.cut();
  s.playVoices = [];
  for (const el of s.keyEls.values()) el.classList.remove("playing");
}

function clearTake(): void {
  if (!s) return;
  stopPlayback();
  s.recording = false;
  s.take = [];
  syncTake();
}

function syncTake(): void {
  if (!s) return;
  const playing = s.playTimers.size > 0;
  const notes = s.take.filter((e) => e.on).length;
  s.buttons.record.textContent = s.recording ? t("piano.stopRecording") : t("piano.record");
  s.buttons.record.classList.toggle("on", s.recording);
  s.buttons.play.textContent = playing ? t("piano.stop") : t("piano.play");
  s.buttons.play.disabled = !notes && !playing;
  s.buttons.clear.disabled = !s.take.length && !s.recording;
  s.status.textContent = s.recording
    ? t("piano.recording")
    : notes
      ? t("piano.takeReady", { n: notes, seconds: new Intl.NumberFormat(locale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(s.take[s.take.length - 1].t) })
      : t("piano.noTake");
}
