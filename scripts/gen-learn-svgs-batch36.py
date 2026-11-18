#!/usr/bin/env python3
"""Step diagrams for the academic tutorials: statistics (standard deviation, sample size, Cronbach's alpha, t-test,
chi-square, p-values, z-scores) and citation styles (APA, MLA, Harvard).

Each draws the idea itself: the data and its deviations, formulas with the worked numbers, curves with the p-value
area shaded, tables of observed and expected counts, and references split into their parts. The numbers are the ones
the tools show for their default examples (tests/batch36-learn.test.ts recomputes them with src/shared/academic-stats.ts
and checks the files). Only short labels come from the `svg` block of scripts/learn-src/batch36/<locale>.json;
reference strings stay in English, because they are the literal format. Helpers are shared with batch 27.
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
MONO, MATH, LOCS, FOLDERS, ROOT = g.MONO, g.MATH, g.LOCS, g.FOLDERS, g.ROOT
LILAC = "#5b4a8a"
PALE = "#f4c3d7"
SERIF = "Georgia,'Times New Roman',serif"


def num(x: float, decimals: int) -> str:
    """A number with the locale's decimal mark and grouping (2.138 → 2,138 in es, id, vi); whole numbers stay whole."""
    return g.group(x, 0 if abs(x - round(x)) < 1e-9 and decimals >= 3 else decimals)


# --- curves ----------------------------------------------------------------------------------------------------------

def norm_pdf(z: float) -> float:
    return math.exp(-z * z / 2) / math.sqrt(2 * math.pi)


def t_pdf(x: float, df: float) -> float:
    c = math.exp(math.lgamma((df + 1) / 2) - math.lgamma(df / 2)) / math.sqrt(df * math.pi)
    return c * (1 + x * x / df) ** (-(df + 1) / 2)


def norm_below(z: float) -> float:
    return 0.5 * math.erfc(-z / math.sqrt(2))


def chi1_pdf(x: float) -> float:
    return 0 if x <= 0 else math.exp(-x / 2) / math.sqrt(2 * math.pi * x)


def curve(pdf, lo, hi, x0, x1, base, height, shade=(), top=None, stroke=PINK, fill=PINK) -> str:
    """A density from lo to hi drawn between x0 and x1 above `base`, `shade` = [(a, b)] areas filled."""
    top = top or max(pdf(lo + (hi - lo) * i / 400) for i in range(401))
    X = lambda v: x0 + (v - lo) / (hi - lo) * (x1 - x0)
    Y = lambda v: base - min(pdf(v), top) / top * height
    out = ""
    for a, b in shade:
        a, b = max(a, lo), min(b, hi)
        if b <= a:
            continue
        pts = [f"{X(a):.1f},{base}"] + [f"{X(a + (b - a) * i / 120):.1f},{Y(a + (b - a) * i / 120):.1f}" for i in range(121)] + [f"{X(b):.1f},{base}"]
        out += f'<polygon points="{" ".join(pts)}" fill="{fill}" opacity="0.55"/>'
    pts = [f"{X(lo + (hi - lo) * i / 300):.1f},{Y(lo + (hi - lo) * i / 300):.1f}" for i in range(301)]
    out += f'<polyline points="{" ".join(pts)}" fill="none" stroke="{stroke}" stroke-width="4"/>'
    out += line(x0, base, x1, base, MUTED, 3)
    return out


# --- standard deviation ----------------------------------------------------------------------------------------------

DATA = [2, 4, 4, 4, 5, 5, 7, 9]


def sd_deviations(t) -> str:
    x = lambda v: 110 + (v - 1) * 86
    base = 300
    out = line(80, base, 880, base, MUTED, 3)
    for v in range(1, 11):
        out += line(x(v), base, x(v), base + 10, MUTED, 2) + text(x(v), base + 38, str(v), 22, MUTED, 700, "middle")
    seen: dict[int, int] = {}
    for v in DATA:
        k = seen.get(v, 0)
        seen[v] = k + 1
        out += f'<circle cx="{x(v)}" cy="{base - 22 - k * 40}" r="16" fill="{PINK}"/>'
    out += f'<line x1="{x(5)}" y1="70" x2="{x(5)}" y2="{base}" stroke="{DEEP}" stroke-width="4" stroke-dasharray="10 8"/>'
    out += text(x(5), 60, f'{t["mean"]} = 5', 24, DEEP, 800, "middle")
    # Distances of the distinct values from the mean, drawn as arrows above the dots.
    for v, y in ((2, 120), (4, 165), (7, 165), (9, 120)):
        out += arrow(x(5), y, x(v), y, LILAC) + text((x(5) + x(v)) / 2, y - 10, f"{v - 5:+d}".replace("-", "−"), 22, LILAC, 800, "middle")
    squares = [(v - 5) ** 2 for v in DATA]
    out += box(60, 380, 840, 130, SOFT, PINK, 20)
    out += text(90, 420, f'{t["squares"]} (x − 5)²', 22, MUTED, 700)
    out += text(870, 420, f'= {t["sum"]}', 22, MUTED, 700, "end")
    out += text(90, 472, " + ".join(str(s) for s in squares) + f" = {sum(squares)}", 34, DEEP, 800, "start", MONO)
    return out


def sd_divide(t) -> str:
    ss = sum((v - 5) ** 2 for v in DATA)
    out = ""
    for i, (label, div, sym) in enumerate(((t["sample"], len(DATA) - 1, "s"), (t["population"], len(DATA), "σ"))):
        x0 = 60 + i * 440
        var = ss / div
        out += box(x0, 60, 400, 420, CARD if i else SOFT, PINK if not i else LINE, 22)
        out += text(x0 + 200, 115, label, 30, DEEP, 800, "middle")
        out += text(x0 + 200, 160, f'÷ {"n − 1" if not i else "n"}', 26, MUTED, 700, "middle", MATH)
        out += text(x0 + 200, 250, f"{ss} ÷ {div} = {num(var, 3)}", 34, INK, 800, "middle", MONO)
        out += text(x0 + 200, 285, f'{t["variance"]} {sym}²', 20, MUTED, 700, "middle")
        out += text(x0 + 200, 380, f"√{num(var, 3)} = {num(math.sqrt(var), 3)}", 34, DEEP, 800, "middle", MONO)
        out += text(x0 + 200, 415, f'{t["sd"]} {sym}', 20, MUTED, 700, "middle")
    return out


# --- sample size -----------------------------------------------------------------------------------------------------



def ss_cochran(t) -> str:
    # Worked with the rounded z the diagram prints, so the line reads 1.96² × … = 384.2.
    n0 = 1.96 ** 2 * 0.25 / 0.05 ** 2
    out = box(60, 50, 840, 250, CARD, LINE, 22)
    out += text(480, 150, "n₀ = z² · p (1 − p) ÷ e²", 56, INK, 800, "middle", MATH)
    for x, label in ((350, f'z = {num(1.96, 2)}'), (520, f'p = 50 %'), (720, f'e = 5 %')):
        out += text(x, 215, label, 24, DEEP, 800, "middle")
    # Long labels (Spanish, Vietnamese) wrap onto two lines instead of running into each other.
    for x, key in ((350, "confidence"), (520, "proportion"), (720, "margin")):
        out += wrapped(x, 255, t[key], 18, MUTED, 700, "middle", 14, 22)
    out += box(60, 330, 840, 170, SOFT, PINK, 22)
    out += text(480, 395, f'{num(1.96, 2)}² × {num(0.5, 1)} × {num(0.5, 1)} ÷ {num(0.05, 2)}² = {num(n0, 1)}', 32, INK, 800, "middle", MONO)
    out += text(480, 460, f'{t["roundUp"]} → {math.ceil(n0)} {t["people"]}', 34, DEEP, 800, "middle")
    return out


Z95 = 1.959963984540054  # the exact two-sided 95 % z the calculator uses
# Cochran's n at 95 % and p = 50 % for each margin, as the calculator gives it: 97, 385, 601, 1,068, 2,401.
SS_MARGINS = [(m, math.ceil(Z95 ** 2 * 0.25 / (m / 100) ** 2)) for m in (10, 5, 4, 3, 2)]


def ss_margins(t) -> str:
    base, h, x0, w = 430, 320, 130, 110
    out = line(x0 - 20, base, x0 + len(SS_MARGINS) * 150, base, MUTED, 3)
    for i, (m, n) in enumerate(SS_MARGINS):
        x = x0 + i * 150
        bh = n / 2401 * h
        out += f'<rect x="{x}" y="{base - bh:.1f}" width="{w}" height="{bh:.1f}" rx="10" fill="{PINK if m != 5 else DEEP}"/>'
        out += text(x + w / 2, base - bh - 12, g.group(n), 26, INK, 800, "middle")
        out += text(x + w / 2, base + 38, f"± {m} %", 24, MUTED, 700, "middle")
    out += text(x0 - 20, 70, t["needed"], 22, MUTED, 700)
    out += text(x0 + 2.5 * 150, base + 85, f'{t["marginAxis"]} · {t["confidence"]}', 22, MUTED, 700, "middle")
    return out


# --- Cronbach's alpha -------------------------------------------------------------------------------------------------

SAMPLE = [[4, 5, 4, 3, 4], [3, 4, 3, 3, 3], [5, 5, 4, 5, 5], [2, 3, 2, 2, 3], [4, 4, 5, 4, 4], [3, 3, 3, 4, 3], [5, 4, 5, 5, 4], [2, 2, 3, 2, 2], [4, 5, 4, 4, 5], [3, 3, 4, 3, 3]]


def var(xs) -> float:
    m = sum(xs) / len(xs)
    return sum((x - m) ** 2 for x in xs) / (len(xs) - 1)


def alpha_of(rows) -> tuple[float, float, float]:
    k = len(rows[0])
    cols = [[r[j] for r in rows] for j in range(k)]
    sv, tv = sum(var(c) for c in cols), var([sum(r) for r in rows])
    return k / (k - 1) * (1 - sv / tv), sv, tv


def ca_matrix(t) -> str:
    x0, y0, cw, rh = 70, 70, 62, 29
    out = text(x0 - 10, y0 - 20, t["respondent"], 16, MUTED, 700)
    for j in range(5):
        out += text(x0 + 70 + j * cw, y0, f"Q{j + 1}", 20, DEEP, 800, "middle")
    out += text(x0 + 70 + 5 * cw + 10, y0, t["total"], 18, DEEP, 800, "middle")
    for i, row in enumerate(SAMPLE):
        y = y0 + 32 + i * rh
        out += text(x0 + 10, y, str(i + 1), 18, MUTED, 700, "middle")
        for j, v in enumerate(row):
            out += text(x0 + 70 + j * cw, y, str(v), 20, INK, 700, "middle", MONO)
        out += text(x0 + 70 + 5 * cw + 10, y, str(sum(row)), 20, LILAC, 800, "middle", MONO)
    cols = [[r[j] for r in SAMPLE] for j in range(5)]
    vy = y0 + 32 + 10 * rh + 12
    out += line(x0, vy - 22, x0 + 70 + 5 * cw + 40, vy - 22, LINE, 2)
    for j, c in enumerate(cols):
        out += text(x0 + 70 + j * cw, vy + 6, num(var(c), 2), 17, PINK, 800, "middle", MONO)
    totals = [sum(r) for r in SAMPLE]
    out += text(x0 + 70 + 5 * cw + 10, vy + 6, num(var(totals), 2), 17, LILAC, 800, "middle", MONO)
    alpha, sv, tv = alpha_of(SAMPLE)
    out += box(510, 70, 400, 400, SOFT, PINK, 22)
    out += text(710, 140, "α = k ÷ (k − 1)", 30, INK, 800, "middle", MATH)
    out += text(710, 185, "× (1 − Σσᵢ² ÷ σₜ²)", 30, INK, 800, "middle", MATH)
    out += text(710, 230, t["k"], 18, MUTED, 700, "middle")
    out += text(710, 262, f'Σσᵢ² = {num(sv, 2)} · {t["itemVar"]}', 18, PINK, 800, "middle")
    out += text(710, 290, f'σₜ² = {num(tv, 2)} · {t["totalVar"]}', 18, LILAC, 800, "middle")
    out += text(710, 360, f'5 ÷ 4 × (1 − {num(sv, 2)} ÷ {num(tv, 2)})', 22, INK, 800, "middle", MONO)
    out += text(710, 420, f"α = {num(alpha, 3)}", 40, DEEP, 800, "middle", MONO)
    return out


def ca_bands(t) -> str:
    lo, hi, x0, x1 = 0.4, 1.0, 80, 880
    X = lambda v: x0 + (v - lo) / (hi - lo) * (x1 - x0)
    bands = [(0.4, 0.5, "unacceptable", "#f7e3ec"), (0.5, 0.6, "poor", "#f4cfdd"), (0.6, 0.7, "questionable", "#efb8cd"),
             (0.7, 0.8, "acceptable", "#e79cba"), (0.8, 0.9, "good", "#d96f9a"), (0.9, 1.0, "excellent", "#c83f79")]
    out = ""
    for i, (a, b, key, colour) in enumerate(bands):
        out += f'<rect x="{X(a):.1f}" y="250" width="{X(b) - X(a):.1f}" height="80" fill="{colour}"/>'
        out += wrapped((X(a) + X(b)) / 2, 380 + (i % 2) * 52, t[key], 19, INK if i < 4 else DEEP, 800, "middle", 11)
    for v in (0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0):
        out += line(X(v), 240, X(v), 340, WHITE if 0.4 < v < 1.0 else MUTED, 3) + text(X(v), 230, num(v, 1), 22, MUTED, 700, "middle")
    a = alpha_of(SAMPLE)[0]
    out += f'<path d="M{X(a):.1f} 245 l-14 -32 h28 z" fill="{LILAC}"/>'
    out += text(X(a), 150, f'{t["example"]}', 22, LILAC, 800, "middle")
    out += text(X(a), 190, f"α = {num(a, 3)}", 28, LILAC, 800, "middle", MONO)
    out += line(X(0.7), 120, X(0.7), 250, DEEP, 3) + text(X(0.7), 110, f"{num(0.7, 1)} +", 22, DEEP, 800, "middle")
    return out


# --- t-test ------------------------------------------------------------------------------------------------------------

def tt_choose(t) -> str:
    out = box(280, 40, 400, 80, SOFT, PINK, 18) + wrapped(480, 90, t["question"], 26, DEEP, 800, "middle", 30)
    for i, (name, when) in enumerate(((t["oneSample"], t["oneSampleWhen"]), (t["independent"], t["independentWhen"]), (t["paired"], t["pairedWhen"]))):
        x = 50 + i * 300
        out += arrow(480, 125, x + 135, 225, PINK)
        out += box(x, 235, 270, 140, CARD, PINK if i == 1 else LINE, 18)
        out += wrapped(x + 135, 285, name, 24, INK, 800, "middle", 18)
        out += wrapped(x + 135, 345, when, 19, MUTED, 700, "middle", 22)
    # A tiny picture of each comparison: one cloud against a line, two clouds, linked pairs.
    out += f'<circle cx="185" cy="455" r="30" fill="{PALE}"/>' + line(240, 420, 240, 490, DEEP, 4)
    out += f'<circle cx="445" cy="455" r="30" fill="{PALE}"/><circle cx="525" cy="455" r="30" fill="#d9d1ee"/>'
    for k in range(3):
        y = 425 + k * 30
        out += f'<circle cx="745" cy="{y}" r="9" fill="{PINK}"/><circle cx="825" cy="{y}" r="9" fill="{LILAC}"/>' + line(755, y, 815, y, MUTED, 2)
    return out


GROUP_A = [5.1, 4.9, 6.2, 5.8, 6.0, 5.5, 5.3, 6.1]
GROUP_B = [4.8, 4.7, 5.9, 5.0, 5.6, 5.2, 4.9, 5.4]


def upper_tail(pdf, x: float, steps: int = 4000) -> float:
    """∫ pdf from x to ∞, by Simpson's rule on u = x / t (so the infinite tail becomes 0 < u ≤ 1)."""
    f = lambda u: 0.0 if u <= 0 else pdf(x / u) * x / (u * u)
    h = 1 / steps
    return h / 3 * sum((1 if i in (0, steps) else 4 if i % 2 else 2) * f(i * h) for i in range(steps + 1))


def welch(a, b) -> tuple[float, float, float]:
    va, vb = var(a) / len(a), var(b) / len(b)
    tv = (sum(a) / len(a) - sum(b) / len(b)) / math.sqrt(va + vb)
    df = (va + vb) ** 2 / (va ** 2 / (len(a) - 1) + vb ** 2 / (len(b) - 1))
    return tv, df, 2 * upper_tail(lambda x: t_pdf(x, df), abs(tv))


def tt_curve(t) -> str:
    tv, df, p = welch(GROUP_A, GROUP_B)
    out = curve(lambda x: t_pdf(x, df), -4, 4, 80, 880, 430, 340, shade=((-4, -tv), (tv, 4)))
    X = lambda v: 80 + (v + 4) / 8 * 800
    for v in (-tv, tv):
        out += line(X(v), 430, X(v), 300, DEEP, 3) + text(X(v), 470, ("−" if v < 0 else "") + num(abs(v), 2), 24, DEEP, 800, "middle", MONO)
    out += text(480, 470, "0", 22, MUTED, 700, "middle")
    out += text(130, 330, f'{num(p / 2, 3)} {t["tail"]}', 20, MUTED, 700) + text(830, 330, f'{num(p / 2, 3)} {t["tail"]}', 20, MUTED, 700, "end")
    out += box(320, 40, 320, 56, SOFT, PINK, 16) + text(480, 78, f't({num(df, 2)}) → p = {num(p, 3)}', 26, DEEP, 800, "middle", MONO)
    return out


# --- chi-square ---------------------------------------------------------------------------------------------------------

OBS = [[20, 15], [30, 35]]


def chi_of(obs) -> tuple[float, list]:
    rows = [sum(r) for r in obs]
    cols = [obs[0][j] + obs[1][j] for j in range(2)]
    n = sum(rows)
    exp = [[rows[i] * cols[j] / n for j in range(2)] for i in range(2)]
    return sum((obs[i][j] - exp[i][j]) ** 2 / exp[i][j] for i in range(2) for j in range(2)), exp


chi1_p = lambda x: math.erfc(math.sqrt(x / 2))  # upper tail of χ² with 1 df


def chi1_critical(alpha: float = 0.05) -> float:
    lo, hi = 0.0, 50.0
    for _ in range(100):
        mid = (lo + hi) / 2
        lo, hi = (mid, hi) if chi1_p(mid) > alpha else (lo, mid)
    return (lo + hi) / 2


def chi_tables(t) -> str:
    rows = [sum(r) for r in OBS]
    cols = [OBS[0][j] + OBS[1][j] for j in range(2)]
    n = sum(rows)
    chi2, exp = chi_of(OBS)
    out = ""
    for k, (title, cells, x0) in enumerate(((t["observed"], OBS, 40), (t["expected"], exp, 500))):
        out += text(x0 + 210, 60, title, 30, DEEP, 800, "middle")
        out += box(x0, 80, 420, 330, CARD if k == 0 else SOFT, LINE if k == 0 else PINK, 18)
        out += text(x0 + 200, 125, t["yes"], 22, MUTED, 800, "middle") + text(x0 + 300, 125, t["no"], 22, MUTED, 800, "middle") + text(x0 + 380, 125, "Σ", 22, MUTED, 800, "middle")
        for i, name in enumerate((t["groupA"], t["groupB"])):
            y = 190 + i * 80
            out += wrapped(x0 + 80, y, name, 20, MUTED, 800, "middle", 10)
            for j in range(2):
                v = cells[i][j]
                out += text(x0 + 200 + j * 100, y + 8, num(v, 1) if k else str(v), 34, INK if k == 0 else DEEP, 800, "middle", MONO)
            out += text(x0 + 380, y + 8, str(rows[i]), 24, MUTED, 700, "middle", MONO)
        out += text(x0 + 80, 380, "Σ", 22, MUTED, 800, "middle")
        for j in range(2):
            out += text(x0 + 200 + j * 100, 380, str(cols[j]), 24, MUTED, 700, "middle", MONO)
        out += text(x0 + 380, 380, str(n), 24, MUTED, 700, "middle", MONO)
    out += text(480, 470, f'E = {rows[0]} × {cols[0]} ÷ {n} = {num(exp[0][0], 1)}', 28, LILAC, 800, "middle", MONO)
    out += text(480, 515, f'χ² = Σ (O − E)² ÷ E = {num(chi2, 2)}', 26, DEEP, 800, "middle", MONO)
    return out


def chi_curve(t) -> str:
    crit, yours = chi1_critical(), chi_of(OBS)[0]
    # Drawn from 0.2 on a 0–8 axis: the density rises without bound towards 0, so it starts where it fits.
    out = curve(chi1_pdf, 0.2, 8, 100, 880, 430, 340, shade=((crit, 8),)) + line(80, 430, 100, 430, MUTED, 3)
    X = lambda v: 80 + v / 8 * 800
    out += line(X(crit), 430, X(crit), 150, DEEP, 3) + text(X(crit), 140, f'{num(crit, 2)} · {t["critical"]}', 20, DEEP, 800, "middle")
    out += line(X(yours), 430, X(yours), 220, LILAC, 4) + text(X(yours), 210, f'χ² = {num(yours, 2)} · {t["yours"]}', 22, LILAC, 800, "start")
    out += text(X(6), 400, "5 %", 24, DEEP, 800, "middle")
    out += box(560, 40, 340, 56, SOFT, PINK, 16) + text(730, 78, f'df = 1 → p = {num(chi1_p(yours), 3)}', 26, DEEP, 800, "middle", MONO)
    for v in range(0, 9, 2):
        out += text(X(v), 465, str(v), 20, MUTED, 700, "middle")
    return out


# --- p-values -------------------------------------------------------------------------------------------------------------

def pv_two(t) -> str:
    z = 1.959963984540054
    out = curve(norm_pdf, -4, 4, 80, 880, 430, 340, shade=((-4, -z), (z, 4)))
    X = lambda v: 80 + (v + 4) / 8 * 800
    for v in (-z, z):
        out += line(X(v), 430, X(v), 280, DEEP, 3) + text(X(v), 470, ("−" if v < 0 else "") + num(1.96, 2), 24, DEEP, 800, "middle", MONO)
        out += text(X(v * 1.45), 360, f'{num(2.5, 1)} %', 22, DEEP, 800, "middle")
    out += text(480, 470, "z = 0", 20, MUTED, 700, "middle")
    out += box(300, 40, 360, 56, SOFT, PINK, 16) + text(480, 78, f'{t["twoTailed"]}: p = {num(0.05, 2)}', 26, DEEP, 800, "middle")
    return out


def pv_one_two(t) -> str:
    z = 1.959963984540054
    out = ""
    for i, (label, shade, p, places) in enumerate(((t["oneTailed"], ((z, 4),), 0.025, 3), (t["twoTailed"], ((-4, -z), (z, 4)), 0.05, 2))):
        x0 = 50 + i * 450
        out += box(x0, 40, 410, 460, CARD, LINE if i == 0 else PINK, 22)
        out += text(x0 + 205, 95, label, 28, DEEP, 800, "middle")
        out += curve(norm_pdf, -4, 4, x0 + 25, x0 + 385, 380, 220, shade=shade)
        out += text(x0 + 205, 420, f'z = {num(1.96, 2)}', 22, MUTED, 700, "middle", MONO)
        out += text(x0 + 205, 465, f'p = {num(p, places)}', 30, DEEP, 800, "middle", MONO)
    return out


# --- z-scores -------------------------------------------------------------------------------------------------------------

def z_formula(t) -> str:
    out = box(60, 50, 840, 250, CARD, LINE, 22)
    out += text(480, 160, "z = (x − μ) ÷ σ", 64, INK, 800, "middle", MATH)
    for x, label in ((415, t["value"]), (535, t["mean"]), (690, t["sd"])):
        out += wrapped(x, 240, label, 20, DEEP, 800, "middle", 12, 24)
    out += box(60, 330, 840, 170, SOFT, PINK, 22)
    out += text(480, 380, t["example"], 24, MUTED, 700, "middle")
    out += text(480, 450, f'(130 − 100) ÷ 15 = 2 → {num(norm_below(2) * 100, 2)} % {t["below"]}', 32, DEEP, 800, "middle", MONO)
    return out


def z_rule(t) -> str:
    out = ""
    X = lambda v: 80 + (v + 4) / 8 * 800
    shades = tuple((k, colour, (norm_below(k) - norm_below(-k)) * 100) for k, colour in ((3, "#f7d7e4"), (2, "#efb0c9"), (1, "#d96f9a")))
    for k, colour, _ in shades:
        out += curve(norm_pdf, -4, 4, 80, 880, 430, 300, shade=((-k, k),), fill=colour).replace('opacity="0.55"', 'opacity="1"')
    out += curve(norm_pdf, -4, 4, 80, 880, 430, 300)
    for v in range(-3, 4):
        out += line(X(v), 430, X(v), 442, MUTED, 2) + text(X(v), 470, "0" if v == 0 else f"{v:+d} σ".replace("-", "−"), 20, MUTED, 700, "middle")
    # Legend in the top corners, one row per band: the curve's peak sits in the middle.
    for i, (k, colour, p) in enumerate(reversed(shades)):
        y = 60 + i * 38
        out += f'<rect x="60" y="{y - 20}" width="26" height="26" rx="6" fill="{colour}"/>'
        out += text(98, y, f"±{k} σ: {num(p, 2)} %", 22, DEEP, 800)
    return out


# --- citations --------------------------------------------------------------------------------------------------------------

def parts_diagram(rows, labels) -> str:
    """Reference parts laid out on lines: each part a coloured chip with its label under it."""
    out = ""
    colours = [PINK, LILAC, DEEP, "#2f7d6d", "#b5651d", "#3a6ea5"]
    for (y, parts) in rows:
        x = 50
        for k, (s, italic, label_idx) in enumerate(parts):
            w = max(len(s) * 15.5 + 24, 90)
            colour = colours[label_idx % len(colours)]
            out += f'<rect x="{x:.1f}" y="{y - 40}" width="{w:.1f}" height="56" rx="12" fill="{WHITE}" stroke="{colour}" stroke-width="3"/>'
            style = ' font-style="italic"' if italic else ""
            out += f'<text x="{x + w / 2:.1f}" y="{y - 3}" fill="{INK}" font-size="26" font-weight="600" text-anchor="middle" font-family="{SERIF}"{style}>{esc(s)}</text>'
            out += wrapped(x + w / 2, y + 48, labels[label_idx], 18, colour, 800, "middle", max(10, int(w / 11)))
            x += w + 14
    return out


def apa_parts(t) -> str:
    labels = [t["author"], t["year"], t["title"], t["journal"], t["issue"], t["doi"]]
    rows = [
        (110, [("LeCun, Y., Bengio, Y., & Hinton, G.", False, 0), ("(2015).", False, 1)]),
        (260, [("Deep learning.", False, 2), ("Nature, 521", True, 3), ("(7553), 436–444.", False, 4)]),
        (410, [("https://doi.org/10.1038/nature14539", False, 5)]),
    ]
    return parts_diagram(rows, labels)


def harvard_parts(t) -> str:
    labels = [t["author"], t["year"], t["title"], t["journal"], t["volume"], t["available"]]
    rows = [
        (110, [("LeCun, Y., Bengio, Y. and Hinton, G.", False, 0), ("(2015)", False, 1)]),
        (260, [("'Deep learning',", False, 2), ("Nature,", True, 3), ("521(7553), pp. 436–444.", False, 4)]),
        (410, [("Available at: https://doi.org/10.1038/nature14539.", False, 5)]),
    ]
    return parts_diagram(rows, labels)


def apa_intext(t) -> str:
    out = box(40, 40, 880, 460, CARD, LINE, 22)
    out += text(330, 95, t["parenthetical"], 26, DEEP, 800, "middle") + text(720, 95, t["narrative"], 26, DEEP, 800, "middle")
    rows = ((t["oneAuthor"], "(Smith, 2020)", "Smith (2020)"), (t["twoAuthors"], "(Smith & Lee, 2020)", "Smith and Lee (2020)"),
            (t["threeAuthors"], "(LeCun et al., 2015)", "LeCun et al. (2015)"))
    for i, (who, par, nar) in enumerate(rows):
        y = 190 + i * 110
        out += line(60, y - 55, 900, y - 55, LINE, 2)
        out += wrapped(120, y, who, 20, MUTED, 800, "middle", 12)
        out += text(330, y + 8, par, 26, INK, 600, "middle", SERIF) + text(720, y + 8, nar, 26, INK, 600, "middle", SERIF)
    return out


def mla_elements(t) -> str:
    rows = [("author", "LeCun, Yann, et al."), ("title", '"Deep Learning."'), ("container", "Nature,"), ("contributors", "—"),
            ("version", "—"), ("number", "vol. 521, no. 7553,"), ("publisher", "—"), ("date", "2015,"), ("location", "pp. 436-44.")]
    out = ""
    for i, (key, example) in enumerate(rows):
        y = 50 + i * 52
        used = example != "—"
        out += box(40, y, 380, 42, SOFT if used else CARD, PINK if used else LINE, 10, 2)
        out += text(60, y + 29, f"{i + 1}. {t[key]}", 20, DEEP if used else MUTED, 800)
        if used:
            out += arrow(430, y + 21, 480, y + 21, PINK)
        style = ' font-style="italic"' if key == "container" else ""
        out += f'<text x="500" y="{y + 30}" fill="{INK if used else MUTED}" font-size="24" font-weight="600" font-family="{SERIF}"{style}>{esc(example)}</text>'
    return out


def citation_link(t, left_title, left, right_title, right_lines, italic_word) -> str:
    out = box(30, 60, 390, 160, SOFT, PINK, 20) + text(225, 105, left_title, 22, DEEP, 800, "middle")
    out += text(225, 170, left, 21, INK, 700, "middle", SERIF)
    out += arrow(425, 140, 470, 200, PINK)
    out += box(470, 60, 460, 300, CARD, LINE, 20) + text(700, 105, right_title, 26, DEEP, 800, "middle")
    # One entry with a hanging indent: the first line flush left, the rest indented.
    y = 175
    for k, s in enumerate(right_lines):
        x = 495 if k == 0 else 530
        if italic_word and italic_word in s:
            a, b = s.split(italic_word, 1)
            out += f'<text x="{x}" y="{y}" fill="{INK}" font-size="20" font-family="{SERIF}">{esc(a)}<tspan font-style="italic">{esc(italic_word)}</tspan>{esc(b)}</text>'
        else:
            out += f'<text x="{x}" y="{y}" fill="{INK}" font-size="20" font-family="{SERIF}">{esc(s)}</text>'
        y += 36
    return out


def mla_intext(t) -> str:
    return citation_link(t, t["inText"], "(LeCun et al. 437)", t["worksCited"], [
        'LeCun, Yann, et al. "Deep Learning."', "Nature, vol. 521, no. 7553, 2015,", "pp. 436-44, https://doi.org/", "10.1038/nature14539."], "Nature")


def harvard_intext(t) -> str:
    return citation_link(t, t["inText"], "(LeCun, Bengio and Hinton, 2015)", t["referenceList"], [
        "LeCun, Y., Bengio, Y. and Hinton, G.", "(2015) 'Deep learning', Nature,", "521(7553), pp. 436–444. Available at:", "https://doi.org/10.1038/nature14539."], "Nature")


DIAGRAMS = {
    "calculate-standard-deviation": (("calculate-standard-deviation-deviations", sd_deviations, 1), ("calculate-standard-deviation-divide", sd_divide, 2)),
    "calculate-sample-size": (("calculate-sample-size-margins", ss_margins, 1), ("calculate-sample-size-cochran", ss_cochran, 2)),
    "calculate-cronbach-alpha": (("calculate-cronbach-alpha-matrix", ca_matrix, 1), ("calculate-cronbach-alpha-bands", ca_bands, 2)),
    "run-t-test": (("run-t-test-choose", tt_choose, 1), ("run-t-test-curve", tt_curve, 2)),
    "run-chi-square-test": (("run-chi-square-test-tables", chi_tables, 1), ("run-chi-square-test-curve", chi_curve, 2)),
    "find-p-value": (("find-p-value-tails", pv_one_two, 1), ("find-p-value-two-tailed", pv_two, 2)),
    "calculate-z-score": (("calculate-z-score-formula", z_formula, 1), ("calculate-z-score-rule", z_rule, 2)),
    "cite-apa": (("cite-apa-parts", apa_parts, 1), ("cite-apa-in-text", apa_intext, 2)),
    "cite-mla": (("cite-mla-elements", mla_elements, 1), ("cite-mla-in-text", mla_intext, 2)),
    "cite-harvard": (("cite-harvard-parts", harvard_parts, 1), ("cite-harvard-in-text", harvard_intext, 2)),
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
    base = Path(args[args.index("--src") + 1]) if "--src" in args else HERE / "learn-src/batch36"
    only = args[args.index("--only") + 1].split(",") if "--only" in args else LOCS
    main(base, only)
