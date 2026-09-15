export type InvoiceItem = {
  description: string;
  qty: number;
  price: number;
};

export type InvoiceDoc = {
  fromName: string;
  fromAddress: string;
  toName: string;
  toAddress: string;
  number: string;
  date: string;
  due: string;
  currency: string;
  taxPercent: number;
  notes: string;
  items: InvoiceItem[];
};

export type InvoiceTotals = {
  subtotal: number;
  tax: number;
  total: number;
};

export const CURRENCIES = ["USD", "EUR", "GBP", "CNY", "JPY", "KRW", "VND", "IDR"] as const;

export function roundMoney(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

export function lineAmount(item: InvoiceItem): number {
  return roundMoney((Number(item.qty) || 0) * (Number(item.price) || 0));
}

export function invoiceTotals(items: InvoiceItem[], taxPercent: number): InvoiceTotals {
  const subtotal = roundMoney(items.reduce((sum, item) => sum + lineAmount(item), 0));
  const tax = roundMoney(subtotal * (Math.max(0, Number(taxPercent) || 0) / 100));
  return { subtotal, tax, total: roundMoney(subtotal + tax) };
}

export function formatMoney(n: number, currency: string, locale = "en"): string {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency }).format(roundMoney(n));
  } catch {
    return `${roundMoney(n).toFixed(2)} ${currency}`;
  }
}

export function wrapInvoiceText(
  text: string,
  maxWidth: number,
  measure: (value: string) => number,
  maxLines = 8,
): string[] {
  const out: string[] = [];
  const pushWord = (word: string, current: string): string => {
    if (!current) {
      if (measure(word) <= maxWidth) return word;
      let chunk = "";
      for (const ch of word) {
        if (chunk && measure(chunk + ch) > maxWidth) {
          out.push(chunk);
          chunk = ch;
        } else chunk += ch;
      }
      return chunk;
    }
    const next = `${current} ${word}`;
    if (measure(next) <= maxWidth) return next;
    out.push(current);
    return pushWord(word, "");
  };
  for (const para of text.replace(/\r/g, "").split("\n")) {
    const words = para.trim().split(/\s+/).filter(Boolean);
    if (!words.length) continue;
    let current = "";
    for (const word of words) current = pushWord(word, current);
    if (current) out.push(current);
  }
  return out.slice(0, maxLines);
}

export function emptyItem(): InvoiceItem {
  return { description: "", qty: 1, price: 0 };
}

export function defaultInvoice(today: string): InvoiceDoc {
  return {
    fromName: "",
    fromAddress: "",
    toName: "",
    toAddress: "",
    number: `INV-${today.replace(/-/g, "")}`,
    date: today,
    due: today,
    currency: "USD",
    taxPercent: 0,
    notes: "",
    items: [emptyItem(), emptyItem()],
  };
}
