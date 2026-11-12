import { copyWithFlash } from "../copy";
import { h, keepShortcutsOnClick, onScreen } from "../dom";
import { t } from "../i18n";
import { FLIP_COUNTS, HISTORY_MAX, extendStreaks, flipFairCoins, percentText, type CoinFace, type Streaks } from "../../shared/coin";

/** Length of the spin; a reduced-motion setting skips it. */
const SPIN_MS = 700;

let coinEl: HTMLButtonElement | null = null;
let faceEl: HTMLElement | null = null;
let resultEl: HTMLElement | null = null;
let countEl: HTMLSelectElement | null = null;
let byPointer = false;
let statsEl: HTMLElement | null = null;
let stripEl: HTMLElement | null = null;
let copyBtn: HTMLButtonElement | null = null;
let heads = 0;
let tails = 0;
let history: CoinFace[] = [];
let streaks: Streaks = { longest: null, current: null };
let spinTimer = 0;
let spinning = false;

export function mountCoinFlip(host: HTMLElement): void {
  heads = tails = 0;
  history = [];
  streaks = { longest: null, current: null };
  spinning = false;
  faceEl = h("span", { class: "coin-face" }, t("coinFlip.tapToFlip"));
  coinEl = h("button", { type: "button", class: "coin", "data-action": "flip", "aria-label": t("coinFlip.flip"), onClick: () => flip() }, faceEl);
  resultEl = h("p", { class: "coin-result", "aria-live": "polite", "data-out": "result" });
  // Picked with the mouse, focus leaves the list so Space and Enter flip as the hint says; the keyboard keeps its place.
  countEl = h("select", {
    "data-field": "count",
    onPointerdown: () => { byPointer = true; },
    // Esc or Tab: the list closed without a pick, so the next change is the keyboard's.
    onKeydown: (e: KeyboardEvent) => { if (e.key === "Escape" || e.key === "Tab") byPointer = false; },
    onBlur: () => { byPointer = false; },
    onChange: () => {
      if (byPointer) countEl?.blur();
      byPointer = false;
    },
  },
    ...FLIP_COUNTS.map((n) => h("option", { value: String(n), selected: n === 1 }, n === 1 ? t("coinFlip.one") : t("coinFlip.many", { n }))),
  );
  statsEl = h("dl", { class: "stats-grid", "data-out": "stats" });
  stripEl = h("p", { class: "coin-strip", "data-out": "history" });
  host.append(
    h("header", { class: "tool-head" },
      h("h1", null, t("coinFlip.title")),
      h("p", { class: "lede" }, t("coinFlip.privacyNote")),
    ),
    h("div", { class: "data-tool", onMousedown: (e: MouseEvent) => keepShortcutsOnClick(e) },
      h("div", { class: "rail coin-stage" },
        coinEl,
        resultEl,
        h("div", { class: "stage-actions" },
          h("button", { type: "button", class: "btn", "data-action": "flip-btn", onClick: () => flip() }, t("coinFlip.flip")),
        ),
        h("p", { class: "hint" }, t("coinFlip.hint")),
      ),
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("coinFlip.options")),
          h("label", { class: "field" }, h("span", null, t("coinFlip.count")), countEl),
        ),
        h("h2", null, t("coinFlip.stats")),
        statsEl,
        h("h2", null, t("coinFlip.history")),
        stripEl,
        h("div", { class: "stage-actions" },
          copyBtn = h("button", { type: "button", class: "btn ghost", "data-action": "copy", onClick: () => void copyOut() }, t("coinFlip.copy")),
          h("button", { type: "button", class: "btn ghost", "data-action": "reset", onClick: () => reset() }, t("coinFlip.reset")),
        ),
      ),
    ),
  );
  document.addEventListener("keydown", onKey);
  paint();
}

export function unmountCoinFlip(): void {
  document.removeEventListener("keydown", onKey);
  window.clearTimeout(spinTimer);
  coinEl = faceEl = resultEl = statsEl = stripEl = null;
  countEl = null;
  copyBtn = null;
  history = [];
  spinning = false;
}

function reducedMotion(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function faceName(face: CoinFace): string {
  return t(face === "heads" ? "coinFlip.heads" : "coinFlip.tails");
}

function flip(): void {
  if (spinning || !coinEl) return;
  const picked = Number(countEl?.value);
  const n = (FLIP_COUNTS as readonly number[]).includes(picked) ? picked : 1;
  const faces = flipFairCoins(n);
  const last = faces[faces.length - 1]!;
  const land = () => {
    spinning = false;
    coinEl?.classList.remove("spinning");
    for (const f of faces) {
      if (f === "heads") heads++;
      else tails++;
    }
    history.push(...faces);
    streaks = extendStreaks(streaks, faces);
    if (history.length > HISTORY_MAX) history = history.slice(-HISTORY_MAX);
    if (coinEl) coinEl.dataset.face = last;
    if (faceEl) faceEl.textContent = faceName(last);
    if (resultEl) {
      const up = faces.filter((f) => f === "heads").length;
      resultEl.textContent = n === 1 ? t("coinFlip.landed", { face: faceName(last) }) : t("coinFlip.landedMany", { n, heads: up, tails: n - up });
    }
    paint();
  };
  if (reducedMotion()) {
    land();
    return;
  }
  spinning = true;
  coinEl.classList.remove("spinning");
  // Restart the animation on every flip.
  void coinEl.offsetWidth;
  coinEl.classList.add("spinning");
  if (resultEl) resultEl.textContent = t("coinFlip.flipping");
  spinTimer = window.setTimeout(land, SPIN_MS);
}

function reset(): void {
  window.clearTimeout(spinTimer);
  spinning = false;
  heads = tails = 0;
  history = [];
  streaks = { longest: null, current: null };
  coinEl?.classList.remove("spinning");
  if (coinEl) delete coinEl.dataset.face;
  if (faceEl) faceEl.textContent = t("coinFlip.tapToFlip");
  if (resultEl) resultEl.textContent = "";
  paint();
}

function paint(): void {
  if (!statsEl || !stripEl) return;
  const total = heads + tails;
  const streak = (r: Streaks["longest"]) => (r ? t("coinFlip.streakValue", { n: r.length, face: faceName(r.face) }) : "—");
  const rows: Array<[string, string]> = [
    [t("coinFlip.heads"), `${heads} (${percentText(heads, total)})`],
    [t("coinFlip.tails"), `${tails} (${percentText(tails, total)})`],
    [t("coinFlip.total"), String(total)],
    [t("coinFlip.longest"), streak(streaks.longest)],
    [t("coinFlip.current"), streak(streaks.current)],
  ];
  statsEl.replaceChildren(...rows.flatMap(([k, v]) => [h("dt", null, k), h("dd", null, v)]));
  stripEl.textContent = history.length ? history.map((f) => t(f === "heads" ? "coinFlip.headsShort" : "coinFlip.tailsShort")).join(" ") : t("coinFlip.noFlips");
}

function onKey(e: KeyboardEvent): void {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key !== " " && e.key !== "Enter") return;
  const target = e.target as HTMLElement | null;
  const onPage = (!target || target === document.body || target === document.documentElement) && onScreen(coinEl);
  if (!onPage) return;
  e.preventDefault();
  if (!e.repeat) flip();
}

async function copyOut(): Promise<void> {
  if (!heads && !tails) return;
  const text = t("coinFlip.copyText", { heads, tails, total: heads + tails });
  await copyWithFlash(copyBtn, text, { done: t("coinFlip.copied"), failed: t("coinFlip.copyFailed") });
}
