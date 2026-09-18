import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { fromSeconds, toSeconds } from "../../shared/countdown";

let hoursEl: HTMLInputElement | null = null;
let minutesEl: HTMLInputElement | null = null;
let secondsEl: HTMLInputElement | null = null;
let displayEl: HTMLElement | null = null;
let startBtn: HTMLButtonElement | null = null;
let left = 0;
let running = false;
let timer = 0;

export function mountCountdown(host: HTMLElement): void {
  hoursEl = h("input", { type: "number", min: "0", step: "1", value: "0" });
  minutesEl = h("input", { type: "number", min: "0", step: "1", value: "5" });
  secondsEl = h("input", { type: "number", min: "0", step: "1", value: "0" });
  displayEl = h("p", { class: "timestamp-out", "aria-live": "polite" });
  startBtn = h("button", { type: "button", class: "btn", onClick: () => toggle() }, t("countdown.start"));
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("countdown.back")),
      h("h1", null, t("countdown.title")),
      h("p", { class: "lede" }, t("countdown.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("countdown.options")),
          labeled(t("countdown.hours"), hoursEl),
          labeled(t("countdown.minutes"), minutesEl),
          labeled(t("countdown.seconds"), secondsEl),
        ),
        h("div", { class: "stage-actions" },
          startBtn,
          h("button", { type: "button", class: "btn ghost", onClick: () => reset() }, t("countdown.reset")),
        ),
      ),
      h("div", { class: "rail" }, h("h2", null, t("countdown.result")), displayEl),
    ),
  );
  reset();
}

export function unmountCountdown(): void {
  stop();
  hoursEl = null;
  minutesEl = null;
  secondsEl = null;
  displayEl = null;
  startBtn = null;
}

function labeled(label: string, control: HTMLElement): HTMLElement {
  return h("label", { class: "field" }, h("span", null, label), control);
}

function toggle(): void {
  if (running) {
    stop();
    return;
  }
  if (left <= 0) left = toSeconds(Number(hoursEl?.value), Number(minutesEl?.value), Number(secondsEl?.value));
  if (left <= 0) return;
  running = true;
  if (startBtn) startBtn.textContent = t("countdown.pause");
  tick();
  timer = window.setInterval(tick, 1000);
}

function tick(): void {
  paint();
  if (left <= 0) {
    stop();
    return;
  }
  left -= 1;
}

function stop(): void {
  running = false;
  if (timer) window.clearInterval(timer);
  timer = 0;
  if (startBtn) startBtn.textContent = t("countdown.start");
}

function reset(): void {
  stop();
  left = toSeconds(Number(hoursEl?.value), Number(minutesEl?.value), Number(secondsEl?.value));
  paint();
}

function paint(): void {
  if (!displayEl) return;
  displayEl.textContent = fromSeconds(left).label;
}
