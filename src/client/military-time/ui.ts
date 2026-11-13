import { copyWithFlash } from "../copy";
import { h } from "../dom";
import { locale, t } from "../i18n";
import { CHART_HOURS, colon24, military, parseTime, spoken, type ClockTime } from "../../shared/military-time";

let mounted: { cleanup: () => void } | null = null;

/** The 12-hour form in the page's language ("2:30 PM", "下午2:30"), from a fixed UTC date so it never shifts. */
export function twelveHour(loc: string, time: ClockTime): string {
  const opts: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "UTC" };
  if (time.s !== null) opts.second = "2-digit";
  return new Intl.DateTimeFormat(loc, opts).format(Date.UTC(2000, 0, 1, time.h, time.m, time.s ?? 0));
}

export function mountMilitaryTime(host: HTMLElement): void {
  unmountMilitaryTime();
  const loc = locale();
  let last = "";
  let copyBtn: HTMLButtonElement | null = null;
  const input = h("input", {
    type: "text",
    autocomplete: "off",
    spellcheck: false,
    "data-field": "time",
    value: "1430",
    "aria-label": t("militaryTime.input"),
    onInput: () => paint(),
  });
  const errorEl = h("p", { class: "hint", "aria-live": "polite", "data-out": "error" });
  const mainEl = h("p", { class: "shape-main", "data-out": "main" });
  const rowsEl = h("dl", { class: "stats-grid", "data-out": "rows" });
  const nowLocal = h("dd", { "data-volatile": "", "data-out": "now-local" }, "—");
  const nowZulu = h("dd", { "data-volatile": "", "data-out": "now-zulu" }, "—");

  const paint = () => {
    rowsEl.replaceChildren();
    mainEl.textContent = "";
    last = "";
    if (!input.value.trim()) {
      errorEl.textContent = t("militaryTime.err_empty");
      return;
    }
    const time = parseTime(input.value);
    if (!time) {
      errorEl.textContent = t("militaryTime.err_invalid");
      return;
    }
    errorEl.textContent = "";
    const rows: Array<[string, string]> = [
      [t("militaryTime.military"), `${military(time)} ${t("militaryTime.hours")}`],
      [t("militaryTime.h24"), colon24(time)],
      [t("militaryTime.h12"), time.endOfDay ? `${twelveHour(loc, time)} (${t("militaryTime.endOfDay")})` : twelveHour(loc, time)],
      [t("militaryTime.spoken"), spoken(time)],
    ];
    mainEl.textContent = `${military(time)} = ${twelveHour(loc, time)}`;
    rowsEl.append(...rows.flatMap(([k, v]) => [h("dt", null, k), h("dd", null, v)]));
    last = rows.map(([k, v]) => `${k}: ${v}`).join("\n");
  };

  const tick = () => {
    const now = new Date();
    const local: ClockTime = { h: now.getHours(), m: now.getMinutes(), s: null, endOfDay: false };
    const zulu: ClockTime = { h: now.getUTCHours(), m: now.getUTCMinutes(), s: null, endOfDay: false };
    nowLocal.textContent = `${military(local)} (${twelveHour(loc, local)})`;
    nowZulu.textContent = `${military(zulu)}Z`;
  };

  const chart = h("table", { class: "mil-chart", "data-out": "chart" },
    h("thead", null, h("tr", null,
      h("th", { scope: "col" }, t("militaryTime.h12")),
      h("th", { scope: "col" }, t("militaryTime.military")),
      h("th", { scope: "col" }, t("militaryTime.h12")),
      h("th", { scope: "col" }, t("militaryTime.military")),
    )),
    h("tbody", null, ...CHART_HOURS.slice(0, 12).map((hr) => {
      const am: ClockTime = { h: hr, m: 0, s: null, endOfDay: false };
      const pm: ClockTime = { h: hr + 12, m: 0, s: null, endOfDay: false };
      return h("tr", null,
        h("td", null, twelveHour(loc, am)), h("td", null, military(am)),
        h("td", null, twelveHour(loc, pm)), h("td", null, military(pm)));
    })),
  );

  host.append(
    h("header", { class: "tool-head" },
      h("h1", null, t("militaryTime.title")),
      h("p", { class: "lede" }, t("militaryTime.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("label", { class: "field" }, h("span", null, t("militaryTime.input")), input),
        h("p", { class: "hint" }, t("militaryTime.hint")),
        h("div", { class: "stage-actions" },
          ...["0000", "0800", "1200", "1430", "1900", "2359"].map((v) =>
            h("button", { type: "button", class: "btn ghost", "data-preset": v, onClick: () => { input.value = v; paint(); } }, v)),
        ),
        h("div", { class: "stage-actions" },
          h("button", { type: "button", class: "btn ghost", "data-action": "now", onClick: () => {
            const n = new Date();
            input.value = `${String(n.getHours()).padStart(2, "0")}${String(n.getMinutes()).padStart(2, "0")}`;
            paint();
          } }, t("militaryTime.useNow")),
          copyBtn = h("button", { type: "button", class: "btn ghost", "data-action": "copy", onClick: () => void copyWithFlash(copyBtn, last, { done: t("militaryTime.copied"), failed: t("militaryTime.copyFailed") }) }, t("militaryTime.copy")),
        ),
        h("h2", { class: "mil-now-title" }, t("militaryTime.now")),
        h("dl", { class: "stats-grid" },
          h("dt", null, t("militaryTime.local")), nowLocal,
          h("dt", null, t("militaryTime.zulu")), nowZulu,
        ),
      ),
      h("div", { class: "rail" },
        errorEl,
        mainEl,
        rowsEl,
        h("h2", null, t("militaryTime.chart")),
        h("div", { class: "table-wrap" }, chart),
      ),
    ),
  );
  paint();
  tick();
  const timer = window.setInterval(tick, 1000);
  mounted = { cleanup: () => { window.clearInterval(timer); copyBtn = null; } };
}

export function unmountMilitaryTime(): void {
  mounted?.cleanup();
  mounted = null;
}
