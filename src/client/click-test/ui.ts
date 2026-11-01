import { copyWithFlash } from "../copy";
import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { CLICK_DURATIONS, DEFAULT_CLICK_DURATION, clicksPerSecond, cpsBand } from "../../shared/click-test";

/** After a run ends, clicks are ignored this long so a last fast click does not start a new run. */
const COOLDOWN_MS = 800;

let durationEl: HTMLSelectElement | null = null;
let padEl: HTMLButtonElement | null = null;
let timeEl: HTMLElement | null = null;
let clicksEl: HTMLElement | null = null;
let cpsEl: HTMLElement | null = null;
let resultEl: HTMLElement | null = null;
let bestEl: HTMLElement | null = null;
let copyBtn: HTMLButtonElement | null = null;
let state: "idle" | "running" | "done" = "idle";
let startedAt = 0;
let clicks = 0;
let endTimer = 0;
let frame = 0;
let cooldownUntil = 0;
let last = "";
const best = new Map<number, number>();

export function mountClickTest(host: HTMLElement): void {
  durationEl = h("select", { "data-field": "duration", onChange: () => reset() },
    ...CLICK_DURATIONS.map((s) => h("option", { value: String(s), selected: s === DEFAULT_CLICK_DURATION }, t("clickTest.seconds", { n: s }))),
  );
  padEl = h("button", { type: "button", class: "click-pad", "data-action": "pad", onPointerdown: (e: PointerEvent) => press(e), onKeydown: (e: KeyboardEvent) => key(e), onClick: (e: MouseEvent) => e.preventDefault() }, t("clickTest.start"));
  timeEl = h("dd", { "data-out": "time" });
  clicksEl = h("dd", { "data-out": "clicks" });
  cpsEl = h("dd", { "data-out": "cps" });
  resultEl = h("p", { class: "click-result", "aria-live": "polite" });
  bestEl = h("p", { class: "hint", "data-out": "best" });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("clickTest.back")),
      h("h1", null, t("clickTest.title")),
      h("p", { class: "lede" }, t("clickTest.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("clickTest.options")),
          h("label", { class: "field" }, h("span", null, t("clickTest.duration")), durationEl),
        ),
        h("dl", { class: "stats-grid" },
          h("dt", null, t("clickTest.timeLeft")), timeEl,
          h("dt", null, t("clickTest.clicks")), clicksEl,
          h("dt", null, t("clickTest.cps")), cpsEl,
        ),
        h("div", { class: "stage-actions" },
          h("button", { type: "button", class: "btn ghost", "data-action": "reset", onClick: () => reset() }, t("clickTest.reset")),
          copyBtn = h("button", { type: "button", class: "btn ghost", onClick: () => void copyOut() }, t("clickTest.copy")),
        ),
        h("p", { class: "hint" }, t("clickTest.hint")),
      ),
      h("div", { class: "rail click-stage" }, padEl, resultEl, bestEl),
    ),
  );
  reset();
}

export function unmountClickTest(): void {
  window.clearTimeout(endTimer);
  window.cancelAnimationFrame(frame);
  durationEl = padEl = copyBtn = null;
  timeEl = clicksEl = cpsEl = resultEl = bestEl = null;
  state = "idle";
  last = "";
}

function duration(): number {
  return Number(durationEl?.value) || DEFAULT_CLICK_DURATION;
}

function reset(): void {
  window.clearTimeout(endTimer);
  window.cancelAnimationFrame(frame);
  state = "idle";
  clicks = 0;
  last = "";
  padEl?.classList.remove("running", "done");
  if (padEl) padEl.textContent = t("clickTest.start");
  if (resultEl) resultEl.textContent = "";
  paint(0);
  paintBest();
}

function press(e: PointerEvent): void {
  // Only the main button (or a touch / pen contact) counts.
  if (e.button !== 0) return;
  e.preventDefault();
  hit(e.timeStamp);
}

function key(e: KeyboardEvent): void {
  if (e.key !== " " && e.key !== "Enter") return;
  e.preventDefault();
  // A held key repeats; only real presses count.
  if (!e.repeat) hit(e.timeStamp);
}

function hit(at: number): void {
  const now = performance.now();
  if (state === "done") {
    if (now < cooldownUntil) return;
    reset();
  }
  if (state === "idle") {
    state = "running";
    // Start from the first click itself, on the same clock as the later clicks' time stamps.
    startedAt = Math.min(at > 0 ? at : now, now);
    clicks = 0;
    padEl?.classList.add("running");
    endTimer = window.setTimeout(finish, duration() * 1000);
    frame = window.requestAnimationFrame(tick);
  }
  // A click queued just after time ran out (event time past the end) does not count.
  if (Math.min(at || now, now) - startedAt > duration() * 1000) return;
  clicks++;
  if (padEl) padEl.textContent = String(clicks);
  paint(now - startedAt);
}

function tick(): void {
  if (state !== "running") return;
  paint(performance.now() - startedAt);
  frame = window.requestAnimationFrame(tick);
}

function paint(elapsed: number): void {
  const total = duration() * 1000;
  const left = Math.max(0, total - elapsed);
  if (timeEl) timeEl.textContent = t("clickTest.secondsShort", { n: (left / 1000).toFixed(1) });
  if (clicksEl) clicksEl.textContent = String(clicks);
  // Divide by at least one second, so the first frames of a run do not show a huge rate.
  if (cpsEl) cpsEl.textContent = clicksPerSecond(clicks, Math.min(Math.max(elapsed, 1000), total)).toFixed(2);
}

function finish(): void {
  if (state !== "running") return;
  window.cancelAnimationFrame(frame);
  state = "done";
  cooldownUntil = performance.now() + COOLDOWN_MS;
  const secs = duration();
  const cps = clicksPerSecond(clicks, secs * 1000);
  paint(secs * 1000);
  const prev = best.get(secs) ?? 0;
  if (cps > prev) best.set(secs, cps);
  padEl?.classList.remove("running");
  padEl?.classList.add("done");
  if (padEl) padEl.textContent = t("clickTest.again");
  const line = t("clickTest.result", { cps: cps.toFixed(2), clicks, n: secs });
  const band = t(`clickTest.band_${cpsBand(cps)}`);
  if (resultEl) resultEl.textContent = `${line} ${band}`;
  last = `${line}\n${band}`;
  paintBest();
}

function paintBest(): void {
  if (!bestEl) return;
  const secs = duration();
  const b = best.get(secs);
  bestEl.textContent = b ? t("clickTest.best", { cps: b.toFixed(2), n: secs }) : "";
}

async function copyOut(): Promise<void> {
  await copyWithFlash(copyBtn, last, { done: t("clickTest.copied"), failed: t("clickTest.copyFailed") });
}
