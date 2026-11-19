"""Merge scripts/tools-src/batch37/<locale>.json (title case converter, words to pages) into the locale packs
(meta, tools, faq, tool UI) and guides."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "scripts/tools-src/batch37"
LOCALES = ["en", "es", "id", "ja", "ko", "vi", "zh-CN", "zh-TW"]


def write(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


en = json.loads((SRC / "en.json").read_text(encoding="utf-8"))
for loc in LOCALES:
    src_path = SRC / f"{loc}.json"
    if not src_path.exists():
        raise SystemExit(f"{loc}: {src_path.name} is missing; every locale needs the batch copy")
    src = json.loads(src_path.read_text(encoding="utf-8"))
    # A translation must carry exactly the English keys, or a page would show a missing string.
    for part in ("meta", "tools", "faq", "guides", "ui"):
        for key, value in en[part].items():
            got = src[part].get(key)
            if isinstance(value, dict) and set(value) != set(got or {}):
                raise SystemExit(f"{loc}: {part}.{key} keys differ from en")
        if set(src[part]) != set(en[part]):
            raise SystemExit(f"{loc}: {part} keys differ from en")
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
