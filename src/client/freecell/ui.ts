import { t } from "../i18n";
import { mountCardGame } from "../card-table";
import { alternating, pile } from "../../shared/cards";
import { FREECELL_MAX_DEAL, dealFreeCell, freeCellCapacity, freecell, settleFreeCell } from "../../shared/solitaire-rules";

/** FreeCell with the traditional numbered deals, written for cv.cm on the shared card table. */
let cleanup: (() => void) | null = null;

export function mountFreeCell(host: HTMLElement): void {
  unmountFreeCell();
  cleanup = mountCardGame<"standard">(host, {
    ns: "freecell",
    storeKey: "cvcm.freecell.v1",
    top: ["c0", "c1", "c2", "c3", "f0", "f1", "f2", "f3"],
    tableau: Array.from({ length: 8 }, (_, i) => `t${i}`),
    maxDeal: FREECELL_MAX_DEAL,
    start: { deal: 1, option: "standard" },
    option: { field: "variant", values: ["standard"], label: () => t("freecell.standard") },
    deal: (n) => settleFreeCell(dealFreeCell(n)),
    rules: () => freecell,
    lift: (table, id, count) => {
      const p = pile(table, id);
      if (p.kind === "tableau") return alternating(p.cards.slice(-count));
      return count === 1 && p.kind === "cell";
    },
    stats: (table) => [[t("freecell.canMove"), String(freeCellCapacity(table, false))]],
    refused: (table, m) => {
      const to = pile(table, m.to);
      const cap = freeCellCapacity(table, to.kind === "tableau" && !to.cards.length);
      return m.count > cap ? t("freecell.tooMany", { n: cap }) : null;
    },
  });
}

export function unmountFreeCell(): void {
  cleanup?.();
  cleanup = null;
}
