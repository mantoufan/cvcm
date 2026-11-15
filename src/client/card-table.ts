import { h } from "./dom";
import { t } from "./i18n";
import { cryptoRand, readStore, typingTarget, writeStore } from "./game-input";
import { shortClock } from "../shared/subtitles";
import { bestMove, cardSet, isRed, pile, rankOf, suitOf, type Move, type Pile, type Rules, type Table } from "../shared/cards";

/**
 * The card table shared by solitaire, spider solitaire and FreeCell: piles drawn from a `Table`, tap to pick up and tap
 * a pile to drop, drag and drop, double-click or tap again to send a card to its best place, undo, hint, timer, and a
 * game kept in localStorage. Each game supplies its rules, deal and layout.
 */

export type CardGameConfig<O extends string | number> = {
  /** Locale namespace of the game's own strings (title, privacyNote, option labels). */
  ns: string;
  storeKey: string;
  /** Top row: pile ids, null for a gap. */
  top: ReadonlyArray<string | null>;
  tableau: readonly string[];
  /** Deal numbers run from 1 to this. */
  maxDeal: number;
  /** First visit and prerender: this deal and option, so the page is the same before and after mount. */
  start: { deal: number; option: O };
  option: { field: string; values: readonly O[]; label: (v: O) => string };
  deal(deal: number, option: O): Table;
  rules(option: O): Rules;
  /** Whether `count` cards from the top of a pile may be picked up at all (the rules still decide where they go). */
  lift(table: Table, pileId: string, count: number): boolean;
  /** Extra status figures: [label, value] pairs. */
  stats?(table: Table): Array<[string, string]>;
  /** Why tapping the stock did nothing, as a locale key, or null. */
  stockRefused?(table: Table): string | null;
  /** Why a move that looked possible was refused, as a message, or null for the generic one. */
  refused?(table: Table, move: Move): string | null;
};

type Saved = { deal: number; option: string | number; table: Table; moves: number; elapsed: number };
const SUIT_CHARS = ["♠", "♥", "♦", "♣"];
const RANK_TEXT = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

export function cardName(c: number): string {
  const r = rankOf(c);
  const rank = r === 1 || r > 10 ? t(`cards.r${r}`) : String(r);
  return t("cards.card", { rank, suit: t(`cards.s${suitOf(c)}`) });
}

/** A saved table must hold the same piles and exactly the cards of its deal, with sensible face-down counts. */
function validSaved<O extends string | number>(cfg: CardGameConfig<O>, raw: Saved | null): Saved | null {
  if (!raw || !Number.isInteger(raw.deal) || raw.deal < 1 || raw.deal > cfg.maxDeal || !cfg.option.values.includes(raw.option as O)) return null;
  const tb = raw.table;
  if (!tb || !Array.isArray(tb.piles) || !Number.isInteger(tb.done)) return null;
  const fresh = cfg.deal(raw.deal, raw.option as O);
  if (tb.piles.length !== fresh.piles.length) return null;
  for (let i = 0; i < tb.piles.length; i++) {
    const p = tb.piles[i]!;
    const f = fresh.piles[i]!;
    if (!p || p.id !== f.id || p.kind !== f.kind || !Array.isArray(p.cards) || !Number.isInteger(p.down) || p.down < 0 || p.down > p.cards.length) return null;
    if (!p.cards.every((c) => Number.isInteger(c))) return null;
  }
  // Spider clears finished runs off the table: 13 cards per completed run are missing from the set.
  const have = cardSet(tb);
  const all = cardSet(fresh);
  if (have.length + tb.done * 13 !== all.length) return null;
  const pool = new Map<number, number>();
  for (const c of all) pool.set(c, (pool.get(c) ?? 0) + 1);
  for (const c of have) {
    const n = pool.get(c);
    if (!n) return null;
    pool.set(c, n - 1);
  }
  return { ...raw, moves: Math.max(0, Number(raw.moves) || 0), elapsed: Math.max(0, Number(raw.elapsed) || 0) };
}

export function mountCardGame<O extends string | number>(host: HTMLElement, cfg: CardGameConfig<O>): () => void {
  const saved = validSaved(cfg, readStore<Saved>(cfg.storeKey));
  let deal = saved?.deal ?? cfg.start.deal;
  let option = (saved?.option as O | undefined) ?? cfg.start.option;
  let rules = cfg.rules(option);
  let table: Table = saved?.table ?? cfg.deal(deal, option);
  let moves = saved?.moves ?? 0;
  let elapsed = saved?.elapsed ?? 0;
  let history: Table[] = [];
  let selected: { pile: string; count: number } | null = null;
  let hint: { cards: number[]; pile: string } | null = null;
  let hintTimer = 0;
  let confirmNew = false;
  let pending = "";
  let message = "";
  let drag: { pile: string; count: number; x: number; y: number; els: HTMLElement[]; moved: boolean; id: number } | null = null;
  let suppressClick = false;

  const won = () => rules.won(table);
  const started = () => moves > 0 && !won();

  // ---- controls
  const optionSel = h("select", { "data-field": cfg.option.field, onChange: () => {
    if (!started()) newGame(deal);
    else { message = t("cards.optionNext"); paint(); }
  } }, ...cfg.option.values.map((v) => h("option", { value: String(v), selected: v === option }, cfg.option.label(v))));
  const dealInput = h("input", { type: "number", min: 1, max: cfg.maxDeal, step: 1, inputmode: "numeric", value: String(deal), "data-field": "deal", class: "cd-deal" }) as HTMLInputElement;
  const newBtn = h("button", { type: "button", class: "btn", "data-action": "new", onClick: () => askNew() });
  const undoBtn = h("button", { type: "button", class: "btn ghost", "data-action": "undo", onClick: () => undo() }, t("cards.undo"));
  const hintBtn = h("button", { type: "button", class: "btn ghost", "data-action": "hint", onClick: () => showHint() }, t("cards.hint"));
  const restartBtn = h("button", { type: "button", class: "btn ghost", "data-action": "restart", onClick: () => guarded("restart", () => newGame(deal)) }, t("cards.restart"));
  const playBtn = h("button", { type: "button", class: "btn ghost", "data-action": "play-deal", onClick: () => {
    const n = Math.floor(Number(dealInput.value));
    if (Number.isInteger(n) && n >= 1 && n <= cfg.maxDeal) guarded("play", () => newGame(n));
    else { message = t("cards.badDeal", { max: cfg.maxDeal.toLocaleString() }); paint(); }
  } }, t("cards.playDeal"));
  const statsEl = h("dl", { class: "stats-grid cd-stats" });
  const statusEl = h("p", { class: "cd-status", "aria-live": "polite", "data-out": "status" });
  const timeEl = h("dd", { "data-volatile": "" });

  // ---- board
  const board = h("div", { class: "cd-table", role: "group", "aria-label": t(`${cfg.ns}.board`), "data-out": "board" });
  board.style.setProperty("--cols", String(Math.max(cfg.top.length, cfg.tableau.length)));
  const pileEls = new Map<string, HTMLElement>();
  const slot = (id: string | null) => {
    if (!id) return h("div", { class: "cd-gap", "aria-hidden": "true" });
    const el = h("div", { class: "cd-pile", "data-pile": id });
    pileEls.set(id, el);
    return el;
  };
  board.append(
    h("div", { class: "cd-row cd-top" }, ...cfg.top.map(slot)),
    h("div", { class: "cd-row cd-tab" }, ...cfg.tableau.map(slot)),
  );

  const save = () => writeStore(cfg.storeKey, won() ? null : { deal, option, table, moves, elapsed });

  const pileLabel = (p: Pile) => {
    if (p.kind === "stock") return p.cards.length ? t("cards.stock", { n: p.cards.length }) : t("cards.stockEmpty");
    if (p.kind === "waste") return t("cards.waste");
    if (p.kind === "foundation") return t("cards.foundation");
    if (p.kind === "cell") return t("cards.cell");
    return t("cards.tableau", { n: Number(p.id.slice(1)) + 1 });
  };

  /** Vertical step of each card in a tableau pile, in card widths, squeezed so long piles fit. */
  const offsets = (p: Pile): number[] => {
    const steps = p.cards.map((_, i): number => (i === 0 ? 0 : i <= p.down ? 0.12 : 0.27));
    const total = steps.reduce((a, b) => a + b, 0);
    const room = cfg.tableau.length > 8 ? 3.4 : 4.2;
    const k = total > room ? room / total : 1;
    let y = 0;
    return steps.map((s) => (y += s * k));
  };

  const cardEl = (c: number, faceUp: boolean, p: Pile, index: number) => {
    const el = h("button", { type: "button", class: `cd-card${faceUp ? (isRed(c) ? " red" : " black") : " down"}`, "data-card": c, "data-index": index, "aria-label": faceUp ? cardName(c) : t("cards.faceDown") });
    if (faceUp) {
      const corner = h("span", { class: "cd-corner", "aria-hidden": "true" }, h("span", null, RANK_TEXT[rankOf(c) - 1]!), h("span", null, SUIT_CHARS[suitOf(c)]!));
      el.append(corner, h("span", { class: "cd-pip", "aria-hidden": "true" }, SUIT_CHARS[suitOf(c)]!));
    }
    if (!faceUp || p.kind === "stock") {
      el.tabIndex = -1;
      el.setAttribute("aria-hidden", "true");
    }
    el.addEventListener("click", (e) => { e.stopPropagation(); if (!suppressClick) tapCard(p.id, index); });
    el.addEventListener("pointerdown", (e) => startDrag(e, p.id, index));
    return el;
  };

  const paint = () => {
    for (const p of table.piles) {
      const el = pileEls.get(p.id);
      if (!el) continue;
      el.dataset.kind = p.kind;
      const base = h("button", { type: "button", class: "cd-base", "aria-label": pileLabel(p), onClick: () => tapPile(p.id) });
      // An empty stock that can be turned over again (Klondike) shows the recycle mark.
      if (p.kind === "stock" && !p.cards.length && rules.stock(table)) base.textContent = "↻";
      el.replaceChildren(base);
      let shown: Array<{ c: number; i: number; y: number; x: number }> = [];
      if (p.kind === "tableau") {
        const ys = offsets(p);
        shown = p.cards.map((c, i) => ({ c, i, y: ys[i]!, x: 0 }));
        el.style.setProperty("--depth", String(ys[ys.length - 1] ?? 0));
      } else if (p.kind === "waste") {
        // Draw three fans the last three cards; draw one shows only the top.
        const n = Math.min(p.cards.length, option === 3 ? 3 : 1);
        shown = p.cards.slice(-n).map((c, k) => ({ c, i: p.cards.length - n + k, y: 0, x: k * 0.22 }));
      } else if (p.cards.length) {
        shown = [{ c: p.cards[p.cards.length - 1]!, i: p.cards.length - 1, y: 0, x: 0 }];
      }
      for (const s of shown) {
        const c = cardEl(s.c, s.i >= p.down, p, s.i);
        c.style.setProperty("--y", String(s.y));
        c.style.setProperty("--x", String(s.x));
        if (selected && selected.pile === p.id && s.i >= p.cards.length - selected.count) c.classList.add("sel");
        if (hint && hint.cards.includes(s.c)) c.classList.add("hint");
        el.append(c);
      }
      el.classList.toggle("hint", !!hint && hint.pile === p.id);
    }
    const left = won();
    statsEl.replaceChildren(
      h("dt", null, t("cards.moves")), h("dd", null, String(moves)),
      h("dt", null, t("cards.time")), timeEl,
      ...(cfg.stats?.(table) ?? []).flatMap(([k, v]) => [h("dt", null, k), h("dd", null, v)]),
      h("dt", null, t("cards.gameNo")), h("dd", null, `#${deal}`),
    );
    timeEl.textContent = shortClock(elapsed);
    newBtn.textContent = confirmNew ? t("cards.confirmNew") : t("cards.newGame");
    undoBtn.disabled = !history.length;
    hintBtn.disabled = left;
    if (left) statusEl.textContent = t("cards.won", { time: shortClock(elapsed), moves });
    else if (message) statusEl.textContent = message;
    else if (!rules.moves(table).length && !rules.stock(table)) statusEl.textContent = t("cards.stuck");
    else statusEl.textContent = "";
  };

  const commit = (next: Table) => {
    history.push(table);
    table = next;
    moves++;
    selected = null;
    clearHint();
    confirmNew = false;
    pending = "";
    message = "";
    save();
    paint();
    if (won()) {
      const best = readStore<Record<string, number>>(`${cfg.storeKey}.best`) ?? {};
      const key = String(option);
      if (!best[key] || elapsed < best[key]!) writeStore(`${cfg.storeKey}.best`, { ...best, [key]: elapsed });
    }
  };

  const tryMove = (m: Move): boolean => {
    const next = rules.play(table, m);
    if (next) {
      commit(next);
      return true;
    }
    message = cfg.refused?.(table, m) ?? t("cards.cannot");
    return false;
  };

  const pickable = (pileId: string, index: number) => {
    const p = pile(table, pileId);
    return p.kind !== "stock" && index >= p.down && index < p.cards.length && cfg.lift(table, pileId, p.cards.length - index);
  };

  const tapCard = (pileId: string, index: number) => {
    const p = pile(table, pileId);
    if (won()) return;
    if (p.kind === "stock") return tapPile(pileId);
    message = "";
    const count = p.cards.length - index;
    if (selected && selected.pile !== pileId) {
      const from = selected;
      selected = null;
      if (tryMove({ from: from.pile, to: pileId, count: from.count })) return;
      // Not a legal drop: pick up the tapped card instead, if it can be.
      if (pickable(pileId, index)) selected = { pile: pileId, count };
      return paint();
    }
    if (selected && selected.pile === pileId && selected.count === count) {
      selected = null;
      return autoMove(pileId, index);
    }
    selected = pickable(pileId, index) ? { pile: pileId, count } : null;
    paint();
  };

  const tapPile = (pileId: string) => {
    const p = pile(table, pileId);
    if (won()) return;
    if (p.kind === "stock") {
      selected = null;
      const next = rules.stock(table);
      if (next) commit(next);
      else {
        const why = cfg.stockRefused?.(table);
        message = why ? t(why) : "";
        paint();
      }
      return;
    }
    if (selected && selected.pile !== pileId) {
      const from = selected;
      selected = null;
      if (!tryMove({ from: from.pile, to: pileId, count: from.count })) paint();
      return;
    }
    selected = null;
    paint();
  };

  const autoMove = (pileId: string, index: number) => {
    const p = pile(table, pileId);
    if (won() || !pickable(pileId, index)) return;
    const count = p.cards.length - index;
    const m = bestMove(rules, table, pileId, count);
    if (m) tryMove(m);
    else message = t("cards.cannot");
    paint();
  };

  const clearHint = () => {
    if (hintTimer) window.clearTimeout(hintTimer);
    hintTimer = 0;
    hint = null;
  };

  const showHint = () => {
    const list = rules.moves(table);
    // Foundation moves first, then moves that turn a card over or empty a pile, then the rest.
    const value = (m: Move) => {
      const from = pile(table, m.from);
      const to = pile(table, m.to);
      if (to.kind === "foundation") return 0;
      if (from.kind === "tableau" && from.cards.length - m.count === from.down && from.down > 0) return 1;
      if (to.kind === "cell") return 4;
      return 2;
    };
    const m = list.sort((a, b) => value(a) - value(b))[0];
    clearHint();
    if (m) {
      const from = pile(table, m.from);
      hint = { cards: from.cards.slice(-m.count), pile: m.to };
      message = "";
    } else if (rules.stock(table)) {
      hint = { cards: [], pile: "stock" };
      message = t("cards.hintStock");
    } else message = t("cards.noHint");
    paint();
    hintTimer = window.setTimeout(() => { hint = null; hintTimer = 0; paint(); }, 2500);
  };

  const undo = () => {
    const prev = history.pop();
    if (!prev) return;
    table = prev;
    moves++;
    selected = null;
    clearHint();
    message = "";
    save();
    paint();
  };

  /** Leaving a game in progress (Restart, Play deal) takes a second tap on the same button, like New game. */
  const guarded = (action: string, run: () => void) => {
    if (started() && pending !== action) {
      pending = action;
      message = t("cards.confirmNew");
      return paint();
    }
    pending = "";
    run();
  };

  const askNew = () => {
    pending = "";
    if (started() && !confirmNew) {
      confirmNew = true;
      return paint();
    }
    // A fresh random deal number; the number is shown so a deal can be replayed or shared.
    newGame(1 + Math.floor(cryptoRand() * cfg.maxDeal));
  };

  const newGame = (n: number) => {
    deal = n;
    option = (cfg.option.values[optionSel.selectedIndex] ?? option) as O;
    rules = cfg.rules(option);
    table = cfg.deal(deal, option);
    dealInput.value = String(deal);
    moves = 0;
    elapsed = 0;
    history = [];
    selected = null;
    clearHint();
    confirmNew = false;
    message = "";
    save();
    paint();
  };

  // ---- drag and drop
  const startDrag = (e: PointerEvent, pileId: string, index: number) => {
    if (e.button !== 0 || !pickable(pileId, index)) return;
    const el = pileEls.get(pileId)!;
    const els = Array.from(el.querySelectorAll<HTMLElement>(".cd-card")).filter((c) => Number(c.dataset.index) >= index);
    drag = { pile: pileId, count: pile(table, pileId).cards.length - index, x: e.clientX, y: e.clientY, els, moved: false, id: e.pointerId };
  };
  const onMove = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 6) return;
    if (!drag.moved) {
      drag.moved = true;
      for (const c of drag.els) c.classList.add("drag");
    }
    e.preventDefault();
    for (const c of drag.els) c.style.translate = `${dx}px ${dy}px`;
  };
  const onUp = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    if (!d.moved) return;
    for (const c of d.els) {
      c.classList.remove("drag");
      c.style.translate = "";
    }
    // The click that follows a drag must not also pick the card up.
    suppressClick = true;
    window.setTimeout(() => { suppressClick = false; }, 0);
    const target = document.elementsFromPoint(e.clientX, e.clientY).map((x) => x.closest<HTMLElement>(".cd-pile")).find((x) => x && x.dataset.pile !== d.pile);
    selected = null;
    if (!target?.dataset.pile || !tryMove({ from: d.pile, to: target.dataset.pile, count: d.count })) paint();
  };
  const onCancel = () => {
    if (!drag) return;
    for (const c of drag.els) {
      c.classList.remove("drag");
      c.style.translate = "";
    }
    drag = null;
  };
  document.addEventListener("pointermove", onMove, { passive: false });
  document.addEventListener("pointerup", onUp);
  document.addEventListener("pointercancel", onCancel);

  const onKey = (e: KeyboardEvent) => {
    if (typingTarget(e.target) || e.altKey) return;
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "z") {
      e.preventDefault();
      undo();
    } else if (e.key === "Escape" && selected) {
      selected = null;
      paint();
    }
  };
  document.addEventListener("keydown", onKey);

  const timer = window.setInterval(() => {
    if (document.hidden || !started()) return;
    elapsed++;
    timeEl.textContent = shortClock(elapsed);
    if (elapsed % 10 === 0) save();
  }, 1000);

  host.append(
    h("header", { class: "tool-head" },
      h("h1", null, t(`${cfg.ns}.title`)),
      h("p", { class: "lede" }, t(`${cfg.ns}.privacyNote`)),
    ),
    h("div", { class: "cd-tool" },
      h("div", { class: "cd-main" }, statsEl, h("div", { class: "cd-wrap" }, board), statusEl),
      h("aside", { class: "rail controls" },
        h("label", { class: "field" }, h("span", null, t(`${cfg.ns}.option`)), optionSel),
        h("div", { class: "stage-actions" }, newBtn, undoBtn, hintBtn, restartBtn),
        h("div", { class: "cd-deal-row" }, h("label", { class: "field" }, h("span", null, t("cards.dealLabel")), dealInput), playBtn),
        h("p", { class: "hint" }, t(`${cfg.ns}.help`)),
      ),
    ),
  );
  paint();

  return () => {
    window.clearInterval(timer);
    clearHint();
    document.removeEventListener("pointermove", onMove);
    document.removeEventListener("pointerup", onUp);
    document.removeEventListener("pointercancel", onCancel);
    document.removeEventListener("keydown", onKey);
  };
}
