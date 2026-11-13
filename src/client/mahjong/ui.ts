import { h } from "../dom";
import { t } from "../i18n";
import { seeded } from "../../shared/random";
import { shortClock } from "../../shared/subtitles";
import { LAYOUT_IDS, type LayoutId } from "../../shared/mahjong-layouts";
import {
  TILE_H, TILE_W, LEVEL_SHIFT, canMatch, deal, drawOrder, fromSavedBoard, isFree, matchingPairs, remaining, removePair,
  reshuffle, restorePair, tilePos, toSaved, type Board,
} from "../../shared/mahjong";
import { creditLine, cryptoRand, readStore, typingTarget, writeStore } from "../game-input";

const STORE_KEY = "cvcm.mahjong.v1";
const SVG_NS = "http://www.w3.org/2000/svg";
/** The deal a first visit (and the prerendered page) starts on. */
const START = { layout: "turtle" as LayoutId, seed: 1 };
const SPRITE = "/assets/games/mahjong/tiles.svg";
const DEPTH = 6;

type Saved = { layout: string; faces: string[]; removed: number[]; elapsed?: number; locked?: number };

let mounted: { cleanup: () => void } | null = null;

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

/** "Circles 3", "East wind", … for screen readers. */
export function faceName(face: string): string {
  const m = /^t_(do|ch|ba)(\d)$/.exec(face);
  if (m) return t(`mahjong.s_${m[1]}`, { n: m[2]! });
  return t(`mahjong.${face.slice(2)}`);
}

export function mountMahjong(host: HTMLElement): void {
  unmountMahjong();
  const saved = readStore<Saved>(STORE_KEY);
  const restored = fromSavedBoard(saved);
  let board: Board = restored?.board ?? deal(START.layout, seeded(START.seed));
  let removed: number[] = restored?.removed ?? [];
  let elapsed = restored ? Math.max(0, Number(saved?.elapsed) || 0) : 0;
  let selected = -1;
  let hint: [number, number] | null = null;
  let timer = 0;
  let confirmNew = false;
  /** Tiles removed before the last shuffle: Undo stops there, since their partners' faces have moved. */
  let removedLocked = restored ? Math.min(removed.length, Math.max(0, Math.floor(Number(saved?.locked) || 0) & ~1)) : 0;

  const layoutSel = h("select", { "data-field": "layout", onChange: () => {
    // A layout change deals at once only when there is nothing to lose; otherwise New game (with its confirm) does it.
    if (!removed.length || won()) newGame();
    else paint();
  } },
    ...LAYOUT_IDS.map((id) => h("option", { value: id, selected: id === board.layout }, t(`mahjong.l_${id}`))));
  const leftEl = h("dd", { "data-out": "left" });
  const pairsEl = h("dd", { "data-out": "pairs" });
  const timeEl = h("dd", { "data-out": "time", "data-volatile": "" });
  const statusEl = h("p", { class: "mj-status", "aria-live": "polite", "data-out": "status" });
  const shuffleBtn = h("button", { type: "button", class: "btn ghost", "data-action": "shuffle", onClick: () => shuffle() }, t("mahjong.shuffle"));
  const undoBtn = h("button", { type: "button", class: "btn ghost", "data-action": "undo", onClick: () => undo() }, t("mahjong.undo"));
  const hintBtn = h("button", { type: "button", class: "btn ghost", "data-action": "hint", onClick: () => showHint() }, t("mahjong.hint"));
  const newBtn = h("button", { type: "button", class: "btn", "data-action": "new", onClick: () => askNew() }, t("mahjong.newGame"));
  const art = svg("svg", { class: "mj-board", role: "group", "aria-label": t("mahjong.board") });
  const tileEls: SVGGElement[] = [];

  const won = () => remaining(board) === 0;
  const save = () => writeStore(STORE_KEY, won() ? null : { ...toSaved(board, removed), elapsed, locked: removedLocked });

  const tick = () => {
    if (document.hidden || won() || !removed.length) return;
    elapsed++;
    timeEl.textContent = shortClock(elapsed);
    if (elapsed % 10 === 0) save();
  };

  const build = () => {
    art.replaceChildren();
    tileEls.length = 0;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const i of drawOrder(board)) {
      const s = board.stones[i]!;
      const p = tilePos(s.z, s.x, s.y);
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x + TILE_W + DEPTH);
      maxY = Math.max(maxY, p.y + TILE_H + DEPTH);
      const g = svg("g", { class: "mj-tile", transform: `translate(${p.x} ${p.y})`, "data-tile": i });
      g.append(
        svg("rect", { class: "mj-side", x: DEPTH, y: DEPTH, width: TILE_W, height: TILE_H, rx: 8 }),
        svg("rect", { class: "mj-face", x: 0, y: 0, width: TILE_W, height: TILE_H, rx: 8 }),
      );
      const use = svg("use", { href: `${SPRITE}#${s.face}`, x: 4, y: 4, width: TILE_W - 8, height: TILE_H - 8 });
      g.append(use);
      g.addEventListener("click", () => tap(i));
      g.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          tap(i);
        }
      });
      tileEls[i] = g;
      art.append(g);
    }
    const pad = LEVEL_SHIFT;
    art.setAttribute("viewBox", `${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`);
  };

  const paint = () => {
    const pairs = matchingPairs(board);
    board.stones.forEach((s, i) => {
      const g = tileEls[i];
      if (!g) return;
      const free = isFree(board, i);
      g.classList.toggle("gone", s.gone);
      g.classList.toggle("free", free);
      g.classList.toggle("on", i === selected);
      g.classList.toggle("hinted", !!hint && hint.includes(i));
      if (s.gone) {
        g.removeAttribute("tabindex");
        g.removeAttribute("role");
        g.setAttribute("aria-hidden", "true");
      } else {
        g.removeAttribute("aria-hidden");
        g.setAttribute("role", "button");
        g.setAttribute("aria-label", t(free ? "mahjong.tileFree" : "mahjong.tileBlocked", { name: faceName(s.face) }));
        if (free) g.setAttribute("tabindex", "0");
        else g.removeAttribute("tabindex");
        g.setAttribute("aria-pressed", String(i === selected));
      }
    });
    const left = remaining(board);
    leftEl.textContent = String(left);
    pairsEl.textContent = String(pairs.length);
    timeEl.textContent = shortClock(elapsed);
    undoBtn.disabled = removed.length - removedLocked < 2;
    hintBtn.disabled = !pairs.length;
    newBtn.textContent = confirmNew ? t("mahjong.confirmNew") : t("mahjong.newGame");
    if (!left) statusEl.textContent = t("mahjong.won", { time: shortClock(elapsed) });
    else if (!pairs.length) statusEl.textContent = t("mahjong.stuck");
    else if (layoutSel.value !== board.layout) statusEl.textContent = t("mahjong.layoutNext");
    else statusEl.textContent = "";
    shuffleBtn.classList.toggle("ghost", !!pairs.length || !left);
  };

  const tap = (i: number) => {
    if (board.stones[i]!.gone || won()) return;
    confirmNew = false;
    if (!isFree(board, i)) {
      statusEl.textContent = t("mahjong.blocked");
      return;
    }
    if (selected === i) selected = -1;
    else if (selected >= 0 && canMatch(board, selected, i)) {
      board = removePair(board, selected, i);
      removed.push(selected, i);
      selected = -1;
      hint = null;
      save();
    } else selected = i;
    paint();
    if (won()) save();
  };

  const showHint = () => {
    const pairs = matchingPairs(board);
    if (!pairs.length) return;
    // Each press shows the next pair, so a player can look through them.
    const at = hint ? pairs.findIndex((p) => p[0] === hint![0] && p[1] === hint![1]) : -1;
    hint = pairs[(at + 1) % pairs.length]!;
    selected = -1;
    paint();
  };

  const undo = () => {
    if (removed.length - removedLocked < 2) return;
    const b = removed.pop()!;
    const a = removed.pop()!;
    board = restorePair(board, a, b);
    selected = -1;
    hint = null;
    confirmNew = false;
    save();
    paint();
  };

  const shuffle = () => {
    if (won()) return;
    const next = reshuffle(board, cryptoRand);
    if (!next) {
      statusEl.textContent = t("mahjong.cannotShuffle");
      return;
    }
    // The undo list is about the old faces; after a shuffle it starts again (the removed tiles stay removed).
    board = next;
    removedLocked = removed.length;
    selected = -1;
    hint = null;
    build();
    save();
    paint();
  };

  const askNew = () => {
    const started = removed.length > 0 && !won();
    if (started && !confirmNew) {
      confirmNew = true;
      paint();
      return;
    }
    newGame();
  };

  const newGame = () => {
    board = deal(layoutSel.value as LayoutId, cryptoRand);
    removed = [];
    removedLocked = 0;
    elapsed = 0;
    selected = -1;
    hint = null;
    confirmNew = false;
    build();
    save();
    paint();
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key.toLowerCase() === "z" && !e.shiftKey && !typingTarget(e.target)) {
        e.preventDefault();
        undo();
      }
    }
  };
  document.addEventListener("keydown", onKey);

  host.append(
    h("header", { class: "tool-head" },
      h("h1", null, t("mahjong.title")),
      h("p", { class: "lede" }, t("mahjong.privacyNote")),
    ),
    h("div", { class: "mj-tool" },
      h("div", { class: "mj-main" },
        h("dl", { class: "stats-grid mj-stats" },
          h("dt", null, t("mahjong.left")), leftEl,
          h("dt", null, t("mahjong.pairs")), pairsEl,
          h("dt", null, t("mahjong.time")), timeEl,
        ),
        h("div", { class: "mj-wrap", "data-out": "board" }, art),
        statusEl,
      ),
      h("aside", { class: "rail controls" },
        h("label", { class: "field" }, h("span", null, t("mahjong.layout")), layoutSel),
        h("div", { class: "stage-actions" }, newBtn, hintBtn, undoBtn, shuffleBtn),
        h("p", { class: "hint" }, t("mahjong.help")),
        creditLine("mahjong.credit", "https://github.com/ffalt/mah", "Mah"),
      ),
    ),
  );
  build();
  paint();
  timer = window.setInterval(tick, 1000);
  mounted = {
    cleanup: () => {
      window.clearInterval(timer);
      document.removeEventListener("keydown", onKey);
    },
  };
}

export function unmountMahjong(): void {
  mounted?.cleanup();
  mounted = null;
}
