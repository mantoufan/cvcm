#!/usr/bin/env python3
"""Step diagrams for the white noise, decibel meter, voice recorder, screen recorder and triangle lessons.

These draw the idea itself (a factor tree, a tuner meter, colour stops), so most of each picture is numbers and only
a few labels need translating. Labels come from the `svg` block of scripts/learn-src/batch24/<locale>.json.
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


def noise_spectrum(t) -> str:
    # Spectral density (energy per Hz) on a log-frequency axis: white is flat, pink falls 3 dB and brown 6 dB per octave.
    x0, x1, y0, y1 = 170, 680, 110, 410
    out = box(70, 60, 820, 420)
    out += line(x0, y1, x1, y1, MUTED, 2) + line(x0, y0 - 20, x0, y1, MUTED, 2)
    out += text(x0, 445, t["low"], 20, MUTED, 400, "start") + text(x1, 445, t["high"], 20, MUTED, 400, "end")
    out += text((x0 + x1) / 2, 445, t["frequency"] + " →", 20, MUTED, 400, "middle")
    out += f'<text x="120" y="{(y0 + y1) / 2}" fill="{MUTED}" font-size="20" text-anchor="middle" font-family="{FONT}" transform="rotate(-90 120 {(y0 + y1) / 2})">{esc(t["energy"])} →</text>'
    octaves = 9
    def yy(db):
        return y0 + 60 + (-db) * (y1 - y0 - 70) / (6 * octaves)
    for name, slope, color in ((t["white"], 0, DEEP), (t["pink"], -3, PINK), (t["brown"], -6, MUTED)):
        end = yy(slope * octaves)
        out += line(x0, yy(0), x1, end, color, 6)
        # Name and slope sit to the right of each line's end.
        out += text(x1 + 16, end - 2, name, 24, color, 800, "start")
        out += text(x1 + 16, end + 24, f"{'−' if slope else ''}{abs(slope)} dB / octave", 18, color, 400, "start", MONO)
    return out


def noise_timer(t) -> str:
    x0, x1, top, base = 120, 840, 170, 380
    fade = x1 - 120
    out = text(480, 110, t["timer"], 28, DEEP, 800, "middle")
    out += line(x0, base, x1 + 40, base, MUTED, 2)
    out += f'<path d="M{x0} {base} L{x0 + 30} {top} L{fade} {top} L{x1} {base} Z" fill="{SOFT}" stroke="{PINK}" stroke-width="5" stroke-linejoin="round"/>'
    out += text((x0 + fade) / 2, top + 70, t["full"], 26, DEEP, 700, "middle")
    out += line(fade, top - 30, fade, base + 20, MUTED, 2) + line(x1, top - 30, x1, base + 20, MUTED, 2)
    out += text((fade + x1) / 2, top - 40, t["fade"], 22, PINK, 800, "middle")
    for x, s in ((x0, "0:00"), (fade, "29:30"), (x1, "30:00")):
        out += text(x, base + 50, s, 22, MUTED, 400, "middle", MONO)
    out += text(x1 + 10, base - 14, t["silent"], 20, MUTED, 700, "start")
    return out


def db_scale(t) -> str:
    items = ((10, t["breathing"]), (30, t["whisper"]), (50, t["office"]), (60, t["conversation"]), (85, t["traffic"]), (110, t["concert"]), (120, t["siren"]))
    x, y0, y1 = 300, 470, 70
    yy = lambda db: y0 - (db / 130) * (y0 - y1)
    out = f'<rect x="{x - 18}" y="{yy(85):.1f}" width="36" height="{yy(0) - yy(85):.1f}" rx="8" fill="{SOFT}"/>'
    out += f'<rect x="{x - 18}" y="{yy(130):.1f}" width="36" height="{yy(85) - yy(130):.1f}" rx="8" fill="{PINK}"/>'
    out += text(x - 40, yy(108), t["risk"], 22, PINK, 800, "end")
    for db, label in items:
        y = yy(db)
        out += line(x + 24, y, x + 70, y, DEEP, 3)
        out += text(x + 84, y + 8, f"{db} dB", 24, DEEP, 800, "start", MONO) + text(x + 200, y + 8, label, 24, INK, 400)
    out += line(x - 60, yy(85), x + 18, yy(85), PINK, 2).replace('stroke-linecap="round"', 'stroke-dasharray="8 6"')
    return out


def db_exposure(t) -> str:
    rows = ((85, t["hours"], 8), (88, t["fourHours"], 4), (91, t["twoHours"], 2), (94, t["oneHour"], 1), (97, t["half"], 0.5), (100, t["quarter"], 0.25))
    out = box(70, 50, 820, 440) + text(480, 100, t["perDay"], 26, DEEP, 800, "middle")
    for k, (db, label, hours) in enumerate(rows):
        y = 140 + k * 56
        w = 520 * hours / 8
        out += text(220, y + 30, f"{db} dB(A)", 22, DEEP, 800, "end", MONO)
        out += f'<rect x="240" y="{y}" width="{max(w, 6):.1f}" height="38" rx="8" fill="{PINK if k else DEEP}"/>'
        out += text(250 + max(w, 6), y + 28, label, 22, INK, 700)
    return out


def voice_flow(t) -> str:
    out = ""
    mic = lambda x: (f'<rect x="{x - 16}" y="190" width="32" height="54" rx="16" fill="{DEEP}"/>'
                     f'<path d="M{x - 28} 228 Q{x - 28} 268 {x} 268 Q{x + 28} 268 {x + 28} 228" fill="none" stroke="{DEEP}" stroke-width="5"/>'
                     + line(x, 268, x, 282, DEEP, 5) + line(x - 16, 284, x + 16, 284, DEEP, 5))
    play = lambda x: f'<path d="M{x - 18} 200 L{x + 26} 230 L{x - 18} 260 Z" fill="{DEEP}"/>'
    down = lambda x: line(x, 194, x, 248, DEEP, 8) + f'<path d="M{x - 24} 236 L{x} 266 L{x + 24} 236 Z" fill="{DEEP}"/>' + line(x - 26, 276, x + 26, 276, DEEP, 6)
    cols = ((150, mic, t["mic"], t["record"]), (480, play, t["tab"], t["play"]), (810, down, t["file"], t["download"]))
    out += box(330, 120, 300, 300, SOFT, PINK)
    for x, icon, label, verb in cols:
        out += f'<circle cx="{x}" cy="230" r="70" fill="{WHITE}" stroke="{PINK}" stroke-width="4"/>'
        out += icon(x)
        out += text(x, 350, label, 26, DEEP, 800, "middle") + text(x, 390, verb, 22, MUTED, 400, "middle")
    out += arrow(225, 230, 405, 230) + arrow(555, 230, 735, 230)
    return out


def voice_formats(t) -> str:
    out = ""
    for k, (name, size, sub, w, color) in enumerate(((t["original"], "≈ 1 MB", t["perMinute"], 90, PINK), (t["wav"], "≈ 5.8 MB", t["perMinute"], 520, DEEP))):
        y = 140 + k * 170
        out += text(110, y, name, 26, DEEP, 800)
        out += f'<rect x="110" y="{y + 20}" width="{w}" height="56" rx="10" fill="{color}"/>'
        out += text(130 + w, y + 58, f"{size} {sub}", 24, INK, 700)
    out += text(110, 480, "WAV: " + t["opensEverywhere"], 22, MUTED, 400)
    return out


def screen_share(t) -> str:
    out = ""
    opts = ((t["screen"], (t["picture"], t["systemSound"])), (t["window"], (t["picture"],)), (t["tab"], (t["picture"], t["tabSound"])))
    for k, (name, gets) in enumerate(opts):
        x = 60 + k * 290
        out += box(x, 70, 260, 400)
        # a little screen icon: full, window, tab
        out += f'<rect x="{x + 40}" y="110" width="180" height="110" rx="10" fill="{SOFT}" stroke="{PINK}" stroke-width="3"/>'
        if k == 1:
            out += f'<rect x="{x + 70}" y="130" width="120" height="70" rx="6" fill="{WHITE}" stroke="{DEEP}" stroke-width="4"/>'
        elif k == 2:
            out += f'<rect x="{x + 52}" y="122" width="60" height="18" rx="4" fill="{DEEP}"/><rect x="{x + 52}" y="140" width="156" height="68" rx="4" fill="{WHITE}" stroke="{DEEP}" stroke-width="4"/>'
        else:
            out += f'<rect x="{x + 40}" y="110" width="180" height="110" rx="10" fill="none" stroke="{DEEP}" stroke-width="5"/>'
        out += text(x + 130, 270, name, 26, DEEP, 800, "middle")
        for j, g in enumerate(gets):
            y = 330 + j * 60
            out += _mark(x + 40, y, True) + wrapped(x + 74, y + 8, g, 20, INK, 700, "start", 15)
    return out


def screen_audio(t) -> str:
    out = ""
    for k, label in enumerate((t["tabSound"], t["mic"])):
        y = 170 + k * 200
        out += box(80, y - 60, 260, 120, SOFT, PINK)
        out += text(210, y + 10, label, 24, DEEP, 800, "middle")
        out += arrow(345, y, 520, 270)
    out += box(530, 210, 180, 120, WHITE, DEEP)
    out += wrapped(620, 278, t["mixed"], 22, DEEP, 800, "middle", 12)
    out += arrow(715, 270, 790, 270)
    out += box(800, 210, 110, 120, PINK, PINK) + text(855, 278, "MP4", 22, WHITE, 800, "middle")
    out += text(855, 370, t["video"], 20, MUTED, 400, "middle")
    return out


def triangle_labels(t) -> str:
    # Right triangle: C at bottom-left, A bottom-right, B top-left.
    C, A, B = (220, 430), (760, 430), (220, 130)
    out = f'<polygon points="{C[0]},{C[1]} {A[0]},{A[1]} {B[0]},{B[1]}" fill="{SOFT}" stroke="{DEEP}" stroke-width="5" stroke-linejoin="round"/>'
    out += f'<path d="M{C[0]} {C[1] - 40} L{C[0] + 40} {C[1] - 40} L{C[0] + 40} {C[1]}" fill="none" stroke="{DEEP}" stroke-width="3"/>'
    out += text(C[0] - 24, C[1] + 10, "C", 32, DEEP, 800, "end") + text(C[0] + 52, C[1] - 52, t["right"], 20, MUTED, 400)
    out += text(A[0] + 20, A[1] + 10, "A", 32, DEEP, 800) + text(B[0] - 24, B[1] + 8, "B", 32, DEEP, 800, "end")
    out += text(C[0] - 24, (C[1] + B[1]) / 2 + 10, "a", 32, PINK, 800, "end", MATH)
    out += text((C[0] + A[0]) / 2, C[1] + 44, "b", 32, PINK, 800, "middle", MATH)
    out += text((A[0] + B[0]) / 2 + 28, (A[1] + B[1]) / 2 - 16, "c", 32, PINK, 800, "start", MATH)
    out += text((A[0] + B[0]) / 2 + 60, (A[1] + B[1]) / 2 + 20, t["hypotenuse"], 22, PINK, 700)
    out += text(560, 110, "a² + b² = c²", 34, DEEP, 800, "middle", MATH)
    out += text(560, 160, t["opposite"], 22, MUTED, 400, "middle")
    return out


def triangle_ambiguous(t) -> str:
    # a = 6, b = 8, A = 30°: A at the left, side c along the base, b up to C, and side a closes in two places.
    s = 36
    Ax, Ay = 90, 420
    ang = math.radians(30)
    Cx, Cy = Ax + 8 * s * math.cos(ang), Ay - 8 * s * math.sin(ang)
    h = 8 * math.sin(ang)
    base = 8 * math.cos(ang)
    d = math.sqrt(6 * 6 - h * h)
    B1 = (Ax + (base - d) * s, Ay)
    B2 = (Ax + (base + d) * s, Ay)
    # Triangle 1 (acute B, as the calculator lists first) closes at the far point; Triangle 2 (obtuse B) at the near one.
    out = line(Ax - 20, Ay, B2[0] + 60, Ay, MUTED, 2)
    out += f'<polygon points="{Ax},{Ay} {Cx:.1f},{Cy:.1f} {B2[0]:.1f},{B2[1]}" fill="{SOFT}" stroke="{DEEP}" stroke-width="5" stroke-linejoin="round"/>'
    out += f'<polygon points="{Ax},{Ay} {Cx:.1f},{Cy:.1f} {B1[0]:.1f},{B1[1]}" fill="none" stroke="{PINK}" stroke-width="4" stroke-linejoin="round" stroke-dasharray="12 8"/>'
    out += f'<circle cx="{Cx:.1f}" cy="{Cy:.1f}" r="{6 * s}" fill="none" stroke="{MUTED}" stroke-width="2" stroke-dasharray="6 8"/>'
    out += text(Ax - 14, Ay + 72, "A = 30°", 24, DEEP, 800, "start", MATH)
    out += text(Cx, Cy - 22, "C", 28, DEEP, 800, "middle")
    out += text((Ax + Cx) / 2 - 20, (Ay + Cy) / 2 - 16, "b = 8", 24, DEEP, 800, "end", MATH)
    out += text(B2[0], Ay + 36, "B₁", 26, DEEP, 800, "middle", MATH) + text(B1[0], Ay + 36, "B₂", 26, PINK, 800, "middle", MATH)
    out += text((Cx + B2[0]) / 2 + 16, (Cy + Ay) / 2, "a = 6", 22, DEEP, 700, "start", MATH)
    out += text(640, 200, f"{t['first']}: B ≈ 41.81°", 24, DEEP, 800)
    out += text(640, 244, f"{t['second']}: B ≈ 138.19°", 24, PINK, 800)
    return out


DIAGRAMS = {
    "play-white-noise": (("play-white-noise-spectrum", noise_spectrum, 1), ("play-white-noise-timer", noise_timer, 2)),
    "measure-decibels": (("measure-decibels-scale", db_scale, 1), ("measure-decibels-exposure", db_exposure, 2)),
    "record-voice-online": (("record-voice-online-flow", voice_flow, 1), ("record-voice-online-formats", voice_formats, 2)),
    "record-screen-online": (("record-screen-online-share", screen_share, 1), ("record-screen-online-audio", screen_audio, 2)),
    "solve-triangle": (("solve-triangle-labels", triangle_labels, 1), ("solve-triangle-ambiguous", triangle_ambiguous, 2)),
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
    base = Path(args[args.index("--src") + 1]) if "--src" in args else Path(__file__).resolve().parents[1] / "scripts/learn-src/batch24"
    only = args[args.index("--only") + 1].split(",") if "--only" in args else LOCS
    main(base, only)
