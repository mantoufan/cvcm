import { copyWithFlash } from "../copy";
import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { MAX_ENTRIES, indexAt, normalizeEntry, parseEntries, pickIndex, spinTarget } from "../../shared/wheel";
import { randomInt } from "../../shared/random";

const SVG = "http://www.w3.org/2000/svg";
const COLORS = ["#f4a9c6", "#fdf0f5", "#e86a9a", "#ffe3ee", "#c2336c", "#fbd3e2"];
const DARK_TEXT = new Set(["#fdf0f5", "#ffe3ee", "#fbd3e2", "#f4a9c6"]);
const SPIN_MS = 4200;

let entriesEl: HTMLTextAreaElement | null = null;
let removeEl: HTMLInputElement | null = null;
let dialEl: SVGSVGElement | null = null;
let spinBtn: HTMLButtonElement | null = null;
let outEl: HTMLElement | null = null;
let countEl: HTMLElement | null = null;
let historyEl: HTMLOListElement | null = null;
let copyBtn: HTMLButtonElement | null = null;
let rotation = 0;
let spinning = false;
let timer = 0;
let history: string[] = [];

export function mountWheel(host: HTMLElement): void {
  entriesEl = h("textarea", { rows: "9", "data-field": "entries", spellcheck: "false", "aria-label": t("wheel.entries"), onInput: () => paint() });
  entriesEl.value = t("wheel.sample");
  removeEl = h("input", { type: "checkbox", "data-field": "remove" });
  dialEl = document.createElementNS(SVG, "svg");
  dialEl.setAttribute("viewBox", "-100 -100 200 200");
  dialEl.setAttribute("class", "wheel-dial");
  dialEl.setAttribute("aria-hidden", "true");
  outEl = h("p", { class: "wheel-winner", "aria-live": "polite" });
  countEl = h("p", { class: "hint" });
  historyEl = h("ol", { class: "wheel-history" });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("wheel.back")),
      h("h1", null, t("wheel.title")),
      h("p", { class: "lede" }, t("wheel.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("wheel.entries")),
          entriesEl,
          countEl,
          h("label", { class: "check" }, removeEl, h("span", null, t("wheel.remove"))),
        ),
        h("div", { class: "stage-actions" },
          h("button", { type: "button", class: "btn ghost", "data-action": "shuffle", onClick: () => shuffle() }, t("wheel.shuffle")),
          h("button", { type: "button", class: "btn ghost", "data-action": "sort", onClick: () => sortEntries() }, t("wheel.sort")),
        ),
      ),
      h("div", { class: "rail wheel-stage" },
        h("div", { class: "wheel-wrap" }, h("span", { class: "wheel-pointer", "aria-hidden": "true" }), dialEl),
        h("div", { class: "stage-actions" },
          spinBtn = h("button", { type: "button", class: "btn", "data-action": "spin", onClick: () => spin() }, t("wheel.spin")),
          copyBtn = h("button", { type: "button", class: "btn ghost", onClick: () => void copyOut() }, t("wheel.copy")),
        ),
        outEl,
        h("h2", null, t("wheel.history")),
        historyEl,
      ),
    ),
  );
  paint();
}

export function unmountWheel(): void {
  window.clearTimeout(timer);
  entriesEl = removeEl = null;
  dialEl = null;
  spinBtn = copyBtn = null;
  outEl = countEl = historyEl = null;
  rotation = 0;
  spinning = false;
  history = [];
}

function entries(): string[] {
  return parseEntries(entriesEl?.value ?? "");
}

function paint(): void {
  if (!dialEl || !countEl || !spinBtn) return;
  const list = entries();
  countEl.textContent = t("wheel.count", { n: list.length, max: MAX_ENTRIES });
  spinBtn.disabled = spinning || list.length < 2;
  drawDial(list);
  // The last winner stays visible, also when removing it leaves fewer than two entries.
  if (!spinning && outEl) {
    outEl.textContent = [history.length ? t("wheel.winner", { name: history[0] }) : "", list.length < 2 ? t("wheel.needTwo") : ""].filter(Boolean).join(" ");
  }
}

function drawDial(list: string[]): void {
  if (!dialEl) return;
  dialEl.replaceChildren();
  const n = Math.max(list.length, 1);
  const seg = (2 * Math.PI) / n;
  const fontSize = n > 40 ? 5 : n > 20 ? 6.5 : n > 10 ? 8 : 10;
  const maxChars = n > 20 ? 12 : 16;
  for (let i = 0; i < n; i++) {
    // Angles run clockwise from the top: SVG y points down, so the top is −90°.
    const a0 = i * seg - Math.PI / 2;
    const a1 = a0 + seg;
    // The last slice would repeat the first colour when n ≡ 1 (mod 6); give it another so neighbours always differ.
    const color = list.length === 0 ? COLORS[1] : i > 0 && i === n - 1 && i % COLORS.length === 0 ? COLORS[3] : COLORS[i % COLORS.length];
    const shape = n === 1
      ? el("circle", { r: "96", fill: color })
      : el("path", {
        d: `M0 0 L${96 * Math.cos(a0)} ${96 * Math.sin(a0)} A96 96 0 ${seg > Math.PI ? 1 : 0} 1 ${96 * Math.cos(a1)} ${96 * Math.sin(a1)} Z`,
        fill: color,
        stroke: "#ffffff",
        "stroke-width": "0.8",
      });
    dialEl.append(shape);
    if (!list[i]) continue;
    const mid = (a0 + a1) / 2;
    const label = Array.from(list[i]);
    const text = el("text", {
      x: "88",
      y: "0",
      "text-anchor": "end",
      "dominant-baseline": "middle",
      "font-size": String(fontSize),
      fill: DARK_TEXT.has(color) ? "#2e2229" : "#ffffff",
      transform: `rotate(${(mid * 180) / Math.PI})`,
    });
    text.textContent = label.length > maxChars ? label.slice(0, maxChars - 1).join("") + "…" : list[i];
    dialEl.append(text);
  }
  dialEl.append(el("circle", { r: "11", fill: "#ffffff", stroke: "#f2dbe5", "stroke-width": "1.5" }));
}

function el(tag: string, attrs: Record<string, string>): SVGElement {
  const node = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

function spin(): void {
  const list = entries();
  if (spinning || list.length < 2 || !dialEl) return;
  const index = pickIndex(list.length);
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  // Reduced motion: less than one turn, briefly.
  rotation = spinTarget(rotation, index, list.length, randomInt(0, 999) / 1000, reduce ? 0 : 6);
  const ms = reduce ? 600 : SPIN_MS;
  spinning = true;
  if (spinBtn) spinBtn.disabled = true;
  // The dial must match the list the winner was drawn from until it lands.
  if (entriesEl) entriesEl.readOnly = true;
  if (outEl) outEl.textContent = t("wheel.spinning");
  dialEl.style.transition = `transform ${ms}ms cubic-bezier(0.17, 0.67, 0.12, 0.99)`;
  dialEl.style.transform = `rotate(${rotation}deg)`;
  timer = window.setTimeout(() => land(list), ms + 50);
}

function land(list: string[]): void {
  spinning = false;
  if (entriesEl) entriesEl.readOnly = false;
  const winner = list[indexAt(rotation, list.length)];
  history.unshift(winner);
  history = history.slice(0, 20);
  if (outEl) outEl.textContent = t("wheel.winner", { name: winner });
  if (historyEl) historyEl.replaceChildren(...history.map((name) => h("li", null, name)));
  if (removeEl?.checked && entriesEl) {
    // Drop one copy of the winner; the dial redraws without it (the pointer then sits on a neighbour, which is fine).
    const lines = entriesEl.value.split(/\r?\n/);
    const at = lines.findIndex((line) => normalizeEntry(line) === winner);
    if (at >= 0) lines.splice(at, 1);
    entriesEl.value = lines.join("\n");
  }
  paint();
}

/** Shuffle and Sort reorder the typed lines as they are (beyond 100 entries or 40 characters too), dropping blanks. */
function lines(): string[] {
  return (entriesEl?.value ?? "").split(/\r?\n/).map((line) => line.trim()).filter((line) => line !== "");
}

function shuffle(): void {
  if (!entriesEl || spinning) return;
  const list = lines();
  for (let i = list.length - 1; i > 0; i--) {
    const j = randomInt(0, i);
    [list[i], list[j]] = [list[j], list[i]];
  }
  entriesEl.value = list.join("\n");
  paint();
}

function sortEntries(): void {
  if (!entriesEl || spinning) return;
  entriesEl.value = lines().sort(new Intl.Collator(locale()).compare).join("\n");
  paint();
}

async function copyOut(): Promise<void> {
  await copyWithFlash(copyBtn, history[0] ?? "", { done: t("wheel.copied"), failed: t("wheel.copyFailed") });
}
