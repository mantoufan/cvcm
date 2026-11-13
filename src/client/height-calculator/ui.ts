import { copyWithFlash } from "../copy";
import { h } from "../dom";
import { locale, t } from "../i18n";
import { parseDecimalInput } from "../../shared/decimal-input";
import {
  MAX_AGE_MONTHS,
  MIN_AGE_MONTHS,
  SEX_OFFSET_CM,
  TARGET_RANGE_CM,
  fromFeetInches,
  midParental,
  percentileProjection,
  toFeetInches,
  type Sex,
} from "../../shared/height";

type System = "metric" | "imperial";
type HeightId = "father" | "mother" | "child";
const HEIGHTS: readonly HeightId[] = ["father", "mother", "child"];
/** Sensible bounds, so a typo (17.8 for 178) is caught rather than projected. */
const ADULT_CM = [120, 230] as const;
const CHILD_CM = [60, 220] as const;

let mounted: { cleanup: () => void } | null = null;

/** Rounded to one decimal, as the page shows heights. */
const round1 = (n: number) => Math.round(n * 10) / 10;

export function mountHeight(host: HTMLElement): void {
  unmountHeight();
  const loc = locale();
  const nf1 = new Intl.NumberFormat(loc, { maximumFractionDigits: 1 });
  const nf0 = new Intl.NumberFormat(loc, { maximumFractionDigits: 0 });
  const nf2 = new Intl.NumberFormat(loc, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  let system: System = loc === "en" ? "imperial" : "metric";
  let last = "";
  let copyBtn: HTMLButtonElement | null = null;
  /** Heights in cm as last read, so switching units converts them. */
  const startCm: Record<HeightId, number | null> = { father: 178, mother: 165, child: 138 };

  const num = (field: string, value: string, label: string) => h("input", {
    type: "text",
    inputmode: "decimal",
    autocomplete: "off",
    "data-field": field,
    value,
    "aria-label": label,
    onInput: () => paint(),
  });
  const inputs = {} as Record<HeightId, { cm: HTMLInputElement; ft: HTMLInputElement; inch: HTMLInputElement; wrap: HTMLElement }>;
  for (const id of HEIGHTS) {
    const cm = num(`${id}-cm`, "", `${t(`heightCalculator.${id}`)} (cm)`);
    const ft = num(`${id}-ft`, "", `${t(`heightCalculator.${id}`)} (ft)`);
    const inch = num(`${id}-in`, "", `${t(`heightCalculator.${id}`)} (in)`);
    const wrap = h("div", { class: "height-input" });
    inputs[id] = { cm, ft, inch, wrap };
  }
  const sexSel = h("select", { "data-field": "sex", onChange: () => paint() },
    h("option", { value: "boy", selected: true }, t("heightCalculator.boy")),
    h("option", { value: "girl" }, t("heightCalculator.girl")),
  );
  const systemSel = h("select", { "data-field": "system", onChange: () => {
    const cms = Object.fromEntries(HEIGHTS.map((id) => [id, readCm(id)])) as Record<HeightId, number | null | undefined>;
    system = systemSel.value as System;
    for (const id of HEIGHTS) writeCm(id, typeof cms[id] === "number" ? cms[id] : null);
    layout();
    paint();
  } },
    h("option", { value: "metric", selected: system === "metric" }, t("heightCalculator.metric")),
    h("option", { value: "imperial", selected: system === "imperial" }, t("heightCalculator.imperial")),
  );
  const years = num("years", "10", t("heightCalculator.years"));
  const months = num("months", "0", t("heightCalculator.months"));
  const errorEl = h("p", { class: "hint", "aria-live": "polite", "data-out": "error" });
  const mainEl = h("p", { class: "shape-main", "data-out": "main" });
  const rowsEl = h("dl", { class: "stats-grid", "data-out": "rows" });
  const workEl = h("ol", { class: "factor-steps", "data-out": "working" });

  const fmtCm = (cm: number) => (system === "metric" ? `${nf1.format(round1(cm))} cm` : (() => {
    const { ft, inch } = toFeetInches(cm);
    return `${ft} ft ${nf1.format(inch)} in`;
  })());
  /** Both systems: "178 cm (5 ft 10.1 in)" or "5 ft 10.1 in (178 cm)". */
  const both = (cm: number) => {
    const { ft, inch } = toFeetInches(cm);
    const imp = `${ft} ft ${nf1.format(inch)} in`;
    const met = `${nf1.format(round1(cm))} cm`;
    return system === "metric" ? `${met} (${imp})` : `${imp} (${met})`;
  };

  /** The exact cm behind fields the page itself filled in, so converting units back and forth does not drift. */
  const written: Partial<Record<HeightId, { cm: number; sig: string }>> = {};
  const sigOf = (id: HeightId) => `${system}|${inputs[id].cm.value}|${inputs[id].ft.value}|${inputs[id].inch.value}`;

  /** cm from the fields: null when empty, NaN when not a number. */
  function readCm(id: HeightId): number | null {
    const f = inputs[id];
    const w = written[id];
    if (w && w.sig === sigOf(id)) return w.cm;
    if (system === "metric") {
      const v = parseDecimalInput(f.cm.value, loc);
      return v === undefined ? null : v;
    }
    const ft = parseDecimalInput(f.ft.value, loc);
    const inch = parseDecimalInput(f.inch.value, loc);
    if (ft === undefined && inch === undefined) return null;
    if (Number.isNaN(ft) || Number.isNaN(inch) || (ft ?? 0) < 0 || (inch ?? 0) < 0) return NaN;
    return fromFeetInches(ft ?? 0, inch ?? 0);
  }

  function writeCm(id: HeightId, cm: number | null): void {
    const f = inputs[id];
    if (cm === null || !Number.isFinite(cm)) {
      f.cm.value = f.ft.value = f.inch.value = "";
      delete written[id];
      return;
    }
    f.cm.value = nf1.format(round1(cm)).replace(/\s/g, "");
    const { ft, inch } = toFeetInches(cm);
    f.ft.value = String(ft);
    f.inch.value = nf1.format(inch);
    written[id] = { cm, sig: sigOf(id) };
  }

  const layout = () => {
    for (const id of HEIGHTS) {
      const f = inputs[id];
      f.wrap.replaceChildren(...(system === "metric"
        ? [h("span", { class: "height-unit" }, f.cm, h("small", null, "cm"))]
        : [h("span", { class: "height-unit" }, f.ft, h("small", null, "ft")), h("span", { class: "height-unit" }, f.inch, h("small", null, "in"))]));
    }
  };

  const paint = () => {
    rowsEl.replaceChildren();
    workEl.replaceChildren();
    mainEl.textContent = "";
    last = "";
    const sex = sexSel.value as Sex;
    const father = readCm("father");
    const mother = readCm("mother");
    const fail = (msg: string) => {
      errorEl.textContent = msg;
    };
    for (const [id, v] of [["father", father], ["mother", mother]] as const) {
      if (v === null) return fail(t("heightCalculator.err_parents"));
      if (Number.isNaN(v)) return fail(t("heightCalculator.err_number", { field: t(`heightCalculator.${id}`) }));
      if (v < ADULT_CM[0] || v > ADULT_CM[1]) return fail(t("heightCalculator.err_range", { field: t(`heightCalculator.${id}`), min: fmtCm(ADULT_CM[0]), max: fmtCm(ADULT_CM[1]) }));
    }
    const mp = midParental(father!, mother!, sex);
    const rows: Array<[string, string]> = [
      [t("heightCalculator.midParental"), both(mp.cm)],
      [t("heightCalculator.range"), `${fmtCm(mp.low)} – ${fmtCm(mp.high)}`],
    ];
    const working = [
      t(sex === "boy" ? "heightCalculator.stepBoy" : "heightCalculator.stepGirl", { father: nf1.format(round1(father!)), mother: nf1.format(round1(mother!)), offset: nf1.format(SEX_OFFSET_CM * 2), result: nf1.format(round1(mp.cm)) }),
      t("heightCalculator.stepRange", { range: nf1.format(TARGET_RANGE_CM) }),
    ];
    let main = t("heightCalculator.mainParents", { height: both(mp.cm) });
    errorEl.textContent = "";
    // The child's own height is optional: with it, the CDC chart projection is added.
    const child = readCm("child");
    const y = parseDecimalInput(years.value, loc);
    const m = parseDecimalInput(months.value, loc) ?? 0;
    if (child !== null) {
      const ageMonths = (y ?? NaN) * 12 + m;
      if (Number.isNaN(child)) fail(t("heightCalculator.err_number", { field: t("heightCalculator.child") }));
      else if (child < CHILD_CM[0] || child > CHILD_CM[1]) fail(t("heightCalculator.err_range", { field: t("heightCalculator.child"), min: fmtCm(CHILD_CM[0]), max: fmtCm(CHILD_CM[1]) }));
      else if (!Number.isFinite(ageMonths) || !Number.isInteger(m) || m < 0 || m > 11) fail(t("heightCalculator.err_age"));
      else if (ageMonths < MIN_AGE_MONTHS || ageMonths > MAX_AGE_MONTHS) fail(t("heightCalculator.err_age"));
      else {
        // CDC rows are for the middle of a month of age: completed months + 0.5.
        const p = percentileProjection(sex, ageMonths + 0.5, child);
        const pct = p.percentile < 1 ? "<1" : p.percentile > 99 ? ">99" : nf0.format(Math.round(p.percentile));
        rows.push(
          [t("heightCalculator.percentile"), t("heightCalculator.pctValue", { pct, z: nf2.format(p.z) })],
          [t("heightCalculator.projection"), both(p.adultCm)],
        );
        working.push(t("heightCalculator.stepPercentile", { pct, z: nf2.format(p.z), result: nf1.format(round1(p.adultCm)) }));
        main = t("heightCalculator.mainBoth", { parents: fmtCm(mp.cm), chart: fmtCm(p.adultCm) });
        if (p.adultCm < mp.low || p.adultCm > mp.high) working.push(t("heightCalculator.outside"));
      }
    }
    mainEl.textContent = main;
    rowsEl.append(...rows.flatMap(([k, v]) => [h("dt", null, k), h("dd", null, v)]));
    workEl.append(...working.map((w) => h("li", null, w)));
    last = [main, ...rows.map(([k, v]) => `${k}: ${v}`), ...working].join("\n");
  };

  const field = (label: string, ...kids: Node[]) => h("label", { class: "field" }, h("span", null, label), ...kids);
  for (const id of HEIGHTS) writeCm(id, startCm[id]);
  layout();

  host.append(
    h("header", { class: "tool-head" },
      h("h1", null, t("heightCalculator.title")),
      h("p", { class: "lede" }, t("heightCalculator.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        field(t("heightCalculator.units"), systemSel),
        field(t("heightCalculator.sex"), sexSel),
        h("fieldset", null,
          h("legend", null, t("heightCalculator.parents")),
          h("div", { class: "field" }, h("span", null, t("heightCalculator.father")), inputs.father.wrap),
          h("div", { class: "field" }, h("span", null, t("heightCalculator.mother")), inputs.mother.wrap),
        ),
        h("fieldset", null,
          h("legend", null, t("heightCalculator.childNow")),
          h("div", { class: "height-age" }, field(t("heightCalculator.years"), years), field(t("heightCalculator.months"), months)),
          h("div", { class: "field" }, h("span", null, t("heightCalculator.child")), inputs.child.wrap),
          h("p", { class: "hint" }, t("heightCalculator.childHint")),
        ),
        h("div", { class: "stage-actions" },
          copyBtn = h("button", { type: "button", class: "btn ghost", "data-action": "copy", onClick: () => void copyWithFlash(copyBtn, last, { done: t("heightCalculator.copied"), failed: t("heightCalculator.copyFailed") }) }, t("heightCalculator.copy")),
        ),
      ),
      h("div", { class: "rail" },
        errorEl,
        mainEl,
        rowsEl,
        h("h3", null, t("heightCalculator.steps")),
        workEl,
        h("p", { class: "hint" }, t("heightCalculator.disclaimer")),
      ),
    ),
  );
  paint();
  mounted = { cleanup: () => { copyBtn = null; } };
}

export function unmountHeight(): void {
  mounted?.cleanup();
  mounted = null;
}
