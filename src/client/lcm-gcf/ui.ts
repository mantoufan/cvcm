import { copyWithFlash } from "../copy";
import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { MAX_DIGITS, MAX_NUMBERS, euclidSteps, factorText, factorize, gcd, gcfLcmByPrimes, lcm, parseWhole, splitNumbers, thousandsMarkFor } from "../../shared/factors";

let inputEl: HTMLTextAreaElement | null = null;
let errorEl: HTMLElement | null = null;
let outEl: HTMLElement | null = null;
let primesEl: HTMLElement | null = null;
let stepsEl: HTMLElement | null = null;
let stepsHead: HTMLElement | null = null;
let copyBtn: HTMLButtonElement | null = null;
let last = "";
let typeTimer = 0;

export function mountLcmGcf(host: HTMLElement): void {
  inputEl = h("textarea", { rows: 3, "data-field": "numbers", spellcheck: "false", onInput: () => { window.clearTimeout(typeTimer); typeTimer = window.setTimeout(paint, 150); } });
  inputEl.value = "12, 18, 30";
  errorEl = h("p", { class: "hint factor-verdict", "aria-live": "polite", "data-out": "error" });
  outEl = h("dl", { class: "stats-grid", "data-out": "result" });
  primesEl = h("ul", { class: "factor-steps", "data-out": "primes" });
  stepsHead = h("h2", null, t("lcmGcf.euclid"));
  stepsEl = h("ol", { class: "factor-steps", "data-out": "euclid" });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("lcmGcf.back")),
      h("h1", null, t("lcmGcf.title")),
      h("p", { class: "lede" }, t("lcmGcf.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("lcmGcf.options")),
          h("label", { class: "field" }, h("span", null, t("lcmGcf.numbers", { n: MAX_NUMBERS })), inputEl),
        ),
        h("div", { class: "chip-row" }, ...["8, 12", "48, 36", "12, 18, 30", "4, 6, 8, 10"].map((v) => h("button", { type: "button", class: "chip", "data-example": v, onClick: () => { if (inputEl) inputEl.value = v; paint(); } }, v))),
        h("div", { class: "stage-actions" },
          copyBtn = h("button", { type: "button", class: "btn ghost", "data-action": "copy", onClick: () => void copyWithFlash(copyBtn, last, { done: t("lcmGcf.copied"), failed: t("lcmGcf.copyFailed") }) }, t("lcmGcf.copy")),
        ),
        h("p", { class: "hint" }, t("lcmGcf.hint")),
      ),
      h("div", { class: "rail" },
        errorEl,
        outEl,
        h("h2", null, t("lcmGcf.byPrimes")),
        primesEl,
        stepsHead,
        stepsEl,
      ),
    ),
  );
  paint();
}

export function unmountLcmGcf(): void {
  window.clearTimeout(typeTimer);
  inputEl = null;
  errorEl = outEl = primesEl = stepsEl = stepsHead = null;
  copyBtn = null;
  last = "";
}

function paint(): void {
  if (!inputEl || !errorEl || !outEl || !primesEl || !stepsEl || !stepsHead) return;
  outEl.replaceChildren();
  primesEl.replaceChildren();
  stepsEl.replaceChildren();
  stepsHead.hidden = true;
  last = "";
  errorEl.textContent = "";
  const parts = splitNumbers(inputEl.value);
  // Commas always split the list; "." still groups thousands inside one entry in es, id and vi.
  const mark = thousandsMarkFor(locale());
  const nums: bigint[] = [];
  const bad: string[] = [];
  let tooBig = false;
  for (const p of parts) {
    const r = parseWhole(p, mark);
    if (r.ok && r.n > 0n) nums.push(r.n);
    else if (!r.ok && r.error === "tooBig") tooBig = true;
    else bad.push(p);
  }
  if (bad.length || tooBig) {
    errorEl.textContent = [tooBig ? t("lcmGcf.tooBig", { n: MAX_DIGITS }) : "", bad.length ? t("lcmGcf.invalid", { list: bad.slice(0, 5).join(", ") }) : ""].filter(Boolean).join(" ");
    return;
  }
  if (nums.length > MAX_NUMBERS) {
    errorEl.textContent = t("lcmGcf.tooMany", { n: MAX_NUMBERS });
    return;
  }
  if (nums.length < 2) {
    errorEl.textContent = t("lcmGcf.needTwo");
    return;
  }
  // "1,500, 2,500" in English: the commas split it into 1, 500, 2, 500. Say so next to the answer.
  if (mark === "," && /\d,\d{3}(?!\d)/.test(inputEl.value.normalize("NFKC"))) errorEl.textContent = t("lcmGcf.commaNote");
  const g = nums.reduce((a, b) => gcd(a, b));
  const l = nums.reduce((a, b) => lcm(a, b));
  const list = nums.join(", ");
  last = `${t("lcmGcf.gcfShort")}(${list}) = ${g}\n${t("lcmGcf.lcmShort")}(${list}) = ${l}`;
  const rows: Array<[string, string]> = [
    [t("lcmGcf.gcf"), g.toString()],
    [t("lcmGcf.lcm"), l.toString()],
  ];
  if (g === 1n) rows.push([t("lcmGcf.coprime"), t("lcmGcf.yes")]);
  outEl.append(...rows.flatMap(([k, v]) => [h("dt", null, k), h("dd", null, v)]));
  const factors = nums.map((n) => factorize(n));
  const by = gcfLcmByPrimes(factors);
  primesEl.append(
    ...nums.map((n, i) => h("li", null, `${n} = ${factorText(factors[i]!)}`)),
    h("li", null, h("strong", null, `${t("lcmGcf.gcfShort")} = ${factorText(by.gcf)} = ${g}`), ` — ${t("lcmGcf.gcfRule")}`),
    h("li", null, h("strong", null, `${t("lcmGcf.lcmShort")} = ${factorText(by.lcm)} = ${l}`), ` — ${t("lcmGcf.lcmRule")}`),
  );
  if (nums.length === 2) {
    stepsHead.hidden = false;
    stepsEl.append(...euclidSteps(nums[0]!, nums[1]!).map((s) => h("li", null, `${s.a} = ${s.q} × ${s.b} + ${s.r}`)));
    stepsEl.append(h("li", { class: "muted" }, t("lcmGcf.euclidEnd", { g: g.toString(), a: nums[0]!.toString(), b: nums[1]!.toString(), l: l.toString() })));
  }
}
