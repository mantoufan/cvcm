import { canvasToBlob } from "../decode";
import { downloadBlob, h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { clampBounds, hasInk, strokeBounds, type Point, type Stroke } from "../../shared/signature";

const W = 900;
const H = 320;

const strokes: Stroke[] = [];
let current: Stroke | null = null;
let color = "#3a2030";
let width = 3;
let canvas: HTMLCanvasElement | null = null;
let statusEl: HTMLElement | null = null;

export function mountSignature(host: HTMLElement): void {
  canvas = h("canvas", {
    class: "signature-pad",
    width: W,
    height: H,
    onPointerdown: onDown,
    onPointermove: onMove,
    onPointerup: onUp,
    onPointercancel: onUp,
  });
  canvas.style.touchAction = "none";
  statusEl = h("p", { class: "status", "aria-live": "polite" });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("signature.back")),
      h("h1", null, t("signature.title")),
      h("p", { class: "lede" }, t("signature.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("signature.options")),
          labeled(t("signature.color"),
            h("input", {
              type: "color",
              value: color,
              onInput: (e: Event) => {
                color = (e.target as HTMLInputElement).value;
              },
            }),
          ),
          labeled(t("signature.width"),
            h("input", {
              type: "range",
              min: "1",
              max: "10",
              step: "1",
              value: String(width),
              onInput: (e: Event) => {
                width = Number((e.target as HTMLInputElement).value);
              },
            }),
          ),
        ),
        h("div", { class: "stage-actions" },
          h("button", { type: "button", class: "btn", onClick: () => void download() }, t("signature.download")),
          h("button", { type: "button", class: "btn ghost", onClick: () => undo() }, t("signature.undo")),
          h("button", { type: "button", class: "btn ghost", onClick: () => clearPad() }, t("signature.clear")),
        ),
        statusEl,
      ),
      h("div", { class: "rail signature-stage" },
        h("h2", null, t("signature.pad")),
        canvas,
        h("p", { class: "hint" }, t("signature.hint")),
      ),
    ),
  );
  paint();
}

export function unmountSignature(): void {
  strokes.length = 0;
  current = null;
  canvas = null;
  statusEl = null;
}

function labeled(label: string, control: HTMLElement): HTMLElement {
  return h("label", { class: "field" }, h("span", null, label), control);
}

function point(e: PointerEvent): Point | null {
  if (!canvas) return null;
  const rect = canvas.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) return null;
  return {
    x: (e.clientX - rect.left) * (canvas.width / rect.width),
    y: (e.clientY - rect.top) * (canvas.height / rect.height),
  };
}

function onDown(e: PointerEvent): void {
  if (!canvas) return;
  e.preventDefault();
  canvas.setPointerCapture(e.pointerId);
  const p = point(e);
  if (!p) return;
  current = [p];
  if (statusEl) statusEl.textContent = "";
  paint();
}

function onMove(e: PointerEvent): void {
  if (!current) return;
  e.preventDefault();
  const p = point(e);
  if (!p) return;
  current.push(p);
  paint();
}

function onUp(e: PointerEvent): void {
  if (!current) return;
  if (canvas?.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
  if (current.length) strokes.push(current);
  current = null;
  paint();
}

function undo(): void {
  strokes.pop();
  current = null;
  paint();
}

function clearPad(): void {
  strokes.length = 0;
  current = null;
  paint();
}

function allStrokes(): Stroke[] {
  return current ? [...strokes, current] : strokes;
}

function paint(): void {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fff7fb";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawStrokes(ctx, allStrokes(), 0, 0);
}

function drawStrokes(ctx: CanvasRenderingContext2D, list: Stroke[], ox: number, oy: number): void {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  for (const stroke of list) {
    if (!stroke.length) continue;
    ctx.beginPath();
    ctx.moveTo(stroke[0]!.x - ox, stroke[0]!.y - oy);
    for (let i = 1; i < stroke.length; i++) ctx.lineTo(stroke[i]!.x - ox, stroke[i]!.y - oy);
    if (stroke.length === 1) ctx.lineTo(stroke[0]!.x - ox + 0.01, stroke[0]!.y - oy);
    ctx.stroke();
  }
}

async function download(): Promise<void> {
  if (!hasInk(strokes)) {
    if (statusEl) statusEl.textContent = t("signature.empty");
    return;
  }
  const raw = strokeBounds(strokes, Math.ceil(width + 16));
  if (!raw || !canvas) return;
  const box = clampBounds(raw, canvas.width, canvas.height);
  const out = document.createElement("canvas");
  out.width = box.w;
  out.height = box.h;
  const ctx = out.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, box.w, box.h);
  drawStrokes(ctx, strokes, box.x, box.y);
  const blob = await canvasToBlob(out, "image/png", 1);
  downloadBlob(blob, "cvcm-signature.png");
  if (statusEl) statusEl.textContent = "";
}
