import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import {
  DEFAULT_POMODORO, MAX_MINUTES, MAX_ROUNDS, mmss, nextPhase, normalizeSettings, phaseSeconds,
  type Phase, type PomodoroSettings,
} from "../../shared/pomodoro";

let focusEl: HTMLInputElement | null = null;
let shortEl: HTMLInputElement | null = null;
let longEl: HTMLInputElement | null = null;
let roundsEl: HTMLInputElement | null = null;
let phaseEl: HTMLElement | null = null;
let displayEl: HTMLElement | null = null;
let roundEl: HTMLElement | null = null;
let noteEl: HTMLElement | null = null;
let startBtn: HTMLButtonElement | null = null;
let settings: PomodoroSettings = DEFAULT_POMODORO;
let phase: Phase = "focus";
/** Milliseconds left in the current phase while paused; while running the deadline is `endsAt`. */
let remainingMs = 0;
let endsAt = 0;
let completed = 0;
let running = false;
let timer = 0;
let deadline = 0;
let audio: AudioContext | null = null;
let pageTitle = "";
const resync = (): void => { if (running) tick(); };

export function mountPomodoro(host: HTMLElement): void {
  focusEl = numberInput("focus", DEFAULT_POMODORO.focus, MAX_MINUTES);
  shortEl = numberInput("short", DEFAULT_POMODORO.short, MAX_MINUTES);
  longEl = numberInput("long", DEFAULT_POMODORO.long, MAX_MINUTES);
  roundsEl = numberInput("rounds", DEFAULT_POMODORO.rounds, MAX_ROUNDS);
  phaseEl = h("p", { class: "muted", "data-field": "phase" });
  displayEl = h("p", { class: "timestamp-out pomodoro-clock", "aria-live": "polite" });
  roundEl = h("p", { class: "muted" });
  noteEl = h("p", { class: "muted", "data-field": "note" });
  startBtn = h("button", { type: "button", class: "btn", "data-action": "start", onClick: () => toggle() }, t("pomodoro.start"));
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("pomodoro.back")),
      h("h1", null, t("pomodoro.title")),
      h("p", { class: "lede" }, t("pomodoro.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("pomodoro.options")),
          labeled(t("pomodoro.focus"), focusEl),
          labeled(t("pomodoro.short"), shortEl),
          labeled(t("pomodoro.long"), longEl),
          labeled(t("pomodoro.rounds"), roundsEl),
        ),
        h("div", { class: "stage-actions" },
          startBtn,
          h("button", { type: "button", class: "btn ghost", "data-action": "skip", onClick: () => skip() }, t("pomodoro.skip")),
          h("button", { type: "button", class: "btn ghost", "data-action": "reset", onClick: () => reset() }, t("pomodoro.reset")),
        ),
      ),
      h("div", { class: "rail" }, h("h2", null, t("pomodoro.result")), phaseEl, displayEl, roundEl, noteEl),
    ),
  );
  pageTitle = document.title;
  document.addEventListener("visibilitychange", resync);
  window.addEventListener("focus", resync);
  reset();
}

export function unmountPomodoro(): void {
  pause();
  document.removeEventListener("visibilitychange", resync);
  window.removeEventListener("focus", resync);
  if (pageTitle) document.title = pageTitle;
  pageTitle = "";
  if (audio) void audio.close().catch(() => undefined);
  audio = null;
  focusEl = shortEl = longEl = roundsEl = null;
  phaseEl = displayEl = roundEl = noteEl = null;
  startBtn = null;
  settings = DEFAULT_POMODORO;
  phase = "focus";
  remainingMs = 0;
  completed = 0;
}

function numberInput(field: string, value: number, max: number): HTMLInputElement {
  return h("input", { type: "number", min: "1", max: String(max), step: "1", value: String(value), "data-field": field, onInput: () => onSettingsInput() });
}

function labeled(label: string, control: HTMLElement): HTMLElement {
  return h("label", { class: "field" }, h("span", null, label), control);
}

function readSettings(): PomodoroSettings | null {
  return normalizeSettings({
    focus: Number(focusEl?.value),
    short: Number(shortEl?.value),
    long: Number(longEl?.value),
    rounds: Number(roundsEl?.value),
  });
}

/** While the clock is not running, an edited length replaces the current phase; a running phase keeps its deadline. */
function onSettingsInput(): void {
  const next = readSettings();
  if (noteEl) noteEl.textContent = next ? "" : t("pomodoro.invalid");
  if (!next) return;
  settings = next;
  if (!running) remainingMs = phaseSeconds(settings, phase) * 1000;
  paint();
}

function toggle(): void {
  if (running) {
    pause();
    paint();
    return;
  }
  // Start is a user gesture: create (or resume) the AudioContext here so the chime can play later on iOS.
  armAudio();
  run();
}

function run(): void {
  if (remainingMs <= 0) remainingMs = phaseSeconds(settings, phase) * 1000;
  running = true;
  endsAt = Date.now() + remainingMs;
  if (startBtn) startBtn.textContent = t("pomodoro.pause");
  // The interval repaints the clock; the timeout lands on the deadline even when a hidden tab throttles intervals.
  timer = window.setInterval(tick, 250);
  deadline = window.setTimeout(tick, remainingMs + 20);
  paint();
}

function tick(): void {
  if (!running) return;
  remainingMs = Math.max(0, endsAt - Date.now());
  if (remainingMs > 0) {
    paint();
    return;
  }
  pause();
  chime();
  advance(true);
  run();
}

function pause(): void {
  if (running) remainingMs = Math.max(0, endsAt - Date.now());
  running = false;
  if (timer) window.clearInterval(timer);
  timer = 0;
  if (deadline) window.clearTimeout(deadline);
  deadline = 0;
  if (startBtn) startBtn.textContent = t("pomodoro.start");
}

/** Moves to the next phase. Only a focus session that ran to the end counts toward the long break. */
function advance(finished: boolean): void {
  if (phase === "focus" && finished) completed += 1;
  phase = nextPhase(phase, completed, settings.rounds);
  remainingMs = phaseSeconds(settings, phase) * 1000;
}

function skip(): void {
  pause();
  advance(false);
  paint();
}

function reset(): void {
  pause();
  const next = readSettings();
  if (noteEl) noteEl.textContent = next ? "" : t("pomodoro.invalid");
  if (next) settings = next;
  phase = "focus";
  completed = 0;
  remainingMs = phaseSeconds(settings, phase) * 1000;
  paint();
}

function paint(): void {
  if (!phaseEl || !displayEl || !roundEl) return;
  const clock = mmss(Math.ceil(remainingMs / 1000));
  const label = t(`pomodoro.phase_${phase}`);
  phaseEl.textContent = label;
  displayEl.textContent = clock;
  const inRound = phase === "focus" ? (completed % settings.rounds) + 1 : Math.max(1, completed % settings.rounds || settings.rounds);
  roundEl.textContent = `${t("pomodoro.round")} ${inRound} / ${settings.rounds} · ${t("pomodoro.done")} ${completed}`;
  if (pageTitle) document.title = running ? `${clock} ${label} · ${pageTitle}` : pageTitle;
}

function armAudio(): void {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    if (!audio) audio = new Ctx();
    if (audio.state === "suspended") void audio.resume().catch(() => undefined);
  } catch { /* ignore */ }
}

/** Two short tones on the context armed by Start. Silently skipped where audio is blocked. */
function chime(): void {
  const ctx = audio;
  if (!ctx) return;
  try {
    for (const [at, freq] of [[0, 880], [0.25, 1175]] as const) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + at);
      gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 0.2);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + at);
      osc.stop(ctx.currentTime + at + 0.22);
    }
  } catch { /* ignore */ }
}
