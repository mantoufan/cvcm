#!/usr/bin/env python3
"""Step diagrams for the GIF, image splitter, area, volume and random letter lessons.

These draw the idea itself (a factor tree, a tuner meter, colour stops), so most of each picture is numbers and only
a few labels need translating. Labels come from the `svg` block of scripts/learn-src/batch25/<locale>.json.
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


def gif_frames(t) -> str:
    # Four frames on a timeline, each held for its delay, then the loop arrow back to the first.
    out = ""
    colors = (PINK, DEEP, MUTED, "#e98bb0")
    for i in range(4):
        x = 90 + i * 200
        out += box(x, 130, 160, 160)
        out += f'<circle cx="{x + 80}" cy="{190 + (i % 2) * 16}" r="{24 + i * 5}" fill="{colors[i]}"/>'
        out += text(x + 80, 275, f"{t['frame']} {i + 1}", 22, INK, 700, "middle")
        out += line(x, 340, x + 160, 340, PINK, 8)
        out += text(x + 80, 375, f"500 ms {t['delay']}", 20, MUTED, 400, "middle", MONO)
    out += f'<path d="M 810 400 C 810 470, 170 470, 170 412" fill="none" stroke="{DEEP}" stroke-width="4" stroke-dasharray="10 8"/>'
    out += f'<path d="M170 398 L159 420 L181 420 Z" fill="{DEEP}"/>'
    out += text(480, 500, t["loop"], 24, DEEP, 800, "middle")
    return out


def gif_size(t) -> str:
    # File size grows with the pixels per frame and the frame count: half the width is a quarter of the pixels.
    out = text(480, 90, f"{t['size']} ∝ {t['pixels']} × {t['frames']}", 30, DEEP, 800, "middle")
    out += box(90, 140, 320, 180, SOFT, PINK) + text(250, 360, "480 px", 24, INK, 700, "middle", MONO)
    out += box(490, 185, 160, 90, SOFT, PINK) + text(570, 360, "240 px", 24, INK, 700, "middle", MONO)
    out += text(250, 400, "100 %", 22, MUTED, 400, "middle", MONO) + text(570, 400, "≈ 25 %", 22, PINK, 800, "middle", MONO)
    out += box(700, 140, 190, 180)
    out += text(795, 125, t["colors"], 22, DEEP, 800, "middle")
    for i, n in enumerate((256, 64, 16)):
        out += text(795, 195 + i * 50, str(n), 26, INK if i == 0 else MUTED, 700 if i == 0 else 400, "middle", MONO)
    out += text(795, 360, "↓ " + t["size"], 22, PINK, 800, "middle")
    return out


def split_grid(t) -> str:
    # A landscape picture with its centred square cut into 3 × 3 tiles; the side strips are dimmed (trimmed).
    x0, y0, w, h = 130, 80, 700, 360
    out = f'<rect x="{x0}" y="{y0}" width="{w}" height="{h}" rx="10" fill="{SOFT}" stroke="{LINE}" stroke-width="3"/>'
    side = h
    sx = x0 + (w - side) / 2
    out += f'<rect x="{x0}" y="{y0}" width="{sx - x0}" height="{h}" fill="{MUTED}" opacity="0.45"/>'
    out += f'<rect x="{sx + side}" y="{y0}" width="{x0 + w - sx - side}" height="{h}" fill="{MUTED}" opacity="0.45"/>'
    out += wrapped((x0 + sx) / 2, y0 + h / 2, t["trimmed"], 22, WHITE, 800, "middle", 10)
    out += wrapped((sx + side + x0 + w) / 2, y0 + h / 2, t["trimmed"], 22, WHITE, 800, "middle", 10)
    for i in range(1, 3):
        out += line(sx + i * side / 3, y0, sx + i * side / 3, y0 + h, PINK, 4) + line(sx, y0 + i * side / 3, sx + side, y0 + i * side / 3, PINK, 4)
    out += f'<rect x="{sx}" y="{y0}" width="{side}" height="{side}" fill="none" stroke="{DEEP}" stroke-width="5"/>'
    for r in range(3):
        for c in range(3):
            out += text(sx + (c + 0.5) * side / 3, y0 + (r + 0.5) * side / 3 + 10, str(r * 3 + c + 1), 30, DEEP, 800, "middle")
    out += text(480, 490, "3 × 3", 26, DEEP, 800, "middle", MONO)
    return out


def split_order(t) -> str:
    # The profile after posting: the tile posted last (post 9) is the newest, top left; post 1 ends bottom right.
    side, x0, y0 = 120, 330, 90
    out = ""
    for r in range(3):
        for c in range(3):
            n = 9 - (r * 3 + c)
            x, y = x0 + c * side, y0 + r * side
            first = n == 1
            out += box(x + 4, y + 4, side - 8, side - 8, PINK if first else SOFT, PINK, 10)
            out += text(x + side / 2, y + side / 2 - 4, f"{t['post']} {n}", 22, WHITE if first else DEEP, 800, "middle")
            out += text(x + side / 2, y + side / 2 + 26, f"r{r + 1}c{c + 1}", 18, WHITE if first else MUTED, 400, "middle", MONO)
    out += arrow(300, 150, x0 + 6, 150, DEEP)
    out += wrapped(290, 150, t["newest"], 22, DEEP, 800, "end", 12)
    out += arrow(760, 390, x0 + 3 * side - 6, 390, PINK)
    out += text(775, 398, f"{t['post']} 1", 22, PINK, 800, "start")
    return out


def area_shapes(t) -> str:
    out = ""
    out += box(60, 70, 260, 400)
    out += f'<rect x="100" y="150" width="180" height="110" fill="{SOFT}" stroke="{PINK}" stroke-width="5"/>'
    out += text(190, 290, "l", 26, INK, 700, "middle", MATH) + text(298, 212, "w", 26, INK, 700, "start", MATH)
    out += text(190, 120, t["rectangle"], 24, DEEP, 800, "middle")
    out += text(190, 360, "A = l × w", 26, DEEP, 800, "middle", MATH)
    out += text(190, 410, "5 × 3 = 15", 22, MUTED, 400, "middle", MONO)
    out += box(350, 70, 260, 400)
    out += f'<path d="M380 265 L580 265 L470 150 Z" fill="{SOFT}" stroke="{PINK}" stroke-width="5" stroke-linejoin="round"/>'
    out += f'<line x1="470" y1="150" x2="470" y2="265" stroke="{DEEP}" stroke-width="3" stroke-dasharray="8 6"/>'
    out += text(480, 295, "b", 26, INK, 700, "middle", MATH) + text(480, 222, "h", 26, INK, 700, "start", MATH)
    out += text(480, 120, t["triangle"], 24, DEEP, 800, "middle")
    out += text(480, 360, "A = ½ × b × h", 26, DEEP, 800, "middle", MATH)
    out += text(480, 410, "½ × 6 × 4 = 12", 22, MUTED, 400, "middle", MONO)
    out += box(640, 70, 260, 400)
    out += f'<circle cx="770" cy="210" r="70" fill="{SOFT}" stroke="{PINK}" stroke-width="5"/>'
    out += line(770, 210, 840, 210, DEEP, 3) + text(805, 200, "r", 26, INK, 700, "middle", MATH)
    out += text(770, 120, t["circle"], 24, DEEP, 800, "middle")
    out += text(770, 360, "A = π × r²", 26, DEEP, 800, "middle", MATH)
    out += text(770, 410, f"π × 2² ≈ {group(12.566, 3)}", 22, MUTED, 400, "middle", MONO)
    return out


def area_units(t) -> str:
    # One square metre beside one square foot, drawn to scale (1 m = 3.281 ft).
    m = 300
    f = m / 3.28084
    out = f'<rect x="110" y="110" width="{m}" height="{m}" fill="{SOFT}" stroke="{PINK}" stroke-width="5"/>'
    for i in range(1, 4):
        out += line(110 + i * f, 110, 110 + i * f, 110 + m, LINE, 2) + line(110, 110 + i * f, 110 + m, 110 + i * f, LINE, 2)
    out += text(110 + m / 2, 110 + m / 2 + 12, "1 m²", 36, DEEP, 800, "middle", MONO)
    out += f'<rect x="450" y="{110 + m - f:.1f}" width="{f:.1f}" height="{f:.1f}" fill="{PINK}" stroke="{DEEP}" stroke-width="4"/>'
    out += text(450 + f / 2, 110 + m + 40, "1 ft²", 24, DEEP, 800, "middle", MONO)
    out += text(600, 200, f"1 m² ≈ {group(10.764, 3)} ft²", 26, INK, 800, "start", MONO)
    out += text(600, 250, f"1 ft² ≈ {group(0.0929, 4)} m²", 22, MUTED, 400, "start", MONO)
    out += text(600, 300, f"1 ha = {group(10000)} m²", 22, MUTED, 400, "start", MONO)
    out += text(600, 350, f"1 acre ≈ {group(4046.86, 2)} m²", 22, MUTED, 400, "start", MONO)
    return out


def volume_shapes(t) -> str:
    out = ""
    out += box(60, 70, 260, 400)
    out += f'<path d="M95 180 L245 180 L245 280 L95 280 Z" fill="{SOFT}" stroke="{PINK}" stroke-width="4"/>'
    out += f'<path d="M95 180 L135 145 L285 145 L245 180 Z M245 180 L285 145 L285 245 L245 280 Z" fill="{WHITE}" stroke="{PINK}" stroke-width="4" stroke-linejoin="round"/>'
    out += text(190, 120, t["box"], 24, DEEP, 800, "middle")
    out += text(190, 360, "V = l × w × h", 26, DEEP, 800, "middle", MATH)
    out += text(190, 410, f"30 × 20 × 10 = {group(6000)}", 20, MUTED, 400, "middle", MONO)
    out += box(350, 70, 260, 400)
    out += f'<path d="M420 160 L420 270 A60 18 0 0 0 540 270 L540 160" fill="{SOFT}" stroke="{PINK}" stroke-width="4"/>'
    out += f'<ellipse cx="480" cy="160" rx="60" ry="18" fill="{WHITE}" stroke="{PINK}" stroke-width="4"/>'
    out += line(480, 160, 540, 160, DEEP, 3) + text(554, 168, "r", 24, INK, 700, "start", MATH) + text(556, 222, "h", 24, INK, 700, "start", MATH)
    out += text(480, 120, t["cylinder"], 24, DEEP, 800, "middle")
    out += text(480, 360, "V = π × r² × h", 26, DEEP, 800, "middle", MATH)
    out += text(480, 410, f"π × 4² × 10 ≈ {group(502.65, 2)}", 20, MUTED, 400, "middle", MONO)
    out += box(640, 70, 260, 400)
    out += f'<circle cx="770" cy="215" r="70" fill="{SOFT}" stroke="{PINK}" stroke-width="4"/>'
    out += f'<ellipse cx="770" cy="215" rx="70" ry="20" fill="none" stroke="{PINK}" stroke-width="2" stroke-dasharray="6 6"/>'
    out += line(770, 215, 840, 215, DEEP, 3) + text(805, 246, "r", 24, INK, 700, "middle", MATH)
    out += text(770, 120, t["sphere"], 24, DEEP, 800, "middle")
    out += text(770, 360, "V = 4/3 × π × r³", 26, DEEP, 800, "middle", MATH)
    out += text(770, 410, f"4/3 × π × 3³ ≈ {group(113.1, 1)}", 20, MUTED, 400, "middle", MONO)
    return out


def volume_capacity(t) -> str:
    # A 10 cm cube holds 1,000 cm³, one litre; then the usual capacity units.
    out = f'<path d="M110 200 L310 200 L310 400 L110 400 Z" fill="{SOFT}" stroke="{PINK}" stroke-width="5"/>'
    out += f'<path d="M110 200 L170 140 L370 140 L310 200 Z M310 200 L370 140 L370 340 L310 400 Z" fill="{WHITE}" stroke="{PINK}" stroke-width="5" stroke-linejoin="round"/>'
    out += text(210, 440, "10 cm", 22, MUTED, 400, "middle", MONO) + text(385, 250, "10 cm", 22, MUTED, 400, "start", MONO)
    out += text(210, 310, t["litre"], 30, DEEP, 800, "middle")
    out += text(540, 170, f"{group(1000)} cm³ = 1 L", 26, INK, 800, "start", MONO)
    out += text(540, 220, "1 cm³ = 1 mL", 22, MUTED, 400, "start", MONO)
    out += text(540, 270, f"1 m³ = {group(1000)} L", 22, MUTED, 400, "start", MONO)
    out += text(540, 320, f"1 US gal ≈ {group(3.785, 3)} L", 22, MUTED, 400, "start", MONO)
    out += text(540, 370, f"1 ft³ ≈ {group(28.32, 2)} L", 22, MUTED, 400, "start", MONO)
    return out


def letter_pool(t) -> str:
    out = text(480, 80, t["pool"], 26, DEEP, 800, "middle")
    left = set("QXZ")
    for i, ch in enumerate("ABCDEFGHIJKLMNOPQRSTUVWXYZ"):
        r, c = divmod(i, 9)
        x, y = 112 + c * 82, 115 + r * 92
        gone = ch in left
        out += box(x, y, 66, 66, WHITE if gone else SOFT, MUTED if gone else PINK, 12)
        out += text(x + 33, y + 45, ch, 30, MUTED if gone else DEEP, 800, "middle", MONO)
        if gone:
            out += line(x + 10, y + 10, x + 56, y + 56, MUTED, 4)
    out += text(480, 440, f"{t['left']}: Q X Z", 24, MUTED, 700, "middle")
    out += text(480, 485, "26 − 3 = 23 → 1/23", 24, PINK, 800, "middle", MONO)
    return out


def letter_unique(t) -> str:
    # Three draws: with repeats each has 26 choices; without, the pool shrinks by one each time.
    out = ""
    for col, (title, seq, ways, total) in enumerate(((t["repeats"], "KAK", "26 × 26 × 26", 17576), (t["unique"], "KAM", "26 × 25 × 24", 15600))):
        x = 110 + col * 400
        out += box(x, 90, 340, 360)
        out += wrapped(x + 170, 140, title, 26, DEEP, 800, "middle", 18)
        for i, ch in enumerate(seq):
            repeat = col == 0 and i == 2
            out += box(x + 40 + i * 95, 190, 75, 75, PINK if repeat else SOFT, PINK, 12)
            out += text(x + 77 + i * 95, 240, ch, 34, WHITE if repeat else DEEP, 800, "middle", MONO)
        out += text(x + 170, 330, ways, 26, INK, 700, "middle", MONO)
        out += text(x + 170, 380, f"= {group(total)}", 24, MUTED, 400, "middle", MONO)
    return out


DIAGRAMS = {
    "make-gif": (("make-gif-frames", gif_frames, 1), ("make-gif-size", gif_size, 2)),
    "split-image": (("split-image-grid", split_grid, 1), ("split-image-order", split_order, 2)),
    "calculate-area": (("calculate-area-shapes", area_shapes, 1), ("calculate-area-units", area_units, 2)),
    "calculate-volume": (("calculate-volume-shapes", volume_shapes, 1), ("calculate-volume-capacity", volume_capacity, 2)),
    "pick-random-letter": (("pick-random-letter-pool", letter_pool, 1), ("pick-random-letter-unique", letter_unique, 2)),
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
    base = Path(args[args.index("--src") + 1]) if "--src" in args else Path(__file__).resolve().parents[1] / "scripts/learn-src/batch25"
    only = args[args.index("--only") + 1].split(",") if "--only" in args else LOCS
    main(base, only)
