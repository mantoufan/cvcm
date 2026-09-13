import { downloadBlob, h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { encodeBarcode, isBarcodeKind, type BarcodeKind } from "../../shared/barcode";
import { debounce } from "../session";

let inputEl: HTMLTextAreaElement | null = null;
let canvas: HTMLCanvasElement | null = null;
let statusEl: HTMLElement | null = null;
let kind: BarcodeKind = "code128";
let fg = "#3a2030";
let bg = "#fff7fb";
const schedule = debounce(() => draw(), 160);

export function mountBarcode(host: HTMLElement): void {
  inputEl = h("textarea", {
    class: "clip-input",
    spellcheck: "false",
    "aria-label": t("barcode.input"),
    placeholder: t("barcode.placeholder"),
    onInput: () => schedule(),
  }, "CVCM");
  canvas = h("canvas", { class: "barcode-canvas", width: 520, height: 160 });
  statusEl = h("p", { class: "status", "aria-live": "polite" });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("barcode.back")),
      h("h1", null, t("barcode.title")),
      h("p", { class: "lede" }, t("barcode.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("barcode.options")),
          labeled(t("barcode.kind"),
            h("select", {
              onChange: (e: Event) => {
                const next = (e.target as HTMLSelectElement).value;
                if (isBarcodeKind(next)) kind = next;
                if (inputEl && kind === "ean13" && !/^\d{12,13}$/.test(inputEl.value.trim())) {
                  inputEl.value = "5901234123457";
                }
                draw();
              },
            },
              h("option", { value: "code128", selected: true }, t("barcode.kind128")),
              h("option", { value: "code39" }, t("barcode.kind39")),
              h("option", { value: "ean13" }, t("barcode.kindEan")),
            ),
          ),
          labeled(t("barcode.fg"), h("input", {
            type: "color",
            value: fg,
            onInput: (e: Event) => {
              fg = (e.target as HTMLInputElement).value;
              draw();
            },
          })),
          labeled(t("barcode.bg"), h("input", {
            type: "color",
            value: bg,
            onInput: (e: Event) => {
              bg = (e.target as HTMLInputElement).value;
              draw();
            },
          })),
        ),
        h("div", { class: "stage-actions" },
          h("button", { type: "button", class: "btn", onClick: () => void download() }, t("barcode.download")),
        ),
        statusEl,
      ),
      h("div", { class: "data-panes" },
        h("div", { class: "rail" }, h("h2", null, t("barcode.input")), inputEl),
        h("div", { class: "rail barcode-stage" }, h("h2", null, t("barcode.preview")), canvas),
      ),
    ),
  );
  draw();
  inputEl.focus();
}

export function unmountBarcode(): void {
  inputEl = null;
  canvas = null;
  statusEl = null;
}

function labeled(label: string, control: HTMLElement): HTMLElement {
  return h("label", { class: "field" }, h("span", null, label), control);
}

function encoded(): { modules: boolean[]; text: string } | null {
  if (!inputEl) return null;
  try {
    const result = encodeBarcode(kind, inputEl.value);
    if (statusEl) statusEl.textContent = "";
    return result;
  } catch {
    if (statusEl) statusEl.textContent = t(`barcode.error.${kind}`);
    return null;
  }
}

function paint(target: HTMLCanvasElement, modules: boolean[], label: string, scale: number): void {
  const ctx = target.getContext("2d");
  if (!ctx) return;
  const textH = Math.max(18, Math.round(14 * scale));
  const barH = Math.max(60, Math.round(90 * scale));
  const pad = Math.round(8 * scale);
  target.width = modules.length * scale;
  target.height = barH + textH + pad * 2;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, target.width, target.height);
  ctx.fillStyle = fg;
  for (let i = 0; i < modules.length; i++) {
    if (!modules[i]) continue;
    ctx.fillRect(i * scale, pad, scale, barH);
  }
  ctx.font = `${textH}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(label, target.width / 2, pad + barH + 2);
}

function draw(): void {
  if (!canvas) return;
  const result = encoded();
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  if (!result) {
    canvas.width = 520;
    canvas.height = 160;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return;
  }
  const scale = Math.max(1, Math.floor(520 / result.modules.length));
  paint(canvas, result.modules, result.text, scale);
}

async function download(): Promise<void> {
  const result = encoded();
  if (!result) return;
  const out = document.createElement("canvas");
  paint(out, result.modules, result.text, 3);
  const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, "image/png"));
  if (!blob) return;
  downloadBlob(blob, "cvcm-barcode.png");
}
