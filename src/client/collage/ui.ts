import { mimeForFormat, outputFilename } from "../../shared/filename";
import { downloadBlob, h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import {
  ASPECTS,
  type AspectId,
  type FitMode,
  LAYOUTS,
  type LayoutId,
  cellsFor,
  renderCollage,
} from "./engine";

type Item = {
  id: string;
  file: File;
  url: string;
  width: number;
  height: number;
  bitmap: ImageBitmap | null;
  error: string | null;
};

type Format = "png" | "jpeg" | "webp";

const state = {
  items: [] as Item[],
  layout: "2x2" as LayoutId,
  gap: 16,
  radius: 12,
  background: "#eef1f4",
  fit: "cover" as FitMode,
  aspect: "square" as AspectId,
  format: "png" as Format,
  quality: 0.92,
};

let preview: HTMLCanvasElement | null = null;
let fileList: HTMLElement | null = null;
let statusEl: HTMLElement | null = null;
let pagehideBound = false;

export function mountCollage(host: HTMLElement): void {
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("collage.back")),
      h("h1", null, t("collage.title")),
      h("p", { class: "lede" }, t("collage.privacyNote")),
    ),
    h("div", { class: "tool" },
      filesRail(),
      stagePane(),
      controlsRail(),
    ),
  );
  refreshList();
  redraw();
  bindGlobal();
  if (!pagehideBound) {
    pagehideBound = true;
    window.addEventListener("pagehide", () => clearItems());
  }
}

export function unmountCollage(): void {
  window.removeEventListener("paste", onPaste);
  preview = null;
  fileList = null;
  statusEl = null;
}

function filesRail(): HTMLElement {
  const input = h("input", {
    type: "file",
    accept: "image/png,image/jpeg,image/webp,image/gif,image/*",
    multiple: true,
    class: "sr-only",
    id: "collage-file-input",
    onChange: (e: Event) => {
      const files = (e.target as HTMLInputElement).files;
      if (files) void addFiles(files);
      (e.target as HTMLInputElement).value = "";
    },
  });
  fileList = h("ul", { class: "file-list" });
  const drop = h("label", {
    class: "drop",
    for: "collage-file-input",
    onDragover: (e: DragEvent) => {
      e.preventDefault();
      drop.classList.add("over");
    },
    onDragleave: () => drop.classList.remove("over"),
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      drop.classList.remove("over");
      if (e.dataTransfer?.files) void addFiles(e.dataTransfer.files);
    },
  },
    input,
    h("strong", null, t("collage.dropTitle")),
    h("span", null, t("collage.dropHint")),
    h("em", null, t("collage.dropTypes")),
  );
  return h("aside", { class: "rail" },
    h("div", { class: "rail-h" },
      h("h2", null, t("collage.filesTitle")),
      h("button", { type: "button", class: "link", onClick: () => clearItems() }, t("collage.clear")),
    ),
    drop,
    fileList,
  );
}

function stagePane(): HTMLElement {
  preview = h("canvas", { class: "preview", width: 800, height: 800 });
  statusEl = h("p", { class: "status", "aria-live": "polite" });
  const hint = h("p", { class: "hint" }, t("collage.filesEmpty"));
  return h("section", { class: "stage" },
    h("div", { class: "stage-frame" }, preview),
    hint,
    h("div", { class: "stage-actions" },
      h("button", { type: "button", class: "btn", onClick: () => void download() }, t("collage.download")),
    ),
    statusEl,
  );
}

function controlsRail(): HTMLElement {
  return h("aside", { class: "rail controls" },
    h("fieldset", null,
      h("legend", null, t("collage.layoutTitle")),
      layoutPicker(),
    ),
    h("fieldset", null,
      h("legend", null, t("collage.lookTitle")),
      labeled(t("collage.aspect"),
        h("select", {
          onChange: (e: Event) => {
            state.aspect = (e.target as HTMLSelectElement).value as AspectId;
            redraw();
          },
        },
          h("option", { value: "square", selected: true }, t("collage.aspectSquare")),
          h("option", { value: "story" }, t("collage.aspectStory")),
          h("option", { value: "portrait" }, t("collage.aspectPortrait")),
          h("option", { value: "landscape" }, t("collage.aspectLandscape")),
        ),
      ),
      labeled(t("collage.fit"),
        h("select", {
          onChange: (e: Event) => {
            state.fit = (e.target as HTMLSelectElement).value as FitMode;
            redraw();
          },
        },
          h("option", { value: "cover", selected: true }, t("collage.fitCover")),
          h("option", { value: "contain" }, t("collage.fitContain")),
        ),
      ),
      labeled(t("collage.background"),
        h("input", {
          type: "color",
          value: "#eef1f4",
          onInput: (e: Event) => {
            state.background = (e.target as HTMLInputElement).value;
            redraw();
          },
        }),
      ),
      slider("cg-gap", t("collage.gap"), 0, 48, 1, state.gap, (v) => { state.gap = v; }),
      slider("cg-radius", t("collage.radius"), 0, 48, 1, state.radius, (v) => { state.radius = v; }),
    ),
    h("fieldset", null,
      h("legend", null, t("collage.exportTitle")),
      labeled(t("collage.format"),
        h("select", {
          onChange: (e: Event) => {
            state.format = (e.target as HTMLSelectElement).value as Format;
          },
        },
          h("option", { value: "png", selected: true }, "PNG"),
          h("option", { value: "jpeg" }, "JPEG"),
          h("option", { value: "webp" }, "WebP"),
        ),
      ),
      slider("cg-quality", t("collage.quality"), 0.4, 1, 0.01, state.quality, (v) => { state.quality = v; }),
    ),
  );
}

function layoutPicker(): HTMLElement {
  const wrap = h("div", { class: "layout-grid" });
  for (const id of LAYOUTS) {
    const count = cellsFor(id).length;
    const marks = Array.from({ length: count }, () => h("i"));
    const btn = h("button", {
      type: "button",
      class: "layout-btn" + (id === state.layout ? " on" : ""),
      "aria-label": t(`collage.layout.${id}`),
      "aria-pressed": String(id === state.layout),
      onClick: () => {
        state.layout = id;
        wrap.querySelectorAll(".layout-btn").forEach((el) => {
          el.classList.toggle("on", el === btn);
          el.setAttribute("aria-pressed", String(el === btn));
        });
        refreshList();
        redraw();
      },
    }, h("span", { class: `mini g-${id}` }, ...marks));
    wrap.append(btn);
  }
  return wrap;
}

function labeled(label: string, control: HTMLElement): HTMLElement {
  return h("label", { class: "field" }, h("span", null, label), control);
}

function slider(
  id: string,
  label: string,
  min: number,
  max: number,
  step: number,
  value: number,
  onValue: (n: number) => void,
): HTMLElement {
  const input = h("input", {
    id,
    type: "range",
    min: String(min),
    max: String(max),
    step: String(step),
    value: String(value),
    onInput: (e: Event) => {
      onValue(Number((e.target as HTMLInputElement).value));
      redraw();
    },
  });
  return labeled(label, input);
}

function bindGlobal(): void {
  window.addEventListener("paste", onPaste);
}

function onPaste(e: ClipboardEvent): void {
  const files = [...(e.clipboardData?.files || [])].filter((f) => f.type.startsWith("image/"));
  if (files.length) {
    e.preventDefault();
    void addFiles(files);
  }
}

async function addFiles(list: FileList | File[]): Promise<void> {
  const files = [...list].filter((f) => f.type.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(f.name));
  for (const file of files) {
    const id = crypto.randomUUID();
    const url = URL.createObjectURL(file);
    const item: Item = { id, file, url, width: 0, height: 0, bitmap: null, error: null };
    state.items.push(item);
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      item.bitmap = bitmap;
      item.width = bitmap.width;
      item.height = bitmap.height;
    } catch {
      item.error = t("collage.errorDecode");
    }
  }
  refreshList();
  redraw();
}

function removeItem(id: string): void {
  const idx = state.items.findIndex((it) => it.id === id);
  if (idx < 0) return;
  const [item] = state.items.splice(idx, 1);
  item.bitmap?.close();
  URL.revokeObjectURL(item.url);
  refreshList();
  redraw();
}

function moveItem(id: string, dir: -1 | 1): void {
  const idx = state.items.findIndex((it) => it.id === id);
  const next = idx + dir;
  if (idx < 0 || next < 0 || next >= state.items.length) return;
  const [item] = state.items.splice(idx, 1);
  state.items.splice(next, 0, item);
  refreshList();
  redraw();
}

function clearItems(): void {
  for (const item of state.items) {
    item.bitmap?.close();
    URL.revokeObjectURL(item.url);
  }
  state.items = [];
  refreshList();
  redraw();
}

function refreshList(): void {
  if (!fileList) return;
  fileList.replaceChildren();
  if (state.items.length === 0) {
    fileList.append(h("li", { class: "muted" }, t("collage.filesEmpty")));
    return;
  }
  const slots = cellsFor(state.layout).length;
  state.items.forEach((item, i) => {
    fileList!.append(
      h("li", { class: "file" + (i < slots ? " on" : "") },
        h("img", { src: item.url, alt: item.file.name }),
        h("div", null,
          h("strong", null, item.file.name),
          h("span", null, item.error || `${item.width}×${item.height}`),
        ),
        h("div", { class: "file-ops" },
          h("button", {
            type: "button",
            class: "icon",
            "aria-label": t("collage.up"),
            onClick: () => moveItem(item.id, -1),
          }, "↑"),
          h("button", {
            type: "button",
            class: "icon",
            "aria-label": t("collage.down"),
            onClick: () => moveItem(item.id, 1),
          }, "↓"),
          h("button", {
            type: "button",
            class: "icon",
            "aria-label": t("collage.remove"),
            onClick: () => removeItem(item.id),
          }, "×"),
        ),
      ),
    );
  });
}

function rootHint(): HTMLElement | null {
  return document.querySelector(".stage .hint");
}

function slotsForRender() {
  return state.items.map((item) =>
    item.bitmap
      ? { image: item.bitmap, naturalWidth: item.width, naturalHeight: item.height }
      : null,
  );
}

function redraw(): void {
  if (!preview) return;
  const hint = rootHint();
  if (hint) hint.hidden = state.items.length > 0;
  const aspect = ASPECTS[state.aspect];
  const max = 900;
  const scale = Math.min(1, max / Math.max(aspect.w, aspect.h));
  const w = Math.max(1, Math.round(aspect.w * scale));
  const h = Math.max(1, Math.round(aspect.h * scale));
  const rendered = renderCollage(slotsForRender(), state.layout, {
    width: w,
    height: h,
    gap: state.gap * scale,
    radius: state.radius * scale,
    background: state.background,
    fit: state.fit,
  });
  preview.width = w;
  preview.height = h;
  const ctx = preview.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(rendered, 0, 0);
}

async function download(): Promise<void> {
  const ready = state.items.some((it) => it.bitmap);
  if (!ready) {
    if (statusEl) statusEl.textContent = t("collage.emptyDownload");
    return;
  }
  if (statusEl) statusEl.textContent = t("collage.working");
  try {
    const aspect = ASPECTS[state.aspect];
    const canvas = renderCollage(slotsForRender(), state.layout, {
      width: aspect.w,
      height: aspect.h,
      gap: state.gap,
      radius: state.radius,
      background: state.background,
      fit: state.fit,
    });
    const mime = mimeForFormat(state.format);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob"))), mime, state.quality);
    });
    downloadBlob(blob, outputFilename("collage.png", blob.type, ""));
    if (statusEl) statusEl.textContent = "";
  } catch {
    if (statusEl) statusEl.textContent = t("collage.errorDecode");
  }
}
