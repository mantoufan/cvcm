import { copyWithFlash } from "../copy";
import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { MAX_VALUES, parseNumbers, stats } from "../../shared/average";

let inputEl: HTMLTextAreaElement | null = null;
let outEl: HTMLElement | null = null;
let noteEl: HTMLElement | null = null;
let copyBtn: HTMLButtonElement | null = null;
let last = "";

export function mountAverage(host: HTMLElement): void {
  inputEl = h("textarea", { rows: "8", "data-field": "numbers", spellcheck: "false", inputmode: "decimal", "aria-label": t("average.numbers"), onInput: () => paint() });
  inputEl.value = "12, 15, 15, 18, 20, 22, 30";
  outEl = h("dl", { class: "stats-grid timestamp-out" });
  noteEl = h("p", { class: "hint" });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("average.back")),
      h("h1", null, t("average.title")),
      h("p", { class: "lede" }, t("average.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("average.numbers")),
          inputEl,
          h("p", { class: "hint" }, t("average.inputHint", { max: new Intl.NumberFormat(locale()).format(MAX_VALUES) })),
        ),
        h("div", { class: "stage-actions" },
          copyBtn = h("button", { type: "button", class: "btn", onClick: () => void copyOut() }, t("average.copy")),
          h("button", { type: "button", class: "btn ghost", "data-action": "clear", onClick: () => { if (inputEl) { inputEl.value = ""; paint(); inputEl.focus(); } } }, t("average.clear")),
        ),
      ),
      h("div", { class: "rail" },
        h("h2", null, t("average.result")),
        outEl,
        noteEl,
      ),
    ),
  );
  paint();
}

export function unmountAverage(): void {
  inputEl = null;
  outEl = noteEl = null;
  copyBtn = null;
  last = "";
}

function paint(): void {
  if (!outEl || !noteEl) return;
  const { values, skipped } = parseNumbers(inputEl?.value ?? "");
  const s = stats(values);
  outEl.replaceChildren();
  noteEl.textContent = skipped.length
    ? t("average.skipped", { n: skipped.length, list: skipped.slice(0, 5).join(" ") + (skipped.length > 5 ? " …" : "") })
    : "";
  if (!s) {
    last = "";
    outEl.append(h("p", { class: "muted" }, t("average.empty")));
    return;
  }
  const num = new Intl.NumberFormat(locale(), { maximumFractionDigits: 6 });
  const dash = "—";
  const rows: Array<[string, string]> = [
    [t("average.mean"), num.format(s.mean)],
    [t("average.median"), num.format(s.median)],
    [t("average.mode"), s.modes.length ? `${s.modes.slice(0, 10).map((m) => num.format(m)).join(", ")}${s.modes.length > 10 ? " …" : ""} (×${s.modeCount})` : t("average.noMode")],
    [t("average.count"), num.format(s.count)],
    [t("average.sum"), num.format(s.sum)],
    [t("average.min"), num.format(s.min)],
    [t("average.max"), num.format(s.max)],
    [t("average.range"), num.format(s.range)],
    [t("average.sampleSd"), s.sampleSd == null ? dash : num.format(s.sampleSd)],
    [t("average.populationSd"), num.format(s.populationSd)],
    [t("average.sampleVariance"), s.sampleVariance == null ? dash : num.format(s.sampleVariance)],
    [t("average.geometric"), s.geometricMean == null ? dash : num.format(s.geometricMean)],
  ];
  for (const [k, v] of rows) outEl.append(h("dt", null, k), h("dd", null, v));
  last = rows.map(([k, v]) => `${k}: ${v}`).join("\n");
}

async function copyOut(): Promise<void> {
  await copyWithFlash(copyBtn, last, { done: t("average.copied"), failed: t("average.copyFailed") });
}
