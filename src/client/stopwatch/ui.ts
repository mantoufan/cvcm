import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { formatElapsed } from "../../shared/stopwatch";

let displayEl: HTMLElement | null = null;
let startBtn: HTMLButtonElement | null = null;
let acc = 0;
let startAt = 0;
let running = false;
let raf = 0;

export function mountStopwatch(host: HTMLElement): void {
  displayEl = h("p", { class: "timestamp-out", "aria-live": "polite" });
  startBtn = h("button", { type: "button", class: "btn", onClick: () => toggle() }, t("stopwatch.start"));
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("stopwatch.back")),
      h("h1", null, t("stopwatch.title")),
      h("p", { class: "lede" }, t("stopwatch.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null, h("legend", null, t("stopwatch.options"))),
        h("div", { class: "stage-actions" },
          startBtn,
          h("button", { type: "button", class: "btn ghost", onClick: () => reset() }, t("stopwatch.reset")),
        ),
      ),
      h("div", { class: "rail" }, h("h2", null, t("stopwatch.result")), displayEl),
    ),
  );
  paint();
}

export function unmountStopwatch(): void {
  stopLoop();
  displayEl = null;
  startBtn = null;
  acc = 0;
  startAt = 0;
  running = false;
}

function now(): number {
  return performance.now();
}

function toggle(): void {
  if (running) {
    acc += now() - startAt;
    running = false;
    stopLoop();
    if (startBtn) startBtn.textContent = t("stopwatch.start");
    paint();
    return;
  }
  running = true;
  startAt = now();
  if (startBtn) startBtn.textContent = t("stopwatch.pause");
  loop();
}

function loop(): void {
  paint();
  if (running) raf = requestAnimationFrame(loop);
}

function stopLoop(): void {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
}

function reset(): void {
  running = false;
  stopLoop();
  acc = 0;
  startAt = 0;
  if (startBtn) startBtn.textContent = t("stopwatch.start");
  paint();
}

function elapsed(): number {
  return acc + (running ? now() - startAt : 0);
}

function paint(): void {
  if (!displayEl) return;
  displayEl.textContent = formatElapsed(elapsed());
}
