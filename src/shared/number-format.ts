import type { Locale } from "./locale";

/** Intl objects are slow to build: one per locale and options, kept for the page's life. */
const formatters = new Map<string, Intl.NumberFormat>();
export function numberFormat(locale: Locale, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let format = formatters.get(key);
  if (!format) {
    format = new Intl.NumberFormat(locale, options);
    formatters.set(key, format);
  }
  return format;
}

/** 1.2K, 3.4M, 1.2万… */
export function compact(locale: Locale, value: number): string {
  return numberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function plain(locale: Locale, value: number, digits = 0): string {
  return numberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
}

/** A US dollar amount: cents from $1 up, four significant digits below (meme coins trade at $0.00000008394), compact form for market caps. */
export function usd(locale: Locale, value: number, compactForm = false): string {
  if (compactForm) return numberFormat(locale, { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 2 }).format(value);
  return numberFormat(locale, value >= 1 || value === 0
    ? { style: "currency", currency: "USD", maximumFractionDigits: 2 }
    : { style: "currency", currency: "USD", maximumSignificantDigits: 4 }).format(value);
}

/** A percentage change with an explicit sign: +1.2%, −3.4%. */
export function signed(locale: Locale, value: number): string {
  const rounded = Math.round(value * 10) / 10;
  const sign = rounded > 0 ? "+" : rounded < 0 ? "−" : "";
  return `${sign}${plain(locale, Math.abs(rounded), 1)}%`;
}
