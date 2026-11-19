"""Merge scripts/tools-src/games3d/<locale>.json (the /games/3d/ hub, nav.games3d and the shared game3d.* shell strings)
into the locale packs. Re-runnable."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "scripts/tools-src/games3d"
LOCALES = ["en", "es", "id", "ja", "ko", "vi", "zh-CN", "zh-TW"]

for loc in LOCALES:
    src = json.loads((SRC / f"{loc}.json").read_text(encoding="utf-8"))
    path = ROOT / f"src/locales/{loc}.json"
    pack = json.loads(path.read_text(encoding="utf-8"))
    pack["meta"].update(src["meta"])
    pack["nav"]["games3d"] = src["nav"]
    consoles = pack["games"]["consoles"]
    # The 3D tag hub's chip label (the kinds' labels come from the locale packs themselves).
    consoles["3d"] = src["console"]
    pack["games"]["g3d"] = src["g3d"]
    pack["faq"]["games3d"] = src["faq"]
    pack["game3d"] = src["ui"]
    path.write_text(json.dumps(pack, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("merged", loc)
