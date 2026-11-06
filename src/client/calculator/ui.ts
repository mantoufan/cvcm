import { copyWithFlash } from "../copy";
import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import {
  MAX_EVAL,
  MAX_EXPR,
  MAX_HISTORY,
  decimalMarkOf,
  evaluate,
  formatResult,
  parseHistory,
  replaceAns,
  type AngleMode,
  type HistoryEntry,
} from "../../shared/calculator";

/** History per decimal mark: "1,5" means 1.5 on a decimal-comma page and nothing on a decimal-point one. */
const storeKey = () => (decimalMarkOf(locale()) === "," ? "cvcm.calculator.comma.v1" : "cvcm.calculator.v1");

let exprEl: HTMLInputElement | null = null;
let previewEl: HTMLElement | null = null;
let historyEl: HTMLElement | null = null;
let copyBtn: HTMLButtonElement | null = null;
let modeBtn: HTMLButtonElement | null = null;
let mode: AngleMode = "deg";
let ans = 0;
/** The sum "=" last worked out and the Ans it used: "=" updates `ans`, so re-reading that same "Ans+1" must not use its own result. */
let done: { expr: string; ans: number } | null = null;
let history: HistoryEntry[] = [];
/** The last "=" result, shown until the expression changes. */
let shown: string | null = null;

/** Keypad: [label, what it types (or an action), class]. Labels are symbols, the same in every language. */
const KEYS: Array<[string, string, string?]> = [
  ["sin", "sin(", "fn"], ["cos", "cos(", "fn"], ["tan", "tan(", "fn"], ["(", "("], [")", ")"], ["AC", "@clear", "op"],
  ["sin⁻¹", "asin(", "fn"], ["cos⁻¹", "acos(", "fn"], ["tan⁻¹", "atan(", "fn"], ["7", "7"], ["8", "8"], ["9", "9"],
  ["ln", "ln(", "fn"], ["log", "log(", "fn"], ["√", "√(", "fn"], ["4", "4"], ["5", "5"], ["6", "6"],
  ["xʸ", "^", "fn"], ["x²", "^2", "fn"], ["x!", "!", "fn"], ["1", "1"], ["2", "2"], ["3", "3"],
  ["π", "π", "fn"], ["e", "ℯ", "fn"], ["%", "%", "fn"], ["0", "0"], [".", "@dot"], ["⌫", "@back", "op"],
  ["Ans", "Ans", "fn"], ["÷", "÷", "op"], ["×", "×", "op"], ["−", "−", "op"], ["+", "+", "op"], ["=", "@eq", "eq"],
];

export function mountCalculator(host: HTMLElement): void {
  mode = "deg";
  ans = 0;
  done = null;
  shown = null;
  history = load();
  exprEl = h("input", {
    type: "text",
    class: "calc-expr",
    "data-field": "expr",
    maxlength: String(MAX_EXPR),
    autocomplete: "off",
    autocapitalize: "off",
    spellcheck: "false",
    "aria-label": t("calculator.expression"),
    placeholder: "2 × (3 + 4)",
    onInput: () => {
      shown = null;
      paint();
    },
    // After "=", typing means the same as the keypad: a new sum, or carrying on from the answer.
    onBeforeinput: (e: InputEvent) => {
      if (shown === null || !e.data || !e.data.trim() || (e.inputType !== "insertText" && e.inputType !== "insertFromPaste")) return;
      e.preventDefault();
      insert(e.data);
      paint();
    },
    onKeydown: (e: KeyboardEvent) => {
      if (e.key === "Enter" || (e.key === "=" && !e.ctrlKey && !e.metaKey)) {
        e.preventDefault();
        equals();
      } else if (e.key === "Escape") {
        e.preventDefault();
        clearAll();
      }
    },
  });
  previewEl = h("output", { class: "calc-result", "data-out": "result", "aria-live": "polite" });
  historyEl = h("ol", { class: "calc-history", "data-out": "history" });
  const pad = h("div", { class: "calc-pad", role: "group", "aria-label": t("calculator.keypad") },
    ...KEYS.map(([label, act, cls]) =>
      h("button", {
        type: "button",
        class: `calc-key${cls ? ` ${cls}` : ""}`,
        "data-key": act,
        "aria-label": keyName(label, act),
        // Keep the caret in the expression field: a tap on a key must not take focus (and the phone keyboard) away.
        onMousedown: (e: MouseEvent) => e.preventDefault(),
        onClick: () => press(act),
      }, act === "@dot" ? decimalMarkOf(locale()) : label),
    ),
  );
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("calculator.back")),
      h("h1", null, t("calculator.title")),
      h("p", { class: "lede" }, t("calculator.privacyNote")),
    ),
    h("div", { class: "data-tool calc-tool" },
      h("div", { class: "rail calc-main" },
        h("div", { class: "calc-screen" },
          h("div", { class: "calc-top" },
            modeBtn = h("button", { type: "button", class: "chip", "data-action": "mode", "aria-pressed": "false", onClick: () => toggleMode() }, modeLabel()),
            copyBtn = h("button", { type: "button", class: "chip", "data-action": "copy", onClick: () => void copyResult() }, t("calculator.copy")),
          ),
          exprEl,
          previewEl,
        ),
        pad,
      ),
      h("aside", { class: "rail controls" },
        h("h2", null, t("calculator.history")),
        historyEl,
        h("button", { type: "button", class: "btn ghost", "data-action": "clear-history", onClick: () => clearHistory() }, t("calculator.clearHistory")),
        h("p", { class: "hint" }, t("calculator.hint")),
      ),
    ),
  );
  paint();
  paintHistory();
}

export function unmountCalculator(): void {
  exprEl = previewEl = historyEl = null;
  copyBtn = modeBtn = null;
}

function keyName(label: string, act: string): string {
  const names: Record<string, string> = {
    "@clear": t("calculator.clear"),
    "@back": t("calculator.backspace"),
    "@eq": t("calculator.equals"),
    "@dot": t("calculator.decimal"),
    "√(": t("calculator.sqrt"),
    "^": t("calculator.power"),
    "^2": t("calculator.square"),
    "!": t("calculator.factorial"),
    "%": t("calculator.percent"),
    Ans: t("calculator.ans"),
  };
  return names[act] ?? label;
}

function modeLabel(): string {
  return mode === "deg" ? t("calculator.deg") : t("calculator.rad");
}

function toggleMode(): void {
  mode = mode === "deg" ? "rad" : "deg";
  if (modeBtn) {
    modeBtn.textContent = modeLabel();
    modeBtn.setAttribute("aria-pressed", String(mode === "rad"));
  }
  shown = null;
  paint();
}

function load(): HistoryEntry[] {
  try {
    return parseHistory(window.localStorage.getItem(storeKey()));
  } catch {
    return [];
  }
}

function save(): void {
  try {
    window.localStorage.setItem(storeKey(), JSON.stringify(history));
  } catch { /* storage blocked: history lasts for this visit */ }
}

/** Types `text` at the caret (replacing a selection), as a key on the pad does. */
function insert(text: string): void {
  if (!exprEl) return;
  // After "=", a digit starts a new sum; an operator carries on from the answer.
  if (shown !== null) {
    exprEl.value = /^[+\-−×*÷/^!%]/.test(text) ? "Ans" : "";
    done = null;
    exprEl.setSelectionRange(exprEl.value.length, exprEl.value.length);
    shown = null;
  }
  const start = exprEl.selectionStart ?? exprEl.value.length;
  const end = exprEl.selectionEnd ?? start;
  const next = exprEl.value.slice(0, start) + text + exprEl.value.slice(end);
  if (next.length > MAX_EXPR) return;
  exprEl.value = next;
  const caret = start + text.length;
  exprEl.setSelectionRange(caret, caret);
}

function press(act: string): void {
  if (!exprEl) return;
  if (act === "@clear") return clearAll();
  if (act === "@eq") return equals();
  if (act === "@back") {
    if (shown !== null) {
      shown = null;
      paint();
      return;
    }
    const start = exprEl.selectionStart ?? exprEl.value.length;
    const end = exprEl.selectionEnd ?? start;
    if (start !== end) {
      exprEl.value = exprEl.value.slice(0, start) + exprEl.value.slice(end);
      exprEl.setSelectionRange(start, start);
    } else if (start > 0) {
      // Delete a whole function name with its bracket ("sin(") in one press.
      const before = exprEl.value.slice(0, start);
      const fn = /(?:asin|acos|atan|sin|cos|tan|log|ln|√|Ans)\(?$/.exec(before);
      const n = fn ? fn[0].length : Array.from(before).pop()!.length;
      exprEl.value = before.slice(0, -n) + exprEl.value.slice(start);
      exprEl.setSelectionRange(start - n, start - n);
    }
    paint();
    return;
  }
  insert(act === "@dot" ? decimalMarkOf(locale()) : act);
  paint();
}

function clearAll(): void {
  if (!exprEl) return;
  exprEl.value = "";
  done = null;
  shown = null;
  paint();
}

function equals(): void {
  if (!exprEl) return;
  const expr = exprEl.value.trim();
  if (!expr || shown !== null) return;
  const used = done?.expr === expr ? done.ans : ans;
  const r = evaluate(expr, mode, used, decimalMarkOf(locale()));
  if (!r.ok) {
    paint(true);
    return;
  }
  // History shows the number Ans stood for, so reusing the line later gives the same result.
  const mark = decimalMarkOf(locale());
  const was = formatResult(used, mark).replace("−", "-");
  // Brackets when the number would run into a digit or letter ("2Ans", "Anse2") or carries a sign or exponent.
  const saved = replaceAns(expr, (at) =>
    used < 0 || /e/i.test(was) || /[\d.,\p{L}]/u.test(expr[at - 1] ?? "") || /[\d.,\p{L}]/u.test(expr[at + 3] ?? "") ? `(${was})` : was);
  done = { expr, ans: used };
  ans = r.value;
  shown = formatResult(r.value, mark);
  if (saved.length <= MAX_EVAL) history.unshift({ expr: saved, result: shown, mode });
  history = history.slice(0, MAX_HISTORY);
  save();
  paintHistory();
  paint();
}

/** Shows the live result while typing; errors only after "=" (a half-typed sum is not an error yet). */
function paint(showError = false): void {
  if (!exprEl || !previewEl) return;
  previewEl.classList.remove("error");
  if (shown !== null) {
    previewEl.textContent = `= ${shown}`;
    return;
  }
  const expr = exprEl.value.trim();
  // Any edit makes it a new sum, read with the latest Ans.
  if (done && done.expr !== expr) done = null;
  if (!expr) {
    previewEl.textContent = "";
    return;
  }
  const r = evaluate(expr, mode, done ? done.ans : ans, decimalMarkOf(locale()));
  if (r.ok) {
    previewEl.textContent = formatResult(r.value, decimalMarkOf(locale()));
  } else if (showError) {
    previewEl.textContent = t(`calculator.error_${r.error}`);
    previewEl.classList.add("error");
  } else {
    previewEl.textContent = "";
  }
}

function paintHistory(): void {
  if (!historyEl) return;
  if (history.length === 0) {
    historyEl.replaceChildren(h("li", { class: "muted" }, t("calculator.noHistory")));
    return;
  }
  historyEl.replaceChildren(
    ...history.map((e) =>
      h("li", null,
        h("button", {
          type: "button",
          class: "calc-hist",
          title: t("calculator.reuse"),
          onClick: () => {
            if (!exprEl) return;
            exprEl.value = e.expr;
            // The line was worked out in this angle mode, so reusing it gives the same result.
            if (e.mode && e.mode !== mode) toggleMode();
            shown = null;
            paint();
            exprEl.focus();
          },
        },
          h("span", { class: "calc-hist-expr" }, e.expr),
          h("span", { class: "calc-hist-result" }, `= ${e.result}`),
        ),
      ),
    ),
  );
}

function clearHistory(): void {
  history = [];
  save();
  paintHistory();
}

async function copyResult(): Promise<void> {
  const text = (previewEl?.textContent ?? "").replace(/^= /, "");
  if (!text || previewEl?.classList.contains("error")) return;
  await copyWithFlash(copyBtn, text, { done: t("calculator.copied"), failed: t("calculator.copyFailed") });
}
