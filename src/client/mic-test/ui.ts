import { armAudio } from "../audio";
import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { levelVerdict, meterPercent, rms, toDbfs } from "../../shared/mic";

const RECORD_MS = 5000;
/** Peak hold decays this many dB per second so the readout follows the voice. */
const PEAK_FALL_DB = 12;

let deviceEl: HTMLSelectElement | null = null;
let startBtn: HTMLButtonElement | null = null;
let recordBtn: HTMLButtonElement | null = null;
let statusEl: HTMLElement | null = null;
let meterFill: HTMLElement | null = null;
let levelEl: HTMLElement | null = null;
let peakEl: HTMLElement | null = null;
let verdictEl: HTMLElement | null = null;
let infoEl: HTMLElement | null = null;
let waveEl: HTMLCanvasElement | null = null;
let playerEl: HTMLAudioElement | null = null;
let audio: AudioContext | null = null;
let stream: MediaStream | null = null;
let source: MediaStreamAudioSourceNode | null = null;
let analyser: AnalyserNode | null = null;
let samples: Float32Array<ArrayBuffer> | null = null;
let frame = 0;
let peakDb = -Infinity;
let lastFrame = 0;
let recorder: MediaRecorder | null = null;
let recordTimer = 0;
let playbackUrl = "";
/** Bumped on every start/stop, so a slow permission prompt that resolves late is dropped. */
let run = 0;

export function mountMicTest(host: HTMLElement): void {
  deviceEl = h("select", { "data-field": "device", disabled: true, onChange: () => { if (stream) void start(); } },
    h("option", { value: "" }, t("micTest.defaultDevice")),
  );
  startBtn = h("button", { type: "button", class: "btn", "data-action": "start", onClick: () => (stream ? stop() : void start()) }, t("micTest.start"));
  recordBtn = h("button", { type: "button", class: "btn ghost", "data-action": "record", disabled: true, onClick: () => record() }, t("micTest.record", { n: RECORD_MS / 1000 }));
  statusEl = h("p", { class: "hint", "aria-live": "polite", "data-out": "status" }, t("micTest.idle"));
  meterFill = h("span", { class: "mic-fill" });
  levelEl = h("dd", { "data-out": "level" }, "—");
  peakEl = h("dd", { "data-out": "peak" }, "—");
  verdictEl = h("p", { class: "mic-verdict", "aria-live": "polite" });
  infoEl = h("dl", { class: "stats-grid" });
  waveEl = h("canvas", { class: "audio-wave mic-wave", width: 640, height: 120 });
  playerEl = h("audio", { controls: true, class: "mic-player", hidden: true });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("micTest.back")),
      h("h1", null, t("micTest.title")),
      h("p", { class: "lede" }, t("micTest.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("micTest.options")),
          h("label", { class: "field" }, h("span", null, t("micTest.device")), deviceEl),
        ),
        h("div", { class: "stage-actions" }, startBtn, recordBtn),
        statusEl,
        infoEl,
      ),
      h("div", { class: "rail mic-stage" },
        h("div", { class: "mic-meter", role: "meter", "aria-label": t("micTest.level"), "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": "0" }, meterFill),
        h("dl", { class: "stats-grid" },
          h("dt", null, t("micTest.level")), levelEl,
          h("dt", null, t("micTest.peak")), peakEl,
        ),
        verdictEl,
        waveEl,
        playerEl,
        h("p", { class: "hint" }, t("micTest.hint")),
      ),
    ),
  );
}

export function unmountMicTest(): void {
  stop();
  if (audio) void audio.close().catch(() => undefined);
  audio = null;
  if (playbackUrl) URL.revokeObjectURL(playbackUrl);
  playbackUrl = "";
  deviceEl = null;
  startBtn = recordBtn = null;
  statusEl = meterFill = levelEl = peakEl = verdictEl = infoEl = null;
  waveEl = null;
  playerEl = null;
}

function say(key: string, vars?: Record<string, string | number>): void {
  if (statusEl) statusEl.textContent = t(`micTest.${key}`, vars);
}

async function start(): Promise<void> {
  stop();
  const mine = ++run;
  if (!navigator.mediaDevices?.getUserMedia) {
    say(window.isSecureContext === false ? "insecure" : "unsupported");
    return;
  }
  // Create the AudioContext inside the click, as iOS requires.
  audio = armAudio(audio);
  if (!audio) {
    say("unsupported");
    return;
  }
  say("asking");
  const id = deviceEl?.value;
  let s: MediaStream;
  try {
    // Raw input: no echo cancellation, noise suppression or auto gain, so the meter shows what the microphone hears.
    s = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: id ? { exact: id } : undefined, echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
  } catch (err) {
    if (mine !== run) return;
    const name = (err as { name?: string })?.name;
    say(name === "NotAllowedError" || name === "SecurityError" ? "denied" : name === "NotFoundError" || name === "OverconstrainedError" ? "notFound" : name === "NotReadableError" ? "busy" : "failed");
    return;
  }
  if (mine !== run || !audio) {
    s.getTracks().forEach((tr) => tr.stop());
    return;
  }
  stream = s;
  source = audio.createMediaStreamSource(s);
  analyser = audio.createAnalyser();
  analyser.fftSize = 2048;
  samples = new Float32Array(analyser.fftSize);
  source.connect(analyser);
  peakDb = -Infinity;
  lastFrame = performance.now();
  frame = window.requestAnimationFrame(draw);
  if (startBtn) startBtn.textContent = t("micTest.stop");
  if (recordBtn) recordBtn.disabled = typeof MediaRecorder === "undefined";
  say("listening");
  const track = s.getAudioTracks()[0];
  track?.addEventListener("ended", () => {
    if (stream === s) {
      stop();
      say("ended");
    }
  });
  paintInfo(track);
  void listDevices(track?.getSettings().deviceId);
}

function stop(): void {
  run++;
  window.cancelAnimationFrame(frame);
  window.clearTimeout(recordTimer);
  if (recorder && recorder.state !== "inactive") recorder.stop();
  recorder = null;
  source?.disconnect();
  source = null;
  analyser = null;
  samples = null;
  stream?.getTracks().forEach((tr) => tr.stop());
  stream = null;
  if (startBtn) startBtn.textContent = t("micTest.start");
  if (recordBtn) {
    recordBtn.disabled = true;
    recordBtn.textContent = t("micTest.record", { n: RECORD_MS / 1000 });
  }
  if (meterFill) meterFill.style.width = "0%";
  meterFill?.parentElement?.setAttribute("aria-valuenow", "0");
  say("idle");
}

/** Device names are only readable after permission, so the list fills in once the microphone is on. */
async function listDevices(currentId: string | undefined): Promise<void> {
  if (!deviceEl || !navigator.mediaDevices?.enumerateDevices) return;
  let inputs: MediaDeviceInfo[];
  try {
    inputs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "audioinput" && d.deviceId);
  } catch {
    return;
  }
  if (!deviceEl || !inputs.length) return;
  deviceEl.replaceChildren(...inputs.map((d, i) => h("option", { value: d.deviceId }, d.label || t("micTest.unnamed", { n: i + 1 }))));
  if (currentId && inputs.some((d) => d.deviceId === currentId)) deviceEl.value = currentId;
  deviceEl.disabled = inputs.length < 2;
}

function paintInfo(track: MediaStreamTrack | undefined): void {
  if (!infoEl) return;
  const set = track?.getSettings() ?? {};
  const rows: Array<[string, string]> = [[t("micTest.name"), track?.label || "—"]];
  const rate = set.sampleRate ?? audio?.sampleRate;
  if (rate) rows.push([t("micTest.sampleRate"), `${rate} Hz`]);
  if (set.channelCount) rows.push([t("micTest.channels"), String(set.channelCount)]);
  infoEl.replaceChildren(...rows.flatMap(([k, v]) => [h("dt", null, k), h("dd", null, v)]));
}

function draw(now: number): void {
  if (!analyser || !samples) return;
  analyser.getFloatTimeDomainData(samples);
  let peak = 0;
  for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i]));
  const level = toDbfs(rms(samples));
  const framePeak = toDbfs(peak);
  const dt = Math.max(0, (now - lastFrame) / 1000);
  lastFrame = now;
  peakDb = Math.max(framePeak, peakDb - PEAK_FALL_DB * dt);
  const pct = meterPercent(level);
  if (meterFill) {
    meterFill.style.width = `${pct}%`;
    meterFill.classList.toggle("hot", peakDb >= -1);
    meterFill.parentElement?.setAttribute("aria-valuenow", String(pct));
  }
  if (levelEl) levelEl.textContent = `${level.toFixed(0)} dBFS`;
  if (peakEl) peakEl.textContent = `${peakDb.toFixed(0)} dBFS`;
  if (verdictEl) verdictEl.textContent = t(`micTest.verdict_${levelVerdict(peakDb)}`);
  drawWave();
  frame = window.requestAnimationFrame(draw);
}

function drawWave(): void {
  const c = waveEl;
  const ctx = c?.getContext("2d");
  if (!c || !ctx || !samples) return;
  const style = getComputedStyle(c);
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.strokeStyle = style.getPropertyValue("--pink-deep").trim() || "#a13f6c";
  ctx.lineWidth = 2;
  ctx.beginPath();
  const mid = c.height / 2;
  const stepX = c.width / samples.length;
  for (let i = 0; i < samples.length; i++) {
    const y = mid - samples[i] * mid;
    if (i === 0) ctx.moveTo(0, y);
    else ctx.lineTo(i * stepX, y);
  }
  ctx.stroke();
}

function record(): void {
  if (!stream || typeof MediaRecorder === "undefined" || recorder) return;
  let rec: MediaRecorder;
  try {
    rec = new MediaRecorder(stream);
  } catch {
    say("recordFailed");
    return;
  }
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  rec.onstop = () => {
    if (recorder === rec) recorder = null;
    if (recordBtn) {
      recordBtn.textContent = t("micTest.record", { n: RECORD_MS / 1000 });
      recordBtn.disabled = !stream;
    }
    if (!chunks.length || !playerEl) return;
    if (playbackUrl) URL.revokeObjectURL(playbackUrl);
    playbackUrl = URL.createObjectURL(new Blob(chunks, { type: rec.mimeType || chunks[0].type }));
    playerEl.src = playbackUrl;
    playerEl.hidden = false;
    if (stream) say("recorded");
  };
  recorder = rec;
  rec.start();
  if (recordBtn) {
    recordBtn.disabled = true;
    recordBtn.textContent = t("micTest.recording");
  }
  say("recordingStatus", { n: RECORD_MS / 1000 });
  recordTimer = window.setTimeout(() => {
    if (rec.state !== "inactive") rec.stop();
  }, RECORD_MS);
}
