import { copyWithFlash } from "../copy";
import { h } from "../dom";
import { locale, t } from "../i18n";
import { currency, labeled, numField } from "../valuation/common";
import { ASSET_FIELDS, DEBT_FIELDS, SCF_2022, ageBand, netWorth, type AssetField, type DebtField } from "../../shared/net-worth";
import { parseDecimalInput, parseMoneyInput } from "../../shared/decimal-input";
import { plain } from "../../shared/number-format";

let mounted: { cleanup: () => void } | null = null;

const START: Partial<Record<AssetField | DebtField, string>> = {
  cash: "15000", investments: "40000", retirement: "60000", home: "350000", vehicles: "20000",
  mortgage: "250000", carLoans: "8000", cards: "2000",
};

export function mountNetWorth(host: HTMLElement): void {
  unmountNetWorth();
  const loc = locale();
  let last = "";
  let copyBtn: HTMLButtonElement | null = null;
  const fields = new Map<string, HTMLInputElement>();
  const field = (id: AssetField | DebtField) => {
    const el = numField(id, START[id] ?? "", () => paint());
    el.placeholder = "0";
    fields.set(id, el);
    return labeled(t(`netWorth.${id}`), el);
  };
  const age = numField("age", "", () => paint());
  age.inputMode = "numeric";
  // The U.S. figures are in dollars: other currencies are compared through a rate the user types.
  const curSel = h("select", { "data-field": "currency", onChange: () => { rateField.hidden = curSel.value === "usd"; paint(); } },
    h("option", { value: "usd", selected: loc === "en" }, t("netWorth.cur_usd")),
    h("option", { value: "other", selected: loc !== "en" }, t("netWorth.cur_other")),
  );
  curSel.value = loc === "en" ? "usd" : "other";
  const rate = numField("rate", "", () => paint());
  const rateField = labeled(t("netWorth.rate"), rate);
  rateField.hidden = curSel.value === "usd";
  const errorEl = h("p", { class: "hint", "aria-live": "polite", "data-out": "error" });
  const mainEl = h("p", { class: "shape-main", "data-out": "net" });
  const rows = h("dl", { class: "stats-grid", "data-out": "rows" });
  const compare = h("dl", { class: "stats-grid", "data-out": "compare" });
  const rateHint = h("p", { class: "hint", "data-out": "need-rate", hidden: true }, t("netWorth.needRate"));
  const money = (n: number) => plain(loc, Math.round(n));

  const paint = () => {
    const read = <K extends string>(ids: readonly K[]) => {
      const o: Partial<Record<K, number>> = {};
      const bad: K[] = [];
      for (const id of ids) {
        const v = parseMoneyInput(fields.get(id)!.value, loc);
        if (v === undefined) continue;
        if (Number.isNaN(v)) bad.push(id);
        else o[id] = v;
      }
      return { o, bad };
    };
    const a = read(ASSET_FIELDS);
    const d = read(DEBT_FIELDS);
    const ageRaw = parseDecimalInput(age.value, loc);
    const bad: string[] = [...a.bad, ...d.bad, ...(ageRaw !== undefined && Number.isNaN(ageRaw) ? ["age"] : [])];
    rows.replaceChildren();
    compare.replaceChildren();
    rateHint.hidden = true;
    if (bad.length) {
      mainEl.textContent = "";
      last = "";
      errorEl.textContent = t("netWorth.err_number", { field: t(`netWorth.${bad[0]}`) });
      return;
    }
    errorEl.textContent = "";
    const r = netWorth(a.o, d.o);
    mainEl.textContent = money(r.netWorth);
    mainEl.classList.toggle("val-negative", r.netWorth < 0);
    const list: Array<[string, string]> = [
      [t("netWorth.totalAssets"), money(r.assets)],
      [t("netWorth.totalDebts"), money(r.debts)],
      [t("netWorth.net"), money(r.netWorth)],
    ];
    if (r.debtToAsset !== null) list.push([t("netWorth.debtRatio"), `${plain(loc, r.debtToAsset * 100, 1)}%`]);
    rows.append(...list.flatMap(([k, v]) => [h("dt", null, k), h("dd", null, v)]));
    last = list.map(([k, v]) => `${k}: ${v}`).join("\n");
    const band = ageRaw === undefined ? null : ageBand(ageRaw);
    if (ageRaw !== undefined && !band) compare.append(h("dt", null, t("netWorth.ageRange")), h("dd", null, ""));
    const perUsd = curSel.value === "usd" ? 1 : parseMoneyInput(rate.value, loc);
    if (band && (perUsd === undefined || !Number.isFinite(perUsd) || perUsd <= 0)) {
      rateHint.hidden = false;
    } else if (band && perUsd !== undefined) {
      const ref = SCF_2022[band];
      const usd = (n: number) => currency(loc, "USD", n);
      const cmp: Array<[string, string]> = [
        [t("netWorth.median"), usd(ref.median)],
        [t("netWorth.mean"), usd(ref.mean)],
      ];
      if (perUsd !== 1) cmp.push([t("netWorth.inUsd"), usd(r.netWorth / perUsd)]);
      cmp.push([t("netWorth.vsMedian"), r.netWorth / perUsd >= ref.median ? t("netWorth.above") : t("netWorth.below")]);
      compare.append(h("dt", { class: "hint" }, t(`netWorth.band_${band}`)), h("dd", null, ""), ...cmp.flatMap(([k, v]) => [h("dt", null, k), h("dd", null, v)]));
      last += `\n${t(`netWorth.band_${band}`)}\n${cmp.map(([k, v]) => `${k}: ${v}`).join("\n")}`;
    }
  };

  host.append(
    h("header", { class: "tool-head" },
      h("h1", null, t("netWorth.title")),
      h("p", { class: "lede" }, t("netWorth.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null, h("legend", null, t("netWorth.assets")), ...ASSET_FIELDS.map(field)),
        h("fieldset", null, h("legend", null, t("netWorth.debts")), ...DEBT_FIELDS.map(field)),
        labeled(t("netWorth.age"), age),
        labeled(t("netWorth.currency"), curSel),
        rateField,
        h("div", { class: "stage-actions" },
          h("button", { type: "button", class: "btn ghost", "data-action": "clear", onClick: () => { for (const el of fields.values()) el.value = ""; paint(); } }, t("netWorth.clear")),
          copyBtn = h("button", { type: "button", class: "btn ghost", "data-action": "copy", onClick: () => void copyWithFlash(copyBtn, last, { done: t("valuation.copied"), failed: t("valuation.copyFailed") }) }, t("valuation.copy")),
        ),
      ),
      h("div", { class: "rail" },
        errorEl,
        h("p", { class: "hint" }, t("netWorth.net")),
        mainEl,
        rows,
        h("h2", null, t("netWorth.compare")),
        compare,
        rateHint,
        h("p", { class: "hint" }, t("netWorth.source")),
      ),
    ),
  );
  paint();
  mounted = { cleanup: () => { copyBtn = null; } };
}

export function unmountNetWorth(): void {
  mounted?.cleanup();
  mounted = null;
}
