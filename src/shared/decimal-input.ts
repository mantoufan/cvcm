/** Locales that write a decimal comma (as the scientific calculator also assumes). */
export const DECIMAL_COMMA_LOCALES: ReadonlySet<string> = new Set(["es", "id", "vi"]);

/**
 * A number typed in a text field with a decimal keypad: NaN when it is not a number, undefined when the field is empty.
 * - With both "." and ",", the last one is the decimal mark and the other groups thousands ("1,000.5", "1.000,5").
 * - A lone comma is a decimal comma in es/id/vi ("2,375") and a thousands group elsewhere when it looks like one
 *   ("1,000"); "0,125" can only be a decimal anywhere.
 * - Likewise a dot that groups thousands ("1.000", "12.500.000") is a thousands dot in es/id/vi; "1.5" is a decimal.
 * The typographic minus (−) counts as a minus sign.
 */
export function parseDecimalInput(raw: string, locale: string): number | undefined {
  const text = raw.trim().replace(/^−/, "-");
  if (text === "") return undefined;
  const commaLocale = DECIMAL_COMMA_LOCALES.has(locale);
  let plain: string;
  if (text.includes(".") && text.includes(",")) {
    const decimal = text.lastIndexOf(".") > text.lastIndexOf(",") ? "." : ",";
    const group = decimal === "." ? "," : ".";
    plain = text.split(group).join("").replace(decimal, ".");
  } else if (text.includes(",")) {
    plain = !commaLocale && /^-?[1-9]\d{0,2}(,\d{3})+$/.test(text) ? text.replace(/,/g, "") : text.replace(",", ".");
  } else {
    plain = commaLocale && /^-?[1-9]\d{0,2}(\.\d{3})+$/.test(text) ? text.replace(/\./g, "") : text;
  }
  // Number("") is 0 and Number(" 1") trims; only digits, one point and a leading sign are a number here.
  if (!/^-?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(plain)) return NaN;
  return Number(plain);
}
