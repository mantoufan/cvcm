import { fill } from "../../shared/fill";
import type { Locale } from "../../shared/locale";
import { ELEMENT_SLUGS, groupOf, periodOf, type ElementSlug } from "../../shared/elements";
import { elementName, elementsMessages, type ElementRow } from "../../shared/elements-i18n";
import { elementsPageHtml, type ElementListColumn } from "../../shared/elements-page";

/** Sort key of one list column (numbers as numbers; a missing value sorts last either way). */
function sortValue(locale: Locale, row: ElementRow, column: ElementListColumn): number | string | null {
  const n = (value: string | null): number | null => (value === null ? null : Number(value));
  switch (column) {
    case "number": return row.z;
    case "symbol": return row.symbol;
    case "name": return elementName(locale, row.z);
    case "mass": return n(row.mass);
    case "category": return elementsMessages(locale).categories[row.category];
    case "group": return groupOf(row.z);
    case "period": return periodOf(row.z);
    case "state": return elementsMessages(locale).states[row.state];
    case "melting": return n(row.melting);
    case "boiling": return n(row.boiling);
    case "density": return n(row.density);
    case "electronegativity": return n(row.electronegativity);
    case "year": return row.year === "ancient" ? 0 : row.year;
  }
}

/** How well an element answers a hub search: 0 exact (its symbol or atomic number), 1 name prefix, 2 substring, null none. */
export function searchRank(locale: Locale, z: number, query: string): 0 | 1 | 2 | null {
  const m = elementsMessages(locale);
  const row = m.data[z - 1];
  const q = query.trim().toLocaleLowerCase(locale);
  if (!q) return 2;
  if (/^\d+$/.test(q)) return Number(q) === z ? 0 : null;
  if (row.symbol.toLowerCase() === q) return 0;
  const names = [elementName(locale, z), m.english[z - 1]].map((n) => n.toLocaleLowerCase(locale));
  if (names.some((n) => n.startsWith(q))) return 1;
  // Names, the symbol and the category label; the atomic number is left out so "6" does not also find element 16.
  const text = `${names.join(" ")} ${row.symbol.toLowerCase()} ${m.categories[row.category].toLocaleLowerCase(locale)}`;
  return text.includes(q) ? 2 : null;
}

/**
 * The hub list order for a search: matches only, exact first (symbol or atomic number, case-insensitive), then names
 * starting with the query, then names or categories containing it; inside each rank, the list's current sort.
 */
export function searchOrder(locale: Locale, query: string, category: string, order: readonly number[]): { zs: number[]; exact: number | null } {
  const m = elementsMessages(locale);
  const ranked = order
    .filter((z) => !category || m.data[z - 1].category === category)
    .map((z, index) => ({ z, index, rank: searchRank(locale, z, query) }))
    .filter((r): r is { z: number; index: number; rank: 0 | 1 | 2 } => r.rank !== null)
    .sort((a, b) => a.rank - b.rank || a.index - b.index);
  const exact = query.trim() && ranked[0]?.rank === 0 ? ranked[0].z : null;
  return { zs: ranked.map((r) => r.z), exact };
}

/**
 * Search, category filter (select and legend) and sortable columns. The table above dims elements outside the result
 * and marks an exact match (symbol or atomic number); the list puts that element first.
 */
function wireHub(host: HTMLElement, locale: Locale): void {
  const m = elementsMessages(locale);
  const search = host.querySelector<HTMLInputElement>(".pt-search");
  const filter = host.querySelector<HTMLSelectElement>(".pt-filter");
  const count = host.querySelector<HTMLElement>(".pt-count");
  const body = host.querySelector<HTMLTableSectionElement>(".pt-list tbody");
  if (!search || !filter || !count || !body) return;
  const rowOf = new Map([...body.querySelectorAll<HTMLTableRowElement>("tr[data-z]")].map((tr) => [Number(tr.dataset.z), tr]));
  const cells = [...host.querySelectorAll<HTMLElement>(".pt-cell[data-z]")];
  const keys = [...host.querySelectorAll<HTMLButtonElement>(".pt-key")];
  const collator = new Intl.Collator(locale, { numeric: true });
  /** Atomic numbers in the list's sort order (atomic number, ascending, until a header is clicked). */
  let sorted = [...rowOf.keys()];
  const apply = (): void => {
    const { zs, exact } = searchOrder(locale, search.value, filter.value, sorted);
    const shown = new Set(zs);
    for (const [z, tr] of rowOf) {
      tr.hidden = !shown.has(z);
      tr.classList.toggle("pt-hit", z === exact);
    }
    body.append(...zs.map((z) => rowOf.get(z)!), ...sorted.filter((z) => !shown.has(z)).map((z) => rowOf.get(z)!));
    const filtering = Boolean(search.value.trim() || filter.value);
    for (const cell of cells) {
      const z = Number(cell.dataset.z);
      cell.classList.toggle("pt-dim", filtering && !shown.has(z));
      cell.classList.toggle("pt-hit", z === exact);
    }
    for (const key of keys) key.setAttribute("aria-pressed", String(key.dataset.cat === filter.value));
    count.textContent = fill(m.hub.shown, { n: zs.length, total: ELEMENT_SLUGS.length });
  };
  search.addEventListener("input", apply);
  filter.addEventListener("change", apply);
  for (const key of keys) {
    key.addEventListener("click", () => {
      filter.value = filter.value === key.dataset.cat ? "" : key.dataset.cat ?? "";
      apply();
    });
  }
  const heads = [...host.querySelectorAll<HTMLButtonElement>(".pt-list .data-sort")];
  // The prerendered list is in atomic-number order and its header says so (aria-sort="ascending").
  let sortCol: ElementListColumn = "number";
  let dir = 1;
  for (const button of heads) {
    button.addEventListener("click", () => {
      const column = button.dataset.col as ElementListColumn;
      // A new column starts ascending; the same column again flips the direction.
      dir = sortCol === column ? -dir : 1;
      sortCol = column;
      sorted = [...rowOf.keys()].sort((za, zb) => {
        const x = sortValue(locale, m.data[za - 1], column);
        const y = sortValue(locale, m.data[zb - 1], column);
        // A missing value sorts last in both directions.
        if (x === null || y === null) return x === y ? za - zb : x === null ? 1 : -1;
        const diff = typeof x === "number" && typeof y === "number" ? x - y : collator.compare(String(x), String(y));
        return diff * dir || za - zb;
      });
      for (const other of heads) other.parentElement?.setAttribute("aria-sort", other === button ? (dir > 0 ? "ascending" : "descending") : "none");
      apply();
    });
  }
}

/** The periodic table hub (null) or one element. Static text, so the page is the same HTML the Worker serves. */
export function mountElements(host: HTMLElement, locale: Locale, slug: ElementSlug | null): void {
  host.innerHTML = elementsPageHtml(locale, slug);
  if (!slug) wireHub(host, locale);
}
