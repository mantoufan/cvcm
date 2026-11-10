import { mimeForFormat, safeStem } from "../../shared/filename";
import { MAX_GRID, SPLIT_PRESETS, clampGrid, cropArea, postingOrder, splitGrid, tileName, type Tile } from "../../shared/image-split";
import { zipStore } from "../../shared/zip";
import { canvasToBlob, decodeImage } from "../decode";
import { downloadBlob, h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";

type Format = "png" | "jpeg" | "webp";
type Source = { file: File; bitmap: ImageBitmap; width: number; height: number };
type Piece = { tile: Tile; blob: Blob; url: string; name: string };

const state = {
  source: null as Source | null,
  rows: 3,
  cols: 3,
  square: true,
  format: "png" as Format,
  showOrder: false,
  /** Set once the user picks a format; until then each new picture keeps its own kind. */
  formatChosen: false,
  pieces: [] as Piece[],
  /** Bumped by every change, so a slow split that finishes late does not show stale tiles. */
  run: 0,
  /** Bumped by each new picture, so a slower earlier load does not replace it (separate from `run`: Split must not cancel a load). */
  load: 0,
};

let preview: HTMLCanvasElement | null = null;
let statusEl: HTMLElement | null = null;
let infoEl: HTMLElement | null = null;
let galleryEl: HTMLElement | null = null;
let rowsEl: HTMLInputElement | null = null;
let colsEl: HTMLInputElement | null = null;
let squareEl: HTMLInputElement | null = null;
let formatEl: HTMLSelectElement | null = null;

export function mountImageSplitter(host: HTMLElement): void {
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("imageSplitter.back")),
      h("h1", null, t("imageSplitter.title")),
      h("p", { class: "lede" }, t("imageSplitter.privacyNote")),
    ),
    h("div", { class: "tool" }, filesRail(), stagePane(), controls()),
  );
  window.addEventListener("paste", onPaste);
  paint();
}

export function unmountImageSplitter(): void {
  window.removeEventListener("paste", onPaste);
  dropPieces();
  state.source?.bitmap.close();
  state.source = null;
  state.run++;
  state.load++;
  preview = statusEl = infoEl = galleryEl = null;
  rowsEl = colsEl = squareEl = null;
  formatEl = null;
  state.formatChosen = false;
}

function filesRail(): HTMLElement {
  const input = h("input", {
    type: "file",
    accept: "image/png,image/jpeg,image/webp,image/gif,image/avif,image/heic,image/heif,image/*",
    class: "sr-only",
    id: "split-file-input",
    "data-field": "file",
    onChange: (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) void setFile(file);
      (e.target as HTMLInputElement).value = "";
    },
  });
  const drop = h("label", {
    class: "drop",
    for: "split-file-input",
    onDragover: (e: DragEvent) => {
      e.preventDefault();
      drop.classList.add("over");
    },
    onDragleave: () => drop.classList.remove("over"),
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      drop.classList.remove("over");
      const file = [...(e.dataTransfer?.files ?? [])].find(isImage);
      if (file) void setFile(file);
    },
  },
    input,
    h("strong", null, t("imageSplitter.dropTitle")),
    h("span", null, t("imageSplitter.dropHint")),
    h("em", null, t("imageSplitter.dropTypes")),
  );
  return h("aside", { class: "rail" }, h("div", { class: "rail-h" }, h("h2", null, t("imageSplitter.filesTitle"))), drop);
}

function stagePane(): HTMLElement {
  preview = h("canvas", { class: "preview", width: 800, height: 560, "data-out": "preview" });
  statusEl = h("p", { class: "status", "aria-live": "polite", "data-out": "status" });
  infoEl = h("p", { class: "muted", "data-out": "info" });
  galleryEl = h("ol", { class: "split-gallery", "data-out": "tiles" });
  return h("section", { class: "stage" },
    h("div", { class: "stage-frame" }, preview),
    infoEl,
    h("div", { class: "stage-actions" },
      h("button", { type: "button", class: "btn", "data-action": "split", onClick: () => void split() }, t("imageSplitter.split")),
      h("button", { type: "button", class: "btn ghost", "data-action": "zip", onClick: () => void downloadZip() }, t("imageSplitter.downloadZip")),
    ),
    statusEl,
    galleryEl,
  );
}

function controls(): HTMLElement {
  const num = (value: number, onInput: (n: number) => void, get: () => number) => {
    const el = h("input", {
      type: "number",
      min: "1",
      max: String(MAX_GRID),
      step: "1",
      inputmode: "numeric",
      value: String(value),
      onInput: () => {
        // A half-typed box keeps the last good value.
        if (el.value.trim() === "" || !Number.isFinite(Number(el.value))) return;
        const n = clampGrid(Number(el.value));
        if (n !== get()) onInput(n);
      },
      // Leaving the box shows the value in use: clamped, or the last good one for a blank or broken entry.
      onChange: () => { el.value = String(get()); },
    });
    return el;
  };
  rowsEl = num(state.rows, (n) => { state.rows = n; changed(); }, () => state.rows);
  rowsEl.dataset.field = "rows";
  colsEl = num(state.cols, (n) => { state.cols = n; changed(); }, () => state.cols);
  colsEl.dataset.field = "cols";
  squareEl = h("input", { type: "checkbox", checked: state.square, "data-field": "square", onChange: () => { state.square = squareEl!.checked; changed(); } });
  const order = h("input", { type: "checkbox", checked: state.showOrder, "data-field": "order", onChange: () => { state.showOrder = order.checked; paint(); renderGallery(); } });
  formatEl = h("select", { "data-field": "format", onChange: () => { state.format = formatEl!.value as Format; state.formatChosen = true; changed(); } },
    h("option", { value: "png", selected: state.format === "png" }, "PNG"),
    h("option", { value: "jpeg", selected: state.format === "jpeg" }, "JPG"),
    h("option", { value: "webp", selected: state.format === "webp" }, "WebP"),
  );
  return h("aside", { class: "rail controls" },
    h("fieldset", null,
      h("legend", null, t("imageSplitter.gridTitle")),
      h("div", { class: "chip-row" }, ...SPLIT_PRESETS.map((p) => h("button", {
        type: "button",
        class: "chip",
        "data-preset": p.id,
        onClick: () => {
          state.rows = p.rows;
          state.cols = p.cols;
          state.square = p.square;
          if (rowsEl) rowsEl.value = String(p.rows);
          if (colsEl) colsEl.value = String(p.cols);
          if (squareEl) squareEl.checked = p.square;
          changed();
        },
      }, t(`imageSplitter.preset_${p.id}`)))),
      labeled(t("imageSplitter.rows"), rowsEl),
      labeled(t("imageSplitter.cols"), colsEl),
      h("label", { class: "check" }, squareEl, h("span", null, t("imageSplitter.square"))),
      h("label", { class: "check" }, order, h("span", null, t("imageSplitter.showOrder"))),
      labeled(t("imageSplitter.format"), formatEl),
    ),
    h("p", { class: "hint" }, t("imageSplitter.hint")),
  );
}

function labeled(label: string, control: HTMLElement): HTMLElement {
  return h("label", { class: "field" }, h("span", null, label), control);
}

function isImage(f: File): boolean {
  return f.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp|avif|heic|heif)$/i.test(f.name);
}

function onPaste(e: ClipboardEvent): void {
  const file = [...(e.clipboardData?.files ?? [])].find(isImage);
  if (!file) return;
  e.preventDefault();
  void setFile(file);
}

async function setFile(file: File): Promise<void> {
  const load = ++state.load;
  if (statusEl) statusEl.textContent = t("imageSplitter.loading");
  try {
    const decoded = await decodeImage(file);
    if (load !== state.load || !preview) {
      decoded.bitmap.close();
      return;
    }
    state.source?.bitmap.close();
    state.source = { file, ...decoded };
    // Keep the original kind where we can write it (anything else becomes PNG), unless the user picked a format.
    if (!state.formatChosen) {
      state.format = file.type === "image/jpeg" ? "jpeg" : file.type === "image/webp" ? "webp" : "png";
      if (formatEl) formatEl.value = state.format;
    }
    if (statusEl) statusEl.textContent = "";
    changed();
  } catch {
    if (load === state.load && statusEl) statusEl.textContent = t("imageSplitter.errorDecode");
  }
}

function tiles(): Tile[] {
  const s = state.source;
  if (!s) return [];
  return splitGrid(cropArea(s.width, s.height, state.rows, state.cols, state.square), state.rows, state.cols);
}

/** Any setting changed: the old tiles no longer match. */
function changed(): void {
  state.run++;
  // A split in progress was just cancelled, and old messages no longer apply.
  if (statusEl) statusEl.textContent = "";
  dropPieces();
  paint();
}

function dropPieces(): void {
  for (const p of state.pieces) URL.revokeObjectURL(p.url);
  state.pieces = [];
  galleryEl?.replaceChildren();
}

/** The picture with the grid on top, trimmed areas dimmed, and each tile's number. */
function paint(): void {
  if (!preview || !infoEl) return;
  const s = state.source;
  const ctx = preview.getContext("2d");
  if (!s) {
    ctx?.clearRect(0, 0, preview.width, preview.height);
    infoEl.textContent = t("imageSplitter.empty");
    return;
  }
  if (!ctx) return;
  const scale = Math.min(1, 1400 / Math.max(s.width, s.height));
  preview.width = Math.max(1, Math.round(s.width * scale));
  preview.height = Math.max(1, Math.round(s.height * scale));
  ctx.drawImage(s.bitmap, 0, 0, preview.width, preview.height);
  const list = tiles();
  const area = cropArea(s.width, s.height, state.rows, state.cols, state.square);
  if (tooFine(list)) {
    infoEl.textContent = t("imageSplitter.tooFine", { W: s.width, H: s.height });
    return;
  }
  // Dim what the square crop trims off.
  ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
  ctx.fillRect(0, 0, preview.width, area.y * scale);
  ctx.fillRect(0, (area.y + area.height) * scale, preview.width, preview.height - (area.y + area.height) * scale);
  ctx.fillRect(0, area.y * scale, area.x * scale, area.height * scale);
  ctx.fillRect((area.x + area.width) * scale, area.y * scale, preview.width - (area.x + area.width) * scale, area.height * scale);
  const line = Math.max(2, Math.round(preview.width / 300));
  ctx.lineWidth = line;
  const order = postingOrder(list.length);
  const font = Math.max(14, Math.round(Math.min(...list.map((tl) => Math.min(tl.width, tl.height))) * scale * 0.18));
  ctx.font = `700 ${font}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const tile of list) {
    const x = tile.x * scale;
    const y = tile.y * scale;
    const w = tile.width * scale;
    const hgt = tile.height * scale;
    ctx.strokeStyle = "#ffffff";
    ctx.strokeRect(x, y, w, hgt);
    ctx.strokeStyle = "#e0457b";
    ctx.lineWidth = Math.max(1, line / 2);
    ctx.strokeRect(x, y, w, hgt);
    ctx.lineWidth = line;
    const label = String(state.showOrder ? order[tile.index] : tile.index + 1);
    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    ctx.beginPath();
    ctx.arc(x + w / 2, y + hgt / 2, font * 0.85, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.fillText(label, x + w / 2, y + hgt / 2);
  }
  const first = list[0]!;
  const even = list.every((tl) => tl.width === first.width && tl.height === first.height);
  infoEl.textContent = t(even ? "imageSplitter.info" : "imageSplitter.infoUneven", {
    n: list.length,
    w: first.width,
    h: first.height,
    W: s.width,
    H: s.height,
  });
}

/** Cuts every tile to a Blob and lists them, each a link that saves that tile. */
async function split(): Promise<Piece[] | null> {
  const s = state.source;
  if (!s) {
    if (statusEl) statusEl.textContent = t("imageSplitter.needImage");
    return null;
  }
  if (state.pieces.length) return state.pieces;
  if (tooFine(tiles())) {
    if (statusEl) statusEl.textContent = t("imageSplitter.tooFine", { W: s.width, H: s.height });
    return null;
  }
  const run = ++state.run;
  if (statusEl) statusEl.textContent = t("imageSplitter.working");
  const stem = safeStem(s.file.name, "image");
  const mime = mimeForFormat(state.format);
  const pieces: Piece[] = [];
  try {
    for (const tile of tiles()) {
      const canvas = document.createElement("canvas");
      canvas.width = tile.width;
      canvas.height = tile.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas");
      // JPG has no transparency: put white under clear pixels instead of black.
      if (state.format === "jpeg") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, tile.width, tile.height);
      }
      ctx.drawImage(s.bitmap, tile.x, tile.y, tile.width, tile.height, 0, 0, tile.width, tile.height);
      const blob = await canvasToBlob(canvas, mime, 0.92);
      if (run !== state.run) {
        for (const p of pieces) URL.revokeObjectURL(p.url);
        return null;
      }
      // Name by what the browser actually wrote: Safari has no WebP encoder and hands back PNG.
      const ext = blob.type === "image/jpeg" ? "jpg" : blob.type === "image/webp" ? "webp" : "png";
      pieces.push({ tile, blob, url: URL.createObjectURL(blob), name: tileName(stem, tile, state.rows, state.cols, ext) });
    }
  } catch {
    for (const p of pieces) URL.revokeObjectURL(p.url);
    if (run === state.run && statusEl) statusEl.textContent = t("imageSplitter.errorDecode");
    return null;
  }
  state.pieces = pieces;
  renderGallery();
  if (statusEl) statusEl.textContent = t("imageSplitter.done", { n: pieces.length });
  return pieces;
}

async function downloadZip(): Promise<void> {
  // Name the ZIP for the picture and grid of these tiles, even if another picture loads while it is packed.
  const source = state.source;
  const zipName = source ? `${safeStem(source.file.name, "image")}-${state.rows}x${state.cols}.zip` : "";
  const pieces = await split();
  if (!pieces || !source || source !== state.source) return;
  const entries = [];
  for (const p of pieces) entries.push({ name: p.name, data: new Uint8Array(await p.blob.arrayBuffer()) });
  const zip = zipStore(entries);
  const packed = new ArrayBuffer(zip.byteLength);
  new Uint8Array(packed).set(zip);
  downloadBlob(new Blob([packed], { type: "application/zip" }), zipName);
}

/** Every tile needs at least one pixel each way: a grid finer than the picture cannot be cut. */
function tooFine(list: Tile[]): boolean {
  return list.length === 0 || list.some((tl) => tl.width < 1 || tl.height < 1);
}

/** The cut tiles, each a button that saves it, labelled by file name or by posting order. */
function renderGallery(): void {
  const order = postingOrder(state.pieces.length);
  galleryEl?.replaceChildren(...state.pieces.map((p) => h("li", { class: "split-tile" },
    h("button", { type: "button", class: "split-save", title: t("imageSplitter.saveTile", { name: p.name }), onClick: () => downloadBlob(p.blob, p.name) },
      h("img", { src: p.url, alt: t("imageSplitter.tileAlt", { row: p.tile.row + 1, col: p.tile.col + 1 }), width: p.tile.width, height: p.tile.height }),
      h("span", null, state.showOrder ? t("imageSplitter.postN", { n: order[p.tile.index]! }) : p.name),
    ),
  )));
}
