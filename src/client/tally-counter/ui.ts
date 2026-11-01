import { copyWithFlash } from "../copy";
import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { MAX_COUNTERS, MAX_NAME, MAX_STEP, bump, clampStep, parseTally, total, type TallyState } from "../../shared/tally";

const STORE_KEY = "cvcm.tally.v1";

let rootEl: HTMLElement | null = null;
let listEl: HTMLElement | null = null;
let totalEl: HTMLElement | null = null;
let stepEl: HTMLInputElement | null = null;
let negEl: HTMLInputElement | null = null;
let addBtn: HTMLButtonElement | null = null;
let copyBtn: HTMLButtonElement | null = null;
let undoBtn: HTMLButtonElement | null = null;
/** Counts before the last reset, by counter index, offered back for a few seconds. */
let undoCounts: Map<number, number> | null = null;
/** Time of the last pointer press in the tool, to tell a mouse-ticked checkbox from a keyboard one. */
let lastPointerAt = -Infinity;
let undoTimer = 0;
const UNDO_MS = 8000;
let state: TallyState = fresh();
/** The counter the keyboard shortcuts change. */
let active = 0;

function fresh(): TallyState {
  return { counters: [{ name: t("tallyCounter.defaultName", { n: 1 }), count: 0 }], step: 1, allowNegative: false };
}

export function mountTallyCounter(host: HTMLElement): void {
  state = load() ?? fresh();
  active = 0;
  stepEl = h("input", { type: "number", min: "1", max: String(MAX_STEP), step: "1", inputmode: "numeric", value: String(state.step), "data-field": "step", onInput: () => typedStep(), onChange: () => setStep() });
  negEl = h("input", { type: "checkbox", checked: state.allowNegative, "data-field": "negative", onChange: (e: Event) => { setNegative(); leaveIfClicked(e); } });
  listEl = h("div", { class: "tally-list" });
  totalEl = h("p", { class: "hint", "data-out": "total" });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("tallyCounter.back")),
      h("h1", null, t("tallyCounter.title")),
      h("p", { class: "lede" }, t("tallyCounter.privacyNote")),
    ),
    // A mouse click does not move focus onto the tool's buttons, so Space keeps counting instead of pressing the last one clicked.
    rootEl = h("div", { class: "data-tool", onMousedown: (e: MouseEvent) => keepKeysForCounting(e), onPointerdown: (e: PointerEvent) => { lastPointerAt = e.timeStamp; } },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("tallyCounter.options")),
          h("label", { class: "field" }, h("span", null, t("tallyCounter.step")), stepEl),
          h("label", { class: "check" }, negEl, h("span", null, t("tallyCounter.allowNegative"))),
        ),
        h("div", { class: "stage-actions" },
          addBtn = h("button", { type: "button", class: "btn ghost", "data-action": "add", onClick: () => add() }, t("tallyCounter.add")),
          h("button", { type: "button", class: "btn ghost", "data-action": "reset-all", onClick: () => resetAll() }, t("tallyCounter.resetAll")),
          undoBtn = h("button", { type: "button", class: "btn ghost", "data-action": "undo", hidden: true, onClick: () => undo() }, t("tallyCounter.undo")),
          copyBtn = h("button", { type: "button", class: "btn ghost", onClick: () => void copyOut() }, t("tallyCounter.copy")),
        ),
        h("p", { class: "hint" }, t("tallyCounter.hint")),
      ),
      h("div", { class: "rail" }, listEl, totalEl),
    ),
  );
  document.addEventListener("keydown", onKey);
  window.addEventListener("storage", onStorage);
  paint();
}

export function unmountTallyCounter(): void {
  document.removeEventListener("keydown", onKey);
  window.removeEventListener("storage", onStorage);
  rootEl = listEl = totalEl = null;
  stepEl = negEl = null;
  addBtn = copyBtn = undoBtn = null;
  window.clearTimeout(undoTimer);
  undoCounts = null;
}

function load(): TallyState | null {
  try {
    return parseTally(window.localStorage.getItem(STORE_KEY));
  } catch {
    return null;
  }
}

/** Another tab changed the counts: take them over, so a later save here does not overwrite them with older ones. */
function onStorage(e: StorageEvent): void {
  if (e.key !== STORE_KEY) return;
  const next = parseTally(e.newValue);
  if (!next) return;
  // The other tab's counts are newer than anything Undo would bring back.
  dropUndo();
  state = next;
  active = Math.min(active, state.counters.length - 1);
  if (stepEl && document.activeElement !== stepEl) stepEl.value = String(state.step);
  if (negEl) negEl.checked = state.allowNegative;
  const rows = listEl?.children;
  // While a name is being typed here, update the numbers in place so the field keeps focus.
  if (rows && rows.length === state.counters.length && listEl?.contains(document.activeElement)) {
    state.counters.forEach((c, i) => {
      const input = rows[i].querySelector<HTMLInputElement>("[data-field='name']");
      if (input && input !== document.activeElement) input.value = c.name;
      else if (input) c.name = input.value.slice(0, MAX_NAME);
      paint(i);
    });
    return;
  }
  paint();
}

function save(): void {
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch { /* private mode or storage blocked: counting still works */ }
}

function change(i: number, sign: 1 | -1): void {
  // Counting again on a counter that was just reset means the reset stands.
  if (undoCounts?.has(i)) dropUndo();
  const c = state.counters[i];
  if (!c) return;
  c.count = bump(c.count, sign * state.step, state.allowNegative);
  active = i;
  save();
  paint(i);
}

function setStep(): void {
  state.step = clampStep(Number(stepEl?.value));
  if (stepEl) stepEl.value = String(state.step);
  save();
}

/** A typed step counts at once (a click on + does not blur the field); the field is tidied up on change. */
function typedStep(): void {
  const v = Number(stepEl?.value);
  if (!stepEl?.value.trim() || !Number.isFinite(v) || v < 1) return;
  state.step = clampStep(v);
  save();
}

function setNegative(): void {
  // Unticking keeps counts already below zero; from then on − stops at zero.
  state.allowNegative = !!negEl?.checked;
  save();
}

function add(): void {
  if (state.counters.length >= MAX_COUNTERS) return;
  dropUndo();
  state.counters.push({ name: t("tallyCounter.defaultName", { n: state.counters.length + 1 }), count: 0 });
  active = state.counters.length - 1;
  save();
  paint();
}

function remove(i: number): void {
  if (state.counters.length <= 1) return;
  dropUndo();
  state.counters.splice(i, 1);
  // Keep the keyboard on the same counter when one above it goes away.
  if (i < active) active--;
  active = Math.min(active, state.counters.length - 1);
  save();
  paint();
}

/**
 * A mouse click does not move focus onto the tool's buttons, and leaves any field it was in, so Space and the arrows
 * keep counting (instead of pressing the last button clicked, or typing into the step or a name).
 */
function keepKeysForCounting(e: MouseEvent): void {
  if (!(e.target as HTMLElement | null)?.closest("button")) return;
  e.preventDefault();
  const focused = document.activeElement as HTMLElement | null;
  if (focused && focused !== document.body && rootEl?.contains(focused)) focused.blur();
}

/** A checkbox ticked with the mouse gives focus back to the page, so Space counts instead of unticking it. */
function leaveIfClicked(e: Event): void {
  if (e.timeStamp - lastPointerAt < 1000) (e.target as HTMLElement | null)?.blur();
}

/** Remembers the counts about to be reset; a second reset while Undo is offered keeps the first values. */
function offerUndo(indices: number[]): void {
  undoCounts ??= new Map();
  for (const i of indices) if (!undoCounts.has(i)) undoCounts.set(i, state.counters[i].count);
  if (undoBtn) undoBtn.hidden = false;
  window.clearTimeout(undoTimer);
  undoTimer = window.setTimeout(dropUndo, UNDO_MS);
}

function dropUndo(): void {
  window.clearTimeout(undoTimer);
  undoCounts = null;
  if (undoBtn) undoBtn.hidden = true;
}

function undo(): void {
  if (!undoCounts) return;
  // Only the counters that were reset come back; counts added to the others since then stay.
  for (const [i, n] of undoCounts) if (state.counters[i]) state.counters[i].count = n;
  dropUndo();
  save();
  paint();
}

function resetOne(i: number): void {
  const c = state.counters[i];
  if (!c) return;
  offerUndo([i]);
  c.count = 0;
  save();
  paint(i);
}

function resetAll(): void {
  offerUndo(state.counters.map((_, i) => i));
  for (const c of state.counters) c.count = 0;
  save();
  paint();
}

function rename(i: number, name: string): void {
  const c = state.counters[i];
  if (!c) return;
  c.name = name.slice(0, MAX_NAME);
  save();
}

function onKey(e: KeyboardEvent): void {
  // Leave shortcuts with modifiers and held-down (repeating) keys alone: one press is one count.
  if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
  const target = e.target as HTMLElement | null;
  // Only when nothing else has focus, or focus is on the counter's own buttons: links, FAQ toggles and fields keep their keys.
  const onPage = !target || target === document.body || target === document.documentElement;
  const onButton = target?.tagName === "BUTTON" && !!rootEl?.contains(target);
  if (!onPage && !onButton) return;
  // On a focused button, Space and Enter press that button.
  if (onButton && (e.key === " " || e.key === "Enter")) return;
  if (e.key === " " || e.key === "ArrowUp" || e.key === "+" || e.key === "=") {
    e.preventDefault();
    change(active, 1);
  } else if (e.key === "ArrowDown" || e.key === "-") {
    e.preventDefault();
    change(active, -1);
  }
}

/** Repaints all counters, or only the count of one (so its name field keeps focus while clicking + quickly). */
function paint(only?: number): void {
  if (!listEl) return;
  if (only != null && listEl.children[only]) {
    const out = listEl.children[only].querySelector("[data-out='count']");
    if (out) out.textContent = String(state.counters[only].count);
    for (let i = 0; i < listEl.children.length; i++) listEl.children[i].classList.toggle("active", i === active);
  } else {
    listEl.replaceChildren(...state.counters.map((c, i) => row(c.name, c.count, i)));
  }
  if (totalEl) totalEl.textContent = state.counters.length > 1 ? t("tallyCounter.total", { n: total(state.counters) }) : "";
  if (addBtn) addBtn.disabled = state.counters.length >= MAX_COUNTERS;
}

function row(name: string, count: number, i: number): HTMLElement {
  const nameEl = h("input", { type: "text", maxlength: String(MAX_NAME), value: name, "aria-label": t("tallyCounter.name"), "data-field": "name", onInput: () => rename(i, nameEl.value), onFocus: () => { active = i; paint(i); } });
  return h("div", { class: i === active ? "tally-row active" : "tally-row", onPointerdown: () => { if (active !== i) { active = i; paint(i); } } },
    h("div", { class: "tally-head" },
      nameEl,
      h("button", { type: "button", class: "chip", "data-action": "reset", onClick: () => resetOne(i) }, t("tallyCounter.reset")),
      state.counters.length > 1 ? h("button", { type: "button", class: "chip", "data-action": "remove", "aria-label": t("tallyCounter.remove"), onClick: () => remove(i) }, "×") : null,
    ),
    h("div", { class: "tally-body" },
      h("button", { type: "button", class: "btn ghost tally-minus", "data-action": "minus", "aria-label": t("tallyCounter.minus"), onClick: () => change(i, -1) }, "−"),
      h("output", { class: "tally-count", "data-out": "count", "aria-live": "polite" }, String(count)),
      h("button", { type: "button", class: "btn tally-plus", "data-action": "plus", "aria-label": t("tallyCounter.plus"), onClick: () => change(i, 1) }, "+"),
    ),
  );
}

async function copyOut(): Promise<void> {
  const lines = state.counters.map((c) => `${c.name}: ${c.count}`);
  if (state.counters.length > 1) lines.push(t("tallyCounter.total", { n: total(state.counters) }));
  await copyWithFlash(copyBtn, lines.join("\n"), { done: t("tallyCounter.copied"), failed: t("tallyCounter.copyFailed") });
}
