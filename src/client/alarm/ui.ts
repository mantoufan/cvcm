import { armAudio, resumeIfPaused } from "../audio";
import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { RING_LIMIT_MS, SNOOZE_MINUTES, SOUNDS, nextAlarm, parseClock, remainingText, untilParts, type AlarmSound } from "../../shared/alarm";

type Note = { at: number; f: number; d: number; type: OscillatorType; decay?: boolean };
type Pattern = { period: number; notes: Note[] };

const PATTERNS: Record<AlarmSound, Pattern> = {
  beep: { period: 1, notes: [0, 0.15, 0.3, 0.45].map((at) => ({ at, f: 880, d: 0.08, type: "square" as const })) },
  chime: { period: 1.4, notes: [{ at: 0, f: 659.25, d: 0.5, type: "sine", decay: true }, { at: 0.35, f: 880, d: 0.7, type: "sine", decay: true }] },
  bell: { period: 1.5, notes: [{ at: 0, f: 523.25, d: 1.2, type: "sine", decay: true }, { at: 0, f: 1046.5, d: 0.8, type: "sine", decay: true }, { at: 0, f: 1568, d: 0.4, type: "sine", decay: true }] },
  digital: { period: 1, notes: [0, 0.18].map((at) => ({ at, f: 1046.5, d: 0.1, type: "square" as const })) },
};
/**
 * Ring audio is queued on the audio clock this far ahead, so a throttled background tab still rings on time.
 * Chrome runs a hidden tab's timers about once a minute, so the queue is topped up while more than a minute is left.
 */
const CHUNK_S = 120;
const REFILL_S = 75;
const VOLUME = 0.22;

let clockEl: HTMLElement | null = null;
let timeEl: HTMLInputElement | null = null;
let labelEl: HTMLInputElement | null = null;
let soundEl: HTMLSelectElement | null = null;
let setBtn: HTMLButtonElement | null = null;
let statusEl: HTMLElement | null = null;
let ringEl: HTMLElement | null = null;
let ringLabelEl: HTMLElement | null = null;
let errorEl: HTMLElement | null = null;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let testGain: GainNode | null = null;
let scheduledFrom = 0;
let scheduledUntil = 0;
let alarmAt: number | null = null;
let ringingSince: number | null = null;
let timer = 0;
/** The page title before ringing; null when the title is not swapped. */
let savedTitle: string | null = null;
let wakeLock: { release: () => Promise<void>; released?: boolean } | null = null;

export function mountAlarm(host: HTMLElement): void {
  clockEl = h("p", { class: "alarm-clock", "data-out": "clock", "data-volatile": "" });
  timeEl = h("input", { type: "time", value: "07:00", "data-field": "time", "data-fixed-date": "", required: true, onInput: () => onTimeChange() });
  labelEl = h("input", { type: "text", maxlength: "60", "data-field": "label", placeholder: t("alarm.labelPlaceholder") });
  soundEl = h("select", { "data-field": "sound", onChange: () => onSoundChange() },
    ...SOUNDS.map((s, i) => h("option", { value: s, selected: i === 0 }, t(`alarm.sound_${s}`))),
  );
  setBtn = h("button", { type: "button", class: "btn", "data-action": "set", onClick: () => (alarmAt === null ? arm() : cancel()) }, t("alarm.set"));
  statusEl = h("p", { class: "alarm-status", "aria-live": "polite", "data-out": "status" }, t("alarm.notSet"));
  errorEl = h("p", { class: "hint", "aria-live": "polite", "data-out": "error" });
  ringLabelEl = h("p", { class: "alarm-ring-label" });
  ringEl = h("div", { class: "alarm-ring", role: "alertdialog", "aria-label": t("alarm.ringing"), hidden: true, "data-out": "ring" },
    h("p", { class: "alarm-ring-title" }, t("alarm.ringing")),
    ringLabelEl,
    h("div", { class: "stage-actions" },
      h("button", { type: "button", class: "btn", "data-action": "stop", onClick: () => cancel() }, t("alarm.stop")),
      ...SNOOZE_MINUTES.map((n) => h("button", { type: "button", class: "btn ghost", "data-action": `snooze-${n}`, onClick: () => snooze(n) }, t("alarm.snooze", { n }))),
    ),
  );
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("alarm.back")),
      h("h1", null, t("alarm.title")),
      h("p", { class: "lede" }, t("alarm.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("alarm.options")),
          h("label", { class: "field" }, h("span", null, t("alarm.time")), timeEl),
          h("label", { class: "field" }, h("span", null, t("alarm.label")), labelEl),
          h("label", { class: "field" }, h("span", null, t("alarm.sound")), soundEl),
        ),
        h("div", { class: "stage-actions" },
          setBtn,
          h("button", { type: "button", class: "btn ghost", "data-action": "test", onClick: () => testSound() }, t("alarm.test")),
        ),
        h("p", { class: "hint" }, t("alarm.hint")),
      ),
      h("div", { class: "rail" },
        clockEl,
        statusEl,
        errorEl,
        ringEl,
      ),
    ),
  );
  timer = window.setInterval(tick, 250);
  document.addEventListener("visibilitychange", onVisibility);
  tick();
}

/** The screen wake lock is dropped whenever the tab is hidden; take it again when the alarm tab comes back. */
function onVisibility(): void {
  if (ctx && alarmAt !== null) resumeIfPaused(ctx);
  tick();
  if (alarmAt !== null && document.visibilityState === "visible") void holdWake();
}

export function unmountAlarm(): void {
  window.clearInterval(timer);
  timer = 0;
  document.removeEventListener("visibilitychange", onVisibility);
  stopAudio();
  if (testGain) testGain.disconnect();
  testGain = null;
  restoreTitle();
  releaseWake();
  alarmAt = null;
  ringingSince = null;
  if (ctx) void ctx.close().catch(() => undefined);
  ctx = null;
  clockEl = timeEl = labelEl = null;
  soundEl = null;
  setBtn = null;
  statusEl = ringEl = ringLabelEl = errorEl = null;
}

/** A new time replaces a set, snoozed or ringing alarm. */
function onTimeChange(): void {
  if (alarmAt !== null) arm();
}

/** A new sound keeps the alarm time (and any snooze) and only swaps the queued audio. */
function onSoundChange(): void {
  if (alarmAt === null || !ctx) return;
  if (ringingSince !== null) {
    stopAudio();
    queueRingFromNow();
  } else scheduleAt(alarmAt);
}

function queueRingFromNow(): void {
  if (!ctx) return;
  master = freshMaster();
  if (!master) return;
  scheduledFrom = ctx.currentTime;
  scheduledUntil = queue(master, scheduledFrom, scheduledFrom + CHUNK_S, sound());
}

function sound(): AlarmSound {
  const v = soundEl?.value as AlarmSound;
  return SOUNDS.includes(v) ? v : "beep";
}

/** Queues whole pattern periods from `from` until `until` (audio-clock seconds) into `out`; returns where the next period starts. */
function queue(out: GainNode, from: number, until: number, kind: AlarmSound): number {
  if (!ctx) return from;
  const p = PATTERNS[kind];
  let start = from;
  for (; start < until; start += p.period) {
    for (const n of p.notes) {
      const at = start + n.at;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = n.type;
      osc.frequency.value = n.f;
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(1, at + 0.01);
      if (n.decay) g.gain.exponentialRampToValueAtTime(0.001, at + n.d);
      else g.gain.setValueAtTime(0, at + n.d);
      osc.connect(g).connect(out);
      osc.start(at);
      osc.stop(at + n.d + 0.02);
    }
  }
  return start;
}

function freshMaster(): GainNode | null {
  if (!ctx) return null;
  const g = ctx.createGain();
  g.gain.value = VOLUME;
  g.connect(ctx.destination);
  return g;
}

function stopAudio(): void {
  master?.disconnect();
  master = null;
  scheduledFrom = scheduledUntil = 0;
}

/** Queues the first CHUNK_S seconds of ringing at the alarm time on the audio clock. */
function scheduleAt(ms: number): void {
  stopAudio();
  if (!ctx) return;
  master = freshMaster();
  if (!master) return;
  scheduledFrom = ctx.currentTime + Math.max(0, (ms - Date.now()) / 1000);
  scheduledUntil = queue(master, scheduledFrom, scheduledFrom + CHUNK_S, sound());
}

function arm(): void {
  if (!timeEl || !errorEl) return;
  const mins = parseClock(timeEl.value);
  if (mins === null) {
    errorEl.textContent = t("alarm.invalid");
    return;
  }
  errorEl.textContent = "";
  // Created inside the click, as iOS and autoplay rules require.
  ctx = armAudio(ctx);
  if (!ctx) errorEl.textContent = t("alarm.noAudio");
  ringingSince = null;
  hideRing();
  restoreTitle();
  alarmAt = nextAlarm(new Date(), mins).getTime();
  scheduleAt(alarmAt);
  void holdWake();
  if (setBtn) setBtn.textContent = t("alarm.cancel");
  tick();
}

function cancel(): void {
  alarmAt = null;
  ringingSince = null;
  stopAudio();
  hideRing();
  restoreTitle();
  releaseWake();
  if (setBtn) setBtn.textContent = t("alarm.set");
  if (statusEl) statusEl.textContent = t("alarm.notSet");
}

function snooze(n: number): void {
  ringingSince = null;
  hideRing();
  restoreTitle();
  alarmAt = Date.now() + n * 60_000;
  scheduleAt(alarmAt);
  tick();
}

function testSound(): void {
  ctx = armAudio(ctx);
  if (!ctx) {
    if (errorEl) errorEl.textContent = t("alarm.noAudio");
    return;
  }
  testGain?.disconnect();
  testGain = freshMaster();
  if (!testGain) return;
  const kind = sound();
  queue(testGain, ctx.currentTime + 0.05, ctx.currentTime + 0.05 + PATTERNS[kind].period * 2 - 0.01, kind);
}

function hideRing(): void {
  if (ringEl) ringEl.hidden = true;
}

function restoreTitle(): void {
  if (savedTitle !== null) document.title = savedTitle;
  savedTitle = null;
}

function startRinging(now: number): void {
  ringingSince = now;
  if (ctx) {
    // iOS leaves the context suspended or "interrupted" after a call or app switch.
    resumeIfPaused(ctx);
    // The queued audio already started on the audio clock unless the device slept: then start it now.
    if (!master || scheduledFrom > ctx.currentTime + 0.5 || scheduledUntil < ctx.currentTime) {
      stopAudio();
      queueRingFromNow();
    }
  }
  const label = labelEl?.value.trim() || t("alarm.title");
  // The time that is ringing: after a snooze it is not the one in the time box.
  const at = new Date(alarmAt ?? now).toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" });
  if (ringLabelEl) ringLabelEl.textContent = `${at} · ${label}`;
  if (ringEl) ringEl.hidden = false;
  if (savedTitle === null) savedTitle = document.title;
  document.title = `⏰ ${label}`;
}

function tick(): void {
  const now = Date.now();
  if (clockEl) clockEl.textContent = new Date(now).toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  if (alarmAt === null || !statusEl) return;
  if (ringingSince === null && now >= alarmAt) startRinging(now);
  if (ringingSince !== null) {
    statusEl.textContent = t("alarm.ringingSince", { time: remainingText(now - ringingSince) });
    if (ctx && master && scheduledUntil - ctx.currentTime < REFILL_S) {
      // Continue on the next beat; never queue notes in the past, or after a long gap they would all start at once.
      const from = Math.max(scheduledUntil, ctx.currentTime + 0.05);
      scheduledUntil = queue(master, from, from + CHUNK_S, sound());
    }
    if (now - ringingSince >= RING_LIMIT_MS) {
      cancel();
      if (statusEl) statusEl.textContent = t("alarm.missed");
    }
    return;
  }
  const left = alarmAt - now;
  const { h: hh, m: mm } = untilParts(left);
  const at = new Date(alarmAt).toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" });
  statusEl.textContent = t("alarm.setFor", { time: at, h: hh, m: mm, left: remainingText(left) });
}

async function holdWake(): Promise<void> {
  try {
    const nav = navigator as Navigator & { wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void>; released?: boolean }> } };
    if ((!wakeLock || wakeLock.released) && nav.wakeLock) wakeLock = await nav.wakeLock.request("screen");
  } catch {
    wakeLock = null;
  }
}

function releaseWake(): void {
  void wakeLock?.release().catch(() => undefined);
  wakeLock = null;
}
