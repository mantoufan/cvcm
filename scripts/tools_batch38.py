"""Merge scripts/tools-src/batch38/<tool>/<locale>.json (career tools: resignation letter, cover letter, résumé builder,
ID photo) into the locale packs (meta, tools, faq, tool UI) and guides, and add the `career` nav label."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "scripts/tools-src/batch38"
LOCALES = ["en", "es", "id", "ja", "ko", "vi", "zh-CN", "zh-TW"]
TOOLS = ["resignation-letter", "cover-letter", "resume-builder", "id-photo"]
NAV = {
    "en": "Jobs & careers",
    "es": "Empleo",
    "id": "Karier",
    "ja": "就職・転職",
    "ko": "취업",
    "vi": "Việc làm",
    "zh-CN": "求职",
    "zh-TW": "求職",
}
PARTS = ("meta", "tools", "faq", "guides", "ui")
# --partial merges only the tools whose copy exists (while the batch is being written); the final run is strict.
if "--partial" in sys.argv:
    TOOLS = [t for t in TOOLS if (SRC / t / "en.json").exists() and all((SRC / t / f"{l}.json").exists() for l in LOCALES)]


def write(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def load(tool: str, loc: str) -> dict:
    path = SRC / tool / f"{loc}.json"
    if not path.exists():
        raise SystemExit(f"{tool}/{loc}: {path.name} is missing; every locale needs the batch copy")
    return json.loads(path.read_text(encoding="utf-8"))


def keys(value, prefix=""):
    """Every leaf key path, so a translation that drops or adds a nested string is caught."""
    if isinstance(value, dict):
        out = set()
        for k, v in value.items():
            out |= keys(v, f"{prefix}.{k}" if prefix else k)
        return out
    return {prefix}


for tool in TOOLS:
    en = load(tool, "en")
    for loc in LOCALES:
        src = load(tool, loc)
        for part in PARTS:
            if keys(src.get(part, {})) != keys(en.get(part, {})):
                missing = keys(en.get(part, {})) - keys(src.get(part, {}))
                extra = keys(src.get(part, {})) - keys(en.get(part, {}))
                raise SystemExit(f"{tool}/{loc}: {part} keys differ from en (missing {sorted(missing)[:5]}, extra {sorted(extra)[:5]})")

for loc in LOCALES:
    pack_path = ROOT / f"src/locales/{loc}.json"
    pack = json.loads(pack_path.read_text(encoding="utf-8"))
    guide_path = ROOT / f"src/locales/guides/{loc}.json"
    guides = json.loads(guide_path.read_text(encoding="utf-8"))
    pack["nav"]["career"] = NAV[loc]
    for tool in TOOLS:
        src = load(tool, loc)
        pack["meta"].update(src["meta"])
        pack["tools"].update(src["tools"])
        pack["faq"].update(src["faq"])
        for section, strings in src["ui"].items():
            pack[section] = strings
        guides["tools"].update(src["guides"])
    write(pack_path, pack)
    write(guide_path, guides)
    print("merged", loc)
