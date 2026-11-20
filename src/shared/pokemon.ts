// Pokémon type chart and nature lookups (cv.cm /pokemon-type-chart/ and /pokemon-natures/). Facts only, from
// pokemon-data.ts (generated from PokeAPI); the site shows no Pokémon images.
import { CHART, NATURES, STATS, TYPES, type PokemonStat, type PokemonType } from "./pokemon-data";
import { foldText } from "./search";

export { NATURES, STATS, TYPES, type PokemonStat, type PokemonType };

/** The multipliers a result groups by, strongest first (a dual type can take ×4 or ×¼). */
export const MULTIPLIERS = [4, 2, 1, 0.5, 0.25, 0] as const;
export type Multiplier = (typeof MULTIPLIERS)[number];

export const typeIndex = (t: PokemonType): number => TYPES.indexOf(t);

/** Damage multiplier of a move of type `attack` on a Pokémon of one or two types. */
export function multiplier(attack: PokemonType, defend: readonly PokemonType[]): number {
  const a = typeIndex(attack);
  return defend.reduce((m, d) => m * CHART[a][typeIndex(d)], 1);
}

/** Every attacking type grouped by how much it hurts this one- or two-type Pokémon. */
export function defenseGroups(defend: readonly PokemonType[]): Record<Multiplier, PokemonType[]> {
  const out = Object.fromEntries(MULTIPLIERS.map((m) => [m, [] as PokemonType[]])) as unknown as Record<Multiplier, PokemonType[]>;
  for (const a of TYPES) out[multiplier(a, defend) as Multiplier].push(a);
  return out;
}

/** Every defending (single) type grouped by how much a move of this type hurts it: 2, 1, 0.5, 0. */
export function offenseGroups(attack: PokemonType): Record<2 | 1 | 0.5 | 0, PokemonType[]> {
  const out: Record<2 | 1 | 0.5 | 0, PokemonType[]> = { 2: [], 1: [], 0.5: [], 0: [] };
  for (const d of TYPES) out[CHART[typeIndex(attack)][typeIndex(d)] as 2 | 1 | 0.5 | 0].push(d);
  return out;
}

/** "×4", "×½", "×¼", "×0": how the chart writes a multiplier. */
export function multiplierLabel(m: number): string {
  if (m === 0.5) return "×½";
  if (m === 0.25) return "×¼";
  return `×${m}`;
}

/** Two types as one canonical pair: no duplicate, second empty when it is the same as the first. */
export function typePair(a: PokemonType, b: PokemonType | null): PokemonType[] {
  return b && b !== a ? [a, b] : [a];
}

// ---- Pokédex search ----

/** One Pokédex row as stored in src/data/pokemon/<locale>.json: number, name, type indexes, English name if it differs. */
export type DexRow = [number, string, number[], string?];

export interface DexEntry {
  n: number;
  name: string;
  en: string;
  types: PokemonType[];
  /** searchKey of the name and of the English name, computed once when the chunk loads. */
  keys: [string, string];
  /** Another entry has the same name in this language (the three Paldean Tauros in ja): show the types beside it. */
  shared: boolean;
}

export function dexEntries(rows: readonly DexRow[]): DexEntry[] {
  // Distinct type sets per name: rows equal in name and types too show once (unique), so they don't count.
  const typeSets = new Map<string, Set<string>>();
  for (const [, name, t] of rows) {
    if (!typeSets.has(name)) typeSets.set(name, new Set());
    typeSets.get(name)!.add(t.join("/"));
  }
  return rows.map(([n, name, t, en]) => ({
    n, name, en: en ?? name, types: t.map((i) => TYPES[i]), keys: [searchKey(name), searchKey(en ?? name)],
    shared: typeSets.get(name)!.size > 1,
  }));
}

/**
 * The form a name is compared in: NFKC (full-width letters, half-width kana), lower case, hiragana as katakana (the
 * games write Pokémon names in katakana; people type either), no spaces, dots, apostrophes or hyphens.
 */
export function searchKey(s: string): string {
  // foldText (site search) drops Latin accents and lower-cases; kana voicing marks and Hangul survive it.
  return foldText(s)
    .replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60))
    // Nidoran♀ / Nidoran♂ as people type them: "nidoran f", "nidoran m".
    .replace(/♀/g, "f")
    .replace(/♂/g, "m")
    .replace(/[\s.'’\-‐・:：()（）]/g, "")
    // Hangul syllables as jamo, so one still being typed (한ㅋ) prefix-matches the finished name (한카리아스). Only
    // Hangul: decomposing kana would split off the voicing marks and let カ match ガ.
    .replace(/[\uac00-\ud7a3]+/g, (h) => h.normalize("NFD"));
}

/** Final consonant → the same consonant as the next syllable's initial (simple finals only). */
const FINAL_TO_INITIAL: Record<string, string> = {
  "\u11a8": "\u1100", "\u11a9": "\u1101", "\u11ab": "\u1102", "\u11ae": "\u1103", "\u11af": "\u1105", "\u11b7": "\u1106",
  "\u11b8": "\u1107", "\u11ba": "\u1109", "\u11bb": "\u110a", "\u11bc": "\u110b", "\u11bd": "\u110c", "\u11be": "\u110e",
  "\u11bf": "\u110f", "\u11c0": "\u1110", "\u11c1": "\u1111", "\u11c2": "\u1112",
};

/**
 * The keys a query may stand for. A Korean IME holds the next consonant as the last syllable's final while typing
 * (한카리 passes through 한칼), so a key ending in a final consonant also stands for that consonant starting a new one.
 */
function queryKeys(key: string): string[] {
  const alt = FINAL_TO_INITIAL[key.slice(-1)];
  return alt ? [key, key.slice(0, -1) + alt] : [key];
}

/** Entries minus later ones that read the same and have the same types (Mega Tatsugiri's three forms in ja). */
function unique(entries: readonly DexEntry[]): DexEntry[] {
  const seen = new Set<string>();
  return entries.filter((e) => {
    const k = `${e.name}|${e.types.join("/")}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/**
 * Pokédex entries matching a query, best first: a number ("445", "#0445") finds that number; otherwise names (in the
 * page language and in English) that start with the query come before names that only contain it, then by number.
 */
export function searchDex(entries: readonly DexEntry[], query: string, limit = 8): DexEntry[] {
  const q = query.normalize("NFKC").trim();
  if (!q) return [];
  if (isDexNumberQuery(q)) {
    const n = Number(q.replace("#", ""));
    return unique(entries.filter((e) => e.n === n)).slice(0, limit);
  }
  const key = searchKey(q);
  if (!key) return [];
  const keys = queryKeys(key);
  const scored: { e: DexEntry; score: number }[] = [];
  for (const e of entries) {
    const names = e.keys;
    const score = names.some((s) => s === key) ? 0
      : names.some((s) => keys.some((k) => s.startsWith(k))) ? 1
      : names.some((s) => keys.some((k) => s.includes(k))) ? 2 : -1;
    if (score >= 0) scored.push({ e, score });
  }
  // Array.sort is stable, and entries are in Pokédex order: species before their forms.
  return unique(scored.sort((x, y) => x.score - y.score).map((s) => s.e)).slice(0, limit);
}

/** Whether a query is a Pokédex number ("445", "#0445") rather than a name. */
export const isDexNumberQuery = (query: string): boolean => /^#?\d+$/.test(query.normalize("NFKC").trim());

/** "#0445": the National Pokédex number as the games print it. */
export const dexNumber = (n: number): string => `#${String(n).padStart(4, "0")}`;

// ---- Natures ----

/**
 * Stats in the games' own nature order (Attack, Defense, Speed, Sp. Atk, Sp. Def): nature number = 5 × raised + lowered,
 * so the chart's diagonal holds the five neutral natures (Hardy, Docile, Serious, Bashful, Quirky).
 */
export const NATURE_STATS: readonly PokemonStat[] = ["attack", "defense", "speed", "special-attack", "special-defense"];

export type Nature = (typeof NATURES)[number];

/** The nature that raises `up` and lowers `down` (a neutral nature when they are the same stat). */
export function natureFor(up: PokemonStat, down: PokemonStat): Nature {
  return NATURES[NATURE_STATS.indexOf(up) * 5 + NATURE_STATS.indexOf(down)];
}
