import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { MAX_COUNTERS, MAX_NAME, MAX_STEP, bump, clampStep, parseTally, total, type TallyState } from "../../shared/tally";

const STORE_KEY = "cvcm.tally.v1";

let listEl: HTMLElement | null = null;
let totalEl: HTMLElement | null = null;
let stepEl: HTMLInputElement | null = null;
let negEl: HTMLInputElement | null = null;
let addBtn: HTMLButtonElement | null = null;
let copyBtn: HTMLButtonElement | null = null;
let state: TallyState = fresh();
/** The counter the keyboard shortcuts change. */
let active = 0;

function fresh(): TallyState {
  return { counters: [{ name: t("tallyCounter.defaultName", { n: 1 }), count: 0 }], step: 1, allowNegative: false };
}

export function mountTallyCounter(host: HTMLElement): void {
  state = load() ?? fresh();
  active = 0;
  stepEl = h("input", { type: "number", min: "1", max: String(MAX_STEP), step: "1", inputmode: "numeric", value: String(state.step), "data-field": "step", onChange: () => setStep() });
  negEl = h("input", { type: "checkbox", checked: state.allowNegative, "data-field": "negative", onChange: () => setNegative() });
  listEl = h("div", { class: "tally-list" });
  totalEl = h("p", { class: "hint", "data-out": "total" });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("tallyCounter.back")),
      h("h1", null, t("tallyCounter.title")),
      h("p", { class: "lede" }, t("tallyCounter.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("tallyCounter.options")),
          h("label", { class: "field" }, h("span", null, t("tallyCounter.step")), stepEl),
          h("label", { class: "check" }, negEl, h("span", null, t("tallyCounter.allowNegative"))),
        ),
        h("div", { class: "stage-actions" },
          addBtn = h("button", { type: "button", class: "btn ghost", "data-action": "add", onClick: () => add() }, t("tallyCounter.add")),
          h("button", { type: "button", class: "btn ghost", "data-action": "reset-all", onClick: () => resetAll() }, t("tallyCounter.resetAll")),
          copyBtn = h("button", { type: "button", class: "btn ghost", onClick: () => void copyOut() }, t("tallyCounter.copy")),
        ),
        h("p", { class: "hint" }, t("tallyCounter.hint")),
      ),
      h("div", { class: "rail" }, listEl, totalEl),
    ),
  );
  document.addEventListener("keydown", onKey);
  paint();
}

export function unmountTallyCounter(): void {
  document.removeEventListener("keydown", onKey);
  listEl = totalEl = null;
  stepEl = negEl = null;
  addBtn = copyBtn = null;
}

function load(): TallyState | null {
  try {
    return parseTally(window.localStorage.getItem(STORE_KEY));
  } catch {
    return null;
  }
}

function save(): void {
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch { /* private mode or storage blocked: counting still works */ }
}

function change(i: number, sign: 1 | -1): void {
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

function setNegative(): void {
  state.allowNegative = !!negEl?.checked;
  if (!state.allowNegative) for (const c of state.counters) c.count = Math.max(0, c.count);
  save();
  paint();
}

function add(): void {
  if (state.counters.length >= MAX_COUNTERS) return;
  state.counters.push({ name: t("tallyCounter.defaultName", { n: state.counters.length + 1 }), count: 0 });
  active = state.counters.length - 1;
  save();
  paint();
}

function remove(i: number): void {
  if (state.counters.length <= 1) return;
  state.counters.splice(i, 1);
  active = Math.min(active, state.counters.length - 1);
  save();
  paint();
}

function resetOne(i: number): void {
  const c = state.counters[i];
  if (!c) return;
  c.count = 0;
  save();
  paint(i);
}

function resetAll(): void {
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
  // Leave typing in fields and shortcuts with modifiers alone.
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const target = e.target as HTMLElement | null;
  if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable)) return;
  // On a focused button, Space and Enter press that button.
  if ((e.key === " " || e.key === "Enter") && target?.tagName === "BUTTON") return;
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
  try {
    await navigator.clipboard.writeText(lines.join("\n"));
    if (copyBtn) copyBtn.textContent = t("tallyCounter.copied");
    window.setTimeout(() => {
      if (copyBtn) copyBtn.textContent = t("tallyCounter.copy");
    }, 1200);
  } catch { /* ignore */ }
}
