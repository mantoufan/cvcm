// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadDex, mountPokemonTypeChart, START as TYPE_START } from "../src/client/pokemon-type-chart/ui";
import { mountPokemonNatures, START as NATURE_START } from "../src/client/pokemon-natures/ui";
import { setLocale } from "../src/client/i18n";
import { LOCALES } from "../src/shared/locale";
import { POKEMON_NAMES, SPECIES_COUNT } from "../src/shared/pokemon-data";
import {
  NATURES, NATURE_STATS, TYPES, defenseGroups, dexEntries, dexNumber, multiplier, multiplierLabel, natureFor,
  offenseGroups, searchDex, searchKey, type DexRow,
} from "../src/shared/pokemon";

// vi and id load the English file (the games have no Vietnamese or Indonesian text).
const dexFile = (loc: string) => (loc === "vi" || loc === "id" ? "en" : loc);
const dex = (loc: string) => dexEntries(JSON.parse(readFileSync(resolve(__dirname, `../src/data/pokemon/${dexFile(loc)}.json`), "utf8")) as DexRow[]);

describe("type chart", () => {
  it("has the immunities every player knows", () => {
    expect(multiplier("electric", ["ground"])).toBe(0);
    expect(multiplier("normal", ["ghost"])).toBe(0);
    expect(multiplier("fighting", ["ghost"])).toBe(0);
    expect(multiplier("ghost", ["normal"])).toBe(0);
    expect(multiplier("ground", ["flying"])).toBe(0);
    expect(multiplier("psychic", ["dark"])).toBe(0);
    expect(multiplier("poison", ["steel"])).toBe(0);
    expect(multiplier("dragon", ["fairy"])).toBe(0);
    const zeros = TYPES.flatMap((a) => TYPES.filter((d) => multiplier(a, [d]) === 0));
    expect(zeros).toHaveLength(8);
  });
  it("counts the usual totals: 51 super effective and 61 not very effective pairs", () => {
    const all = TYPES.flatMap((a) => TYPES.map((d) => multiplier(a, [d])));
    expect(all.filter((m) => m === 2)).toHaveLength(51);
    expect(all.filter((m) => m === 0.5)).toHaveLength(61);
  });
  it("multiplies a dual type: Bulbasaur, Garchomp", () => {
    const grassPoison = defenseGroups(["grass", "poison"]);
    expect(grassPoison[2].sort()).toEqual(["fire", "flying", "ice", "psychic"]);
    expect(grassPoison[0.25]).toEqual(["grass"]);
    expect(grassPoison[0.5].sort()).toEqual(["electric", "fairy", "fighting", "water"]);
    const garchomp = defenseGroups(["dragon", "ground"]);
    expect(garchomp[4]).toEqual(["ice"]);
    expect(garchomp[0]).toEqual(["electric"]);
    expect(offenseGroups("fire")[2]).toEqual(["grass", "ice", "bug", "steel"]);
    expect(multiplierLabel(0.25)).toBe("×¼");
  });
});

describe("natures", () => {
  it("puts each raise and drop in exactly one nature, with the neutral five on the diagonal", () => {
    expect(new Set(NATURE_STATS.flatMap((u) => NATURE_STATS.map((d) => natureFor(u, d).id))).size).toBe(25);
    expect(NATURE_STATS.map((s) => natureFor(s, s).id)).toEqual(["hardy", "docile", "serious", "bashful", "quirky"]);
    expect(natureFor("attack", "special-attack").id).toBe("adamant");
    expect(natureFor("speed", "special-attack").id).toBe("jolly");
    expect(natureFor("special-attack", "attack").id).toBe("modest");
    expect(natureFor("speed", "attack").id).toBe("timid");
    expect(natureFor("special-attack", "speed").id).toBe("quiet");
    for (const n of NATURES) if (n.up) expect(natureFor(n.up, n.down!)).toBe(n);
  });
});

describe("Pokédex data", () => {
  it("lists every species in every language, in order, with names", () => {
    const en = dex("en");
    expect(SPECIES_COUNT).toBe(1025);
    for (const loc of LOCALES) {
      const rows = dex(loc);
      expect(rows.map((e) => e.n), loc).toEqual(en.map((e) => e.n));
      expect(new Set(rows.map((e) => e.n)).size, loc).toBe(SPECIES_COUNT);
      expect(rows.every((e) => e.name && e.types.length >= 1 && e.types.length <= 2), loc).toBe(true);
      expect(rows.map((e) => e.en), loc).toEqual(en.map((e) => e.name));
      // No two search results look alike: a shared name is shown with its types, and exact repeats show once.
      for (const e of rows) {
        const hits = searchDex(rows, e.name, 50).filter((x) => x.name === e.name);
        const labels = hits.map((x) => (x.shared ? `${x.name}|${x.types.join("/")}` : x.name));
        expect(new Set(labels).size, `${loc} ${e.name}`).toBe(labels.length);
      }
    }
    const tauros = dex("ja").filter((e) => e.n === 128);
    expect(tauros.map((e) => e.shared)).toEqual([false, true, true, true]);
    expect(tauros[2].types).toEqual(["fighting", "fire"]);
    // Megas and Primal forms are found by name even when their types are the usual ones.
    expect(searchDex(dex("en"), "mega charizard y")[0].types).toEqual(["fire", "flying"]);
    expect(searchDex(dex("en"), "primal kyogre")[0].types).toEqual(["water"]);
    // Forms with no name in a language yet still carry the local species name, so searching it finds them.
    expect(searchDex(dex("ko"), "켄타로스").map((e) => e.en)).toContain("Paldean Tauros (Blaze Breed)");
    expect(POKEMON_NAMES.id.natures).toEqual(POKEMON_NAMES.en.natures);
  });
  it("finds by name in the page language or English, by hiragana, and by number", () => {
    const ja = dex("ja");
    expect(searchDex(ja, "がぶりあす")[0].en).toBe("Garchomp");
    expect(searchDex(ja, "Garchomp")[0].name).toBe("ガブリアス");
    expect(searchDex(ja, "#0445").map((e) => e.en)).toEqual(["Garchomp", "Mega Garchomp", "Mega Garchomp Z"]);
    const en = dex("en");
    expect(searchDex(en, "flabebe")[0].name).toBe("Flabébé");
    expect(searchDex(en, "farfetchd")[0].name).toBe("Farfetch’d");
    expect(searchDex(en, "mr mime")[0].name).toBe("Mr. Mime");
    expect(searchDex(en, "alolan ninetales")[0].types).toEqual(["ice", "fairy"]);
    expect(searchDex(dex("zh-CN"), "烈咬")[0].en).toBe("Garchomp");
    expect(searchDex(dex("ko"), "한카리아스")[0].en).toBe("Garchomp");
    // A Korean syllable still being typed (한 + ㅋ) already matches.
    expect(searchDex(dex("ko"), "한ㅋ")[0].en).toBe("Garchomp");
    expect(searchDex(en, "   ")).toEqual([]);
    expect(searchKey("ＰＩＫＡ")).toBe("pika");
    expect(dexNumber(25)).toBe("#0025");
  });
});

let host: HTMLElement;
beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
});
afterEach(() => {
  host.remove();
  setLocale("en");
});
const q = <T extends HTMLElement>(sel: string) => host.querySelector<T>(sel)!;
const text = (sel: string) => q(sel).textContent ?? "";

describe("type chart page", () => {
  it("opens on Grass / Poison with the full 18 × 18 chart", () => {
    mountPokemonTypeChart(host);
    expect(TYPE_START).toEqual(["grass", "poison"]);
    expect(text("[data-out=pair]")).toBe("Grass / Poison");
    expect(text("[data-out=defense]")).toContain("Weak to (×2)Fire, Ice, Flying, Psychic");
    expect(text("[data-out=defense]")).toContain("Strongly resists (×¼)Grass");
    expect(host.querySelectorAll("[data-out=chart] tbody tr")).toHaveLength(18);
    expect(host.querySelectorAll("[data-out=chart] tbody tr:first-child td")).toHaveLength(18);
    expect(host.querySelectorAll("[data-out=chart] td.pkt-0")).toHaveLength(8);
  });
  it("picks a Pokémon from the search and shows its types", async () => {
    mountPokemonTypeChart(host);
    const input = q<HTMLInputElement>("[data-field=search]");
    input.value = "garchomp";
    input.dispatchEvent(new Event("input"));
    await loadDex("en");
    await new Promise((r) => setTimeout(r, 0));
    q<HTMLButtonElement>("[data-dex='445']").click();
    expect(text("[data-out=pair]")).toBe("#0445 Garchomp · Dragon / Ground");
    expect(text("[data-out=defense]")).toContain("Very weak to (×4)Ice");
    expect(text("[data-out=defense]")).toContain("Immune to (×0)Electric");
    // Editing the name drops it from the heading; picking again brings it back.
    input.value = "pikach";
    input.dispatchEvent(new Event("input"));
    expect(text("[data-out=pair]")).toBe("Dragon / Ground");
    input.value = "garchomp";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    expect(text("[data-out=pair]")).toBe("#0445 Garchomp · Dragon / Ground");
    // A number no Pokémon has says so (not "no Pokémon by that name").
    input.value = "1999";
    input.dispatchEvent(new Event("input"));
    await new Promise((r) => setTimeout(r, 0));
    expect(text("[data-out=matches]")).toBe("No Pokémon has that number (1–1025).");
    // Changing a type by hand drops the Pokémon's name.
    const t2 = q<HTMLSelectElement>("[data-field=type2]");
    t2.value = "";
    t2.dispatchEvent(new Event("change"));
    expect(text("[data-out=pair]")).toBe("Dragon");
  });
  it("renders in every language", () => {
    for (const loc of LOCALES) {
      setLocale(loc);
      host.replaceChildren();
      mountPokemonTypeChart(host);
      expect(text("[data-out=pair]"), loc).toBe(`${POKEMON_NAMES[loc].types.grass} / ${POKEMON_NAMES[loc].types.poison}`);
      expect(text("h1"), loc).not.toMatch(/pokemonTypes\./);
    }
  });
});

describe("nature chart page", () => {
  it("opens on Adamant, and a grid tap picks another nature", () => {
    mountPokemonNatures(host);
    expect(NATURE_START).toEqual(["attack", "special-attack"]);
    expect(text("[data-out=nature]")).toBe("Adamant");
    expect(text("[data-out=effect]")).toBe("Attack +10 %, Special Attack −10 %.");
    expect(q("[data-nature=adamant]").classList.contains("on")).toBe(true);
    expect(host.querySelectorAll("[data-out=list] tbody tr")).toHaveLength(25);
    q<HTMLButtonElement>("[data-nature=timid] button").click();
    expect(text("[data-out=nature]")).toBe("Timid");
    expect(q("[data-out=mint]").hidden).toBe(false);
    q<HTMLButtonElement>("[data-nature=serious] button").click();
    expect(text("[data-out=effect]")).toBe("Neutral: no stat goes up or down.");
    // Serious is the one neutral nature with a mint.
    expect(q("[data-out=mint]").hidden).toBe(false);
    q<HTMLButtonElement>("[data-nature=hardy] button").click();
    expect(q("[data-out=mint]").hidden).toBe(true);
  });
  it("names the stat in the list cells; the column heads say raise or lower", () => {
    mountPokemonNatures(host);
    const adamant = [...host.querySelectorAll("[data-out=list] tbody tr")].find((r) => r.textContent?.startsWith("Adamant"))!;
    expect([...adamant.querySelectorAll("td")].map((td) => td.textContent)).toEqual(["Attack", "Special Attack"]);
  });
  it("adds the English name outside English", () => {
    setLocale("ja");
    mountPokemonNatures(host);
    expect(text("[data-out=nature]")).toBe("いじっぱり (Adamant)");
    setLocale("vi");
    host.replaceChildren();
    mountPokemonNatures(host);
    expect(text("[data-out=nature]")).toBe("Adamant");
  });
});
