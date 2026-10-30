import { armAudio } from "../audio";
import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { BEATS, MAX_BPM, MIN_BPM, TAP_RESET_MS, clampBpm, clickInterval, tapBpm, tempoName } from "../../shared/metronome";

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD = 0.12;
// Hidden tabs run timers about once a second, so queue further ahead there.
const SCHEDULE_AHEAD_HIDDEN = 1.5;

let bpmEl: HTMLInputElement | null = null;
let sliderEl: HTMLInputElement | null = null;
let beatsEl: HTMLSelectElement | null = null;
let subEl: HTMLSelectElement | null = null;
let accentEl: HTMLInputElement | null = null;
let volumeEl: HTMLInputElement | null = null;
let tempoEl: HTMLElement | null = null;
let bpmOutEl: HTMLElement | null = null;
let dotsEl: HTMLElement | null = null;
let startBtn: HTMLButtonElement | null = null;
let audio: AudioContext | null = null;
let timer = 0;
let nextTime = 0;
let tick = 0;
let tickSub = 1;
let restart = false;
let voices: OscillatorNode[] = [];
let running = false;
let taps: number[] = [];
let visualTimers: number[] = [];
let typeTimer = 0;

export function mountMetronome(host: HTMLElement): void {
  bpmEl = h("input", { type: "number", min: String(MIN_BPM), max: String(MAX_BPM), step: "1", inputmode: "numeric", value: "120", "data-field": "bpm", "aria-label": t("metronome.bpm"), onInput: () => typedBpm(), onChange: () => setBpm(bpmEl?.value.trim() ? Number(bpmEl.value) : bpm()) });
  sliderEl = h("input", { type: "range", min: String(MIN_BPM), max: String(MAX_BPM), step: "1", value: "120", "data-field": "slider", "aria-label": t("metronome.bpm"), onInput: () => setBpm(Number(sliderEl?.value)) });
  beatsEl = h("select", { "data-field": "beats", onChange: () => { drawDots(); restartBar(); } },
    ...BEATS.map((n) => h("option", { value: String(n), selected: n === 4 }, String(n))),
  );
  subEl = h("select", { "data-field": "subdivision" },
    h("option", { value: "1", selected: true }, t("metronome.sub1")),
    h("option", { value: "2" }, t("metronome.sub2")),
    h("option", { value: "3" }, t("metronome.sub3")),
    h("option", { value: "4" }, t("metronome.sub4")),
  );
  accentEl = h("input", { type: "checkbox", checked: true, "data-field": "accent" });
  volumeEl = h("input", { type: "range", min: "0", max: "100", step: "1", value: "70", "data-field": "volume", "aria-label": t("metronome.volume") });
  tempoEl = h("p", { class: "metronome-tempo" });
  dotsEl = h("div", { class: "metronome-dots", "aria-hidden": "true" });
  const nudge = (d: number) => h("button", { type: "button", class: "chip", "data-action": d > 0 ? "faster" : "slower", "aria-label": `${d > 0 ? "+" : "−"}${Math.abs(d)} BPM`, onClick: () => setBpm(bpm() + d) }, d > 0 ? `+${d}` : `−${-d}`);
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("metronome.back")),
      h("h1", null, t("metronome.title")),
      h("p", { class: "lede" }, t("metronome.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("metronome.options")),
          h("label", { class: "field" }, h("span", null, t("metronome.bpm")), bpmEl),
          sliderEl,
          h("div", { class: "chip-row" }, nudge(-5), nudge(-1), nudge(1), nudge(5)),
          h("label", { class: "field" }, h("span", null, t("metronome.beats")), beatsEl),
          h("label", { class: "field" }, h("span", null, t("metronome.subdivision")), subEl),
          h("label", { class: "check" }, accentEl, h("span", null, t("metronome.accent"))),
          h("label", { class: "field" }, h("span", null, t("metronome.volume")), volumeEl),
        ),
      ),
      h("div", { class: "rail metronome-stage" },
        bpmOutEl = h("p", { class: "pomodoro-clock", "data-out": "bpm" }),
        tempoEl,
        dotsEl,
        h("div", { class: "stage-actions" },
          startBtn = h("button", { type: "button", class: "btn", "data-action": "start", onClick: () => toggle() }, t("metronome.start")),
          h("button", { type: "button", class: "btn ghost", "data-action": "tap", onClick: () => tap() }, t("metronome.tap")),
        ),
        h("p", { class: "hint" }, t("metronome.hint")),
      ),
    ),
  );
  drawDots();
  paintBpm();
}

export function unmountMetronome(): void {
  stop();
  window.clearTimeout(typeTimer);
  if (audio) void audio.close().catch(() => undefined);
  audio = null;
  bpmEl = sliderEl = accentEl = volumeEl = null;
  beatsEl = subEl = null;
  tempoEl = dotsEl = bpmOutEl = null;
  startBtn = null;
  taps = [];
}

/** The slider always holds a valid tempo; the number field may be mid-edit. */
function bpm(): number {
  return clampBpm(Number(sliderEl?.value));
}

function setBpm(value: number): void {
  const b = clampBpm(value);
  if (bpmEl) bpmEl.value = String(b);
  if (sliderEl) sliderEl.value = String(b);
  paintBpm();
}

/**
 * A typed tempo applies after a short pause, so "25" on the way to "250" never takes effect (and never schedules a
 * long gap); the field is not rewritten while typing.
 */
function typedBpm(): void {
  window.clearTimeout(typeTimer);
  typeTimer = window.setTimeout(() => {
    const v = Number(bpmEl?.value);
    if (!Number.isInteger(v) || v < MIN_BPM || v > MAX_BPM) return;
    if (sliderEl) sliderEl.value = String(v);
    paintBpm();
  }, 500);
}

function paintBpm(): void {
  const b = bpm();
  if (bpmOutEl) bpmOutEl.textContent = `${b} BPM`;
  if (tempoEl) tempoEl.textContent = tempoName(b);
}

function beats(): number {
  return Number(beatsEl?.value) || 4;
}

function drawDots(): void {
  if (!dotsEl) return;
  dotsEl.replaceChildren(...Array.from({ length: beats() }, (_, i) => h("span", { class: i === 0 ? "dot first" : "dot" })));
}

/** A new bar length starts a fresh bar on the next beat (not on an off-beat click). */
function restartBar(): void {
  restart = true;
}

function toggle(): void {
  if (running) stop();
  else start();
}

function start(): void {
  // Start is a user gesture: create or resume the AudioContext here, as iOS requires.
  audio = armAudio(audio);
  if (!audio) return;
  running = true;
  tick = 0;
  tickSub = Number(subEl?.value) || 1;
  restart = false;
  nextTime = audio.currentTime + 0.06;
  timer = window.setInterval(schedule, LOOKAHEAD_MS);
  schedule();
  if (startBtn) startBtn.textContent = t("metronome.stop");
}

function stop(): void {
  running = false;
  window.clearInterval(timer);
  // Silence clicks already queued on the audio clock.
  for (const osc of voices) {
    try { osc.stop(); } catch { /* already stopped */ }
  }
  voices = [];
  for (const id of visualTimers) window.clearTimeout(id);
  visualTimers = [];
  dotsEl?.querySelectorAll(".dot.on").forEach((d) => d.classList.remove("on"));
  if (startBtn) startBtn.textContent = t("metronome.start");
}

function schedule(): void {
  if (!audio || !running) return;
  const sub = Number(subEl?.value) || 1;
  // A new subdivision continues from the next beat, so the accent stays on the downbeat.
  if (sub !== tickSub || restart) {
    // Skip the rest of the current beat's clicks so the new grid starts exactly on the next beat.
    const left = (tickSub - (tick % tickSub)) % tickSub;
    nextTime += left * clickInterval(bpm(), tickSub);
    const beat = restart ? 0 : Math.ceil(tick / tickSub) % beats();
    tick = beat * sub;
    tickSub = sub;
    restart = false;
  }
  // After a long timer stall, skip missed clicks instead of playing them all at once.
  if (nextTime < audio.currentTime) nextTime = audio.currentTime + 0.05;
  // Settings are read every click, so changes take effect on the next one.
  const ahead = document.hidden ? SCHEDULE_AHEAD_HIDDEN : SCHEDULE_AHEAD;
  while (nextTime < audio.currentTime + ahead) {
    const perBar = beats() * sub;
    const pos = tick % perBar;
    const onBeat = pos % sub === 0;
    const kind = pos === 0 && accentEl?.checked && beats() > 1 ? "accent" : onBeat ? "beat" : "sub";
    click(nextTime, kind);
    if (onBeat) flash(nextTime, pos / sub);
    nextTime += clickInterval(bpm(), sub);
    tick = (tick + 1) % perBar;
  }
}

function click(at: number, kind: "accent" | "beat" | "sub"): void {
  const ctx = audio;
  if (!ctx) return;
  const volume = (Number(volumeEl?.value) || 0) / 100;
  if (volume <= 0) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "square";
  osc.frequency.value = kind === "accent" ? 1760 : kind === "beat" ? 1175 : 880;
  const peak = volume * (kind === "sub" ? 0.12 : 0.3);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);
  osc.connect(gain).connect(ctx.destination);
  osc.start(at);
  osc.stop(at + 0.06);
  voices.push(osc);
  osc.onended = () => { voices = voices.filter((v) => v !== osc); };
}

function flash(at: number, beat: number): void {
  if (!audio) return;
  const delay = Math.max(0, (at - audio.currentTime) * 1000);
  const id = window.setTimeout(() => {
    visualTimers = visualTimers.filter((x) => x !== id);
    const dots = dotsEl?.children;
    if (!dots) return;
    for (let i = 0; i < dots.length; i++) dots[i].classList.toggle("on", i === beat);
  }, delay);
  visualTimers.push(id);
}

function tap(): void {
  const now = performance.now();
  if (taps.length && now - taps[taps.length - 1] > TAP_RESET_MS) taps = [];
  taps.push(now);
  taps = taps.slice(-5);
  const b = tapBpm(taps);
  if (b != null) setBpm(b);
}
