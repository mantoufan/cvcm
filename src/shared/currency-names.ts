/**
 * Currency names as cv.cm shows them, shared by the exchange-rate channel and the rankings `currency-strength` table so
 * both name a currency the same way: `Intl.DisplayNames`, except where a locale's usual name differs (main bundle; small).
 */
import type { Locale } from "./locale";

/** Names that read better than Intl's in running text and tables (ja without the spaces CLDR puts in, zh-CN 印尼盾 …). */
const OVERRIDES: Record<Locale, Partial<Record<string, string>>> = {
  en: {},
  "zh-CN": {"IDR": "印尼盾", "AUD": "澳元", "CAD": "加元"},
  "zh-TW": {},
  ja: {"JPY": "円", "CNY": "人民元", "IDR": "インドネシアルピア", "MXN": "メキシコペソ", "SGD": "シンガポールドル", "AUD": "豪ドル", "CAD": "カナダドル", "CHF": "スイスフラン", "INR": "インドルピー", "THB": "タイバーツ", "MYR": "マレーシアリンギット", "PHP": "フィリピンペソ", "NZD": "ニュージーランドドル", "ZAR": "南アフリカランド", "SEK": "スウェーデンクローナ", "NOK": "ノルウェークローネ", "DKK": "デンマーククローネ", "PLN": "ポーランドズウォティ", "CZK": "チェココルナ", "HUF": "ハンガリーフォリント", "RON": "ルーマニアレウ", "ISK": "アイスランドクローナ", "TRY": "トルコリラ", "BRL": "ブラジルレアル"},
  ko: {"KRW": "원", "JPY": "엔화", "CNY": "위안화"},
  vi: {"CHF": "Franc Thụy Sĩ", "PHP": "Peso Philippines", "AUD": "Đô la Úc", "THB": "Baht Thái Lan"},
  id: {},
  es: {"CNY": "yuan chino", "THB": "baht tailandés"},
};

const DISPLAY = new Map<Locale, Intl.DisplayNames | null>();

/** The currency's name in this locale: an override, else Intl, else the ISO code. */
export function currencyName(locale: Locale, code: string): string {
  const own = OVERRIDES[locale][code];
  if (own) return own;
  if (!DISPLAY.has(locale)) {
    let names: Intl.DisplayNames | null = null;
    try {
      names = new Intl.DisplayNames([locale], { type: "currency" });
    } catch {
      names = null;
    }
    DISPLAY.set(locale, names);
  }
  return DISPLAY.get(locale)?.of(code) ?? code;
}
