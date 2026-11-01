import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { TOUCH_COLS, TOUCH_ROWS, cellsAlong, coveragePercent } from "../../shared/touch";

/** One colour per finger, in the order they touch. */
const COLORS = ["#c83f79", "#2f7bd6", "#1f9a5b", "#e08a1e", "#7a4fd1", "#d23c3c", "#1aa3a3", "#8a6d3b", "#d0479b", "#4a5bd6"];

type Touch = { x: number; y: number; color: string; n: number };

let padEl: HTMLElement | null = null;
let canvasEl: HTMLCanvasElement | null = null;
let gridEl: HTMLElement | null = null;
let nowEl: HTMLElement | null = null;
let maxEl: HTMLElement | null = null;
let typeEl: HTMLElement | null = null;
let pressureEl: HTMLElement | null = null;
let coverEl: HTMLElement | null = null;
let fullBtn: HTMLButtonElement | null = null;
let cells: HTMLElement[] = [];
let touched = new Uint8Array(TOUCH_COLS * TOUCH_ROWS);
let touchedCount = 0;
const active = new Map<number, Touch>();
let maxAtOnce = 0;
let nextColor = 0;
let resizeObs: ResizeObserver | null = null;

export function mountTouchTest(host: HTMLElement): void {
  canvasEl = h("canvas", { class: "touch-canvas", "aria-hidden": "true" });
  cells = Array.from({ length: TOUCH_COLS * TOUCH_ROWS }, () => h("span", { class: "touch-cell" }));
  gridEl = h("div", { class: "touch-grid", style: { gridTemplateColumns: `repeat(${TOUCH_COLS}, 1fr)`, gridTemplateRows: `repeat(${TOUCH_ROWS}, 1fr)` }, "aria-hidden": "true" }, ...cells);
  padEl = h("div", {
    class: "touch-pad",
    "data-action": "pad",
    role: "application",
    "aria-label": t("touchTest.pad"),
    onPointerdown: (e: PointerEvent) => down(e),
    onPointermove: (e: PointerEvent) => move(e),
    onPointerup: (e: PointerEvent) => up(e),
    onPointercancel: (e: PointerEvent) => up(e),
    onContextmenu: (e: Event) => e.preventDefault(),
  }, gridEl, canvasEl, h("span", { class: "touch-start" }, t("touchTest.start")));
  nowEl = h("dd", { "data-out": "now" }, "0");
  maxEl = h("dd", { "data-out": "max" }, "0");
  typeEl = h("dd", { "data-out": "type" }, "—");
  pressureEl = h("dd", { "data-out": "pressure" }, "—");
  coverEl = h("dd", { "data-out": "coverage" }, "0%");
  fullBtn = h("button", { type: "button", class: "btn ghost", "data-action": "fullscreen", onClick: () => void fullScreen() }, t("touchTest.fullscreen"));
  const pad = padEl as HTMLElement & { webkitRequestFullscreen?: unknown };
  fullBtn.hidden = typeof pad.requestFullscreen !== "function" && typeof pad.webkitRequestFullscreen !== "function";
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("touchTest.back")),
      h("h1", null, t("touchTest.title")),
      h("p", { class: "lede" }, t("touchTest.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("dl", { class: "stats-grid" },
          h("dt", null, t("touchTest.now")), nowEl,
          h("dt", null, t("touchTest.max")), maxEl,
          h("dt", null, t("touchTest.type")), typeEl,
          h("dt", null, t("touchTest.pressure")), pressureEl,
          h("dt", null, t("touchTest.coverage")), coverEl,
        ),
        h("div", { class: "stage-actions" },
          h("button", { type: "button", class: "btn ghost", "data-action": "clear", onClick: () => clearAll() }, t("touchTest.clear")),
          fullBtn,
        ),
        h("p", { class: "hint" }, t("touchTest.hint")),
      ),
      h("div", { class: "rail touch-stage" }, padEl),
    ),
  );
  if (typeof ResizeObserver === "function") {
    resizeObs = new ResizeObserver(() => fitCanvas());
    resizeObs.observe(padEl);
  }
  fitCanvas();
}

export function unmountTouchTest(): void {
  resizeObs?.disconnect();
  resizeObs = null;
  active.clear();
  padEl = canvasEl = gridEl = null;
  nowEl = maxEl = typeEl = pressureEl = coverEl = null;
  fullBtn = null;
  cells = [];
  clearState();
}

function clearState(): void {
  touched = new Uint8Array(TOUCH_COLS * TOUCH_ROWS);
  touchedCount = 0;
  maxAtOnce = 0;
  nextColor = 0;
}

function clearAll(): void {
  clearState();
  active.clear();
  cells.forEach((c) => c.classList.remove("hit"));
  padEl?.classList.remove("used");
  const ctx = canvasEl?.getContext("2d");
  if (ctx && canvasEl) ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
  paintStats(null);
}

/** Canvas pixels follow the pad's size and the screen's pixel ratio; a resize clears the trails (the grid keeps its marks). */
function fitCanvas(): void {
  if (!canvasEl || !padEl) return;
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  const w = Math.max(1, Math.round(padEl.clientWidth * dpr));
  const hgt = Math.max(1, Math.round(padEl.clientHeight * dpr));
  if (canvasEl.width === w && canvasEl.height === hgt) return;
  canvasEl.width = w;
  canvasEl.height = hgt;
}

type Box = { left: number; top: number; w: number; h: number };

/** The pad's inner box (inside its border, where the grid and canvas are), in client coordinates. Read once per event. */
function box(): Box {
  const r = padEl!.getBoundingClientRect();
  return { left: r.left + padEl!.clientLeft, top: r.top + padEl!.clientTop, w: padEl!.clientWidth, h: padEl!.clientHeight };
}

function point(e: PointerEvent, b: Box): { x: number; y: number; w: number; h: number } {
  return { x: e.clientX - b.left, y: e.clientY - b.top, w: b.w, h: b.h };
}

function down(e: PointerEvent): void {
  if (!padEl) return;
  // Mouse: left button only; touch and pen: every contact.
  if (e.pointerType === "mouse" && e.button !== 0) return;
  e.preventDefault();
  try {
    padEl.setPointerCapture(e.pointerId);
  } catch {
    // Some browsers refuse capture for a pointer that has already ended.
  }
  padEl.classList.add("used");
  const p = point(e, box());
  const touch: Touch = { x: p.x, y: p.y, color: COLORS[nextColor % COLORS.length], n: nextColor + 1 };
  nextColor++;
  active.set(e.pointerId, touch);
  maxAtOnce = Math.max(maxAtOnce, active.size);
  mark(cellsAlong(p.x, p.y, p.x, p.y, p.w, p.h));
  dot(touch, p.w);
  paintStats(e);
}

function move(e: PointerEvent): void {
  const touch = active.get(e.pointerId);
  if (!touch || !padEl) return;
  e.preventDefault();
  // Coalesced events give every point the screen reported between two frames, so fast strokes stay smooth.
  const events = typeof e.getCoalescedEvents === "function" ? e.getCoalescedEvents() : [];
  const b = box();
  for (const ev of events.length ? events : [e]) {
    const p = point(ev, b);
    mark(cellsAlong(touch.x, touch.y, p.x, p.y, p.w, p.h));
    line(touch, p.x, p.y, p.w);
    touch.x = p.x;
    touch.y = p.y;
  }
  paintStats(e);
}

function up(e: PointerEvent): void {
  if (!active.delete(e.pointerId)) return;
  paintStats(e);
}

function mark(list: number[]): void {
  for (const i of list) {
    if (touched[i]) continue;
    touched[i] = 1;
    touchedCount++;
    cells[i]?.classList.add("hit");
  }
}

function scale(): number {
  return canvasEl && padEl ? canvasEl.width / Math.max(1, padEl.clientWidth) : 1;
}

function dot(touch: Touch, width: number): void {
  const ctx = canvasEl?.getContext("2d");
  if (!ctx) return;
  const s = scale();
  const r = Math.max(14, Math.min(28, width / 18)) * s;
  ctx.fillStyle = touch.color;
  ctx.globalAlpha = 0.35;
  ctx.beginPath();
  ctx.arc(touch.x * s, touch.y * s, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.font = `700 ${Math.round(14 * s)}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(touch.n), touch.x * s, touch.y * s);
}

function line(touch: Touch, x: number, y: number, width: number): void {
  const ctx = canvasEl?.getContext("2d");
  if (!ctx) return;
  const s = scale();
  ctx.strokeStyle = touch.color;
  ctx.lineWidth = Math.max(3, Math.min(6, width / 120)) * s;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(touch.x * s, touch.y * s);
  ctx.lineTo(x * s, y * s);
  ctx.stroke();
}

function paintStats(e: PointerEvent | null): void {
  if (nowEl) nowEl.textContent = String(active.size);
  if (maxEl) maxEl.textContent = String(maxAtOnce);
  if (coverEl) coverEl.textContent = `${coveragePercent(touchedCount)}%`;
  if (!e) {
    if (typeEl) typeEl.textContent = "—";
    if (pressureEl) pressureEl.textContent = "—";
    return;
  }
  if (typeEl) {
    const type = e.pointerType === "touch" || e.pointerType === "pen" || e.pointerType === "mouse" ? e.pointerType : "other";
    typeEl.textContent = t(`touchTest.type_${type}`);
  }
  // Mouse and most touch screens report a fixed 0.5 while pressed: show pressure only when it varies.
  if (pressureEl && e.type !== "pointerup" && e.type !== "pointercancel") {
    pressureEl.textContent = e.pressure > 0 && e.pressure !== 0.5 ? e.pressure.toFixed(2) : t("touchTest.noPressure");
  }
}

async function fullScreen(): Promise<void> {
  const el = padEl as (HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void }) | null;
  if (!el) return;
  try {
    await (el.requestFullscreen ?? el.webkitRequestFullscreen)?.call(el);
  } catch {
    // Refused (not from a click, or blocked): the pad stays in the page.
  }
}

