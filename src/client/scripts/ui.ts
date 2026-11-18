import { copyWithFlash } from "../copy";
import type { Locale } from "../../shared/locale";
import type { ScriptId } from "../../shared/scripts";
import { isGenerator, scriptCopy, scriptsUi, type GeneratorPools } from "../../shared/scripts-i18n";
import { GEN_START, premise, scriptsPageHtml } from "../../shared/scripts-page";

type Part = keyof GeneratorPools;
const PARTS: readonly Part[] = ["hero", "want", "obstacle", "twist", "setting", "format"];

/** The scripts hub (null) or one entry, plus the copy buttons and, on the generator page, the generator. */
export function mountScripts(host: HTMLElement, locale: Locale, id: ScriptId | null): void {
  host.innerHTML = scriptsPageHtml(locale, id);
  const ui = scriptsUi(locale);
  const labels = { done: ui.copied, failed: ui.copyFailed };
  for (const btn of host.querySelectorAll<HTMLButtonElement>("button[data-copy]")) {
    btn.hidden = false;
    btn.addEventListener("click", () => {
      const target = host.querySelector<HTMLElement>(`#${btn.dataset.copy}`);
      void copyWithFlash(btn, target ? plainText(target) : "", labels);
    });
  }
  if (id) {
    const copy = scriptCopy(locale, id);
    const root = host.querySelector<HTMLElement>("[data-scripts-gen]");
    if (root && isGenerator(copy)) wireGenerator(root, copy.template, copy.pools, labels);
  }
}

/** A script block as plain text, one paragraph per line (the "(how)" parenthetical kept beside the speaker). */
function plainText(el: HTMLElement): string {
  const lines = [...el.querySelectorAll<HTMLElement>(":scope > p")];
  if (!lines.length) return (el.textContent ?? "").trim();
  return lines.map((p) => {
    const who = p.querySelector(".sc-who");
    if (!who) return (p.textContent ?? "").trim();
    const how = p.querySelector(".sc-how")?.textContent ?? "";
    const say = p.querySelector(".sc-say")?.textContent ?? "";
    return `${who.textContent}${how ? ` ${how}` : ""}: ${say}`;
  }).join("\n\n");
}

function randomIndex(n: number, not = -1): number {
  if (n <= 1) return 0;
  let i = Math.floor(Math.random() * n);
  if (i === not) i = (i + 1 + Math.floor(Math.random() * (n - 1))) % n;
  return i;
}

function wireGenerator(root: HTMLElement, template: string, pools: GeneratorPools, labels: { done: string; failed: string }): void {
  const out = root.querySelector<HTMLElement>("[data-gen-out]");
  const format = root.querySelector<HTMLElement>("[data-gen-format]");
  if (!out || !format) return;
  // Same picks as the server-rendered premise, so nothing changes until the reader asks for a new one.
  const pick: Record<Part, number> = { ...GEN_START };
  const paint = (): void => {
    out.textContent = premise(template, pools, pick);
    format.textContent = pools.format[pick.format % pools.format.length];
  };
  const reroll = (part: Part): void => {
    pick[part] = randomIndex(pools[part].length, pick[part]);
  };
  for (const el of root.querySelectorAll<HTMLElement>("[data-gen-controls]")) el.hidden = false;
  root.querySelector("[data-gen-roll]")?.addEventListener("click", () => {
    for (const part of PARTS) reroll(part);
    paint();
  });
  for (const btn of root.querySelectorAll<HTMLButtonElement>("button[data-gen-part]")) {
    const part = btn.dataset.genPart as Part;
    if (!PARTS.includes(part)) continue;
    btn.addEventListener("click", () => {
      reroll(part);
      paint();
    });
  }
  const copyBtn = root.querySelector<HTMLButtonElement>("[data-gen-copy]");
  copyBtn?.addEventListener("click", () => {
    void copyWithFlash(copyBtn, `${out.textContent ?? ""}\n${format.textContent ?? ""}`, labels);
  });
}
