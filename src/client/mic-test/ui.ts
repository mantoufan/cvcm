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
let sink: GainNode | null = null;
let waveColor = "#a13f6c";
let samples: Float32Array<ArrayBuffer> | null = null;
let bytes: Uint8Array<ArrayBuffer> | null = null;
let lastVerdict = "";
let lastPct = -1;
let frame = 0;
let peakDb = -Infinity;
let lastFrame = 0;
let recorder: MediaRecorder | null = null;
let recordTimer = 0;
let playbackUrl = "";
/** Bumped on every start/stop, so a slow permission prompt that resolves late is dropped. */
let run = 0;
/** A permission prompt is open (start() is waiting for getUserMedia). */
let asking = false;

export function mountMicTest(host: HTMLElement): void {
  deviceEl = h("select", { "data-field": "device", disabled: true, onChange: () => { if (stream || asking) void start(); } },
    h("option", { value: "" }, t("micTest.defaultDevice")),
  );
  startBtn = h("button", { type: "button", class: "btn", "data-action": "start", onClick: () => (stream || asking ? stop() : void start()) }, t("micTest.start"));
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
  // While the prompt is open the button cancels, so a second click does not open a second prompt.
  if (startBtn) startBtn.textContent = t("micTest.stop");
  const id = deviceEl?.value;
  let s: MediaStream;
  asking = true;
  try {
    // Raw input: no echo cancellation, noise suppression or auto gain, so the meter shows what the microphone hears.
    s = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: id ? { exact: id } : undefined, echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
  } catch (err) {
    if (mine !== run) return;
    asking = false;
    if (startBtn) startBtn.textContent = t("micTest.start");
    const name = (err as { name?: string })?.name;
    // The saved device is gone (unplugged, or back with a new id): reset the list and open the default microphone.
    if (id && (name === "NotFoundError" || name === "OverconstrainedError") && deviceEl) {
      deviceEl.replaceChildren(h("option", { value: "" }, t("micTest.defaultDevice")));
      deviceEl.disabled = true;
      void start();
      return;
    }
    say(name === "NotAllowedError" || name === "SecurityError" ? "denied" : name === "NotFoundError" || name === "OverconstrainedError" ? "notFound" : name === "NotReadableError" ? "busy" : "failed");
    return;
  }
  if (mine !== run || !audio) {
    s.getTracks().forEach((tr) => tr.stop());
    return;
  }
  asking = false;
  stream = s;
  try {
    source = audio.createMediaStreamSource(s);
    analyser = audio.createAnalyser();
    analyser.fftSize = 2048;
    samples = new Float32Array(analyser.fftSize);
    // Some WebKit builds only run nodes the destination pulls on: route the analyser there through a silent gain.
    sink = audio.createGain();
    sink.gain.value = 0;
    source.connect(analyser).connect(sink).connect(audio.destination);
  } catch {
    // Firefox throws when the microphone's sample rate differs from the AudioContext's.
    stop();
    say("failed");
    return;
  }
  const style = waveEl ? getComputedStyle(waveEl) : null;
  waveColor = style?.getPropertyValue("--pink-deep").trim() || "#a13f6c";
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
  asking = false;
  window.cancelAnimationFrame(frame);
  window.clearTimeout(recordTimer);
  if (recorder && recorder.state !== "inactive") recorder.stop();
  recorder = null;
  source?.disconnect();
  source = null;
  analyser?.disconnect();
  analyser = null;
  sink?.disconnect();
  sink = null;
  samples = null;
  stream?.getTracks().forEach((tr) => tr.stop());
  stream = null;
  if (startBtn) startBtn.textContent = t("micTest.start");
  if (recordBtn) {
    recordBtn.disabled = true;
    recordBtn.textContent = t("micTest.record", { n: RECORD_MS / 1000 });
  }
  if (meterFill) {
    meterFill.style.width = "0%";
    meterFill.classList.remove("hot");
    meterFill.parentElement?.setAttribute("aria-valuenow", "0");
  }
  // Clear the last live readings so a stopped meter does not look live.
  if (levelEl) levelEl.textContent = "—";
  if (peakEl) peakEl.textContent = "—";
  if (verdictEl) verdictEl.textContent = "";
  lastVerdict = "";
  lastPct = -1;
  bytes = null;
  waveEl?.getContext("2d")?.clearRect(0, 0, waveEl.width, waveEl.height);
  infoEl?.replaceChildren();
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
  // Safari before 14.1 has only the byte version.
  if (typeof analyser.getFloatTimeDomainData === "function") analyser.getFloatTimeDomainData(samples);
  else {
    bytes ??= new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(bytes);
    for (let i = 0; i < samples.length; i++) samples[i] = (bytes[i] - 128) / 128;
  }
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
    meterFill.classList.toggle("hot", levelVerdict(peakDb) === "loud");
    // Screen readers hear the meter in steps of 10, not every frame.
    const stepped = Math.round(pct / 10) * 10;
    if (stepped !== lastPct) {
      lastPct = stepped;
      meterFill.parentElement?.setAttribute("aria-valuenow", String(stepped));
    }
  }
  if (levelEl) levelEl.textContent = dbText(level);
  if (peakEl) peakEl.textContent = dbText(peakDb);
  const verdict = levelVerdict(peakDb);
  if (verdictEl && verdict !== lastVerdict) {
    lastVerdict = verdict;
    verdictEl.textContent = t(`micTest.verdict_${verdict}`);
  }
  drawWave();
  frame = window.requestAnimationFrame(draw);
}

/** Whole dB, with −0 shown as 0. */
function dbText(db: number): string {
  return `${Math.round(db) || 0} dBFS`;
}

function drawWave(): void {
  const c = waveEl;
  const ctx = c?.getContext("2d");
  if (!c || !ctx || !samples) return;
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.strokeStyle = waveColor;
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
  const mine = run;
  rec.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  rec.onstop = () => {
    if (recorder === rec) recorder = null;
    // Cut short by Stop or a device change: the microphone (and maybe a new one) has moved on, so drop this clip.
    if (mine !== run) return;
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
  try {
    rec.start();
  } catch {
    say("recordFailed");
    return;
  }
  recorder = rec;
  if (recordBtn) {
    recordBtn.disabled = true;
    recordBtn.textContent = t("micTest.recording");
  }
  say("recordingStatus", { n: RECORD_MS / 1000 });
  recordTimer = window.setTimeout(() => {
    if (rec.state !== "inactive") rec.stop();
  }, RECORD_MS);
}
