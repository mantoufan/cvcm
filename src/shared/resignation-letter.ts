/**
 * Resignation letter generator: the form, date wording and the document built from a locale's template
 * (src/shared/resignation-letter-templates.ts). Pure, so the page, the tests and the prerender agree.
 */
import type { DocLine, LetterDoc } from "./letter-doc";

export type RlField =
  | "kind" | "scenario" | "vertical" | "era" | "place" | "name" | "title" | "department" | "company"
  | "recipientTitle" | "recipient" | "startDate" | "lastDay" | "date" | "thanks" | "handover";

export type RlForm = {
  kind: string;
  scenario: string;
  /** Japanese 縦書き. */
  vertical: boolean;
  /** Japanese dates: 令和 (wareki) or 西暦 (seireki). */
  era: "wareki" | "seireki";
  place: string;
  name: string;
  title: string;
  department: string;
  company: string;
  recipientTitle: string;
  recipient: string;
  /** ISO yyyy-mm-dd or "". */
  startDate: string;
  lastDay: string;
  date: string;
  thanks: boolean;
  handover: boolean;
  /** "Edit the text myself": the body is `body` instead of the generated paragraphs. */
  custom: boolean;
  body: string;
};

/** A letter split where the editable part is: lines above the body, the body paragraphs, lines below. */
export type RlParts = { head: DocLine[]; body: string; tail: DocLine[]; indentBody?: boolean };

export type RlTemplate = {
  lang: string;
  serif?: boolean;
  /** Document kinds (letter / email, 退職届 / 退職願 …) with their names; the first is the default. */
  kinds: readonly (readonly [string, string])[];
  /** Reasons or situations with their names; empty when the format has one fixed wording. */
  scenarios: readonly (readonly [string, string])[];
  /** The inputs this format uses, in form order. */
  fields: readonly RlField[];
  build(f: RlForm): RlParts;
  /** Words for the file name: the document's own name. */
  fileStem(f: RlForm): string;
};

export function defaultForm(tpl: RlTemplate): RlForm {
  return {
    kind: tpl.kinds[0][0],
    scenario: tpl.scenarios[0]?.[0] ?? "",
    vertical: true,
    era: "wareki",
    place: "",
    name: "",
    title: "",
    department: "",
    company: "",
    recipientTitle: "",
    recipient: "",
    startDate: "",
    lastDay: "",
    date: "",
    thanks: true,
    handover: true,
    custom: false,
    body: "",
  };
}

/** The whole letter: generated, or with the visitor's own body text. */
export function buildLetter(tpl: RlTemplate, f: RlForm): LetterDoc {
  const parts = tpl.build(f);
  const body = (f.custom ? f.body : parts.body)
    .split(/\n\s*\n/)
    .map((p) => p.replace(/^\n+|\n+$/g, ""))
    .filter((p) => p.trim() !== "");
  const lines: DocLine[] = [...parts.head];
  // Indented (Chinese, Japanese) paragraphs follow each other directly; the others keep a blank line between them.
  body.forEach((text, i) => lines.push({ text, indent: parts.indentBody, gap: i === 0 || !parts.indentBody ? 1 : 0 }));
  lines.push(...parts.tail);
  return { lines, lang: tpl.lang, serif: tpl.serif, vertical: tpl.lang === "ja" ? f.vertical : false };
}

/** yyyy-mm-dd → [y, m, d], or null for "" or an impossible date. */
export function parseIso(iso: string): [number, number, number] | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return [y, mo, d];
}

/** Whole days from `a` to `b` (calendar days, b − a), or null when either is missing. */
export function daysBetween(a: string, b: string): number | null {
  const pa = parseIso(a);
  const pb = parseIso(b);
  if (!pa || !pb) return null;
  return Math.round((Date.UTC(pb[0], pb[1] - 1, pb[2]) - Date.UTC(pa[0], pa[1] - 1, pa[2])) / 86_400_000);
}

export function addDays(iso: string, days: number): string {
  const p = parseIso(iso);
  if (!p) return "";
  const d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + days));
  return d.toISOString().slice(0, 10);
}

/** 令和 year for a date on or after 2019-05-01 (元年 for the first), else null. */
export function reiwaYear(y: number, m: number): string | null {
  if (y < 2019 || (y === 2019 && m < 5)) return null;
  const n = y - 2018;
  return n === 1 ? "元" : String(n);
}

/**
 * Length of service in whole months from the start date to the letter date (a month counts once its day comes round;
 * the 31st counts on the last day of a shorter month).
 */
export function serviceMonths(start: string, until: string): number | null {
  const a = parseIso(start);
  const b = parseIso(until);
  if (!a || !b) return null;
  let months = (b[0] - a[0]) * 12 + (b[1] - a[1]);
  const lastOfMonth = new Date(Date.UTC(b[0], b[1], 0)).getUTCDate();
  if (b[2] < Math.min(a[2], lastOfMonth)) months -= 1;
  return months;
}

/**
 * Taiwan Labor Standards Act: a worker ending an open-ended contract gives the notice of art. 16(1) (art. 15(2)):
 * 3 months to under 1 year of service 10 days, 1 to under 3 years 20 days, 3 years or more 30 days.
 * Under three months the Act sets no period (null).
 * https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=N0030001&flno=15
 * https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=N0030001&flno=16
 */
export function taiwanNoticeDays(months: number): number | null {
  if (months < 3) return null;
  if (months < 12) return 10;
  if (months < 36) return 20;
  return 30;
}
