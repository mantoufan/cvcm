import { copyWithFlash } from "../copy";
import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { finalGrade } from "../../shared/grade";

let currentEl: HTMLInputElement | null = null;
let wantedEl: HTMLInputElement | null = null;
let weightEl: HTMLInputElement | null = null;
let neededEl: HTMLElement | null = null;
let outEl: HTMLElement | null = null;
let noteEl: HTMLElement | null = null;
let copyBtn: HTMLButtonElement | null = null;
let last = "";

export function mountGrade(host: HTMLElement): void {
  const num = (field: string, value: string, min = "0", max = "150") =>
    h("input", { type: "number", min, max, step: "0.1", inputmode: "decimal", "data-field": field, value, onInput: () => paint() });
  currentEl = num("current", "85");
  wantedEl = num("wanted", "90");
  weightEl = num("weight", "30", "1", "100");
  neededEl = h("p", { class: "grade-needed", "aria-live": "polite" });
  noteEl = h("p", { class: "hint" });
  outEl = h("dl", { class: "stats-grid timestamp-out" });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("grade.back")),
      h("h1", null, t("grade.title")),
      h("p", { class: "lede" }, t("grade.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("grade.options")),
          h("label", { class: "field" }, h("span", null, t("grade.current")), currentEl),
          h("label", { class: "field" }, h("span", null, t("grade.wanted")), wantedEl),
          h("label", { class: "field" }, h("span", null, t("grade.weight")), weightEl),
        ),
        h("div", { class: "stage-actions" },
          copyBtn = h("button", { type: "button", class: "btn", onClick: () => void copyOut() }, t("grade.copy")),
        ),
      ),
      h("div", { class: "rail" },
        h("h2", null, t("grade.result")),
        neededEl,
        noteEl,
        h("h2", null, t("grade.targets")),
        outEl,
        h("p", { class: "hint" }, t("grade.formula")),
      ),
    ),
  );
  paint();
}

export function unmountGrade(): void {
  currentEl = wantedEl = weightEl = null;
  neededEl = outEl = noteEl = null;
  copyBtn = null;
  last = "";
}

function paint(): void {
  if (!outEl || !neededEl || !noteEl) return;
  const read = (el: HTMLInputElement | null) => (el?.value.trim() === "" ? NaN : Number(el?.value));
  const out = finalGrade({ current: read(currentEl), wanted: read(wantedEl), weight: read(weightEl) });
  outEl.replaceChildren();
  noteEl.textContent = "";
  if (!out) {
    last = "";
    neededEl.textContent = "";
    outEl.append(h("p", { class: "muted" }, t("grade.invalid")));
    return;
  }
  const fmt = new Intl.NumberFormat(locale(), { maximumFractionDigits: 1 });
  const pct = (n: number) => `${fmt.format(Math.round(n * 10) / 10)}%`;
  neededEl.textContent = t("grade.needed", { n: pct(out.needed) });
  if (out.needed > 100) noteEl.textContent = t("grade.over100");
  else if (out.needed <= 0) noteEl.textContent = t("grade.already");
  const rows = out.targets.map((row) => [t("grade.toGet", { letter: row.letter, n: pct(row.wanted) }), pct(row.needed)] as [string, string]);
  for (const [k, v] of rows) outEl.append(h("dt", null, k), h("dd", null, v));
  last = [neededEl.textContent, noteEl.textContent, ...rows.map(([k, v]) => `${k}: ${v}`)].filter(Boolean).join("\n");
}

async function copyOut(): Promise<void> {
  await copyWithFlash(copyBtn, last, { done: t("grade.copied"), failed: t("grade.copyFailed") });
}
