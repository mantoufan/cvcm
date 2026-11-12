import { copyWithFlash } from "../copy";
import { h, keepShortcutsOnClick, onScreen } from "../dom";
import { t } from "../i18n";
import { MIN_REACTION_MS, REACTION_TRIES, reactionBand, summarize, waitMs } from "../../shared/reaction";

let padEl: HTMLButtonElement | null = null;
let padTitle: HTMLElement | null = null;
let padSub: HTMLElement | null = null;
let listEl: HTMLOListElement | null = null;
let outEl: HTMLElement | null = null;
let copyBtn: HTMLButtonElement | null = null;
let state: "idle" | "waiting" | "go" | "early" | "shown" | "done" = "idle";
let waitTimer = 0;
let frame = 0;
let goAt = 0;
let times: number[] = [];
let last = "";

export function mountReactionTime(host: HTMLElement): void {
  padTitle = h("strong", null);
  padSub = h("span", null);
  padEl = h("button", { type: "button", class: "reaction-pad", "data-action": "pad", "aria-live": "assertive", onPointerdown: (e: PointerEvent) => press(e), onClick: (e: MouseEvent) => e.preventDefault() }, padTitle, padSub);
  listEl = h("ol", { class: "reaction-list" });
  outEl = h("dl", { class: "stats-grid" });
  host.append(
    h("header", { class: "tool-head" },
      h("h1", null, t("reactionTime.title")),
      h("p", { class: "lede" }, t("reactionTime.privacyNote")),
    ),
    // A mouse click does not leave focus on Reset or Copy, so Space and Enter keep starting the test.
    h("div", { class: "data-tool", onMousedown: (e: MouseEvent) => keepShortcutsOnClick(e) },
      h("div", { class: "rail reaction-stage" }, padEl, h("p", { class: "hint" }, t("reactionTime.hint", { n: REACTION_TRIES }))),
      h("aside", { class: "rail controls" },
        h("h2", null, t("reactionTime.results")),
        listEl,
        outEl,
        h("div", { class: "stage-actions" },
          h("button", { type: "button", class: "btn ghost", "data-action": "reset", onClick: () => reset() }, t("reactionTime.reset")),
          copyBtn = h("button", { type: "button", class: "btn ghost", onClick: () => void copyOut() }, t("reactionTime.copy")),
        ),
      ),
    ),
  );
  document.addEventListener("keydown", key);
  reset();
}

export function unmountReactionTime(): void {
  document.removeEventListener("keydown", key);
  window.clearTimeout(waitTimer);
  window.cancelAnimationFrame(frame);
  padEl = copyBtn = null;
  padTitle = padSub = outEl = null;
  listEl = null;
  state = "idle";
  times = [];
  last = "";
}

function show(next: typeof state, title: string, sub: string): void {
  state = next;
  if (padEl) padEl.dataset.state = next;
  if (padTitle) padTitle.textContent = title;
  if (padSub) padSub.textContent = sub;
}

function reset(): void {
  window.clearTimeout(waitTimer);
  window.cancelAnimationFrame(frame);
  times = [];
  last = "";
  show("idle", t("reactionTime.startTitle"), t("reactionTime.startSub"));
  paint();
}

function press(e: PointerEvent): void {
  if (e.button !== 0) return;
  e.preventDefault();
  hit(e.timeStamp);
}

/** Space and Enter work from anywhere on the page (not only with the pad focused), except on other controls. */
function key(e: KeyboardEvent): void {
  if (e.key !== " " && e.key !== "Enter") return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const target = e.target as HTMLElement | null;
  // Scrolled away from the pad, Space scrolls the page as usual.
  const onPage = target === padEl || ((!target || target === document.body || target === document.documentElement) && onScreen(padEl));
  if (!onPage) return;
  e.preventDefault();
  if (!e.repeat) hit(e.timeStamp);
}

/** `at` is the event's own time stamp, so time spent waiting for the main thread is not added to the result. */
function hit(at: number): void {
  const now = Math.min(at > 0 ? at : performance.now(), performance.now());
  switch (state) {
    case "idle":
    case "early":
    case "shown":
      arm();
      return;
    case "done":
      reset();
      arm();
      return;
    case "waiting":
      early();
      return;
    case "go": {
      // goAt is 0 until the green frame is on screen. A press before that, or too fast to be a reaction, is too soon.
      const ms = goAt ? Math.round(now - goAt) : -1;
      if (ms < MIN_REACTION_MS) {
        early();
        return;
      }
      times.push(ms);
      paint();
      const s = summarize(times);
      if (times.length >= REACTION_TRIES && s) {
        show("done", t("reactionTime.ms", { n: s.average }), t("reactionTime.doneSub"));
      } else {
        show("shown", t("reactionTime.ms", { n: ms }), t("reactionTime.nextSub", { i: times.length, n: REACTION_TRIES }));
      }
    }
  }
}

function early(): void {
  window.clearTimeout(waitTimer);
  window.cancelAnimationFrame(frame);
  show("early", t("reactionTime.earlyTitle"), t("reactionTime.earlySub"));
}

function arm(): void {
  show("waiting", t("reactionTime.waitTitle"), t("reactionTime.waitSub"));
  const r = new Uint32Array(1);
  crypto.getRandomValues(r);
  waitTimer = window.setTimeout(go, waitMs(r[0] / 0xffffffff));
}

function go(): void {
  goAt = 0;
  show("go", t("reactionTime.goTitle"), "");
  // Time from the frame where green is painted, not from when the timer fired.
  frame = window.requestAnimationFrame((ts) => {
    goAt = ts;
  });
}

function paint(): void {
  if (!listEl || !outEl) return;
  listEl.replaceChildren(...times.map((ms) => h("li", null, t("reactionTime.ms", { n: ms }))));
  const s = summarize(times);
  if (!s) {
    outEl.replaceChildren(h("p", { class: "muted" }, t("reactionTime.empty")));
    last = "";
    if (copyBtn) copyBtn.disabled = true;
    return;
  }
  const rows: Array<[string, string]> = [
    [t("reactionTime.average"), t("reactionTime.ms", { n: s.average })],
    [t("reactionTime.median"), t("reactionTime.ms", { n: s.median })],
    [t("reactionTime.best"), t("reactionTime.ms", { n: s.best })],
    [t("reactionTime.worst"), t("reactionTime.ms", { n: s.worst })],
  ];
  const band = times.length >= REACTION_TRIES ? t(`reactionTime.band_${reactionBand(s.average)}`) : "";
  outEl.replaceChildren(...rows.flatMap(([k, v]) => [h("dt", null, k), h("dd", null, v)]));
  if (band) outEl.append(h("p", { class: "hint" }, band));
  last = `${times.map((ms, i) => `${i + 1}. ${t("reactionTime.ms", { n: ms })}`).join("\n")}\n${rows.map(([k, v]) => `${k}: ${v}`).join("\n")}${band ? `\n${band}` : ""}`;
  if (copyBtn) copyBtn.disabled = false;
}

async function copyOut(): Promise<void> {
  await copyWithFlash(copyBtn, last, { done: t("reactionTime.copied"), failed: t("reactionTime.copyFailed") });
}
