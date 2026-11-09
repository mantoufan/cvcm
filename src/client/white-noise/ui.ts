import { armAudio, resumeIfPaused } from "../audio";
import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { FADE_OUT_S, NOISE_COLORS, TIMER_MINUTES, isNoiseColor, noiseLoop, timerText, type NoiseColor } from "../../shared/noise";

/** Fade in on play, and the crossfade when switching colour, in seconds. */
const FADE_IN_S = 1;
const SWITCH_S = 0.6;
const STOP_S = 0.25;
/** Slider 0–100 → gain with a squared curve, so the low end is usable. */
const MAX_GAIN = 0.9;

let colorEl: HTMLSelectElement | null = null;
let volumeEl: HTMLInputElement | null = null;
let timerEl: HTMLSelectElement | null = null;
let playBtn: HTMLButtonElement | null = null;
let statusEl: HTMLElement | null = null;
let aboutEl: HTMLElement | null = null;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
/** The playing source and its own gain (for fades and the sleep timer). */
/** The playing source, its own gain (fades and the sleep timer), and when its fade-in starts and ends. */
let voice: { src: AudioBufferSourceNode; gain: GainNode; color: NoiseColor; start: number; fullAt: number } | null = null;
let buffers = new Map<NoiseColor, AudioBuffer>();
/** Audio-clock time the sleep timer ends, or null for no timer. */
let endsAt: number | null = null;
let tickTimer = 0;

export function mountWhiteNoise(host: HTMLElement): void {
  colorEl = h("select", { "data-field": "color", onChange: () => onColor() },
    ...NOISE_COLORS.map((c, i) => h("option", { value: c, selected: i === 0 }, t(`whiteNoise.color_${c}`))),
  );
  volumeEl = h("input", { type: "range", min: "0", max: "100", step: "1", value: "50", "data-field": "volume", "aria-label": t("whiteNoise.volume"), onInput: () => applyVolume() });
  timerEl = h("select", { "data-field": "timer", onChange: () => onTimer() },
    ...TIMER_MINUTES.map((m) => h("option", { value: String(m), selected: m === 0 }, m === 0 ? t("whiteNoise.timerOff") : m < 60 ? t("whiteNoise.timerMinutes", { n: m }) : t("whiteNoise.timerHours", { n: m / 60 }))),
  );
  playBtn = h("button", { type: "button", class: "btn", "data-action": "play", onClick: () => (voice ? stop() : play()) }, t("whiteNoise.play"));
  statusEl = h("p", { class: "noise-status", "aria-live": "polite", "data-out": "status" }, t("whiteNoise.stopped"));
  aboutEl = h("p", { class: "hint", "data-out": "about" }, t("whiteNoise.about_white"));
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("whiteNoise.back")),
      h("h1", null, t("whiteNoise.title")),
      h("p", { class: "lede" }, t("whiteNoise.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("whiteNoise.options")),
          h("label", { class: "field" }, h("span", null, t("whiteNoise.color")), colorEl),
          aboutEl,
          h("label", { class: "field" }, h("span", null, t("whiteNoise.volume")), volumeEl),
          h("label", { class: "field" }, h("span", null, t("whiteNoise.timer")), timerEl),
        ),
        h("div", { class: "stage-actions" }, playBtn),
        h("p", { class: "hint" }, t("whiteNoise.hint")),
      ),
      h("div", { class: "rail" },
        statusEl,
        h("dl", { class: "stats-grid noise-guide" },
          ...NOISE_COLORS.flatMap((c) => [h("dt", null, t(`whiteNoise.color_${c}`)), h("dd", null, t(`whiteNoise.about_${c}`))]),
        ),
      ),
    ),
  );
  document.addEventListener("visibilitychange", onVisibility);
}

export function unmountWhiteNoise(): void {
  document.removeEventListener("visibilitychange", onVisibility);
  window.clearInterval(tickTimer);
  tickTimer = 0;
  killVoice();
  endsAt = null;
  clearMediaSession();
  if (ctx) void ctx.close().catch(() => undefined);
  ctx = null;
  master = null;
  buffers = new Map();
  colorEl = timerEl = null;
  volumeEl = null;
  playBtn = null;
  statusEl = aboutEl = null;
}

function color(): NoiseColor {
  const v = colorEl?.value ?? "white";
  return isNoiseColor(v) ? v : "white";
}

function gainOf(): number {
  const v = Number(volumeEl?.value ?? 50) / 100;
  return MAX_GAIN * v * v;
}

/** Two independent channels, so the noise sounds wide in headphones rather than centred. */
function bufferFor(c: NoiseColor): AudioBuffer | null {
  if (!ctx) return null;
  const cached = buffers.get(c);
  if (cached) return cached;
  let buf: AudioBuffer;
  try {
    const left = noiseLoop(c, ctx.sampleRate);
    const right = noiseLoop(c, ctx.sampleRate);
    buf = ctx.createBuffer(2, left.length, ctx.sampleRate);
    buf.copyToChannel(left, 0);
    buf.copyToChannel(right, 1);
  } catch {
    return null;
  }
  // Each colour is about 5 MB of samples at 48 kHz; keeping all four makes switching back instant.
  buffers.set(c, buf);
  return buf;
}

function startVoice(c: NoiseColor, fade: number): boolean {
  if (!ctx || !master) return false;
  const buf = bufferFor(c);
  if (!buf) return false;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const gain = ctx.createGain();
  const now = ctx.currentTime;
  src.connect(gain).connect(master);
  // Random start point, so replaying does not begin with the same second of noise.
  src.start(now, Math.random() * buf.duration);
  voice = { src, gain, color: c, start: now, fullAt: now + fade };
  scheduleEnd();
  return true;
}

/** Fades the current voice out and stops it; the next one (if any) has already started. */
function fadeOut(v: NonNullable<typeof voice>, seconds: number): void {
  if (!ctx) return;
  const now = ctx.currentTime;
  const g = v.gain.gain;
  g.cancelScheduledValues(now);
  g.setValueAtTime(g.value, now);
  g.linearRampToValueAtTime(0, now + seconds);
  try {
    v.src.stop(now + seconds + 0.05);
  } catch {
    // Already stopped by the sleep timer.
  }
  v.src.onended = () => v.gain.disconnect();
}

function killVoice(): void {
  if (!voice) return;
  try {
    voice.src.onended = null;
    voice.src.stop();
  } catch {
    // Already stopped.
  }
  voice.src.disconnect();
  voice.gain.disconnect();
  voice = null;
}

function play(): void {
  // Create the AudioContext inside the click, as iOS requires.
  ctx = armAudio(ctx);
  if (!ctx) {
    say("noAudio");
    return;
  }
  if (!master) {
    master = ctx.createGain();
    master.gain.value = gainOf();
    master.connect(ctx.destination);
  }
  const minutes = Number(timerEl?.value ?? 0);
  endsAt = minutes > 0 ? ctx.currentTime + minutes * 60 : null;
  if (!startVoice(color(), FADE_IN_S)) {
    say("noAudio");
    return;
  }
  if (playBtn) playBtn.textContent = t("whiteNoise.stop");
  window.clearInterval(tickTimer);
  tickTimer = window.setInterval(tick, 500);
  setMediaSession();
  tick();
}

function stop(): void {
  window.clearInterval(tickTimer);
  tickTimer = 0;
  if (voice) {
    fadeOut(voice, STOP_S);
    voice = null;
  }
  endsAt = null;
  if (playBtn) playBtn.textContent = t("whiteNoise.play");
  if (navigator.mediaSession) navigator.mediaSession.playbackState = "paused";
  say("stopped");
}

function onColor(): void {
  const c = color();
  if (aboutEl) aboutEl.textContent = t(`whiteNoise.about_${c}`);
  if (!voice || voice.color === c) return;
  const old = voice;
  if (startVoice(c, SWITCH_S)) fadeOut(old, SWITCH_S);
  tick();
}

function onTimer(): void {
  if (!ctx || !voice) return;
  const minutes = Number(timerEl?.value ?? 0);
  endsAt = minutes > 0 ? ctx.currentTime + minutes * 60 : null;
  scheduleEnd();
  tick();
}

/**
 * Puts the sleep timer's fade on the audio clock, so a background tab (whose timers the browser slows down)
 * still ends on time. Without a timer the voice holds at full level.
 */
function scheduleEnd(): void {
  if (!ctx || !voice) return;
  const g = voice.gain.gain;
  // Rebuild the whole envelope from the voice's start: fade-in, hold, and the timer's fade-out. Reading g.value after
  // cancelling would lose a fade-in that is still running.
  g.cancelScheduledValues(0);
  g.setValueAtTime(0, voice.start);
  g.linearRampToValueAtTime(1, voice.fullAt);
  // Only the gain is scheduled: a scheduled stop() could not be taken back if the timer is turned off.
  // tick() stops the silent source once it notices the end.
  if (endsAt === null) return;
  const fadeFrom = Math.max(voice.fullAt, endsAt - FADE_OUT_S);
  g.setValueAtTime(1, fadeFrom);
  g.linearRampToValueAtTime(0, Math.max(fadeFrom, endsAt));
}

function applyVolume(): void {
  if (!ctx || !master) return;
  const now = ctx.currentTime;
  master.gain.cancelScheduledValues(now);
  master.gain.setTargetAtTime(gainOf(), now, 0.03);
}

function tick(): void {
  if (!ctx || !voice) return;
  const name = t(`whiteNoise.color_${voice.color}`);
  if (endsAt === null) {
    say("playing", { color: name });
    return;
  }
  const left = endsAt - ctx.currentTime;
  if (left <= 0) {
    // The audio clock already stopped the sound; tidy up the page.
    killVoice();
    endsAt = null;
    window.clearInterval(tickTimer);
    tickTimer = 0;
    if (playBtn) playBtn.textContent = t("whiteNoise.play");
    if (navigator.mediaSession) navigator.mediaSession.playbackState = "paused";
    say("finished");
    return;
  }
  say("playingTimer", { color: name, left: timerText(left) });
}

function onVisibility(): void {
  // iOS can leave the context "interrupted" after a call or app switch.
  if (ctx && voice) resumeIfPaused(ctx);
  tick();
}

function say(key: string, vars?: Record<string, string | number>): void {
  if (statusEl) statusEl.textContent = t(`whiteNoise.${key}`, vars);
}

/** Lock-screen and headset play/pause buttons, where the browser supports the Media Session API. */
function setMediaSession(): void {
  const ms = navigator.mediaSession;
  if (!ms) return;
  try {
    if (typeof MediaMetadata !== "undefined") ms.metadata = new MediaMetadata({ title: t("whiteNoise.title"), artist: "cv.cm" });
    ms.playbackState = "playing";
    ms.setActionHandler("play", () => { if (!voice) play(); });
    ms.setActionHandler("pause", () => { if (voice) stop(); });
    ms.setActionHandler("stop", () => { if (voice) stop(); });
  } catch {
    // Older browsers reject some actions.
  }
}

function clearMediaSession(): void {
  const ms = navigator.mediaSession;
  if (!ms) return;
  try {
    ms.metadata = null;
    ms.playbackState = "none";
    for (const action of ["play", "pause", "stop"] as const) ms.setActionHandler(action, null);
  } catch {
    // Nothing to clear.
  }
}
