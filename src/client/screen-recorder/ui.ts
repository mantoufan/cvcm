import { downloadBlob, h } from "../dom";
import { setLeaveGuard } from "../leave-guard";
import { fixInfiniteDuration } from "../media-duration";
import { locale, t } from "../i18n";
import { newAudioContext, resumeIfPaused } from "../audio";
import { appHref } from "../../shared/path";
import { MAX_SCREEN_MINUTES, VIDEO_MP4_TYPES, VIDEO_WEBM_TYPES, clockText, elapsedMs, extensionFor, pickType, recordingName, sizeText } from "../../shared/recorder";

const FORMATS = ["auto", "webm"] as const;
type Format = (typeof FORMATS)[number];
const QUALITIES = { standard: 4_000_000, high: 8_000_000 } as const;
type Quality = keyof typeof QUALITIES;

let formatEl: HTMLSelectElement | null = null;
let qualityEl: HTMLSelectElement | null = null;
let systemEl: HTMLInputElement | null = null;
let micEl: HTMLInputElement | null = null;
let startBtn: HTMLButtonElement | null = null;
let pauseBtn: HTMLButtonElement | null = null;
let timeEl: HTMLElement | null = null;
let statusEl: HTMLElement | null = null;
let resultEl: HTMLElement | null = null;

let display: MediaStream | null = null;
let mic: MediaStream | null = null;
let mixCtx: AudioContext | null = null;
let recorder: MediaRecorder | null = null;
let chunks: Blob[] = [];
let banked = 0;
let startedAt: number | null = null;
let timer = 0;
let run = 0;
let busy = false;
let lastUrl = "";
let unsaved = false;
let hitLimit = false;

export function mountScreenRecorder(host: HTMLElement): void {
  formatEl = h("select", { "data-field": "format" },
    ...FORMATS.map((f, i) => h("option", { value: f, selected: i === 0 }, t(`screenRecorder.format_${f}`))),
  );
  qualityEl = h("select", { "data-field": "quality" },
    ...(Object.keys(QUALITIES) as Quality[]).map((q, i) => h("option", { value: q, selected: i === 0 }, t(`screenRecorder.quality_${q}`))),
  );
  systemEl = h("input", { type: "checkbox", checked: true, "data-field": "system-audio" });
  micEl = h("input", { type: "checkbox", "data-field": "mic" });
  startBtn = h("button", { type: "button", class: "btn", "data-action": "start", onClick: () => (recorder ? finish() : void begin()) }, t("screenRecorder.start"));
  pauseBtn = h("button", { type: "button", class: "btn ghost", "data-action": "pause", disabled: true, onClick: () => togglePause() }, t("screenRecorder.pause"));
  timeEl = h("p", { class: "rec-time", "data-out": "time" }, "0:00");
  statusEl = h("p", { class: "hint", "aria-live": "polite", "data-out": "status" }, t("screenRecorder.idle"));
  resultEl = h("div", { class: "rec-result", "data-out": "result", hidden: true });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("screenRecorder.back")),
      h("h1", null, t("screenRecorder.title")),
      h("p", { class: "lede" }, t("screenRecorder.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("screenRecorder.options")),
          h("label", { class: "field" }, h("span", null, t("screenRecorder.format")), formatEl),
          h("label", { class: "field" }, h("span", null, t("screenRecorder.quality")), qualityEl),
          h("label", { class: "check" }, systemEl, h("span", null, t("screenRecorder.systemAudio"))),
          h("label", { class: "check" }, micEl, h("span", null, t("screenRecorder.mic"))),
        ),
        h("div", { class: "stage-actions" }, startBtn, pauseBtn),
        statusEl,
        h("p", { class: "hint" }, t("screenRecorder.hint", { n: MAX_SCREEN_MINUTES })),
      ),
      h("div", { class: "rail" },
        timeEl,
        resultEl,
        h("p", { class: "hint", "data-out": "support" }, t("screenRecorder.support")),
      ),
    ),
  );
  window.addEventListener("beforeunload", onLeave);
  setLeaveGuard(() => recorder !== null || busy || unsaved);
}

export function unmountScreenRecorder(): void {
  window.removeEventListener("beforeunload", onLeave);
  setLeaveGuard(null);
  run++;
  if (recorder && recorder.state !== "inactive") {
    recorder.onstop = null;
    recorder.stop();
  }
  recorder = null;
  release();
  if (lastUrl) URL.revokeObjectURL(lastUrl);
  lastUrl = "";
  unsaved = false;
  formatEl = qualityEl = null;
  systemEl = micEl = null;
  startBtn = pauseBtn = null;
  timeEl = statusEl = resultEl = null;
}

function canCapture(): boolean {
  return typeof navigator.mediaDevices?.getDisplayMedia === "function" && typeof MediaRecorder !== "undefined";
}

function onLeave(e: BeforeUnloadEvent): void {
  if (recorder || unsaved) {
    e.preventDefault();
    e.returnValue = "";
  }
}

function say(key: string, vars?: Record<string, string | number>): void {
  if (statusEl) statusEl.textContent = t(`screenRecorder.${key}`, vars);
}

function chosenType(): string {
  const f = (formatEl?.value ?? "auto") as Format;
  const ok = (x: string) => MediaRecorder.isTypeSupported(x);
  if (f === "webm") return pickType(VIDEO_WEBM_TYPES, ok) || pickType(VIDEO_MP4_TYPES, ok);
  // Auto tries MP4 first; a browser without an MP4 writer falls back to WebM.
  return pickType(VIDEO_MP4_TYPES, ok) || pickType(VIDEO_WEBM_TYPES, ok);
}

async function begin(): Promise<void> {
  if (busy) return;
  // A finished recording that was not downloaded would be replaced: ask for Download or Discard first.
  if (unsaved) {
    say("saveFirst");
    return;
  }
  const mine = ++run;
  if (!canCapture()) {
    say(window.isSecureContext === false ? "insecure" : "noCapture");
    return;
  }
  busy = true;
  say("choose");
  const wantSystem = systemEl?.checked ?? true;
  const wantMic = micEl?.checked ?? false;
  // The mixer's AudioContext is made inside the click: one created after the share dialog may start suspended and record silence.
  if (wantMic) mixCtx = newAudioContext();
  let screen: MediaStream;
  try {
    // getDisplayMedia must be the first await after the click, or Safari drops the user gesture.
    screen = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 30, max: 60 } }, audio: wantSystem });
  } catch (err) {
    busy = false;
    if (mine !== run) return;
    release();
    const name = (err as { name?: string })?.name;
    say(name === "NotAllowedError" ? "cancelled" : name === "NotReadableError" ? "busy" : "failed");
    return;
  }
  if (mine !== run) {
    screen.getTracks().forEach((tr) => tr.stop());
    busy = false;
    return;
  }
  display = screen;
  if (wantMic && navigator.mediaDevices.getUserMedia) {
    try {
      mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      mic = null;
    }
  }
  if (mine !== run) {
    release();
    busy = false;
    return;
  }
  const tracks: MediaStreamTrack[] = [...screen.getVideoTracks()];
  const audioTracks = [...screen.getAudioTracks(), ...(mic?.getAudioTracks() ?? [])];
  if (audioTracks.length > 1) {
    // MediaRecorder records only one audio track, so the tab/system sound and the microphone are mixed first.
    const mixed = mixAudio([screen, mic!]);
    if (mixed) tracks.push(mixed);
    else tracks.push(audioTracks[0]);
  } else if (audioTracks.length) tracks.push(audioTracks[0]);
  const stream = new MediaStream(tracks);
  const type = chosenType();
  const bits = QUALITIES[(qualityEl?.value as Quality) in QUALITIES ? (qualityEl!.value as Quality) : "standard"];
  let rec: MediaRecorder;
  try {
    rec = new MediaRecorder(stream, { ...(type ? { mimeType: type } : {}), videoBitsPerSecond: bits, audioBitsPerSecond: 128_000 });
  } catch {
    release();
    busy = false;
    say("failed");
    return;
  }
  chunks = [];
  rec.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  rec.onstop = () => saveRecording(rec, mine);
  try {
    rec.start(1000);
  } catch {
    release();
    busy = false;
    say("failed");
    return;
  }
  busy = false;
  recorder = rec;
  banked = 0;
  startedAt = performance.now();
  // The browser's own "Stop sharing" button ends the video track.
  screen.getVideoTracks()[0]?.addEventListener("ended", () => {
    if (recorder === rec) finish();
  });
  if (startBtn) startBtn.textContent = t("screenRecorder.stop");
  if (pauseBtn) {
    pauseBtn.disabled = typeof rec.pause !== "function";
    pauseBtn.textContent = t("screenRecorder.pause");
  }
  // Recording goes on without the missing sound; the status says what is not in it.
  say(wantMic && !mic ? "micDenied" : wantSystem && !screen.getAudioTracks().length ? "noSystemAudio" : "recording");
  window.clearInterval(timer);
  timer = window.setInterval(tickTime, 250);
  tickTime();
}

function mixAudio(streams: MediaStream[]): MediaStreamTrack | null {
  if (!mixCtx) return null;
  resumeIfPaused(mixCtx);
  try {
    const dest = mixCtx.createMediaStreamDestination();
    for (const s of streams) if (s.getAudioTracks().length) mixCtx.createMediaStreamSource(s).connect(dest);
    return dest.stream.getAudioTracks()[0] ?? null;
  } catch {
    return null;
  }
}

function tickTime(): void {
  const ms = elapsedMs(banked, startedAt, performance.now());
  if (timeEl) timeEl.textContent = clockText(ms);
  if (recorder && ms >= MAX_SCREEN_MINUTES * 60_000) {
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
      if (pauseBtn) pauseBtn.textContent = t("screenRecorder.resume");
      say("paused");
    } else if (recorder.state === "paused") {
      recorder.resume();
      startedAt = performance.now();
      if (pauseBtn) pauseBtn.textContent = t("screenRecorder.pause");
      say("recording");
    }
  } catch {
    say("failed");
  }
  tickTime();
}

function finish(): void {
  if (!recorder) return;
  banked = elapsedMs(banked, startedAt, performance.now());
  startedAt = null;
  window.clearInterval(timer);
  say("saving");
  if (recorder.state !== "inactive") recorder.stop();
  else saveRecording(recorder, run);
}

function saveRecording(rec: MediaRecorder, mine: number): void {
  if (recorder !== rec) return;
  recorder = null;
  const ms = banked;
  release();
  if (startBtn) startBtn.textContent = t("screenRecorder.start");
  if (pauseBtn) {
    pauseBtn.disabled = true;
    pauseBtn.textContent = t("screenRecorder.pause");
  }
  if (mine !== run) return;
  if (!chunks.length) {
    say("emptyTake");
    return;
  }
  const type = rec.mimeType || chunks[0].type || "video/webm";
  const blob = new Blob(chunks, { type });
  chunks = [];
  const name = recordingName("screen-recording", new Date(), extensionFor(type));
  if (lastUrl) URL.revokeObjectURL(lastUrl);
  lastUrl = URL.createObjectURL(blob);
  unsaved = true;
  showResult(blob, name, ms);
  if (hitLimit) say("limit", { n: MAX_SCREEN_MINUTES });
  else say("saved", { time: clockText(ms) });
  hitLimit = false;
}

function showResult(blob: Blob, name: string, ms: number): void {
  if (!resultEl) return;
  const video = h("video", { controls: true, playsinline: true, preload: "metadata", src: lastUrl, class: "rec-video" });
  fixInfiniteDuration(video);
  resultEl.replaceChildren(
    video,
    h("p", { class: "rec-meta" }, h("strong", null, name), ` · ${clockText(ms)} · ${sizeText(blob.size)}`),
    h("div", { class: "stage-actions" },
      h("button", { type: "button", class: "btn", "data-action": "download", onClick: () => { unsaved = false; downloadBlob(blob, name); } }, t("screenRecorder.download", { ext: name.split(".").pop()!.toUpperCase() })),
      h("button", { type: "button", class: "btn ghost", "data-action": "discard", onClick: () => discard() }, t("screenRecorder.discard")),
    ),
  );
  resultEl.hidden = false;
}

function discard(): void {
  if (lastUrl) URL.revokeObjectURL(lastUrl);
  lastUrl = "";
  unsaved = false;
  if (resultEl) {
    resultEl.replaceChildren();
    resultEl.hidden = true;
  }
  if (timeEl) timeEl.textContent = "0:00";
  say("idle");
}

function release(): void {
  window.clearInterval(timer);
  display?.getTracks().forEach((tr) => tr.stop());
  mic?.getTracks().forEach((tr) => tr.stop());
  display = null;
  mic = null;
  if (mixCtx) void mixCtx.close().catch(() => undefined);
  mixCtx = null;
}
