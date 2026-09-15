import { canvasToBlob } from "../decode";
import { downloadBlob, h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { pdfFromJpegs } from "../../shared/pdf";
import {
  CURRENCIES,
  defaultInvoice,
  emptyItem,
  formatMoney,
  invoiceTotals,
  lineAmount,
  wrapInvoiceText,
  type InvoiceDoc,
} from "../../shared/invoice";

const PAGE = { w: 1240, h: 1754 };

let doc: InvoiceDoc = defaultInvoice(today());
let preview: HTMLCanvasElement | null = null;
let statusEl: HTMLElement | null = null;
let itemsEl: HTMLElement | null = null;
let totalsEl: HTMLElement | null = null;

type Labels = {
  title: string;
  from: string;
  billTo: string;
  number: string;
  date: string;
  due: string;
  description: string;
  qty: string;
  price: string;
  amount: string;
  subtotal: string;
  tax: string;
  total: string;
  notes: string;
};

export function mountInvoice(host: HTMLElement): void {
  preview = h("canvas", { class: "preview invoice-preview", width: PAGE.w, height: PAGE.h });
  statusEl = h("p", { class: "status", "aria-live": "polite" });
  itemsEl = h("div", { class: "invoice-items" });
  totalsEl = h("p", { class: "invoice-totals" });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("invoice.back")),
      h("h1", null, t("invoice.title")),
      h("p", { class: "lede" }, t("invoice.privacyNote")),
    ),
    h("div", { class: "tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("invoice.parties")),
          labeled(t("invoice.fromName"), textInput("fromName")),
          labeled(t("invoice.fromAddress"), areaInput("fromAddress")),
          labeled(t("invoice.toName"), textInput("toName")),
          labeled(t("invoice.toAddress"), areaInput("toAddress")),
        ),
        h("fieldset", null,
          h("legend", null, t("invoice.meta")),
          labeled(t("invoice.number"), textInput("number")),
          labeled(t("invoice.date"), dateInput("date")),
          labeled(t("invoice.due"), dateInput("due")),
          labeled(t("invoice.currency"), currencySelect()),
          labeled(t("invoice.taxPercent"), numberInput("taxPercent")),
        ),
        h("fieldset", null,
          h("legend", null, t("invoice.lines")),
          itemsEl,
          h("button", { type: "button", class: "btn ghost", onClick: () => addItem() }, t("invoice.addLine")),
        ),
        labeled(t("invoice.notes"), areaInput("notes")),
        totalsEl,
        h("div", { class: "stage-actions" },
          h("button", { type: "button", class: "btn", onClick: () => void download() }, t("invoice.download")),
        ),
        statusEl,
      ),
      h("section", { class: "stage" },
        h("div", { class: "stage-frame" }, preview),
        h("p", { class: "hint" }, t("invoice.hint")),
      ),
    ),
  );
  paintItems();
  redraw();
}

export function unmountInvoice(): void {
  preview = null;
  statusEl = null;
  itemsEl = null;
  totalsEl = null;
  doc = defaultInvoice(today());
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function labels(): Labels {
  return {
    title: t("invoice.sheetTitle"),
    from: t("invoice.from"),
    billTo: t("invoice.billTo"),
    number: t("invoice.number"),
    date: t("invoice.date"),
    due: t("invoice.due"),
    description: t("invoice.description"),
    qty: t("invoice.qty"),
    price: t("invoice.price"),
    amount: t("invoice.amount"),
    subtotal: t("invoice.subtotal"),
    tax: t("invoice.tax"),
    total: t("invoice.total"),
    notes: t("invoice.notes"),
  };
}

function labeled(label: string, control: HTMLElement): HTMLElement {
  return h("label", { class: "field" }, h("span", null, label), control);
}

function textInput(key: "fromName" | "toName" | "number"): HTMLInputElement {
  return h("input", {
    type: "text",
    value: doc[key],
    onInput: (e: Event) => {
      doc[key] = (e.target as HTMLInputElement).value;
      redraw();
    },
  });
}

function dateInput(key: "date" | "due"): HTMLInputElement {
  return h("input", {
    type: "date",
    value: doc[key],
    onInput: (e: Event) => {
      doc[key] = (e.target as HTMLInputElement).value;
      redraw();
    },
  });
}

function numberInput(key: "taxPercent"): HTMLInputElement {
  return h("input", {
    type: "text",
    inputmode: "decimal",
    value: String(doc[key]),
    onInput: (e: Event) => {
      doc[key] = Number((e.target as HTMLInputElement).value.replace(",", ".")) || 0;
      redraw();
    },
  });
}

function areaInput(key: "fromAddress" | "toAddress" | "notes"): HTMLTextAreaElement {
  return h("textarea", {
    class: "invoice-area",
    rows: 2,
    value: doc[key],
    onInput: (e: Event) => {
      doc[key] = (e.target as HTMLTextAreaElement).value;
      redraw();
    },
  });
}

function currencySelect(): HTMLSelectElement {
  return h("select", {
    onChange: (e: Event) => {
      doc.currency = (e.target as HTMLSelectElement).value;
      redraw();
    },
  }, ...CURRENCIES.map((code) => h("option", { value: code, selected: code === doc.currency }, code)));
}

function addItem(): void {
  doc.items.push(emptyItem());
  paintItems();
  redraw();
}

function paintItems(): void {
  if (!itemsEl) return;
  itemsEl.replaceChildren();
  doc.items.forEach((item, i) => {
    itemsEl!.append(
      h("div", { class: "invoice-line" },
        h("input", {
          type: "text",
          placeholder: t("invoice.description"),
          value: item.description,
          onInput: (e: Event) => {
            item.description = (e.target as HTMLInputElement).value;
            redraw();
          },
        }),
        h("input", {
          type: "text",
          inputmode: "decimal",
          value: String(item.qty),
          "aria-label": t("invoice.qty"),
          onInput: (e: Event) => {
            item.qty = Number((e.target as HTMLInputElement).value.replace(",", ".")) || 0;
            redraw();
          },
        }),
        h("input", {
          type: "text",
          inputmode: "decimal",
          value: String(item.price),
          "aria-label": t("invoice.price"),
          onInput: (e: Event) => {
            item.price = Number((e.target as HTMLInputElement).value.replace(",", ".")) || 0;
            redraw();
          },
        }),
        h("button", {
          type: "button",
          class: "icon-btn",
          "aria-label": t("invoice.removeLine"),
          onClick: () => {
            if (doc.items.length === 1) {
              doc.items[0] = emptyItem();
            } else {
              doc.items.splice(i, 1);
            }
            paintItems();
            redraw();
          },
        }, "×"),
      ),
    );
  });
}

function money(n: number): string {
  return formatMoney(n, doc.currency, locale());
}

function redraw(): void {
  if (!preview) return;
  drawInvoice(preview, PAGE.w, PAGE.h);
  const totals = invoiceTotals(doc.items, doc.taxPercent);
  if (totalsEl) {
    totalsEl.textContent = `${t("invoice.total")}: ${money(totals.total)}`;
  }
}

function drawInvoice(canvas: HTMLCanvasElement, width: number, height: number): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.width = width;
  canvas.height = height;
  const L = labels();
  const totals = invoiceTotals(doc.items, doc.taxPercent);
  const ink = "#3a2030";
  const mute = "#876579";
  const line = "#f2d9e5";
  const accent = "#c83f79";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, width, 18);
  const pad = 72;
  ctx.fillStyle = accent;
  ctx.font = "700 54px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(L.title, width - pad, 110);
  ctx.textAlign = "left";
  ctx.fillStyle = mute;
  ctx.font = "600 18px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText(L.from.toUpperCase(), pad, 110);
  ctx.fillStyle = ink;
  ctx.font = "700 28px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText(doc.fromName || "—", pad, 148);
  ctx.font = "400 18px ui-sans-serif, system-ui, sans-serif";
  ctx.fillStyle = mute;
  const measure = (s: string) => ctx.measureText(s).width;
  wrapInvoiceText(doc.fromAddress, 420, measure, 4).forEach((row, i) => {
    ctx.fillText(row, pad, 176 + i * 24);
  });
  const metaX = width - pad - 360;
  const meta = [
    [L.number, doc.number],
    [L.date, doc.date],
    [L.due, doc.due],
  ];
  meta.forEach((pair, i) => {
    const y = 148 + i * 32;
    ctx.fillStyle = mute;
    ctx.font = "600 16px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText(pair[0]!, metaX, y);
    ctx.fillStyle = ink;
    ctx.font = "600 20px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText(pair[1] || "—", metaX + 140, y);
  });
  ctx.fillStyle = mute;
  ctx.font = "600 18px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText(L.billTo.toUpperCase(), pad, 300);
  ctx.fillStyle = ink;
  ctx.font = "700 26px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText(doc.toName || "—", pad, 338);
  ctx.font = "400 18px ui-sans-serif, system-ui, sans-serif";
  ctx.fillStyle = mute;
  wrapInvoiceText(doc.toAddress, 700, measure, 3).forEach((row, i) => {
    ctx.fillText(row, pad, 366 + i * 24);
  });
  const tableY = 460;
  const cols = [pad, pad + 620, pad + 760, pad + 900];
  ctx.fillStyle = "#fff1f7";
  ctx.fillRect(pad - 12, tableY - 36, width - pad * 2 + 24, 48);
  ctx.fillStyle = mute;
  ctx.font = "600 16px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText(L.description, cols[0]!, tableY);
  ctx.fillText(L.qty, cols[1]!, tableY);
  ctx.fillText(L.price, cols[2]!, tableY);
  ctx.textAlign = "right";
  ctx.fillText(L.amount, width - pad, tableY);
  ctx.textAlign = "left";
  let y = tableY + 44;
  ctx.font = "400 20px ui-sans-serif, system-ui, sans-serif";
  const rows = doc.items.filter((item) => item.description.trim() || item.qty || item.price);
  const list = rows.length ? rows : doc.items.slice(0, 1);
  list.forEach((item) => {
    ctx.strokeStyle = line;
    ctx.beginPath();
    ctx.moveTo(pad - 12, y + 16);
    ctx.lineTo(width - pad + 12, y + 16);
    ctx.stroke();
    ctx.fillStyle = ink;
    const desc = wrapInvoiceText(item.description || "—", 580, measure, 2);
    desc.forEach((row, i) => ctx.fillText(row, cols[0]!, y + i * 24));
    ctx.fillText(String(item.qty || 0), cols[1]!, y);
    ctx.fillText(money(item.price), cols[2]!, y);
    ctx.textAlign = "right";
    ctx.fillText(money(lineAmount(item)), width - pad, y);
    ctx.textAlign = "left";
    y += Math.max(48, desc.length * 24 + 24);
  });
  y += 24;
  const boxX = width - pad - 360;
  const rowsT = [
    [L.subtotal, money(totals.subtotal)],
    [`${L.tax} (${doc.taxPercent}%)`, money(totals.tax)],
    [L.total, money(totals.total)],
  ];
  rowsT.forEach((pair, i) => {
    const ty = y + i * 36;
    ctx.fillStyle = i === 2 ? accent : mute;
    ctx.font = i === 2 ? "700 24px ui-sans-serif, system-ui, sans-serif" : "600 18px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText(pair[0]!, boxX, ty);
    ctx.textAlign = "right";
    ctx.fillStyle = i === 2 ? ink : ink;
    ctx.fillText(pair[1]!, width - pad, ty);
    ctx.textAlign = "left";
  });
  if (doc.notes.trim()) {
    ctx.fillStyle = mute;
    ctx.font = "600 16px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText(L.notes.toUpperCase(), pad, y);
    ctx.fillStyle = ink;
    ctx.font = "400 18px ui-sans-serif, system-ui, sans-serif";
    wrapInvoiceText(doc.notes, 520, measure, 6).forEach((row, i) => {
      ctx.fillText(row, pad, y + 28 + i * 24);
    });
  }
  ctx.fillStyle = mute;
  ctx.font = "400 14px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText("cv.cm", pad, height - 40);
}

async function download(): Promise<void> {
  if (!preview) return;
  if (statusEl) statusEl.textContent = t("invoice.working");
  try {
    const canvas = document.createElement("canvas");
    drawInvoice(canvas, PAGE.w, PAGE.h);
    const blob = await canvasToBlob(canvas, "image/jpeg", 0.92);
    const jpeg = new Uint8Array(await blob.arrayBuffer());
    const pdf = pdfFromJpegs([{ jpeg, width: PAGE.w, height: PAGE.h }], "a4");
    const copy = new ArrayBuffer(pdf.byteLength);
    new Uint8Array(copy).set(pdf);
    downloadBlob(new Blob([copy], { type: "application/pdf" }), `invoice-${(doc.number || "cvcm").replace(/[^\w.-]+/g, "-")}.pdf`);
    if (statusEl) statusEl.textContent = "";
  } catch {
    if (statusEl) statusEl.textContent = t("invoice.error");
  }
}
