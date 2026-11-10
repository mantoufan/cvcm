import { decimalMarkOf } from "./calculator";

/**
 * A number typed in a text field with a decimal keypad: NaN when it is not a number, undefined when the field is empty.
 * - With both "." and ",", the last one is the decimal mark and the other groups thousands ("1,000.5", "1.000,5").
 * - A lone comma is a decimal comma in es/id/vi ("2,375") and a thousands group elsewhere when it looks like one
 *   ("1,000"); "0,125" can only be a decimal anywhere.
 * - A lone dot is always a decimal point ("2.375"): many phones type "." on a decimal keypad whatever the language, so
 *   reading it as thousands would silently multiply by 1,000. Several dots ("1.000.000") are not a number.
 */
export function parseDecimalInput(raw: string, locale: string): number | undefined {
  // A leading + is just a positive number; the typographic minus (−) is a minus.
  const text = raw.trim().replace(/^−/, "-").replace(/^\+/, "");
  if (text === "") return undefined;
  let plain: string;
  if (text.includes(".") && text.includes(",")) {
    const decimal = text.lastIndexOf(".") > text.lastIndexOf(",") ? "." : ",";
    const group = decimal === "." ? "," : ".";
    // The groups must be real thousands groups ("1,234.5"), or a typo like "1.5,000" would quietly read as 15.
    const g = `\\${group}`;
    if (!new RegExp(`^-?\\d{1,3}(${g}\\d{3})+\\${decimal}\\d+$`).test(text)) return NaN;
    plain = text.split(group).join("").replace(decimal, ".");
  } else if (text.includes(",")) {
    plain = decimalMarkOf(locale) === "." && /^-?[1-9]\d{0,2}(,\d{3})+$/.test(text) ? text.replace(/,/g, "") : text.replace(",", ".");
  } else {
    plain = text;
  }
  // Number("") is 0 and Number(" 1") trims; only digits, one point and a leading sign are a number here.
  if (!/^-?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(plain)) return NaN;
  return Number(plain);
}
