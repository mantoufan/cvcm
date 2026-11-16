#!/usr/bin/env python3
"""Step diagrams for the hangman, rock paper scissors, BAC and simple interest lessons.

Each draws the idea itself (the hangman board and letter frequencies, who-beats-whom wheels, the Widmark formula and
a BAC curve, the interest formula and simple-versus-compound bars), so most of each picture is letters, numbers and
marks; only short labels come from the `svg` block of scripts/learn-src/batch32/<locale>.json. Drawing helpers are
shared with the batch 27 generator.
"""
from __future__ import annotations

import importlib.util
import json
import math
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
_spec = importlib.util.spec_from_file_location("svg27", HERE / "gen-learn-svgs-batch27.py")
g = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(g)
text, box, line, arrow, page, wrapped, esc = g.text, g.box, g.line, g.arrow, g.page, g.wrapped, g.esc
DEEP, SOFT, INK, MUTED, PINK, WHITE, CARD, LINE = g.DEEP, g.SOFT, g.INK, g.MUTED, g.PINK, g.WHITE, g.CARD, g.LINE
MONO, LOCS, FOLDERS, ROOT = g.MONO, g.LOCS, g.FOLDERS, g.ROOT
LILAC = "#5b4a8a"


def dec(s: str) -> str:
    """A decimal written with the locale's mark (0.05 → 0,05 in es, id, vi), the mark g.group() uses."""
    return s.replace(".", g.group(1.5, 1)[1])


# --- hangman -------------------------------------------------------------------------------------------------------

def hm_board(t) -> str:
    out = ""
    # Gallows and figure: three parts drawn (three wrong letters), three still to come (dashed).
    out += f'<path d="M70 450 H250 M120 450 V80 H260 V130" fill="none" stroke="{MUTED}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>'
    solid = f'stroke="{PINK}" stroke-width="7" stroke-linecap="round" fill="none"'
    ghost = f'stroke="{LINE}" stroke-width="5" stroke-linecap="round" fill="none" stroke-dasharray="8 9"'
    out += f'<circle cx="260" cy="168" r="36" {solid}/>'
    out += f'<line x1="260" y1="204" x2="260" y2="320" {solid}/>'
    out += f'<line x1="260" y1="230" x2="210" y2="285" {solid}/>'
    out += f'<line x1="260" y1="230" x2="310" y2="285" {ghost}/>'
    out += f'<line x1="260" y1="320" x2="215" y2="400" {ghost}/>'
    out += f'<line x1="260" y1="320" x2="305" y2="400" {ghost}/>'
    out += text(330, 172, t["head"], 22, MUTED, 700)
    # Labels point at what is drawn: the solid arm on the left, the body beside its middle.
    out += text(200, 250, t["arms"], 22, MUTED, 700, "end")
    out += text(250, 315, t["body"], 22, MUTED, 700, "end")
    out += text(320, 410, t["legs"], 22, MUTED, 700)
    out += box(70, 470, 300, 50, SOFT, PINK, 14) + text(220, 503, t["parts"], 22, DEEP, 800, "middle")
    # The word PLANET (PLANETA in Spanish) with L, A and E found; S, R and O missed.
    out += text(470, 120, t["word"], 26, MUTED, 700)
    x0 = 470
    for i, ch in enumerate("_LA_E_A" if word_list() == "es" else "_LA_E_"):
        x = x0 + i * 64
        out += line(x, 230, x + 50, 230, INK, 5)
        if ch != "_":
            out += text(x + 25, 215, ch, 50, INK, 800, "middle", MONO)
    out += text(470, 330, t["wrong"], 26, MUTED, 700)
    for i, ch in enumerate("SRO"):
        x = 470 + i * 72
        out += box(x, 352, 56, 64, CARD, LINE, 10) + text(x + 28, 398, ch, 38, PINK, 800, "middle", MONO)
        out += line(x + 8, 404, x + 48, 364, PINK, 4)
    out += text(690, 395, "3 / 6", 34, DEEP, 800)
    return out


# Share of the game's words (src/shared/hangman.ts WORDS, all categories) that contain each letter, in %: what a
# guess actually hits. Top 12 per list, ties by letter. tests/batch32-learn.test.ts recomputes it from the lists and
# fails when the word lists change without this file (update it with the numbers the test prints).
SHARE = json.loads((HERE / "learn-src/batch32/hangman-letter-share.json").read_text(encoding="utf-8"))


def word_list() -> str:
    """The list a locale's hangman page deals by default (es and id their own, everyone else English)."""
    return g.LOC if g.LOC in ("es", "id") else "en"


def hm_letters(t) -> str:
    out = text(480, 70, t["freq"], 28, INK, 800, "middle")
    x0, base, scale, w = 90, 440, 4.6, 52
    for i, (ch, pct) in enumerate(SHARE[word_list()]):
        x = x0 + i * 66
        h = pct * scale
        first = i < 6
        out += f'<rect x="{x}" y="{base - h:.1f}" width="{w}" height="{h:.1f}" rx="8" fill="{PINK if first else "#f4c3d7"}"/>'
        out += text(x + w / 2, base - h - 10, f"{pct} %", 18, MUTED, 700, "middle")
        out += text(x + w / 2, base + 40, ch, 30, INK, 800, "middle", MONO)
    out += line(x0 - 10, base, x0 + 12 * 66, base, LINE, 3)
    out += box(x0, 492, 6 * 66 - 14, 38, SOFT, PINK, 12) + text(x0 + (6 * 66 - 14) / 2, 518, t["tryFirst"], 20, DEEP, 800, "middle")
    return out


# --- rock paper scissors -------------------------------------------------------------------------------------------

BEATS = {
    "rock": ("scissors", "lizard"),
    "paper": ("rock", "spock"),
    "scissors": ("paper", "lizard"),
    "lizard": ("paper", "spock"),
    "spock": ("scissors", "rock"),
}


def node(x, y, label, r=74) -> str:
    return (f'<circle cx="{x}" cy="{y}" r="{r}" fill="{SOFT}" stroke="{PINK}" stroke-width="4"/>'
            + text(x, y + 6, label, 26, INK, 800, "middle"))


def edge(a, b, r, colour=PINK) -> str:
    (x1, y1), (x2, y2) = a, b
    d = math.hypot(x2 - x1, y2 - y1)
    ux, uy = (x2 - x1) / d, (y2 - y1) / d
    return arrow(x1 + ux * (r + 6), y1 + uy * (r + 6), x2 - ux * (r + 10), y2 - uy * (r + 10), colour)


def rps_rules(t) -> str:
    pos = {"rock": (480, 120), "scissors": (700, 410), "paper": (260, 410)}
    out = ""
    for a in pos:
        for b in BEATS[a]:
            if b in pos:
                out += edge(pos[a], pos[b], 80)
    for a, (x, y) in pos.items():
        out += node(x, y, t[a], 80)
    out += text(480, 330, f'→ {t["beats"]}', 24, MUTED, 700, "middle")
    return out


def rps_spock(t) -> str:
    order = ("rock", "paper", "scissors", "spock", "lizard")
    cx, cy, rad = 480, 285, 200
    pos = {m: (cx + rad * math.sin(2 * math.pi * i / 5), cy - rad * math.cos(2 * math.pi * i / 5)) for i, m in enumerate(order)}
    out = ""
    for a in order:
        for b in BEATS[a]:
            out += edge(pos[a], pos[b], 62, PINK if a in ("rock", "paper", "scissors") and b in ("rock", "paper", "scissors") else LILAC)
    for m in order:
        out += node(pos[m][0], pos[m][1], t[m], 62)
    out += text(60, 70, f'→ {t["beats"]}', 24, MUTED, 700)
    return out


# --- BAC -----------------------------------------------------------------------------------------------------------

def bac_formula(t) -> str:
    out = box(50, 60, 860, 190, CARD, LINE, 22)
    out += text(480, 130, "BAC =", 34, INK, 800, "middle")
    # grams / (weight × r) × 100 − 0.015 × hours
    out += text(300, 190, t["grams"], 22, DEEP, 800, "middle")
    out += line(160, 205, 440, 205, INK, 3)
    out += text(300, 238, f'{t["weight"]} × r', 22, DEEP, 800, "middle")
    out += text(470, 215, "× 100", 28, INK, 800)
    out += text(570, 215, f'− {dec("0.015")} ×', 28, INK, 800)
    out += text(790, 215, t["hours"], 24, DEEP, 800, "middle")
    out += text(480, 290, f'r: {t["factor"]}', 22, MUTED, 700, "middle")
    out += box(50, 330, 860, 170, SOFT, PINK, 22)
    out += text(480, 380, t["example"], 24, MUTED, 700, "middle")
    calc = f'42 ÷ ({g.group(70000)} × {dec("0.68")}) × 100 − {dec("0.015")} × 2'
    out += text(480, 430, calc, 28, INK, 700, "middle", MONO)
    out += text(480, 478, f'= {dec("0.088")} − {dec("0.030")} = {dec("0.058")} %', 30, DEEP, 800, "middle", MONO)
    return out


def bac_curve(t) -> str:
    x0, y0, w, h = 110, 70, 780, 370  # plot box; x 0–7 h, y 0–0.10 %
    X = lambda hr: x0 + hr / 7 * w
    Y = lambda pct: y0 + h - pct / 0.10 * h
    out = line(x0, y0 + h, x0 + w, y0 + h, INK, 3) + line(x0, y0, x0, y0 + h, INK, 3)
    for hr in range(8):
        out += text(X(hr), y0 + h + 32, str(hr), 20, MUTED, 700, "middle")
    for lv in (0.08, 0.05, 0.02):
        out += f'<line x1="{x0}" y1="{Y(lv):.1f}" x2="{x0 + w}" y2="{Y(lv):.1f}" stroke="{LINE}" stroke-width="3" stroke-dasharray="10 8"/>'
        out += text(x0 - 12, Y(lv) + 7, dec(f"{lv:.2f}"), 20, MUTED, 700, "end")
    out += text(x0 - 12, Y(0) + 7, "0", 20, MUTED, 700, "end")
    peak = 0.088
    zero = peak / 0.015
    out += f'<line x1="{X(0):.1f}" y1="{Y(peak):.1f}" x2="{X(zero):.1f}" y2="{Y(0):.1f}" stroke="{PINK}" stroke-width="6" stroke-linecap="round"/>'
    out += f'<circle cx="{X(0):.1f}" cy="{Y(peak):.1f}" r="10" fill="{DEEP}"/>' + text(X(0) + 18, Y(peak) - 12, f'{t["peak"]} {dec("0.088")} %', 22, DEEP, 800)
    out += f'<circle cx="{X(zero):.1f}" cy="{Y(0):.1f}" r="10" fill="{PINK}"/>' + text(x0 + w, Y(0) - 40, f'≈ {dec("5.9")} {t["hUnit"]} → 0 %', 22, PINK, 800, "end")
    # The worked example: 2 hours after the first drink.
    ex = peak - 0.015 * 2
    out += f'<line x1="{X(2):.1f}" y1="{Y(0):.1f}" x2="{X(2):.1f}" y2="{Y(ex):.1f}" stroke="{LILAC}" stroke-width="3" stroke-dasharray="6 6"/>'
    out += f'<circle cx="{X(2):.1f}" cy="{Y(ex):.1f}" r="10" fill="{LILAC}"/>' + text(X(2) + 18, Y(ex) - 14, f'2 {t["hUnit"]}: {dec("0.058")} %', 22, LILAC, 800)
    out += text(x0 + w / 2, y0 + h + 70, t["time"], 22, MUTED, 700, "middle")
    out += text(x0 + w - 6, Y(0.095), f'−{dec("0.015")} % / {t["hUnit"]}', 24, LILAC, 800, "end")
    return out


# --- simple interest -----------------------------------------------------------------------------------------------

def si_formula(t) -> str:
    out = box(60, 60, 840, 230, CARD, LINE, 22)
    xs = (170, 380, 590, 790)
    for x, sym in zip(xs, ("I", "P", "r", "t")):
        out += text(x, 175, sym, 84, INK, 800, "middle", "'Cambria Math','STIX Two Math',Georgia,serif")
    out += text(275, 168, "=", 64, MUTED, 700, "middle") + text(485, 168, "×", 60, MUTED, 700, "middle") + text(690, 168, "×", 60, MUTED, 700, "middle")
    for x, key in zip(xs, ("interest", "principal", "rate", "years")):
        out += text(x, 240, t[key], 22, DEEP, 800, "middle")
    out += box(60, 330, 840, 160, SOFT, PINK, 22)
    out += text(480, 380, t["example"], 24, MUTED, 700, "middle")
    out += text(480, 445, f'{g.group(10000)} × {dec("0.05")} × 3 = {g.group(1500)}', 38, DEEP, 800, "middle", MONO)
    return out


def si_compare(t) -> str:
    x0, base, h = 120, 430, 330
    years = range(1, 11)
    top = 10000 * 1.05 ** 10 - 10000
    out = line(x0 - 10, base, x0 + 10 * 76, base, INK, 3)
    for i, y in enumerate(years):
        simple = 10000 * 0.05 * y
        comp = 10000 * 1.05 ** y - 10000
        x = x0 + i * 76
        hs, hc = simple / top * h, comp / top * h
        out += f'<rect x="{x}" y="{base - hs:.1f}" width="28" height="{hs:.1f}" rx="5" fill="{PINK}"/>'
        out += f'<rect x="{x + 32}" y="{base - hc:.1f}" width="28" height="{hc:.1f}" rx="5" fill="{LILAC}"/>'
        out += text(x + 30, base + 32, str(y), 20, MUTED, 700, "middle")
    out += text(x0 + 5 * 76, base + 70, f'{t["year"]} · {g.group(10000)} · 5 %', 22, MUTED, 700, "middle")
    out += text(130, 50, t["after10"], 22, MUTED, 700)
    # Stacked, so a long label in one language never runs into the other entry.
    out += f'<rect x="130" y="64" width="24" height="24" rx="5" fill="{PINK}"/>' + text(164, 84, f'{t["simple"]}: {g.group(5000)}', 22, INK, 800)
    out += f'<rect x="130" y="98" width="24" height="24" rx="5" fill="{LILAC}"/>' + text(164, 118, f'{t["compound"]}: {g.group(round(top))}', 22, INK, 800)
    return out


DIAGRAMS = {
    "play-hangman": (("play-hangman-board", hm_board, 1), ("play-hangman-letters", hm_letters, 2)),
    "play-rock-paper-scissors": (("play-rock-paper-scissors-rules", rps_rules, 1), ("play-rock-paper-scissors-spock", rps_spock, 2)),
    "calculate-bac": (("calculate-bac-formula", bac_formula, 1), ("calculate-bac-curve", bac_curve, 2)),
    "calculate-simple-interest": (("calculate-simple-interest-formula", si_formula, 1), ("calculate-simple-interest-compare", si_compare, 2)),
}


def main(src: Path, locales: list[str]) -> None:
    count = 0
    for loc in locales:
        g.LOC = loc
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
    base = Path(args[args.index("--src") + 1]) if "--src" in args else HERE / "learn-src/batch32"
    only = args[args.index("--only") + 1].split(",") if "--only" in args else LOCS
    main(base, only)
