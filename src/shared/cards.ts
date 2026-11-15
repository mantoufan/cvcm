/**
 * Playing cards and a card table shared by solitaire (Klondike), spider solitaire and FreeCell.
 *
 * A card is a number. `c % 52` is its face: suit = floor(face / 13) (0 spades, 1 hearts, 2 diamonds, 3 clubs),
 * rank = face % 13 + 1 (1 ace … 13 king). Two-deck games number the second deck 52–103 so every card stays unique.
 * A table is a list of piles; each pile lists its cards bottom to top, the first `down` of them face down.
 */

export type PileKind = "stock" | "waste" | "foundation" | "tableau" | "cell";
export type Pile = { id: string; kind: PileKind; cards: number[]; down: number };
export type Table = { piles: Pile[]; /** Completed runs (spider). */ done: number };

export const SUITS = ["s", "h", "d", "c"] as const;
export type Suit = (typeof SUITS)[number];

export const faceOf = (c: number) => c % 52;
export const suitOf = (c: number) => Math.floor(faceOf(c) / 13);
export const rankOf = (c: number) => (faceOf(c) % 13) + 1;
export const isRed = (c: number) => suitOf(c) === 1 || suitOf(c) === 2;

export function shuffle<T>(list: readonly T[], rand: () => number): T[] {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export function pile(t: Table, id: string): Pile {
  const p = t.piles.find((x) => x.id === id);
  if (!p) throw new Error(`no pile ${id}`);
  return p;
}

export const top = (p: Pile): number | undefined => p.cards[p.cards.length - 1];

export function clone(t: Table): Table {
  return { done: t.done, piles: t.piles.map((p) => ({ ...p, cards: p.cards.slice() })) };
}

/** Turns the top card of every tableau pile face up. */
export function flipTops(t: Table): void {
  for (const p of t.piles) if (p.kind === "tableau" && p.cards.length && p.down >= p.cards.length) p.down = p.cards.length - 1;
}

/** Cards from `index` to the top, if they are all face up. */
export function runFrom(p: Pile, index: number): number[] | null {
  if (index < p.down || index >= p.cards.length) return null;
  return p.cards.slice(index);
}

/** Descending by one with alternating colours (Klondike and FreeCell tableau runs). */
export function alternating(run: readonly number[]): boolean {
  for (let i = 1; i < run.length; i++) if (rankOf(run[i]!) !== rankOf(run[i - 1]!) - 1 || isRed(run[i]!) === isRed(run[i - 1]!)) return false;
  return true;
}

/** Descending by one in a single suit (spider runs). */
export function sameSuitRun(run: readonly number[]): boolean {
  for (let i = 1; i < run.length; i++) if (rankOf(run[i]!) !== rankOf(run[i - 1]!) - 1 || suitOf(run[i]!) !== suitOf(run[i - 1]!)) return false;
  return true;
}

/** Foundation build: ace on empty, then the same suit one higher. */
export function fitsFoundation(f: Pile, card: number): boolean {
  const t = top(f);
  return t === undefined ? rankOf(card) === 1 : suitOf(t) === suitOf(card) && rankOf(card) === rankOf(t) + 1;
}

/** Moves `count` cards from the top of `from` to `to` (no rule checks). */
export function transfer(from: Pile, to: Pile, count: number): void {
  to.cards.push(...from.cards.splice(from.cards.length - count, count));
  from.down = Math.min(from.down, from.cards.length);
}

/** The cards of a table as a sorted list, to check a saved game holds exactly one full set. */
export function cardSet(t: Table): number[] {
  return t.piles.flatMap((p) => p.cards).sort((a, b) => a - b);
}

/** A move a game allows: `count` cards from the top of pile `from` to pile `to`. */
export type Move = { from: string; to: string; count: number };

export interface Rules {
  /** Every move allowed now (used for hints, auto-moves and "no moves left"). */
  moves(t: Table): Move[];
  /** Plays a move if it is allowed; returns the new table or null. */
  play(t: Table, m: Move): Table | null;
  /** Tapping the stock (deal, draw or recycle); null when it does nothing. */
  stock(t: Table): Table | null;
  won(t: Table): boolean;
}

/** The move a double-click or tap-again makes: to a foundation first, then a non-empty pile, then an empty one. */
export function bestMove(rules: Rules, t: Table, from: string, count: number): Move | null {
  const options = rules.moves(t).filter((m) => m.from === from && m.count === count);
  const kindOf = (id: string) => pile(t, id).kind;
  const score = (m: Move) => {
    const to = pile(t, m.to);
    if (kindOf(m.to) === "foundation") return 0;
    if (to.kind === "tableau" && to.cards.length) return 1;
    if (to.kind === "tableau") return 2;
    return 3; // free cell
  };
  options.sort((a, b) => score(a) - score(b));
  return options[0] ?? null;
}
