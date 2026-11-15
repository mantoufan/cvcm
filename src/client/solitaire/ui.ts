import { t } from "../i18n";
import { mountCardGame } from "../card-table";
import { seeded } from "../../shared/random";
import { alternating, pile } from "../../shared/cards";
import { dealKlondike, klondike } from "../../shared/solitaire-rules";

/** Klondike solitaire (draw 1 or 3), written for cv.cm on the shared card table. */
let cleanup: (() => void) | null = null;

export function mountSolitaire(host: HTMLElement): void {
  unmountSolitaire();
  cleanup = mountCardGame<1 | 3>(host, {
    ns: "solitaire",
    storeKey: "cvcm.solitaire.v1",
    top: ["stock", "waste", null, "f0", "f1", "f2", "f3"],
    tableau: ["t0", "t1", "t2", "t3", "t4", "t5", "t6"],
    maxDeal: 1_000_000,
    start: { deal: 1, option: 1 },
    option: { field: "draw", values: [1, 3], label: (v) => t(`solitaire.draw${v}`) },
    deal: (n) => dealKlondike(seeded(n)),
    rules: (draw) => klondike(draw),
    lift: (table, id, count) => {
      const p = pile(table, id);
      if (p.kind === "tableau") return alternating(p.cards.slice(-count));
      return count === 1 && (p.kind === "waste" || p.kind === "foundation");
    },
  });
}

export function unmountSolitaire(): void {
  cleanup?.();
  cleanup = null;
}
