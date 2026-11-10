/** Locales that write a decimal comma (as the scientific calculator also assumes). */
export const DECIMAL_COMMA_LOCALES: ReadonlySet<string> = new Set(["es", "id", "vi"]);

/**
 * A number typed in a text field with a decimal keypad: NaN when it is not a number, undefined when the field is empty.
 * With a point present, commas group thousands ("1,000.5"). A lone comma is a decimal comma in es/id/vi, where people
 * write 2,375 for 2.375, and a thousands group elsewhere ("1,000"); "0,125" can only be a decimal anywhere.
 * The typographic minus (−) counts as a minus sign.
 */
export function parseDecimalInput(raw: string, locale: string): number | undefined {
  const text = raw.trim().replace(/^−/, "-");
  if (text === "") return undefined;
  const grouped = !DECIMAL_COMMA_LOCALES.has(locale) && /^-?[1-9]\d{0,2}(,\d{3})+$/.test(text);
  const plain = text.includes(".") || grouped ? text.replace(/,/g, "") : text.replace(",", ".");
  // Number("") is 0 and Number(" 1") trims; only digits, one point and a leading sign are a number here.
  if (!/^-?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(plain)) return NaN;
  return Number(plain);
}
