import { fill } from "../../shared/fill";
import type { Locale } from "../../shared/locale";
import type { FoodId } from "../../shared/calories";
import { caloriesMessages } from "../../shared/messages";
import { formatNumber } from "../../shared/calories-i18n";
import { calcOutHtml, caloriesPageHtml } from "../../shared/calories-page";

/** Search, group filter and column sort on the hub table. Nothing runs until the reader types, picks or clicks. */
function wireHub(host: HTMLElement, locale: Locale): void {
  const section = host.querySelector<HTMLElement>(".cal-table");
  if (!section) return;
  const ui = caloriesMessages(locale).ui;
  const search = section.querySelector<HTMLInputElement>(".data-search");
  const select = section.querySelector<HTMLSelectElement>(".cal-group");
  const count = section.querySelector<HTMLElement>(".data-count");
  const empty = section.querySelector<HTMLElement>(".data-empty");
  const body = section.querySelector<HTMLTableSectionElement>("tbody");
  if (!search || !select || !count || !empty || !body) return;
  const rows = [...body.querySelectorAll<HTMLTableRowElement>("tr")].map((el, index) => ({ el, index }));
  const total = rows.length;
  const filter = (): void => {
    const q = search.value.trim().toLocaleLowerCase();
    const group = select.value;
    let shown = 0;
    for (const { el } of rows) {
      const match = (!q || (el.dataset.q ?? "").includes(q)) && (!group || el.dataset.group === group);
      el.hidden = !match;
      if (match) shown++;
    }
    count.textContent = shown === total
      ? fill(ui.rows, { n: formatNumber(locale, total, 0) })
      : fill(ui.shown, { shown: formatNumber(locale, shown, 0), n: formatNumber(locale, total, 0) });
    empty.hidden = shown > 0;
  };
  search.addEventListener("input", filter);
  select.addEventListener("change", filter);
  const collator = new Intl.Collator(locale, { numeric: true });
  const heads = [...section.querySelectorAll<HTMLTableCellElement>("thead th")];
  let sortCol = -1;
  let dir = 1;
  heads.forEach((th, col) => {
    th.querySelector("button")?.addEventListener("click", () => {
      const numeric = col >= 1;
      dir = sortCol === col ? -dir : col >= 2 ? -1 : 1;
      sortCol = col;
      const value = (el: HTMLTableRowElement): string => (el.children[col] as HTMLElement | undefined)?.dataset.v ?? "";
      const sorted = [...rows].sort((a, b) => {
        const x = value(a.el);
        const y = value(b.el);
        const diff = numeric ? Number(x) - Number(y) : collator.compare(x, y);
        return diff * dir || a.index - b.index;
      });
      body.append(...sorted.map((r) => r.el));
      heads.forEach((other, i) => other.setAttribute("aria-sort", i === col ? (dir > 0 ? "ascending" : "descending") : "none"));
    });
  });
}

/** The gram calculator: recomputes the list under it on every edit; the preset buttons fill the field. */
function wireCalc(host: HTMLElement, locale: Locale, id: FoodId): void {
  const input = host.querySelector<HTMLInputElement>(".cal-grams");
  const out = host.querySelector<HTMLElement>(".cal-out");
  if (!input || !out) return;
  const update = (): void => {
    const raw = input.value.trim().replace(",", ".");
    out.innerHTML = calcOutHtml(locale, id, raw === "" ? Number.NaN : Number(raw));
  };
  input.addEventListener("input", update);
  for (const button of host.querySelectorAll<HTMLButtonElement>(".cal-calc button[data-grams]")) {
    button.addEventListener("click", () => {
      input.value = button.dataset.grams ?? "100";
      update();
    });
  }
}

/** The calories hub (null) or one food. Static HTML from the pack's data, then wired; no network at mount. */
export function mountCalories(host: HTMLElement, locale: Locale, id: FoodId | null): void {
  host.innerHTML = caloriesPageHtml(locale, id);
  if (id) wireCalc(host, locale, id);
  else wireHub(host, locale);
}
