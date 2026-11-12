import { copyWithFlash } from "../copy";
import { h } from "../dom";
import { t } from "../i18n";
import { MAX_FRAME_MS, countSkipped, hzFromInterval, medianInterval, nearestStandardRate, steadyInterval } from "../../shared/refresh-rate";

/** Frame intervals kept for the estimate and the graph. */
const KEEP = 240;
/** Frames to wait before showing a rate, so the first uneven frames after load do not count. */
const MIN_SAMPLES = 30;
const PAINT_MS = 250;
const SPEEDS = [480, 960, 1920] as const;

let hzEl: HTMLElement | null = null;
let nearEl: HTMLElement | null = null;
let frameMsEl: HTMLElement | null = null;
let skippedEl: HTMLElement | null = null;
let samplesEl: HTMLElement | null = null;
let graphEl: HTMLCanvasElement | null = null;
let trackEl: HTMLElement | null = null;
let blockEl: HTMLElement | null = null;
let speedEl: HTMLSelectElement | null = null;
let copyBtn: HTMLButtonElement | null = null;
let intervals: number[] = [];
let lastTime = 0;
let lastPaint = 0;
let frame = 0;
let blockX = 0;
/** Room the block can travel (track width minus block), measured on resize so no frame forces a layout. */
let blockSpan = 0;
let resizeObs: ResizeObserver | null = null;
let ink = "#a13f6c";
let soft = "#f2d9e5";
let last = "";

export function mountRefreshRate(host: HTMLElement): void {
  hzEl = h("strong", { class: "rr-hz", "data-out": "hz" }, "—");
  nearEl = h("p", { class: "rr-near", "aria-live": "polite", "data-out": "near" });
  frameMsEl = h("dd", { "data-out": "frame-ms" }, "—");
  skippedEl = h("dd", { "data-out": "skipped" }, "0");
  samplesEl = h("dd", { "data-out": "samples" }, "0");
  graphEl = h("canvas", { class: "rr-graph", width: 640, height: 140, "aria-hidden": "true" });
  blockEl = h("span", { class: "rr-block" });
  trackEl = h("div", { class: "rr-track", "aria-hidden": "true" }, blockEl);
  speedEl = h("select", { "data-field": "speed" },
    ...SPEEDS.map((s) => h("option", { value: String(s), selected: s === 960 }, t("refreshRate.speedValue", { n: s }))),
  );
  copyBtn = h("button", { type: "button", class: "btn ghost", "data-action": "copy", disabled: true, onClick: () => void copyOut() }, t("refreshRate.copy"));
  host.append(
    h("header", { class: "tool-head" },
      h("h1", null, t("refreshRate.title")),
      h("p", { class: "lede" }, t("refreshRate.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("dl", { class: "stats-grid" },
          h("dt", null, t("refreshRate.frameTime")), frameMsEl,
          h("dt", null, t("refreshRate.skipped")), skippedEl,
          h("dt", null, t("refreshRate.samples")), samplesEl,
        ),
        h("fieldset", null,
          h("legend", null, t("refreshRate.motion")),
          h("label", { class: "field" }, h("span", null, t("refreshRate.speed")), speedEl),
        ),
        h("div", { class: "stage-actions" },
          h("button", { type: "button", class: "btn ghost", "data-action": "reset", onClick: () => reset() }, t("refreshRate.reset")),
          copyBtn,
        ),
        h("p", { class: "hint" }, t("refreshRate.hint")),
      ),
      h("div", { class: "rail rr-stage" },
        h("div", { class: "rr-readout" }, hzEl, h("span", null, "Hz")),
        nearEl,
        graphEl,
        trackEl,
      ),
    ),
  );
  const style = getComputedStyle(graphEl);
  ink = style.getPropertyValue("--pink-deep").trim() || ink;
  soft = style.getPropertyValue("--line").trim() || soft;
  document.addEventListener("visibilitychange", onVisibility);
  const measure = () => {
    if (trackEl && blockEl) blockSpan = trackEl.clientWidth - blockEl.offsetWidth;
  };
  measure();
  if (typeof ResizeObserver === "function") {
    resizeObs = new ResizeObserver(measure);
    resizeObs.observe(trackEl);
  }
  reset();
}

export function unmountRefreshRate(): void {
  window.cancelAnimationFrame(frame);
  document.removeEventListener("visibilitychange", onVisibility);
  resizeObs?.disconnect();
  resizeObs = null;
  blockSpan = 0;
  hzEl = nearEl = frameMsEl = skippedEl = samplesEl = null;
  graphEl = null;
  trackEl = blockEl = null;
  speedEl = null;
  copyBtn = null;
  intervals = [];
  last = "";
}

function onVisibility(): void {
  // A hidden tab gets few or no frames: start over when it comes back.
  if (document.visibilityState === "visible") reset();
}

function reset(): void {
  window.cancelAnimationFrame(frame);
  intervals = [];
  lastTime = 0;
  lastPaint = 0;
  last = "";
  if (copyBtn) copyBtn.disabled = true;
  if (hzEl) hzEl.textContent = "—";
  if (nearEl) nearEl.textContent = t("refreshRate.measuring");
  if (frameMsEl) frameMsEl.textContent = "—";
  if (skippedEl) skippedEl.textContent = "0";
  if (samplesEl) samplesEl.textContent = "0";
  frame = window.requestAnimationFrame(tick);
}

function tick(now: number): void {
  if (!hzEl) return;
  if (lastTime) {
    const dt = now - lastTime;
    if (dt > 0 && dt <= MAX_FRAME_MS) {
      intervals.push(dt);
      if (intervals.length > KEEP) intervals.splice(0, intervals.length - KEEP);
    }
    moveBlock(Math.min(dt, MAX_FRAME_MS));
  }
  lastTime = now;
  if (now - lastPaint >= PAINT_MS) {
    lastPaint = now;
    paint();
  }
  frame = window.requestAnimationFrame(tick);
}

function moveBlock(dt: number): void {
  if (!trackEl || !blockEl || !(dt > 0)) return;
  const span = blockSpan;
  if (span <= 0) return;
  blockX = (blockX + ((Number(speedEl?.value) || 960) * dt) / 1000) % span;
  blockEl.style.transform = `translateX(${blockX}px)`;
}

function paint(): void {
  if (samplesEl) samplesEl.textContent = String(intervals.length);
  drawGraph();
  if (intervals.length < MIN_SAMPLES) return;
  const frameMs = steadyInterval(intervals);
  const hz = hzFromInterval(frameMs);
  const near = nearestStandardRate(hz);
  const skipped = countSkipped(intervals);
  if (hzEl) hzEl.textContent = String(Math.round(hz));
  if (frameMsEl) frameMsEl.textContent = t("refreshRate.ms", { n: frameMs.toFixed(2) });
  if (skippedEl) skippedEl.textContent = String(skipped);
  const line = near ? t("refreshRate.near", { n: near }) : t("refreshRate.unusual", { n: hz.toFixed(1) });
  if (nearEl && nearEl.textContent !== line) nearEl.textContent = line;
  last = `${t("refreshRate.result", { n: Math.round(hz), ms: frameMs.toFixed(2) })}\n${line}`;
  if (copyBtn) copyBtn.disabled = false;
}

function drawGraph(): void {
  const c = graphEl;
  const ctx = c?.getContext("2d");
  if (!c || !ctx) return;
  ctx.clearRect(0, 0, c.width, c.height);
  if (!intervals.length) return;
  const median = medianInterval(intervals) || 16.7;
  // Scale so the median sits at a third of the height and skipped frames (2×, 3×) show as tall spikes.
  const top = median * 3;
  const barW = c.width / KEEP;
  ctx.fillStyle = ink;
  intervals.forEach((v, i) => {
    const hgt = Math.min(c.height, (v / top) * c.height);
    ctx.fillRect(i * barW, c.height - hgt, Math.max(1, barW - 0.5), hgt);
  });
  ctx.fillStyle = soft;
  ctx.fillRect(0, c.height - c.height / 3, c.width, 1);
}

async function copyOut(): Promise<void> {
  await copyWithFlash(copyBtn, last, { done: t("refreshRate.copied"), failed: t("refreshRate.copyFailed") });
}
