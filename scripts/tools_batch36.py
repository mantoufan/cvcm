"""Merge scripts/tools-src/batch36/<locale>.json (pressure points map) into the locale packs (meta, tools, faq, tool UI)
and guides. The point and zone copy lives in src/locales/pressure-points/<locale>.json and is loaded by the tool."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "scripts/tools-src/batch36"
LOCALES = ["en", "es", "id", "ja", "ko", "vi", "zh-CN", "zh-TW"]


def write(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


for loc in LOCALES:
    src = json.loads((SRC / f"{loc}.json").read_text(encoding="utf-8"))
    pack_path = ROOT / f"src/locales/{loc}.json"
    pack = json.loads(pack_path.read_text(encoding="utf-8"))
    pack["meta"].update(src["meta"])
    pack["tools"].update(src["tools"])
    pack["faq"].update(src["faq"])
    for section, strings in src["ui"].items():
        pack[section] = strings
    write(pack_path, pack)
    guide_path = ROOT / f"src/locales/guides/{loc}.json"
    guides = json.loads(guide_path.read_text(encoding="utf-8"))
    guides["tools"].update(src["guides"])
    write(guide_path, guides)
    print("merged", loc)
