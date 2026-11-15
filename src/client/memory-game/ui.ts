import { h } from "../dom";
import { t } from "../i18n";
import { seeded } from "../../shared/random";
import { shortClock } from "../../shared/subtitles";
import { LAYOUTS, LAYOUT_IDS, deal, faceShape, faceSolid, flip, fromSaved, missShowing, settleMiss, won, type Game, type LayoutId } from "../../shared/memory-game";
import { cryptoRand, readStore, writeStore } from "../game-input";

const STORE_KEY = "cvcm.memory.v1";
const BEST_KEY = "cvcm.memory.best";
/** How long a missed pair stays up before it turns back (a tap on another card turns it at once). */
const MISS_MS = 800;
const SVG_NS = "http://www.w3.org/2000/svg";

/** Two colours far apart in lightness and hue (dark navy and orange), so pairs also read without colour vision. */
const COLORS = ["#23338f", "#d9620c"];

let mounted: { cleanup: () => void } | null = null;

/** The shape drawn on a face, in a 0–100 box. Solid faces are filled, the others outlined. */
function faceSvg(face: number): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.setAttribute("aria-hidden", "true");
  const solid = faceSolid(face);
  const color = COLORS[Math.floor(face / 9) % 2]!;
  const el = (tag: string, attrs: Record<string, string | number>) => {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
    node.setAttribute("fill", solid ? color : "none");
    node.setAttribute("stroke", color);
    node.setAttribute("stroke-width", solid ? "2" : "9");
    node.setAttribute("stroke-linejoin", "round");
    svg.append(node);
  };
  const poly = (n: number, r: number, rot: number, inner = 0) => {
    const pts: string[] = [];
    const k = inner ? n * 2 : n;
    for (let i = 0; i < k; i++) {
      const rr = inner && i % 2 ? inner : r;
      const a = rot + (i * 2 * Math.PI) / k;
      pts.push(`${(50 + rr * Math.cos(a)).toFixed(1)},${(50 + rr * Math.sin(a)).toFixed(1)}`);
    }
    el("polygon", { points: pts.join(" ") });
  };
  switch (faceShape(face)) {
    case "circle": el("circle", { cx: 50, cy: 50, r: 32 }); break;
    case "square": el("rect", { x: 20, y: 20, width: 60, height: 60, rx: 4 }); break;
    case "triangle": poly(3, 38, -Math.PI / 2); break;
    case "star": poly(5, 40, -Math.PI / 2, 17); break;
    case "diamond": el("polygon", { points: "50,12 82,50 50,88 18,50" }); break;
    case "hexagon": poly(6, 36, 0); break;
    case "heart": el("path", { d: "M50 84 C20 62 12 44 20 30 C28 16 46 18 50 32 C54 18 72 16 80 30 C88 44 80 62 50 84 Z" }); break;
    case "moon": el("path", { d: "M62 16 A34 34 0 1 0 84 66 A28 28 0 1 1 62 16 Z" }); break;
    case "cross": el("polygon", { points: "38,14 62,14 62,38 86,38 86,62 62,62 62,86 38,86 38,62 14,62 14,38 38,38" }); break;
  }
  return svg;
}

export function mountMemoryGame(host: HTMLElement): void {
  unmountMemoryGame();
  // A first visit (and the prerendered page) deals from a fixed seed, so the page is the same before and after mount.
  let game: Game = fromSaved(readStore(STORE_KEY)) ?? deal("4x4", 1, seeded(1));
  let elapsed = 0;
  let timer = 0;
  let missTimer = 0;
  let focus = 0;
  let confirmNew = false;
  const best = (readStore<Record<string, number>>(BEST_KEY) ?? {}) as Record<string, number>;

  const layoutSel = h("select", { "data-field": "layout", onChange: () => maybeNew() },
    ...LAYOUT_IDS.map((id) => h("option", { value: id, selected: id === game.layout }, t(`memoryGame.l_${id}`))));
  const playersSel = h("select", { "data-field": "players", onChange: () => maybeNew() },
    ...[1, 2].map((n) => h("option", { value: String(n), selected: n === game.players }, t(`memoryGame.p${n}`))));
  const movesEl = h("dd", { "data-out": "moves" });
  const timeEl = h("dd", { "data-out": "time", "data-volatile": "" });
  const bestEl = h("dd", { "data-out": "best" });
  const scoreDt1 = h("dt", null);
  const scoreDd1 = h("dd", { "data-out": "score1" });
  const scoreDt2 = h("dt", null);
  const scoreDd2 = h("dd", { "data-out": "score2" });
  const statusEl = h("p", { class: "mem-status", "aria-live": "polite", "data-out": "status" });
  const newBtn = h("button", { type: "button", class: "btn", "data-action": "new", onClick: () => askNew() });
  const grid = h("div", { class: "mem-grid", role: "grid", "aria-label": t("memoryGame.board"), "data-out": "board" });
  let cardEls: HTMLButtonElement[] = [];

  const started = () => (game.moves > 0 || game.open.length > 0) && !won(game);
  // A miss still showing is saved as settled, so a reload passes the turn just as the timer would.
  const save = () => writeStore(STORE_KEY, won(game) ? null : { ...settleMiss(game), open: [] });

  const build = () => {
    const { rows, cols } = LAYOUTS[game.layout];
    grid.style.setProperty("--cols", String(cols));
    grid.replaceChildren();
    cardEls = [];
    for (let r = 0; r < rows; r++) {
      const row = h("div", { class: "mem-row", role: "row" });
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        const card = h("button", { type: "button", class: "mem-card", role: "gridcell", "data-card": i, tabindex: -1, onClick: () => turn(i) });
        card.addEventListener("keydown", (e) => onKey(e, i));
        cardEls.push(card);
        row.append(card);
      }
      grid.append(row);
    }
  };

  const faceName = (face: number) =>
    t("memoryGame.face", { shape: t(`memoryGame.sh_${faceShape(face)}`), style: t(faceSolid(face) ? "memoryGame.solid" : "memoryGame.outline") });

  const paint = () => {
    const { cols } = LAYOUTS[game.layout];
    cardEls.forEach((el, i) => {
      const up = game.matched[i] || game.open.includes(i);
      const wasUp = el.classList.contains("up");
      el.classList.toggle("up", up);
      el.classList.toggle("done", !!game.matched[i]);
      // The face is drawn only while the card is up, so it cannot be read from a face-down card.
      if (up && !wasUp) {
        el.replaceChildren(faceSvg(game.faces[i]!));
        el.classList.remove("flip");
        void el.offsetWidth;
        el.classList.add("flip");
      } else if (!up && wasUp) el.replaceChildren();
      el.tabIndex = i === focus ? 0 : -1;
      el.setAttribute("aria-label", t("memoryGame.card", { row: Math.floor(i / cols) + 1, col: (i % cols) + 1, state: up ? faceName(game.faces[i]!) : t("memoryGame.down") }));
      el.setAttribute("aria-disabled", String(!!game.matched[i]));
    });
    movesEl.textContent = String(game.moves);
    timeEl.textContent = shortClock(elapsed);
    const key = `${game.layout}`;
    bestEl.textContent = best[key] ? t("memoryGame.bestValue", { moves: best[key]! }) : "–";
    const two = game.players === 2;
    for (const el of [scoreDt1, scoreDd1, scoreDt2, scoreDd2]) el.hidden = !two;
    scoreDt1.textContent = t("memoryGame.player", { n: 1 });
    scoreDt2.textContent = t("memoryGame.player", { n: 2 });
    scoreDd1.textContent = String(game.scores[0]);
    scoreDd2.textContent = String(game.scores[1]);
    scoreDt1.classList.toggle("turn", two && game.turn === 0 && !won(game));
    scoreDt2.classList.toggle("turn", two && game.turn === 1 && !won(game));
    newBtn.textContent = confirmNew ? t("memoryGame.confirmNew") : t("memoryGame.newGame");
    if (won(game)) {
      if (!two) statusEl.textContent = t("memoryGame.won", { moves: game.moves, time: shortClock(elapsed) });
      else if (game.scores[0] === game.scores[1]) statusEl.textContent = t("memoryGame.tie");
      else statusEl.textContent = t("memoryGame.winner", { n: game.scores[0] > game.scores[1] ? 1 : 2 });
    } else statusEl.textContent = two ? t("memoryGame.turn", { n: game.turn + 1 }) : "";
  };

  const tick = () => {
    if (document.hidden) return;
    elapsed++;
    timeEl.textContent = shortClock(elapsed);
  };
  const stopClock = () => {
    if (timer) window.clearInterval(timer);
    timer = 0;
  };
  const clearMiss = () => {
    if (missTimer) window.clearTimeout(missTimer);
    missTimer = 0;
  };

  const turn = (i: number) => {
    if (won(game)) return;
    focus = i;
    confirmNew = false;
    const next = flip(game, i);
    // A tap that changes nothing (a card already up) leaves a showing miss on its timer.
    if (next === game) return paint();
    clearMiss();
    game = next;
    if (!timer) timer = window.setInterval(tick, 1000);
    if (missShowing(game)) {
      missTimer = window.setTimeout(() => {
        missTimer = 0;
        game = settleMiss(game);
        save();
        paint();
      }, MISS_MS);
    }
    if (won(game)) {
      stopClock();
      if (game.players === 1) {
        const key = game.layout;
        if (!best[key] || game.moves < best[key]!) {
          best[key] = game.moves;
          writeStore(BEST_KEY, best);
        }
      }
    }
    save();
    paint();
  };

  const onKey = (e: KeyboardEvent, i: number) => {
    const { rows, cols } = LAYOUTS[game.layout];
    const d = ({ ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] } as Record<string, [number, number]>)[e.key];
    if (!d) return;
    e.preventDefault();
    const r = Math.min(rows - 1, Math.max(0, Math.floor(i / cols) + d[0]));
    const c = Math.min(cols - 1, Math.max(0, (i % cols) + d[1]));
    focus = r * cols + c;
    paint();
    cardEls[focus]?.focus();
  };

  const newGame = () => {
    clearMiss();
    stopClock();
    game = deal(layoutSel.value as LayoutId, Number(playersSel.value) === 2 ? 2 : 1, cryptoRand);
    elapsed = 0;
    focus = 0;
    confirmNew = false;
    build();
    save();
    paint();
  };
  const maybeNew = () => {
    if (started()) {
      statusEl.textContent = t("memoryGame.settingNext");
      return;
    }
    newGame();
  };
  const askNew = () => {
    if (started() && !confirmNew) {
      confirmNew = true;
      return paint();
    }
    newGame();
  };

  host.append(
    h("header", { class: "tool-head" },
      h("h1", null, t("memoryGame.title")),
      h("p", { class: "lede" }, t("memoryGame.privacyNote")),
    ),
    h("div", { class: "mem-tool" },
      h("div", { class: "mem-main" },
        h("dl", { class: "stats-grid mem-stats" },
          h("dt", null, t("memoryGame.moves")), movesEl,
          h("dt", null, t("memoryGame.time")), timeEl,
          h("dt", null, t("memoryGame.best")), bestEl,
          scoreDt1, scoreDd1, scoreDt2, scoreDd2,
        ),
        grid,
        statusEl,
      ),
      h("aside", { class: "rail controls" },
        h("label", { class: "field" }, h("span", null, t("memoryGame.layout")), layoutSel),
        h("label", { class: "field" }, h("span", null, t("memoryGame.players")), playersSel),
        h("div", { class: "stage-actions" }, newBtn),
        h("p", { class: "hint" }, t("memoryGame.hint")),
      ),
    ),
  );
  build();
  paint();
  mounted = {
    cleanup: () => {
      stopClock();
      clearMiss();
    },
  };
}

export function unmountMemoryGame(): void {
  mounted?.cleanup();
  mounted = null;
}
