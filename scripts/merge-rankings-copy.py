"""Merge scripts/tools-src/rankings/<locale>.json into the data packs (rankings) and core packs (nav.rankings, ranking).

    python3 scripts/merge-rankings-copy.py
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
for loc in ["en", "es", "id", "ja", "ko", "vi", "zh-CN", "zh-TW"]:
    src = json.loads((ROOT / f"scripts/tools-src/rankings/{loc}.json").read_text(encoding="utf-8"))
    data_path = ROOT / f"src/locales/datasets/{loc}.json"
    # Spliced as text: the pack keeps FAQ items on one line, which a JSON round trip would reflow.
    text = data_path.read_text(encoding="utf-8")
    at = text.find(',\n  "rankings":')
    head = text[:at] if at >= 0 else text.rstrip()[:-1].rstrip()
    block = json.dumps(src["rankings"], ensure_ascii=False, indent=2).replace("\n", "\n  ")
    merged = f'{head},\n  "rankings": {block}\n}}\n'
    # Rankings must stay the last key: anything after it would be lost here, so stop rather than drop it.
    if set(json.loads(merged)) != set(json.loads(text)) | {"rankings"}:
        raise SystemExit(f"{data_path}: a key would be lost; keep rankings last")
    data_path.write_text(merged, encoding="utf-8")
    core_path = ROOT / f"src/locales/{loc}.json"
    core = json.loads(core_path.read_text(encoding="utf-8"))
    core["nav"]["rankings"] = src["nav"]
    core["ranking"] = src["ranking"]
    core_path.write_text(json.dumps(core, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("merged", loc)
