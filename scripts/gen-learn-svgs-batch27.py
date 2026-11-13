#!/usr/bin/env python3
"""Step diagrams for the sudoku, tic-tac-toe, colour vision, military time and child height lessons.

Each draws the idea itself (a sudoku grid with its row, column and box, tic-tac-toe boards, dot plates and cone
curves, clock conversions, the mid-parental formula and a growth curve), so most of each picture is digits and marks
and only a few labels need translating. Labels come from the `svg` block of scripts/learn-src/batch27/<locale>.json.
"""
from __future__ import annotations

import json
import math
import random
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


GRID = [
    "53..7....",
    "6..195...",
    ".98....6.",
    "8...6...3",
    "4..8.3..1",
    "7...2...6",
    ".6....28.",
    "...419..5",
    "....8..79",
]


def sudoku_grid(x0, y0, cell, shade=None, digits=GRID, accent=None) -> str:
    """A 9 × 9 grid; `shade(r, c)` returns a fill or None; `accent` is {(r, c): (digit, colour)}."""
    out = ""
    for r in range(9):
        for c in range(9):
            fill = shade(r, c) if shade else None
            if fill:
                out += f'<rect x="{x0 + c * cell}" y="{y0 + r * cell}" width="{cell}" height="{cell}" fill="{fill}"/>'
            ch = digits[r][c]
            if accent and (r, c) in accent:
                d, col = accent[(r, c)]
                out += text(x0 + c * cell + cell / 2, y0 + r * cell + cell * 0.7, d, cell * 0.62, col, 800, "middle")
            elif ch != ".":
                out += text(x0 + c * cell + cell / 2, y0 + r * cell + cell * 0.7, ch, cell * 0.58, INK, 700, "middle")
    for i in range(10):
        w = 4 if i % 3 == 0 else 1.5
        col = INK if i % 3 == 0 else LINE
        out += line(x0, y0 + i * cell, x0 + 9 * cell, y0 + i * cell, col, w) + line(x0 + i * cell, y0, x0 + i * cell, y0 + 9 * cell, col, w)
    return out


def sudoku_rules(t) -> str:
    cell = 48
    x0, y0 = 70, 54
    def shade(r, c):
        if r == 4:
            return "#ffd6e6"
        if c == 1:
            return "#e9e0ff"
        if r < 3 and c >= 6:
            return "#fff0c9"
        return None
    out = sudoku_grid(x0, y0, cell, shade)
    lx = 560
    for i, (label, fill) in enumerate(((t["row"], "#ffd6e6"), (t["column"], "#e9e0ff"), (t["box"], "#fff0c9"))):
        y = 120 + i * 100
        out += box(lx, y, 56, 56, fill, LINE, 10)
        out += text(lx + 76, y + 38, label, 28, INK, 800)
    out += box(lx - 10, 430, 340, 64, SOFT, PINK, 16)
    out += text(lx + 160, 472, t["once"], 26, DEEP, 800, "middle")
    return out


def sudoku_scan(t) -> str:
    """Bottom-left box: 5s in rows 7 and 8 and in column 1 rule out every cell but one."""
    digits = [
        ".........",
        "5........",
        ".........",
        ".........",
        ".........",
        ".........",
        "...5.....",
        "........5",
        ".7.......",
    ]
    cell = 50
    x0, y0 = 300, 45
    def shade(r, c):
        if r >= 6 and c < 3:
            return "#ffd6e6" if (r, c) == (8, 2) else "#f3eef1"
        return None
    out = sudoku_grid(x0, y0, cell, shade, digits, {(8, 2): ("5", PINK)})
    for r, c in ((6, 3), (7, 8)):
        cy = y0 + r * cell + cell / 2
        out += line(x0 + 6, cy, x0 + c * cell + 6, cy, PINK, 4)
    cx = x0 + cell / 2
    out += line(cx, y0 + 1 * cell + cell - 4, cx, y0 + 9 * cell - 6, PINK, 4)
    for r, c in ((6, 0), (6, 1), (6, 2), (7, 0), (7, 1), (7, 2), (8, 0)):
        px, py = x0 + c * cell + cell / 2, y0 + r * cell + cell / 2
        out += line(px - 9, py - 9, px + 9, py + 9, MUTED, 3) + line(px + 9, py - 9, px - 9, py + 9, MUTED, 3)
    out += box(40, 380, 220, 90, SOFT, PINK, 16) + wrapped(150, 432, t["only"], 24, DEEP, 800, "middle", 14)
    out += arrow(262, 470, x0 - 4, y0 + 8 * cell + cell / 2)
    return out


def ttt_board(x0, y0, size, marks: dict, ring: dict | None = None, label_fill=None) -> str:
    """A board with marks {index: 'X' | 'O'} and optional ring colours {index: colour} for highlighted squares."""
    s = size / 3
    out = ""
    for i, col in (ring or {}).items():
        r, c = divmod(i, 3)
        out += f'<rect x="{x0 + c * s + 4}" y="{y0 + r * s + 4}" width="{s - 8}" height="{s - 8}" rx="10" fill="{col}"/>'
    for k in (1, 2):
        out += line(x0 + k * s, y0, x0 + k * s, y0 + size, INK, 5) + line(x0, y0 + k * s, x0 + size, y0 + k * s, INK, 5)
    for i, m in marks.items():
        r, c = divmod(i, 3)
        out += text(x0 + c * s + s / 2, y0 + r * s + s * 0.72, m, s * 0.7, PINK if m == "X" else "#5b4a8a", 800, "middle")
    return out


def ttt_opening(t) -> str:
    out = ""
    items = ((0, t["corner"], "#ffd6e6", t["best"]), (4, t["centre"], "#fff0c9", ""), (1, t["edge"], "#eef0f4", t["weakest"]))
    for k, (i, label, col, tag) in enumerate(items):
        x = 70 + k * 300
        out += ttt_board(x, 90, 220, {i: "X"}, {i: col})
        out += text(x + 110, 360, label, 30, INK, 800, "middle")
        if tag:
            out += text(x + 110, 400, tag, 22, DEEP if k == 0 else MUTED, 700, "middle")
    return out


def ttt_fork(t) -> str:
    out = ttt_board(300, 50, 330, {0: "X", 8: "X", 4: "O", 2: "O", 6: "X"}, {3: "#ffd6e6", 7: "#ffd6e6"})
    s = 110
    out += line(300 + s / 2, 50 + s / 2, 300 + s / 2, 50 + 2.5 * s, PINK, 6)
    out += line(300 + s / 2, 50 + 2.5 * s, 300 + 2.5 * s, 50 + 2.5 * s, PINK, 6)
    out += box(670, 150, 250, 70, SOFT, PINK, 16) + text(795, 195, t["fork"], 26, DEEP, 800, "middle")
    out += box(670, 260, 250, 70, CARD, LINE, 16) + text(795, 305, t["block"], 22, MUTED, 700, "middle")
    return out


def dots_disc(cx, cy, rad, colour_of, seed=7, n=340) -> str:
    rng = random.Random(seed)
    placed = []
    out = ""
    tries = 0
    while len(placed) < n and tries < 9000:
        tries += 1
        r = rng.uniform(7, 15)
        a = rng.uniform(0, 2 * math.pi)
        d = math.sqrt(rng.random()) * (rad - r)
        x, y = cx + math.cos(a) * d, cy + math.sin(a) * d
        if any(math.hypot(x - px, y - py) < r + pr + 2 for px, py, pr in placed):
            continue
        placed.append((x, y, r))
        out += f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r:.1f}" fill="{colour_of(x, y, rng)}"/>'
    return out


def shade_hex(rgb, k):
    return "#" + "".join(f"{max(0, min(255, round(v * k))):02x}" for v in rgb)


def cv_plate(t) -> str:
    cx, cy, rad = 300, 270, 220
    def inside(x, y):
        # A "7": top bar and a diagonal stroke.
        u, v = (x - cx) / rad, (y - cy) / rad
        def seg(ax, ay, bx, by):
            dx, dy = bx - ax, by - ay
            tt = max(0, min(1, ((u - ax) * dx + (v - ay) * dy) / (dx * dx + dy * dy)))
            return math.hypot(u - ax - tt * dx, v - ay - tt * dy)
        return min(seg(-0.35, -0.45, 0.35, -0.45), seg(0.35, -0.45, -0.1, 0.5)) < 0.1
    def colour(x, y, rng):
        k = rng.uniform(0.75, 1.1)
        return shade_hex((205, 120, 95) if inside(x, y) else (160, 152, 100), k)
    out = dots_disc(cx, cy, rad, colour)
    out += box(590, 140, 50, 50, "#a09864", LINE, 25) + text(660, 175, t["background"], 26, INK, 800)
    out += box(590, 230, 50, 50, "#cd785f", LINE, 25) + text(660, 265, t["figure"], 26, INK, 800)
    out += box(580, 330, 340, 70, SOFT, PINK, 16) + wrapped(750, 375, t["same"], 22, DEEP, 800, "middle", 24)
    return out


def cv_types(t) -> str:
    out = ""
    cols = (("#c8504a", t["red"], t["protan"]), ("#4f9a5a", t["green"], t["deutan"]), ("#4a6fc8", t["blue"], t["tritan"]))
    # Cone sensitivity curves (Gaussian sketches peaking at 560, 530 and 420 nm) on a 400–700 nm axis.
    x0, x1, yb = 90, 870, 330
    out += line(x0, yb, x1, yb, MUTED, 3)
    for nm in (400, 500, 600, 700):
        x = x0 + (nm - 400) / 300 * (x1 - x0)
        out += line(x, yb, x, yb + 10, MUTED, 2) + text(x, yb + 36, f"{nm} nm", 18, MUTED, 600, "middle")
    for (col, _, _), peak, width in zip(cols, (560, 530, 420), (55, 50, 30)):
        pts = []
        for nm in range(400, 701, 5):
            x = x0 + (nm - 400) / 300 * (x1 - x0)
            y = yb - 230 * math.exp(-((nm - peak) / width) ** 2 / 2)
            pts.append(f"{x:.1f},{y:.1f}")
        out += f'<polyline points="{" ".join(pts)}" fill="none" stroke="{col}" stroke-width="5" stroke-linejoin="round"/>'
    for k, (col, cone, kind) in enumerate(cols):
        x = 80 + k * 290
        out += f'<circle cx="{x + 20}" cy="430" r="14" fill="{col}"/>'
        out += text(x + 46, 438, cone, 22, INK, 800)
        out += text(x + 46, 478, kind, 22, DEEP, 800)
    return out


def mil_pm(t) -> str:
    out = box(80, 150, 260, 140, SOFT, PINK, 24) + text(210, 248, "1430", 76, DEEP, 800, "middle", MONO)
    out += arrow(360, 220, 590, 220)
    out += text(475, 195, f"14 − 12 = 2", 26, INK, 800, "middle")
    out += text(475, 265, t["minus"], 22, MUTED, 700, "middle")
    out += box(610, 150, 280, 140, CARD, LINE, 24) + text(750, 248, f"2:30 {t['pm']}", 58, INK, 800, "middle")
    rows = (("0000", "12:00 AM"), ("0830", "8:30 AM"), ("1200", "12:00 PM"), ("1915", "7:15 PM"))
    for i, (m, s) in enumerate(rows):
        x = 110 + i * 200
        out += text(x + 70, 390, m, 30, DEEP, 800, "middle", MONO) + text(x + 70, 430, s, 22, INK, 600, "middle")
    return out


def mil_say(t) -> str:
    rows = (("0800", t["zero"]), ("1430", t["fourteen"]), ("1905", t["nineteen"]))
    out = ""
    for i, (m, s) in enumerate(rows):
        y = 70 + i * 150
        out += box(70, y, 210, 110, SOFT, PINK, 20) + text(175, y + 74, m, 54, DEEP, 800, "middle", MONO)
        out += arrow(300, y + 55, 380, y + 55)
        out += box(400, y, 490, 110, CARD, LINE, 20) + wrapped(645, y + 66, f"“{s}”", 28, INK, 700, "middle", 30)
    return out


def ht_parents(t) -> str:
    out = ""
    for k, (label, sign, col) in enumerate(((t["boy"], "+", "#4a6fc8"), (t["girl"], "−", PINK))):
        y = 70 + k * 220
        out += box(60, y, 840, 170, CARD, LINE, 24)
        out += text(100, y + 50, label, 28, col, 800)
        formula = f"({t['father']} + {t['mother']} {sign} 13 cm) ÷ 2"
        out += wrapped(480, y + 110, formula, 32, INK, 800, "middle", 40)
    out += text(480, 520, f"± {group(8.5, 1)} cm", 26, DEEP, 800, "middle")
    return out


def ht_percentile(t) -> str:
    x0, x1, y0, y1 = 120, 860, 460, 70
    out = line(x0, y0, x1, y0, MUTED, 3) + line(x0, y0, x0, y1, MUTED, 3)
    out += text((x0 + x1) / 2, 510, t["age"], 22, MUTED, 700, "middle") + text(70, 80, t["height"], 22, MUTED, 700, "middle")
    for age in (2, 5, 10, 15, 20):
        x = x0 + (age - 2) / 18 * (x1 - x0)
        out += line(x, y0, x, y0 + 8, MUTED, 2) + text(x, y0 + 30, str(age), 18, MUTED, 600, "middle")
    def curve(off):
        pts = []
        for i in range(0, 37):
            age = 2 + i * 0.5
            g = 1 / (1 + math.exp(-(age - 12.5) / 1.6))
            h = 0.12 + 0.48 * (age - 2) / 18 + 0.3 * g + off
            pts.append((x0 + (age - 2) / 18 * (x1 - x0), y0 - h * (y0 - y1)))
        return pts
    for off, col, w in ((-0.08, LINE, 3), (0.0, "#d9c2cf", 3), (0.08, LINE, 3)):
        out += f'<polyline points="{" ".join(f"{x:.1f},{y:.1f}" for x, y in curve(off))}" fill="none" stroke="{col}" stroke-width="{w}"/>'
    main = curve(0.035)
    out += f'<polyline points="{" ".join(f"{x:.1f},{y:.1f}" for x, y in main)}" fill="none" stroke="{PINK}" stroke-width="5" stroke-dasharray="10 8"/>'
    nx, ny = main[14]
    ax, ay = main[-1]
    out += f'<circle cx="{nx:.1f}" cy="{ny:.1f}" r="11" fill="{DEEP}"/>' + text(nx, ny - 22, t["now"], 22, DEEP, 800, "middle")
    out += f'<circle cx="{ax:.1f}" cy="{ay:.1f}" r="11" fill="{PINK}"/>' + text(ax - 10, ay - 22, t["adult"], 22, PINK, 800, "end")
    return out


DIAGRAMS = {
    "play-sudoku": (("play-sudoku-rules", sudoku_rules, 1), ("play-sudoku-scan", sudoku_scan, 2)),
    "play-tic-tac-toe": (("play-tic-tac-toe-opening", ttt_opening, 1), ("play-tic-tac-toe-fork", ttt_fork, 2)),
    "test-color-blindness": (("test-color-blindness-plate", cv_plate, 1), ("test-color-blindness-types", cv_types, 2)),
    "convert-military-time": (("convert-military-time-pm", mil_pm, 1), ("convert-military-time-say", mil_say, 2)),
    "predict-child-height": (("predict-child-height-parents", ht_parents, 1), ("predict-child-height-percentile", ht_percentile, 2)),
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
    base = Path(args[args.index("--src") + 1]) if "--src" in args else Path(__file__).resolve().parents[1] / "scripts/learn-src/batch27"
    only = args[args.index("--only") + 1].split(",") if "--only" in args else LOCS
    main(base, only)
