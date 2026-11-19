import { h } from "../dom";
import { locale, t } from "../i18n";
import { FONT_METRICS } from "../../shared/font-metrics";
import {
  ESSAY, FONT_IDS, MARGINS, PAPER_IDS, SIZES, SPACINGS, layoutText, linesPerPage, pagesForWords, wordsForPages, wordsPerPage,
  type FontId, type PageSetup, type PaperId,
} from "../../shared/words-to-pages";
import { numberFormat } from "../../shared/number-format";
import { copyButton, field, layout, numInput, readNum, rowsTo, select, table } from "../academic/common";

const S = "wordsPages";
type Mode = "words" | "text" | "pages";
/** Word counts in the reference table. */
const TABLE_WORDS = [250, 500, 750, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 10000];
/** The word count the page opens with. */
export const EXAMPLE_WORDS = "1000";

let timer = 0;

export function mountWordsToPages(host: HTMLElement): void {
  let last = "";
  const schedule = () => { window.clearTimeout(timer); timer = window.setTimeout(paint, 150); };
  const nf = (max: 0 | 1) => numberFormat(locale(), { maximumFractionDigits: max });
  const modeSel = select<Mode>("mode", ["words", "text", "pages"], (m) => t(`${S}.m_${m}`), () => { sync(); paint(); }, "words");
  const wordsEl = numInput("words", EXAMPLE_WORDS, schedule, { inputmode: "numeric" });
  const pagesEl = numInput("pages", "5", schedule);
  const textEl = h("textarea", { class: "average-input", rows: "8", "data-field": "text", spellcheck: "false", "aria-label": t(`${S}.text`), placeholder: t(`${S}.textPlaceholder`), onInput: schedule });
  const fontSel = select<FontId>("font", FONT_IDS, (f) => FONT_METRICS[f].name, () => paint(), ESSAY.font);
  const sizeSel = select<string>("size", SIZES.map(String), (s) => `${nf(1).format(Number(s))} pt`, () => paint(), String(ESSAY.size));
  const spacingSel = select<string>("spacing", SPACINGS.map(String), (s) => t(`${S}.sp_${s.replace(".", "_")}`), () => paint(), String(ESSAY.spacing));
  const paperSel = select<PaperId>("paper", PAPER_IDS, (p) => t(`${S}.p_${p}`), () => paint(), ESSAY.paper);
  const marginSel = select<string>("margin", MARGINS.map(String), (m) => t(`${S}.mg_${m.replace(".", "_")}`), () => paint(), String(ESSAY.margin));
  const indent = h("input", { type: "checkbox", "data-field": "indent", checked: ESSAY.indent, onChange: () => paint() });
  const wordsField = field(t(`${S}.words`), wordsEl);
  const pagesField = field(t(`${S}.pages`), pagesEl);
  const textField = field(t(`${S}.text`), textEl);
  const out = h("dl", { class: "stats-grid", "data-out": "result" });
  const note = h("p", { class: "hint", "data-out": "note" });
  const ref = h("div", { class: "table-wrap", "data-out": "table" });
  const copy = copyButton(S, () => { window.clearTimeout(timer); paint(); return last; });

  const setup = (): PageSetup => ({
    font: fontSel.value as FontId,
    size: Number(sizeSel.value),
    spacing: Number(spacingSel.value),
    paper: paperSel.value as PaperId,
    margin: Number(marginSel.value),
    indent: indent.checked,
  });

  function sync(): void {
    const mode = modeSel.value as Mode;
    wordsField.hidden = mode !== "words";
    pagesField.hidden = mode !== "pages";
    textField.hidden = mode !== "text";
  }

  /** "2.8 pages" with one decimal; whole numbers stay whole. */
  const pagesText = (p: number) => {
    const shown = Math.round(p * 10) / 10;
    // Under a twentieth of a page still reads as some page, not "0".
    return t(`${S}.pagesValue`, { n: shown === 0 && p > 0 ? `< ${nf(1).format(0.1)}` : nf(1).format(shown) });
  };

  function paint(): void {
    const mode = modeSel.value as Mode;
    const s = setup();
    let perPage = wordsPerPage(s);
    const lines = linesPerPage(s);
    let rows: [string, string, boolean?][] = [];
    note.textContent = "";
    if (mode === "pages") {
      const pages = readNum(pagesEl);
      if (pages === undefined || !(pages > 0)) return empty(t(`${S}.needPages`));
      rows = [[t(`${S}.wordsResult`), t(`${S}.wordsValue`, { n: nf(0).format(roundWords(wordsForPages(pages, s))) }), true]];
    } else if (mode === "words") {
      const words = readNum(wordsEl, true);
      if (words === undefined || !(words > 0)) return empty(t(`${S}.needWords`));
      const pages = pagesForWords(words, s);
      rows = [[t(`${S}.pagesResult`), pagesText(pages), true]];
      note.textContent = fillNote(pages);
    } else {
      if (!textEl.value.trim()) return empty(t(`${S}.needText`));
      const l = layoutText(textEl.value, s);
      // A page or more of your own text gives its own words per page; shorter text would make one up from a few lines.
      if (l.pages >= 1) perPage = l.wordsPerPage;
      rows = [
        [t(`${S}.pagesResult`), pagesText(l.pages), true],
        [t(`${S}.counted`), nf(0).format(l.words)],
        [t(`${S}.linesUsed`), nf(0).format(l.lines)],
      ];
      note.textContent = fillNote(l.pages);
    }
    rows.push(
      [t(`${S}.perPage`), nf(0).format(Math.round(perPage))],
      [t(`${S}.linesPerPage`), nf(0).format(lines)],
    );
    copy.disabled = false;
    last = rowsTo(out, rows);
    const single = { ...s, spacing: 1 };
    const double = { ...s, spacing: 2 };
    // The table is for word counts; next to pasted text's own figures it would contradict them.
    if (mode === "text") {
      ref.replaceChildren();
      return;
    }
    ref.replaceChildren(
      h("h3", null, t(`${S}.tableTitle`, { font: FONT_METRICS[s.font].name, size: nf(1).format(s.size) })),
      table([t(`${S}.colWords`), t(`${S}.sp_1`), t(`${S}.sp_2`)],
        TABLE_WORDS.map((w) => [nf(0).format(w), nf(1).format(Math.round(pagesForWords(w, single) * 10) / 10), nf(1).format(Math.round(pagesForWords(w, double) * 10) / 10)])),
    );
  }

  /** An estimate to the nearest ten words, or to the word below a hundred (0.1 page is not "0 words"). */
  const roundWords = (w: number) => (w >= 100 ? Math.round(w / 10) * 10 : Math.max(1, Math.round(w)));

  /** "Fills 3 pages, the last one about 80 % full." */
  function fillNote(exact: number): string {
    // From the same one-decimal figure the result row shows, so "2" pages never comes with "runs onto page 3".
    const pages = Math.round(exact * 10) / 10 || exact;
    const whole = Math.ceil(pages - 1e-9);
    const last = Math.round((pages - (whole - 1)) * 100);
    return whole <= 0 ? "" : t(`${S}.fill`, { n: nf(0).format(whole), pct: String(Math.min(100, Math.max(1, last))) });
  }

  function empty(message: string): void {
    out.replaceChildren(h("p", { class: "muted" }, message));
    ref.replaceChildren();
    last = "";
    copy.disabled = true;
  }

  layout(host, S, [
    field(t(`${S}.mode`), modeSel),
    wordsField, pagesField, textField,
    field(t(`${S}.font`), fontSel),
    field(t(`${S}.size`), sizeSel),
    field(t(`${S}.spacing`), spacingSel),
    field(t(`${S}.paper`), paperSel),
    field(t(`${S}.margin`), marginSel),
    h("label", { class: "field ac-check" }, indent, h("span", null, t(`${S}.indent`))),
    h("p", { class: "hint" }, t(`${S}.inputHint`)),
  ], [copy],
  [out, note, ref, h("p", { class: "hint" }, t(`${S}.method`))]);
  sync();
  paint();
}

export function unmountWordsToPages(): void {
  window.clearTimeout(timer);
}
