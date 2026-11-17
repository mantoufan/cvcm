/**
 * The periodic table channel under `/{locale}/periodic-table/` (hub: the whole table) and
 * `/{locale}/periodic-table/{slug}/` (one page per element, slug = the IUPAC English name in lowercase). Code says
 * "elements", URLs say periodic-table. Data: PubChem's periodic table (NCBI/NLM, public domain) and Wikidata names
 * (CC0), snapshotted by `node scripts/fetch-elements.mjs`; pages never call either at runtime.
 *
 * This module is in the main bundle (path parsing needs the slugs): keep it to slugs and arithmetic. Element rows and
 * names travel in the elements pack (`src/locales/packs/elements-<locale>.ts`).
 */
import { ELEMENT_SLUGS, ELEMENTS_SNAPSHOT } from "./elements-slugs";

export { ELEMENT_SLUGS, ELEMENTS_SNAPSHOT };

export const ELEMENTS_SEGMENT = "periodic-table";

export type ElementSlug = (typeof ELEMENT_SLUGS)[number];

/** An elements page: the hub, one element, or none. */
export type ElementsPage = ElementSlug | "hub" | null;

/** The day the channel went live (the hub's datePublished). */
export const ELEMENTS_PUBLISHED = "2026-11-17";

export function isElementSlug(value: string): value is ElementSlug {
  return (ELEMENT_SLUGS as readonly string[]).includes(value);
}

/** Atomic number of a slug (1–118). */
export function atomicNumberOf(slug: ElementSlug): number {
  return ELEMENT_SLUGS.indexOf(slug) + 1;
}

export function slugOf(z: number): ElementSlug {
  const slug = ELEMENT_SLUGS[z - 1];
  if (!slug) throw new Error(`no element ${z}`);
  return slug;
}

/** Elements the site footer and the tutorials hub link directly; names are core-pack `periodicTable.focus.*`. */
export const ELEMENTS_FOCUS = [
  "hydrogen",
  "helium",
  "carbon",
  "nitrogen",
  "oxygen",
  "sodium",
  "iron",
  "copper",
  "gold",
  "uranium",
] as const satisfies readonly ElementSlug[];

/** First atomic number of each period (row): period n holds PERIOD_START[n - 1] … PERIOD_START[n] - 1. */
const PERIOD_START = [1, 3, 11, 19, 37, 55, 87, 119];

export function periodOf(z: number): number {
  for (let p = 1; p < PERIOD_START.length; p++) if (z < PERIOD_START[p]) return p;
  throw new Error(`no element ${z}`);
}

/**
 * Lanthanum–lutetium (57–71) and actinium–lawrencium (89–103): the f-block rows under the main table. IUPAC's table
 * shows them as one cell "57–71" / "89–103" in group 3 of periods 6 and 7, with no group number of their own.
 */
export function isFBlockRow(z: number): boolean {
  return (z >= 57 && z <= 71) || (z >= 89 && z <= 103);
}

/** IUPAC group 1–18, or null for the f-block rows (see isFBlockRow). */
export function groupOf(z: number): number | null {
  if (isFBlockRow(z)) return null;
  const period = periodOf(z);
  if (period === 1) return z === 1 ? 1 : 18;
  const offset = z - PERIOD_START[period - 1];
  if (period <= 3) return offset < 2 ? offset + 1 : offset + 11;
  if (period <= 5) return offset + 1;
  // Periods 6 and 7: s-block (groups 1–2), then the f-block row, then groups 4–18 from hafnium / rutherfordium.
  if (offset < 2) return offset + 1;
  return offset - 14 + 1;
}

/** s, p, d or f, from the position (helium is s-block, the f-block rows f). */
export function blockOf(z: number): "s" | "p" | "d" | "f" {
  if (isFBlockRow(z)) return "f";
  const group = groupOf(z)!;
  if (z === 2 || group <= 2) return "s";
  if (group >= 13) return "p";
  return "d";
}

/**
 * Grid cell of an element on the page: rows 1–7 are the periods, row 9 the lanthanoids and row 10 the actinoids (row 8
 * is a gap), columns 1–18 the groups; the f-block rows run from column 3 (La / Ac) to column 17 (Lu / Lr).
 */
export function cellOf(z: number): { row: number; col: number } {
  if (z >= 57 && z <= 71) return { row: 9, col: z - 57 + 3 };
  if (z >= 89 && z <= 103) return { row: 10, col: z - 89 + 3 };
  return { row: periodOf(z), col: groupOf(z)! };
}

/** Elements in a group, top to bottom. */
export function groupMembers(group: number): number[] {
  const out: number[] = [];
  for (let z = 1; z <= ELEMENT_SLUGS.length; z++) if (groupOf(z) === group) out.push(z);
  return out;
}

/**
 * Elements with no IUPAC (CIAAW) standard atomic weight: technetium, promethium and everything from polonium on except
 * thorium, protactinium and uranium. Their mass is shown in brackets: it is one isotope's mass as PubChem lists it, not
 * an average over a natural isotopic composition.
 */
export function hasStandardWeight(z: number): boolean {
  if (z === 43 || z === 61) return false;
  if (z >= 84 && z <= 89) return false;
  if (z >= 93) return false;
  return true;
}

const SUBSHELL = /^(\d)([spdf])(\d+)$/;
const CORES: Record<string, string> = {
  He: "1s2",
  Ne: "1s2 2s2 2p6",
  Ar: "1s2 2s2 2p6 3s2 3p6",
  Kr: "1s2 2s2 2p6 3s2 3p6 3d10 4s2 4p6",
  Xe: "1s2 2s2 2p6 3s2 3p6 3d10 4s2 4p6 4d10 5s2 5p6",
  Rn: "1s2 2s2 2p6 3s2 3p6 3d10 4s2 4p6 4d10 5s2 5p6 4f14 5d10 6s2 6p6",
};
const L_ORDER = "spdf";

/** Subshells of a configuration such as "[Xe]6s2 4f14 5d10", the noble-gas core expanded, in n then l order. */
export function subshells(config: string): { n: number; l: string; e: number }[] {
  const core = /^\[(\w+)\]\s*/.exec(config);
  const text = `${core ? CORES[core[1]] ?? "" : ""} ${core ? config.slice(core[0].length) : config}`;
  if (core && !CORES[core[1]]) throw new Error(`unknown core ${core[1]}`);
  const parts = text.trim().split(/\s+/).map((part) => {
    const m = SUBSHELL.exec(part);
    if (!m) throw new Error(`bad subshell ${part} in ${config}`);
    return { n: Number(m[1]), l: m[2], e: Number(m[3]) };
  });
  return parts.sort((a, b) => a.n - b.n || L_ORDER.indexOf(a.l) - L_ORDER.indexOf(b.l));
}

/** Electrons per shell (K, L, M …), from the configuration. */
export function shellsOf(config: string): number[] {
  const shells: number[] = [];
  for (const { n, e } of subshells(config)) shells[n - 1] = (shells[n - 1] ?? 0) + e;
  return Array.from(shells, (e) => e ?? 0);
}
