import { copyWithFlash } from "../copy";
import { h } from "../dom";
import { locale, t } from "../i18n";
import { labeled } from "../valuation/common";
import { featureText, paintEstimate } from "../valuation/result";
import { PHONE_MARKETS, guessMarket, valuePhone, type PhoneMarket } from "../../shared/phone-value";

let mounted: { cleanup: () => void } | null = null;

const EXAMPLE: Record<PhoneMarket, string> = { cn: "138 8888 6688", vn: "0903 686868", intl: "+1 212 555 0000" };

export function mountPhoneValue(host: HTMLElement): void {
  unmountPhoneValue();
  const loc = locale();
  let market: PhoneMarket = loc === "zh-CN" ? "cn" : loc === "vi" ? "vn" : "intl";
  let last = "";
  let copyBtn: HTMLButtonElement | null = null;
  // The market follows the number until it is picked by hand.
  let picked = false;

  const input = h("input", {
    type: "text",
    inputmode: "tel",
    autocomplete: "off",
    spellcheck: "false",
    "data-field": "number",
    value: EXAMPLE[market],
    "aria-label": t("phoneValue.input"),
    onInput: () => {
      if (!picked) {
        market = guessMarket(input.value, market);
        marketSel.value = market;
      }
      paint();
    },
  });
  const marketSel = h("select", { "data-field": "market", onChange: () => { picked = true; market = marketSel.value as PhoneMarket; paint(); } },
    ...PHONE_MARKETS.map((m) => h("option", { value: m, selected: m === market }, t(`phoneValue.m_${m}`))),
  );
  marketSel.value = market;
  const errorEl = h("p", { class: "hint", "aria-live": "polite", "data-out": "error" });
  const out = h("div", { class: "val-out", "data-out": "result" });
  const extra = h("dl", { class: "stats-grid", "data-out": "extra" });

  const paint = () => {
    const r = valuePhone(input.value, market);
    extra.replaceChildren();
    if (!r.ok) {
      out.replaceChildren();
      last = "";
      errorEl.textContent = t(r.error === "empty" ? "phoneValue.err_empty" : `phoneValue.err_invalid_${market}`);
      return;
    }
    errorEl.textContent = "";
    const v = r.value;
    last = paintEstimate(out, loc, {
      title: t("phoneValue.estimateFor", { number: v.digits }),
      estimate: v.estimate,
      low: v.low,
      high: v.high,
      currency: v.currency,
      score: v.score,
      tierLabel: t("valuation.tierLine", { tier: t(`valuation.tier_${v.tier}`) }),
      lines: v.features.map((f) => featureText(f as never)),
    });
    if (v.numerology) {
      const reading = t(v.numerology.good ? "phoneValue.lucky" : "phoneValue.unlucky");
      extra.append(h("dt", null, t("phoneValue.numerology")), h("dd", { "data-out": "numerology" }, `${v.numerology.n} · ${reading}`));
      last += `\n${t("phoneValue.numerology")}: ${v.numerology.n} · ${reading}`;
    }
    if (v.nut !== null) {
      extra.append(h("dt", null, t("phoneValue.nut")), h("dd", { "data-out": "nut" }, t("phoneValue.nutValue", { n: v.nut })));
      last += `\n${t("phoneValue.nut")}: ${t("phoneValue.nutValue", { n: v.nut })}`;
    }
  };

  host.append(
    h("header", { class: "tool-head" },
      h("h1", null, t("phoneValue.title")),
      h("p", { class: "lede" }, t("phoneValue.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        labeled(t("phoneValue.input"), input),
        labeled(t("phoneValue.market"), marketSel),
        h("p", { class: "hint" }, t("phoneValue.hint")),
        h("div", { class: "stage-actions" },
          copyBtn = h("button", { type: "button", class: "btn ghost", "data-action": "copy", onClick: () => void copyWithFlash(copyBtn, last, { done: t("valuation.copied"), failed: t("valuation.copyFailed") }) }, t("valuation.copy")),
        ),
        h("p", { class: "hint" }, t("phoneValue.disclaimer")),
      ),
      h("div", { class: "rail" }, errorEl, out, extra),
    ),
  );
  paint();
  mounted = { cleanup: () => { copyBtn = null; } };
}

export function unmountPhoneValue(): void {
  mounted?.cleanup();
  mounted = null;
}
