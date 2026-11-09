import { armAudio, newAudioContext } from "../audio";
import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { clockText } from "../../shared/recorder";
import { rms } from "../../shared/mic";
import {
  CALIBRATION_MAX,
  CALIBRATION_MIN,
  EXAMPLES,
  LevelStats,
  TIME_WEIGHTS,
  WEIGHTINGS,
  aWeighting,
  bandOf,
  clampCalibration,
  dbText,
  powerToDbfs,
  timeWeight,
  toDb,
  type TimeWeight,
  type Weighting,
} from "../../shared/decibel";

const CAL_KEY = "cvcm.decibelMeter.calibration";
/** Seconds of history in the graph, and the meter's display range in dB. */
const HISTORY_S = 60;
const GRAPH_MIN_DB = 20;
const GRAPH_MAX_DB = 120;

let weightEl: HTMLSelectElement | null = null;
let speedEl: HTMLSelectElement | null = null;
let calEl: HTMLInputElement | null = null;
let startBtn: HTMLButtonElement | null = null;
let statusEl: HTMLElement | null = null;
let nowEl: HTMLElement | null = null;
let unitEl: HTMLElement | null = null;
let bandEl: HTMLElement | null = null;
let minEl: HTMLElement | null = null;
let maxEl: HTMLElement | null = null;
let avgEl: HTMLElement | null = null;
let timeEl: HTMLElement | null = null;
let meterFill: HTMLElement | null = null;
let graphEl: HTMLCanvasElement | null = null;

let audio: AudioContext | null = null;
let stream: MediaStream | null = null;
let nodes: AudioNode[] = [];
let analyser: AnalyserNode | null = null;
let samples: Float32Array<ArrayBuffer> | null = null;
let weighted = 0;
/** False until the first frame, so a real 0 (digital silence) is still time-weighted. */
let primed = false;
/** Stats skip the first moments after (re)wiring: an empty analyser window and settling filters would set a false Min. */
const WARMUP_MS = 500;
let warmUntil = 0;
let stats = new LevelStats();
let history: Array<{ at: number; db: number }> = [];
let lastFrame = 0;
let lastText = 0;
let frame = 0;
let run = 0;
let asking = false;
let lineColor = "#a13f6c";

export function mountDecibelMeter(host: HTMLElement): void {
  weightEl = h("select", { "data-field": "weighting", onChange: () => {
    updateUnit();
    // A- and Z-weighted energy must not mix in one Leq.
    resetStats();
    if (stream) rewire();
  } },
    ...WEIGHTINGS.map((w, i) => h("option", { value: w, selected: i === 0 }, t(`decibelMeter.weight_${w}`))),
  );
  speedEl = h("select", { "data-field": "speed" },
    ...(Object.keys(TIME_WEIGHTS) as TimeWeight[]).map((w, i) => h("option", { value: w, selected: i === 0 }, t(`decibelMeter.speed_${w}`))),
  );
  calEl = h("input", { type: "number", min: String(CALIBRATION_MIN), max: String(CALIBRATION_MAX), step: "0.5", value: "0", inputmode: "decimal", "data-field": "calibration", onChange: () => saveCalibration() });
  startBtn = h("button", { type: "button", class: "btn", "data-action": "start", onClick: () => (stream || asking ? stop() : void start()) }, t("decibelMeter.start"));
  statusEl = h("p", { class: "hint", "aria-live": "polite", "data-out": "status" }, t("decibelMeter.idle"));
  nowEl = h("span", { "data-out": "level" }, "—");
  unitEl = h("span", { class: "db-unit" }, "dB(A)");
  bandEl = h("p", { class: "db-band", "aria-live": "polite", "data-out": "band" });
  minEl = h("dd", { "data-out": "min" }, "—");
  maxEl = h("dd", { "data-out": "max" }, "—");
  avgEl = h("dd", { "data-out": "leq" }, "—");
  timeEl = h("dd", { "data-out": "time" }, "—");
  meterFill = h("span", { class: "mic-fill" });
  graphEl = h("canvas", { class: "audio-wave db-graph", width: 640, height: 160, "aria-hidden": "true" });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("decibelMeter.back")),
      h("h1", null, t("decibelMeter.title")),
      h("p", { class: "lede" }, t("decibelMeter.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("decibelMeter.options")),
          h("label", { class: "field" }, h("span", null, t("decibelMeter.weighting")), weightEl),
          h("label", { class: "field" }, h("span", null, t("decibelMeter.speed")), speedEl),
          h("label", { class: "field" }, h("span", null, t("decibelMeter.calibration")), calEl),
          h("p", { class: "hint" }, t("decibelMeter.calibrationHint")),
        ),
        h("div", { class: "stage-actions" },
          startBtn,
          h("button", { type: "button", class: "btn ghost", "data-action": "reset", onClick: () => resetStats() }, t("decibelMeter.reset")),
        ),
        statusEl,
      ),
      h("div", { class: "rail" },
        h("p", { class: "db-now" }, nowEl, " ", unitEl),
        bandEl,
        h("div", { class: "mic-meter", role: "meter", "aria-label": t("decibelMeter.level"), "aria-valuemin": String(GRAPH_MIN_DB), "aria-valuemax": String(GRAPH_MAX_DB), "aria-valuenow": String(GRAPH_MIN_DB) }, meterFill),
        h("dl", { class: "stats-grid" },
          h("dt", null, t("decibelMeter.min")), minEl,
          h("dt", null, t("decibelMeter.max")), maxEl,
          h("dt", null, t("decibelMeter.leq")), avgEl,
          h("dt", null, t("decibelMeter.duration")), timeEl,
        ),
        graphEl,
        h("h2", { class: "db-examples-title" }, t("decibelMeter.examples")),
        h("dl", { class: "stats-grid db-examples" },
          ...EXAMPLES.flatMap((e) => [h("dt", null, t(`decibelMeter.ex_${e.id}`)), h("dd", null, `${e.db} dB`)]),
        ),
        h("p", { class: "hint" }, t("decibelMeter.hint")),
      ),
    ),
  );
  calEl.value = String(loadCalibration());
  updateUnit();
}

export function unmountDecibelMeter(): void {
  stop();
  if (audio) void audio.close().catch(() => undefined);
  audio = null;
  weightEl = speedEl = null;
  calEl = null;
  startBtn = null;
  statusEl = nowEl = unitEl = bandEl = minEl = maxEl = avgEl = timeEl = meterFill = null;
  graphEl = null;
}

function loadCalibration(): number {
  try {
    return clampCalibration(Number(localStorage.getItem(CAL_KEY) ?? 0));
  } catch {
    return 0;
  }
}

function saveCalibration(): void {
  const v = clampCalibration(Number(calEl?.value));
  if (calEl) calEl.value = String(v);
  try {
    if (v) localStorage.setItem(CAL_KEY, String(v));
    else localStorage.removeItem(CAL_KEY);
  } catch {
    // Private mode: the offset lasts for this visit only.
  }
}

function calibration(): number {
  return clampCalibration(Number(calEl?.value));
}

function weighting(): Weighting {
  return weightEl?.value === "z" ? "z" : "a";
}

function speed(): TimeWeight {
  return speedEl?.value === "slow" ? "slow" : "fast";
}

function updateUnit(): void {
  if (unitEl) unitEl.textContent = weighting() === "a" ? "dB(A)" : "dB(Z)";
}

function say(key: string): void {
  if (statusEl) statusEl.textContent = t(`decibelMeter.${key}`);
}

async function start(): Promise<void> {
  stop();
  const mine = ++run;
  if (!navigator.mediaDevices?.getUserMedia) {
    say(window.isSecureContext === false ? "insecure" : "unsupported");
    return;
  }
  audio = armAudio(audio);
  if (!audio) {
    say("unsupported");
    return;
  }
  say("asking");
  if (startBtn) startBtn.textContent = t("decibelMeter.stop");
  asking = true;
  let s: MediaStream;
  try {
    // Raw input: echo cancellation, noise suppression and auto gain would change the level being measured.
    s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
  } catch (err) {
    if (mine !== run) return;
    asking = false;
    if (startBtn) startBtn.textContent = t("decibelMeter.start");
    const name = (err as { name?: string })?.name;
    say(name === "NotAllowedError" || name === "SecurityError" ? "denied" : name === "NotFoundError" || name === "OverconstrainedError" ? "notFound" : name === "NotReadableError" ? "busy" : "failed");
    return;
  }
  if (mine !== run || !audio) {
    s.getTracks().forEach((tr) => tr.stop());
    return;
  }
  asking = false;
  stream = s;
  if (!buildGraph(audio, s)) {
    // Firefox throws when the microphone's sample rate differs from the AudioContext's: retry at the microphone's rate.
    const rate = s.getAudioTracks()[0]?.getSettings().sampleRate;
    void audio.close().catch(() => undefined);
    audio = newAudioContext(rate ? { sampleRate: rate } : undefined);
    if (!audio || !buildGraph(audio, s)) {
      stop();
      say("failed");
      return;
    }
  }
  const style = graphEl ? getComputedStyle(graphEl) : null;
  lineColor = style?.getPropertyValue("--pink-deep").trim() || "#a13f6c";
  weighted = 0;
  primed = false;
  lastFrame = performance.now();
  warmUntil = lastFrame + WARMUP_MS;
  lastText = 0;
  if (startBtn) startBtn.textContent = t("decibelMeter.stop");
  say(weighting() === "a" && nodes.length < 4 ? "noWeighting" : "listening");
  s.getAudioTracks()[0]?.addEventListener("ended", () => {
    if (stream === s) {
      stop();
      say("ended");
    }
  });
  frame = window.requestAnimationFrame(draw);
}

/** Microphone → (A-weighting biquads) → analyser → silent gain → output. */
function buildGraph(ctx: AudioContext, s: MediaStream): boolean {
  const chain: AudioNode[] = [];
  try {
    const source = ctx.createMediaStreamSource(s);
    chain.push(source);
    // Very old WebKit lacks float samples; the meter needs them, so it reports the browser as unsupported.
    if (typeof AnalyserNode.prototype.getFloatTimeDomainData !== "function") throw new Error("no float samples");
    if (weighting() === "a" && typeof ctx.createIIRFilter === "function") {
      for (const { b, a } of aWeighting(ctx.sampleRate)) chain.push(ctx.createIIRFilter(b, a));
    }
    analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    samples = new Float32Array(analyser.fftSize);
    // Some WebKit builds only run nodes the destination pulls on: route the analyser there through a silent gain.
    const sink = ctx.createGain();
    sink.gain.value = 0;
    chain.push(analyser, sink);
    for (let i = 1; i < chain.length; i++) chain[i - 1].connect(chain[i]);
    sink.connect(ctx.destination);
    nodes = chain;
    return true;
  } catch {
    // Disconnect whatever was linked before the failure, so no orphan source keeps running.
    for (const n of chain) n.disconnect();
    nodes = [];
    analyser = null;
    return false;
  }
}

/** Weighting changed while measuring: rebuild the filters on the same microphone stream (no new permission prompt). */
function rewire(): void {
  if (!audio || !stream) return;
  for (const n of nodes) n.disconnect();
  nodes = [];
  if (!buildGraph(audio, stream)) {
    stop();
    say("failed");
    return;
  }
  weighted = 0;
  primed = false;
  warmUntil = performance.now() + WARMUP_MS;
  say(weighting() === "a" && nodes.length < 4 ? "noWeighting" : "listening");
}

function stop(): void {
  run++;
  asking = false;
  window.cancelAnimationFrame(frame);
  for (const n of nodes) n.disconnect();
  nodes = [];
  analyser = null;
  samples = null;
  stream?.getTracks().forEach((tr) => tr.stop());
  stream = null;
  if (startBtn) startBtn.textContent = t("decibelMeter.start");
  if (nowEl) nowEl.textContent = "—";
  if (bandEl) bandEl.textContent = "";
  if (meterFill) {
    meterFill.style.width = "0%";
    meterFill.classList.remove("hot");
  }
  say("idle");
}

function resetStats(): void {
  stats = new LevelStats();
  history = [];
  for (const el of [minEl, maxEl, avgEl, timeEl]) if (el) el.textContent = "—";
  graphEl?.getContext("2d")?.clearRect(0, 0, graphEl.width, graphEl.height);
}

function draw(now: number): void {
  if (!analyser || !samples) return;
  analyser.getFloatTimeDomainData(samples);
  const level = rms(samples);
  const ms = level * level;
  const dt = Math.min(0.5, Math.max(0, (now - lastFrame) / 1000));
  lastFrame = now;
  weighted = primed ? timeWeight(weighted, ms, dt, TIME_WEIGHTS[speed()]) : ms;
  primed = true;
  const cal = calibration();
  const dbfs = powerToDbfs(weighted);
  const db = toDb(dbfs, cal);
  if (now >= warmUntil) stats.add(ms, dbfs, dt);
  history.push({ at: now, db });
  while (history.length && history[0].at < now - HISTORY_S * 1000) history.shift();
  if (meterFill) {
    const pct = Math.round(Math.max(0, Math.min(1, (db - GRAPH_MIN_DB) / (GRAPH_MAX_DB - GRAPH_MIN_DB))) * 100);
    meterFill.style.width = `${pct}%`;
    meterFill.classList.toggle("hot", db >= 85);
  }
  // Numbers change four times a second, which is readable; the bar and graph move every frame.
  if (now - lastText >= 250) {
    lastText = now;
    if (nowEl) nowEl.textContent = dbText(db);
    meterFill?.parentElement?.setAttribute("aria-valuenow", dbText(Math.max(GRAPH_MIN_DB, Math.min(GRAPH_MAX_DB, db))));
    if (bandEl) bandEl.textContent = t(`decibelMeter.band_${bandOf(db)}`);
    // Still warming up: nothing measured yet.
    if (minEl && Number.isFinite(stats.min)) minEl.textContent = `${dbText(toDb(stats.min, cal))} dB`;
    if (maxEl && Number.isFinite(stats.max)) maxEl.textContent = `${dbText(toDb(stats.max, cal))} dB`;
    const leq = stats.leqDbfs();
    if (avgEl && leq !== null) avgEl.textContent = `${dbText(toDb(leq, cal))} dB`;
    if (timeEl) timeEl.textContent = clockText(stats.seconds() * 1000);
  }
  drawGraph(now);
  frame = window.requestAnimationFrame(draw);
}

function drawGraph(now: number): void {
  const c = graphEl;
  const g = c?.getContext("2d");
  if (!c || !g) return;
  g.clearRect(0, 0, c.width, c.height);
  const y = (db: number) => c.height - ((Math.max(GRAPH_MIN_DB, Math.min(GRAPH_MAX_DB, db)) - GRAPH_MIN_DB) / (GRAPH_MAX_DB - GRAPH_MIN_DB)) * c.height;
  // 85 dB guide line: long exposure above it can harm hearing.
  g.strokeStyle = "#e3b7c9";
  g.lineWidth = 1;
  g.setLineDash([4, 4]);
  g.beginPath();
  g.moveTo(0, y(85));
  g.lineTo(c.width, y(85));
  g.stroke();
  g.setLineDash([]);
  g.strokeStyle = lineColor;
  g.lineWidth = 2;
  g.beginPath();
  history.forEach((p, i) => {
    const x = c.width - ((now - p.at) / (HISTORY_S * 1000)) * c.width;
    if (i === 0) g.moveTo(x, y(p.db));
    else g.lineTo(x, y(p.db));
  });
  g.stroke();
}
