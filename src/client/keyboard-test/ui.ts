import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { ALL_CODES, EXTRA_CODES, EXTRA_ROW, LOCATIONS, MAIN_ROWS, NAV_ROWS, NUMPAD_ROWS, type Key } from "../../shared/keyboard";

let boardEl: HTMLElement | null = null;
let outEl: HTMLElement | null = null;
let countEl: HTMLElement | null = null;
let logEl: HTMLOListElement | null = null;
const keyEls = new Map<string, HTMLElement>();
const tested = new Set<string>();
const held = new Set<string>();
let maxHeld = 0;
let log: string[] = [];

export function mountKeyboardTest(host: HTMLElement): void {
  boardEl = h("div", {
    class: "kbt-board",
    tabindex: "0",
    role: "application",
    "aria-label": t("keyboardTest.board"),
    onKeydown: (e: Event) => onDown(e as KeyboardEvent),
    onKeyup: (e: Event) => onUp(e as KeyboardEvent),
    onBlur: () => releaseAll(),
  },
  h("div", { class: "kbt-block kbt-main" }, ...MAIN_ROWS.map(row), h("div", { class: "kbt-extra" }, row(EXTRA_ROW))),
  h("div", { class: "kbt-block kbt-nav" }, ...NAV_ROWS.map(row)),
  h("div", { class: "kbt-block kbt-num" }, ...NUMPAD_ROWS.map(row)),
  );
  outEl = h("dl", { class: "stats-grid timestamp-out" });
  countEl = h("p", { class: "hint", "aria-live": "polite" });
  logEl = h("ol", { class: "wheel-history kbt-log" });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("keyboardTest.back")),
      h("h1", null, t("keyboardTest.title")),
      h("p", { class: "lede" }, t("keyboardTest.privacyNote")),
    ),
    h("p", { class: "hint" }, t("keyboardTest.focusHint")),
    h("div", { class: "kbt-scroll" }, boardEl),
    h("div", { class: "data-tool" },
      h("div", { class: "rail" },
        h("h2", null, t("keyboardTest.last")),
        outEl,
        countEl,
        h("div", { class: "stage-actions" },
          h("button", { type: "button", class: "btn ghost", "data-action": "reset", onClick: () => reset() }, t("keyboardTest.reset")),
        ),
      ),
      h("div", { class: "rail" },
        h("h2", null, t("keyboardTest.log")),
        logEl,
        h("p", { class: "hint" }, t("keyboardTest.hint")),
      ),
    ),
  );
  paint(null);
}

export function unmountKeyboardTest(): void {
  boardEl = outEl = countEl = logEl = null;
  keyEls.clear();
  tested.clear();
  held.clear();
  maxHeld = 0;
  log = [];
}

function row(keys: ReadonlyArray<Key>): HTMLElement {
  return h("div", { class: "kbt-row" }, ...keys.map(([code, label, w]) => {
    const style = { flexGrow: String(w), flexBasis: `${w * 2.4}rem` };
    if (!code) return h("span", { class: "kbt-gap", style });
    const el = h("span", { class: "kbt-key", "data-code": code, style }, label);
    keyEls.set(code, el);
    return el;
  }));
}

function onDown(e: KeyboardEvent): void {
  // Tab leaves the board so keyboard users are never trapped; every other key is captured while it has focus.
  if (e.code === "Tab" && !e.ctrlKey && !e.altKey && !e.metaKey && tested.has("Tab")) return;
  e.preventDefault();
  const code = e.code || e.key;
  tested.add(code);
  const el = keyEls.get(code);
  el?.classList.add("down", "done");
  if (code === "CapsLock") {
    // macOS sends Caps Lock keydown on and keyup only on the next press, so show it as a short tap, not a held key.
    window.setTimeout(() => el?.classList.remove("down"), 150);
  } else {
    held.add(code);
    maxHeld = Math.max(maxHeld, held.size);
  }
  if (!e.repeat) {
    log.unshift(`${e.key === " " ? "Space" : e.key} · ${code}`);
    log = log.slice(0, 30);
  }
  paint(e);
}

function onUp(e: KeyboardEvent): void {
  const code = e.code || e.key;
  held.delete(code);
  keyEls.get(code)?.classList.remove("down");
  // Some keys (Print Screen on Windows) only fire keyup; count them as working too.
  if (!tested.has(code)) {
    e.preventDefault();
    tested.add(code);
    keyEls.get(code)?.classList.add("done");
    log.unshift(`${e.key === " " ? "Space" : e.key} · ${code}`);
    log = log.slice(0, 30);
    paint(e);
  }
  // macOS swallows the keyup of other keys while ⌘ is down; clear them when ⌘ is released.
  if (code.startsWith("Meta")) releaseAll();
  paintCount();
}

function releaseAll(): void {
  for (const code of held) keyEls.get(code)?.classList.remove("down");
  held.clear();
  paintCount();
}

function reset(): void {
  releaseAll();
  tested.clear();
  maxHeld = 0;
  log = [];
  for (const el of keyEls.values()) el.classList.remove("done", "down");
  paint(null);
  boardEl?.focus();
}

function paint(e: KeyboardEvent | null): void {
  if (!outEl || !logEl) return;
  const dash = "—";
  const rows: Array<[string, string]> = [
    [t("keyboardTest.key"), e ? (e.key === " " ? "Space" : e.key) : dash],
    [t("keyboardTest.code"), e ? e.code || dash : dash],
    ["keyCode", e ? String(e.keyCode) : dash],
    [t("keyboardTest.location"), e ? t(`keyboardTest.loc_${LOCATIONS[e.location] ?? "standard"}`) : dash],
    [t("keyboardTest.modifiers"), e ? [e.ctrlKey && "Ctrl", e.shiftKey && "Shift", e.altKey && "Alt", e.metaKey && "Meta"].filter(Boolean).join(" + ") || dash : dash],
  ];
  outEl.replaceChildren(...rows.flatMap(([k, v]) => [h("dt", null, k), h("dd", null, v)]));
  logEl.replaceChildren(...log.map((line) => h("li", null, line)));
  paintCount();
}

function paintCount(): void {
  if (!countEl) return;
  const extras = [...tested].filter((c) => EXTRA_CODES.has(c)).length;
  const onBoard = [...tested].filter((c) => ALL_CODES.has(c)).length + extras;
  countEl.textContent = t("keyboardTest.count", { n: onBoard, total: ALL_CODES.size + extras, held: held.size, max: maxHeld });
}
