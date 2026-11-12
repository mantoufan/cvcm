import { copyWithFlash } from "../copy";
import { h } from "../dom";
import { locale, t } from "../i18n";
import { ALPHABET, ALPHABETS, MAX_LETTERS, drawLetters, letterPool, type AlphabetId, type LetterCase, type LetterKind } from "../../shared/random-letter";

const KINDS: readonly LetterKind[] = ["all", "vowels", "consonants"];
const CASES: readonly LetterCase[] = ["upper", "lower", "mixed"];
const SEPARATORS = { space: " ", comma: ", ", newline: "\n", none: "" } as const;
type Separator = keyof typeof SEPARATORS;
const HISTORY = 10;

/** The alphabet a page starts on: the visitor's own where we have one. */
const START: Partial<Record<string, AlphabetId>> = { es: "es", vi: "vi", ja: "hiragana" };

let els: {
  alphabet: HTMLSelectElement;
  kind: HTMLSelectElement;
  letterCase: HTMLSelectElement;
  count: HTMLInputElement;
  unique: HTMLInputElement;
  exclude: HTMLInputElement;
  separator: HTMLSelectElement;
  letters: HTMLElement;
  pool: HTMLElement;
  error: HTMLElement;
  history: HTMLOListElement;
  copy: HTMLButtonElement;
} | null = null;
let last = "";
/** The latest draw, so a new separator can re-join it. */
let shown: string[] = [];

export function mountRandomLetter(host: HTMLElement): void {
  const start = START[locale()] ?? "en";
  const select = (field: string, options: Array<[string, string]>, value: string, onChange: () => void) =>
    h("select", { "data-field": field, onChange }, ...options.map(([v, label]) => h("option", { value: v, selected: v === value }, label)));
  const alphabet = select("alphabet", ALPHABETS.map((a) => [a, t(`randomLetter.a_${a}`)]), start, () => syncOptions());
  const kind = select("kind", KINDS.map((k) => [k, t(`randomLetter.k_${k}`)]), "all", () => syncOptions());
  const letterCase = select("case", CASES.map((c) => [c, t(`randomLetter.c_${c}`)]), "upper", () => syncOptions());
  const separator = select("separator", (Object.keys(SEPARATORS) as Separator[]).map((s) => [s, t(`randomLetter.sep_${s}`)]), "space", () => show());
  const count = h("input", { type: "number", min: "1", max: String(MAX_LETTERS), step: "1", value: "1", inputmode: "numeric", "data-field": "count", onInput: () => syncOptions() });
  const unique = h("input", { type: "checkbox", "data-field": "unique", onChange: () => syncOptions() });
  const exclude = h("input", { type: "text", autocomplete: "off", spellcheck: "false", "data-field": "exclude", placeholder: t("randomLetter.excludePlaceholder"), onInput: () => syncOptions() });
  const letters = h("p", { class: "letter-out", "aria-live": "polite", "data-out": "letters" }, "—");
  const pool = h("p", { class: "hint", "data-out": "pool" });
  const error = h("p", { class: "hint", "aria-live": "polite", "data-out": "error" });
  const history = h("ol", { class: "letter-history", "data-out": "history" });
  const copy: HTMLButtonElement = h("button", {
    type: "button",
    class: "btn ghost",
    "data-action": "copy",
    onClick: () => void copyWithFlash(copy, last, { done: t("randomLetter.copied"), failed: t("randomLetter.copyFailed") }),
  }, t("randomLetter.copy"));
  els = { alphabet, kind, letterCase, count, unique, exclude, separator, letters, pool, error, history, copy };
  const field = (label: string, control: HTMLElement) => h("label", { class: "field" }, h("span", null, label), control);
  host.append(
    h("header", { class: "tool-head" },
      h("h1", null, t("randomLetter.title")),
      h("p", { class: "lede" }, t("randomLetter.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("randomLetter.options")),
          field(t("randomLetter.alphabet"), alphabet),
          field(t("randomLetter.kind"), kind),
          field(t("randomLetter.case"), letterCase),
          field(t("randomLetter.count"), count),
          h("label", { class: "check" }, unique, h("span", null, t("randomLetter.unique"))),
          field(t("randomLetter.exclude"), exclude),
          field(t("randomLetter.separator"), separator),
        ),
        pool,
      ),
      h("div", { class: "rail" },
        h("div", { class: "stage-actions" },
          h("button", { type: "button", class: "btn", "data-action": "draw", onClick: () => draw() }, t("randomLetter.draw")),
          copy,
        ),
        error,
        letters,
        h("h2", { class: "letter-history-title" }, t("randomLetter.history")),
        history,
      ),
    ),
  );
  syncOptions();
}

export function unmountRandomLetter(): void {
  els = null;
  last = "";
  shown = [];
}

function options() {
  if (!els) throw new Error("unmounted");
  return {
    alphabet: els.alphabet.value as AlphabetId,
    kind: els.kind.value as LetterKind,
    letterCase: els.letterCase.value as LetterCase,
    exclude: els.exclude.value,
    // An empty or half-typed box counts as not a number, so the draw says so instead of guessing.
    count: els.count.value.trim() === "" ? NaN : Number(els.count.value),
    unique: els.unique.checked,
  };
}

/** Kana have no vowel split or case: those menus are off for them. Shows how many letters the draw picks from. */
function syncOptions(): void {
  if (!els) return;
  const a = ALPHABET[els.alphabet.value as AlphabetId];
  els.kind.disabled = !a.vowels;
  els.letterCase.disabled = !a.cased;
  const o = options();
  const pool = letterPool(o);
  els.pool.textContent = t("randomLetter.poolSize", { n: pool.length, letters: pool.join(" ") });
  els.error.textContent = "";
}

function draw(): void {
  if (!els) return;
  const r = drawLetters(options());
  if (!r.ok) {
    els.error.textContent = t(`randomLetter.err_${r.error}`, { max: MAX_LETTERS });
    return;
  }
  els.error.textContent = "";
  const sep = SEPARATORS[els.separator.value as Separator] ?? " ";
  last = r.letters.join(sep);
  show(r.letters);
  const item = h("li", null, r.letters.length > 40 ? `${r.letters.slice(0, 40).join(sep)} …` : last);
  els.history.prepend(item);
  while (els.history.children.length > HISTORY) els.history.lastElementChild?.remove();
}

/** Shows the latest draw with the chosen separator; a new separator re-joins the same letters. */
function show(letters: string[] = shown): void {
  if (!els) return;
  shown = letters;
  if (!letters.length) return;
  const sep = SEPARATORS[els.separator.value as Separator] ?? " ";
  last = letters.join(sep);
  els.letters.textContent = last;
  els.letters.classList.toggle("letter-many", letters.length > 12);
}
