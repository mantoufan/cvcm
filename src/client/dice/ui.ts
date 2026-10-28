import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { DICE_SIDES, MAX_COINS, MAX_DICE, flipCoins, rollDice, secureRandom } from "../../shared/dice";

let countEl: HTMLInputElement | null = null;
let sidesEl: HTMLSelectElement | null = null;
let coinsEl: HTMLInputElement | null = null;
let facesEl: HTMLElement | null = null;
let outEl: HTMLElement | null = null;
let copyBtn: HTMLButtonElement | null = null;
let last = "";

export function mountDice(host: HTMLElement): void {
  countEl = h("input", { type: "number", min: "1", max: String(MAX_DICE), step: "1", value: "2", "data-field": "count" });
  sidesEl = h("select", { "data-field": "sides" },
    ...DICE_SIDES.map((n) => h("option", { value: String(n), selected: n === 6 }, `d${n}`)),
  );
  sidesEl.value = "6";
  coinsEl = h("input", { type: "number", min: "1", max: String(MAX_COINS), step: "1", value: "1", "data-field": "coins" });
  facesEl = h("p", { class: "dice-faces", "aria-live": "polite" });
  outEl = h("dl", { class: "stats-grid timestamp-out" });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("dice.back")),
      h("h1", null, t("dice.title")),
      h("p", { class: "lede" }, t("dice.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("dice.options")),
          labeled(t("dice.count"), countEl),
          labeled(t("dice.sides"), sidesEl),
        ),
        h("div", { class: "stage-actions" },
          h("button", { type: "button", class: "btn", "data-action": "roll", onClick: () => roll() }, t("dice.roll")),
        ),
        h("fieldset", null,
          h("legend", null, t("dice.coinOptions")),
          labeled(t("dice.coins"), coinsEl),
        ),
        h("div", { class: "stage-actions" },
          h("button", { type: "button", class: "btn ghost", "data-action": "flip", onClick: () => flip() }, t("dice.flip")),
          copyBtn = h("button", { type: "button", class: "btn ghost", onClick: () => void copyOut() }, t("dice.copy")),
        ),
      ),
      h("div", { class: "rail" }, h("h2", null, t("dice.result")), facesEl, outEl),
    ),
  );
  paintEmpty();
}

export function unmountDice(): void {
  countEl = null;
  sidesEl = null;
  coinsEl = null;
  facesEl = null;
  outEl = null;
  copyBtn = null;
  last = "";
}

function labeled(label: string, control: HTMLElement): HTMLElement {
  return h("label", { class: "field" }, h("span", null, label), control);
}

function paintEmpty(): void {
  if (!facesEl || !outEl) return;
  last = "";
  facesEl.textContent = "";
  outEl.replaceChildren(h("p", { class: "muted" }, t("dice.hint")));
}

function roll(): void {
  if (!countEl || !sidesEl || !facesEl || !outEl) return;
  const out = rollDice(Number(countEl.value), Number(sidesEl.value), secureRandom);
  if (!out) {
    last = "";
    facesEl.textContent = "";
    outEl.replaceChildren(h("p", { class: "muted" }, t("dice.invalid")));
    return;
  }
  facesEl.textContent = out.rolls.join("  ");
  const rows: Array<[string, string]> = [
    [t("dice.dice"), `${out.rolls.length}d${out.sides}`],
    [t("dice.total"), String(out.total)],
    [t("dice.high"), String(Math.max(...out.rolls))],
    [t("dice.low"), String(Math.min(...out.rolls))],
  ];
  last = `${out.rolls.join(" ")}\n${rows.map((row) => `${row[0]}: ${row[1]}`).join("\n")}`;
  outEl.replaceChildren();
  for (const [label, value] of rows) outEl.append(h("dt", null, label), h("dd", null, value));
}

function flip(): void {
  if (!coinsEl || !facesEl || !outEl) return;
  const faces = flipCoins(Number(coinsEl.value), secureRandom);
  if (!faces) {
    last = "";
    facesEl.textContent = "";
    outEl.replaceChildren(h("p", { class: "muted" }, t("dice.invalidCoins")));
    return;
  }
  const names = faces.map((face) => t(`dice.${face}`));
  const heads = faces.filter((face) => face === "heads").length;
  facesEl.textContent = names.join("  ");
  const rows: Array<[string, string]> = [
    [t("dice.coins"), String(faces.length)],
    [t("dice.heads"), String(heads)],
    [t("dice.tails"), String(faces.length - heads)],
  ];
  last = `${names.join(" ")}\n${rows.map((row) => `${row[0]}: ${row[1]}`).join("\n")}`;
  outEl.replaceChildren();
  for (const [label, value] of rows) outEl.append(h("dt", null, label), h("dd", null, value));
}

async function copyOut(): Promise<void> {
  if (!last) return;
  try {
    await navigator.clipboard.writeText(last);
    if (copyBtn) copyBtn.textContent = t("dice.copied");
    window.setTimeout(() => {
      if (copyBtn) copyBtn.textContent = t("dice.copy");
    }, 1200);
  } catch { /* ignore */ }
}
