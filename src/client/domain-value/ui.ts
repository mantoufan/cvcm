import { copyWithFlash } from "../copy";
import { h } from "../dom";
import { locale, t } from "../i18n";
import { labeled } from "../valuation/common";
import { paintEstimate } from "../valuation/result";
import { valueDomain, type DomainFeature } from "../../shared/domain-value";
import { numberFormat } from "../../shared/number-format";

let mounted: { cleanup: () => void } | null = null;

const PRESETS = ["cloudkitchen.com", "lumo.com", "8888.com", "aibot.ai", "my-best-shop-online.net"];

export function mountDomainValue(host: HTMLElement): void {
  unmountDomainValue();
  const loc = locale();
  let last = "";
  let copyBtn: HTMLButtonElement | null = null;
  const pct = (x: number) => numberFormat(loc, { style: "percent", maximumFractionDigits: 1 }).format(x);

  const line = (f: DomainFeature): string => {
    switch (f.key) {
      case "tld": return f.factor === 1 ? t("domainValue.f_tldCom") : t("domainValue.f_tld", { tld: `.${f.tld}`, pct: pct(f.factor) });
      case "kind": return t(`domainValue.k_${f.kind}`, { words: f.words ?? "", n: f.digits ?? 0 });
      case "length": return t("domainValue.f_length", { n: f.n });
      default: return t(`domainValue.f_${f.key}`, "word" in f ? { word: f.word } : undefined);
    }
  };

  const input = h("input", {
    type: "text",
    inputmode: "url",
    autocomplete: "off",
    spellcheck: "false",
    autocapitalize: "none",
    "data-field": "domain",
    value: "cloudkitchen.com",
    "aria-label": t("domainValue.input"),
    onInput: () => paint(),
  });
  const errorEl = h("p", { class: "hint", "aria-live": "polite", "data-out": "error" });
  const out = h("div", { class: "val-out", "data-out": "result" });

  const paint = () => {
    const r = valueDomain(input.value);
    if (!r.ok) {
      out.replaceChildren();
      last = "";
      errorEl.textContent = t(`domainValue.err_${r.error}`);
      return;
    }
    errorEl.textContent = "";
    const v = r.value;
    const tier = v.score >= 85 ? 6 : v.score >= 70 ? 5 : v.score >= 55 ? 4 : v.score >= 40 ? 3 : v.score >= 25 ? 2 : v.score >= 10 ? 1 : 0;
    last = paintEstimate(out, loc, {
      title: t("domainValue.estimateFor", { domain: v.domain }),
      estimate: v.estimate,
      low: v.low,
      high: v.high,
      currency: "USD",
      score: v.score,
      tierLabel: t("valuation.tierLine", { tier: t(`valuation.tier_${tier}`) }),
      lines: [...v.features.map(line), ...(v.estimate <= 20 ? [t("domainValue.f_floor")] : [])],
    });
  };

  host.append(
    h("header", { class: "tool-head" },
      h("h1", null, t("domainValue.title")),
      h("p", { class: "lede" }, t("domainValue.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        labeled(t("domainValue.input"), input),
        h("p", { class: "hint" }, t("domainValue.hint")),
        h("div", { class: "stage-actions" },
          ...PRESETS.map((p) => h("button", { type: "button", class: "btn ghost", "data-preset": p, onClick: () => { input.value = p; paint(); } }, p)),
        ),
        h("div", { class: "stage-actions" },
          copyBtn = h("button", { type: "button", class: "btn ghost", "data-action": "copy", onClick: () => void copyWithFlash(copyBtn, last, { done: t("valuation.copied"), failed: t("valuation.copyFailed") }) }, t("valuation.copy")),
        ),
        h("p", { class: "hint" }, t("domainValue.disclaimer")),
      ),
      h("div", { class: "rail" }, errorEl, out),
    ),
  );
  paint();
  mounted = { cleanup: () => { copyBtn = null; } };
}

export function unmountDomainValue(): void {
  mounted?.cleanup();
  mounted = null;
}
