"""Build the Pokémon tool data from PokeAPI's CSV tables (github.com/PokeAPI/pokeapi, data/v2/csv, BSD-3-Clause).

Usage: python3 scripts/build-pokemon-data.py <dir with the CSVs> <PokeAPI commit>

Writes
- src/shared/pokemon-data.ts: the 18 types and the type chart (Gen 6+), the 25 natures, and type, stat and nature names
  in the eight site languages;
- src/data/pokemon/<locale>.json: every Pokémon by National Pokédex number with its types and name, plus the forms whose
  types differ from the species' usual form (regional forms, Megas, Rotom...), loaded only when a reader searches.

Only facts are taken (numbers, names, types). No sprites or artwork: the site does not use any Pokémon images.
Pokémon games have no Vietnamese or Indonesian text, so vi and id use the English in-game names.
"""
import csv
import re
import json
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if len(sys.argv) != 3 or not re.fullmatch(r"[0-9a-f]{40}", sys.argv[2]):
    raise SystemExit("usage: build-pokemon-data.py <dir with PokeAPI's data/v2/csv files> <full 40-character commit SHA>")
SRC = Path(sys.argv[1])
COMMIT = sys.argv[2]

# Site locale → PokeAPI language ids, most preferred first. ja-hrkt (1) holds the kana names the games show.
LANG = {
    "en": ["9"], "ja": ["1", "11"], "ko": ["3"], "zh-CN": ["12"], "zh-TW": ["4"],
    "es": ["7", "14"], "vi": ["9"], "id": ["9"],
}
LOCALES = list(LANG)
TYPE_ORDER = ["normal", "fire", "water", "electric", "grass", "ice", "fighting", "poison", "ground", "flying",
              "psychic", "bug", "rock", "ghost", "dragon", "dark", "steel", "fairy"]
STATS = ["attack", "defense", "special-attack", "special-defense", "speed"]
# Battle-only or cosmetic variants a reader would not look up by name.
SKIP_FORM = ("-totem", "-gmax")


def rows(name):
    with open(SRC / f"{name}.csv", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def clean(s):
    # Full-width Latin letters and digits (超级喷火龙Ｘ) → ASCII; brackets and other punctuation stay as written.
    return re.sub(r"[Ａ-Ｚａ-ｚ０-９]", lambda m: unicodedata.normalize("NFKC", m.group()), s).strip()


def pick(by_lang, loc):
    for lang in LANG[loc]:
        if by_lang.get(lang):
            return clean(by_lang[lang])
    return None


def names_of(table, key):
    out = {}
    for r in rows(table):
        out.setdefault(r[key], {})[r["local_language_id"]] = r["name"]
    return out


types = {r["id"]: r["identifier"] for r in rows("types")}
type_id = {v: k for k, v in types.items()}
assert all(t in type_id for t in TYPE_ORDER), "PokeAPI type list changed"
idx = {t: i for i, t in enumerate(TYPE_ORDER)}

# chart[attacker][defender]: the damage multiplier (PokeAPI stores it ×100). Unlisted pairs are ×1.
chart = [[1.0] * 18 for _ in TYPE_ORDER]
for r in rows("type_efficacy"):
    a, d = types.get(r["damage_type_id"]), types.get(r["target_type_id"])
    if a in idx and d in idx:
        chart[idx[a]][idx[d]] = int(r["damage_factor"]) / 100

type_names = names_of("type_names", "type_id")
stat_names = names_of("stat_names", "stat_id")
nature_names = names_of("nature_names", "nature_id")
stat_ident = {r["id"]: r["identifier"] for r in rows("stats")}

natures = []
for r in sorted(rows("natures"), key=lambda r: int(r["game_index"])):
    up, down = stat_ident[r["increased_stat_id"]], stat_ident[r["decreased_stat_id"]]
    natures.append({"id": r["identifier"], "up": None if up == down else up, "down": None if up == down else down,
                    "pid": r["id"]})
assert len(natures) == 25

label = {}
for loc in LOCALES:
    label[loc] = {
        "types": {t: pick(type_names[type_id[t]], loc) for t in TYPE_ORDER},
        "stats": {s: pick(stat_names[k], loc) for k, s in stat_ident.items() if s in STATS},
        "natures": {n["id"]: pick(nature_names[n["pid"]], loc) for n in natures},
    }
    for part, values in label[loc].items():
        missing = [k for k, v in values.items() if not v]
        assert not missing, f"{loc} {part} missing {missing}"

# ---- Pokédex entries ----
species_names = {}
for r in rows("pokemon_species_names"):
    species_names.setdefault(r["pokemon_species_id"], {})[r["local_language_id"]] = r["name"]
ptypes = {}
for r in rows("pokemon_types"):
    ptypes.setdefault(r["pokemon_id"], []).append((int(r["slot"]), types[r["type_id"]]))
forms_by_pokemon = {r["pokemon_id"]: r for r in rows("pokemon_forms") if r["is_default"] == "1"}
form_names = {}
for r in rows("pokemon_form_names"):
    form_names.setdefault(r["pokemon_form_id"], {})[r["local_language_id"]] = r
pokemon = rows("pokemon")
default_of = {r["species_id"]: r["id"] for r in pokemon if r["is_default"] == "1"}


def type_list(pid):
    return [t for _, t in sorted(ptypes[pid])]


def entry_name(r, loc):
    """The species name, or for a form its full name: 'Alolan Ninetales', 'キュウコン（アローラのすがた）'."""
    sp = pick(species_names[r["species_id"]], loc)
    assert sp, f"{loc}: species {r['species_id']} has no name"
    if r["is_default"] == "1":
        return sp
    form = forms_by_pokemon.get(r["id"])
    fn = form_names.get(form["id"], {}) if form else {}
    for lang in LANG[loc]:
        got = fn.get(lang)
        if not got:
            continue
        if got["pokemon_name"]:
            return clean(got["pokemon_name"])
        if got["form_name"]:
            f = clean(got["form_name"])
            # "Heat Rotom", "加热洛托姆", "メガリザードンX" already carry the species name.
            return f if sp in f else (f"{sp}（{f}）" if loc in ("ja", "zh-CN", "zh-TW") else f"{sp} ({f})")
    en = fn.get("9")
    assert en, f"{r['identifier']}: no form name at all"
    en_full = clean(en["pokemon_name"] or en["form_name"])
    assert en_full, f"{r['identifier']}: empty English form name"
    if loc in ("en", "vi", "id"):
        return en_full
    # No form name in this language yet: the local species name, so a search for it still finds the form.
    print(f"warning: {loc} has no name for {r['identifier']}; using the English form name", file=sys.stderr)
    form = clean(en["form_name"]) or en_full
    return f"{sp}（{form}）" if loc in ("ja", "zh-CN", "zh-TW") else f"{sp} ({form})"


dex = {loc: [] for loc in LOCALES}
aliases = {}
for r in sorted(pokemon, key=lambda r: (int(r["species_id"]), r["is_default"] != "1", int(r["id"]))):
    if r["is_default"] != "1":
        if r["identifier"].endswith(SKIP_FORM) or "-totem-" in r["identifier"]:
            continue
        # Forms with the usual types add nothing to a weakness lookup, except Megas and Primal forms, which readers
        # search by name ("Mega Charizard Y"); cosmetic forms (Vivillon patterns, Pikachu caps) are left out.
        form = forms_by_pokemon.get(r["id"])
        battle_name = (form and form["is_mega"] == "1") or "-primal" in r["identifier"]
        if type_list(r["id"]) == type_list(default_of[r["species_id"]]) and not battle_name:
            # Same types as the species: no row of its own, but its name ("Black Kyurem", "Origin Giratina") finds the
            # species row, whose types are the answer.
            form_row = forms_by_pokemon.get(r["id"])
            if form_row and "9" in form_names.get(form_row["id"], {}):  # some forms (Koraidon's builds) have no name
                for loc in LOCALES:
                    aliases.setdefault((int(r["species_id"]), loc), []).extend([entry_name(r, loc), entry_name(r, "en")])
            continue
    t = [idx[x] for x in type_list(r["id"])]
    en_name = entry_name(r, "en")
    for loc in LOCALES:
        name = entry_name(r, loc)
        dex[loc].append({"n": int(r["species_id"]), "name": name, "en": en_name, "t": t})

# Exact repeats (male and female Mega Meowstic: same name, same types) are one row, dropped in every language alike.
# Other forms may share a name in one language (the three Paldean Tauros in ja): the page adds their types
# (dexEntries), and rows equal in name and types there too (Mega Tatsugiri's forms in ja) show once (searchDex).
seen_en, keep = set(), []
for i, e in enumerate(dex["en"]):
    k = (e["n"], e["name"], tuple(e["t"]))
    if k not in seen_en:
        seen_en.add(k)
        keep.append(i)
for loc in LOCALES:
    dex[loc] = [dex[loc][i] for i in keep]

out_dir = ROOT / "src/data/pokemon"
out_dir.mkdir(parents=True, exist_ok=True)
for loc in LOCALES:
    # Compact rows: [number, name, type index, type index?] and the English name only where it differs (search).
    if loc in ("vi", "id"):
        continue  # same as en: the page loads the English file (pokemon-type-chart/ui.ts)
    en_names = [e["name"] for e in dex["en"]]
    data, first_row = [], set()
    for e, en in zip(dex[loc], en_names):
        row = [e["n"], e["name"], e["t"]]
        # Other names that find this row: forms with the species' own types (only on the species' first row).
        extra = [] if e["n"] in first_row else list(dict.fromkeys(
            a for a in aliases.get((e["n"], loc), []) if a not in (e["name"], en)))
        first_row.add(e["n"])
        if en != e["name"] or extra:
            row.append(en if en != e["name"] else 0)
        if extra:
            row.append(extra)
        data.append(row)
    (out_dir / f"{loc}.json").write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")

species_count = len({e["n"] for e in dex["en"]})


def ts(v):
    return json.dumps(v, ensure_ascii=False)


lines = [
    "// Generated by scripts/build-pokemon-data.py from PokeAPI's CSV tables (BSD-3-Clause), commit " + COMMIT + ".",
    "// Do not edit by hand: rerun the script. Facts only (types, numbers, names); no Pokémon images anywhere on the site.",
    'import type { Locale } from "./locale";',
    "",
    f"export const POKEAPI_COMMIT = {ts(COMMIT)};",
    f"/** Species in the National Pokédex at that commit. */",
    f"export const SPECIES_COUNT = {species_count};",
    f"export const TYPES = {ts(TYPE_ORDER)} as const;",
    "export type PokemonType = (typeof TYPES)[number];",
    "/** CHART[attacker][defender]: the damage multiplier of a move of one type on a Pokémon of the other (Gen 6 on). */",
    "export const CHART: readonly (readonly number[])[] = [",
    *[f"  {ts(row)}, // {TYPE_ORDER[i]}" for i, row in enumerate(chart)],
    "];",
    f"export const STATS = {ts(STATS)} as const;",
    "export type PokemonStat = (typeof STATS)[number];",
    "/** The 25 natures in game order: +10 % to one stat and −10 % to another; five change nothing. */",
    "export const NATURES: readonly { id: string; up: PokemonStat | null; down: PokemonStat | null }[] = [",
    *[f"  {{ id: {ts(n['id'])}, up: {ts(n['up'])}, down: {ts(n['down'])} }}," for n in natures],
    "];",
    "type Names = { types: Record<PokemonType, string>; stats: Record<PokemonStat, string>; natures: Record<string, string> };",
    f"const EN: Names = {ts(label['en'])};",
    "/** In-game names of types, stats and natures per site language (vi and id: English, as the games show). */",
    "export const POKEMON_NAMES: Record<Locale, Names> = {",
    *[f"  {ts(loc)}: {'EN' if label[loc] == label['en'] else ts(label[loc])}," for loc in LOCALES],
    "};",
    "",
]
(ROOT / "src/shared/pokemon-data.ts").write_text("\n".join(lines), encoding="utf-8")
print(f"{species_count} species, {len(dex['en'])} entries; types, natures and names for {len(LOCALES)} locales")
