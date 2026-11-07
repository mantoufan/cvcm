#!/usr/bin/env python3
"""Step diagrams for the ROM emulator and SWF how-tos. Labels come from the `svg` block of scripts/learn-src/batch22."""
from __future__ import annotations

import json
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
ROOT = REPO / "public/covers/tutorials"
SRC = REPO / "scripts/learn-src/batch22"
DEEP, SOFT, INK, MUTED, PINK, WHITE, CARD, LINE = "#a13f6c", "#ffe4ee", "#59364b", "#876579", "#c83f79", "#fff7fb", "#ffffff", "#f2d9e5"
FONT = "system-ui,'PingFang SC','Noto Sans SC','Hiragino Sans',sans-serif"
MONO = "ui-monospace,Menlo,Consolas,monospace"
FOLDERS = {"en": "", "zh-CN": "zh-cn", "zh-TW": "zh-tw", "ja": "ja", "ko": "ko", "vi": "vi", "id": "id", "es": "es"}


def esc(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


def text(x, y, s, size=24, fill=INK, weight=400, anchor="start", font=FONT) -> str:
    return f'<text x="{x}" y="{y}" fill="{fill}" font-size="{size}" font-weight="{weight}" text-anchor="{anchor}" font-family="{font}">{esc(s)}</text>'


def box(x, y, w, h, fill=CARD, stroke=LINE, rx=14, sw=3) -> str:
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>'


def key(x, y, label, w=64) -> str:
    return box(x, y, w, 64, SOFT, PINK, 12) + text(x + w / 2, y + 42, label, 24, DEEP, 700, "middle", MONO)


def page(inner: str, label: str) -> str:
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 540" role="img" aria-label="{esc(label)}">
  <rect width="960" height="540" rx="28" fill="{WHITE}"/>
  {inner}
</svg>
'''


def files(t: dict) -> str:
    rows = [
        (".nes", "FC / NES"),
        (".sfc  .smc", "SFC / SNES"),
        (".gb  .gbc", "Game Boy / Game Boy Color"),
        (".gba", "Game Boy Advance"),
        (".md  .gen  .smd", "Mega Drive"),
        (".bin", t["bin"]),
        (".zip", t["zip"]),
    ]
    out = [text(70, 62, t["file"], 24, DEEP, 700), text(370, 62, t["console"], 24, DEEP, 700)]
    for i, (ext, name) in enumerate(rows):
        y = 82 + i * 62
        out += [box(50, y, 860, 54, CARD if i < 5 else SOFT), text(70, y + 36, ext, 24, PINK, 700, font=MONO), text(370, y + 36, name, 24)]
    return "".join(out)


def keyboard(t: dict) -> str:
    out = [box(50, 40, 860, 290)]
    out += [key(170, 70, "↑"), key(96, 144, "←"), key(170, 144, "↓"), key(244, 144, "→"), text(204, 250, t["move"], 24, INK, 700, "middle")]
    pairs = [("Z", "A", 430), ("X", "B", 530), ("V", "Select", 630)]
    for k, name, x in pairs:
        out += [key(x, 110, k), text(x + 32, 214, name, 22, INK, 700, "middle")]
    out += [key(740, 110, "Enter", 120), text(800, 214, "Start", 22, INK, 700, "middle")]
    out += [box(50, 350, 860, 150, SOFT), text(70, 392, t["sfc"], 20, DEEP, 700)]
    for i, (k, name) in enumerate([("S", "Y"), ("A", "X"), ("Q", "L"), ("E", "R")]):
        x = 90 + i * 200
        out += [key(x, 412, k), text(x + 84, 454, f"= {name}", 26, INK, 700)]
    return "".join(out)


def runs(t: dict) -> str:
    rows = [(t["one"], t["ok"], True), (t["more"], t["stop"], False), (t["site"], t["stop"], False)]
    out = []
    for i, (what, verdict, good) in enumerate(rows):
        y = 50 + i * 150
        out += [
            box(50, y, 600, 120),
            box(72, y + 26, 54, 68, SOFT, PINK, 8),
            text(99, y + 68, "SWF", 15, DEEP, 700, "middle", MONO),
            text(146, y + 70, what, 24),
            box(680, y, 230, 120, PINK if good else CARD, PINK if good else MUTED),
            text(795, y + 72, verdict, 28, WHITE if good else MUTED, 700, "middle"),
        ]
    return "".join(out)


def inputs(t: dict) -> str:
    out = []
    # Mouse with the left button filled, a phone, and arrow keys.
    out += [box(50, 40, 860, 130), box(90, 62, 58, 86, CARD, DEEP, 28), f'<path d="M90 92 V90 A29 28 0 0 1 119 62 V92 Z" fill="{PINK}" stroke="{DEEP}" stroke-width="3"/>', text(190, 116, t["click"], 26, INK, 700)]
    out += [box(50, 190, 860, 130), box(98, 208, 52, 94, CARD, DEEP, 10), f'<circle cx="124" cy="252" r="13" fill="{PINK}"/>', text(190, 266, t["tap"], 26, INK, 700)]
    out += [box(50, 340, 860, 90), key(70, 353, "←"), key(140, 353, "↑"), key(210, 353, "↓"), key(280, 353, "→"), text(370, 395, t["keys"], 24, INK, 700)]
    out += [box(50, 450, 860, 58, SOFT, PINK), text(480, 488, t["sound"], 24, DEEP, 700, "middle")]
    return "".join(out)


DIAGRAMS = {
    "use-emulator": (("use-emulator-files", files, 1), ("use-emulator-keys", keyboard, 2)),
    "open-swf-file": (("open-swf-file-inputs", inputs, 1), ("open-swf-file-runs", runs, 2)),
}
count = 0
for loc, folder in FOLDERS.items():
    data = json.loads((SRC / f"{loc}.json").read_text(encoding="utf-8"))
    dest = ROOT / folder if folder else ROOT
    dest.mkdir(parents=True, exist_ok=True)
    for lesson_id, pair in DIAGRAMS.items():
        for name, draw, n in pair:
            (dest / f"{name}.svg").write_text(page(draw(data["svg"][lesson_id]), data["lessons"][lesson_id]["copy"][f"diagram{n}"]), encoding="utf-8")
            count += 1
print("svgs", count)
