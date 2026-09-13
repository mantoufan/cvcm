import { outputFilename } from "../../shared/filename";
import { blobFromBytes } from "../../shared/image-encode";
import { extractPdfPages, parsePageRanges, pdfPageCount, splitPdfEachPage } from "../../shared/pdf-ops";
import { zipStore } from "../../shared/zip";
import { downloadBlob, h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";

type Mode = "each" | "range";

const state = {
  file: null as File | null,
  pages: 0,
  mode: "each" as Mode,
  range: "1-3",
};

let statusEl: HTMLElement | null = null;
let metaEl: HTMLElement | null = null;
let rangeField: HTMLElement | null = null;
let rangeInput: HTMLInputElement | null = null;

export async function mountSplitPdf(host: HTMLElement): Promise<void> {
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("splitPdf.back")),
      h("h1", null, t("splitPdf.title")),
      h("p", { class: "lede" }, t("splitPdf.privacyNote")),
    ),
    h("div", { class: "tool" },
      filesRail(),
      h("section", { class: "stage" },
        h("p", { class: "hint" }, t("splitPdf.hint")),
        h("div", { class: "stage-actions" },
          h("button", { type: "button", class: "btn", onClick: () => void run() }, t("splitPdf.download")),
        ),
        statusEl = h("p", { class: "status", "aria-live": "polite" }),
      ),
      controls(),
    ),
  );
  window.addEventListener("paste", onPaste);
}

export function unmountSplitPdf(): void {
  window.removeEventListener("paste", onPaste);
  statusEl = null;
  metaEl = null;
  rangeField = null;
  rangeInput = null;
}

function filesRail(): HTMLElement {
  const input = h("input", {
    type: "file",
    accept: "application/pdf,.pdf",
    class: "sr-only",
    id: "split-pdf-file-input",
    onChange: (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) void setFile(file);
      (e.target as HTMLInputElement).value = "";
    },
  });
  const drop = h("label", {
    class: "drop",
    for: "split-pdf-file-input",
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
    h("strong", null, t("splitPdf.dropTitle")),
    h("span", null, t("splitPdf.dropHint")),
    h("em", null, t("splitPdf.dropTypes")),
  );
  return h("aside", { class: "rail" },
    h("div", { class: "rail-h" }, h("h2", null, t("splitPdf.filesTitle"))),
    drop,
    metaEl = h("p", { class: "muted" }),
  );
}

function controls(): HTMLElement {
  rangeInput = h("input", {
    value: state.range,
    placeholder: "1-3,5,8",
    onInput: (e: Event) => {
      state.range = (e.target as HTMLInputElement).value;
    },
  });
  rangeField = labeled(t("splitPdf.range"), rangeInput);
  rangeField.hidden = state.mode !== "range";
  return h("aside", { class: "rail controls" },
    h("fieldset", null,
      h("legend", null, t("splitPdf.exportTitle")),
      labeled(t("splitPdf.mode"),
        h("select", {
          onChange: (e: Event) => {
            state.mode = (e.target as HTMLSelectElement).value as Mode;
            if (rangeField) rangeField.hidden = state.mode !== "range";
          },
        },
          h("option", { value: "each", selected: true }, t("splitPdf.modeEach")),
          h("option", { value: "range" }, t("splitPdf.modeRange")),
        ),
      ),
      rangeField,
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
  if (statusEl) statusEl.textContent = t("splitPdf.working");
  try {
    const pages = await pdfPageCount(await file.arrayBuffer());
    state.file = file;
    state.pages = pages;
    state.range = pages > 1 ? `1-${Math.min(pages, 3)}` : "1";
    if (rangeInput) rangeInput.value = state.range;
    if (metaEl) metaEl.textContent = t("splitPdf.meta", { name: file.name, pages });
    if (statusEl) statusEl.textContent = "";
  } catch {
    if (statusEl) statusEl.textContent = t("splitPdf.errorDecode");
  }
}

async function run(): Promise<void> {
  if (!state.file) {
    if (statusEl) statusEl.textContent = t("splitPdf.emptyDownload");
    return;
  }
  if (statusEl) statusEl.textContent = t("splitPdf.working");
  try {
    const buf = await state.file.arrayBuffer();
    if (state.mode === "each") {
      const files = await splitPdfEachPage(buf);
      if (files.length === 1) {
        const packed = new ArrayBuffer(files[0]!.byteLength);
        new Uint8Array(packed).set(files[0]!);
        downloadBlob(new Blob([packed], { type: "application/pdf" }), outputFilename(state.file.name, "application/pdf", "-p1"));
      } else {
        const entries = files.map((data, i) => ({
          name: outputFilename(state.file!.name, "application/pdf", `-p${i + 1}`),
          data,
        }));
        downloadBlob(blobFromBytes(zipStore(entries), "application/zip"), "cvcm-split-pdf.zip");
      }
    } else {
      const pages = parsePageRanges(state.range, state.pages);
      const out = await extractPdfPages(buf, pages);
      const packed = new ArrayBuffer(out.byteLength);
      new Uint8Array(packed).set(out);
      downloadBlob(new Blob([packed], { type: "application/pdf" }), outputFilename(state.file.name, "application/pdf", "-pages"));
    }
    if (statusEl) statusEl.textContent = "";
  } catch {
    if (statusEl) statusEl.textContent = t("splitPdf.errorRange");
  }
}
