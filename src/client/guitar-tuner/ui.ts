import { armAudio, newAudioContext } from "../audio";
import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import {
  DEFAULT_A4, IN_TUNE_CENTS, MAX_A4, MIN_A4, TUNINGS, TUNING_IDS, centsOff, centsText, clampA4, detectPitch, median,
  midiToFreq, nearestTarget, noteName, searchRange, type Notation, type TuningId,
} from "../../shared/tuner";

/** Analyse about 20 times a second; every frame would be wasted work on phones. */
const ANALYSE_MS = 50;
/** Readings kept for the median. */
const SMOOTH = 5;
/** With no clear pitch for this long the display goes back to waiting. */
const HOLD_MS = 1200;
const REFERENCE_MS = 2500;
/** Tunings named in flats (they are tuned down a half step). */
const FLAT_TUNINGS: ReadonlySet<TuningId> = new Set<TuningId>(["guitar-half-down"]);

let tuningEl: HTMLSelectElement | null = null;
let a4El: HTMLInputElement | null = null;
let notationEl: HTMLSelectElement | null = null;
let startBtn: HTMLButtonElement | null = null;
let statusEl: HTMLElement | null = null;
let noteEl: HTMLElement | null = null;
let freqEl: HTMLElement | null = null;
let centsEl: HTMLElement | null = null;
let needleEl: HTMLElement | null = null;
let meterEl: HTMLElement | null = null;
let verdictEl: HTMLElement | null = null;
let stringsEl: HTMLElement | null = null;
let refBtn: HTMLButtonElement | null = null;
let audio: AudioContext | null = null;
let stream: MediaStream | null = null;
let source: MediaStreamAudioSourceNode | null = null;
let analyser: AnalyserNode | null = null;
let sink: GainNode | null = null;
let buf: Float32Array<ArrayBuffer> | null = null;
let timer = 0;
let readings: number[] = [];
/** A reading far from the median, waiting for a second frame to confirm the note changed. */
let pending: number | null = null;
let lastHeard = 0;
let lastTarget: number | null = null;
/** A string picked by hand; null = follow whichever string is played. */
let locked: number | null = null;
let refOsc: OscillatorNode | null = null;
let refGain: GainNode | null = null;
let refTimer = 0;
let run = 0;
let asking = false;

export function mountGuitarTuner(host: HTMLElement): void {
  locked = null;
  lastTarget = null;
  tuningEl = h("select", { "data-field": "tuning", onChange: () => { locked = null; lastTarget = null; readings = []; paintStrings(); } },
    ...TUNING_IDS.map((id) => h("option", { value: id, selected: id === "guitar" }, t(`guitarTuner.tuning_${id}`))),
  );
  a4El = h("input", { type: "number", min: String(MIN_A4), max: String(MAX_A4), step: "0.1", inputmode: "decimal", value: String(DEFAULT_A4), "data-field": "a4", onChange: () => { if (a4El) a4El.value = String(a4()); readings = []; paintStrings(); } });
  notationEl = h("select", { "data-field": "notation", onChange: () => { paintStrings(); paintNote(null); } },
    h("option", { value: "letter", selected: locale() !== "es" }, t("guitarTuner.letters")),
    h("option", { value: "solfege", selected: locale() === "es" }, t("guitarTuner.solfege")),
  );
  startBtn = h("button", { type: "button", class: "btn", "data-action": "start", onClick: () => (stream || asking ? stop() : void start()) }, t("guitarTuner.start"));
  refBtn = h("button", { type: "button", class: "btn ghost", "data-action": "reference", onClick: () => playReference() }, t("guitarTuner.reference"));
  statusEl = h("p", { class: "hint", "aria-live": "polite", "data-out": "status" }, t("guitarTuner.idle"));
  noteEl = h("p", { class: "tuner-note", "data-out": "note" }, "—");
  freqEl = h("p", { class: "tuner-freq", "data-out": "frequency" }, "— Hz");
  centsEl = h("span", { class: "tuner-cents", "data-out": "cents" }, "");
  needleEl = h("span", { class: "tuner-needle" });
  meterEl = h("div", { class: "tuner-meter", role: "meter", "aria-label": t("guitarTuner.cents"), "aria-valuemin": "-50", "aria-valuemax": "50", "aria-valuenow": "0" },
    h("span", { class: "tuner-zone" }),
    needleEl,
    h("span", { class: "tuner-scale" }, h("span", null, "−50"), h("span", null, "0"), h("span", null, "+50")),
  );
  verdictEl = h("p", { class: "tuner-verdict", "aria-live": "polite", "data-out": "verdict" });
  stringsEl = h("div", { class: "chip-row tuner-strings", "data-out": "strings" });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("guitarTuner.back")),
      h("h1", null, t("guitarTuner.title")),
      h("p", { class: "lede" }, t("guitarTuner.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("div", { class: "rail tuner-stage" },
        noteEl,
        h("p", { class: "tuner-sub" }, freqEl, centsEl),
        meterEl,
        verdictEl,
        stringsEl,
        h("div", { class: "stage-actions" }, startBtn, refBtn),
        statusEl,
      ),
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("guitarTuner.options")),
          h("label", { class: "field" }, h("span", null, t("guitarTuner.instrument")), tuningEl),
          h("label", { class: "field" }, h("span", null, t("guitarTuner.a4")), a4El),
          h("label", { class: "field" }, h("span", null, t("guitarTuner.notation")), notationEl),
        ),
        h("p", { class: "hint" }, t("guitarTuner.hint")),
      ),
    ),
  );
  paintStrings();
}

export function unmountGuitarTuner(): void {
  stop();
  stopReference();
  if (audio) void audio.close().catch(() => undefined);
  audio = null;
  tuningEl = notationEl = null;
  a4El = null;
  startBtn = refBtn = null;
  statusEl = noteEl = freqEl = centsEl = needleEl = meterEl = verdictEl = stringsEl = null;
}

function tuning(): TuningId {
  const v = tuningEl?.value as TuningId | undefined;
  return v && v in TUNINGS ? v : "guitar";
}

function a4(): number {
  return clampA4(Number(a4El?.value));
}

function notation(): Notation {
  return notationEl?.value === "solfege" ? "solfege" : "letter";
}

function name(midi: number, octave = true): string {
  return noteName(midi, notation(), FLAT_TUNINGS.has(tuning()), octave);
}

function say(key: string): void {
  if (statusEl) statusEl.textContent = t(`guitarTuner.${key}`);
}

function paintStrings(): void {
  if (!stringsEl) return;
  const strings = TUNINGS[tuning()] as readonly number[];
  if (!strings.length) {
    stringsEl.replaceChildren();
    return;
  }
  stringsEl.replaceChildren(
    h("button", { type: "button", class: `chip${locked == null ? " on" : ""}`, "data-string": "auto", "aria-pressed": String(locked == null), onClick: () => { locked = null; markStrings(); } }, t("guitarTuner.auto")),
    ...strings.map((m) => h("button", {
      type: "button",
      class: `chip${locked === m ? " on" : ""}${lastTarget === m ? " heard" : ""}`,
      "data-string": String(m),
      "aria-pressed": String(locked === m),
      title: `${midiToFreq(m, a4()).toFixed(2)} Hz`,
      onClick: () => { locked = locked === m ? null : m; markStrings(); },
    }, name(m))),
  );
}

/** Updates the chips' picked and heard marks in place, so a focused or half-clicked chip is not replaced. */
function markStrings(): void {
  if (!stringsEl) return;
  for (const btn of Array.from(stringsEl.querySelectorAll<HTMLButtonElement>("button[data-string]"))) {
    const m = btn.dataset.string === "auto" ? null : Number(btn.dataset.string);
    const on = m === locked;
    btn.classList.toggle("on", on);
    btn.setAttribute("aria-pressed", String(on));
    btn.classList.toggle("heard", m != null && m === lastTarget);
  }
}

async function start(): Promise<void> {
  stop();
  const mine = ++run;
  if (!navigator.mediaDevices?.getUserMedia) {
    say(window.isSecureContext === false ? "insecure" : "unsupported");
    return;
  }
  // Created inside the click, as iOS requires.
  audio = armAudio(audio);
  if (!audio) {
    say("unsupported");
    return;
  }
  say("asking");
  if (startBtn) startBtn.textContent = t("guitarTuner.stop");
  asking = true;
  let s: MediaStream;
  try {
    // No echo cancellation, noise suppression or auto gain: they smear the pitch of a sustained note.
    s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
  } catch (err) {
    if (mine !== run) return;
    asking = false;
    if (startBtn) startBtn.textContent = t("guitarTuner.start");
    const n = (err as { name?: string })?.name;
    say(n === "NotAllowedError" || n === "SecurityError" ? "denied" : n === "NotFoundError" || n === "OverconstrainedError" ? "notFound" : n === "NotReadableError" ? "busy" : "failed");
    return;
  }
  if (mine !== run || !audio) {
    s.getTracks().forEach((tr) => tr.stop());
    return;
  }
  asking = false;
  stream = s;
  if (!buildGraph(audio, s)) {
    // Firefox refuses a microphone whose sample rate differs from the context's: retry at the microphone's rate.
    const rate = s.getAudioTracks()[0]?.getSettings().sampleRate;
    let ok = false;
    if (rate !== audio.sampleRate) {
      stopReference();
      void audio.close().catch(() => undefined);
      audio = newAudioContext(rate ? { sampleRate: rate } : undefined);
      ok = !!audio && buildGraph(audio, s);
    }
    if (!ok) {
      stop();
      say("failed");
      return;
    }
  }
  s.getAudioTracks()[0]?.addEventListener("ended", () => {
    if (stream === s) {
      stop();
      say("ended");
    }
  });
  readings = [];
  pending = null;
  lastHeard = 0;
  say("listening");
  timer = window.setInterval(analyse, ANALYSE_MS);
}

function buildGraph(ctx: AudioContext, s: MediaStream): boolean {
  try {
    source = ctx.createMediaStreamSource(s);
    analyser = ctx.createAnalyser();
    // Lags up to half the window are searched: 4096 samples reach 23 Hz at 48 kHz (below a five-string bass's low B,
    // 31 Hz); 8192 keep that floor at 88.2 or 96 kHz.
    analyser.fftSize = ctx.sampleRate > 50000 ? 8192 : 4096;
    buf = new Float32Array(analyser.fftSize);
    // Some WebKit builds only run nodes the destination pulls on: feed it through a silent gain.
    sink = ctx.createGain();
    sink.gain.value = 0;
    source.connect(analyser).connect(sink).connect(ctx.destination);
    return true;
  } catch {
    source = null;
    analyser = null;
    sink = null;
    return false;
  }
}

function stop(): void {
  run++;
  asking = false;
  window.clearInterval(timer);
  source?.disconnect();
  analyser?.disconnect();
  sink?.disconnect();
  source = null;
  analyser = null;
  sink = null;
  buf = null;
  stream?.getTracks().forEach((tr) => tr.stop());
  stream = null;
  readings = [];
  pending = null;
  lastTarget = null;
  if (startBtn) startBtn.textContent = t("guitarTuner.start");
  paintNote(null);
  paintStrings();
  say("idle");
}

function analyse(): void {
  if (!analyser || !buf || !audio) return;
  // A context made after the permission prompt (the sample-rate retry) may start suspended.
  if (audio.state === "suspended") void audio.resume().catch(() => undefined);
  if (typeof analyser.getFloatTimeDomainData === "function") analyser.getFloatTimeDomainData(buf);
  else return;
  const { min, max } = searchRange(tuning(), a4());
  const pitch = detectPitch(buf, audio.sampleRate, min, max);
  const now = performance.now();
  if (!pitch) {
    if (lastHeard && now - lastHeard > HOLD_MS) {
      lastHeard = 0;
      readings = [];
      pending = null;
      paintNote(null);
      say("listening");
    }
    return;
  }
  // A new note (more than a semitone from the median) restarts the median only when two frames in a row agree on it,
  // so one stray frame (an octave error) is dropped instead of painted.
  const far = readings.length > 0 && Math.abs(12 * Math.log2(pitch.freq / median(readings))) > 1;
  if (far) {
    const agrees = pending != null && Math.abs(12 * Math.log2(pitch.freq / pending)) <= 1;
    pending = pitch.freq;
    if (!agrees) return;
    readings = [];
  }
  pending = null;
  readings.push(pitch.freq);
  if (readings.length > SMOOTH) readings.shift();
  lastHeard = now;
  paintNote(median(readings));
}

function paintNote(freq: number | null): void {
  if (!noteEl || !freqEl || !centsEl || !needleEl || !verdictEl || !meterEl) return;
  if (freq == null) {
    noteEl.textContent = "—";
    freqEl.textContent = "— Hz";
    centsEl.textContent = "";
    needleEl.style.left = "50%";
    needleEl.classList.remove("ok");
    meterEl.setAttribute("aria-valuenow", "0");
    verdictEl.textContent = stream ? t("guitarTuner.playString") : "";
    verdictEl.dataset.state = "";
    return;
  }
  const target = locked ?? nearestTarget(freq, tuning(), a4());
  const cents = centsOff(freq, target, a4());
  noteEl.textContent = name(target);
  freqEl.textContent = `${freq.toFixed(1)} Hz`;
  centsEl.textContent = t("guitarTuner.centsValue", { n: centsText(cents) });
  const shown = Math.max(-50, Math.min(50, cents));
  needleEl.style.left = `${50 + shown}%`;
  const ok = Math.abs(cents) <= IN_TUNE_CENTS;
  needleEl.classList.toggle("ok", ok);
  meterEl.setAttribute("aria-valuenow", String(Math.round(shown)));
  // Far from a picked string (another string is ringing): name the note actually heard.
  const state = ok ? "ok" : cents < 0 ? "flat" : "sharp";
  verdictEl.dataset.state = state;
  verdictEl.textContent = Math.abs(cents) > 100
    ? t("guitarTuner.farOff", { note: name(nearestTarget(freq, "chromatic", a4())) })
    : t(`guitarTuner.verdict_${state}`);
  if (target !== lastTarget) {
    lastTarget = target;
    markStrings();
  }
}

/** Plays the picked string, the string last heard, or A4, as a soft triangle tone. */
function playReference(): void {
  stopReference();
  audio = armAudio(audio);
  if (!audio) {
    say("unsupported");
    return;
  }
  const strings = TUNINGS[tuning()] as readonly number[];
  const midi = locked ?? lastTarget ?? (strings.length ? strings[0]! : 69);
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = "triangle";
  osc.frequency.value = midiToFreq(midi, a4());
  const now = audio.currentTime;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.25, now + 0.02);
  gain.gain.setTargetAtTime(0, now + REFERENCE_MS / 1000 - 0.3, 0.08);
  osc.connect(gain).connect(audio.destination);
  osc.start(now);
  osc.stop(now + REFERENCE_MS / 1000);
  refOsc = osc;
  refGain = gain;
  if (refBtn) refBtn.textContent = t("guitarTuner.playing", { note: name(midi) });
  refTimer = window.setTimeout(() => stopReference(), REFERENCE_MS);
}

function stopReference(): void {
  window.clearTimeout(refTimer);
  if (refOsc) {
    try {
      refOsc.stop();
    } catch { /* already stopped */ }
    refOsc.disconnect();
  }
  refGain?.disconnect();
  refOsc = null;
  refGain = null;
  if (refBtn) refBtn.textContent = t("guitarTuner.reference");
}
