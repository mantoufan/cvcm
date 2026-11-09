#!/usr/bin/env python3
"""Step diagrams for the mortgage, quadratic, random team, screen resolution and alarm lessons.

These draw the idea itself (a factor tree, a tuner meter, colour stops), so most of each picture is numbers and only
a few labels need translating. Labels come from the `svg` block of scripts/learn-src/batch23/<locale>.json.
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


def mortgage_methods(t) -> str:
    x0, x1, y0, y1 = 150, 860, 110, 400
    top = 2800.0
    sy = lambda v: y1 - (v / top) * (y1 - y0)
    out = box(70, 60, 820, 420)
    out += line(x0, y1, x1, y1, MUTED, 2) + line(x0, y0 - 20, x0, y1, MUTED, 2)
    out += text((x0 + x1) / 2, 450, f"{t['month']} 1 → 360", 20, MUTED, 400, "middle")
    flat = sy(2022.62)
    out += line(x0, flat, x1, flat, DEEP, 6)
    out += text(x1, flat - 16, f"{t['equalPayments']}: {group(2022.62, 2)} {t['perMonth']}", 22, DEEP, 700, "end")
    out += line(x0, sy(2622.22), x1, sy(893.70), PINK, 6)
    out += text(x0 + 16, sy(2622.22) - 16, f"{t['equalPrincipal']}: {group(2622.22, 2)} → {group(893.70, 2)}", 22, PINK, 700)
    out += f'<circle cx="{x0}" cy="{sy(2622.22):.1f}" r="8" fill="{PINK}"/><circle cx="{x1}" cy="{sy(893.70):.1f}" r="8" fill="{PINK}"/>'
    return out


def mortgage_split(t) -> str:
    rows = ((1, 3577, 20695), (15, 8864, 15407), (30, 23438, 833))
    total = 24271.44
    out = box(70, 60, 820, 420)
    out += f'<rect x="230" y="92" width="22" height="22" rx="4" fill="{DEEP}"/>' + text(262, 111, t["principal"], 20, INK)
    out += f'<rect x="500" y="92" width="22" height="22" rx="4" fill="{PINK}"/>' + text(532, 111, t["interest"], 20, INK)
    for k, (year, p, i) in enumerate(rows):
        y = 160 + k * 100
        w = 600
        pw = w * p / total
        out += text(210, y + 38, f"{t['year']} {year}", 22, DEEP, 700, "end")
        out += f'<rect x="230" y="{y}" width="{pw:.1f}" height="56" fill="{DEEP}"/>'
        out += f'<rect x="{230 + pw:.1f}" y="{y}" width="{w - pw:.1f}" height="56" fill="{PINK}"/>'
        if pw > 80:
            out += text(242, y + 36, group(p), 20, WHITE, 700)
        if w - pw > 90:
            out += text(818, y + 36, group(i), 20, WHITE, 700, "end")
    return out


def _parabola(cx, v, axis, color=PINK) -> str:
    # y = v + x²/70 opening upward; v is the vertex height above the axis (negative = below).
    pts = []
    for s in range(-40, 41):
        x = s / 40 * 100
        pts.append(f"{cx + x:.1f} {axis - (v + x * x / 70):.1f}")
    return f'<path d="M{" L".join(pts)}" fill="none" stroke="{color}" stroke-width="5"/>'


def quadratic_discriminant(t) -> str:
    out = ""
    for n, (label, sign, v) in enumerate(((t["two"], "Δ > 0", -60), (t["one"], "Δ = 0", 0), (t["none"], "Δ < 0", 60))):
        x = 70 + n * 280
        cx, axis = x + 130, 330
        out += box(x, 70, 260, 400)
        out += text(cx, 118, sign, 30, DEEP, 800, "middle", MATH)
        out += line(x + 16, axis, x + 244, axis, MUTED, 2)
        out += _parabola(cx, v, axis)
        if v < 0:
            r = math.sqrt(-v * 70)
            out += "".join(f'<circle cx="{cx + d:.1f}" cy="{axis}" r="9" fill="{WHITE}" stroke="{DEEP}" stroke-width="4"/>' for d in (-r, r))
        elif v == 0:
            out += f'<circle cx="{cx}" cy="{axis}" r="9" fill="{WHITE}" stroke="{DEEP}" stroke-width="4"/>'
        out += text(cx, 440, label, 20, INK, 700, "middle")
    return out


def quadratic_formula(t) -> str:
    rows = (
        ("x² − 3x + 2 = 0", DEEP, 40),
        ("a = 1,  b = −3,  c = 2", MUTED, 28),
        ("Δ = (−3)² − 4 × 1 × 2 = 1", INK, 30),
        ("x = (3 ± √1) ÷ 2", INK, 30),
        (f"{t['roots']}: x₁ = 1,  x₂ = 2", PINK, 34),
    )
    out = box(70, 50, 820, 440)
    for n, (s, color, size) in enumerate(rows):
        out += text(480, 120 + n * 82, s, size, color, 800 if n in (0, 4) else 500, "middle", MATH)
    return out


def _dots(x, y, n, cols, color=PINK, gap=34) -> str:
    return "".join(f'<circle cx="{x + (i % cols) * gap}" cy="{y + (i // cols) * gap}" r="12" fill="{color}"/>' for i in range(n))


def teams_split(t) -> str:
    out = box(70, 160, 220, 220) + text(180, 205, t["names"], 22, DEEP, 800, "middle") + _dots(112, 245, 12, 4)
    for n, (label, y) in enumerate(((t["count"], 70), (t["perTeam"], 290))):
        out += arrow(290, 270, 380, y + 90)
        out += box(380, y, 510, 180) + text(400, y + 40, label, 20, DEEP, 700)
        for k in range(3):
            out += box(400 + k * 160, y + 62, 140, 96, SOFT, LINE, 12, 2) + _dots(428 + k * 160, y + 96, 4, 2, DEEP)
        out += text(870, y + 40, f"→ {t['teamsOf']} × 4", 20, PINK, 800, "end")
    return out


def teams_deal(t) -> str:
    order = (7, 2, 9, 4, 1, 10, 5, 8, 3, 6)
    out = text(90, 100, t["shuffle"], 22, DEEP, 800)
    for i, v in enumerate(order):
        cx = 110 + i * 78
        out += f'<circle cx="{cx}" cy="150" r="26" fill="{PINK}"/>' + text(cx, 158, str(v), 22, WHITE, 800, "middle")
    for k in range(3):
        x = 110 + k * 260
        out += box(x, 230, 230, 270)
        name = t["team"].replace("{n}", str(k + 1)) if "{n}" in t["team"] else f"{t['team']} {k + 1}"
        out += text(x + 115, 272, name, 22, DEEP, 800, "middle")
        members = order[k::3]
        for j, v in enumerate(members):
            cy = 320 + j * 46
            out += f'<circle cx="{x + 115}" cy="{cy}" r="20" fill="{SOFT}" stroke="{PINK}" stroke-width="3"/>' + text(x + 115, cy + 7, str(v), 18, DEEP, 800, "middle")
        out += arrow(110 + k * 78, 180, x + 115, 228, LINE)
    return out


def screen_scaling(t) -> str:
    out = box(70, 90, 460, 300, SOFT, PINK)
    out += text(300, 210, t["real"], 24, DEEP, 800, "middle") + text(300, 260, "1920 × 1080", 36, DEEP, 800, "middle", MONO)
    out += box(620, 150, 270, 180)
    out += text(755, 220, t["css"], 22, DEEP, 800, "middle") + text(755, 266, "1536 × 864", 28, DEEP, 800, "middle", MONO)
    out += arrow(535, 240, 612, 240)
    out += text(480, 445, f"{t['scaling']}: 1920 ÷ 1.25 = 1536", 24, PINK, 800, "middle", MONO)
    return out


def screen_viewport(t) -> str:
    out = box(110, 50, 740, 440, CARD, MUTED, 18, 4)
    out += text(130, 84, t["screen"], 20, MUTED, 700)
    out += f'<rect x="114" y="440" width="732" height="46" fill="{LINE}"/>' + text(480, 470, t["taskbar"], 18, MUTED, 700, "middle")
    out += box(170, 100, 620, 320, WHITE, DEEP, 12, 3)
    out += f'<rect x="172" y="102" width="616" height="44" rx="10" fill="{SOFT}"/>' + text(190, 131, t["browser"], 18, DEEP, 700)
    out += f'<rect x="190" y="160" width="580" height="244" rx="8" fill="{SOFT}" stroke="{PINK}" stroke-width="4" stroke-dasharray="10 6"/>'
    out += text(480, 280, t["viewport"], 28, PINK, 800, "middle")
    return out


def alarm_timeline(t) -> str:
    x0, x1, y = 120, 840, 270
    out = line(x0, y, x1, y, LINE, 8)
    mid = x0 + (x1 - x0) * 30 / 450
    out += line(mid, y - 24, mid, y + 76, MUTED, 3) + text(mid, y + 102, "00:00", 20, MUTED, 400, "middle", MONO)
    for x, clock, label, sub in ((x0, "23:30", t["now"], ""), (x1, "07:00", t["alarm"], t["tomorrow"])):
        out += f'<circle cx="{x}" cy="{y}" r="16" fill="{PINK}"/>'
        out += text(x, y - 46, label, 24, DEEP, 800, "middle") + text(x, y + 60, clock, 30, DEEP, 800, "middle", MONO)
        if sub:
            out += text(x, y + 96, sub, 20, MUTED, 400, "middle")
    out += f'<path d="M{x0} 170 Q{(x0 + x1) / 2} 110 {x1} 170" fill="none" stroke="{PINK}" stroke-width="4" stroke-dasharray="10 8"/>'
    out += text((x0 + x1) / 2, 110, t["ringsIn"], 26, PINK, 800, "middle")
    return out


def _mark(x, y, ok: bool) -> str:
    if ok:
        return f'<circle cx="{x}" cy="{y}" r="22" fill="{PINK}"/><path d="M{x - 10} {y} L{x - 3} {y + 8} L{x + 11} {y - 9}" fill="none" stroke="{WHITE}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>'
    return f'<circle cx="{x}" cy="{y}" r="22" fill="{WHITE}" stroke="{MUTED}" stroke-width="3"/>' + line(x - 9, y - 9, x + 9, y + 9, MUTED, 4) + line(x + 9, y - 9, x - 9, y + 9, MUTED, 4)


def alarm_keep(t) -> str:
    out = ""
    for col, (items, ok) in enumerate((((t["open"], t["background"], t["awake"]), True), ((t["closed"], t["sleep"], t["muted"]), False))):
        x = 70 + col * 430
        out += box(x, 80, 390, 380, SOFT if ok else CARD, PINK if ok else LINE)
        out += f'<text x="{x + 195}" y="150" font-size="56" text-anchor="middle">{"🔔" if ok else "🔕"}</text>'
        for k, label in enumerate(items):
            y = 230 + k * 80
            out += _mark(x + 60, y, ok) + text(x + 100, y + 8, label, 24, INK if ok else MUTED, 700)
    return out


DIAGRAMS = {
    "calculate-mortgage": (("calculate-mortgage-split", mortgage_split, 1), ("calculate-mortgage-methods", mortgage_methods, 2)),
    "solve-quadratic": (("solve-quadratic-discriminant", quadratic_discriminant, 1), ("solve-quadratic-formula", quadratic_formula, 2)),
    "make-random-teams": (("make-random-teams-deal", teams_deal, 1), ("make-random-teams-split", teams_split, 2)),
    "check-screen-resolution": (("check-screen-resolution-scaling", screen_scaling, 1), ("check-screen-resolution-viewport", screen_viewport, 2)),
    "set-online-alarm": (("set-online-alarm-timeline", alarm_timeline, 1), ("set-online-alarm-keep", alarm_keep, 2)),
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
    base = Path(args[args.index("--src") + 1]) if "--src" in args else Path(__file__).resolve().parents[1] / "scripts/learn-src/batch23"
    only = args[args.index("--only") + 1].split(",") if "--only" in args else LOCS
    main(base, only)
