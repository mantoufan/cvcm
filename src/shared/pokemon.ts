// Pokémon type chart and nature lookups (cv.cm /pokemon-type-chart/ and /pokemon-natures/). Facts only, from
// pokemon-data.ts (generated from PokeAPI); the site shows no Pokémon images.
import { CHART, NATURES, STATS, TYPES, type PokemonStat, type PokemonType } from "./pokemon-data";

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
}

export function dexEntries(rows: readonly DexRow[]): DexEntry[] {
  return rows.map(([n, name, t, en]) => ({ n, name, en: en ?? name, types: t.map((i) => TYPES[i]) }));
}

/**
 * The form a name is compared in: NFKC (full-width letters, half-width kana), lower case, hiragana as katakana (the
 * games write Pokémon names in katakana; people type either), no spaces, dots, apostrophes or hyphens.
 */
export function searchKey(s: string): string {
  return s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60))
    // Drop Latin accents (Flabébé, Pokémon); kana voicing marks and Hangul recompose under NFC.
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .normalize("NFC")
    .replace(/[\s.'’\-‐・:：()（）]/g, "");
}

/**
 * Pokédex entries matching a query, best first: a number ("445", "#0445") finds that number; otherwise names (in the
 * page language and in English) that start with the query come before names that only contain it, then by number.
 */
export function searchDex(entries: readonly DexEntry[], query: string, limit = 8): DexEntry[] {
  const q = query.normalize("NFKC").trim();
  if (!q) return [];
  const num = /^#?0*(\d{1,4})$/.exec(q);
  if (num) return entries.filter((e) => e.n === Number(num[1])).slice(0, limit);
  const key = searchKey(q);
  if (!key) return [];
  const scored: { e: DexEntry; score: number }[] = [];
  for (const e of entries) {
    const names = [searchKey(e.name), searchKey(e.en)];
    const score = names.some((s) => s === key) ? 0 : names.some((s) => s.startsWith(key)) ? 1 : names.some((s) => s.includes(key)) ? 2 : -1;
    if (score >= 0) scored.push({ e, score });
  }
  // Array.sort is stable, and entries are in Pokédex order: species before their forms.
  return scored.sort((x, y) => x.score - y.score).slice(0, limit).map((s) => s.e);
}

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
