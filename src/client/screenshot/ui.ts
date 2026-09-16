import { canvasToBlob, decodeImage } from "../decode";
import { downloadBlob, h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { outputFilename } from "../../shared/filename";

type Kind = "rect" | "arrow" | "text";
type Mark = { kind: Kind; x: number; y: number; w: number; h: number; color: string; text: string; width: number };
type Item = { file: File; url: string; width: number; height: number; bitmap: ImageBitmap };

const state = {
  item: null as Item | null,
  kind: "rect" as Kind,
  color: "#c83f79",
  width: 6,
  text: "Note",
  marks: [] as Mark[],
  drag: null as null | { x: number; y: number },
};

let preview: HTMLCanvasElement | null = null;
let statusEl: HTMLElement | null = null;

export async function mountScreenshot(host: HTMLElement): Promise<void> {
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("screenshot.back")),
      h("h1", null, t("screenshot.title")),
      h("p", { class: "lede" }, t("screenshot.privacyNote")),
    ),
    h("div", { class: "tool" },
      filesRail(),
      stagePane(),
      controls(),
    ),
  );
  redraw();
  window.addEventListener("paste", onPaste);
}

export function unmountScreenshot(): void {
  window.removeEventListener("paste", onPaste);
  state.item?.bitmap.close();
  if (state.item) URL.revokeObjectURL(state.item.url);
  state.item = null;
  state.marks = [];
  state.drag = null;
  preview = null;
  statusEl = null;
}

function filesRail(): HTMLElement {
  const input = h("input", {
    type: "file",
    accept: "image/png,image/jpeg,image/webp,image/gif,image/*,.png,.jpg,.jpeg,.webp",
    class: "sr-only",
    id: "screenshot-file-input",
    onChange: (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) void setFile(file);
      (e.target as HTMLInputElement).value = "";
    },
  });
  const drop = h("label", {
    class: "drop",
    for: "screenshot-file-input",
    onDragover: (e: DragEvent) => {
      e.preventDefault();
      drop.classList.add("over");
    },
    onDragleave: () => drop.classList.remove("over"),
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      drop.classList.remove("over");
      const file = imageFromList(e.dataTransfer?.files);
      if (file) void setFile(file);
    },
  },
    input,
    h("strong", null, t("screenshot.dropTitle")),
    h("span", null, t("screenshot.dropHint")),
    h("em", null, t("screenshot.dropTypes")),
  );
  return h("aside", { class: "rail" },
    h("div", { class: "rail-h" }, h("h2", null, t("screenshot.filesTitle"))),
    drop,
  );
}

function stagePane(): HTMLElement {
  preview = h("canvas", {
    class: "preview",
    width: 800,
    height: 560,
    onPointerdown: onDown,
    onPointermove: onMove,
    onPointerup: onUp,
    onPointerleave: onUp,
  });
  statusEl = h("p", { class: "status", "aria-live": "polite" });
  return h("section", { class: "stage" },
    h("div", { class: "stage-frame" }, preview),
    h("p", { class: "hint" }, t("screenshot.hint")),
    h("div", { class: "stage-actions" },
      h("button", { type: "button", class: "btn ghost", onClick: () => undo() }, t("screenshot.undo")),
      h("button", { type: "button", class: "btn", onClick: () => void download() }, t("screenshot.download")),
    ),
    statusEl,
  );
}

function controls(): HTMLElement {
  return h("aside", { class: "rail controls" },
    h("fieldset", null,
      h("legend", null, t("screenshot.options")),
      h("div", { class: "chips convert-chips" },
        toolBtn("rect", t("screenshot.rect")),
        toolBtn("arrow", t("screenshot.arrow")),
        toolBtn("text", t("screenshot.text")),
      ),
      labeled(t("screenshot.color"), h("input", {
        type: "color",
        value: state.color,
        onInput: (e: Event) => {
          state.color = (e.target as HTMLInputElement).value;
        },
      })),
      labeled(t("screenshot.label"), h("input", {
        type: "text",
        value: state.text,
        onInput: (e: Event) => {
          state.text = (e.target as HTMLInputElement).value;
        },
      })),
    ),
  );
}

function toolBtn(kind: Kind, label: string): HTMLButtonElement {
  const btn = h("button", {
    type: "button",
    class: "chip" + (state.kind === kind ? " on" : ""),
    onClick: () => {
      state.kind = kind;
      for (const el of btn.parentElement?.querySelectorAll(".chip") || []) el.classList.remove("on");
      btn.classList.add("on");
    },
  }, label);
  return btn;
}

function labeled(label: string, control: HTMLElement): HTMLElement {
  return h("label", { class: "field" }, h("span", null, label), control);
}

function imageFromList(list?: FileList | null): File | null {
  return [...(list || [])].find((f) => f.type.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(f.name)) || null;
}

function onPaste(e: ClipboardEvent): void {
  const file = imageFromList(e.clipboardData?.files);
  if (file) {
    e.preventDefault();
    void setFile(file);
  }
}

async function setFile(file: File): Promise<void> {
  try {
    const decoded = await decodeImage(file);
    state.item?.bitmap.close();
    if (state.item) URL.revokeObjectURL(state.item.url);
    state.item = { file, url: URL.createObjectURL(file), ...decoded };
    state.marks = [];
    if (statusEl) statusEl.textContent = "";
    redraw();
  } catch {
    if (statusEl) statusEl.textContent = t("screenshot.errorDecode");
  }
}

function point(e: PointerEvent): { x: number; y: number } | null {
  if (!preview || !state.item) return null;
  const r = preview.getBoundingClientRect();
  return {
    x: ((e.clientX - r.left) / r.width) * state.item.width,
    y: ((e.clientY - r.top) / r.height) * state.item.height,
  };
}

function onDown(e: PointerEvent): void {
  const p = point(e);
  if (!p || !preview) return;
  preview.setPointerCapture(e.pointerId);
  state.drag = p;
  if (state.kind === "text") {
    state.marks.push({
      kind: "text",
      x: p.x,
      y: p.y,
      w: 0,
      h: 0,
      color: state.color,
      text: state.text || "Note",
      width: state.width,
    });
    state.drag = null;
    redraw();
  }
}

function onMove(e: PointerEvent): void {
  if (!state.drag || !state.item || !preview) return;
  const p = point(e);
  if (!p) return;
  redraw(p);
}

function onUp(e: PointerEvent): void {
  if (!state.drag || !state.item) return;
  const p = point(e) || state.drag;
  const mark: Mark = {
    kind: state.kind,
    x: state.drag.x,
    y: state.drag.y,
    w: p.x - state.drag.x,
    h: p.y - state.drag.y,
    color: state.color,
    text: state.text,
    width: state.width,
  };
  if (Math.hypot(mark.w, mark.h) > 4) state.marks.push(mark);
  state.drag = null;
  redraw();
}

function undo(): void {
  state.marks.pop();
  redraw();
}

function drawMark(ctx: CanvasRenderingContext2D, mark: Mark): void {
  ctx.save();
  ctx.strokeStyle = mark.color;
  ctx.fillStyle = mark.color;
  ctx.lineWidth = Math.max(2, mark.width);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (mark.kind === "rect") {
    ctx.strokeRect(mark.x, mark.y, mark.w, mark.h);
  } else if (mark.kind === "arrow") {
    const x2 = mark.x + mark.w;
    const y2 = mark.y + mark.h;
    const ang = Math.atan2(mark.h, mark.w);
    const head = 16 + mark.width;
    ctx.beginPath();
    ctx.moveTo(mark.x, mark.y);
    ctx.lineTo(x2, y2);
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - head * Math.cos(ang - 0.45), y2 - head * Math.sin(ang - 0.45));
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - head * Math.cos(ang + 0.45), y2 - head * Math.sin(ang + 0.45));
    ctx.stroke();
  } else {
    ctx.font = `${Math.max(18, Math.round(state.item ? state.item.width / 28 : 24))}px ui-sans-serif, system-ui, sans-serif`;
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#fff7fb";
    ctx.strokeText(mark.text, mark.x, mark.y);
    ctx.fillText(mark.text, mark.x, mark.y);
  }
  ctx.restore();
}

function compose(draft?: { x: number; y: number }): HTMLCanvasElement | null {
  const item = state.item;
  if (!item) return null;
  const canvas = document.createElement("canvas");
  canvas.width = item.width;
  canvas.height = item.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(item.bitmap, 0, 0);
  for (const mark of state.marks) drawMark(ctx, mark);
  if (draft && state.drag) {
    drawMark(ctx, {
      kind: state.kind,
      x: state.drag.x,
      y: state.drag.y,
      w: draft.x - state.drag.x,
      h: draft.y - state.drag.y,
      color: state.color,
      text: state.text,
      width: state.width,
    });
  }
  return canvas;
}

function redraw(draft?: { x: number; y: number }): void {
  if (!preview) return;
  const ctx = preview.getContext("2d");
  if (!ctx) return;
  const composed = compose(draft);
  if (!composed) {
    preview.width = 800;
    preview.height = 560;
    ctx.clearRect(0, 0, preview.width, preview.height);
    return;
  }
  const max = 1400;
  const scale = Math.min(1, max / Math.max(composed.width, composed.height));
  preview.width = Math.max(1, Math.round(composed.width * scale));
  preview.height = Math.max(1, Math.round(composed.height * scale));
  ctx.clearRect(0, 0, preview.width, preview.height);
  ctx.drawImage(composed, 0, 0, preview.width, preview.height);
}

async function download(): Promise<void> {
  if (!state.item) {
    if (statusEl) statusEl.textContent = t("screenshot.emptyDownload");
    return;
  }
  if (statusEl) statusEl.textContent = t("screenshot.working");
  try {
    const canvas = compose();
    if (!canvas) throw new Error("canvas");
    const blob = await canvasToBlob(canvas, "image/png", 1);
    downloadBlob(blob, outputFilename(state.item.file.name, blob.type, "-mark"));
    if (statusEl) statusEl.textContent = "";
  } catch {
    if (statusEl) statusEl.textContent = t("screenshot.errorEncode");
  }
}
