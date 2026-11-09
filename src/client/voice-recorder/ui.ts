import { armAudio } from "../audio";
import { downloadBlob, h } from "../dom";
import { setLeaveGuard } from "../leave-guard";
import { fixInfiniteDuration } from "../media-duration";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { formatBytes } from "../../shared/resize";
import { encodeWav } from "../../shared/wav";
import { rms, toDbfs, meterPercent } from "../../shared/mic";
import { AUDIO_TYPES, MAX_VOICE_MINUTES, clockText, elapsedMs, extensionFor, pickType, recordingName } from "../../shared/recorder";

/** Downloaded takes beyond this many drop off the list, oldest first; a take not yet downloaded is never dropped. */
const MAX_TAKES = 20;
/** About 1 GB of float samples at 48 kHz stereo is the most we decode for a WAV. */
const MAX_WAV_MINUTES = 30;

type Take = { id: number; blob: Blob; url: string; ms: number; at: Date; name: string; saved: boolean };

let deviceEl: HTMLSelectElement | null = null;
let cleanEl: HTMLInputElement | null = null;
let recordBtn: HTMLButtonElement | null = null;
let pauseBtn: HTMLButtonElement | null = null;
let timeEl: HTMLElement | null = null;
let statusEl: HTMLElement | null = null;
let meterFill: HTMLElement | null = null;
let listEl: HTMLElement | null = null;

let audio: AudioContext | null = null;
let stream: MediaStream | null = null;
let source: MediaStreamAudioSourceNode | null = null;
let analyser: AnalyserNode | null = null;
let sink: GainNode | null = null;
let samples: Float32Array<ArrayBuffer> | null = null;
let recorder: MediaRecorder | null = null;
let chunks: Blob[] = [];
let banked = 0;
let startedAt: number | null = null;
let frame = 0;
let timer = 0;
let run = 0;
let asking = false;
let takes: Take[] = [];
let nextId = 1;
/** The take was stopped by the length limit, so the status says that rather than a plain "saved". */
let hitLimit = false;

export function mountVoiceRecorder(host: HTMLElement): void {
  deviceEl = h("select", { "data-field": "device", disabled: true },
    h("option", { value: "" }, t("voiceRecorder.defaultDevice")),
  );
  cleanEl = h("input", { type: "checkbox", checked: true, "data-field": "clean" });
  recordBtn = h("button", { type: "button", class: "btn", "data-action": "record", onClick: () => (recorder || asking ? finish() : void begin()) }, t("voiceRecorder.record"));
  pauseBtn = h("button", { type: "button", class: "btn ghost", "data-action": "pause", disabled: true, onClick: () => togglePause() }, t("voiceRecorder.pause"));
  timeEl = h("p", { class: "rec-time", "data-out": "time" }, "0:00");
  statusEl = h("p", { class: "hint", "aria-live": "polite", "data-out": "status" }, t("voiceRecorder.idle"));
  meterFill = h("span", { class: "mic-fill" });
  listEl = h("ol", { class: "rec-list", "data-out": "takes" });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("voiceRecorder.back")),
      h("h1", null, t("voiceRecorder.title")),
      h("p", { class: "lede" }, t("voiceRecorder.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("voiceRecorder.options")),
          h("label", { class: "field" }, h("span", null, t("voiceRecorder.device")), deviceEl),
          h("label", { class: "check" }, cleanEl, h("span", null, t("voiceRecorder.clean"))),
        ),
        h("div", { class: "stage-actions" }, recordBtn, pauseBtn),
        statusEl,
        h("p", { class: "hint" }, t("voiceRecorder.hint", { n: MAX_VOICE_MINUTES })),
      ),
      h("div", { class: "rail" },
        timeEl,
        h("div", { class: "mic-meter", role: "meter", "aria-label": t("voiceRecorder.level"), "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": "0" }, meterFill),
        h("h2", { class: "rec-title" }, t("voiceRecorder.recordings")),
        listEl,
        h("p", { class: "hint", "data-out": "empty" }, t("voiceRecorder.empty")),
      ),
    ),
  );
  window.addEventListener("beforeunload", onLeave);
  setLeaveGuard(hasUnsaved);
}

export function unmountVoiceRecorder(): void {
  window.removeEventListener("beforeunload", onLeave);
  setLeaveGuard(null);
  run++;
  if (recorder && recorder.state !== "inactive") {
    recorder.onstop = null;
    recorder.stop();
  }
  recorder = null;
  release();
  if (audio) void audio.close().catch(() => undefined);
  audio = null;
  for (const take of takes) URL.revokeObjectURL(take.url);
  takes = [];
  deviceEl = null;
  cleanEl = null;
  recordBtn = pauseBtn = null;
  timeEl = statusEl = meterFill = listEl = null;
}

/** Ask before leaving with a recording running or one not yet downloaded: recordings live only in this tab. */
function hasUnsaved(): boolean {
  return recorder !== null || asking || takes.some((tk) => !tk.saved);
}

function onLeave(e: BeforeUnloadEvent): void {
  if (hasUnsaved()) {
    e.preventDefault();
    e.returnValue = "";
  }
}

function say(key: string, vars?: Record<string, string | number>): void {
  if (statusEl) statusEl.textContent = t(`voiceRecorder.${key}`, vars);
}

async function begin(): Promise<void> {
  const mine = ++run;
  if (!navigator.mediaDevices?.getUserMedia) {
    say(window.isSecureContext === false ? "insecure" : "unsupported");
    return;
  }
  if (typeof MediaRecorder === "undefined") {
    say("unsupported");
    return;
  }
  // The meter's AudioContext is created inside the click, as iOS requires.
  audio = armAudio(audio);
  say("asking");
  if (recordBtn) recordBtn.textContent = t("voiceRecorder.stopRecording");
  asking = true;
  const clean = cleanEl?.checked ?? true;
  const id = deviceEl?.value;
  let s: MediaStream;
  try {
    s = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: id ? { exact: id } : undefined, echoCancellation: clean, noiseSuppression: clean, autoGainControl: clean } });
  } catch (err) {
    if (mine !== run) return;
    asking = false;
    if (recordBtn) recordBtn.textContent = t("voiceRecorder.record");
    const name = (err as { name?: string })?.name;
    if (id && (name === "NotFoundError" || name === "OverconstrainedError") && deviceEl) {
      // The chosen microphone is gone: fall back to the default one.
      deviceEl.replaceChildren(h("option", { value: "" }, t("voiceRecorder.defaultDevice")));
      deviceEl.disabled = true;
      void begin();
      return;
    }
    say(name === "NotAllowedError" || name === "SecurityError" ? "denied" : name === "NotFoundError" || name === "OverconstrainedError" ? "notFound" : name === "NotReadableError" ? "busy" : "failed");
    return;
  }
  if (mine !== run) {
    s.getTracks().forEach((tr) => tr.stop());
    return;
  }
  asking = false;
  stream = s;
  const type = pickType(AUDIO_TYPES, (x) => MediaRecorder.isTypeSupported(x));
  let rec: MediaRecorder;
  try {
    rec = new MediaRecorder(s, type ? { mimeType: type, audioBitsPerSecond: 128_000 } : undefined);
  } catch {
    release();
    if (recordBtn) recordBtn.textContent = t("voiceRecorder.record");
    say("failed");
    return;
  }
  chunks = [];
  rec.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  rec.onstop = () => saveTake(rec, mine);
  try {
    // One-second slices, so a crash or a long take does not hold everything in one buffer.
    rec.start(1000);
  } catch {
    release();
    if (recordBtn) recordBtn.textContent = t("voiceRecorder.record");
    say("failed");
    return;
  }
  recorder = rec;
  banked = 0;
  startedAt = performance.now();
  attachMeter(s);
  if (pauseBtn) {
    pauseBtn.disabled = typeof rec.pause !== "function";
    pauseBtn.textContent = t("voiceRecorder.pause");
  }
  say("recording");
  s.getAudioTracks()[0]?.addEventListener("ended", () => {
    if (stream === s) finish();
  });
  window.clearInterval(timer);
  timer = window.setInterval(tickTime, 250);
  tickTime();
  void listDevices(s.getAudioTracks()[0]?.getSettings().deviceId);
}

function attachMeter(s: MediaStream): void {
  if (!audio) return;
  try {
    source = audio.createMediaStreamSource(s);
    analyser = audio.createAnalyser();
    analyser.fftSize = 1024;
    samples = new Float32Array(analyser.fftSize);
    sink = audio.createGain();
    sink.gain.value = 0;
    source.connect(analyser).connect(sink).connect(audio.destination);
    frame = window.requestAnimationFrame(drawMeter);
  } catch {
    // The meter is a nicety; recording works without it (Firefox may refuse a sample-rate mismatch).
    source = null;
    analyser = null;
  }
}

function drawMeter(): void {
  if (!analyser || !samples || !meterFill) return;
  if (typeof analyser.getFloatTimeDomainData === "function") analyser.getFloatTimeDomainData(samples);
  const pct = recorder?.state === "paused" ? 0 : meterPercent(toDbfs(rms(samples)));
  meterFill.style.width = `${pct}%`;
  frame = window.requestAnimationFrame(drawMeter);
}

function tickTime(): void {
  const ms = elapsedMs(banked, startedAt, performance.now());
  if (timeEl) timeEl.textContent = clockText(ms);
  if (recorder && ms >= MAX_VOICE_MINUTES * 60_000) {
    hitLimit = true;
    finish();
  }
}

function togglePause(): void {
  if (!recorder) return;
  try {
    if (recorder.state === "recording") {
      recorder.pause();
      banked = elapsedMs(banked, startedAt, performance.now());
      startedAt = null;
      if (pauseBtn) pauseBtn.textContent = t("voiceRecorder.resume");
      say("paused");
    } else if (recorder.state === "paused") {
      recorder.resume();
      startedAt = performance.now();
      if (pauseBtn) pauseBtn.textContent = t("voiceRecorder.pause");
      say("recording");
    }
  } catch {
    say("failed");
  }
  tickTime();
}

/** Stops recording; the take is added once MediaRecorder hands over the last chunk. */
function finish(): void {
  if (asking && !recorder) {
    // Still waiting for permission: cancel.
    run++;
    asking = false;
    if (recordBtn) recordBtn.textContent = t("voiceRecorder.record");
    say("idle");
    return;
  }
  if (!recorder) return;
  banked = elapsedMs(banked, startedAt, performance.now());
  startedAt = null;
  // A second Stop (state already "inactive") waits for the same onstop, which brings the last chunk.
  if (recorder.state !== "inactive") recorder.stop();
  window.clearInterval(timer);
  say("saving");
}

function saveTake(rec: MediaRecorder, mine: number): void {
  if (recorder !== rec) return;
  recorder = null;
  const ms = banked;
  release();
  if (recordBtn) recordBtn.textContent = t("voiceRecorder.record");
  if (pauseBtn) {
    pauseBtn.disabled = true;
    pauseBtn.textContent = t("voiceRecorder.pause");
  }
  if (mine !== run || !chunks.length) {
    say(chunks.length ? "idle" : "emptyTake");
    return;
  }
  const type = rec.mimeType || chunks[0].type || "audio/webm";
  const blob = new Blob(chunks, { type });
  chunks = [];
  const at = new Date();
  const take: Take = { id: nextId++, blob, url: URL.createObjectURL(blob), ms, at, name: recordingName("recording", at, extensionFor(type)), saved: false };
  takes.unshift(take);
  listEl?.prepend(takeRow(take));
  for (let i = takes.length - 1; i >= 0 && takes.length > MAX_TAKES; i--) {
    if (!takes[i].saved) continue;
    dropRow(takes[i].id);
    URL.revokeObjectURL(takes[i].url);
    takes.splice(i, 1);
  }
  showEmpty();
  if (hitLimit) say("limit", { n: MAX_VOICE_MINUTES });
  else say("saved", { time: clockText(ms) });
  hitLimit = false;
}

/** Stops the microphone and the meter (the recorder must already be stopped). */
function release(): void {
  window.cancelAnimationFrame(frame);
  window.clearInterval(timer);
  source?.disconnect();
  analyser?.disconnect();
  sink?.disconnect();
  source = null;
  analyser = null;
  sink = null;
  samples = null;
  stream?.getTracks().forEach((tr) => tr.stop());
  stream = null;
  if (meterFill) meterFill.style.width = "0%";
}

async function listDevices(currentId: string | undefined): Promise<void> {
  if (!deviceEl || !navigator.mediaDevices?.enumerateDevices) return;
  let inputs: MediaDeviceInfo[];
  try {
    inputs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "audioinput" && d.deviceId);
  } catch {
    return;
  }
  if (!deviceEl || !inputs.length) return;
  deviceEl.replaceChildren(...inputs.map((d, i) => h("option", { value: d.deviceId }, d.label || t("voiceRecorder.unnamed", { n: i + 1 }))));
  if (currentId && inputs.some((d) => d.deviceId === currentId)) deviceEl.value = currentId;
  deviceEl.disabled = inputs.length < 2;
}

/** Rows are added and removed one by one, so a take that is playing keeps playing when another one changes. */
function dropRow(id: number): void {
  listEl?.querySelector(`[data-take="${id}"]`)?.remove();
}

function showEmpty(): void {
  const empty = listEl?.parentElement?.querySelector<HTMLElement>("[data-out=empty]");
  if (empty) empty.hidden = takes.length > 0;
}

function takeRow(take: Take): HTMLElement {
  const player = h("audio", { controls: true, preload: "metadata", src: take.url, class: "rec-player" });
  fixInfiniteDuration(player);
  const wavBtn = h("button", { type: "button", class: "btn ghost", "data-action": "wav" }, t("voiceRecorder.downloadWav"));
  wavBtn.addEventListener("click", () => void downloadWav(take, wavBtn));
  // Decoding a long take to PCM in memory could crash the tab (and every take with it): WAV only up to MAX_WAV_MINUTES.
  wavBtn.hidden = take.ms > MAX_WAV_MINUTES * 60_000;
  return h("li", { class: "rec-item", "data-take": String(take.id) },
    h("p", { class: "rec-meta" }, h("strong", null, take.name), ` · ${clockText(take.ms)} · ${formatBytes(take.blob.size)}`),
    player,
    h("div", { class: "stage-actions" },
      h("button", { type: "button", class: "btn", "data-action": "download", onClick: () => { take.saved = true; downloadBlob(take.blob, take.name); } }, t("voiceRecorder.download", { ext: take.name.split(".").pop()!.toUpperCase() })),
      wavBtn,
      h("button", { type: "button", class: "btn ghost", "data-action": "delete", onClick: () => removeTake(take.id) }, t("voiceRecorder.delete")),
    ),
  );
}

function removeTake(id: number): void {
  const i = takes.findIndex((tk) => tk.id === id);
  if (i < 0) return;
  URL.revokeObjectURL(takes[i].url);
  takes.splice(i, 1);
  dropRow(id);
  showEmpty();
}

/** Decodes the take (at the AudioContext's sample rate) and writes it as 16-bit PCM WAV; mono stays mono. */
async function downloadWav(take: Take, btn: HTMLButtonElement): Promise<void> {
  btn.disabled = true;
  btn.textContent = t("voiceRecorder.converting");
  try {
    const ctx = audio ?? armAudio(null);
    if (!ctx) throw new Error("no audio");
    audio = ctx;
    const decoded = await ctx.decodeAudioData(await take.blob.arrayBuffer());
    const channels = Array.from({ length: decoded.numberOfChannels }, (_, c) => decoded.getChannelData(c));
    const wav = encodeWav(channels, decoded.sampleRate);
    take.saved = true;
    downloadBlob(new Blob([wav.buffer as ArrayBuffer], { type: "audio/wav" }), take.name.replace(/\.[a-z0-9]+$/, ".wav"));
  } catch {
    say("wavFailed");
  }
  btn.disabled = false;
  btn.textContent = t("voiceRecorder.downloadWav");
}
