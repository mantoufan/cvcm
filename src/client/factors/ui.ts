import { copyWithFlash } from "../copy";
import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import {
  MAX_DIGITS, MAX_LISTED_DIVISORS, divisorCount, divisorSum, divisors, factorPairs, factorText, factorTextExpanded,
  factorize, nextPrime, parseWhole, previousPrime, thousandsMarkFor,
} from "../../shared/factors";

let inputEl: HTMLInputElement | null = null;
let verdictEl: HTMLElement | null = null;
let outEl: HTMLElement | null = null;
let divisorsEl: HTMLElement | null = null;
let pairsEl: HTMLElement | null = null;
let copyBtn: HTMLButtonElement | null = null;
let last = "";
let typeTimer = 0;

export function mountFactors(host: HTMLElement): void {
  inputEl = h("input", { type: "text", inputmode: "numeric", autocomplete: "off", value: "360", "data-field": "number", maxlength: "40", onInput: () => schedule() });
  verdictEl = h("p", { class: "factor-verdict", "aria-live": "polite", "data-out": "verdict" });
  outEl = h("dl", { class: "stats-grid", "data-out": "result" });
  divisorsEl = h("p", { class: "factor-list", "data-out": "divisors" });
  pairsEl = h("p", { class: "factor-list", "data-out": "pairs" });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("factors.back")),
      h("h1", null, t("factors.title")),
      h("p", { class: "lede" }, t("factors.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("factors.options")),
          h("label", { class: "field" }, h("span", null, t("factors.number", { n: MAX_DIGITS })), inputEl),
        ),
        h("div", { class: "chip-row" }, ...["12", "97", "360", "1001", "65536", "999999999989"].map((v) => h("button", { type: "button", class: "chip", "data-example": v, onClick: () => { if (inputEl) inputEl.value = v; paint(); } }, v))),
        h("div", { class: "stage-actions" },
          copyBtn = h("button", { type: "button", class: "btn ghost", "data-action": "copy", onClick: () => void copyWithFlash(copyBtn, last, { done: t("factors.copied"), failed: t("factors.copyFailed") }) }, t("factors.copy")),
        ),
        h("p", { class: "hint" }, t("factors.hint")),
      ),
      h("div", { class: "rail" },
        verdictEl,
        outEl,
        h("h2", null, t("factors.divisors")),
        divisorsEl,
        h("h2", null, t("factors.pairs")),
        pairsEl,
      ),
    ),
  );
  paint();
}

export function unmountFactors(): void {
  window.clearTimeout(typeTimer);
  inputEl = verdictEl = outEl = divisorsEl = pairsEl = null;
  copyBtn = null;
  last = "";
}

/** Long numbers are worked out after a short pause, not on every key. */
function schedule(): void {
  window.clearTimeout(typeTimer);
  const len = inputEl?.value.length ?? 0;
  if (len < 10) paint();
  else typeTimer = window.setTimeout(paint, 250);
}

function paint(): void {
  if (!inputEl || !verdictEl || !outEl || !divisorsEl || !pairsEl) return;
  const parsed = parseWhole(inputEl.value, thousandsMarkFor(locale()));
  outEl.replaceChildren();
  divisorsEl.textContent = "";
  pairsEl.textContent = "";
  last = "";
  if (!parsed.ok) {
    verdictEl.dataset.state = "error";
    verdictEl.textContent = parsed.error === "empty" ? t("factors.empty") : t(`factors.err_${parsed.error}`, { n: MAX_DIGITS });
    return;
  }
  const n = parsed.n;
  if (n < 2n) {
    verdictEl.dataset.state = "neither";
    verdictEl.textContent = t(n === 0n ? "factors.zero" : "factors.one");
    if (n === 1n) {
      divisorsEl.textContent = "1";
      pairsEl.textContent = "1 × 1";
    }
    return;
  }
  const f = factorize(n);
  const prime = f.length === 1 && f[0]!.e === 1;
  verdictEl.dataset.state = prime ? "prime" : "composite";
  verdictEl.textContent = t(prime ? "factors.isPrime" : "factors.isComposite", { n: n.toString() });
  const count = divisorCount(f);
  const factorStr = factorText(f);
  last = `${n} = ${factorStr}`;
  const prev = previousPrime(n);
  const rows: Array<[string, string]> = [
    [t("factors.factorization"), factorStr],
    [t("factors.expanded"), factorTextExpanded(f)],
    [t("factors.count"), String(count)],
    [t("factors.sum"), divisorSum(f).toString()],
    [t("factors.previous"), prev == null ? "—" : prev.toString()],
    [t("factors.next"), nextPrime(n).toString()],
  ];
  outEl.append(...rows.flatMap(([k, v]) => [h("dt", null, k), h("dd", null, v)]));
  const list = divisors(f);
  divisorsEl.textContent = list.join(", ") + (count > list.length ? ` … ${t("factors.more", { n: count - list.length, shown: MAX_LISTED_DIVISORS })}` : "");
  if (count > list.length) pairsEl.textContent = t("factors.pairsTooMany");
  else pairsEl.textContent = factorPairs(n, list).map(([a, b]) => `${a} × ${b}`).join(", ");
}

