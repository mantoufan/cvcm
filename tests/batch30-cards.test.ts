import { describe, expect, it } from "vitest";
import { seeded } from "../src/shared/random";
import { bestMove, cardSet, pile, rankOf, suitOf, type Pile, type Table } from "../src/shared/cards";
import { dealFreeCell, dealKlondike, dealSpider, freeCellCapacity, freecell, klondike, settleFreeCell, spider, spiderStockBlocked } from "../src/shared/solitaire-rules";

const name = (c: number) => "A23456789TJQK"[rankOf(c) - 1] + "SHDC"[suitOf(c)];
const card = (text: string) => "SHDC".indexOf(text[1]!) * 13 + "A23456789TJQK".indexOf(text[0]!);
const P = (id: string, kind: Pile["kind"], cards: string[] = [], down = 0): Pile => ({ id, kind, cards: cards.map(card), down });

describe("freecell", () => {
  it("deals game #1 like every other FreeCell", () => {
    const cols = dealFreeCell(1).piles.filter((p) => p.kind === "tableau").map((p) => p.cards.map(name));
    expect(cols.map((c) => c[0]).join(" ")).toBe("JD 2D 9H JC 5D 7H 7C 5H");
    expect(cols.map((c) => c[6] ?? "").join(" ").trim()).toBe("6S 9C 2H 6H");
    expect(cardSet(dealFreeCell(617))).toEqual([...Array(52).keys()]);
  });

  it("limits run length by free cells and empty columns", () => {
    const t: Table = { done: 0, piles: [
      P("c0", "cell", ["KS"]), P("c1", "cell"), P("c2", "cell"), P("c3", "cell"),
      P("f0", "foundation"), P("f1", "foundation"), P("f2", "foundation"), P("f3", "foundation"),
      P("t0", "tableau", ["9H", "8S", "7H", "6S", "5H"]), P("t1", "tableau", ["TS"]), P("t2", "tableau"), P("t3", "tableau", ["2C"]),
      P("t4", "tableau", ["3C"]), P("t5", "tableau", ["4C"]), P("t6", "tableau", ["5C"]), P("t7", "tableau", ["6C"]),
    ] };
    expect(freeCellCapacity(t, false)).toBe(8); // (3 + 1) × 2
    expect(freeCellCapacity(t, true)).toBe(4);
    expect(freecell.play(t, { from: "t0", to: "t1", count: 5 })).not.toBeNull();
    expect(freecell.play(t, { from: "t0", to: "t2", count: 5 })).toBeNull();
    expect(freecell.play(t, { from: "t0", to: "t2", count: 4 })).not.toBeNull();
  });

  it("sends safe cards home after a move but keeps ones that may be needed", () => {
    const start = settleFreeCell(dealFreeCell(1));
    const homes = start.piles.filter((p) => p.kind === "foundation").flatMap((p) => p.cards);
    // In game #1 no ace is on top at the start.
    expect(homes).toEqual([]);
    const t: Table = { done: 0, piles: [
      P("c0", "cell"), P("c1", "cell"), P("c2", "cell"), P("c3", "cell"),
      P("f0", "foundation", ["AS"]), P("f1", "foundation", ["AH"]), P("f2", "foundation"), P("f3", "foundation"),
      P("t0", "tableau", ["3S", "AD"]), P("t1", "tableau", ["2S"]), P("t2", "tableau"), P("t3", "tableau"),
      P("t4", "tableau"), P("t5", "tableau"), P("t6", "tableau"), P("t7", "tableau"),
    ] };
    const n = freecell.play(t, { from: "t0", to: "c0", count: 1 })!;
    // A♦ and 2♠ are safe; 3♠ is not (2♦ and 2♣ are not home yet).
    expect(pile(n, "f0").cards.map(name)).toEqual(["AS", "2S"]);
    expect(pile(n, "c0").cards).toEqual([]);
    expect(pile(n, "t0").cards.map(name)).toEqual(["3S"]);
  });
});

describe("klondike", () => {
  it("deals 7 piles with the top card up and 24 in the stock", () => {
    const t = dealKlondike(seeded(1));
    const tabs = t.piles.filter((p) => p.kind === "tableau");
    expect(tabs.map((p) => p.cards.length)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(tabs.map((p) => p.down)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(pile(t, "stock").cards).toHaveLength(24);
    expect(cardSet(t)).toEqual([...Array(52).keys()]);
  });

  it("draws three, recycles the waste, and keeps kings for empty piles", () => {
    const rules = klondike(3);
    let t = dealKlondike(seeded(2));
    for (let i = 0; i < 8; i++) t = rules.stock(t)!;
    expect(pile(t, "stock").cards).toHaveLength(0);
    expect(pile(t, "waste").cards).toHaveLength(24);
    t = rules.stock(t)!;
    expect(pile(t, "stock").cards).toHaveLength(24);
    const empty: Table = { done: 0, piles: [P("stock", "stock"), P("waste", "waste", ["QH"]), P("f0", "foundation"), P("f1", "foundation"), P("f2", "foundation"), P("f3", "foundation"), P("t0", "tableau"), P("t1", "tableau", ["KS"])] };
    expect(rules.play(empty, { from: "waste", to: "t0", count: 1 })).toBeNull();
    expect(rules.play(empty, { from: "waste", to: "t1", count: 1 })).not.toBeNull();
  });

  it("turns the new top card over and finishes itself when all cards are open", () => {
    const rules = klondike(1);
    const t: Table = { done: 0, piles: [P("stock", "stock"), P("waste", "waste"), P("f0", "foundation"), P("f1", "foundation"), P("f2", "foundation"), P("f3", "foundation"), P("t0", "tableau", ["5D", "AS"], 1), P("t1", "tableau")] };
    const n = rules.play(t, { from: "t0", to: "f0", count: 1 })!;
    expect(pile(n, "t0").down).toBe(0);
    const almost: Table = { done: 0, piles: [P("stock", "stock"), P("waste", "waste"), P("f0", "foundation", ["AS"]), P("f1", "foundation"), P("f2", "foundation"), P("f3", "foundation"), P("t0", "tableau", ["3S", "AH"]), P("t1", "tableau", ["2S"])] };
    const done = rules.play(almost, { from: "t0", to: "f1", count: 1 })!;
    expect(pile(done, "f0").cards.map(name)).toEqual(["AS", "2S", "3S"]);
  });

  it("prefers the foundation when sending a card to its best place", () => {
    const rules = klondike(1);
    const t: Table = { done: 0, piles: [P("stock", "stock"), P("waste", "waste", ["AH"]), P("f0", "foundation"), P("f1", "foundation"), P("f2", "foundation"), P("f3", "foundation"), P("t0", "tableau", ["2S"]), P("t1", "tableau", ["9C"])] };
    expect(bestMove(rules, t, "waste", 1)?.to).toBe("f0");
  });
});

describe("spider", () => {
  it("deals 104 cards in the chosen suits, 54 out and 50 in the stock", () => {
    for (const suits of [1, 2, 4] as const) {
      const t = dealSpider(suits, seeded(3));
      expect(new Set(cardSet(t)).size).toBe(104);
      expect(new Set(cardSet(t).map(suitOf)).size).toBe(suits);
      expect(pile(t, "stock").cards).toHaveLength(50);
    }
  });

  it("moves only same-suit runs, clears K–A runs and refuses a deal onto an empty pile", () => {
    const run = ["KS", "QS", "JS", "TS", "9S", "8S", "7S", "6S", "5S", "4S", "3S", "2S"];
    const t: Table = { done: 0, piles: [P("stock", "stock", Array(10).fill("9H"), 10), P("t0", "tableau", ["4H", ...run], 1), P("t1", "tableau", ["AS"]), P("t2", "tableau", ["5H", "4D"]), ...Array.from({ length: 7 }, (_, i) => P(`t${i + 3}`, "tableau", ["KH"]))] };
    expect(spider.play(t, { from: "t2", to: "t0", count: 2 })).toBeNull();
    const n = spider.play(t, { from: "t1", to: "t0", count: 1 })!;
    expect(n.done).toBe(1);
    expect(pile(n, "t0").cards.map(name)).toEqual(["4H"]);
    expect(pile(n, "t0").down).toBe(0);
    expect(spiderStockBlocked(n)).toBe("pile");
    expect(spider.stock(n)).toBeNull();
  });
});
