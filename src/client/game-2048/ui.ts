import { h } from "../dom";
import { t } from "../i18n";
import { seeded } from "../../shared/random";
import { DIRECTIONS, SIZE, finished, fromSaved, keepGoing, move, newGame, toCells, type Direction, type Game } from "../../shared/game2048";
import { creditLine, cryptoRand, onScreen, readStore, swipeDirection, typingTarget, writeStore } from "../game-input";

const STORE_KEY = "cvcm.2048.v1";
const BEST_KEY = "cvcm.2048.best";
/** The board a first visit (and the prerendered page) starts on, so the page is the same before and after mount. */
const START_SEED = 2048;
/** Matches the CSS slide (`.g2048-tile` transition), after which consumed tiles are removed. */
const SLIDE_MS = 110;

const KEYS: Record<string, Direction> = {
  ArrowUp: "up", ArrowRight: "right", ArrowDown: "down", ArrowLeft: "left",
  KeyW: "up", KeyD: "right", KeyS: "down", KeyA: "left",
};

let mounted: { cleanup: () => void } | null = null;

export function mount2048(host: HTMLElement): void {
  unmount2048();
  let game: Game = fromSaved(readStore(STORE_KEY)) ?? newGame(seeded(START_SEED));
  let best = Math.max(Number(readStore<number>(BEST_KEY)) || 0, game.score);
  const timers = new Set<number>();
  const tileEls = new Map<number, HTMLElement>();

  const scoreEl = h("dd", { "data-out": "score" });
  const bestEl = h("dd", { "data-out": "best" });
  const statusEl = h("p", { class: "g2048-status", "aria-live": "polite", "data-out": "status" });
  const layer = h("div", { class: "g2048-tiles" });
  const keepBtn = h("button", { type: "button", class: "btn", "data-action": "keep", onClick: () => { game = keepGoing(game); save(); paint(); } }, t("game2048.keepGoing"));
  const overlayText = h("p", { class: "g2048-overlay-text" });
  const overlay = h("div", { class: "g2048-overlay", hidden: true },
    overlayText,
    h("div", { class: "stage-actions" },
      keepBtn,
      h("button", { type: "button", class: "btn ghost", "data-action": "again", onClick: () => restart() }, t("game2048.newGame")),
    ),
  );
  const board = h("div", {
    class: "g2048-board",
    role: "application",
    tabindex: 0,
    "aria-label": t("game2048.board"),
    "aria-describedby": "g2048-help",
    "data-out": "board",
  },
    h("div", { class: "g2048-grid", "aria-hidden": "true" }, ...Array.from({ length: SIZE * SIZE }, () => h("span", null))),
    layer,
    overlay,
  );

  const save = () => {
    writeStore(STORE_KEY, game.over ? null : { cells: toCells(game.tiles), score: game.score, keepPlaying: game.keepPlaying });
    if (game.score > best) {
      best = game.score;
      writeStore(BEST_KEY, best);
    }
  };

  const place = (el: HTMLElement, row: number, col: number) => {
    el.style.setProperty("--r", String(row));
    el.style.setProperty("--c", String(col));
  };

  const tileEl = (id: number, value: number) => {
    let el = tileEls.get(id);
    if (!el) {
      el = h("div", { class: "g2048-tile", "data-tile": id });
      tileEls.set(id, el);
      layer.append(el);
    }
    el.textContent = String(value);
    el.dataset.value = String(value);
    // Above 2048 every tile shares one colour (the original's "super" tile).
    el.classList.toggle("super", value > 2048);
    el.classList.toggle("long", value >= 1024);
    return el;
  };

  const paint = (fresh: number | null = null, merged: readonly number[] = []) => {
    const live = new Set(game.tiles.map((tile) => tile.id));
    for (const [id, el] of tileEls) if (!live.has(id) && !el.dataset.leaving) {
      el.remove();
      tileEls.delete(id);
    }
    for (const tile of game.tiles) {
      const el = tileEl(tile.id, tile.value);
      place(el, tile.row, tile.col);
      el.classList.toggle("new", tile.id === fresh);
      el.classList.toggle("merged", merged.includes(tile.id));
    }
    scoreEl.textContent = String(game.score);
    bestEl.textContent = String(Math.max(best, game.score));
    const stopped = finished(game);
    overlay.hidden = !stopped;
    keepBtn.hidden = !(game.won && !game.keepPlaying && !game.over);
    overlayText.textContent = game.won && !game.keepPlaying ? t("game2048.won") : game.over ? t("game2048.over") : "";
    statusEl.textContent = game.over ? t("game2048.overStatus", { score: game.score }) : game.won && !game.keepPlaying ? t("game2048.wonStatus") : "";
  };

  const go = (dir: Direction): boolean => {
    const result = move(game, dir, cryptoRand);
    if (!result.moved) return false;
    // Tiles that merged slide under their partner first, then disappear.
    for (const c of result.consumed) {
      const el = tileEls.get(c.id);
      if (!el) continue;
      el.dataset.leaving = "1";
      el.classList.remove("new", "merged");
      place(el, c.row, c.col);
      tileEls.delete(c.id);
      const timer = window.setTimeout(() => { timers.delete(timer); el.remove(); }, SLIDE_MS);
      timers.add(timer);
    }
    game = result.game;
    save();
    paint(result.spawned, result.merged);
    return true;
  };

  const restart = () => {
    game = newGame(cryptoRand);
    for (const el of tileEls.values()) el.remove();
    tileEls.clear();
    layer.replaceChildren();
    save();
    paint();
    board.focus();
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || typingTarget(e.target)) return;
    const dir = KEYS[e.code];
    if (!dir) return;
    // Arrow keys move tiles while the board is on screen (as in the original); letters only while it has focus.
    // Keys that move nothing (game over, a wall) still scroll the page.
    if (document.activeElement !== board && (!e.code.startsWith("Arrow") || !onScreen(board))) return;
    if (go(dir)) e.preventDefault();
  };
  document.addEventListener("keydown", onKey);

  let start: { x: number; y: number; id: number } | null = null;
  board.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest("button")) return;
    start = { x: e.clientX, y: e.clientY, id: e.pointerId };
  });
  board.addEventListener("pointerup", (e) => {
    if (!start || start.id !== e.pointerId) return;
    const dir = swipeDirection(e.clientX - start.x, e.clientY - start.y);
    start = null;
    if (dir) go(dir);
  });
  board.addEventListener("pointercancel", () => { start = null; });

  const pad = h("div", { class: "g2048-pad", "aria-label": t("game2048.pad"), role: "group" },
    ...DIRECTIONS.map((dir) => h("button", { type: "button", class: `btn ghost g2048-${dir}`, "data-dir": dir, "aria-label": t(`game2048.d_${dir}`), onClick: () => { go(dir); } }, { up: "↑", right: "→", down: "↓", left: "←" }[dir])),
  );

  host.append(
    h("header", { class: "tool-head" },
      h("h1", null, t("game2048.title")),
      h("p", { class: "lede" }, t("game2048.privacyNote")),
    ),
    h("div", { class: "g2048-tool" },
      h("div", { class: "g2048-main" },
        h("dl", { class: "stats-grid g2048-score" }, h("dt", null, t("game2048.score")), scoreEl, h("dt", null, t("game2048.best")), bestEl),
        board,
        statusEl,
      ),
      h("aside", { class: "rail controls" },
        h("div", { class: "stage-actions" },
          h("button", { type: "button", class: "btn", "data-action": "new", onClick: () => restart() }, t("game2048.newGame")),
        ),
        pad,
        h("p", { class: "hint", id: "g2048-help" }, t("game2048.hint")),
        creditLine("game2048.credit", "https://github.com/gabrielecirulli/2048", "2048"),
      ),
    ),
  );
  paint();
  mounted = {
    cleanup: () => {
      document.removeEventListener("keydown", onKey);
      for (const timer of timers) window.clearTimeout(timer);
      timers.clear();
    },
  };
}

export function unmount2048(): void {
  mounted?.cleanup();
  mounted = null;
}
