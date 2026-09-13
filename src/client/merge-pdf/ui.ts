import { outputFilename } from "../../shared/filename";
import { mergePdfBuffers, pdfPageCount } from "../../shared/pdf-ops";
import { downloadBlob, h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";

type Item = { id: string; file: File; pages: number; error: string | null };

const state = { items: [] as Item[] };

let fileList: HTMLElement | null = null;
let statusEl: HTMLElement | null = null;

export async function mountMergePdf(host: HTMLElement): Promise<void> {
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("mergePdf.back")),
      h("h1", null, t("mergePdf.title")),
      h("p", { class: "lede" }, t("mergePdf.privacyNote")),
    ),
    h("div", { class: "tool" },
      filesRail(),
      h("section", { class: "stage" },
        h("p", { class: "hint" }, t("mergePdf.hint")),
        h("div", { class: "stage-actions" },
          h("button", { type: "button", class: "btn", onClick: () => void merge() }, t("mergePdf.download")),
        ),
        statusEl = h("p", { class: "status", "aria-live": "polite" }),
      ),
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("mergePdf.exportTitle")),
          h("p", { class: "muted" }, t("mergePdf.note")),
        ),
      ),
    ),
  );
  refreshList();
  window.addEventListener("paste", onPaste);
}

export function unmountMergePdf(): void {
  window.removeEventListener("paste", onPaste);
  fileList = null;
  statusEl = null;
}

function filesRail(): HTMLElement {
  const input = h("input", {
    type: "file",
    accept: "application/pdf,.pdf",
    multiple: true,
    class: "sr-only",
    id: "merge-pdf-file-input",
    onChange: (e: Event) => {
      const files = (e.target as HTMLInputElement).files;
      if (files) void addFiles(files);
      (e.target as HTMLInputElement).value = "";
    },
  });
  const drop = h("label", {
    class: "drop",
    for: "merge-pdf-file-input",
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
    h("strong", null, t("mergePdf.dropTitle")),
    h("span", null, t("mergePdf.dropHint")),
    h("em", null, t("mergePdf.dropTypes")),
  );
  fileList = h("ul", { class: "file-list" });
  return h("aside", { class: "rail" },
    h("div", { class: "rail-h" }, h("h2", null, t("mergePdf.filesTitle"))),
    drop,
    fileList,
  );
}

function pdfFiles(list: FileList | File[]): File[] {
  return [...list].filter((f) => f.type === "application/pdf" || /\.pdf$/i.test(f.name));
}

function onPaste(e: ClipboardEvent): void {
  const files = pdfFiles(e.clipboardData?.files || []);
  if (files.length) {
    e.preventDefault();
    void addFiles(files);
  }
}

async function addFiles(list: FileList | File[]): Promise<void> {
  for (const file of pdfFiles(list)) {
    const id = crypto.randomUUID();
    const item: Item = { id, file, pages: 0, error: null };
    state.items.push(item);
    try {
      item.pages = await pdfPageCount(await file.arrayBuffer());
    } catch {
      item.error = t("mergePdf.errorDecode");
    }
  }
  refreshList();
}

function refreshList(): void {
  if (!fileList) return;
  fileList.replaceChildren();
  if (state.items.length === 0) {
    fileList.append(h("li", { class: "muted" }, t("mergePdf.filesEmpty")));
    return;
  }
  for (const item of state.items) {
    fileList.append(
      h("li", { class: "file on" },
        h("div", { class: "audio-thumb", "aria-hidden": "true" }, "PDF"),
        h("div", null,
          h("strong", null, item.file.name),
          h("span", null, item.error || t("mergePdf.pages", { n: item.pages })),
        ),
        h("div", { class: "file-ops" },
          h("button", { type: "button", class: "icon", "aria-label": t("mergePdf.up"), onClick: () => move(item.id, -1) }, "↑"),
          h("button", { type: "button", class: "icon", "aria-label": t("mergePdf.down"), onClick: () => move(item.id, 1) }, "↓"),
          h("button", { type: "button", class: "icon", "aria-label": t("mergePdf.remove"), onClick: () => remove(item.id) }, "×"),
        ),
      ),
    );
  }
}

function move(id: string, dir: -1 | 1): void {
  const idx = state.items.findIndex((it) => it.id === id);
  const next = idx + dir;
  if (idx < 0 || next < 0 || next >= state.items.length) return;
  const [item] = state.items.splice(idx, 1);
  state.items.splice(next, 0, item);
  refreshList();
}

function remove(id: string): void {
  state.items = state.items.filter((it) => it.id !== id);
  refreshList();
}

async function merge(): Promise<void> {
  const ready = state.items.filter((it) => !it.error);
  if (ready.length === 0) {
    if (statusEl) statusEl.textContent = t("mergePdf.emptyDownload");
    return;
  }
  if (statusEl) statusEl.textContent = t("mergePdf.working");
  try {
    const buffers = [];
    for (const item of ready) buffers.push(await item.file.arrayBuffer());
    const out = await mergePdfBuffers(buffers);
    const packed = new ArrayBuffer(out.byteLength);
    new Uint8Array(packed).set(out);
    downloadBlob(
      new Blob([packed], { type: "application/pdf" }),
      outputFilename(ready[0].file.name, "application/pdf", "-merged"),
    );
    if (statusEl) statusEl.textContent = "";
  } catch {
    if (statusEl) statusEl.textContent = t("mergePdf.errorDecode");
  }
}
