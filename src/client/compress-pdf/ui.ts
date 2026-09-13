import { outputFilename } from "../../shared/filename";
import { pdfFromJpegs } from "../../shared/pdf";
import { formatBytes } from "../../shared/resize";
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
  quality: 0.72,
  scale: 1.5,
};

let preview: HTMLCanvasElement | null = null;
let statusEl: HTMLElement | null = null;
let metaEl: HTMLElement | null = null;
let sizeEl: HTMLElement | null = null;

export async function mountCompressPdf(host: HTMLElement): Promise<void> {
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("compressPdf.back")),
      h("h1", null, t("compressPdf.title")),
      h("p", { class: "lede" }, t("compressPdf.privacyNote")),
    ),
    h("div", { class: "tool" },
      filesRail(),
      stagePane(),
      controls(),
    ),
  );
  window.addEventListener("paste", onPaste);
}

export function unmountCompressPdf(): void {
  window.removeEventListener("paste", onPaste);
  void state.item?.doc.cleanup();
  state.item = null;
  preview = null;
  statusEl = null;
  metaEl = null;
  sizeEl = null;
}

function filesRail(): HTMLElement {
  const input = h("input", {
    type: "file",
    accept: "application/pdf,.pdf",
    class: "sr-only",
    id: "compress-pdf-file-input",
    onChange: (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) void setFile(file);
      (e.target as HTMLInputElement).value = "";
    },
  });
  const drop = h("label", {
    class: "drop",
    for: "compress-pdf-file-input",
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
    h("strong", null, t("compressPdf.dropTitle")),
    h("span", null, t("compressPdf.dropHint")),
    h("em", null, t("compressPdf.dropTypes")),
  );
  return h("aside", { class: "rail" },
    h("div", { class: "rail-h" }, h("h2", null, t("compressPdf.filesTitle"))),
    drop,
    metaEl = h("p", { class: "muted" }),
  );
}

function stagePane(): HTMLElement {
  preview = h("canvas", { class: "preview", width: 800, height: 560 });
  statusEl = h("p", { class: "status", "aria-live": "polite" });
  sizeEl = h("p", { class: "muted convert-size" });
  return h("section", { class: "stage" },
    h("div", { class: "stage-frame" }, preview),
    h("p", { class: "hint" }, t("compressPdf.hint")),
    h("div", { class: "stage-actions" },
      h("button", { type: "button", class: "btn", onClick: () => void download() }, t("compressPdf.download")),
    ),
    sizeEl,
    statusEl,
  );
}

function controls(): HTMLElement {
  return h("aside", { class: "rail controls" },
    h("fieldset", null,
      h("legend", null, t("compressPdf.exportTitle")),
      labeled(t("compressPdf.quality"),
        h("input", {
          type: "range",
          min: "0.4",
          max: "0.92",
          step: "0.01",
          value: String(state.quality),
          onInput: (e: Event) => {
            state.quality = Number((e.target as HTMLInputElement).value);
          },
        }),
      ),
      labeled(t("compressPdf.scale"),
        h("select", {
          onChange: (e: Event) => {
            state.scale = Number((e.target as HTMLSelectElement).value);
            void redraw();
          },
        },
          h("option", { value: "1" }, t("compressPdf.scale1")),
          h("option", { value: "1.5", selected: true }, t("compressPdf.scale15")),
          h("option", { value: "2" }, t("compressPdf.scale2")),
        ),
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
  if (statusEl) statusEl.textContent = t("compressPdf.working");
  try {
    const doc = await openPdf(await file.arrayBuffer());
    state.item?.doc.cleanup();
    state.item = { file, pages: doc.numPages, doc };
    state.page = 1;
    if (metaEl) {
      metaEl.textContent = t("compressPdf.meta", {
        pages: doc.numPages,
        name: file.name,
        size: formatBytes(file.size),
      });
    }
    if (statusEl) statusEl.textContent = "";
    await redraw();
  } catch {
    if (statusEl) statusEl.textContent = t("compressPdf.errorDecode");
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
    if (statusEl) statusEl.textContent = t("compressPdf.errorDecode");
  }
}

async function download(): Promise<void> {
  if (!state.item) {
    if (statusEl) statusEl.textContent = t("compressPdf.emptyDownload");
    return;
  }
  if (statusEl) statusEl.textContent = t("compressPdf.working");
  try {
    const pages = [];
    for (let i = 1; i <= state.item.pages; i++) {
      const canvas = await renderPdfPage(state.item.doc, i, state.scale);
      const blob = await canvasToBlob(canvas, "image/jpeg", state.quality);
      pages.push({
        jpeg: new Uint8Array(await blob.arrayBuffer()),
        width: canvas.width,
        height: canvas.height,
      });
    }
    const pdf = pdfFromJpegs(pages, "fit");
    const packed = new ArrayBuffer(pdf.byteLength);
    new Uint8Array(packed).set(pdf);
    downloadBlob(
      new Blob([packed], { type: "application/pdf" }),
      outputFilename(state.item.file.name, "application/pdf", "-compressed"),
    );
    if (sizeEl) {
      sizeEl.textContent = t("compressPdf.sizeLabel", {
        src: formatBytes(state.item.file.size),
        out: formatBytes(pdf.byteLength),
      });
    }
    if (statusEl) statusEl.textContent = "";
  } catch {
    if (statusEl) statusEl.textContent = t("compressPdf.errorDecode");
  }
}
