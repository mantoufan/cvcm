import { downloadBlob, h } from "../dom";
import { locale, t } from "../i18n";
import { formatter } from "../shape-calc";
import { decimalMarkOf } from "../../shared/calculator";
import { appHref } from "../../shared/path";
import { findZeros, niceStep, parseExpr, sampleCurve, type Compiled, type Viewport } from "../../shared/graph-expr";

const COLORS = ["#d6336c", "#2563eb", "#16a34a", "#d97706", "#7c3aed", "#0891b2"] as const;
export const MAX_FUNCS = COLORS.length;
const START = ["x^2 - 2", "sin(x)"];
const HEIGHT_RATIO = 0.7;
const MAX_POINTS = 40;

type Row = {
  el: HTMLElement;
  input: HTMLInputElement;
  show: HTMLInputElement;
  error: HTMLElement;
  color: string;
  fn: Compiled | null;
  /** Sampled curve for one view, so moving the trace redraws without sampling again. */
  runs: { key: string; runs: Array<Array<[number, number]>> } | null;
};

type State = {
  rows: Row[];
  list: HTMLElement;
  canvas: HTMLCanvasElement;
  wrap: HTMLElement;
  readout: HTMLElement;
  points: HTMLElement;
  addBtn: HTMLButtonElement;
  view: Viewport;
  /** Canvas size in CSS pixels. */
  w: number;
  hgt: number;
  trace: number | null;
  drag: Map<number, { x: number; y: number }>;
  pinch: number | null;
  frame: number;
  pointsTimer: number;
  ro: ResizeObserver | null;
  pointsKey: string;
  /** The canvas bitmap has been sized once (a fresh canvas is 300 × 150, not unsized). */
  sized: boolean;
};

let s: State | null = null;

const fmt = () => formatter(locale());

export function mountGraphingCalculator(host: HTMLElement): void {
  unmountGraphingCalculator();
  const list = h("div", { class: "graph-funcs", "data-out": "functions" });
  const canvas = h("canvas", { class: "graph-canvas", "data-out": "canvas", role: "img", "aria-label": t("graphingCalculator.canvasLabel") });
  const wrap = h("div", { class: "graph-wrap" }, canvas);
  const readout = h("p", { class: "hint graph-readout", "aria-live": "polite", "data-out": "readout" }, t("graphingCalculator.traceHint"));
  const points = h("ul", { class: "graph-points", "data-out": "points" });
  const addBtn = h("button", { type: "button", class: "btn ghost", "data-action": "add", onClick: () => { addRow(""); s?.rows[s.rows.length - 1]?.input.focus(); } }, t("graphingCalculator.add"));
  s = {
    rows: [],
    list,
    canvas,
    wrap,
    readout,
    points,
    addBtn,
    view: { xMin: -10, xMax: 10, yMin: -7, yMax: 7 },
    w: 640,
    hgt: 448,
    trace: null,
    drag: new Map(),
    pinch: null,
    frame: 0,
    pointsTimer: 0,
    ro: null,
    sized: false,
    pointsKey: "",
  };
  const zoomBtn = (action: string, label: string, aria: string, k: number) =>
    h("button", { type: "button", class: "chip", "data-action": action, "aria-label": aria, onClick: () => zoom(k) }, label);
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("graphingCalculator.back")),
      h("h1", null, t("graphingCalculator.title")),
      h("p", { class: "lede" }, t("graphingCalculator.privacyNote")),
    ),
    h("div", { class: "graph-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("graphingCalculator.functions")),
          list,
          addBtn,
        ),
        h("p", { class: "hint" }, t("graphingCalculator.syntaxHint")),
      ),
      h("div", { class: "rail" },
        h("div", { class: "graph-bar" },
          zoomBtn("zoom-in", "+", t("graphingCalculator.zoomIn"), 0.5),
          zoomBtn("zoom-out", "−", t("graphingCalculator.zoomOut"), 2),
          h("button", { type: "button", class: "chip", "data-action": "reset", onClick: () => resetView() }, t("graphingCalculator.reset")),
          h("button", { type: "button", class: "chip", "data-action": "download", onClick: () => download() }, t("graphingCalculator.download")),
        ),
        wrap,
        readout,
        h("h2", null, t("graphingCalculator.pointsTitle")),
        points,
      ),
    ),
  );
  for (const expr of START) addRow(expr);
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
  canvas.addEventListener("pointerleave", onLeave);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  if (typeof ResizeObserver !== "undefined") {
    s.ro = new ResizeObserver(() => resize());
    s.ro.observe(wrap);
  }
  resize();
}

export function unmountGraphingCalculator(): void {
  if (!s) return;
  cancelAnimationFrame(s.frame);
  clearTimeout(s.pointsTimer);
  s.ro?.disconnect();
  s = null;
}

function addRow(expr: string): void {
  if (!s || s.rows.length >= MAX_FUNCS) return;
  const st = s;
  const used = new Set(st.rows.map((r) => r.color));
  const color = COLORS.find((c) => !used.has(c)) ?? COLORS[0];
  const input = h("input", { type: "text", autocomplete: "off", autocapitalize: "off", spellcheck: "false", inputmode: "text", value: expr, "data-field": "expr", placeholder: "x^2 + 1", "aria-label": t("graphingCalculator.expr"), onInput: () => { compile(row); redraw(); } });
  const show = h("input", { type: "checkbox", checked: true, "data-field": "show", "aria-label": t("graphingCalculator.show"), onChange: () => redraw() });
  const error = h("p", { class: "hint graph-error", "data-out": "expr-error" });
  const remove = h("button", { type: "button", class: "chip", "data-action": "remove", "aria-label": t("graphingCalculator.remove"), onClick: () => {
    st.rows = st.rows.filter((r) => r !== row);
    row.el.remove();
    syncAdd();
    redraw();
  } }, "×");
  const el = h("div", { class: "graph-func" },
    h("span", { class: "graph-swatch", style: { background: color }, "aria-hidden": "true" }),
    show,
    h("span", { class: "graph-y" }, "y ="),
    input,
    remove,
    error,
  );
  const row: Row = { el, input, show, error, color, fn: null, runs: null };
  compile(row);
  st.rows.push(row);
  st.list.append(el);
  syncAdd();
  redraw();
}

function syncAdd(): void {
  if (s) s.addBtn.disabled = s.rows.length >= MAX_FUNCS;
}

function compile(row: Row): void {
  const r = parseExpr(row.input.value, decimalMarkOf(locale()));
  row.fn = r.ok ? r.fn : null;
  row.error.textContent = r.ok || r.error === "empty" ? "" : t("graphingCalculator.err_syntax");
  row.input.setAttribute("aria-invalid", String(!r.ok && r.error !== "empty"));
}

function resize(): void {
  if (!s) return;
  const w = Math.max(240, Math.round(s.wrap.clientWidth || 640));
  const hgt = Math.round(w * HEIGHT_RATIO);
  if (w === s.w && hgt === s.hgt && s.sized) {
    redraw();
    return;
  }
  // Keep the centre and the x-range; the y-range follows the new shape so units stay square.
  const v = s.view;
  const cy = (v.yMin + v.yMax) / 2;
  const unit = (v.xMax - v.xMin) / w;
  s.w = w;
  s.hgt = hgt;
  s.sized = true;
  s.view = { ...v, yMin: cy - (unit * hgt) / 2, yMax: cy + (unit * hgt) / 2 };
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  s.canvas.width = Math.round(w * dpr);
  s.canvas.height = Math.round(hgt * dpr);
  s.canvas.style.height = `${hgt}px`;
  redraw();
}

function resetView(): void {
  if (!s) return;
  const halfY = (10 * s.hgt) / s.w;
  s.view = { xMin: -10, xMax: 10, yMin: -halfY, yMax: halfY };
  redraw();
}

/** Zooms by `k` (0.5 = twice as close) about a point in graph units, the centre by default. */
function zoom(k: number, cx?: number, cy?: number): void {
  if (!s) return;
  const v = s.view;
  const x = cx ?? (v.xMin + v.xMax) / 2;
  const y = cy ?? (v.yMin + v.yMax) / 2;
  const span = (v.xMax - v.xMin) * k;
  // Stay where doubles still draw a smooth curve: never narrower than a billionth of where the view sits.
  if (span < Math.max(1e-9, Math.abs(x) * 1e-9, Math.abs(y) * 1e-9) || span > 1e9) return;
  s.view = { xMin: x - (x - v.xMin) * k, xMax: x + (v.xMax - x) * k, yMin: y - (y - v.yMin) * k, yMax: y + (v.yMax - y) * k };
  redraw();
}

function toGraph(px: number, py: number): [number, number] {
  const v = s!.view;
  return [v.xMin + (px / s!.w) * (v.xMax - v.xMin), v.yMax - (py / s!.hgt) * (v.yMax - v.yMin)];
}

function local(e: PointerEvent | WheelEvent): [number, number] {
  const r = s!.canvas.getBoundingClientRect();
  return [e.clientX - r.left, e.clientY - r.top];
}

function onDown(e: PointerEvent): void {
  if (!s) return;
  s.canvas.setPointerCapture?.(e.pointerId);
  s.drag.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (s.drag.size === 2) {
    const [a, b] = [...s.drag.values()];
    s.pinch = Math.hypot(a.x - b.x, a.y - b.y);
  }
  setTrace(e);
}

function onMove(e: PointerEvent): void {
  if (!s) return;
  const prev = s.drag.get(e.pointerId);
  if (!prev) {
    if (e.pointerType === "mouse") setTrace(e);
    return;
  }
  e.preventDefault();
  if (s.drag.size === 2 && s.pinch) {
    s.drag.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const [a, b] = [...s.drag.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    const r = s.canvas.getBoundingClientRect();
    const [gx, gy] = toGraph((a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
    if (d > 0) zoom(s.pinch / d, gx, gy);
    s.pinch = d;
    return;
  }
  const v = s.view;
  const dx = ((e.clientX - prev.x) / s.w) * (v.xMax - v.xMin);
  const dy = ((e.clientY - prev.y) / s.hgt) * (v.yMax - v.yMin);
  s.drag.set(e.pointerId, { x: e.clientX, y: e.clientY });
  s.view = { xMin: v.xMin - dx, xMax: v.xMax - dx, yMin: v.yMin + dy, yMax: v.yMax + dy };
  setTrace(e);
}

function onUp(e: PointerEvent): void {
  if (!s) return;
  s.drag.delete(e.pointerId);
  if (s.drag.size < 2) s.pinch = null;
}

function onLeave(e: PointerEvent): void {
  if (!s || e.pointerType !== "mouse" || s.drag.size) return;
  s.trace = null;
  redraw();
}

function onWheel(e: WheelEvent): void {
  if (!s) return;
  e.preventDefault();
  const [px, py] = local(e);
  const [gx, gy] = toGraph(px, py);
  // Lines (Firefox, some mice) and pages count as about 33 and 400 pixels.
  const delta = e.deltaY * (e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1);
  zoom(Math.exp(Math.max(-1, Math.min(1, delta / 300))), gx, gy);
}

function setTrace(e: PointerEvent): void {
  if (!s) return;
  s.trace = toGraph(...local(e))[0];
  redraw();
}

/** What the curves and the points list depend on: the view, the canvas width and the visible functions. */
function sceneKey(): string {
  if (!s) return "";
  const v = s.view;
  return `${v.xMin},${v.xMax},${v.yMin},${v.yMax},${s.w}|${visible().map((r) => r.input.value).join("\n")}`;
}

function redraw(): void {
  if (!s) return;
  cancelAnimationFrame(s.frame);
  s.frame = requestAnimationFrame(() => {
    draw();
    readTrace();
  });
  // Moving the trace alone changes nothing in the list: only re-list when the view or the functions change.
  const key = sceneKey();
  if (key === s.pointsKey) return;
  s.pointsKey = key;
  clearTimeout(s.pointsTimer);
  s.pointsTimer = window.setTimeout(() => listPoints(), 200);
}

function visible(): Row[] {
  return s ? s.rows.filter((r) => r.fn && r.show.checked) : [];
}

function draw(target?: HTMLCanvasElement): void {
  if (!s) return;
  const canvas = target ?? s.canvas;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { w, hgt, view: v } = s;
  ctx.setTransform(canvas.width / w, 0, 0, canvas.height / hgt, 0, 0);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, hgt);
  const X = (x: number) => ((x - v.xMin) / (v.xMax - v.xMin)) * w;
  const Y = (y: number) => ((v.yMax - y) / (v.yMax - v.yMin)) * hgt;
  const step = niceStep(v.xMax - v.xMin, Math.max(4, Math.round(w / 80)));
  const f = fmt();
  // Minor grid at a fifth of the step, then the major grid with labels, then the axes.
  for (const [k, color] of [[step / 5, "#f3eef1"], [step, "#e4dbe0"]] as const) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    // Lines by index (i·k), never by adding k: far from 0 a tiny step can be lost in rounding and never advance.
    for (let i = Math.ceil(v.xMin / k), n = 0; i * k <= v.xMax && n < 400; i++, n++) {
      const x = i * k;
      ctx.moveTo(Math.round(X(x)) + 0.5, 0);
      ctx.lineTo(Math.round(X(x)) + 0.5, hgt);
    }
    for (let i = Math.ceil(v.yMin / k), n = 0; i * k <= v.yMax && n < 400; i++, n++) {
      const y = i * k;
      ctx.moveTo(0, Math.round(Y(y)) + 0.5);
      ctx.lineTo(w, Math.round(Y(y)) + 0.5);
    }
    ctx.stroke();
  }
  const ax = Math.min(Math.max(Y(0), 0), hgt);
  const ay = Math.min(Math.max(X(0), 0), w);
  ctx.strokeStyle = "#5b4a52";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, ax);
  ctx.lineTo(w, ax);
  ctx.moveTo(ay, 0);
  ctx.lineTo(ay, hgt);
  ctx.stroke();
  ctx.fillStyle = "#5b4a52";
  ctx.font = "12px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  // Labels sit by the axis, or along the edge when the axis is off screen.
  const near = (n: number) => (Math.abs(n) < step / 1e6 ? 0 : n);
  for (let i = Math.ceil(v.xMin / step), n = 0; i * step <= v.xMax && n < 100; i++, n++) {
    const x = i * step;
    // A label centred on the edge would be cut in half ("-10" reads as "0"): leave those out.
    if (near(x) === 0 || X(x) < 16 || X(x) > w - 16) continue;
    ctx.fillText(f(near(x)), X(x), Math.min(ax + 4, hgt - 16));
  }
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (let i = Math.ceil(v.yMin / step), n = 0; i * step <= v.yMax && n < 100; i++, n++) {
    const y = i * step;
    if (near(y) === 0 || Y(y) < 8 || Y(y) > hgt - 8) continue;
    ctx.fillText(f(near(y)), Math.max(ay - 4, 36), Y(y));
  }
  ctx.textAlign = "right";
  ctx.textBaseline = "top";
  if (ax > 0 && ax < hgt && ay > 0 && ay < w) ctx.fillText("0", ay - 4, ax + 4);
  ctx.lineWidth = 2.5;
  ctx.lineJoin = "round";
  for (const row of visible()) {
    ctx.strokeStyle = row.color;
    ctx.beginPath();
    const key = `${v.xMin},${v.xMax},${v.yMin},${v.yMax},${w}|${row.input.value}`;
    if (row.runs?.key !== key) row.runs = { key, runs: sampleCurve(row.fn!, v, w * 2) };
    for (const run of row.runs.runs) {
      run.forEach(([x, y], i) => {
        // Clamp far-off points so the path stays drawable; the jump detector already split real breaks.
        const py = Math.max(-hgt * 4, Math.min(hgt * 5, Y(y)));
        if (i === 0) ctx.moveTo(X(x), py);
        else ctx.lineTo(X(x), py);
      });
    }
    ctx.stroke();
  }
  if (s.trace !== null && !target) {
    const x = s.trace;
    ctx.strokeStyle = "rgba(91, 74, 82, 0.5)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(X(x), 0);
    ctx.lineTo(X(x), hgt);
    ctx.stroke();
    ctx.setLineDash([]);
    for (const row of visible()) {
      const y = row.fn!(x);
      if (!Number.isFinite(y)) continue;
      ctx.fillStyle = row.color;
      ctx.beginPath();
      ctx.arc(X(x), Y(y), 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function readTrace(): void {
  if (!s) return;
  if (s.trace === null) {
    s.readout.textContent = t("graphingCalculator.traceHint");
    return;
  }
  const f = fmt();
  const x = s.trace;
  const parts = visible().map((r) => {
    const y = r.fn!(x);
    return `y${s!.rows.indexOf(r) + 1} = ${Number.isFinite(y) ? f(y) : t("graphingCalculator.undefinedValue")}`;
  });
  s.readout.textContent = [`x = ${f(x)}`, ...parts].join("   ");
}

/** Zeros, y-intercepts and crossings of the visible curves inside the current view. */
function listPoints(): void {
  if (!s) return;
  const f = fmt();
  const v = s.view;
  const rows = visible();
  const items: Array<{ text: string; color: string }> = [];
  const name = (r: Row) => `y${s!.rows.indexOf(r) + 1}`;
  const inY = (y: number) => y >= v.yMin && y <= v.yMax;
  for (const r of rows) {
    const y0 = r.fn!(0);
    if (v.xMin <= 0 && v.xMax >= 0 && Number.isFinite(y0) && inY(y0)) items.push({ text: t("graphingCalculator.yIntercept", { f: name(r), x: f(0), y: f(y0) }), color: r.color });
    if (inY(0)) for (const x of findZeros(r.fn!, v.xMin, v.xMax)) items.push({ text: t("graphingCalculator.zero", { f: name(r), x: f(x), y: f(0) }), color: r.color });
  }
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const a = rows[i].fn!;
      const b = rows[j].fn!;
      for (const x of findZeros((x) => a(x) - b(x), v.xMin, v.xMax)) {
        const y = a(x);
        if (Number.isFinite(y) && inY(y)) items.push({ text: t("graphingCalculator.crossing", { f: name(rows[i]), g: name(rows[j]), x: f(x), y: f(y) }), color: rows[i].color });
      }
    }
  }
  s.points.replaceChildren(
    ...(items.length
      ? items.slice(0, MAX_POINTS).map((it) => h("li", null, h("span", { class: "graph-swatch", style: { background: it.color }, "aria-hidden": "true" }), it.text))
      : [h("li", { class: "hint" }, t("graphingCalculator.noPoints"))]),
  );
}

function download(): void {
  if (!s) return;
  const out = document.createElement("canvas");
  out.width = s.canvas.width;
  out.height = s.canvas.height;
  draw(out);
  out.toBlob((blob) => {
    if (blob) downloadBlob(blob, "graph.png");
  }, "image/png");
}
