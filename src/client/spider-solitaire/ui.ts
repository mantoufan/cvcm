import { t } from "../i18n";
import { mountCardGame } from "../card-table";
import { seeded } from "../../shared/random";
import { pile, sameSuitRun } from "../../shared/cards";
import { dealSpider, spider, spiderStockBlocked, type SpiderSuits } from "../../shared/solitaire-rules";

/** Spider solitaire in one, two or four suits, written for cv.cm on the shared card table. */
let cleanup: (() => void) | null = null;

export function mountSpiderSolitaire(host: HTMLElement): void {
  unmountSpiderSolitaire();
  cleanup = mountCardGame<SpiderSuits>(host, {
    ns: "spiderSolitaire",
    storeKey: "cvcm.spider.v1",
    top: ["stock", null, null, null, null, null, null, null, null, null],
    tableau: Array.from({ length: 10 }, (_, i) => `t${i}`),
    maxDeal: 1_000_000,
    start: { deal: 1, option: 1 },
    option: { field: "suits", values: [1, 2, 4], label: (v) => t(`spiderSolitaire.suits${v}`) },
    deal: (n, suits) => dealSpider(suits, seeded(n)),
    rules: () => spider,
    lift: (table, id, count) => {
      const p = pile(table, id);
      return p.kind === "tableau" && sameSuitRun(p.cards.slice(-count));
    },
    stats: (table) => [
      [t("spiderSolitaire.dealsLeft"), String(pile(table, "stock").cards.length / 10)],
      [t("spiderSolitaire.completed"), `${table.done} / 8`],
    ],
    stockRefused: (table) => {
      const why = spiderStockBlocked(table);
      return why === "pile" ? "spiderSolitaire.fillPiles" : why === "empty" ? "spiderSolitaire.noDeals" : null;
    },
  });
}

export function unmountSpiderSolitaire(): void {
  cleanup?.();
  cleanup = null;
}
