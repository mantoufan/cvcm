import { h } from "./dom";
import { t } from "./i18n";

/**
 * Bits shared by checkers, reversi and gomoku: the player/level/side rail, a grid of point buttons with one tab stop
 * and arrow-key movement, and the "computer is thinking" scheduler that drops answers made stale by undo, a new game
 * or a mode change.
 */

export type Mode = "computer" | "friend";
export const MODES: readonly Mode[] = ["computer", "friend"];

export function selectField<T extends string>(ns: string, field: string, values: readonly T[], value: T, label: (v: T) => string, onChange: (v: T) => void) {
  const el = h("select", { "data-field": field, onChange: () => onChange(values[el.selectedIndex]!) },
    ...values.map((v) => h("option", { value: v, selected: v === value }, label(v))));
  const wrap = h("label", { class: "field" }, h("span", null, t(`${ns}.${field}`)), el);
  return { el, wrap };
}

/** Column letters a, b, c … and rows counted from the bottom, as on printed boards. */
export function pointName(index: number, size: number, upper = false): string {
  const r = Math.floor(index / size);
  const c = index % size;
  const letter = String.fromCharCode(97 + c);
  return `${upper ? letter.toUpperCase() : letter}${size - r}`;
}

/**
 * A size × size grid of buttons (`cellClass`) inside `grid`, in screen order. `toIndex` maps a screen position to a
 * board index (for a flipped board). One button is tabbable; arrow keys move focus; Enter/Space press it.
 */
export function buttonGrid(grid: HTMLElement, size: number, cellClass: string, toIndex: (row: number, col: number) => number, onPress: (index: number) => void) {
  const cells = new Map<number, HTMLButtonElement>();
  let focusIndex = toIndex(size - 1, Math.floor(size / 2));
  const build = () => {
    grid.replaceChildren();
    cells.clear();
    for (let row = 0; row < size; row++) {
      const r = h("div", { class: `${cellClass}-row`, role: "row" });
      for (let col = 0; col < size; col++) {
        const index = toIndex(row, col);
        const b = h("button", { type: "button", role: "gridcell", class: cellClass, "data-i": index, tabindex: -1 });
        b.style.setProperty("--row", String(row));
        b.style.setProperty("--col", String(col));
        b.addEventListener("click", () => { focusIndex = index; onPress(index); });
        b.addEventListener("keydown", (e) => {
          const d = ({ ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] } as Record<string, [number, number]>)[e.key];
          if (!d) return;
          e.preventDefault();
          const nr = row + d[0];
          const nc = col + d[1];
          if (nr < 0 || nr >= size || nc < 0 || nc >= size) return;
          focusIndex = toIndex(nr, nc);
          syncTab();
          cells.get(focusIndex)?.focus();
        });
        cells.set(index, b);
        r.append(b);
      }
      grid.append(r);
    }
    syncTab();
  };
  const syncTab = () => {
    for (const [i, b] of cells) b.tabIndex = i === focusIndex ? 0 : -1;
  };
  return { cells, build, syncTab, focus: (i: number) => { focusIndex = i; syncTab(); } };
}

/**
 * Runs the computer's move a moment after the page has painted "thinking". `cancel()` (undo, new game, mode change,
 * unmount) makes any pending answer stale.
 */
export function thinker() {
  let generation = 0;
  let timer = 0;
  return {
    get busy() { return timer !== 0; },
    run(work: () => void, delay = 30) {
      const gen = ++generation;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        timer = 0;
        if (gen === generation) work();
      }, delay);
    },
    cancel() {
      generation++;
      window.clearTimeout(timer);
      timer = 0;
    },
  };
}
