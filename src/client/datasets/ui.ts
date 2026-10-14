import { h } from "../dom";
import { linkList } from "../links";
import { t } from "../i18n";
import type { Locale } from "../../shared/locale";
import { appHref, datasetHref } from "../../shared/path";
import {
  DATASET_GROUPS,
  DATASET_SNAPSHOT,
  DATASET_SOURCE,
  DATASET_TOOLS,
  csvHref,
  datasetGroupOf,
  type CountryRow,
  type DatasetId,
} from "../../shared/datasets";
import {
  datasetFaqItems,
  datasetHub,
  datasetLinkMeta,
  datasetName,
  datasetPageCopy,
  datasetTable,
  datasetUi,
  fill,
  type DatasetTable,
} from "../../shared/datasets-i18n";
import { datasetMessages } from "../../shared/messages";
import { loadDatasetRows } from "./rows";

function crumb(locale: Locale, id: DatasetId | null): HTMLElement {
  const hub = datasetHub(locale);
  const home = h("a", { href: appHref(locale, null), "data-nav": "home" }, datasetMessages(locale).crumbHome);
  const sep = (): HTMLElement => h("span", { "aria-hidden": "true" }, "/");
  if (!id) return h("nav", { class: "device-crumb", "aria-label": hub.h1 }, home, sep(), h("span", null, hub.h1));
  return h("nav", { class: "device-crumb", "aria-label": hub.h1 },
    home, sep(),
    h("a", { href: datasetHref(locale), "data-nav": "datasets" }, hub.h1), sep(),
    h("span", null, datasetName(locale, id).name),
  );
}

function faq(locale: Locale, id: DatasetId | null): HTMLElement {
  return h("section", { class: "faq", "aria-labelledby": "faq-title" },
    h("h2", { id: "faq-title" }, datasetUi(locale).faq),
    ...datasetFaqItems(locale, id).map((item, index) =>
      h("details", index === 0 ? { open: true } : null, h("summary", null, item.q), h("p", null, item.a)),
    ),
  );
}

function setLinks(locale: Locale, ids: readonly DatasetId[]): HTMLElement {
  return linkList(ids.map((id) => {
    const name = datasetName(locale, id);
    return { href: datasetHref(locale, id), name: name.name, blurb: name.blurb, meta: datasetLinkMeta(locale, id), nav: `dataset-${id}` };
  }));
}

export function mountDatasetHub(host: HTMLElement, locale: Locale): void {
  const hub = datasetHub(locale);
  host.append(
    crumb(locale, null),
    h("h1", null, hub.h1),
    h("p", { class: "lede" }, hub.lede),
    h("section", { class: "wall quiz-hub" },
      ...DATASET_GROUPS.map((group) => h("div", { class: "group" }, h("h2", null, hub.groups[group.id]), setLinks(locale, group.sets))),
    ),
    h("section", { class: "quiz-about" }, ...hub.about.map((p) => h("p", null, p))),
    faq(locale, null),
  );
}

/** Sortable, filterable table. The prerendered page carries every row, so crawlers see the whole table. */
function tableView(locale: Locale, id: DatasetId, table: DatasetTable): HTMLElement {
  const ui = datasetUi(locale);
  const total = table.rows.length;
  const rows = table.rows.map((cells, index) => ({
    index,
    cells,
    text: cells.map((c) => `${c.text} ${c.sort}`).join(" ").toLocaleLowerCase(locale),
    el: h("tr", null, ...cells.map((c, col) => {
      const column = table.columns[col];
      const cls = [column.num ? "num" : "", column.mono ? "mono" : "", column.wide ? "wide" : ""].join(" ").trim() || null;
      return h(column.head ? "th" : "td", { scope: column.head ? "row" : null, class: cls }, c.text);
    })),
  }));
  const count = h("p", { class: "data-count", "aria-live": "polite" }, fill(ui.rows, { n: total.toLocaleString(locale) }));
  const empty = h("p", { class: "data-empty", hidden: true }, ui.noMatch);
  const body = h("tbody", null, ...rows.map((r) => r.el));
  let sortCol = -1;
  let dir = 1;
  const heads = table.columns.map((col, index) => {
    const button = h("button", { type: "button", class: "data-sort" }, col.label);
    const th = h("th", { scope: "col", class: col.num ? "num" : null }, button);
    button.addEventListener("click", () => {
      dir = sortCol === index ? -dir : col.num ? -1 : 1;
      sortCol = index;
      const sorted = [...rows].sort((a, b) => {
        const x = a.cells[index].sort;
        const y = b.cells[index].sort;
        const diff = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), locale);
        return diff * dir || a.index - b.index;
      });
      body.append(...sorted.map((r) => r.el));
      heads.forEach((other, i) => other.setAttribute("aria-sort", i === index ? (dir > 0 ? "ascending" : "descending") : "none"));
    });
    th.setAttribute("aria-sort", "none");
    return th;
  });
  const search = h("input", {
    type: "search",
    class: "data-search",
    placeholder: ui.searchPlaceholder,
    "aria-label": ui.search,
    autocomplete: "off",
    enterkeyhint: "search",
  }) as HTMLInputElement;
  search.addEventListener("input", () => {
    const q = search.value.trim().toLocaleLowerCase(locale);
    let shown = 0;
    for (const r of rows) {
      const match = !q || r.text.includes(q);
      r.el.hidden = !match;
      if (match) shown++;
    }
    count.textContent = q
      ? fill(ui.shown, { shown: shown.toLocaleString(locale), n: total.toLocaleString(locale) })
      : fill(ui.rows, { n: total.toLocaleString(locale) });
    empty.hidden = shown > 0;
  });
  return h("section", { class: "data-table", "aria-label": datasetName(locale, id).name },
    h("div", { class: "data-tools" },
      search,
      h("a", { class: "btn ghost", href: csvHref(id), download: `${id}.csv` }, ui.download),
    ),
    count,
    h("div", { class: "data-wrap" },
      h("table", null,
        h("caption", null, `${datasetPageCopy(locale, id).h1}. ${ui.sortHint}`),
        h("thead", null, h("tr", null, ...heads)),
        body,
      ),
    ),
    empty,
  );
}

export async function mountDataset(host: HTMLElement, locale: Locale, id: DatasetId, alive: () => boolean): Promise<void> {
  const [rows, countries] = await Promise.all([
    loadDatasetRows(id),
    id === "currency-codes" ? loadDatasetRows("country-codes") : Promise.resolve([]),
  ]);
  if (!alive()) return;
  const ui = datasetUi(locale);
  const copy = datasetPageCopy(locale, id);
  const source = DATASET_SOURCE[id];
  const group = DATASET_GROUPS.find((g) => g.id === datasetGroupOf(id))!;
  const related = [...group.sets.filter((set) => set !== id), ...DATASET_GROUPS.filter((g) => g !== group).map((g) => g.sets[0])];
  const tools = DATASET_TOOLS[id] ?? [];
  host.append(
    crumb(locale, id),
    h("h1", null, copy.h1),
    h("p", { class: "lede" }, copy.lede),
    h("section", { class: "data-facts", "aria-labelledby": "facts-title" },
      h("h2", { id: "facts-title" }, ui.facts),
      h("ul", null, ...copy.facts.map((fact) => h("li", null, fact))),
    ),
    tableView(locale, id, datasetTable(locale, id, rows, countries as CountryRow[])),
    h("p", { class: "data-source muted" },
      `${ui.source}: `, h("a", { href: source.url, rel: "noopener", target: "_blank" }, source.name),
      ` · ${ui.license}: `, h("a", { href: source.licenseUrl, rel: "noopener license", target: "_blank" }, source.license),
      ` · ${fill(ui.snapshot, { date: DATASET_SNAPSHOT })}`,
    ),
    h("section", { class: "quiz-about" }, h("h2", null, ui.about), ...copy.about.map((p) => h("p", null, p))),
    faq(locale, id),
    h("section", { class: "wall" }, h("h2", null, ui.related), setLinks(locale, related)),
    ...(tools.length
      ? [h("section", { class: "wall" },
        h("h2", null, ui.tools),
        linkList(tools.map((tool) => ({ href: appHref(locale, tool), name: t(`tools.${tool}.name`), blurb: t(`tools.${tool}.blurb`), nav: tool }))),
      )]
      : []),
    h("p", { class: "more" }, h("a", { href: datasetHref(locale), "data-nav": "datasets" }, ui.all)),
  );
}
