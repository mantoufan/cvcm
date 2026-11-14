import { copyWithFlash } from "../copy";
import { h } from "../dom";
import { locale, t } from "../i18n";
import { labeled } from "../valuation/common";
import { featureText, paintEstimate } from "../valuation/result";
import { PLATE_MARKETS, guessPlateMarket, normalizePlate, valuePlate, type PlateMarket } from "../../shared/plate-value";

let mounted: { cleanup: () => void } | null = null;

const EXAMPLE: Record<PlateMarket, string> = { uk: "AB 1", vn: "30K-686.86", cn: "粤B·88866" };
const PRESETS: Record<PlateMarket, string[]> = {
  uk: ["1 A", "ABC 1", "A1 ABC", "AB12 CDE"],
  vn: ["51K-888.88", "30A-123.45", "29A-686.86", "30E-123.67"],
  cn: ["京A·88888", "沪A·12345", "粤B·66688", "浙A·D12345"],
};

export function mountPlateValue(host: HTMLElement): void {
  unmountPlateValue();
  const loc = locale();
  let market: PlateMarket = loc === "zh-CN" || loc === "zh-TW" ? "cn" : loc === "vi" ? "vn" : "uk";
  let picked = false;
  let last = "";
  let copyBtn: HTMLButtonElement | null = null;

  const input = h("input", {
    type: "text",
    autocomplete: "off",
    spellcheck: "false",
    autocapitalize: "characters",
    "data-field": "plate",
    value: EXAMPLE[market],
    "aria-label": t("plateValue.input"),
    onInput: () => {
      // Switch only when the current country cannot read a plate that looks complete and the guess can, so a
      // half-typed 30K… is not taken for a UK mark on the way.
      if (!picked && normalizePlate(input.value).length >= 6 && !valuePlate(input.value, market).ok) {
        const guess = guessPlateMarket(input.value, market);
        if (guess !== market && valuePlate(input.value, guess).ok) {
          market = guess;
          marketSel.value = market;
          paintPresets();
        }
      }
      paint();
    },
  });
  const marketSel = h("select", { "data-field": "market", onChange: () => {
    picked = true;
    const before = market;
    market = marketSel.value as PlateMarket;
    // Keep a plate the user typed; swap only an empty field or the last country's example.
    if (!input.value.trim() || input.value === EXAMPLE[before]) input.value = EXAMPLE[market];
    paintPresets();
    paint();
  } }, ...PLATE_MARKETS.map((m) => h("option", { value: m, selected: m === market }, t(`plateValue.m_${m}`))));
  marketSel.value = market;
  const presets = h("div", { class: "stage-actions", "data-out": "presets" });
  const errorEl = h("p", { class: "hint", "aria-live": "polite", "data-out": "error" });
  const out = h("div", { class: "val-out", "data-out": "result" });
  const note = h("p", { class: "hint", "data-out": "note" });

  const paintPresets = () => {
    presets.replaceChildren(...PRESETS[market].map((p) =>
      h("button", { type: "button", class: "btn ghost", "data-preset": p, onClick: () => { input.value = p; paint(); } }, p)));
  };

  const paint = () => {
    note.textContent = t(`plateValue.note_${market}`);
    const r = valuePlate(input.value, market);
    if (!r.ok) {
      out.replaceChildren();
      last = "";
      errorEl.textContent = t(r.error === "empty" ? "plateValue.err_empty" : `plateValue.err_invalid_${market}`);
      return;
    }
    errorEl.textContent = "";
    const v = r.value;
    last = paintEstimate(out, loc, {
      title: t("plateValue.estimateFor", { plate: input.value.trim().toUpperCase() }),
      estimate: v.estimate,
      low: v.low,
      high: v.high,
      currency: v.currency,
      score: v.score,
      tierLabel: t("valuation.tierLine", { tier: t(`valuation.tier_${Math.min(6, v.tier)}`) }),
      lines: v.features.map((f) =>
        f.key === "ukFormat" ? t("valuation.f_ukFormat", { format: t(`plateValue.uk_${f.format}`), length: f.length }) : featureText(f)),
    });
  };

  host.append(
    h("header", { class: "tool-head" },
      h("h1", null, t("plateValue.title")),
      h("p", { class: "lede" }, t("plateValue.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        labeled(t("plateValue.market"), marketSel),
        labeled(t("plateValue.input"), input),
        h("p", { class: "hint" }, t("plateValue.hint")),
        presets,
        h("div", { class: "stage-actions" },
          copyBtn = h("button", { type: "button", class: "btn ghost", "data-action": "copy", onClick: () => void copyWithFlash(copyBtn, last, { done: t("valuation.copied"), failed: t("valuation.copyFailed") }) }, t("valuation.copy")),
        ),
        h("p", { class: "hint" }, t("plateValue.disclaimer")),
      ),
      h("div", { class: "rail" }, errorEl, out, note),
    ),
  );
  paintPresets();
  paint();
  mounted = { cleanup: () => { copyBtn = null; } };
}

export function unmountPlateValue(): void {
  mounted?.cleanup();
  mounted = null;
}
