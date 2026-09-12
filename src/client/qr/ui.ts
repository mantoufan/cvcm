import { downloadBlob, h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { encodeQr, type QrEcLevel } from "../../shared/qr";
import { debounce } from "../session";

let inputEl: HTMLTextAreaElement | null = null;
let canvas: HTMLCanvasElement | null = null;
let statusEl: HTMLElement | null = null;
let ec: QrEcLevel = "M";
let fg = "#3a2030";
let bg = "#fff7fb";
const schedule = debounce(() => draw(), 160);

export function mountQr(host: HTMLElement): void {
  inputEl = h("textarea", {
    class: "clip-input",
    spellcheck: "false",
    "aria-label": t("qr.input"),
    placeholder: t("qr.placeholder"),
    onInput: () => schedule(),
  }, "https://cv.cm");
  canvas = h("canvas", { class: "qr-canvas", width: 280, height: 280 });
  statusEl = h("p", { class: "status", "aria-live": "polite" });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("qr.back")),
      h("h1", null, t("qr.title")),
      h("p", { class: "lede" }, t("qr.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("qr.options")),
          labeled(t("qr.ec"),
            h("select", {
              onChange: (e: Event) => {
                ec = (e.target as HTMLSelectElement).value as QrEcLevel;
                draw();
              },
            },
              h("option", { value: "L" }, t("qr.ecL")),
              h("option", { value: "M", selected: true }, t("qr.ecM")),
              h("option", { value: "Q" }, t("qr.ecQ")),
              h("option", { value: "H" }, t("qr.ecH")),
            ),
          ),
          labeled(t("qr.fg"), h("input", {
            type: "color",
            value: fg,
            onInput: (e: Event) => {
              fg = (e.target as HTMLInputElement).value;
              draw();
            },
          })),
          labeled(t("qr.bg"), h("input", {
            type: "color",
            value: bg,
            onInput: (e: Event) => {
              bg = (e.target as HTMLInputElement).value;
              draw();
            },
          })),
        ),
        h("div", { class: "stage-actions" },
          h("button", { type: "button", class: "btn", onClick: () => void download() }, t("qr.download")),
        ),
        statusEl,
      ),
      h("div", { class: "data-panes" },
        h("div", { class: "rail" }, h("h2", null, t("qr.input")), inputEl),
        h("div", { class: "rail qr-stage" }, h("h2", null, t("qr.preview")), canvas),
      ),
    ),
  );
  draw();
  inputEl.focus();
}

export function unmountQr(): void {
  inputEl = null;
  canvas = null;
  statusEl = null;
}

function labeled(label: string, control: HTMLElement): HTMLElement {
  return h("label", { class: "field" }, h("span", null, label), control);
}

function matrix(): boolean[][] | null {
  if (!inputEl) return null;
  const text = inputEl.value.trim() || "https://cv.cm";
  try {
    const grid = encodeQr(text, ec);
    if (statusEl) statusEl.textContent = "";
    return grid;
  } catch {
    if (statusEl) statusEl.textContent = t("qr.tooLong");
    return null;
  }
}

function draw(): void {
  if (!canvas) return;
  const grid = matrix();
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const size = 280;
  canvas.width = size;
  canvas.height = size;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);
  if (!grid) return;
  const quiet = 4;
  const n = grid.length + quiet * 2;
  const cell = size / n;
  ctx.fillStyle = fg;
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid.length; x++) {
      if (!grid[y]![x]) continue;
      ctx.fillRect((x + quiet) * cell, (y + quiet) * cell, cell + 0.4, cell + 0.4);
    }
  }
}

async function download(): Promise<void> {
  const grid = matrix();
  if (!grid || !statusEl) return;
  const quiet = 4;
  const n = grid.length + quiet * 2;
  const cell = 8;
  const out = document.createElement("canvas");
  out.width = n * cell;
  out.height = n * cell;
  const ctx = out.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.fillStyle = fg;
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid.length; x++) {
      if (!grid[y]![x]) continue;
      ctx.fillRect((x + quiet) * cell, (y + quiet) * cell, cell, cell);
    }
  }
  const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, "image/png"));
  if (!blob) return;
  downloadBlob(blob, "cvcm-qr.png");
}
