import { mimeForFormat, outputFilename, type ImageFormat } from "../../shared/filename";
import { zipStore } from "../../shared/zip";
import { blobFromBytes } from "../../shared/image-encode";
import { canvasToBlob } from "../decode";
import { downloadBlob, h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { openPdf, renderPdfPage } from "../pdfjs";
import type { PDFDocumentProxy } from "pdfjs-dist";

type Item = { file: File; pages: number; doc: PDFDocumentProxy };

const state = {
  item: null as Item | null,
  page: 1,
  scale: 2,
  format: "jpeg" as ImageFormat,
  quality: 0.85,
};

let preview: HTMLCanvasElement | null = null;
let statusEl: HTMLElement | null = null;
let metaEl: HTMLElement | null = null;
let pageEl: HTMLInputElement | null = null;

export async function mountPdfJpg(host: HTMLElement): Promise<void> {
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("pdfJpg.back")),
      h("h1", null, t("pdfJpg.title")),
      h("p", { class: "lede" }, t("pdfJpg.privacyNote")),
    ),
    h("div", { class: "tool" },
      filesRail(),
      stagePane(),
      controls(),
    ),
  );
  window.addEventListener("paste", onPaste);
}

export function unmountPdfJpg(): void {
  window.removeEventListener("paste", onPaste);
  void state.item?.doc.cleanup();
  state.item = null;
  preview = null;
  statusEl = null;
  metaEl = null;
  pageEl = null;
}

function filesRail(): HTMLElement {
  const input = h("input", {
    type: "file",
    accept: "application/pdf,.pdf",
    class: "sr-only",
    id: "pdf-jpg-file-input",
    onChange: (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) void setFile(file);
      (e.target as HTMLInputElement).value = "";
    },
  });
  const drop = h("label", {
    class: "drop",
    for: "pdf-jpg-file-input",
    onDragover: (e: DragEvent) => {
      e.preventDefault();
      drop.classList.add("over");
    },
    onDragleave: () => drop.classList.remove("over"),
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      drop.classList.remove("over");
      const file = pdfFromList(e.dataTransfer?.files);
      if (file) void setFile(file);
    },
  },
    input,
    h("strong", null, t("pdfJpg.dropTitle")),
    h("span", null, t("pdfJpg.dropHint")),
    h("em", null, t("pdfJpg.dropTypes")),
  );
  return h("aside", { class: "rail" },
    h("div", { class: "rail-h" }, h("h2", null, t("pdfJpg.filesTitle"))),
    drop,
    metaEl = h("p", { class: "muted" }),
  );
}

function stagePane(): HTMLElement {
  preview = h("canvas", { class: "preview", width: 800, height: 560 });
  statusEl = h("p", { class: "status", "aria-live": "polite" });
  return h("section", { class: "stage" },
    h("div", { class: "stage-frame" }, preview),
    h("p", { class: "hint" }, t("pdfJpg.hint")),
    h("div", { class: "stage-actions" },
      h("button", { type: "button", class: "btn", onClick: () => void downloadOne() }, t("pdfJpg.downloadPage")),
      h("button", { type: "button", class: "btn ghost", onClick: () => void downloadAll() }, t("pdfJpg.downloadAll")),
    ),
    statusEl,
  );
}

function controls(): HTMLElement {
  pageEl = h("input", {
    type: "number",
    min: "1",
    step: "1",
    value: "1",
    onChange: () => {
      const n = Math.max(1, Number(pageEl?.value) || 1);
      state.page = state.item ? Math.min(n, state.item.pages) : n;
      if (pageEl) pageEl.value = String(state.page);
      void redraw();
    },
  });
  return h("aside", { class: "rail controls" },
    h("fieldset", null,
      h("legend", null, t("pdfJpg.exportTitle")),
      labeled(t("pdfJpg.page"), pageEl),
      labeled(t("pdfJpg.scale"),
        h("select", {
          onChange: (e: Event) => {
            state.scale = Number((e.target as HTMLSelectElement).value);
            void redraw();
          },
        },
          h("option", { value: "1" }, t("pdfJpg.scale1")),
          h("option", { value: "2", selected: true }, t("pdfJpg.scale2")),
        ),
      ),
      labeled(t("pdfJpg.format"),
        h("select", {
          onChange: (e: Event) => {
            state.format = (e.target as HTMLSelectElement).value as ImageFormat;
          },
        },
          h("option", { value: "jpeg", selected: true }, "JPG"),
          h("option", { value: "png" }, "PNG"),
          h("option", { value: "webp" }, "WebP"),
        ),
      ),
      labeled(t("pdfJpg.quality"),
        h("input", {
          type: "range",
          min: "0.4",
          max: "1",
          step: "0.01",
          value: String(state.quality),
          onInput: (e: Event) => {
            state.quality = Number((e.target as HTMLInputElement).value);
          },
        }),
      ),
    ),
  );
}

function labeled(label: string, control: HTMLElement): HTMLElement {
  return h("label", { class: "field" }, h("span", null, label), control);
}

function pdfFromList(list?: FileList | null): File | null {
  return [...(list || [])].find((f) => f.type === "application/pdf" || /\.pdf$/i.test(f.name)) || null;
}

function onPaste(e: ClipboardEvent): void {
  const file = pdfFromList(e.clipboardData?.files);
  if (file) {
    e.preventDefault();
    void setFile(file);
  }
}

async function setFile(file: File): Promise<void> {
  if (statusEl) statusEl.textContent = t("pdfJpg.working");
  try {
    const doc = await openPdf(await file.arrayBuffer());
    state.item?.doc.cleanup();
    state.item = { file, pages: doc.numPages, doc };
    state.page = 1;
    if (pageEl) {
      pageEl.max = String(doc.numPages);
      pageEl.value = "1";
    }
    if (metaEl) metaEl.textContent = t("pdfJpg.meta", { pages: doc.numPages, name: file.name });
    if (statusEl) statusEl.textContent = "";
    await redraw();
  } catch {
    if (statusEl) statusEl.textContent = t("pdfJpg.errorDecode");
  }
}

async function redraw(): Promise<void> {
  if (!preview || !state.item) return;
  try {
    const canvas = await renderPdfPage(state.item.doc, state.page, 1);
    const ctx = preview.getContext("2d");
    if (!ctx) return;
    preview.width = canvas.width;
    preview.height = canvas.height;
    ctx.clearRect(0, 0, preview.width, preview.height);
    ctx.drawImage(canvas, 0, 0);
  } catch {
    if (statusEl) statusEl.textContent = t("pdfJpg.errorDecode");
  }
}

async function pageBlob(page: number): Promise<Blob> {
  if (!state.item) throw new Error("empty");
  const canvas = await renderPdfPage(state.item.doc, page, state.scale);
  return canvasToBlob(canvas, mimeForFormat(state.format), state.quality);
}

async function downloadOne(): Promise<void> {
  if (!state.item) {
    if (statusEl) statusEl.textContent = t("pdfJpg.emptyDownload");
    return;
  }
  if (statusEl) statusEl.textContent = t("pdfJpg.working");
  try {
    const blob = await pageBlob(state.page);
    downloadBlob(blob, outputFilename(state.item.file.name, blob.type, `-p${state.page}`));
    if (statusEl) statusEl.textContent = "";
  } catch {
    if (statusEl) statusEl.textContent = t("pdfJpg.errorDecode");
  }
}

async function downloadAll(): Promise<void> {
  if (!state.item) {
    if (statusEl) statusEl.textContent = t("pdfJpg.emptyDownload");
    return;
  }
  if (statusEl) statusEl.textContent = t("pdfJpg.working");
  try {
    if (state.item.pages === 1) {
      await downloadOne();
      return;
    }
    const entries = [];
    const ext = state.format === "jpeg" ? "jpg" : state.format;
    for (let i = 1; i <= state.item.pages; i++) {
      const blob = await pageBlob(i);
      entries.push({
        name: outputFilename(state.item.file.name, blob.type, `-p${i}`).replace(/\.[^.]+$/, `.${ext}`),
        data: new Uint8Array(await blob.arrayBuffer()),
      });
    }
    downloadBlob(blobFromBytes(zipStore(entries), "application/zip"), "cvcm-pdf-images.zip");
    if (statusEl) statusEl.textContent = "";
  } catch {
    if (statusEl) statusEl.textContent = t("pdfJpg.errorDecode");
  }
}
