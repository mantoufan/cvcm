import { h } from "../dom";
import { locale, t } from "../i18n";
import { POKEMON_NAMES } from "../../shared/pokemon-data";
import { NATURES, NATURE_STATS, natureFor, type Nature, type PokemonStat } from "../../shared/pokemon";
import { copyButton, field } from "../academic/common";

const S = "pokemonNatures";
/** The pick the page opens with (rule 8): + Attack, − Sp. Atk = Adamant, the usual physical attacker's nature. */
export const START: readonly [PokemonStat, PokemonStat] = ["attack", "special-attack"];

export function mountPokemonNatures(host: HTMLElement): void {
  const loc = locale();
  const N = POKEMON_NAMES[loc];
  const en = POKEMON_NAMES.en;
  // Outside English, the English name follows in brackets: guides and team sheets online mostly use it.
  const natureName = (n: Nature) => (loc === "en" || N.natures[n.id] === en.natures[n.id] ? N.natures[n.id] : `${N.natures[n.id]} (${en.natures[n.id]})`);
  const statName = (s: PokemonStat) => N.stats[s];
  let last = "";

  const statSelect = (name: string, value: PokemonStat) => h("select", { "data-field": name, onChange: () => paint() },
    ...NATURE_STATS.map((s) => h("option", { value: s, selected: s === value }, statName(s))));
  const up = statSelect("up", START[0]);
  const down = statSelect("down", START[1]);
  const out = h("p", { class: "shape-main", "data-out": "nature" });
  const effect = h("p", { "data-out": "effect" });
  // Mints exist for the 20 natures that change stats, plus Serious among the neutral five.
  const mint = h("p", { class: "hint", "data-out": "mint" }, t(`${S}.mintNote`));

  // The 5 × 5 grid: rows raise a stat, columns lower one; the diagonal is the five natures that change nothing.
  const cells = new Map<string, HTMLTableCellElement>();
  const grid = h("div", { class: "pkt-chart-wrap" },
    h("table", { class: "pkt-chart pkn-grid", "data-out": "grid" },
      h("caption", null, t(`${S}.gridCaption`)),
      h("thead", null, h("tr", null, h("th", { scope: "col", class: "pkt-corner" }, t(`${S}.corner`)),
        ...NATURE_STATS.map((s) => h("th", { scope: "col" }, `−${statName(s)}`)))),
      h("tbody", null, ...NATURE_STATS.map((u) => h("tr", null,
        h("th", { scope: "row" }, `+${statName(u)}`),
        ...NATURE_STATS.map((d) => {
          const n = natureFor(u, d);
          const td = h("td", { class: n.up ? null : "pkn-neutral", "data-nature": n.id },
            h("button", { type: "button", class: "pkn-pick", onClick: () => { up.value = u; down.value = d; paint(); } }, N.natures[n.id]));
          cells.set(n.id, td);
          return td;
        }),
      ))),
    ),
  );

  // Every nature as a list in game order, with its English name, for readers who search the list rather than the grid.
  const listTable = h("div", { class: "pkt-chart-wrap" },
    h("table", { class: "si-table pkn-list", "data-out": "list" },
      h("thead", null, h("tr", null, ...[`${S}.colNature`, `${S}.colUp`, `${S}.colDown`].map((k) => h("th", { scope: "col" }, t(k))))),
      h("tbody", null, ...NATURES.map((n) => h("tr", null,
        h("th", { scope: "row" }, natureName(n)),
        // The column heads say raise / lower; the cells name the stat, so the page has one +10 % format (the result line's).
        h("td", null, n.up ? statName(n.up) : "—"),
        h("td", null, n.down ? statName(n.down) : "—"),
      ))),
    ),
  );

  function paint(): void {
    const n = natureFor(up.value as PokemonStat, down.value as PokemonStat);
    out.textContent = natureName(n);
    effect.textContent = n.up && n.down
      ? t(`${S}.effect`, { up: statName(n.up), down: statName(n.down) })
      : t(`${S}.neutral`);
    mint.hidden = !n.up && n.id !== "serious";
    for (const [id, td] of cells) td.classList.toggle("on", id === n.id);
    last = `${out.textContent}: ${effect.textContent}`;
  }

  host.append(
    h("header", { class: "tool-head" },
      h("h1", null, t(`${S}.title`)),
      h("p", { class: "lede" }, t(`${S}.privacyNote`)),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t(`${S}.findTitle`)),
          field(t(`${S}.up`), up),
          field(t(`${S}.down`), down),
        ),
        h("div", { class: "stage-actions" }, copyButton(S, () => last)),
      ),
      h("div", { class: "rail" },
        h("h2", null, t(`${S}.result`)),
        out, effect, mint,
      ),
    ),
    h("section", { class: "pkt-full" },
      h("h2", null, t(`${S}.gridTitle`)),
      h("p", { class: "hint" }, t(`${S}.gridHint`)),
      grid,
      h("h2", null, t(`${S}.listTitle`)),
      listTable,
      h("p", { class: "hint" }, t(`${S}.unofficial`)),
    ),
  );
  paint();
}

export function unmountPokemonNatures(): void {}
