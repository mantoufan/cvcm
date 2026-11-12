import { copyWithFlash } from "../copy";
import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { MAX_BLANKS, MAX_LETTERS, byLength, parseRack, parseWordList, unscramble, type Found } from "../../shared/word-unscramble";

/** ENABLE word list, a static file (public/words/). */
const LIST_URL = "/words/enable.txt";

/** Loaded once per visit and kept across pages (about 1.7 MB, 450 KB over the wire). */
let words: Promise<string[]> | null = null;

function loadWords(): Promise<string[]> {
  words ??= fetch(LIST_URL)
    .then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.text();
    })
    .then(parseWordList)
    .catch((e: unknown) => {
      words = null;
      throw e;
    });
  return words;
}

/** Any length, then every length a rack of MAX_LETTERS can make. */
const LENGTHS = [0, ...Array.from({ length: MAX_LETTERS - 1 }, (_, i) => i + 2)];
const DEBOUNCE_MS = 120;

let mounted: { cleanup: () => void } | null = null;

export function mountWordUnscrambler(host: HTMLElement): void {
  unmountWordUnscrambler();
  const nf = new Intl.NumberFormat(locale());
  let dict: string[] | null = null;
  let timer = 0;
  let alive = true;
  /** The word list is on its way: one search runs when it lands, however many keystrokes came meanwhile. */
  let loading = false;
  let last = "";
  let copyBtn: HTMLButtonElement | null = null;
  const text = (field: string, placeholder: string, extra: Record<string, unknown> = {}) =>
    h("input", { type: "text", autocomplete: "off", autocapitalize: "off", spellcheck: "false", "data-field": field, placeholder, onInput: () => schedule(), ...extra });
  const letters = text("letters", t("wordUnscrambler.lettersPlaceholder"), { class: "unscramble-input", maxlength: "40", enterkeyhint: "search" });
  const starts = text("starts", t("wordUnscrambler.startsPlaceholder"), { maxlength: "15" });
  const contains = text("contains", t("wordUnscrambler.containsPlaceholder"), { maxlength: "15" });
  const ends = text("ends", t("wordUnscrambler.endsPlaceholder"), { maxlength: "15" });
  const length = h("select", { "data-field": "length", onChange: () => run() },
    ...LENGTHS.map((n) => h("option", { value: String(n) }, n === 0 ? t("wordUnscrambler.anyLength") : t("wordUnscrambler.nLetters", { n }))),
  );
  const status = h("p", { class: "hint", "aria-live": "polite", "data-out": "status" });
  const out = h("div", { class: "unscramble-out", "data-out": "words" });
  const field = (label: string, control: HTMLElement) => h("label", { class: "field" }, h("span", null, label), control);

  const schedule = () => {
    clearTimeout(timer);
    timer = window.setTimeout(run, DEBOUNCE_MS);
  };

  function run(): void {
    clearTimeout(timer);
    out.replaceChildren();
    last = "";
    if (!letters.value.trim()) {
      status.textContent = t("wordUnscrambler.empty");
      return;
    }
    const parsed = parseRack(letters.value);
    if (!parsed.ok) {
      status.textContent = t(`wordUnscrambler.err_${parsed.error}`, { max: MAX_LETTERS, blanks: MAX_BLANKS });
      return;
    }
    if (!dict) {
      status.textContent = t("wordUnscrambler.loading");
      if (loading) return;
      loading = true;
      void loadWords().then(
        (list) => {
          loading = false;
          if (!alive) return;
          dict = list;
          run();
        },
        () => {
          loading = false;
          if (alive) status.textContent = t("wordUnscrambler.loadFailed");
        },
      );
      return;
    }
    const exact = Number(length.value);
    const res = unscramble(dict, parsed.rack, {
      min: exact || 2,
      max: exact || undefined,
      startsWith: starts.value,
      endsWith: ends.value,
      contains: contains.value,
    });
    if (!res.total) {
      status.textContent = t("wordUnscrambler.none");
      return;
    }
    status.textContent = res.total > res.words.length
      ? t("wordUnscrambler.foundSome", { n: nf.format(res.total), shown: nf.format(res.words.length) })
      : t("wordUnscrambler.found", { n: nf.format(res.total) });
    const full = parsed.rack.length;
    const groups = byLength(res.words);
    out.append(...groups.map((g) => h("section", { class: "unscramble-group", "data-length": String(g.length) },
      h("h2", null, t("wordUnscrambler.groupTitle", { n: g.length, count: nf.format(res.counts.get(g.length) ?? g.words.length) }), g.length === full ? h("span", { class: "chip-note" }, t("wordUnscrambler.allLetters")) : null),
      h("ul", { class: "unscramble-words" }, ...g.words.map((w) => h("li", null, wordEl(w)))),
    )));
    last = groups.map((g) => `${t("wordUnscrambler.groupTitle", { n: g.length, count: nf.format(res.counts.get(g.length) ?? g.words.length) })}\n${g.words.map((w) => w.word).join(", ")}`).join("\n\n");
  }

  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("wordUnscrambler.back")),
      h("h1", null, t("wordUnscrambler.title")),
      h("p", { class: "lede" }, t("wordUnscrambler.privacyNote")),
    ),
    h("form", { class: "unscramble-form", onSubmit: (e: Event) => { e.preventDefault(); run(); letters.blur(); } },
      h("label", { class: "field" }, h("span", null, t("wordUnscrambler.letters")), letters),
      h("p", { class: "hint" }, t("wordUnscrambler.blankHint")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("wordUnscrambler.filters")),
          field(t("wordUnscrambler.length"), length),
          field(t("wordUnscrambler.starts"), starts),
          field(t("wordUnscrambler.contains"), contains),
          field(t("wordUnscrambler.ends"), ends),
        ),
        h("div", { class: "stage-actions" },
          copyBtn = h("button", { type: "button", class: "btn ghost", "data-action": "copy", onClick: () => void copyWithFlash(copyBtn, last, { done: t("wordUnscrambler.copied"), failed: t("wordUnscrambler.copyFailed") }) }, t("wordUnscrambler.copy")),
        ),
        h("p", { class: "hint" }, t("wordUnscrambler.listNote")),
      ),
      h("div", { class: "rail" }, status, out),
    ),
  );
  status.textContent = t("wordUnscrambler.empty");
  mounted = {
    cleanup: () => {
      alive = false;
      clearTimeout(timer);
      copyBtn = null;
    },
  };
}

/** A word with the letters a blank stood for marked. */
function wordEl(w: Found): HTMLElement {
  if (!w.blanks.length) return h("span", { class: "unscramble-word" }, w.word);
  const set = new Set(w.blanks);
  return h("span", { class: "unscramble-word", "aria-label": w.word },
    ...[...w.word].map((c, i) => (set.has(i) ? h("span", { class: "unscramble-blank", title: t("wordUnscrambler.blankLetter") }, c) : c)),
  );
}

export function unmountWordUnscrambler(): void {
  mounted?.cleanup();
  mounted = null;
}
