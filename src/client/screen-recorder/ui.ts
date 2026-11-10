import { downloadBlob, h } from "../dom";
import { setLeaveGuard, syncLeaveGuard } from "../leave-guard";
import { fixInfiniteDuration } from "../media-duration";
import { locale, t } from "../i18n";
import { newAudioContext, resumeIfPaused } from "../audio";
import { appHref } from "../../shared/path";
import { formatBytes } from "../../shared/resize";
import { MAX_SCREEN_MINUTES, VIDEO_MP4_TYPES, VIDEO_WEBM_TYPES, clockText, extensionFor, pickType, recordingName } from "../../shared/recorder";
import { RecordingTake, errorName, type TakeResult } from "../recording-take";

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
let recorder: RecordingTake | null = null;
let run = 0;
let busy = false;
let lastUrl = "";
let unsaved = false;

export function mountScreenRecorder(host: HTMLElement): void {
  formatEl = h("select", { "data-field": "format" },
    ...FORMATS.map((f, i) => h("option", { value: f, selected: i === 0 }, t(`screenRecorder.format_${f}`))),
  );
  qualityEl = h("select", { "data-field": "quality" },
    ...(Object.keys(QUALITIES) as Quality[]).map((q, i) => h("option", { value: q, selected: i === 0 }, t(`screenRecorder.quality_${q}`))),
  );
  systemEl = h("input", { type: "checkbox", checked: true, "data-field": "system-audio" });
  micEl = h("input", { type: "checkbox", "data-field": "mic" });
  startBtn = h("button", { type: "button", class: "btn", "data-action": "start", onClick: () => (recorder ? finish() : busy ? cancelSetup() : void begin()) }, t("screenRecorder.start"));
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
  setLeaveGuard(hasUnsaved);
}

export function unmountScreenRecorder(): void {
  setLeaveGuard(null);
  run++;
  recorder?.cancel();
  recorder = null;
  busy = false;
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

function hasUnsaved(): boolean {
  return recorder !== null || busy || unsaved;
}


function say(key: string, vars?: Record<string, string | number>): void {
  if (statusEl) statusEl.textContent = t(`screenRecorder.${key}`, vars);
  // Every state change reports a status, so this is where the leave prompt is armed or dropped.
  syncLeaveGuard();
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
  if (startBtn) startBtn.textContent = t("screenRecorder.stop");
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
    // A cancelled run must not touch the state of a newer one.
    if (mine !== run) return;
    setupFailed();
    release();
    const name = errorName(err);
    say(name === "NotAllowedError" ? "cancelled" : name === "NotReadableError" ? "busy" : "failed");
    return;
  }
  if (mine !== run) {
    screen.getTracks().forEach((tr) => tr.stop());
    return;
  }
  display = screen;
  // The browser's own "Stop sharing" ends the video track, possibly while the mic prompt is still open.
  let shareEnded = false;
  let mixFailed = false;
  screen.getVideoTracks()[0]?.addEventListener("ended", () => {
    shareEnded = true;
    if (recorder) finish();
  });
  let micStream: MediaStream | null = null;
  if (wantMic && navigator.mediaDevices.getUserMedia) {
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      micStream = null;
    }
  }
  if (mine !== run) {
    // Cancelled while the mic prompt was open: stop only this run's streams (cancelSetup released the rest).
    screen.getTracks().forEach((tr) => tr.stop());
    micStream?.getTracks().forEach((tr) => tr.stop());
    return;
  }
  mic = micStream;
  // Sharing was stopped while the mic prompt was open: nothing to record.
  if (shareEnded || screen.getVideoTracks()[0]?.readyState === "ended") {
    release();
    setupFailed();
    say("cancelled");
    return;
  }
  const tracks: MediaStreamTrack[] = [...screen.getVideoTracks()];
  const audioTracks = [...screen.getAudioTracks(), ...(mic?.getAudioTracks() ?? [])];
  if (audioTracks.length > 1) {
    // MediaRecorder records only one audio track, so the tab/system sound and the microphone are mixed first.
    const mixed = mixAudio([screen, mic!]);
    if (mixed) tracks.push(mixed);
    else {
      // Mixing failed: keep the shared sound and say the microphone is not in the recording.
      tracks.push(audioTracks[0]);
      mic?.getTracks().forEach((tr) => tr.stop());
      mic = null;
      mixFailed = true;
    }
  } else if (audioTracks.length) tracks.push(audioTracks[0]);
  const stream = new MediaStream(tracks);
  const type = chosenType();
  const bits = QUALITIES[(qualityEl?.value as Quality) in QUALITIES ? (qualityEl!.value as Quality) : "standard"];
  let take: RecordingTake;
  try {
    take = new RecordingTake(new MediaRecorder(stream, { ...(type ? { mimeType: type } : {}), videoBitsPerSecond: bits, audioBitsPerSecond: 128_000 }), {
      maxMinutes: MAX_SCREEN_MINUTES,
      fallbackType: "video/webm",
      onTick: showTime,
      onLimit: finish,
      onEnd: (result) => saveRecording(take, result),
    });
  } catch {
    release();
    setupFailed();
    say("failed");
    return;
  }
  if (!take.start()) {
    release();
    setupFailed();
    say("failed");
    return;
  }
  busy = false;
  recorder = take;
  if (startBtn) startBtn.textContent = t("screenRecorder.stop");
  if (pauseBtn) {
    pauseBtn.disabled = !take.canPause;
    pauseBtn.textContent = t("screenRecorder.pause");
  }
  // Recording goes on without the missing sound; the status says what is not in it.
  say(mixFailed ? "noMix" : wantMic && !mic ? "micDenied" : wantSystem && !screen.getAudioTracks().length ? "noSystemAudio" : "recording");
}

/** Setup ended without recording: the button reads Start again. */
function setupFailed(): void {
  busy = false;
  if (startBtn) startBtn.textContent = t("screenRecorder.start");
}

/** Stop pressed while the share or mic prompt is open: drop the setup (a late answer is ignored by `run`). */
function cancelSetup(): void {
  run++;
  setupFailed();
  release();
  say("cancelled");
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

function showTime(ms: number): void {
  if (timeEl) timeEl.textContent = clockText(ms);
}

function togglePause(): void {
  if (!recorder) return;
  let now: "paused" | "recording" | null;
  try {
    now = recorder.togglePause();
  } catch {
    say("failed");
    return;
  }
  if (!now) return;
  if (pauseBtn) pauseBtn.textContent = t(now === "paused" ? "screenRecorder.resume" : "screenRecorder.pause");
  say(now);
}

function finish(): void {
  if (!recorder) return;
  say("saving");
  // Already stopping (a second Stop, or the browser's Stop sharing): the same onstop brings the last chunk.
  recorder.stop();
}

function saveRecording(rec: RecordingTake, { blob, ms, limited }: TakeResult): void {
  if (recorder !== rec) return;
  recorder = null;
  release();
  if (startBtn) startBtn.textContent = t("screenRecorder.start");
  if (pauseBtn) {
    pauseBtn.disabled = true;
    pauseBtn.textContent = t("screenRecorder.pause");
  }
  if (!blob) {
    say("emptyTake");
    return;
  }
  const name = recordingName("screen-recording", new Date(), extensionFor(blob.type));
  if (lastUrl) URL.revokeObjectURL(lastUrl);
  lastUrl = URL.createObjectURL(blob);
  unsaved = true;
  showResult(blob, name, ms);
  if (limited) say("limit", { n: MAX_SCREEN_MINUTES });
  else say("saved", { time: clockText(ms) });
}

function showResult(blob: Blob, name: string, ms: number): void {
  if (!resultEl) return;
  const video = h("video", { controls: true, playsinline: true, preload: "metadata", src: lastUrl, class: "rec-video" });
  fixInfiniteDuration(video);
  resultEl.replaceChildren(
    video,
    h("p", { class: "rec-meta" }, h("strong", null, name), ` · ${clockText(ms)} · ${formatBytes(blob.size)}`),
    h("div", { class: "stage-actions" },
      h("button", { type: "button", class: "btn", "data-action": "download", onClick: () => { unsaved = false; syncLeaveGuard(); downloadBlob(blob, name); } }, t("screenRecorder.download", { ext: name.split(".").pop()!.toUpperCase() })),
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
  display?.getTracks().forEach((tr) => tr.stop());
  mic?.getTracks().forEach((tr) => tr.stop());
  display = null;
  mic = null;
  if (mixCtx) void mixCtx.close().catch(() => undefined);
  mixCtx = null;
}
