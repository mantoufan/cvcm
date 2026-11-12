#!/usr/bin/env python3
"""Step diagrams for the word unscrambler, concrete, graphing, piano and slope lessons.

These draw the idea itself (word tiles and a blank, a concrete slab and bags, function plots, piano keys, a rise/run
triangle), so most of each picture is letters, numbers and formulas and only a few labels need translating. Labels come from the `svg` block of scripts/learn-src/batch26/<locale>.json.
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "public" / "covers" / "tutorials"
DEEP, SOFT, INK, MUTED, PINK, WHITE, CARD, LINE = (
    "#a13f6c", "#ffe4ee", "#59364b", "#876579", "#c83f79", "#fff7fb", "#ffffff", "#f2d9e5",
)
FONT = "system-ui,'PingFang SC','Noto Sans SC','Hiragino Sans',sans-serif"
MONO = "ui-monospace,Menlo,Consolas,monospace"
MATH = "'Cambria Math','STIX Two Math','Noto Sans Math','Apple Symbols',system-ui,sans-serif"
LOCS = ["en", "zh-CN", "zh-TW", "ja", "ko", "vi", "id", "es"]
FOLDERS = {"en": "", "zh-CN": "zh-cn", "zh-TW": "zh-tw", "ja": "ja", "ko": "ko", "vi": "vi", "id": "id", "es": "es"}


def esc(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


def text(x, y, s, size=22, fill=INK, weight=400, anchor="start", font=FONT) -> str:
    return f'<text x="{x}" y="{y}" fill="{fill}" font-size="{size}" font-weight="{weight}" text-anchor="{anchor}" font-family="{font}">{esc(s)}</text>'


def box(x, y, w, h, fill=CARD, stroke=LINE, rx=18, sw=3) -> str:
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>'


def line(x1, y1, x2, y2, stroke=PINK, sw=3) -> str:
    return f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{stroke}" stroke-width="{sw}" stroke-linecap="round"/>'


def arrow(x1, y1, x2, y2, stroke=PINK) -> str:
    angle = math.atan2(y2 - y1, x2 - x1)
    a = [(x2 - 14 * math.cos(angle - s), y2 - 14 * math.sin(angle - s)) for s in (0.5, -0.5)]
    return line(x1, y1, x2, y2, stroke) + f'<path d="M{x2} {y2} L{a[0][0]:.1f} {a[0][1]:.1f} L{a[1][0]:.1f} {a[1][1]:.1f} Z" fill="{stroke}"/>'


def page(inner: str, label: str) -> str:
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 540" role="img" aria-label="{esc(label)}">
  <rect width="960" height="540" rx="28" fill="{WHITE}"/>
  {inner}
</svg>
'''


LOC = "en"


def group(n: float, decimals: int = 0) -> str:
    """Numbers the way each locale's Intl.NumberFormat shows them (es groups from 5 digits)."""
    s = f"{n:,.{decimals}f}"
    if LOC in ("id", "vi", "es"):
        s = s.replace(",", "\0").replace(".", ",").replace("\0", ".")
        if LOC == "es" and abs(n) < 10000:
            s = s.replace(".", "", 1)
    return s



def _mark(x, y, ok: bool) -> str:
    if ok:
        return f'<circle cx="{x}" cy="{y}" r="22" fill="{PINK}"/><path d="M{x - 10} {y} L{x - 3} {y + 8} L{x + 11} {y - 9}" fill="none" stroke="{WHITE}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>'
    return f'<circle cx="{x}" cy="{y}" r="22" fill="{WHITE}" stroke="{MUTED}" stroke-width="3"/>' + line(x - 9, y - 9, x + 9, y + 9, MUTED, 4) + line(x + 9, y - 9, x - 9, y + 9, MUTED, 4)


def wrapped(x, y, s, size, fill, weight, anchor="start", width=14, gap=None) -> str:
    """One or two lines: text longer than `width` (CJK counts double) breaks at the space nearest the middle."""
    units = sum(2 if ord(ch) > 0x2E80 else 1 for ch in s)
    if units <= width or " " not in s:
        return text(x, y, s, size, fill, weight, anchor)
    spaces = [i for i, ch in enumerate(s) if ch == " "]
    cut = min(spaces, key=lambda i: abs(i - len(s) / 2))
    gap = gap or size * 1.2
    return text(x, y - gap / 2, s[:cut], size, fill, weight, anchor) + text(x, y + gap / 2, s[cut + 1:], size, fill, weight, anchor)



def tile(x, y, ch, blank=False, size=70) -> str:
    fill, stroke, ink = (WHITE, PINK, PINK) if blank else (SOFT, PINK, DEEP)
    dash = ' stroke-dasharray="8 6"' if blank else ""
    return (f'<rect x="{x}" y="{y}" width="{size}" height="{size}" rx="12" fill="{fill}" stroke="{stroke}" stroke-width="3"{dash}/>'
            + text(x + size / 2, y + size * 0.66, ch, 34, ink, 800, "middle", MONO))


def word(x, y, w: str, blank_at: int | None = None, size=26) -> str:
    """A word with the letter a blank stood for in pink and underlined."""
    out = ""
    step = size * 0.62
    start = x - step * len(w) / 2
    for i, ch in enumerate(w):
        cx = start + step * (i + 0.5)
        hit = i == blank_at
        out += text(cx, y, ch, size, PINK if hit else INK, 800 if hit else 600, "middle", MONO)
        if hit:
            out += line(cx - step / 2 + 2, y + 7, cx + step / 2 - 2, y + 7, PINK, 3)
    return out


def unscramble_blanks(t) -> str:
    out = text(480, 70, t["rack"], 26, DEEP, 800, "middle")
    for i, ch in enumerate("CAT?"):
        out += tile(310 + i * 90, 95, ch.replace("?", "?"), ch == "?")
    out += text(625, 200, t["blank"], 20, PINK, 700, "middle")
    out += arrow(480, 215, 480, 265)
    out += box(150, 280, 660, 220)
    out += text(480, 320, t["words"], 24, DEEP, 800, "middle")
    rows = [("CHAT", 1), ("COAT", 1), ("CART", 2), ("TACO", 3), ("CAST", 2), ("ACT", None), ("CAT", None), ("TAX", 2)]
    for i, (w, b) in enumerate(rows):
        r, c = divmod(i, 4)
        out += word(240 + c * 160, 380 + r * 70, w, b)
    return out


def unscramble_filters(t) -> str:
    out = ""
    cols = ((t["starts"], "RE…", ["REST", "REAL"], ["STAR", "LANE"]), (t["ends"], "…ING", ["RATING", "STRING"], ["GRAINS", "GIANTS"]))
    for col, (title, pattern, kept, dropped) in enumerate(cols):
        x = 100 + col * 400
        out += box(x, 70, 360, 420)
        out += text(x + 180, 120, title, 26, DEEP, 800, "middle")
        out += box(x + 100, 140, 160, 56, SOFT, PINK, 12) + text(x + 180, 178, pattern, 28, DEEP, 800, "middle", MONO)
        out += text(x + 40, 250, t["kept"], 20, PINK, 800)
        for i, w in enumerate(kept):
            out += _mark(x + 62, 290 + i * 52, True) + text(x + 100, 300 + i * 52, w, 26, INK, 700, "start", MONO)
        out += text(x + 40, 410, t["dropped"], 20, MUTED, 800)
        for i, w in enumerate(dropped):
            out += text(x + 40 + i * 150, 455, w, 24, MUTED, 400, "start", MONO)
            out += line(x + 38 + i * 150, 447, x + 40 + i * 150 + len(w) * 15, 447, MUTED, 2)
    return out


def concrete_slab(t) -> str:
    # An oblique slab: 10 ft × 10 ft × 4 in, all turned into feet before multiplying.
    out = '<g transform="translate(130 0)">'
    out += '<path d="M180 300 L520 300 L700 200 L360 200 Z" fill="#efe7eb" stroke="#b9a3ae" stroke-width="3"/>'
    out += '<path d="M180 300 L520 300 L520 340 L180 340 Z" fill="#ddd2d8" stroke="#b9a3ae" stroke-width="3"/>'
    out += '<path d="M520 300 L700 200 L700 240 L520 340 Z" fill="#cfc2c9" stroke="#b9a3ae" stroke-width="3"/>'
    out += '</g>'
    out += text(480, 385, f"{t['length']} 10 ft", 22, INK, 700, "middle")
    out += text(745, 300, f"{t['width']} 10 ft", 22, INK, 700, "start")
    out += line(290, 300, 290, 340, PINK, 4) + text(278, 328, f"{t['thickness']} 4 in", 22, PINK, 800, "end")
    out += text(480, 90, f"4 in = 4 ÷ 12 = {group(0.333, 3)} ft", 26, MUTED, 400, "middle", MONO)
    out += text(480, 140, f"10 × 10 × {group(0.333, 3)} = {group(33.3, 1)} ft³", 28, INK, 700, "middle", MONO)
    out += text(480, 460, f"{group(33.3, 1)} ÷ 27 = {group(1.23, 2)} yd³", 32, DEEP, 800, "middle", MONO)
    return out


def concrete_bags(t) -> str:
    out = text(480, 80, f"{group(33.3, 1)} ft³ × {group(1.1, 2)} = {group(36.7, 1)} ft³", 28, INK, 700, "middle", MONO)
    out += text(480, 120, f"+10 % {t['waste']}", 22, PINK, 700, "middle")
    for i, (lb, yld, n) in enumerate(((80, 0.60, 62), (60, 0.45, 82), (40, 0.30, 123))):
        x = 110 + i * 260
        out += box(x, 160, 220, 300)
        out += f'<path d="M{x + 60} 200 L{x + 160} 200 L{x + 175} 330 L{x + 45} 330 Z" fill="#efe7eb" stroke="#b9a3ae" stroke-width="3"/>'
        out += text(x + 110, 275, f"{lb} lb", 28, INK, 800, "middle", MONO)
        out += text(x + 110, 370, f"{group(yld, 2)} ft³ {t['bag']}", 20, MUTED, 400, "middle")
        out += text(x + 110, 430, f"{n} {t['bags']}", 30, DEEP, 800, "middle", MONO)
    return out


def graph_syntax(t) -> str:
    rows = (("x²", "x^2"), ("√x", "sqrt(x)"), ("2·x", "2x"), ("|x|", "abs(x)"), ("1 / (x + 1)", "1/(x + 1)"), ("sin x", "sin(x)"))
    out = text(300, 80, t["write"], 26, DEEP, 800, "middle") + text(660, 80, t["type"], 26, DEEP, 800, "middle")
    for i, (paper, typed) in enumerate(rows):
        y = 110 + i * 68
        out += box(150, y, 300, 54, SOFT, LINE, 12) + text(300, y + 37, paper, 28, INK, 700, "middle", MATH)
        out += arrow(465, y + 27, 505, y + 27)
        out += box(520, y, 280, 54, CARD, PINK, 12) + text(660, y + 36, typed, 26, DEEP, 800, "middle", MONO)
    return out


def graph_points(t) -> str:
    # y = x^2 − 2 on −3…3: zeros at ±√2, y-intercept −2.
    ox, oy, s = 480, 300, 70
    out = line(140, oy, 820, oy, "#b9a3ae", 2) + line(ox, 60, ox, 500, "#b9a3ae", 2)
    pts = " ".join(f"{ox + x * s:.1f},{oy - (x * x - 2) * s:.1f}" for x in [i / 20 - 2.45 for i in range(99)])
    out += f'<polyline points="{pts}" fill="none" stroke="{PINK}" stroke-width="5" stroke-linejoin="round"/>'
    for x in (-math.sqrt(2), math.sqrt(2)):
        out += f'<circle cx="{ox + x * s:.1f}" cy="{oy}" r="9" fill="{DEEP}"/>'
    out += f'<circle cx="{ox}" cy="{oy + 2 * s}" r="9" fill="{DEEP}"/>'
    out += text(ox - math.sqrt(2) * s - 22, oy + 34, f"{t['zero']} ({group(-1.414, 3)}, 0)", 20, INK, 700, "end")
    out += text(ox + math.sqrt(2) * s + 22, oy + 34, f"{t['zero']} ({group(1.414, 3)}, 0)", 20, INK, 700, "start")
    out += text(ox + 22, oy + 2 * s + 30, f"{t['intercept']} (0, −2)", 20, INK, 700, "start")
    out += text(160, 480, "y = x^2 − 2", 26, DEEP, 800, "start", MONO)
    return out


PC_WHITE = ["C", "D", "E", "F", "G", "A", "B"]


def piano_strip(x0, y0, w, octaves, caps_white=None, caps_black=None, labels=None, mark=None) -> str:
    """A small keyboard: `octaves` octaves plus the top C, white keys `w` wide."""
    out = ""
    whites = octaves * 7 + 1
    for i in range(whites):
        fill = "#ffd6e6" if mark == i else WHITE
        out += f'<rect x="{x0 + i * w}" y="{y0}" width="{w}" height="190" rx="6" fill="{fill}" stroke="#e3cdd8" stroke-width="2"/>'
        if labels:
            out += text(x0 + i * w + w / 2, y0 + 176, labels[i % 7], 16, MUTED, 700, "middle")
        if caps_white and i < len(caps_white):
            out += text(x0 + i * w + w / 2, y0 + 150, caps_white[i], 18, DEEP, 800, "middle", MONO)
    blacks = [0, 1, 3, 4, 5]
    bi = 0
    for o in range(octaves):
        for b in blacks:
            x = x0 + (o * 7 + b + 1) * w - w * 0.3
            out += f'<rect x="{x:.1f}" y="{y0}" width="{w * 0.6:.1f}" height="115" rx="4" fill="#3a2b33"/>'
            if caps_black and bi < len(caps_black):
                out += text(x + w * 0.3, y0 + 100, caps_black[bi], 15, "#f6dce8", 800, "middle", MONO)
            bi += 1
    return out


def piano_keys(t) -> str:
    w = 52
    x0 = 480 - (15 * w) / 2
    caps_white = list("ZXCVBNM") + list("QWERTYU") + ["I"]
    caps_black = list("SDGHJ") + list("23567")
    out = piano_strip(x0, 150, w, 2, caps_white, caps_black)
    out += text(x0 + 3.5 * w, 120, t["lower"], 22, DEEP, 800, "middle") + text(x0 + 10.5 * w, 120, t["upper"], 22, DEEP, 800, "middle")
    out += line(x0 + 7 * w, 110, x0 + 7 * w, 360, PINK, 3)
    out += text(480, 420, "Z X C V B N M → C D E F G A B", 22, INK, 700, "middle", MONO)
    out += text(480, 460, "Q W E R T Y U → C D E F G A B", 22, INK, 700, "middle", MONO)
    out += text(480, 500, "Space = sustain", 20, MUTED, 400, "middle", MONO)
    return out


def piano_notes(t) -> str:
    w = 56
    x0 = 480 - (15 * w) / 2
    out = piano_strip(x0, 170, w, 2, labels=PC_WHITE, mark=7)
    # Braces over the two-black and three-black groups of the first octave.
    out += f'<path d="M{x0 + w * 0.7} 160 Q{x0 + w * 1.5} 130 {x0 + w * 2.3} 160" fill="none" stroke="{PINK}" stroke-width="3"/>'
    out += text(x0 + w * 1.5, 120, t["twoBlack"], 18, PINK, 700, "middle")
    out += f'<path d="M{x0 + w * 3.7} 160 Q{x0 + w * 5} 130 {x0 + w * 6.3} 160" fill="none" stroke="{MUTED}" stroke-width="3"/>'
    out += text(x0 + w * 5, 120, t["threeBlack"], 18, MUTED, 700, "middle")
    out += arrow(x0 + 7.5 * w, 440, x0 + 7.5 * w, 372, DEEP)
    out += text(x0 + 7.5 * w, 475, f"{t['middle']} = C4", 24, DEEP, 800, "middle")
    out += text(480, 520, "C D E F G A B = Do Re Mi Fa Sol La Si", 18, MUTED, 400, "middle", MONO)
    return out


def slope_rise_run(t) -> str:
    ox, oy, s = 200, 470, 48
    out = line(120, oy, 860, oy, "#b9a3ae", 2) + line(ox, 40, ox, 500, "#b9a3ae", 2)
    p1 = (ox + 1 * s, oy - 2 * s)
    p2 = (ox + 4 * s, oy - 8 * s)
    out += line(ox - 0.2 * s, oy + 0.4 * s, ox + 4.6 * s, oy - 9.2 * s, PINK, 5)
    out += f'<path d="M{p1[0]} {p1[1]} H{p2[0]} V{p2[1]}" fill="none" stroke="{MUTED}" stroke-width="3" stroke-dasharray="10 7"/>'
    for (x, y), label in ((p1, "(1, 2)"), (p2, "(4, 8)")):
        out += f'<circle cx="{x}" cy="{y}" r="10" fill="{DEEP}"/>' + text(x - 16, y - 14, label, 22, INK, 800, "end", MONO)
    out += text((p1[0] + p2[0]) / 2, p1[1] + 34, f"{t['run']} = 4 − 1 = 3", 22, INK, 700, "middle", MONO)
    out += text(p2[0] + 18, (p1[1] + p2[1]) / 2, f"{t['rise']} = 8 − 2 = 6", 22, INK, 700, "start", MONO)
    out += box(560, 330, 300, 110, SOFT, PINK)
    out += text(710, 375, f"m = {t['rise']} / {t['run']}", 24, DEEP, 800, "middle", MONO)
    out += text(710, 418, "= 6 / 3 = 2", 26, DEEP, 800, "middle", MONO)
    return out


def slope_forms(t) -> str:
    rows = ((t["slopeIntercept"], "y = 2x"), (t["pointSlope"], "y − 2 = 2(x − 1)"), (t["standard"], "2x − y = 0"))
    out = text(480, 80, "(1, 2) · (4, 8) · m = 2", 26, MUTED, 400, "middle", MONO)
    for i, (name, eq) in enumerate(rows):
        y = 120 + i * 130
        out += box(110, y, 740, 100)
        out += wrapped(290, y + 58, name, 22, DEEP, 800, "middle", 18)
        out += text(650, y + 62, eq, 34, INK, 800, "middle", MONO)
    return out


DIAGRAMS = {
    "unscramble-words": (("unscramble-words-blanks", unscramble_blanks, 1), ("unscramble-words-filters", unscramble_filters, 2)),
    "calculate-concrete": (("calculate-concrete-slab", concrete_slab, 1), ("calculate-concrete-bags", concrete_bags, 2)),
    "graph-functions": (("graph-functions-syntax", graph_syntax, 1), ("graph-functions-points", graph_points, 2)),
    "play-piano-online": (("play-piano-online-keys", piano_keys, 1), ("play-piano-online-notes", piano_notes, 2)),
    "find-slope": (("find-slope-rise-run", slope_rise_run, 1), ("find-slope-forms", slope_forms, 2)),
}
def main(src: Path, locales: list[str]) -> None:
    global LOC
    count = 0
    for loc in locales:
        LOC = loc
        data = json.loads((src / f"{loc}.json").read_text(encoding="utf-8"))
        dest = ROOT / FOLDERS[loc] if FOLDERS[loc] else ROOT
        dest.mkdir(parents=True, exist_ok=True)
        for lesson_id, pair in DIAGRAMS.items():
            labels = data["svg"][lesson_id]
            copy = data["lessons"][lesson_id]["copy"]
            for name, draw, n in pair:
                (dest / f"{name}.svg").write_text(page(draw(labels), copy[f"diagram{n}"]), encoding="utf-8")
                count += 1
    print("svgs", count)


if __name__ == "__main__":
    args = sys.argv[1:]
    base = Path(args[args.index("--src") + 1]) if "--src" in args else Path(__file__).resolve().parents[1] / "scripts/learn-src/batch26"
    only = args[args.index("--only") + 1].split(",") if "--only" in args else LOCS
    main(base, only)
