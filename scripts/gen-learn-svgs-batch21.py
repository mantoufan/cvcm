#!/usr/bin/env python3
"""Step diagrams for the calculator, notepad, Markdown, gradient, fancy text, coin, tuner, factor and LCM/GCF lessons.

These draw the idea itself (a factor tree, a tuner meter, colour stops), so most of each picture is numbers and only
a few labels need translating. Labels come from the `svg` block of scripts/learn-src/batch21/<locale>.json.
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
STOPS = ("#ff7eb3", "#ffd36e", "#7ad7f0")


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


def calc_order(t) -> str:
    def sum_card(y, expr, first_x, first_w, step, result):
        return (
            box(70, y, 820, 180)
            + text(110, y + 72, expr, 46, DEEP, 700, font=MONO)
            + f'<rect x="{first_x}" y="{y + 88}" width="{first_w}" height="6" rx="3" fill="{PINK}"/>'
            + text(first_x + first_w / 2, y + 126, t["first"], 20, PINK, 700, "middle")
            + text(860, y + 72, f"= {result}", 46, PINK, 800, "end", MONO)
            + text(860, y + 126, step, 22, MUTED, 400, "end", MONO)
        )
    return sum_card(70, "2 + 3 × 4", 220, 145, "2 + 12", "14") + sum_card(290, "(2 + 3) × 4", 110, 193, "5 × 4", "20")


def calc_angle(t) -> str:
    out = ""
    for x, mode, value, note in ((70, "DEG", t["sinDeg"], "30°"), (500, "RAD", t["sinRad"], "30 rad ≈ 1719°")):
        cx, cy, r = x + 195, 230, 110
        # 30 degrees, or 30 radians wrapped round the circle.
        a = math.radians(30) if mode == "DEG" else 30.0
        px, py = cx + r * math.cos(a), cy - r * math.sin(a)
        out += box(x, 70, 390, 400)
        out += text(x + 195, 112, mode, 26, DEEP, 800, "middle")
        out += f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="none" stroke="{LINE}" stroke-width="4"/>'
        out += line(cx - r - 16, cy, cx + r + 16, cy, LINE, 2) + line(cx, cy - r - 16, cx, cy + r + 16, LINE, 2)
        out += line(cx, cy, f"{px:.1f}", f"{py:.1f}") + line(f"{px:.1f}", f"{py:.1f}", f"{px:.1f}", cy, DEEP, 4)
        out += f'<circle cx="{px:.1f}" cy="{py:.1f}" r="8" fill="{PINK}"/>'
        out += text(x + 195, 392, note, 20, MUTED, 400, "middle")
        out += text(x + 195, 442, f"sin(30) = {value}", 28, PINK, 800, "middle", MONO)
    return out


def note_where(t) -> str:
    return (
        box(70, 110, 330, 240, SOFT, PINK)
        + text(235, 165, t["browser"], 26, DEEP, 800, "middle")
        + "".join(line(120, y, x, y, DEEP, 4) for y, x in ((215, 350), (250, 320), (285, 340)))
        + text(235, 330, t["saved"], 18, MUTED, 400, "middle")
        + arrow(400, 180, 560, 150, LINE) + line(462, 145, 498, 185, PINK, 5) + line(498, 145, 462, 185, PINK, 5)
        + box(560, 70, 330, 160)
        + text(725, 135, t["other"], 24, DEEP, 700, "middle") + text(725, 180, t["notThere"], 20, MUTED, 400, "middle")
        + arrow(400, 290, 560, 340)
        + text(545, 395, t["download"], 20, PINK, 700, "end")
        + box(560, 280, 330, 160)
        + text(725, 370, t["file"], 24, DEEP, 700, "middle")
    )


def note_wrap(t) -> str:
    # Wrap the sample to the box by estimated width: CJK and Hangul are about 1 em, Latin about 0.55 em.
    words = t["sample"]
    wrapped, cur, width = [], "", 0.0
    for ch in words:
        width += 22 if ord(ch) > 0x2E80 else 12
        cur += ch
        if width > 285:
            cut = cur.rfind(" ")
            if cut > 0:
                wrapped.append(cur[:cut])
                cur = cur[cut + 1:]
            else:
                wrapped.append(cur)
                cur = ""
            width = sum(22 if ord(c) > 0x2E80 else 12 for c in cur)
    wrapped = (wrapped + [cur])[:4]
    out = box(70, 70, 390, 400) + text(265, 118, t["wrapOn"], 22, DEEP, 800, "middle") + box(100, 150, 330, 260, WHITE, LINE, 10, 2)
    for i, row in enumerate(wrapped):
        out += text(120, 205 + i * 46, row, 22, INK)
    out += box(500, 70, 390, 400) + text(695, 118, t["wrapOff"], 22, DEEP, 800, "middle") + box(530, 150, 330, 260, WHITE, LINE, 10, 2)
    out += f'<clipPath id="nowrap"><rect x="532" y="152" width="326" height="256"/></clipPath>'
    out += f'<g clip-path="url(#nowrap)">{text(550, 205, words, 22, INK)}{text(550, 251, "12:04 INFO request id=8f2e status=200 time=41ms", 22, INK, font=MONO)}</g>'
    out += arrow(620, 370, 790, 370) + text(705, 352, t["scroll"], 18, MUTED, 400, "middle")
    return out


def md_syntax(t) -> str:
    rows = [
        (f"# {t['title']}", text(540, 140, t["title"], 36, INK, 800)),
        (f"**{t['bold']}**", text(540, 232, t["bold"], 26, INK, 800)),
        (f"- {t['item']}", f'<circle cx="550" cy="316" r="6" fill="{INK}"/>' + text(570, 324, t["item"], 26)),
        (f"[{t['link']}](https://…)", f'<text x="540" y="416" fill="{PINK}" font-size="26" text-decoration="underline" font-family="{FONT}">{esc(t["link"])}</text>'),
    ]
    out = text(70, 62, t["you"], 22, MUTED, 700) + text(530, 62, t["see"], 22, MUTED, 700)
    for i, (src, seen) in enumerate(rows):
        y = 90 + i * 92
        out += box(70, y, 360, 76, WHITE, LINE, 12, 2) + text(90, y + 48, src, 22, DEEP, 500, font=MONO)
        out += arrow(440, y + 38, 515, y + 38) + box(530, y, 360, 76, WHITE, LINE, 12, 2) + seen
    return out


def md_table(t) -> str:
    left = [f"| {t['day']} | {t['hours']} |", "|:---|---:|", f"| {t['sat']} | 4 |", f"| {t['sun']} | 6 |", "", f"- [x] {t['boots']}", f"- [ ] {t['snacks']}"]
    out = box(70, 60, 380, 420, WHITE, LINE, 14, 2) + text(90, 100, t["you"], 18, MUTED, 700)
    for i, row in enumerate(left):
        out += text(95, 150 + i * 44, row, 22, DEEP, 500, font=MONO)
    out += arrow(460, 270, 515, 270) + box(530, 60, 360, 420, WHITE, LINE, 14, 2) + text(550, 100, t["see"], 18, MUTED, 700)
    out += box(560, 120, 300, 54, SOFT, LINE, 0, 2) + box(560, 174, 300, 50, WHITE, LINE, 0, 2) + box(560, 224, 300, 50, WHITE, LINE, 0, 2) + line(710, 120, 710, 274, LINE, 2)
    out += text(578, 156, t["day"], 22, DEEP, 800) + text(842, 156, t["hours"], 22, DEEP, 800, "end")
    out += text(578, 208, t["sat"], 22) + text(842, 208, "4", 22, INK, 400, "end") + text(578, 258, t["sun"], 22) + text(842, 258, "6", 22, INK, 400, "end")
    out += box(562, 330, 28, 28, PINK, PINK, 6, 2) + f'<path d="M569 344 L575 351 L584 337" fill="none" stroke="{WHITE}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>' + text(606, 353, t["boots"], 24)
    out += box(562, 390, 28, 28, WHITE, MUTED, 6, 2) + text(606, 413, t["snacks"], 24)
    return out


def _rgb(hex_color: str) -> tuple[int, ...]:
    return tuple(int(hex_color[i:i + 2], 16) for i in (1, 3, 5))


def _mix(t: float) -> str:
    """The colour at t (0–1) along STOPS, for the conic wedges SVG has no gradient for."""
    seg = min(int(t * 2), 1)
    a, b = _rgb(STOPS[seg]), _rgb(STOPS[seg + 1])
    f = t * 2 - seg
    return "#%02x%02x%02x" % tuple(round(a[i] + (b[i] - a[i]) * f) for i in range(3))


def _stops() -> str:
    return "".join(f'<stop offset="{i * 50}%" stop-color="{c}"/>' for i, c in enumerate(STOPS))


def grad_types(t) -> str:
    out = f'<defs><linearGradient id="l" x1="0" y1="0" x2="1" y2="0">{_stops()}</linearGradient><radialGradient id="r">{_stops()}</radialGradient></defs>'
    wedges = ""
    cx, cy, r = 760, 260, 120
    for i in range(120):
        a0, a1 = math.radians(i * 3 - 90), math.radians((i + 1) * 3 - 90 + 0.4)
        wedges += (
            f'<path d="M{cx} {cy} L{cx + r * math.cos(a0):.1f} {cy + r * math.sin(a0):.1f} '
            f'A{r} {r} 0 0 1 {cx + r * math.cos(a1):.1f} {cy + r * math.sin(a1):.1f} Z" fill="{_mix(i / 119)}"/>'
        )
    out += f'<rect x="80" y="140" width="240" height="240" rx="18" fill="url(#l)"/><circle cx="480" cy="260" r="120" fill="url(#r)"/>{wedges}'
    out += arrow(100, 260, 300, 260, DEEP) + arrow(480, 260, 590, 260, DEEP)
    out += f'<path d="M760 180 A80 80 0 0 1 840 260" fill="none" stroke="{DEEP}" stroke-width="3"/><path d="M840 276 L832 258 L848 258 Z" fill="{DEEP}"/>'
    for x, label in ((200, t["linear"]), (480, t["radial"]), (760, t["conic"])):
        out += text(x, 110, label, 28, DEEP, 800, "middle")
    return out


def grad_stops(t) -> str:
    out = f'<defs><linearGradient id="s" x1="0" y1="0" x2="1" y2="0">{_stops()}</linearGradient></defs>'
    out += '<rect x="90" y="110" width="780" height="110" rx="14" fill="url(#s)"/>'
    for x, c, label in ((90, STOPS[0], "0%"), (480, STOPS[1], "50%"), (870, STOPS[2], "100%")):
        out += f'<path d="M{x} 222 L{x - 13} 250 L{x + 13} 250 Z" fill="{DEEP}"/><circle cx="{x}" cy="268" r="16" fill="{c}" stroke="{DEEP}" stroke-width="3"/>'
        out += text(x, 318, label, 22, DEEP, 800, "middle") + text(x, 348, c, 18, MUTED, 400, "middle", MONO)
    out += box(70, 380, 820, 110, WHITE, LINE, 14, 2)
    out += text(92, 425, "background: linear-gradient(90deg,", 22, DEEP, 500, font=MONO)
    out += text(92, 462, f"  {STOPS[0]} 0%, {STOPS[1]} 50%, {STOPS[2]} 100%);", 22, DEEP, 500, font=MONO)
    return out


def fancy_styles(t) -> str:
    rows = (
        (t["plain"], "cake 123"),
        (t["bold"], "𝐜𝐚𝐤𝐞 𝟏𝟐𝟑"),
        (t["script"], "𝒸𝒶𝓀ℯ 123"),
        (t["gothic"], "𝔠𝔞𝔨𝔢 123"),
        (t["circled"], "ⓒⓐⓚⓔ ①②③"),
    )
    out = ""
    for i, (label, sample) in enumerate(rows):
        y = 60 + i * 86
        out += box(70, y, 820, 72, SOFT if i == 0 else CARD, PINK if i == 0 else LINE, 14, 2)
        out += text(100, y + 46, label, 22, MUTED, 700) + text(860, y + 49, sample, 34, DEEP, 500, "end", FONT if i == 0 else MATH)
    return out


def fancy_changes(t) -> str:
    def row(y, label, parts, font=FONT):
        out = text(70, y - 66, label, 22, MUTED, 700) + box(70, y - 44, 820, 90, WHITE, LINE, 14, 2)
        x = 100
        for s, fill, width in parts:
            out += text(x, y + 16, s, 38, fill, 500, font=font if fill == PINK else FONT)
            x += width
        return out
    return (
        row(170, t["input"], (("Hi", INK, 90), ("你好", INK, 110), ("é", INK, 50), ("5", INK, 50)))
        + arrow(480, 240, 480, 298)
        + row(370, t["output"], (("𝐇𝐢", PINK, 90), ("你好", INK, 110), ("é", INK, 50), ("𝟓", PINK, 50)), MATH)
        + text(480, 470, t["keeps"], 24, DEEP, 700, "middle")
    )


def _coin(cx, cy, r, label, on=True) -> str:
    return (
        f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{SOFT if on else CARD}" stroke="{PINK if on else LINE}" stroke-width="4"/>'
        + text(cx, cy + r * 0.34, label, r * 0.95, DEEP, 800, "middle")
    )


def coin_even(t) -> str:
    return (
        _coin(480, 110, 60, "?", False)
        + arrow(450, 170, 260, 260) + arrow(510, 170, 700, 260)
        + text(340, 200, "50%", 26, PINK, 800, "middle") + text(620, 200, "50%", 26, PINK, 800, "middle")
        + _coin(230, 340, 76, t["headsShort"]) + _coin(730, 340, 76, t["tailsShort"])
        + text(230, 465, t["heads"], 28, DEEP, 800, "middle") + text(730, 465, t["tails"], 28, DEEP, 800, "middle")
    )


def coin_memory(t) -> str:
    out = "".join(_coin(110 + i * 112, 170, 48, t["headsShort"]) for i in range(5))
    out += _coin(760, 170, 62, "?", False) + text(760, 100, t["next"], 22, MUTED, 700, "middle")
    out += box(170, 300, 620, 130, SOFT, PINK)
    out += text(330, 385, f"{t['headsShort']} 50%", 44, DEEP, 800, "middle") + text(630, 385, f"{t['tailsShort']} 50%", 44, DEEP, 800, "middle")
    out += arrow(760, 240, 760, 296)
    return out


def tuner_strings(t) -> str:
    # Spanish pages default to solfège in the tuner, so the note names are labels too.
    rows = tuple(zip(t["notes"].split(), (t["lowHz"], "110 Hz", "147 Hz", "196 Hz", "247 Hz", "330 Hz"), (9, 7.5, 6, 4.5, 3, 2)))
    out = box(210, 56, 600, 428, SOFT, LINE, 12, 2)
    for i, (note, hz, width) in enumerate(rows):
        y = 96 + i * 70
        out += text(180, y + 12, note, 32, DEEP, 800, "end") + line(210, y, 810, y, INK, width) + text(835, y + 8, hz, 20, MUTED)
    out += text(510, 80, t["thick"], 18, MUTED, 700, "middle") + text(510, 470, t["thin"], 18, MUTED, 700, "middle")
    return out


def tuner_meter(t) -> str:
    out = f'<rect x="90" y="190" width="780" height="46" rx="23" fill="{LINE}"/>'
    # The ±5 cent band, on a ±50 cent scale over 780 px.
    out += f'<rect x="441" y="182" width="78" height="62" rx="10" fill="{PINK}"/>'
    for cents in (-50, -25, -5, 0, 5, 25, 50):
        x = 480 + cents * 7.8
        out += line(x, 244, x, 262, MUTED, 2)
        if abs(cents) != 5:
            out += text(x, 292, f"{cents:+d}".replace("-", "−") if cents else "0", 20, MUTED, 400, "middle")
    out += text(480, 160, t["ok"], 26, PINK, 800, "middle") + text(480, 322, f"±5 {t['cents']}", 20, MUTED, 400, "middle")
    out += text(200, 160, t["flat"], 28, DEEP, 800, "middle") + text(760, 160, t["sharp"], 28, DEEP, 800, "middle")
    out += box(90, 360, 340, 110) + arrow(150, 415, 360, 415) + text(255, 398, t["tighten"], 24, DEEP, 700, "middle")
    out += box(530, 360, 340, 110) + arrow(810, 415, 600, 415) + text(705, 398, t["loosen"], 24, DEEP, 700, "middle")
    return out


def _node(cx, cy, label, prime=False) -> str:
    fill, stroke = (PINK, PINK) if prime else (CARD, LINE)
    color = WHITE if prime else DEEP
    return f'<circle cx="{cx}" cy="{cy}" r="33" fill="{fill}" stroke="{stroke}" stroke-width="3"/>' + text(cx, cy + 9, label, 25, color, 800, "middle")


def factor_tree(t) -> str:
    composite = [(620, 60, "360"), (540, 130, "180"), (460, 200, "90"), (380, 270, "45"), (300, 340, "15")]
    primes = [(700, 130, "2"), (620, 200, "2"), (540, 270, "2"), (460, 340, "3"), (380, 410, "3"), (220, 410, "5")]
    edges = ""
    for (x, y, _), (cx, cy, _) in zip(composite, composite[1:] + [(220, 410, "")]):
        edges += line(x, y, cx, cy, LINE, 3)
    for (x, y, _), (cx, cy, _) in zip(composite, primes[:4] + [primes[4]]):
        edges += line(x, y, cx, cy, LINE, 3)
    out = edges + "".join(_node(x, y, s) for x, y, s in composite) + "".join(_node(x, y, s, True) for x, y, s in primes)
    return out + text(480, 495, "360 = 2³ × 3² × 5", 34, DEEP, 800, "middle")


def factor_pairs(t) -> str:
    out = text(480, 70, t["pairs"], 26, DEEP, 800, "middle")
    for i, (a, b) in enumerate(((1, 36), (2, 18), (3, 12), (4, 9), (6, 6))):
        y = 100 + i * 66
        out += text(300, y + 38, f"{a} × {b}", 28, DEEP if a != 6 else PINK, 800, "end", MONO)
        # A bar as long as b, in rows as tall as a: each pair is a rectangle of area 36.
        w, h = b * 14, a * 9
        out += f'<rect x="340" y="{y + 28 - h / 2}" width="{w}" height="{h}" rx="3" fill="{PINK if a == 6 else SOFT}" stroke="{PINK}" stroke-width="2"/>'
    return out + text(480, 462, t["sqrt"], 24, PINK, 800, "middle", MONO)


def lcm_venn(t) -> str:
    out = (
        f'<circle cx="370" cy="240" r="170" fill="{SOFT}" fill-opacity="0.75" stroke="{PINK}" stroke-width="3"/>'
        f'<circle cx="590" cy="240" r="170" fill="{SOFT}" fill-opacity="0.75" stroke="{PINK}" stroke-width="3"/>'
    )
    out += text(285, 60, "12", 34, DEEP, 800, "middle") + text(675, 60, "18", 34, DEEP, 800, "middle")
    out += text(285, 255, "2", 44, DEEP, 800, "middle") + text(675, 255, "3", 44, DEEP, 800, "middle")
    out += text(480, 225, "2", 40, PINK, 800, "middle") + text(480, 280, "3", 40, PINK, 800, "middle")
    out += text(480, 62, t["shared"], 20, MUTED, 700, "middle") + line(480, 74, 480, 186, MUTED, 2)
    out += text(250, 475, f"{t['gcf']} = 2 × 3 = 6", 28, PINK, 800, "middle", MONO)
    out += text(690, 475, f"{t['lcm']} = 2 × 2 × 3 × 3 = 36", 26, DEEP, 800, "middle", MONO)
    return out


def lcm_euclid(t) -> str:
    out = ""
    for i, (a, q, b, r, last) in enumerate(((18, 1, 12, 6, False), (12, 2, 6, 0, True))):
        y = 90 + i * 130
        out += box(150, y, 660, 96, SOFT if last else CARD, PINK if last else LINE)
        out += text(190, y + 62, f"{a} = {q} × ", 36, DEEP, 700, font=MONO)
        out += text(445, y + 62, str(b), 36, PINK if last else DEEP, 800, font=MONO)
        out += text(510, y + 62, f"+ {r}", 36, DEEP, 700, font=MONO)
    out += arrow(564, 186, 456, 224)
    out += text(480, 390, t["last"], 24, DEEP, 700, "middle") + text(480, 450, f"{t['gcf']} = 6", 40, PINK, 800, "middle", MONO)
    return out


DIAGRAMS = {
    "use-scientific-calculator": (("use-scientific-calculator-order", calc_order, 1), ("use-scientific-calculator-angle", calc_angle, 2)),
    "use-online-notepad": (("use-online-notepad-where", note_where, 1), ("use-online-notepad-wrap", note_wrap, 2)),
    "preview-markdown": (("preview-markdown-syntax", md_syntax, 1), ("preview-markdown-table", md_table, 2)),
    "make-css-gradient": (("make-css-gradient-types", grad_types, 1), ("make-css-gradient-stops", grad_stops, 2)),
    "make-fancy-text": (("make-fancy-text-styles", fancy_styles, 1), ("make-fancy-text-changes", fancy_changes, 2)),
    "flip-coin": (("flip-coin-even", coin_even, 1), ("flip-coin-memory", coin_memory, 2)),
    "tune-guitar": (("tune-guitar-strings", tuner_strings, 1), ("tune-guitar-meter", tuner_meter, 2)),
    "find-factors": (("find-factors-tree", factor_tree, 1), ("find-factors-pairs", factor_pairs, 2)),
    "find-lcm-gcf": (("find-lcm-gcf-venn", lcm_venn, 1), ("find-lcm-gcf-euclid", lcm_euclid, 2)),
}


def main(src: Path, locales: list[str]) -> None:
    count = 0
    for loc in locales:
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
    base = Path(args[args.index("--src") + 1]) if "--src" in args else Path(__file__).resolve().parents[1] / "scripts/learn-src/batch21"
    only = args[args.index("--only") + 1].split(",") if "--only" in args else LOCS
    main(base, only)
