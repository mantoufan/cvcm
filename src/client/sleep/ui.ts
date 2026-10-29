import { copyWithFlash } from "../copy";
import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { CYCLE_MIN, FALL_ASLEEP_MIN, bedtimesFor, formatClock, hoursOf, parseClock, wakeTimesFor } from "../../shared/sleep";

type Mode = "wake" | "bed";

let modeEl: HTMLSelectElement | null = null;
let timeEl: HTMLInputElement | null = null;
let timeLabel: HTMLElement | null = null;
let outEl: HTMLElement | null = null;
let outTitle: HTMLElement | null = null;
let copyBtn: HTMLButtonElement | null = null;
let last = "";

export function mountSleep(host: HTMLElement): void {
  modeEl = h("select", { "data-field": "mode", onChange: () => paint() },
    h("option", { value: "wake", selected: true }, t("sleep.modeWake")),
    h("option", { value: "bed" }, t("sleep.modeBed")),
  );
  modeEl.value = "wake";
  timeEl = h("input", { type: "time", value: "07:00", "data-field": "time", onInput: () => paint(), onChange: () => paint() });
  timeLabel = h("span", null, t("sleep.wakeAt"));
  outTitle = h("h2", null, t("sleep.bedtimes"));
  outEl = h("dl", { class: "stats-grid timestamp-out" });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("sleep.back")),
      h("h1", null, t("sleep.title")),
      h("p", { class: "lede" }, t("sleep.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("sleep.options")),
          h("label", { class: "field" }, h("span", null, t("sleep.mode")), modeEl),
          h("label", { class: "field" }, timeLabel, timeEl),
        ),
        h("div", { class: "stage-actions" },
          copyBtn = h("button", { type: "button", class: "btn", onClick: () => void copyOut() }, t("sleep.copy")),
        ),
      ),
      h("div", { class: "rail" },
        outTitle,
        outEl,
        h("p", { class: "hint" }, t("sleep.formula", { cycle: CYCLE_MIN, fall: FALL_ASLEEP_MIN })),
        h("p", { class: "hint" }, t("sleep.disclaimer")),
      ),
    ),
  );
  paint();
}

export function unmountSleep(): void {
  modeEl = timeEl = null;
  timeLabel = outEl = outTitle = null;
  copyBtn = null;
  last = "";
}

function mode(): Mode {
  return modeEl?.value === "bed" ? "bed" : "wake";
}

function paint(): void {
  if (!outEl || !timeEl || !timeLabel || !outTitle) return;
  const m = mode();
  timeLabel.textContent = m === "wake" ? t("sleep.wakeAt") : t("sleep.bedAt");
  outTitle.textContent = m === "wake" ? t("sleep.bedtimes") : t("sleep.wakeTimes");
  const minutes = parseClock(timeEl.value);
  outEl.replaceChildren();
  if (minutes == null) {
    last = "";
    outEl.append(h("p", { class: "muted" }, t("sleep.invalid")));
    return;
  }
  const slots = m === "wake" ? bedtimesFor(minutes) : wakeTimesFor(minutes);
  const lines: string[] = [];
  for (const slot of slots) {
    const label = t("sleep.cycles", { n: slot.cycles, h: hoursOf(slot.sleepMin) });
    const value = formatClock(slot.minutes);
    lines.push(`${value} — ${label}`);
    outEl.append(h("dt", null, label), h("dd", { class: slot.cycles >= 5 ? "sleep-best" : undefined }, value));
  }
  last = `${outTitle.textContent}\n${lines.join("\n")}`;
}

async function copyOut(): Promise<void> {
  await copyWithFlash(copyBtn, last, { done: t("sleep.copied"), failed: t("sleep.copyFailed") });
}
