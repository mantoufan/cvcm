/**
 * Cover letter generator: the form data, the helpers every language's template uses, and the assembly of a letter
 * from a template (the templates themselves are in cover-letter-templates.ts, loaded with the tool only).
 */
import type { LetterDoc } from "./letter-doc";

export const COVER_FIELDS = [
  "name", "birth", "address", "phone", "email", "place", "date",
  "company", "manager", "companyAddress", "job", "source",
  "role", "years", "education", "achievements", "skills", "why", "availability",
  "growth", "character", "motive", "plan",
] as const;
export type CoverField = (typeof COVER_FIELDS)[number];

export const COVER_SCENARIOS = ["experienced", "graduate", "internship", "change"] as const;
export type CoverScenario = (typeof COVER_SCENARIOS)[number];

export type CoverData = Record<CoverField, string> & {
  scenario: CoverScenario;
  /** Indexes into the template's enclosure list that are ticked. */
  enclosures: number[];
  /** The body as the visitor rewrote it ("Edit the text"), or null for the generated body. */
  custom: string | null;
};

/** Fields that only some scenarios use; the form hides the rest (unless the template prints them elsewhere). */
export const SCENARIO_HIDES: Record<CoverScenario, readonly CoverField[]> = {
  experienced: ["education"],
  change: ["education"],
  graduate: ["role", "years"],
  internship: ["role", "years"],
};

export type BuiltLetter = { doc: LetterDoc; /** Index in doc.lines of the date line (left out of public HTML). */ dateLine: number };

export type CoverTemplate = {
  lang: string;
  serif: boolean;
  /** Form fields this format uses, in form order. */
  fields: readonly CoverField[];
  /** Fields printed outside the body (a data table), so a scenario never hides them. */
  keep: readonly CoverField[];
  scenarios: boolean;
  /** Whether "Edit the text" applies (the Korean self-introduction is written by hand already). */
  editable: boolean;
  enclosures: readonly string[];
  defaultEnclosures: readonly number[];
  sample: Record<CoverField, string>;
  /** The paragraphs "Edit the text" replaces. */
  body(d: CoverData): string[];
  doc(d: CoverData, body: string[]): BuiltLetter;
};

/** Empty form data. */
export function blankData(scenario: CoverScenario = "experienced", enclosures: readonly number[] = []): CoverData {
  const out = Object.fromEntries(COVER_FIELDS.map((f) => [f, ""])) as Record<CoverField, string>;
  return { ...out, scenario, enclosures: [...enclosures], custom: null };
}

/** The template's sample applicant, so the page opens with a complete letter. */
export function sampleData(tpl: CoverTemplate): CoverData {
  return { ...blankData("experienced", tpl.defaultEnclosures), ...tpl.sample };
}

/** A typed value, or the template's fill-in mark when the field is empty. */
export function val(d: CoverData, key: CoverField, mark: string): string {
  return d[key].trim() || mark;
}

/** One line per item; list marks the visitor typed (-, •, 1.) are dropped so the template sets its own. */
export function items(text: string): string[] {
  return text.split(/\r?\n/).map((s) => s.replace(/^\s*(?:[-•*·・]|\d+[.)、．])\s*/, "").trim()).filter(Boolean);
}

/** Paragraphs of a rewritten body: blank lines separate them. */
export function paragraphs(text: string): string[] {
  return text.replace(/\r\n?/g, "\n").split(/\n[ \t　]*\n+/).map((p) => p.replace(/^\n+|\s+$/g, "")).filter((p) => p.trim());
}

/** Characters with and without spaces, as Korean self-introduction limits are stated (a line break counts as one). */
export function charCount(text: string): { withSpaces: number; withoutSpaces: number } {
  const norm = text.replace(/\r\n?/g, "\n");
  return { withSpaces: [...norm].length, withoutSpaces: [...norm.replace(/\s/g, "")].length };
}

/** A YYYY-MM-DD input value as numbers, or null when empty or malformed. */
export function dateParts(iso: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  // Real calendar days only: 2026-02-31 from a hand-edited draft is not 3 March.
  if (mo < 1 || mo > 12 || d < 1 || d > new Date(Date.UTC(y, mo, 0)).getUTCDate()) return null;
  return { y, m: mo, d };
}

/** Today in the visitor's time zone, as a date input value. */
export function todayIso(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/** The letter for the current data: the generated body, or the visitor's own when they edited it. */
export function buildCover(tpl: CoverTemplate, d: CoverData): BuiltLetter {
  const body = tpl.editable && d.custom !== null ? paragraphs(d.custom) : tpl.body(d);
  return tpl.doc(d, body);
}

/** The generated body as one text, to seed "Edit the text". */
export function bodyText(tpl: CoverTemplate, d: CoverData): string {
  return tpl.body(d).join("\n\n");
}

/** Reads a saved draft back, keeping only known fields of the right type (old or hand-edited storage is ignored). */
export function restoreData(raw: unknown, tpl: CoverTemplate): CoverData | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const out = blankData();
  for (const f of COVER_FIELDS) if (typeof r[f] === "string") out[f] = (r[f] as string).slice(0, 5000);
  if (typeof r.scenario === "string" && (COVER_SCENARIOS as readonly string[]).includes(r.scenario)) out.scenario = r.scenario as CoverScenario;
  if (Array.isArray(r.enclosures)) {
    out.enclosures = [...new Set(r.enclosures.filter((n): n is number => Number.isInteger(n) && n >= 0 && n < tpl.enclosures.length))].sort((a, b) => a - b);
  }
  out.custom = typeof r.custom === "string" ? r.custom.slice(0, 20000) : null;
  return out;
}
