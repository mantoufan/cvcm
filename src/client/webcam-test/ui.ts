import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { WEBCAM_RESOLUTIONS, aspectText, framesPerSecond, sizeText, videoConstraints } from "../../shared/webcam";

/** How often the live readouts (size, frame rate) are refreshed. */
const READOUT_MS = 500;

let deviceEl: HTMLSelectElement | null = null;
let resolutionEl: HTMLSelectElement | null = null;
let mirrorEl: HTMLInputElement | null = null;
let startBtn: HTMLButtonElement | null = null;
let photoBtn: HTMLButtonElement | null = null;
let statusEl: HTMLElement | null = null;
let infoEl: HTMLElement | null = null;
let videoEl: HTMLVideoElement | null = null;
let frameEl: HTMLElement | null = null;
let shotEl: HTMLImageElement | null = null;
let saveEl: HTMLAnchorElement | null = null;
let stream: MediaStream | null = null;
let shotUrl = "";
let readoutTimer = 0;
let frameHandle = 0;
let frameTimes: number[] = [];
/** When frames started being counted; the rate shows once a full window has passed. */
let countingSince = 0;
/** facingMode of the last camera opened, so Mirror is set again only when it changes. */
let lastFacing = "";
/** Whether the preview is on screen: browsers stop handing over frames for a video nobody can see. */
let videoSeen = true;
let seenObs: IntersectionObserver | null = null;
const FPS_WINDOW_MS = 2000;
/** Bumped on every start/stop, so a slow permission prompt that resolves late is dropped. */
let run = 0;
/** A permission prompt is open (start() is waiting for getUserMedia). */
let asking = false;

export function mountWebcamTest(host: HTMLElement): void {
  const restart = () => {
    if (stream || asking) void start();
  };
  deviceEl = h("select", { "data-field": "device", disabled: true, onChange: restart },
    h("option", { value: "" }, t("webcamTest.defaultDevice")),
  );
  resolutionEl = h("select", { "data-field": "resolution", onChange: restart },
    ...WEBCAM_RESOLUTIONS.map((r) => h("option", { value: r.id }, t(`webcamTest.res_${r.id}`))),
  );
  mirrorEl = h("input", { type: "checkbox", "data-field": "mirror", checked: true, onChange: () => paintMirror() });
  startBtn = h("button", { type: "button", class: "btn", "data-action": "start", onClick: () => (stream || asking ? stop() : void start()) }, t("webcamTest.start"));
  document.addEventListener("visibilitychange", onVisibility);
  photoBtn = h("button", { type: "button", class: "btn ghost", "data-action": "photo", disabled: true, onClick: () => void takePhoto() }, t("webcamTest.photo"));
  statusEl = h("p", { class: "hint", "aria-live": "polite", "data-out": "status" }, t("webcamTest.idle"));
  infoEl = h("dl", { class: "stats-grid", "data-out": "info" });
  videoEl = h("video", { class: "cam-video mirror", playsinline: true, muted: true, autoplay: true, "aria-label": t("webcamTest.preview") });
  // iOS only plays inline (not full screen) with the property set, not just the attribute.
  videoEl.playsInline = true;
  videoEl.muted = true;
  videoSeen = true;
  if (typeof IntersectionObserver === "function") {
    seenObs = new IntersectionObserver((entries) => {
      const seen = entries.some((e) => e.isIntersecting);
      // Count afresh once it is back in view, so the gap does not read as a frozen camera.
      if (seen && !videoSeen) {
        frameTimes = [];
        countingSince = 0;
      }
      videoSeen = seen;
    });
    seenObs.observe(videoEl);
  }
  shotEl = h("img", { class: "cam-shot", alt: t("webcamTest.photoAlt"), hidden: true });
  saveEl = h("a", { class: "btn ghost", "data-action": "save", hidden: true }, t("webcamTest.save"));
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("webcamTest.back")),
      h("h1", null, t("webcamTest.title")),
      h("p", { class: "lede" }, t("webcamTest.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("webcamTest.options")),
          h("label", { class: "field" }, h("span", null, t("webcamTest.device")), deviceEl),
          h("label", { class: "field" }, h("span", null, t("webcamTest.resolution")), resolutionEl),
          h("label", { class: "check" }, mirrorEl, h("span", null, t("webcamTest.mirror"))),
        ),
        h("div", { class: "stage-actions" }, startBtn, photoBtn),
        statusEl,
        infoEl,
      ),
      h("div", { class: "rail cam-stage" },
        frameEl = h("div", { class: "cam-frame" }, videoEl),
        h("p", { class: "hint" }, t("webcamTest.hint")),
        shotEl,
        h("div", { class: "cam-actions" }, saveEl),
      ),
    ),
  );
}

export function unmountWebcamTest(): void {
  document.removeEventListener("visibilitychange", onVisibility);
  seenObs?.disconnect();
  seenObs = null;
  lastFacing = "";
  stop();
  if (navigator.mediaDevices) navigator.mediaDevices.ondevicechange = null;
  if (shotUrl) URL.revokeObjectURL(shotUrl);
  shotUrl = "";
  deviceEl = resolutionEl = null;
  mirrorEl = null;
  startBtn = photoBtn = null;
  statusEl = infoEl = null;
  videoEl = null;
  frameEl = null;
  shotEl = null;
  saveEl = null;
}

/** Hidden tabs get no video frames: count afresh when the tab comes back, so a working camera does not read as frozen. */
function onVisibility(): void {
  if (document.visibilityState !== "visible") return;
  frameTimes = [];
  countingSince = 0;
}

function say(key: string): void {
  if (statusEl) statusEl.textContent = t(`webcamTest.${key}`);
}

function paintMirror(): void {
  videoEl?.classList.toggle("mirror", mirrorEl?.checked !== false);
}

async function start(): Promise<void> {
  stop();
  const mine = ++run;
  if (!navigator.mediaDevices?.getUserMedia) {
    say(window.isSecureContext === false ? "insecure" : "unsupported");
    return;
  }
  say("asking");
  // While the prompt is open the button cancels, so a second click does not open a second prompt.
  if (startBtn) startBtn.textContent = t("webcamTest.stop");
  const id = deviceEl?.value ?? "";
  let s: MediaStream;
  asking = true;
  try {
    s = await navigator.mediaDevices.getUserMedia({ video: videoConstraints(resolutionEl?.value ?? "auto", id), audio: false });
  } catch (err) {
    if (mine !== run) return;
    asking = false;
    if (startBtn) startBtn.textContent = t("webcamTest.start");
    const name = (err as { name?: string })?.name;
    // The saved camera is gone (unplugged, or back with a new id): reset the list and open the default camera.
    if (id && (name === "NotFoundError" || name === "OverconstrainedError") && deviceEl) {
      deviceEl.replaceChildren(h("option", { value: "" }, t("webcamTest.defaultDevice")));
      deviceEl.disabled = true;
      void start();
      return;
    }
    say(name === "NotAllowedError" || name === "SecurityError" ? "denied" : name === "NotFoundError" || name === "OverconstrainedError" ? "notFound" : name === "NotReadableError" ? "busy" : "failed");
    return;
  }
  if (mine !== run || !videoEl) {
    s.getTracks().forEach((tr) => tr.stop());
    return;
  }
  asking = false;
  stream = s;
  videoEl.srcObject = s;
  // A front camera is mirrored like a mirror; a back camera shows the scene the right way round.
  // Only when the facing changes (another camera), so a resolution change keeps the user's own choice.
  const facing = s.getVideoTracks()[0]?.getSettings().facingMode ?? "";
  if (mirrorEl && facing && facing !== lastFacing) mirrorEl.checked = facing !== "environment";
  lastFacing = facing;
  paintMirror();
  void videoEl.play().catch(() => undefined);
  if (startBtn) startBtn.textContent = t("webcamTest.stop");
  if (photoBtn) photoBtn.disabled = false;
  say("live");
  const track = s.getVideoTracks()[0];
  track?.addEventListener("ended", () => {
    if (stream === s) {
      stop();
      say("ended");
    }
  });
  frameTimes = [];
  watchFrames(videoEl);
  readoutTimer = window.setInterval(() => paintInfo(), READOUT_MS);
  paintInfo();
  void listDevices(track?.getSettings().deviceId);
  // A camera plugged in (or removed) while testing shows up in the list.
  navigator.mediaDevices.ondevicechange = () => {
    if (stream === s) void listDevices(s.getVideoTracks()[0]?.getSettings().deviceId);
  };
}

/** Counts the frames the video element actually shows, where the browser can tell (requestVideoFrameCallback). */
function watchFrames(video: HTMLVideoElement): void {
  if (typeof video.requestVideoFrameCallback !== "function") return;
  const mine = run;
  const onFrame = (now: number) => {
    if (mine !== run || !stream) return;
    // Count from the first frame, so the camera's warm-up does not lower the first reading.
    if (!countingSince) countingSince = now;
    frameTimes.push(now);
    while (frameTimes.length && frameTimes[0] < now - FPS_WINDOW_MS) frameTimes.shift();
    frameHandle = video.requestVideoFrameCallback(onFrame);
  };
  frameHandle = video.requestVideoFrameCallback(onFrame);
}

function stop(): void {
  run++;
  asking = false;
  window.clearInterval(readoutTimer);
  if (frameHandle && videoEl && typeof videoEl.cancelVideoFrameCallback === "function") videoEl.cancelVideoFrameCallback(frameHandle);
  frameHandle = 0;
  frameTimes = [];
  countingSince = 0;
  stream?.getTracks().forEach((tr) => tr.stop());
  stream = null;
  if (videoEl) videoEl.srcObject = null;
  if (startBtn) startBtn.textContent = t("webcamTest.start");
  if (photoBtn) photoBtn.disabled = true;
  infoEl?.replaceChildren();
  say("idle");
}

/** Camera names are only readable after permission, so the list fills in once the camera is on. */
async function listDevices(currentId: string | undefined): Promise<void> {
  if (!deviceEl || !navigator.mediaDevices?.enumerateDevices) return;
  const mine = run;
  let inputs: MediaDeviceInfo[];
  try {
    inputs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput" && d.deviceId);
  } catch {
    return;
  }
  // Another camera was picked meanwhile: its own listing will fill the select.
  if (mine !== run || !deviceEl || !inputs.length) return;
  const known = !!currentId && inputs.some((d) => d.deviceId === currentId);
  // When the live camera is not in the list (no deviceId reported), keep "Default camera" selected so a restart
  // (another resolution) opens the same camera instead of the first one listed.
  deviceEl.replaceChildren(
    ...(known ? [] : [h("option", { value: "" }, t("webcamTest.defaultDevice"))]),
    ...inputs.map((d, i) => h("option", { value: d.deviceId }, d.label || t("webcamTest.unnamed", { n: i + 1 }))),
  );
  deviceEl.value = known ? currentId! : "";
  deviceEl.disabled = inputs.length < (known ? 2 : 1);
}

function paintInfo(): void {
  if (!infoEl || !stream) return;
  const track = stream.getVideoTracks()[0];
  const set = track?.getSettings() ?? {};
  // The frames actually shown, not the asked-for size: a camera that cannot do 1080p shows its nearest mode here.
  const w = videoEl?.videoWidth || set.width || 0;
  const hgt = videoEl?.videoHeight || set.height || 0;
  // The frame takes the video's shape, so portrait phone video is not a strip in a wide box.
  if (frameEl && w > 0 && hgt > 0) frameEl.style.aspectRatio = `${w} / ${hgt}`;
  const rows: Array<[string, string]> = [
    [t("webcamTest.name"), track?.label || "—"],
    [t("webcamTest.size"), sizeText(w, hgt)],
    [t("webcamTest.aspect"), aspectText(w, hgt)],
  ];
  const now = performance.now();
  if (videoSeen && countingSince && now - countingSince >= FPS_WINDOW_MS) {
    // Frames the page actually received; a frozen camera reads 0.
    rows.push([t("webcamTest.fps"), t("webcamTest.fpsValue", { n: framesPerSecond(frameTimes, now, FPS_WINDOW_MS).toFixed(1) })]);
  } else if (set.frameRate) rows.push([t("webcamTest.fps"), t("webcamTest.fpsSetting", { n: Math.round(set.frameRate) })]);
  if (set.facingMode) rows.push([t("webcamTest.facing"), t(`webcamTest.facing_${set.facingMode === "environment" ? "back" : "front"}`)]);
  infoEl.replaceChildren(...rows.flatMap(([k, v]) => [h("dt", null, k), h("dd", null, v)]));
}

async function takePhoto(): Promise<void> {
  const v = videoEl;
  if (!v || !stream || !v.videoWidth || !v.videoHeight) return;
  const canvas = document.createElement("canvas");
  canvas.width = v.videoWidth;
  canvas.height = v.videoHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  // The photo matches the preview: mirrored when the preview is.
  if (mirrorEl?.checked !== false) {
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob || !shotEl || !saveEl) return;
  if (shotUrl) URL.revokeObjectURL(shotUrl);
  shotUrl = URL.createObjectURL(blob);
  shotEl.src = shotUrl;
  shotEl.hidden = false;
  saveEl.href = shotUrl;
  saveEl.download = `webcam-${canvas.width}x${canvas.height}.png`;
  saveEl.hidden = false;
  say("photoTaken");
}
