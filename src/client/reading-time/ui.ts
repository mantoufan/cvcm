import { copyWithFlash } from "../copy";
import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { CJK_CPM, READ_WPM, readingTime, splitSec, type Speed } from "../../shared/reading-time";

let textEl: HTMLTextAreaElement | null = null;
let speedEl: HTMLSelectElement | null = null;
let outEl: HTMLElement | null = null;
let copyBtn: HTMLButtonElement | null = null;
let last = "";

export function mountReadingTime(host: HTMLElement): void {
  textEl = h("textarea", { rows: "10", placeholder: t("readingTime.placeholder"), "data-field": "text", spellcheck: "false", onInput: () => paint() });
  textEl.value = t("readingTime.sample");
  speedEl = h("select", { "data-field": "speed", onChange: () => paint() },
    h("option", { value: "slow" }, t("readingTime.slow", { wpm: READ_WPM.slow, cpm: CJK_CPM.slow })),
    h("option", { value: "average", selected: true }, t("readingTime.average", { wpm: READ_WPM.average, cpm: CJK_CPM.average })),
    h("option", { value: "fast" }, t("readingTime.fast", { wpm: READ_WPM.fast, cpm: CJK_CPM.fast })),
  );
  speedEl.value = "average";
  outEl = h("dl", { class: "stats-grid timestamp-out" });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("readingTime.back")),
      h("h1", null, t("readingTime.title")),
      h("p", { class: "lede" }, t("readingTime.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("readingTime.options")),
          h("label", { class: "field" }, h("span", null, t("readingTime.text")), textEl),
          h("label", { class: "field" }, h("span", null, t("readingTime.speed")), speedEl),
        ),
        h("div", { class: "stage-actions" },
          h("button", { type: "button", class: "btn ghost", "data-action": "clear", onClick: () => { if (textEl) textEl.value = ""; paint(); } }, t("readingTime.clear")),
          copyBtn = h("button", { type: "button", class: "btn", onClick: () => void copyOut() }, t("readingTime.copy")),
        ),
      ),
      h("div", { class: "rail" },
        h("h2", null, t("readingTime.result")),
        outEl,
        h("p", { class: "hint" }, t("readingTime.hint")),
      ),
    ),
  );
  paint();
}

export function unmountReadingTime(): void {
  textEl = null;
  speedEl = null;
  outEl = null;
  copyBtn = null;
  last = "";
}

function paint(): void {
  if (!outEl || !textEl || !speedEl) return;
  const stats = readingTime(textEl.value, speedEl.value as Speed);
  outEl.replaceChildren();
  if (stats.units === 0) {
    last = "";
    outEl.append(h("p", { class: "muted" }, t("readingTime.empty")));
    return;
  }
  const fmt = new Intl.NumberFormat(locale());
  const clock = (sec: number) => {
    const { min, sec: s } = splitSec(sec);
    return min > 0 ? t("readingTime.minSec", { m: min, s }) : t("readingTime.secOnly", { s });
  };
  const rows: Array<[string, string]> = [
    [t("readingTime.readTime"), clock(stats.readSec)],
    [t("readingTime.speakTime"), clock(stats.speakSec)],
    [stats.cjkMode ? t("readingTime.cjkChars") : t("readingTime.words"), fmt.format(stats.units)],
    [t("readingTime.chars"), fmt.format(stats.chars)],
    [t("readingTime.charsNoSpaces"), fmt.format(stats.charsNoSpaces)],
  ];
  for (const [k, v] of rows) outEl.append(h("dt", null, k), h("dd", null, v));
  last = rows.map(([k, v]) => `${k}: ${v}`).join("\n");
}

async function copyOut(): Promise<void> {
  await copyWithFlash(copyBtn, last, { done: t("readingTime.copied"), failed: t("readingTime.copyFailed") });
}
