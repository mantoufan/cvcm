"""Merge scripts/tools-src/batch35/<locale>.json into the locale packs (meta, tools, faq, tool UI), guides and the
privacy policy (a "Citation lookups" section after "Site search and nostalgia answers")."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "scripts/tools-src/batch35"
LOCALES = ["en", "es", "id", "ja", "ko", "vi", "zh-CN", "zh-TW"]
# The section the new one follows, found by position so it works in every language.
AFTER = 4


def write(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


for loc in LOCALES:
    src_path = SRC / f"{loc}.json"
    if not src_path.exists():
        print("skip", loc)
        continue
    src = json.loads(src_path.read_text(encoding="utf-8"))
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
    legal_path = ROOT / f"src/locales/legal/{loc}.json"
    legal = json.loads(legal_path.read_text(encoding="utf-8"))
    sections = legal["pages"]["privacy"]["sections"]
    # The English heading pins the position: stop rather than put the section after the wrong one.
    if loc == "en":
        assert sections[AFTER]["h"] == "Site search and nostalgia answers", sections[AFTER]["h"]
    # Re-running replaces the section instead of adding it twice.
    sections[:] = [s for s in sections if s.get("id") != "citation-lookups"]
    sections.insert(AFTER + 1, {"id": "citation-lookups", **src["legal"]})
    write(legal_path, legal)
    print("merged", loc)
