import { h } from "../dom";
import { t } from "../i18n";
import { linkList } from "../links";
import type { Locale } from "../../shared/locale";
import { appHref, datasetHref, rankingHref } from "../../shared/path";
import { datasetMessages } from "../../shared/messages";
import { fill } from "../../shared/datasets-i18n";
import { RANKING_GROUPS, RANKING_SOURCE, RANKING_TOOLS, rankingCsvHref, rankingGroupOf, rankingMeta, type RankingId } from "../../shared/rankings";
import { rankingDate, rankingFaqItems, rankingHub, rankingLinkMeta, rankingName, rankingPageCopy, rankingTable, rankingUi } from "../../shared/rankings-i18n";
import { dataTable } from "../datasets/ui";
import type { DatasetId } from "../../shared/datasets";
import { datasetLinkMeta, datasetName } from "../../shared/datasets-i18n";

/** Geography rows, one chunk per table: literal imports, so Vite splits them (import.meta.glob breaks the prerender). */
const GEO_ROWS: Partial<Record<RankingId, () => Promise<{ default: unknown }>>> = {
  "tallest-mountains": () => import("../../shared/rankings-geo/tallest-mountains.json"),
  "longest-rivers": () => import("../../shared/rankings-geo/longest-rivers.json"),
  "largest-lakes": () => import("../../shared/rankings-geo/largest-lakes.json"),
  "largest-islands": () => import("../../shared/rankings-geo/largest-islands.json"),
};

/** Country tables that are rankings too: the hub links them rather than repeating them. */
const COUNTRY_TABLES: readonly DatasetId[] = ["population", "gdp", "gdp-per-capita", "life-expectancy", "land-area", "internet-users"];

function crumb(locale: Locale, id: RankingId | null): HTMLElement {
  const hub = rankingHub(locale);
  const home = h("a", { href: appHref(locale, null), "data-nav": "home" }, datasetMessages(locale).crumbHome);
  const sep = (): HTMLElement => h("span", { "aria-hidden": "true" }, "/");
  if (!id) return h("nav", { class: "device-crumb", "aria-label": hub.h1 }, home, sep(), h("span", null, hub.h1));
  return h("nav", { class: "device-crumb", "aria-label": hub.h1 },
    home, sep(),
    h("a", { href: rankingHref(locale), "data-nav": "rankings" }, hub.h1), sep(),
    h("span", null, rankingName(locale, id).name),
  );
}

function faq(locale: Locale, id: RankingId | null): HTMLElement {
  return h("section", { class: "faq", "aria-labelledby": "faq-title" },
    h("h2", { id: "faq-title" }, rankingUi(locale).faq),
    ...rankingFaqItems(locale, id).map((item, index) =>
      h("details", index === 0 ? { open: true } : null, h("summary", null, item.q), h("p", null, item.a)),
    ),
  );
}

function setLinks(locale: Locale, ids: readonly RankingId[]): HTMLElement {
  return linkList(ids.map((id) => {
    const name = rankingName(locale, id);
    return { href: rankingHref(locale, id), name: name.name, blurb: name.blurb, meta: rankingLinkMeta(locale, id), nav: `ranking-${id}` };
  }));
}

export function mountRankingHub(host: HTMLElement, locale: Locale): void {
  const hub = rankingHub(locale);
  host.append(
    crumb(locale, null),
    h("h1", null, hub.h1),
    h("p", { class: "lede" }, hub.lede),
    h("section", { class: "wall quiz-hub" },
      ...RANKING_GROUPS.map((group) => h("div", { class: "group" }, h("h2", null, hub.groups[group.id]), setLinks(locale, group.sets))),
      h("div", { class: "group" },
        h("h2", null, hub.groups.countries),
        linkList(COUNTRY_TABLES.map((id) => {
          const name = datasetName(locale, id);
          return { href: datasetHref(locale, id), name: name.name, blurb: name.blurb, meta: datasetLinkMeta(locale, id), nav: `dataset-${id}` };
        })),
      ),
    ),
    h("section", { class: "wall" },
      h("h2", null, hub.makeYourOwn),
      linkList([{ href: appHref(locale, "tier-list"), name: t("tools.tier-list.name"), blurb: t("tools.tier-list.blurb"), nav: "tier-list" }]),
    ),
    h("section", { class: "quiz-about" }, ...hub.about.map((p) => h("p", null, p))),
    faq(locale, null),
  );
}

export async function mountRanking(host: HTMLElement, locale: Locale, id: RankingId, alive: () => boolean): Promise<void> {
  const geo = GEO_ROWS[id];
  const table = geo ? (await geo()).default : ((await import("../../shared/rankings-rows.json")).default as Record<string, unknown[]>)[id];
  if (!alive()) return;
  const ui = rankingUi(locale);
  const copy = rankingPageCopy(locale, id);
  const source = RANKING_SOURCE[id];
  const group = RANKING_GROUPS.find((g) => g.id === rankingGroupOf(id))!;
  const related = [...group.sets.filter((set) => set !== id), ...RANKING_GROUPS.filter((g) => g !== group).map((g) => g.sets[0])];
  host.append(
    crumb(locale, id),
    h("h1", null, copy.h1),
    h("p", { class: "lede" }, copy.lede),
    h("section", { class: "data-facts", "aria-labelledby": "facts-title" },
      h("h2", { id: "facts-title" }, ui.facts),
      h("ul", null, ...copy.facts.map((fact) => h("li", null, fact))),
    ),
    dataTable(locale, {
      label: rankingName(locale, id).name,
      caption: copy.h1,
      csvHref: rankingCsvHref(id),
      csvName: `${id}.csv`,
      ui,
    }, rankingTable(locale, id, table as unknown[])),
    h("p", { class: "data-source muted" },
      `${ui.source}: `, h("a", { href: source.url, rel: "noopener", target: "_blank" }, source.name),
      ` · ${ui.license}: `, h("a", { href: source.licenseUrl, rel: "noopener license", target: "_blank" }, source.license),
      ` · ${fill(ui.dataAsOf, { date: rankingDate(locale, rankingMeta(id).asOf) })}`,
      ` · ${fill(ui.snapshot, { date: rankingMeta(id).updated })}`,
    ),
    h("section", { class: "quiz-about" }, h("h2", null, ui.about), ...copy.about.map((p) => h("p", null, p))),
    faq(locale, id),
    h("section", { class: "wall" }, h("h2", null, ui.related), setLinks(locale, related)),
    ...(RANKING_TOOLS[id]?.length
      ? [h("section", { class: "wall" },
        h("h2", null, ui.tools),
        linkList(RANKING_TOOLS[id]!.map((tool) => ({ href: appHref(locale, tool), name: t(`tools.${tool}.name`), blurb: t(`tools.${tool}.blurb`), nav: tool }))),
      )]
      : []),
    h("p", { class: "more" }, h("a", { href: rankingHref(locale), "data-nav": "rankings" }, ui.all)),
  );
}
