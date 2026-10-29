#!/usr/bin/env python3
"""Step diagrams for the due date, ideal weight, water, fuel cost, reading time, diff, hash and UUID lessons.

Strings come from the same per-locale JSON as learn_batch14.py (`svg` block: title, a, b, cap).
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "public" / "covers" / "tutorials"
DEEP, SOFT, INK, MUTED, PINK, WHITE, CARD, LINE = (
    "#a13f6c", "#ffe4ee", "#59364b", "#876579", "#c83f79", "#fff7fb", "#ffffff", "#f2d9e5",
)
FONT = "system-ui,'PingFang SC','Noto Sans SC','Hiragino Sans',sans-serif"
LOCS = ["en", "zh-CN", "zh-TW", "ja", "ko", "vi", "id", "es"]
FOLDERS = {"en": "", "zh-CN": "zh-cn", "zh-TW": "zh-tw", "ja": "ja", "ko": "ko", "vi": "vi", "id": "id", "es": "es"}
# lesson id -> (diagram file for step A, diagram file for step B)
FILES = {
    "find-due-date": ("find-due-date-rule", "find-due-date-dates"),
    "find-ideal-weight": ("find-ideal-weight-formulas", "find-ideal-weight-example"),
    "daily-water": ("daily-water-rule", "daily-water-example"),
    "trip-fuel-cost": ("trip-fuel-cost-formula", "trip-fuel-cost-example"),
    "estimate-reading-time": ("estimate-reading-time-speeds", "estimate-reading-time-example"),
    "compare-text": ("compare-text-sides", "compare-text-spaces"),
    "hash-text": ("hash-text-algos", "hash-text-compare"),
    "generate-uuid": ("generate-uuid-shape", "generate-uuid-forms"),
}


def xml(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


def svg(w, h, inner, label) -> str:
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" role="img" aria-label="{xml(label)}">
  <rect width="{w}" height="{h}" rx="28" fill="{WHITE}"/>
  {inner}
</svg>
'''


def heading(text, size=22) -> str:
    return f'<text x="48" y="54" fill="{DEEP}" font-size="{size}" font-weight="800" font-family="{FONT}">{xml(text)}</text>'


def caption(text, y=500, x=48) -> str:
    return f'<text x="{x}" y="{y}" fill="{MUTED}" font-size="18" font-family="{FONT}">{xml(text)}</text>'


def card(x, y, w, h, title, line, accent=False) -> str:
    fill, stroke = (SOFT, PINK) if accent else (CARD, LINE)
    return f'''
  <rect x="{x}" y="{y}" width="{w}" height="{h}" rx="22" fill="{fill}" stroke="{stroke}" stroke-width="3"/>
  <text x="{x + 24}" y="{y + 52}" fill="{DEEP}" font-size="22" font-weight="700" font-family="{FONT}">{xml(title)}</text>
  <text x="{x + 24}" y="{y + 96}" fill="{INK}" font-size="16" font-family="{FONT}">{xml(line)}</text>
'''


def main(src: Path) -> None:
    count = 0
    for loc in LOCS:
        strings = json.loads((src / f"{loc}.json").read_text(encoding="utf-8"))["svg"]
        dest = ROOT if not FOLDERS[loc] else ROOT / FOLDERS[loc]
        dest.mkdir(parents=True, exist_ok=True)
        for lesson_id, (file_a, file_b) in FILES.items():
            t = strings[lesson_id]
            (dest / f"{file_a}.svg").write_text(
                svg(960, 540, heading(t["title"]) + card(70, 140, 820, 200, t["a"], t["cap"], True), t["a"]),
                encoding="utf-8",
            )
            (dest / f"{file_b}.svg").write_text(
                svg(960, 540, heading(t["title"]) + card(70, 140, 820, 200, t["b"], t["cap"], True), t["b"]),
                encoding="utf-8",
            )
            count += 2
    print("svgs", count)


if __name__ == "__main__":
    main(Path(sys.argv[sys.argv.index("--src") + 1]) if "--src" in sys.argv else Path(__file__).resolve().parents[1] / "scripts/learn-src/batch14")
