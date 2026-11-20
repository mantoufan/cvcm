import { h } from "../dom";
import { locale, t } from "../i18n";
import type { Locale } from "../../shared/locale";
import { POKEMON_NAMES, SPECIES_COUNT } from "../../shared/pokemon-data";
import {
  MULTIPLIERS, TYPES, defenseGroups, dexEntries, dexNumber, isDexNumberQuery, multiplier, multiplierLabel, offenseGroups, searchDex, typePair,
  type DexEntry, type DexRow, type PokemonType,
} from "../../shared/pokemon";
import { copyButton, field } from "../academic/common";

const S = "pokemonTypes";
/** The pair the page opens with (rule 8: the same markup every time): Grass / Poison, the first Pokémon's types. */
export const START: readonly [PokemonType, PokemonType | null] = ["grass", "poison"];

/**
 * Each language's Pokédex is its own chunk, fetched the first time a reader types in the search box (never at mount).
 * vi and id have no file: the games have no Vietnamese or Indonesian text, so those pages read en (loadDex).
 */
const DEX: Record<Exclude<Locale, "vi" | "id">, () => Promise<{ default: unknown }>> = {
  en: () => import("../../data/pokemon/en.json"),
  "zh-CN": () => import("../../data/pokemon/zh-CN.json"),
  "zh-TW": () => import("../../data/pokemon/zh-TW.json"),
  ja: () => import("../../data/pokemon/ja.json"),
  ko: () => import("../../data/pokemon/ko.json"),
  es: () => import("../../data/pokemon/es.json"),
};

let dexPromise: Promise<DexEntry[]> | null = null;
let dexFile: keyof typeof DEX | null = null;
export function loadDex(loc: Locale): Promise<DexEntry[]> {
  // en, vi and id read the same file: keep one parsed copy across them.
  const file = loc === "vi" || loc === "id" ? "en" : loc;
  if (!dexPromise || dexFile !== file) {
    dexFile = file;
    const p = DEX[file]().then((m) => dexEntries(m.default as DexRow[]));
    dexPromise = p;
    // A failed chunk (offline) may be retried on the next keystroke; an older language's failure leaves a newer one alone.
    p.catch(() => { if (dexPromise === p) dexPromise = null; });
  }
  return dexPromise;
}

const MULT_KEY: Record<number, string> = { 4: "x4", 2: "x2", 1: "x1", 0.5: "xHalf", 0.25: "xQuarter", 0: "x0" };

export function mountPokemonTypeChart(host: HTMLElement): void {
  const loc = locale();
  const names = POKEMON_NAMES[loc].types;
  const typeName = (x: PokemonType) => names[x];
  const list = (xs: readonly PokemonType[]) => xs.length ? xs.map(typeName).join(t(`${S}.sep`)) : t(`${S}.none`);
  let picked: DexEntry | null = null;
  /** The last chip chosen, kept while the name is edited: Enter on that exact name again keeps that form. */
  let chosen: DexEntry | null = null;
  let last = "";

  // Choosing a type by hand leaves the Pokémon behind: clear its name so Enter can't pick it again over the new types.
  const byHand = () => {
    seq++; // a search still waiting for the Pokédex must not bring its chips (or its Enter pick) back
    picked = chosen = null;
    search.value = "";
    matches.replaceChildren();
    // One type picked twice is one type: show the menus the way the result reads them.
    if (second.value === first.value) second.value = "";
    paint();
  };
  const first = h("select", { "data-field": "type1", onChange: byHand },
    ...TYPES.map((x) => h("option", { value: x, selected: x === START[0] }, typeName(x))));
  const second = h("select", { "data-field": "type2", onChange: byHand },
    h("option", { value: "", selected: START[1] === null }, t(`${S}.noSecond`)),
    ...TYPES.map((x) => h("option", { value: x, selected: x === START[1] }, typeName(x))));

  const search = h("input", {
    type: "text", inputmode: "search", enterkeyhint: "search", autocomplete: "off", spellcheck: "false", "data-field": "search",
    placeholder: t(`${S}.searchPlaceholder`), "aria-controls": "pkt-matches",
    onFocus: () => void loadDex(loc).catch(() => undefined),
    onInput: () => void find(),
    onKeydown: (e: KeyboardEvent) => {
      // The Enter that commits an IME conversion (がぶ → ガブ) is not "pick".
      if (e.key !== "Enter" || e.isComposing || e.keyCode === 229) return;
      e.preventDefault();
      // The box already holds the picked Pokémon: Enter keeps it (a shared name would otherwise re-pick its first form).
      if (chosen && search.value === chosen.name) {
        choose(chosen);
        return;
      }
      // Wait for this query's own matches (the Pokédex may still be loading), then take the best one.
      void find().then((found) => { if (found[0]) choose(found[0]); });
    },
  });
  // Not a live region: it is redrawn on every keystroke. The result heading announces the pick instead.
  const matches = h("div", { class: "chip-row pkt-matches", id: "pkt-matches", "data-out": "matches" });

  let seq = 0;
  /** Matches for the box's current text, shown as chips; [] when the text changed again before they arrived. */
  async function find(): Promise<DexEntry[]> {
    const q = search.value;
    const mine = ++seq;
    // Editing the name after a pick means the result no longer belongs to that Pokémon: keep the types, drop the name.
    if (picked && q !== picked.name) {
      picked = null;
      paint();
    }
    if (!q.trim()) { matches.replaceChildren(); return []; }
    let dex: DexEntry[];
    try {
      dex = await loadDex(loc);
    } catch {
      if (mine === seq) matches.replaceChildren(h("p", { class: "hint" }, t(`${S}.loadFailed`)));
      return [];
    }
    if (mine !== seq) return [];
    const found = searchDex(dex, q);
    matches.replaceChildren(...(found.length
      ? found.map((e) => h("button", { type: "button", class: "chip", "data-dex": String(e.n), onClick: () => choose(e) },
        `${dexNumber(e.n)} ${e.shared ? `${e.name} · ${e.types.map(typeName).join("/")}` : e.name}`))
      : [h("p", { class: "hint" }, isDexNumberQuery(q) ? t(`${S}.noNumber`, { max: SPECIES_COUNT }) : t(`${S}.noMatch`))]));
    return found;
  }

  function choose(e: DexEntry): void {
    seq++; // a find() still waiting for the Pokédex must not redraw the chips over this choice
    picked = chosen = e;
    first.value = e.types[0];
    second.value = e.types[1] ?? "";
    search.value = e.name;
    matches.replaceChildren();
    paint();
    // The chip that had focus is gone: put the reader back in the box rather than at the top of the page.
    search.focus();
  }

  const heading = h("p", { class: "shape-main", "aria-live": "polite", "data-out": "pair" });
  const defense = h("dl", { class: "stats-grid pkt-groups", "data-out": "defense" });
  const offense = h("div", { "data-out": "offense" });

  function paint(): void {
    const pair = typePair(first.value as PokemonType, (second.value || null) as PokemonType | null);
    const pairName = pair.map(typeName).join(" / ");
    heading.textContent = picked ? `${dexNumber(picked.n)} ${picked.name} · ${pairName}` : pairName;
    const groups = defenseGroups(pair);
    defense.replaceChildren();
    const lines: string[] = [heading.textContent];
    for (const m of MULTIPLIERS) {
      const xs = groups[m];
      // ×4 and ×¼ only exist for two types; empty bands are left out, but "weak to" always shows (even as "none").
      if (!xs.length && m !== 2) continue;
      const label = `${t(`${S}.${MULT_KEY[m]}`)} (${multiplierLabel(m)})`;
      defense.append(h("dt", null, label), h("dd", { "data-mult": String(m) }, list(xs)));
      lines.push(`${label}: ${list(xs)}`);
    }
    offense.replaceChildren(h("h3", null, t(`${S}.offenseTitle`)));
    lines.push("", t(`${S}.offenseTitle`));
    for (const a of pair) {
      const g = offenseGroups(a);
      // "No effect on" only when there is something; the first two rows always show (even as "none").
      const rows = ([[t(`${S}.superOn`), g[2], 2], [t(`${S}.notVeryOn`), g[0.5], 0.5], [t(`${S}.noEffectOn`), g[0], 0]] as [string, PokemonType[], number][])
        .filter(([, xs], i) => xs.length || i < 2);
      offense.append(
        h("h4", null, t(`${S}.movesOf`, { type: typeName(a) })),
        h("dl", { class: "stats-grid pkt-groups", "data-offense": a },
          ...rows.flatMap(([k, xs, m]) => [h("dt", null, k), h("dd", { "data-mult": String(m) }, list(xs))])),
      );
      lines.push(t(`${S}.movesOf`, { type: typeName(a) }), ...rows.map(([k, xs]) => `${k}: ${list(xs)}`));
    }
    last = lines.join("\n");
  }

  // The full chart: rows attack, columns defend. Blank cells are ×1, so the 2 / ½ / 0 cells stand out.
  const abbr = (x: PokemonType) => h("th", { scope: "col", title: typeName(x) }, h("span", null, typeName(x)));
  const chart = h("div", { class: "pkt-chart-wrap" },
    h("table", { class: "pkt-chart", "data-out": "chart" },
      h("caption", null, t(`${S}.chartCaption`)),
      h("thead", null, h("tr", null, h("th", { scope: "col", class: "pkt-corner" }, t(`${S}.corner`)), ...TYPES.map(abbr))),
      h("tbody", null, ...TYPES.map((a) => h("tr", null,
        h("th", { scope: "row" }, typeName(a)),
        ...TYPES.map((d) => {
          const m = multiplier(a, [d]);
          return h("td", { class: m === 2 ? "pkt-2" : m === 0.5 ? "pkt-half" : m === 0 ? "pkt-0" : null, title: `${typeName(a)} → ${typeName(d)} ${multiplierLabel(m)}` },
            m === 1 ? "" : m === 0.5 ? "½" : String(m));
        }),
      ))),
    ),
  );

  host.append(
    h("header", { class: "tool-head" },
      h("h1", null, t(`${S}.title`)),
      h("p", { class: "lede" }, t(`${S}.privacyNote`)),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t(`${S}.findTitle`)),
          field(t(`${S}.search`), search),
          matches,
          h("p", { class: "hint" }, t(`${S}.searchHint`)),
        ),
        h("fieldset", null,
          h("legend", null, t(`${S}.typesTitle`)),
          field(t(`${S}.type1`), first),
          field(t(`${S}.type2`), second),
        ),
        h("div", { class: "stage-actions" }, copyButton(S, () => last)),
      ),
      h("div", { class: "rail" },
        h("h2", null, t(`${S}.result`)),
        heading, defense, offense,
        h("p", { class: "hint" }, t(`${S}.abilityNote`)),
      ),
    ),
    h("section", { class: "pkt-full" },
      h("h2", null, t(`${S}.chartTitle`)),
      h("p", { class: "hint" }, t(`${S}.chartHint`)),
      chart,
      h("p", { class: "hint" }, t(`${S}.unofficial`)),
    ),
  );
  paint();
}

export function unmountPokemonTypeChart(): void {}
