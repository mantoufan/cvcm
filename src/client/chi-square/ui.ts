import { h } from "../dom";
import { t } from "../i18n";
import { apa2, apaP, apaUnit, chiGoodness, chiIndependence, type ChiResult } from "../../shared/academic-stats";
import { copyButton, field, fmt, fmtP, layout, readNum, rowsTo, select, table } from "../academic/common";

const S = "chiSquare";
type Mode = "independence" | "goodness";
const SIZES = ["2", "3", "4", "5", "6", "7", "8"] as const;
const CATS = ["2", "3", "4", "5", "6", "7", "8", "9", "10"] as const;
const ALPHAS = ["0.01", "0.05", "0.1"] as const;

/** Example counts the page opens with (fixed, rule 8). */
export const START_TABLE = [[20, 15], [30, 35]];
const START_OBSERVED = [18, 22, 30, 30];

export function mountChiSquare(host: HTMLElement): void {
  let last = "";
  const paint = () => draw();
  const modeSel = select<Mode>("mode", ["independence", "goodness"], (m) => t(`${S}.m_${m}`), () => { build(); paint(); }, "independence");
  const rowsSel = select("rows", SIZES, (n) => n, () => { build(); paint(); }, "2");
  const colsSel = select("cols", SIZES, (n) => n, () => { build(); paint(); }, "2");
  const catsSel = select("cats", CATS, (n) => n, () => { build(); paint(); }, "4");
  const expSel = select("expected", ["equal", "custom"], (e) => t(`${S}.e_${e}`), () => { build(); paint(); }, "equal");
  const yates = h("input", { type: "checkbox", "data-field": "yates", onChange: paint });
  const alphaSel = select("alpha", ALPHAS, (a) => fmt(Number(a), 2), paint, "0.05");
  const rowsField = field(t(`${S}.rows`), rowsSel);
  const colsField = field(t(`${S}.cols`), colsSel);
  const catsField = field(t(`${S}.cats`), catsSel);
  const expField = field(t(`${S}.expectedMode`), expSel);
  const yatesField = h("label", { class: "field ac-check" }, yates, h("span", null, t(`${S}.yates`)));
  const grid = h("div", { class: "table-wrap ac-grid", "data-out": "grid" });
  const out = h("dl", { class: "stats-grid", "data-out": "result" });
  const warn = h("p", { class: "hint", "data-out": "warn" });
  const apa = h("p", { class: "si-formula", "data-out": "apa" });
  const expected = h("div", { class: "table-wrap", "data-out": "expected" });
  const copy = copyButton(S, () => last);

  /** Values typed so far, kept by cell key so resizing the table keeps them. */
  const kept = new Map<string, string>();
  START_TABLE.forEach((row, i) => row.forEach((v, j) => kept.set(`t${i}-${j}`, String(v))));
  START_OBSERVED.forEach((v, j) => kept.set(`o${j}`, String(v)));
  let cells = new Map<string, HTMLInputElement>();

  const cell = (key: string, label: string): HTMLInputElement => {
    const el = h("input", { type: "text", inputmode: "decimal", autocomplete: "off", class: "ac-cell", "data-cell": key, "aria-label": label, value: kept.get(key) ?? "", onInput: () => { kept.set(key, el.value); paint(); } });
    cells.set(key, el);
    return el;
  };

  function build(): void {
    const mode = modeSel.value as Mode;
    rowsField.hidden = colsField.hidden = yatesField.hidden = mode !== "independence";
    catsField.hidden = expField.hidden = mode !== "goodness";
    cells = new Map();
    grid.replaceChildren(h("h3", null, t(`${S}.dataTitle`)));
    if (mode === "independence") {
      const r = Number(rowsSel.value);
      const c = Number(colsSel.value);
      yatesField.hidden = !(r === 2 && c === 2);
      grid.append(h("table", { class: "si-table" },
        h("thead", null, h("tr", null, h("th", null, ""), ...Array.from({ length: c }, (_, j) => h("th", null, t(`${S}.col`, { n: j + 1 }))))),
        h("tbody", null, ...Array.from({ length: r }, (_, i) => h("tr", null,
          h("th", null, t(`${S}.row`, { n: i + 1 })),
          ...Array.from({ length: c }, (_, j) => h("td", null, cell(`t${i}-${j}`, `${t(`${S}.row`, { n: i + 1 })}, ${t(`${S}.col`, { n: j + 1 })}`))))))));
    } else {
      const k = Number(catsSel.value);
      const custom = expSel.value === "custom";
      grid.append(h("table", { class: "si-table" },
        h("thead", null, h("tr", null, h("th", null, t(`${S}.category`)), h("th", null, t(`${S}.observed`)), ...(custom ? [h("th", null, t(`${S}.expectedShare`))] : []))),
        h("tbody", null, ...Array.from({ length: k }, (_, j) => h("tr", null,
          h("th", null, String(j + 1)),
          h("td", null, cell(`o${j}`, `${t(`${S}.observed`)} ${j + 1}`)),
          ...(custom ? [h("td", null, cell(`e${j}`, `${t(`${S}.expectedShare`)} ${j + 1}`))] : [])))),
      ));
    }
  }

  // Counts are read as counts (es/id/vi "1.000" is a thousand); expected shares may be decimals ("0,25").
  const val = (key: string) => {
    const el = cells.get(key);
    return el ? readNum(el, !key.startsWith("e")) : undefined;
  };

  function draw(): void {
    const mode = modeSel.value as Mode;
    let r: ChiResult | null = null;
    let rowsN = 1;
    let colsN = 0;
    if (mode === "independence") {
      rowsN = Number(rowsSel.value);
      colsN = Number(colsSel.value);
      const tbl = Array.from({ length: rowsN }, (_, i) => Array.from({ length: colsN }, (_, j) => val(`t${i}-${j}`) ?? NaN));
      r = chiIndependence(tbl, yates.checked);
    } else {
      colsN = Number(catsSel.value);
      const obs = Array.from({ length: colsN }, (_, j) => val(`o${j}`) ?? NaN);
      const exp = expSel.value === "custom" ? Array.from({ length: colsN }, (_, j) => val(`e${j}`) ?? NaN) : undefined;
      r = chiGoodness(obs, exp);
    }
    expected.replaceChildren();
    if (!r) {
      // Name the field that is wrong: valid counts with a bad custom share get the shares message.
      const badShares = mode === "goodness" && expSel.value === "custom"
        && chiGoodness(Array.from({ length: colsN }, (_, j) => val(`o${j}`) ?? NaN)) !== null;
      out.replaceChildren(h("p", { class: "muted" }, t(badShares ? `${S}.sharesInvalid` : `${S}.invalid`)));
      warn.textContent = apa.textContent = "";
      last = "";
      copy.disabled = true;
      return;
    }
    copy.disabled = false;
    const rows: [string, string, boolean?][] = [
      [t(`${S}.chi2`), fmt(r.chi2, 4), true],
      [t(`${S}.df`), String(r.df)],
      [t(`${S}.p`), fmtP(r.p), true],
      [t(`${S}.n`), fmt(r.n, 2)],
    ];
    if (r.v !== null) rows.push([t(`${S}.v`), fmt(r.v, 4)]);
    const lines = rowsTo(out, rows);
    warn.textContent = r.lowExpected > 0.2 || r.minExpected < 1 ? t(`${S}.lowExpected`, { share: Math.round(r.lowExpected * 100), min: fmt(r.minExpected, 2) }) : "";
    const alpha = Number(alphaSel.value);
    const sig = t(r.p < alpha ? `${S}.significant` : `${S}.notSignificant`, { alpha: fmt(alpha, 2) });
    // A Yates-corrected statistic is labelled, so a pasted report never passes it off as Pearson's χ².
    const yatesNote = r.yates ? ` (${t(`${S}.yatesApplied`)})` : "";
    apa.textContent = `${sig} ${t(`${S}.apaLabel`)} χ²(${r.df}, N = ${r.n}) = ${apa2(r.chi2)}${yatesNote}, ${apaP(r.p)}${r.v !== null ? `, V = ${apaUnit(r.v)}` : ""}`;
    last = [lines, warn.textContent, apa.textContent].filter(Boolean).join("\n");
    const head = mode === "independence"
      ? ["", ...Array.from({ length: colsN }, (_, j) => t(`${S}.col`, { n: j + 1 }))]
      : [t(`${S}.category`), ...Array.from({ length: colsN }, (_, j) => String(j + 1))];
    const body = r.expected.map((row, i) => [mode === "independence" ? t(`${S}.row`, { n: i + 1 }) : t(`${S}.expected`), ...row.map((e) => fmt(e, 2))]);
    expected.append(h("h3", null, t(`${S}.expectedTitle`)), table(head, body));
  }

  layout(host, S, [
    field(t(`${S}.mode`), modeSel),
    rowsField,
    colsField,
    catsField,
    expField,
    yatesField,
    field(t(`${S}.alpha`), alphaSel),
    h("p", { class: "hint" }, t(`${S}.hint`)),
  ], [copy], [grid, out, warn, apa, expected]);
  build();
  draw();
}

export function unmountChiSquare(): void {}
