/**
 * Rules for three patience games on the shared card table (cards.ts), written for cv.cm:
 * - Klondike ("solitaire"): 7 tableau piles, draw 1 or 3, unlimited redeals, kings to empty piles.
 * - Spider: 104 cards in 1, 2 or 4 suits, 10 piles, same-suit runs move together, K→A runs leave the table.
 * - FreeCell: four free cells, all cards face up; deals are numbered with the long-established public deal formula
 *   (a linear congruential generator) so "game #1" is the same layout players know from other FreeCell programs.
 */
import {
  alternating, clone, fitsFoundation, flipTops, isRed, pile, rankOf, runFrom, sameSuitRun, shuffle, suitOf, top, transfer,
  type Move, type Pile, type Rules, type Table,
} from "./cards";

const P = (id: string, kind: Pile["kind"], cards: number[] = [], down = 0): Pile => ({ id, kind, cards, down });
const ids = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => `${prefix}${i}`);

/** All face-up runs `from` pile could lift (count = cards from the top), largest first. */
function liftable(p: Pile, ok: (run: number[]) => boolean): number[] {
  const counts: number[] = [];
  for (let i = p.down; i < p.cards.length; i++) {
    const run = runFrom(p, i);
    if (run && ok(run)) counts.push(run.length);
  }
  return counts;
}

/** Moves every top card that fits onto a foundation, as long as any does (end-of-game sweep). */
function sweep(t: Table, safe: (t: Table, card: number) => boolean): Table {
  let moved = true;
  while (moved) {
    moved = false;
    for (const p of t.piles) {
      if (p.kind !== "tableau" && p.kind !== "cell" && p.kind !== "waste") continue;
      const c = top(p);
      if (c === undefined || p.cards.length <= p.down || !safe(t, c)) continue;
      const f = t.piles.find((x) => x.kind === "foundation" && fitsFoundation(x, c));
      if (!f) continue;
      transfer(p, f, 1);
      flipTops(t);
      moved = true;
    }
  }
  return t;
}

/** A card both of whose lower opposite-colour cards are home can never be needed in the tableau again. */
function safeHome(t: Table, card: number): boolean {
  const r = rankOf(card);
  if (r <= 2) return true;
  const height = (suit: number) => t.piles.find((p) => p.kind === "foundation" && p.cards.length && suitOf(p.cards[0]!) === suit)?.cards.length ?? 0;
  const opposite = isRed(card) ? [0, 3] : [1, 2];
  return Math.min(height(opposite[0]!), height(opposite[1]!)) >= r - 1;
}

const foundationsFull = (t: Table, cards: number) => t.piles.filter((p) => p.kind === "foundation").reduce((n, p) => n + p.cards.length, 0) === cards;

// ---------------------------------------------------------------- Klondike

export function dealKlondike(rand: () => number): Table {
  const deck = shuffle([...Array(52).keys()], rand);
  const piles: Pile[] = [P("stock", "stock"), P("waste", "waste"), ...ids("f", 4).map((id) => P(id, "foundation"))];
  for (let i = 0; i < 7; i++) piles.push(P(`t${i}`, "tableau", deck.splice(0, i + 1), i));
  piles[0]!.cards = deck;
  piles[0]!.down = deck.length;
  return { piles, done: 0 };
}

export function klondike(draw: 1 | 3): Rules {
  const tableauFits = (dest: Pile, run: number[]) => {
    const t = top(dest);
    return t === undefined ? rankOf(run[0]!) === 13 : rankOf(t) === rankOf(run[0]!) + 1 && isRed(t) !== isRed(run[0]!);
  };
  const legal = (t: Table, m: Move): boolean => {
    const from = pile(t, m.from);
    const to = pile(t, m.to);
    if (from === to || m.count < 1 || m.count > from.cards.length - from.down) return false;
    const run = from.cards.slice(-m.count);
    if (from.kind === "stock" || to.kind === "stock" || to.kind === "waste") return false;
    if ((from.kind === "waste" || from.kind === "foundation") && m.count !== 1) return false;
    if (to.kind === "foundation") return m.count === 1 && fitsFoundation(to, run[0]!);
    if (to.kind === "tableau") return alternating(run) && tableauFits(to, run);
    return false;
  };
  const rules: Rules = {
    moves(t) {
      const out: Move[] = [];
      const targets = t.piles.filter((p) => p.kind === "tableau" || p.kind === "foundation");
      for (const from of t.piles) {
        if (from.kind === "stock") continue;
        const counts = from.kind === "tableau" ? liftable(from, alternating) : from.cards.length ? [1] : [];
        for (const count of counts) for (const to of targets) {
          const m = { from: from.id, to: to.id, count };
          if (!legal(t, m)) continue;
          // Skip moves that change nothing: a king from an otherwise empty pile to another, a run between equal spots,
          // or a card back down from its foundation.
          if (from.kind === "tableau" && to.kind === "tableau" && count === from.cards.length && !to.cards.length) continue;
          // A run already resting on a face-up card it fits gains nothing by moving to an equal spot.
          if (from.kind === "tableau" && to.kind === "tableau" && from.cards.length - count > from.down) {
            const under = from.cards[from.cards.length - count - 1]!;
            const head = from.cards[from.cards.length - count]!;
            if (rankOf(under) === rankOf(head) + 1 && isRed(under) !== isRed(head)) continue;
          }
          if (from.kind === "foundation") continue;
          out.push(m);
        }
      }
      return out;
    },
    play(t, m) {
      if (!legal(t, m)) return null;
      const n = clone(t);
      transfer(pile(n, m.from), pile(n, m.to), m.count);
      flipTops(n);
      return autoFinish(n);
    },
    stock(t) {
      const n = clone(t);
      const s = pile(n, "stock");
      const w = pile(n, "waste");
      if (s.cards.length) {
        const k = Math.min(draw, s.cards.length);
        w.cards.push(...s.cards.splice(s.cards.length - k, k).reverse());
        s.down = s.cards.length;
      } else if (w.cards.length) {
        s.cards = w.cards.reverse();
        s.down = s.cards.length;
        w.cards = [];
      } else return null;
      return n;
    },
    won: (t) => foundationsFull(t, 52),
  };
  return rules;
}

/** Once every card is face up and the stock and waste are empty, the game plays itself out to the foundations. */
function autoFinish(t: Table): Table {
  const open = t.piles.every((p) => (p.kind === "tableau" ? p.down === 0 : p.kind === "stock" || p.kind === "waste" ? p.cards.length === 0 : true));
  return open ? sweep(t, () => true) : t;
}

// ---------------------------------------------------------------- Spider

export type SpiderSuits = 1 | 2 | 4;

export function dealSpider(suits: SpiderSuits, rand: () => number): Table {
  // Two decks' worth: 8 sets of A–K, in 1, 2 or 4 suits. A card is copy * 52 + face so every card is unique.
  const suitList = suits === 1 ? [0] : suits === 2 ? [0, 1] : [0, 1, 2, 3];
  const cards: number[] = [];
  for (let set = 0; set < 8; set++) {
    const suit = suitList[set % suitList.length]!;
    const copy = Math.floor(set / suitList.length);
    for (let r = 0; r < 13; r++) cards.push(copy * 52 + suit * 13 + r);
  }
  const deck = shuffle(cards, rand);
  const piles: Pile[] = [P("stock", "stock")];
  for (let i = 0; i < 10; i++) {
    const n = i < 4 ? 6 : 5;
    piles.push(P(`t${i}`, "tableau", deck.splice(0, n), n - 1));
  }
  piles[0]!.cards = deck;
  piles[0]!.down = deck.length;
  return { piles, done: 0 };
}

/** Removes every finished K→A same-suit run from the bottom of the face-up cards, then turns the new tops. */
function clearRuns(t: Table): void {
  for (const p of t.piles) {
    if (p.kind !== "tableau" || p.cards.length - p.down < 13) continue;
    const run = p.cards.slice(-13);
    if (rankOf(run[0]!) === 13 && sameSuitRun(run)) {
      p.cards.splice(-13, 13);
      p.down = Math.min(p.down, p.cards.length);
      t.done++;
    }
  }
  flipTops(t);
}

export const spider: Rules = {
  moves(t) {
    const out: Move[] = [];
    const tabs = t.piles.filter((p) => p.kind === "tableau");
    for (const from of tabs) {
      for (const count of liftable(from, sameSuitRun)) {
        const head = from.cards[from.cards.length - count]!;
        const under = from.cards.length - count > from.down ? from.cards[from.cards.length - count - 1] : undefined;
        for (const to of tabs) {
          if (to === from) continue;
          const dest = top(to);
          if (dest === undefined ? count === from.cards.length : rankOf(dest) !== rankOf(head) + 1) continue;
          // Leaving a run that already sits on its same-suit next card only shuffles it around, unless it lands on
          // a same-suit card too.
          if (under !== undefined && rankOf(under) === rankOf(head) + 1 && suitOf(under) === suitOf(head) && (dest === undefined || suitOf(dest) !== suitOf(head))) continue;
          if (under !== undefined && rankOf(under) === rankOf(head) + 1 && dest !== undefined && suitOf(under) === suitOf(dest)) continue;
          out.push({ from: from.id, to: to.id, count });
        }
      }
    }
    return out;
  },
  play(t, m) {
    const from = t.piles.find((p) => p.id === m.from);
    const to = t.piles.find((p) => p.id === m.to);
    if (!from || !to || from === to || from.kind !== "tableau" || to.kind !== "tableau") return null;
    const run = m.count >= 1 ? runFrom(from, from.cards.length - m.count) : null;
    if (!run || !sameSuitRun(run)) return null;
    const dest = top(to);
    if (dest !== undefined && rankOf(dest) !== rankOf(run[0]!) + 1) return null;
    const n = clone(t);
    transfer(pile(n, m.from), pile(n, m.to), m.count);
    clearRuns(n);
    return n;
  },
  stock(t) {
    const s = pile(t, "stock");
    // The classic rule: no deal while any pile is empty.
    if (!s.cards.length || t.piles.some((p) => p.kind === "tableau" && !p.cards.length)) return null;
    const n = clone(t);
    const ns = pile(n, "stock");
    for (const p of n.piles) if (p.kind === "tableau") p.cards.push(ns.cards.pop()!);
    ns.down = ns.cards.length;
    clearRuns(n);
    return n;
  },
  won: (t) => t.done === 8,
};

/** Why a spider deal is refused, if it is. */
export function spiderStockBlocked(t: Table): "empty" | "pile" | null {
  if (!pile(t, "stock").cards.length) return "empty";
  return t.piles.some((p) => p.kind === "tableau" && !p.cards.length) ? "pile" : null;
}

// ---------------------------------------------------------------- FreeCell

export const FREECELL_MAX_DEAL = 1_000_000;

/** The traditional FreeCell deal for game `n` (1–1,000,000): an LCG picks cards from a sorted deck, dealt row by row. */
export function dealFreeCell(n: number): Table {
  let seed = n >>> 0;
  // The sorted deck in this formula is A♣ A♦ A♥ A♠ 2♣ …; map its suit order (clubs, diamonds, hearts, spades) to ours.
  const SUIT = [3, 2, 1, 0];
  const deck = Array.from({ length: 52 }, (_, i) => SUIT[i % 4]! * 13 + Math.floor(i / 4));
  const cols: number[][] = Array.from({ length: 8 }, () => []);
  for (let i = 0; i < 52; i++) {
    seed = (seed * 214013 + 2531011) % 0x80000000;
    const j = (seed >>> 16) % deck.length;
    const card = deck[j]!;
    deck[j] = deck[deck.length - 1]!;
    deck.pop();
    cols[i % 8]!.push(card);
  }
  return {
    done: 0,
    piles: [...ids("c", 4).map((id) => P(id, "cell")), ...ids("f", 4).map((id) => P(id, "foundation")), ...cols.map((c, i) => P(`t${i}`, "tableau", c, 0))],
  };
}

/** How many cards may move as one run: (free cells + 1) × 2^(empty columns), not counting the destination. */
export function freeCellCapacity(t: Table, toEmpty: boolean): number {
  const cells = t.piles.filter((p) => p.kind === "cell" && !p.cards.length).length;
  const empty = t.piles.filter((p) => p.kind === "tableau" && !p.cards.length).length - (toEmpty ? 1 : 0);
  return (cells + 1) * 2 ** Math.max(0, empty);
}

export const freecell: Rules = {
  moves(t) {
    const out: Move[] = [];
    for (const from of t.piles) {
      if (from.kind === "foundation" || !from.cards.length) continue;
      const counts = from.kind === "tableau" ? liftable(from, alternating) : [1];
      for (const count of counts) for (const to of t.piles) {
        const m = { from: from.id, to: to.id, count };
        if (!freeLegal(t, m)) continue;
        // Skip moves that only shuffle: a whole column to an empty one, a card from one free cell to another,
        // or a run off its matching card.
        if (from.kind === "tableau" && to.kind === "tableau" && !to.cards.length && count === from.cards.length) continue;
        if (from.kind === "cell" && to.kind === "cell") continue;
        if (from.kind === "tableau" && to.kind === "tableau" && from.cards.length > count) {
          const under = from.cards[from.cards.length - count - 1]!;
          const head = from.cards[from.cards.length - count]!;
          if (rankOf(under) === rankOf(head) + 1 && isRed(under) !== isRed(head)) continue;
        }
        out.push(m);
      }
    }
    // One empty cell is as good as another: keep only the first.
    const seen = new Set<string>();
    return out.filter((m) => {
      if (pile(t, m.to).kind !== "cell" && !(pile(t, m.to).kind === "tableau" && !pile(t, m.to).cards.length)) return true;
      const key = `${m.from}>${pile(t, m.to).kind}:${m.count}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  },
  play(t, m) {
    if (!freeLegal(t, m)) return null;
    const n = clone(t);
    transfer(pile(n, m.from), pile(n, m.to), m.count);
    return sweep(n, safeHome);
  },
  stock: () => null,
  won: (t) => foundationsFull(t, 52),
};

function freeLegal(t: Table, m: Move): boolean {
  const from = t.piles.find((p) => p.id === m.from);
  const to = t.piles.find((p) => p.id === m.to);
  if (!from || !to || from === to || m.count < 1 || m.count > from.cards.length || from.kind === "foundation") return false;
  const run = from.cards.slice(-m.count);
  if (from.kind === "cell" && m.count !== 1) return false;
  if (to.kind === "foundation") return m.count === 1 && fitsFoundation(to, run[0]!);
  if (to.kind === "cell") return m.count === 1 && !to.cards.length;
  if (to.kind !== "tableau" || !alternating(run)) return false;
  const dest = top(to);
  if (dest !== undefined && !(rankOf(dest) === rankOf(run[0]!) + 1 && isRed(dest) !== isRed(run[0]!))) return false;
  return m.count <= freeCellCapacity(t, dest === undefined);
}

/** After a deal, FreeCell sends any safe aces and twos home at once, as other programs do. */
export function settleFreeCell(t: Table): Table {
  return sweep(clone(t), safeHome);
}

export { safeHome as _safeHome };
