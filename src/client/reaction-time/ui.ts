import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { REACTION_TRIES, reactionBand, summarize, waitMs } from "../../shared/reaction";

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
  padEl = h("button", { type: "button", class: "reaction-pad", "data-action": "pad", "aria-live": "assertive", onPointerdown: (e: PointerEvent) => press(e), onKeydown: (e: KeyboardEvent) => key(e), onClick: (e: MouseEvent) => e.preventDefault() }, padTitle, padSub);
  listEl = h("ol", { class: "reaction-list" });
  outEl = h("dl", { class: "stats-grid" });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("reactionTime.back")),
      h("h1", null, t("reactionTime.title")),
      h("p", { class: "lede" }, t("reactionTime.privacyNote")),
    ),
    h("div", { class: "data-tool" },
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
  reset();
}

export function unmountReactionTime(): void {
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
  hit();
}

function key(e: KeyboardEvent): void {
  if (e.key !== " " && e.key !== "Enter") return;
  e.preventDefault();
  if (!e.repeat) hit();
}

function hit(): void {
  const now = performance.now();
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
      window.clearTimeout(waitTimer);
      window.cancelAnimationFrame(frame);
      show("early", t("reactionTime.earlyTitle"), t("reactionTime.earlySub"));
      return;
    case "go": {
      // goAt is 0 until the green frame is on screen; a press before that is too early.
      if (!goAt) return;
      const ms = Math.round(now - goAt);
      times.push(ms);
      paint();
      if (times.length >= REACTION_TRIES) {
        const s = summarize(times)!;
        show("done", t("reactionTime.ms", { n: s.average }), t("reactionTime.doneSub"));
      } else {
        show("shown", t("reactionTime.ms", { n: ms }), t("reactionTime.nextSub", { i: times.length, n: REACTION_TRIES }));
      }
    }
  }
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
}

async function copyOut(): Promise<void> {
  if (!last) return;
  try {
    await navigator.clipboard.writeText(last);
    if (copyBtn) copyBtn.textContent = t("reactionTime.copied");
    window.setTimeout(() => {
      if (copyBtn) copyBtn.textContent = t("reactionTime.copy");
    }, 1200);
  } catch { /* ignore */ }
}
