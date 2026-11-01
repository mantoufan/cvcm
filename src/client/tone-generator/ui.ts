import { armAudio } from "../audio";
import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { DEFAULT_FREQ, MAX_FREQ, MIN_FREQ, SLIDER_STEPS, TONE_PRESETS, WAVEFORMS, clampFreq, freqToSlider, nearestNote, sliderToFreq, wavelength, type Waveform } from "../../shared/tone";

/** Smoothing time for frequency, volume and pan changes, so they do not click. */
const GLIDE = 0.015;

let freqEl: HTMLInputElement | null = null;
let sliderEl: HTMLInputElement | null = null;
let waveEl: HTMLSelectElement | null = null;
let volumeEl: HTMLInputElement | null = null;
let channelEl: HTMLSelectElement | null = null;
let readoutEl: HTMLElement | null = null;
let noteEl: HTMLElement | null = null;
let playBtn: HTMLButtonElement | null = null;
let audio: AudioContext | null = null;
let osc: OscillatorNode | null = null;
let gain: GainNode | null = null;
let pan: StereoPannerNode | null = null;
let freq = DEFAULT_FREQ;
let typeTimer = 0;

export function mountToneGenerator(host: HTMLElement): void {
  freqEl = h("input", { type: "number", min: String(MIN_FREQ), max: String(MAX_FREQ), step: "0.01", inputmode: "decimal", value: String(DEFAULT_FREQ), "data-field": "frequency", onInput: () => typedFreq(), onChange: () => setFreq(freqEl?.value.trim() ? Number(freqEl.value) : freq) });
  sliderEl = h("input", { type: "range", min: "0", max: String(SLIDER_STEPS), step: "1", value: String(freqToSlider(DEFAULT_FREQ)), "data-field": "slider", "aria-label": t("toneGenerator.frequency"), onInput: () => setFreq(sliderToFreq(Number(sliderEl?.value)), false) });
  waveEl = h("select", { "data-field": "waveform", onChange: () => { if (osc) osc.type = waveform(); } },
    ...WAVEFORMS.map((w) => h("option", { value: w, selected: w === "sine" }, t(`toneGenerator.wave_${w}`))),
  );
  volumeEl = h("input", { type: "range", min: "0", max: "100", step: "1", value: "20", "data-field": "volume", "aria-label": t("toneGenerator.volume"), onInput: () => applyVolume() });
  channelEl = h("select", { "data-field": "channel", onChange: () => applyPan() },
    h("option", { value: "-1" }, t("toneGenerator.left")),
    h("option", { value: "0", selected: true }, t("toneGenerator.both")),
    h("option", { value: "1" }, t("toneGenerator.right")),
  );
  readoutEl = h("p", { class: "pomodoro-clock", "data-out": "frequency" });
  noteEl = h("p", { class: "metronome-tempo", "data-out": "note" });
  const nudge = (label: string, action: string, fn: () => number) => h("button", { type: "button", class: "chip", "data-action": action, onClick: () => setFreq(fn()) }, label);
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("toneGenerator.back")),
      h("h1", null, t("toneGenerator.title")),
      h("p", { class: "lede" }, t("toneGenerator.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("toneGenerator.options")),
          h("label", { class: "field" }, h("span", null, t("toneGenerator.frequency")), freqEl),
          sliderEl,
          h("div", { class: "chip-row" },
            nudge("÷2", "octave-down", () => freq / 2),
            nudge("−1", "minus", () => freq - 1),
            nudge("+1", "plus", () => freq + 1),
            nudge("×2", "octave-up", () => freq * 2),
          ),
          h("label", { class: "field" }, h("span", null, t("toneGenerator.waveform")), waveEl),
          h("label", { class: "field" }, h("span", null, t("toneGenerator.channel")), channelEl),
          h("label", { class: "field" }, h("span", null, t("toneGenerator.volume")), volumeEl),
        ),
        h("fieldset", null,
          h("legend", null, t("toneGenerator.presets")),
          h("div", { class: "chip-row" }, ...TONE_PRESETS.map((f) => h("button", { type: "button", class: "chip", "data-preset": String(f), onClick: () => setFreq(f) }, `${f} Hz`))),
        ),
      ),
      h("div", { class: "rail metronome-stage" },
        readoutEl,
        noteEl,
        h("div", { class: "stage-actions" },
          playBtn = h("button", { type: "button", class: "btn", "data-action": "play", onClick: () => toggle() }, t("toneGenerator.play")),
        ),
        h("p", { class: "hint" }, t("toneGenerator.hint")),
      ),
    ),
  );
  paint();
}

export function unmountToneGenerator(): void {
  stop();
  window.clearTimeout(typeTimer);
  if (audio) void audio.close().catch(() => undefined);
  audio = null;
  freqEl = sliderEl = volumeEl = null;
  waveEl = channelEl = null;
  readoutEl = noteEl = null;
  playBtn = null;
  freq = DEFAULT_FREQ;
}

function waveform(): Waveform {
  const v = waveEl?.value as Waveform | undefined;
  return v && (WAVEFORMS as readonly string[]).includes(v) ? v : "sine";
}

/** Volume on a squared curve (finer control at the quiet end), at most 0.5 of full scale. */
function level(): number {
  const v = (Number(volumeEl?.value) || 0) / 100;
  return v * v * 0.5;
}

function setFreq(value: number, syncSlider = true): void {
  freq = clampFreq(value);
  if (freqEl) freqEl.value = String(freq);
  if (syncSlider && sliderEl) sliderEl.value = String(freqToSlider(freq));
  if (osc && audio) osc.frequency.setTargetAtTime(freq, audio.currentTime, GLIDE);
  paint();
}

/** A typed frequency applies after a short pause, so "4" on the way to "440" never plays. */
function typedFreq(): void {
  window.clearTimeout(typeTimer);
  typeTimer = window.setTimeout(() => {
    const v = Number(freqEl?.value);
    if (!freqEl?.value.trim() || !Number.isFinite(v) || v < MIN_FREQ || v > MAX_FREQ) return;
    freq = clampFreq(v);
    if (sliderEl) sliderEl.value = String(freqToSlider(freq));
    if (osc && audio) osc.frequency.setTargetAtTime(freq, audio.currentTime, GLIDE);
    paint();
  }, 400);
}

function paint(): void {
  if (readoutEl) readoutEl.textContent = `${freq} Hz`;
  const note = nearestNote(freq);
  const cents = note.cents === 0 ? "" : ` ${note.cents > 0 ? "+" : "−"}${Math.abs(note.cents)}¢`;
  const wave = wavelength(freq);
  const len = wave >= 1 ? `${wave.toFixed(2)} m` : `${(wave * 100).toFixed(1)} cm`;
  if (noteEl) noteEl.textContent = t("toneGenerator.note", { note: `${note.name}${cents}`, wavelength: len });
}

function applyVolume(): void {
  if (gain && audio) gain.gain.setTargetAtTime(level(), audio.currentTime, GLIDE);
}

function applyPan(): void {
  if (pan && audio) pan.pan.setTargetAtTime(Number(channelEl?.value) || 0, audio.currentTime, GLIDE);
}

function toggle(): void {
  if (osc) stop();
  else start();
}

function start(): void {
  audio = armAudio(audio);
  if (!audio) return;
  osc = audio.createOscillator();
  osc.type = waveform();
  osc.frequency.value = freq;
  gain = audio.createGain();
  // Fade in so the tone does not start with a click.
  gain.gain.setValueAtTime(0, audio.currentTime);
  gain.gain.setTargetAtTime(level(), audio.currentTime, GLIDE);
  let out: AudioNode = gain;
  // Old Safari has no StereoPannerNode; it then plays on both sides.
  if (typeof audio.createStereoPanner === "function") {
    pan = audio.createStereoPanner();
    pan.pan.value = Number(channelEl?.value) || 0;
    gain.connect(pan);
    out = pan;
  }
  out.connect(audio.destination);
  osc.connect(gain);
  osc.start();
  if (playBtn) playBtn.textContent = t("toneGenerator.stop");
}

function stop(): void {
  if (osc && gain && audio) {
    const o = osc;
    const g = gain;
    const p = pan;
    g.gain.setTargetAtTime(0, audio.currentTime, GLIDE);
    o.stop(audio.currentTime + GLIDE * 6);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
      p?.disconnect();
    };
  }
  osc = null;
  gain = null;
  pan = null;
  if (playBtn) playBtn.textContent = t("toneGenerator.play");
}
