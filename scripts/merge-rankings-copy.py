"""Merge scripts/tools-src/rankings/<locale>.json into the data packs (rankings) and core packs (nav.rankings, ranking).

    python3 scripts/merge-rankings-copy.py
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
for loc in ["en", "es", "id", "ja", "ko", "vi", "zh-CN", "zh-TW"]:
    src = json.loads((ROOT / f"scripts/tools-src/rankings/{loc}.json").read_text(encoding="utf-8"))
    data_path = ROOT / f"src/locales/datasets/{loc}.json"
    data = json.loads(data_path.read_text(encoding="utf-8"))
    data["rankings"] = src["rankings"]
    data_path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    core_path = ROOT / f"src/locales/{loc}.json"
    core = json.loads(core_path.read_text(encoding="utf-8"))
    core["nav"]["rankings"] = src["nav"]
    core["ranking"] = src["ranking"]
    core_path.write_text(json.dumps(core, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("merged", loc)
