#!/usr/bin/env python3
"""Inject the word unscrambler, concrete, graphing calculator, piano and slope how-tos.

Copy comes from scripts/learn-src/batch26/<locale>.json (meta, lessons, svg).
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LOCS = ["en", "zh-CN", "zh-TW", "ja", "ko", "vi", "id", "es"]
IDS = [
    "unscramble-words",
    "calculate-concrete",
    "graph-functions",
    "play-piano-online",
    "find-slope",
]
COPY_KEYS = [
    "name", "blurb", "title", "lead", "result", "note",
    "s1t", "s1b", "s2t", "s2b", "s3t", "s3b", "s4t", "s4b", "s5t", "s5b", "s6t", "s6b",
    "diagram1", "diagram2",
]
FAQ_KEYS = [f"{side}{i}" for i in range(1, 6) for side in ("q", "a")]


def load(src: Path) -> dict[str, dict]:
    out = {}
    for loc in LOCS:
        data = json.loads((src / f"{loc}.json").read_text(encoding="utf-8"))
        if set(data["lessons"]) != set(IDS):
            raise SystemExit(f"{loc}: lesson ids {sorted(data['lessons'])}")
        for lesson_id, payload in data["lessons"].items():
            missing = [k for k in COPY_KEYS if k not in payload["copy"]] + [k for k in FAQ_KEYS if k not in payload["faq"]]
            if missing:
                raise SystemExit(f"{loc} {lesson_id} missing {missing}")
        out[loc] = data
    en = out["en"]
    for loc in LOCS:
        if set(out[loc]["meta"]) != set(en["meta"]):
            raise SystemExit(f"{loc}: meta keys differ from en")
        for lesson_id, labels in en["svg"].items():
            if set(out[loc]["svg"][lesson_id]) != set(labels):
                raise SystemExit(f"{loc}: svg keys differ from en for {lesson_id}")
    return out


def inject(src: Path) -> None:
    copy = load(src)
    for loc in LOCS:
        path = ROOT / "src/locales" / f"{loc}.json"
        data = json.loads(path.read_text(encoding="utf-8"))
        data["faq"].setdefault("learn", {})
        for lesson_id in IDS:
            data["learn"][lesson_id] = {k: copy[loc]["lessons"][lesson_id]["copy"][k] for k in COPY_KEYS}
            data["faq"]["learn"][lesson_id] = {k: copy[loc]["lessons"][lesson_id]["faq"][k] for k in FAQ_KEYS}
        for key, value in copy[loc]["meta"].items():
            data["meta"][key] = value
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print("patched", path.name)


if __name__ == "__main__":
    inject(Path(sys.argv[sys.argv.index("--src") + 1]) if "--src" in sys.argv else ROOT / "scripts/learn-src/batch26")
