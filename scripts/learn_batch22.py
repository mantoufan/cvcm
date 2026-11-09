#!/usr/bin/env python3
"""Inject the ROM emulator and SWF how-tos from scripts/learn-src/batch22/<locale>.json (group, meta, lessons, svg)."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "scripts/learn-src/batch22"
for loc in ["en", "zh-CN", "zh-TW", "ja", "ko", "vi", "id", "es"]:
    src = json.loads((SRC / f"{loc}.json").read_text(encoding="utf-8"))
    path = ROOT / "src/locales" / f"{loc}.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    data["learn"]["groups"]["games"] = src["group"]
    data["faq"].setdefault("learn", {})
    for lesson_id, lesson in src["lessons"].items():
        data["learn"][lesson_id] = lesson["copy"]
        data["faq"]["learn"][lesson_id] = lesson["faq"]
    data["meta"].update(src["meta"])
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("patched", path.name)
