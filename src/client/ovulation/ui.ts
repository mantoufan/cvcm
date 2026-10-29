import { copyWithFlash } from "../copy";
import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { todayIso } from "../../shared/age";
import { DEFAULT_CYCLE, MAX_CYCLE, MAX_ELAPSED_DAYS, MIN_CYCLE, ovulationCycles } from "../../shared/ovulation";

let dateEl: HTMLInputElement | null = null;
let cycleEl: HTMLInputElement | null = null;
let outEl: HTMLElement | null = null;
let copyBtn: HTMLButtonElement | null = null;
let last = "";

export function mountOvulation(host: HTMLElement): void {
  // Sample: a period that started 10 days ago.
  dateEl = h("input", { type: "date", value: todayIso(new Date(Date.now() - 10 * 86400000)), "data-field": "date", onInput: () => paint(), onChange: () => paint() });
  cycleEl = h("input", { type: "number", min: String(MIN_CYCLE), max: String(MAX_CYCLE), step: "1", value: String(DEFAULT_CYCLE), "data-field": "cycle", onInput: () => paint() });
  outEl = h("div", { class: "ovulation-out" });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("ovulation.back")),
      h("h1", null, t("ovulation.title")),
      h("p", { class: "lede" }, t("ovulation.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("ovulation.options")),
          h("label", { class: "field" }, h("span", null, t("ovulation.lastPeriod")), dateEl),
          h("label", { class: "field" }, h("span", null, t("ovulation.cycle")), cycleEl),
        ),
        h("div", { class: "stage-actions" },
          copyBtn = h("button", { type: "button", class: "btn", onClick: () => void copyOut() }, t("ovulation.copy")),
        ),
      ),
      h("div", { class: "rail" },
        h("h2", null, t("ovulation.result")),
        outEl,
        h("p", { class: "hint" }, t("ovulation.formula")),
        h("p", { class: "hint" }, t("ovulation.disclaimer")),
      ),
    ),
  );
  paint();
}

export function unmountOvulation(): void {
  dateEl = cycleEl = null;
  outEl = null;
  copyBtn = null;
  last = "";
}

function paint(): void {
  if (!outEl || !dateEl || !cycleEl) return;
  const raw = cycleEl.value.trim();
  const cycles = ovulationCycles(dateEl.value, raw === "" ? NaN : Number(raw), 3);
  outEl.replaceChildren();
  if (!cycles) {
    last = "";
    const future = dateEl.value !== "" && dateEl.value > todayIso();
    const old = dateEl.value !== "" && dateEl.value < todayIso(new Date(Date.now() - MAX_ELAPSED_DAYS * 86400000));
    outEl.append(h("p", { class: "muted" }, future ? t("ovulation.invalidFuture") : old ? t("ovulation.invalidOld") : t("ovulation.invalid")));
    return;
  }
  const fmt = new Intl.DateTimeFormat(locale(), { month: "short", day: "numeric", weekday: "short", timeZone: "UTC" });
  const lines: string[] = [];
  cycles.forEach((c, i) => {
    const rows: Array<[string, string]> = [
      [t("ovulation.fertile"), `${fmt.format(c.fertileStart)} – ${fmt.format(c.fertileEnd)}`],
      [t("ovulation.ovulation"), fmt.format(c.ovulation)],
      [t("ovulation.nextPeriod"), fmt.format(c.nextPeriod)],
    ];
    const dl = h("dl", { class: "stats-grid timestamp-out" });
    // Every date follows from a sample relative to today, so none of it goes into the prerendered HTML.
    for (const [k, v] of rows) dl.append(h("dt", null, k), h("dd", { "data-volatile": "" }, v));
    outEl!.append(h("h3", null, t("ovulation.cycleN", { n: i + 1 })), dl);
    lines.push(t("ovulation.cycleN", { n: i + 1 }), ...rows.map(([k, v]) => `${k}: ${v}`));
  });
  last = lines.join("\n");
}

async function copyOut(): Promise<void> {
  await copyWithFlash(copyBtn, last, { done: t("ovulation.copied"), failed: t("ovulation.copyFailed") });
}
