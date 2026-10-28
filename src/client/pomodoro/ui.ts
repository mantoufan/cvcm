import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { DEFAULT_POMODORO, mmss, nextPhase, normalizeSettings, phaseSeconds, type Phase, type PomodoroSettings } from "../../shared/pomodoro";

let focusEl: HTMLInputElement | null = null;
let shortEl: HTMLInputElement | null = null;
let longEl: HTMLInputElement | null = null;
let roundsEl: HTMLInputElement | null = null;
let phaseEl: HTMLElement | null = null;
let displayEl: HTMLElement | null = null;
let roundEl: HTMLElement | null = null;
let startBtn: HTMLButtonElement | null = null;
let settings: PomodoroSettings = DEFAULT_POMODORO;
let phase: Phase = "focus";
let left = 0;
let completed = 0;
let running = false;
let timer = 0;
let endsAt = 0;
let pageTitle = "";
/** True until the current phase starts counting, so edited lengths apply to it. */
let fresh = true;

export function mountPomodoro(host: HTMLElement): void {
  focusEl = numberInput("focus", DEFAULT_POMODORO.focus, 180);
  shortEl = numberInput("short", DEFAULT_POMODORO.short, 180);
  longEl = numberInput("long", DEFAULT_POMODORO.long, 180);
  roundsEl = numberInput("rounds", DEFAULT_POMODORO.rounds, 12);
  phaseEl = h("p", { class: "muted", "data-field": "phase" });
  displayEl = h("p", { class: "timestamp-out pomodoro-clock", "aria-live": "polite" });
  roundEl = h("p", { class: "muted" });
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
      h("div", { class: "rail" }, h("h2", null, t("pomodoro.result")), phaseEl, displayEl, roundEl),
    ),
  );
  pageTitle = document.title;
  reset();
}

export function unmountPomodoro(): void {
  stop();
  if (pageTitle) document.title = pageTitle;
  pageTitle = "";
  focusEl = shortEl = longEl = roundsEl = null;
  phaseEl = displayEl = roundEl = null;
  startBtn = null;
  settings = DEFAULT_POMODORO;
  phase = "focus";
  left = 0;
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

function onSettingsInput(): void {
  const next = readSettings();
  if (!next) return;
  settings = next;
  // A phase that has not started ticking yet takes the new length right away.
  if (!running && fresh) left = phaseSeconds(settings, phase);
  paint();
}

function toggle(): void {
  if (running) {
    stop();
    return;
  }
  if (left <= 0) left = phaseSeconds(settings, phase);
  running = true;
  fresh = false;
  endsAt = Date.now() + left * 1000;
  if (startBtn) startBtn.textContent = t("pomodoro.pause");
  timer = window.setInterval(tick, 250);
  paint();
}

function tick(): void {
  left = Math.max(0, Math.round((endsAt - Date.now()) / 1000));
  paint();
  if (left <= 0) {
    stop();
    chime();
    advance();
  }
}

function stop(): void {
  running = false;
  if (timer) window.clearInterval(timer);
  timer = 0;
  if (startBtn) startBtn.textContent = t("pomodoro.start");
}

function advance(): void {
  if (phase === "focus") completed += 1;
  phase = nextPhase(phase, completed, settings.rounds);
  left = phaseSeconds(settings, phase);
  fresh = true;
  paint();
}

function skip(): void {
  stop();
  advance();
}

function reset(): void {
  stop();
  settings = readSettings() ?? DEFAULT_POMODORO;
  phase = "focus";
  completed = 0;
  left = phaseSeconds(settings, phase);
  fresh = true;
  paint();
}

function paint(): void {
  if (!phaseEl || !displayEl || !roundEl) return;
  const clock = mmss(left);
  const label = t(`pomodoro.phase_${phase}`);
  phaseEl.textContent = label;
  displayEl.textContent = clock;
  const inRound = phase === "focus" ? (completed % settings.rounds) + 1 : Math.max(1, completed % settings.rounds || settings.rounds);
  roundEl.textContent = `${t("pomodoro.round")} ${inRound} / ${settings.rounds} · ${t("pomodoro.done")} ${completed}`;
  if (pageTitle) document.title = running ? `${clock} ${label} · ${pageTitle}` : pageTitle;
}

/** Two short tones from the Web Audio API. Silently skipped where audio is blocked. */
function chime(): void {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
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
    window.setTimeout(() => void ctx.close(), 800);
  } catch { /* ignore */ }
}
