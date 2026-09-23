#!/usr/bin/env python3
"""SVGs for BMI, tip, loan, and cron lessons."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "public" / "covers" / "tutorials"
DEEP, SOFT, INK, MUTED, PINK, WHITE, CARD, LINE = (
    "#a13f6c", "#ffe4ee", "#59364b", "#876579", "#c83f79", "#fff7fb", "#ffffff", "#f2d9e5",
)
FONT = "system-ui,'PingFang SC','Noto Sans SC','Hiragino Sans',sans-serif"
LOCS = ["en", "zh-CN", "zh-TW", "ja", "ko", "vi", "id", "es"]
FOLDERS = {"en": "", "zh-CN": "zh-cn", "zh-TW": "zh-tw", "ja": "ja", "ko": "ko", "vi": "vi", "id": "id", "es": "es"}


def xml(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


def pack(*vals: str) -> dict[str, str]:
    if len(vals) != 8:
        raise ValueError(len(vals), vals[:2])
    return dict(zip(LOCS, vals))


def tx(loc: str, row: dict[str, str]) -> str:
    return xml(row.get(loc) or row["en"])


def svg(w, h, inner, label) -> str:
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" role="img" aria-label="{xml(label)}">
  <rect width="{w}" height="{h}" rx="28" fill="{WHITE}"/>
  {inner}
</svg>
'''


def heading(text, size=24) -> str:
    return f'<text x="48" y="54" fill="{DEEP}" font-size="{size}" font-weight="800" font-family="{FONT}">{text}</text>'


def caption(text, y=500, x=48) -> str:
    return f'<text x="{x}" y="{y}" fill="{MUTED}" font-size="18" font-family="{FONT}">{text}</text>'


def card(x, y, w, h, title, line, accent=False) -> str:
    fill, stroke = (SOFT, PINK) if accent else (CARD, LINE)
    return f'''
  <rect x="{x}" y="{y}" width="{w}" height="{h}" rx="22" fill="{fill}" stroke="{stroke}" stroke-width="3"/>
  <text x="{x + 24}" y="{y + 52}" fill="{DEEP}" font-size="22" font-weight="700" font-family="{FONT}">{title}</text>
  <text x="{x + 24}" y="{y + 96}" fill="{INK}" font-size="16" font-family="{FONT}">{line}</text>
'''


T = {
    "bm.title": pack("How to calculate BMI", "怎么算 BMI", "怎麼算 BMI", "BMIの計算方法", "BMI 계산하는 법", "Cách tính BMI", "Cara hitung BMI", "Cómo calcular el IMC"),
    "bm.u": pack("170 cm, not 1.70", "填 170 厘米，不是 1.70", "填 170 公分，不是 1.70", "170 cm。1.70 ではない", "170 cm, 1.70 아님", "170 cm, không phải 1,70", "170 cm, bukan 1,70", "170 cm, no 1,70"),
    "bm.n": pack("70 kg, 170 cm = 24.2", "70 公斤、170 厘米 = 24.2", "70 公斤、170 公分 = 24.2", "70 kg、170 cm = 24.2", "70 kg, 170 cm = 24.2", "70 kg, 170 cm = 24,2", "70 kg, 170 cm = 24,2", "70 kg, 170 cm = 24,2"),
    "bm.b": pack("25 Overweight, 30 Obesity", "25 起 Overweight，30 起 Obesity", "25 起 Overweight，30 起 Obesity", "25 から Overweight、30 から Obesity", "25부터 Overweight, 30부터 Obesity", "25 là Overweight, 30 là Obesity", "25 Overweight, 30 Obesity", "25 Overweight, 30 Obesity"),
    "bm.cap": pack("Centimetres. 1.70 in that box is 242214.5.", "厘米。那一格填 1.70 会得到 242214.5。", "公分。那一格填 1.70 會得到 242214.5。", "センチメートル。その欄の 1.70 は 242214.5。", "센티미터. 그 칸의 1.70은 242214.5.", "Xentimét. 1,70 ở ô đó là 242214,5.", "Sentimeter. 1,70 di kotak itu adalah 242214,5.", "Centímetros. 1,70 en esa casilla es 242214,5."),
    "tp.title": pack("How to split a tip", "怎么分小费", "怎麼分小費", "チップの割り方", "팁 나누는 법", "Cách chia tiền tip", "Cara bagi tip", "Cómo repartir una propina"),
    "tp.e": pack("Each is 30.00, not 5.00", "每人 30.00，不是 5.00", "每人 30.00，不是 5.00", "一人 30.00。5.00 ではない", "각자 30.00, 5.00 아님", "Mỗi người 30,00, không phải 5,00", "Masing-masing 30,00, bukan 5,00", "Cada uno 30,00, no 5,00"),
    "tp.p": pack("2.9 people counts as 2", "2.9 个人按 2 个人算", "2.9 個人按 2 個人算", "2.9 人は 2 人", "2.9명은 2명", "2,9 người tính là 2", "2,9 orang dihitung 2", "2,9 personas cuentan como 2"),
    "tp.cap": pack("100 at 20% for 4 people: total 120.00, each 30.00.", "100 的 20%，4 人：合计 120.00，每人 30.00。", "100 的 20%，4 人：合計 120.00，每人 30.00。", "100 の 20%、4 人：合計 120.00、一人 30.00。", "100의 20%, 4명: 합계 120.00, 각자 30.00.", "100 với 20%, 4 người: tổng 120,00, mỗi người 30,00.", "100 dengan 20%, 4 orang: total 120,00, masing-masing 30,00.", "100 con 20%, 4 personas: total 120,00, cada uno 30,00."),
    "ln.title": pack("How to calculate a loan payment", "怎么算贷款月供", "怎麼算貸款月付", "ローン返済額の計算方法", "대출 상환액 계산하는 법", "Cách tính khoản trả góp", "Cara hitung cicilan", "Cómo calcular la cuota"),
    "ln.s": pack("Interest 661.85, not 1200", "利息 661.85，不是 1200", "利息 661.85，不是 1200", "利息 661.85。1200 ではない", "이자 661.85, 1200 아님", "Lãi 661,85, không phải 1200", "Bunga 661,85, bukan 1200", "Interés 661,85, no 1200"),
    "ln.z": pack("0% of 12000 = 1000.00", "12000 的 0% = 1000.00", "12000 的 0% = 1000.00", "12000 の 0% = 1000.00", "12000의 0% = 1000.00", "0% của 12000 = 1000,00", "0% dari 12000 = 1000,00", "0% de 12000 = 1000,00"),
    "ln.cap": pack("10000 at 12% for 1 year. The balance falls each month.", "10000、年利率 12%、1 年。余额逐月下降。", "10000、年利率 12%、1 年。餘額逐月下降。", "10000、年 12%、1 年。残高は毎月減る。", "10000, 연 12%, 1년. 잔액은 매달 줄어듭니다.", "10000, 12% một năm, 1 năm. Dư nợ giảm mỗi tháng.", "10000, 12% setahun, 1 tahun. Saldo turun tiap bulan.", "10000 al 12% anual, 1 año. El saldo baja cada mes."),
    "cr.title": pack("How to read a cron expression", "怎么读 cron 表达式", "怎麼讀 cron 表達式", "cron式の読み方", "cron 식 읽는 법", "Cách đọc biểu thức cron", "Cara baca ekspresi cron", "Cómo leer una expresión cron"),
    "cr.f": pack("0 9 * * 1 = Monday 09:00", "0 9 * * 1 = 周一 09:00", "0 9 * * 1 = 週一 09:00", "0 9 * * 1 = 月曜 09:00", "0 9 * * 1 = 월요일 09:00", "0 9 * * 1 = thứ Hai 09:00", "0 9 * * 1 = Senin 09:00", "0 9 * * 1 = lunes 09:00"),
    "cr.s": pack("0 and 7 are Sunday", "0 和 7 都是周日", "0 和 7 都是週日", "0 も 7 も日曜", "0과 7은 일요일", "0 và 7 đều là Chủ nhật", "0 dan 7 sama-sama Minggu", "0 y 7 son domingo"),
    "cr.cap": pack("Five fields. MON fails. Six fields fail.", "五个字段。MON 会失败。六个字段会失败。", "五個欄位。MON 會失敗。六個欄位會失敗。", "五つの欄。MON は失敗。六つも失敗。", "필드 다섯. MON은 실패. 여섯 필드도 실패.", "Năm trường. MON thì thất bại. Sáu trường thì thất bại.", "Lima ruas. MON gagal. Enam ruas gagal.", "Cinco campos. MON falla. Seis campos fallan."),
}


def files_for(loc: str) -> dict[str, str]:
    t = lambda k: tx(loc, T[k])
    out = {}
    out["calculate-bmi.svg"] = svg(1280, 720, heading(t("bm.title")) + card(80, 150, 520, 220, t("bm.n"), t("bm.b"), True) + card(640, 150, 560, 220, t("bm.u"), t("bm.cap")) + caption(t("bm.cap"), 470, 80), T["bm.title"][loc])
    out["calculate-bmi-units.svg"] = svg(960, 540, heading(t("bm.u"), 22) + card(70, 140, 820, 200, t("bm.n"), t("bm.cap"), True) + caption(t("bm.cap")), T["bm.u"][loc])
    out["calculate-bmi-band.svg"] = svg(960, 540, heading(t("bm.b"), 22) + card(70, 140, 820, 200, "24.2 Normal", t("bm.b"), True) + caption(t("bm.cap")), T["bm.b"][loc])
    out["split-tip.svg"] = svg(1280, 720, heading(t("tp.title")) + card(80, 150, 520, 220, t("tp.e"), t("tp.cap"), True) + card(640, 150, 560, 220, t("tp.p"), t("tp.cap")) + caption(t("tp.cap"), 470, 80), T["tp.title"][loc])
    out["split-tip-total.svg"] = svg(960, 540, heading(t("tp.e"), 22) + card(70, 140, 820, 200, t("tp.e"), t("tp.cap"), True) + caption(t("tp.cap")), T["tp.e"][loc])
    out["split-tip-people.svg"] = svg(960, 540, heading(t("tp.p"), 22) + card(70, 140, 820, 200, "60.00", t("tp.p"), True) + caption(t("tp.cap")), T["tp.p"][loc])
    out["loan-payment.svg"] = svg(1280, 720, heading(t("ln.title")) + card(80, 150, 520, 220, t("ln.s"), t("ln.cap"), True) + card(640, 150, 560, 220, t("ln.z"), t("ln.cap")) + caption(t("ln.cap"), 470, 80), T["ln.title"][loc])
    out["loan-payment-simple.svg"] = svg(960, 540, heading(t("ln.s"), 22) + card(70, 140, 820, 200, "888.49", t("ln.cap"), True) + caption(t("ln.cap")), T["ln.s"][loc])
    out["loan-payment-zero.svg"] = svg(960, 540, heading(t("ln.z"), 22) + card(70, 140, 820, 200, "1000.00", t("ln.z"), True) + caption(t("ln.cap")), T["ln.z"][loc])
    out["read-cron.svg"] = svg(1280, 720, heading(t("cr.title")) + card(80, 150, 520, 220, t("cr.f"), t("cr.cap"), True) + card(640, 150, 560, 220, t("cr.s"), t("cr.cap")) + caption(t("cr.cap"), 470, 80), T["cr.title"][loc])
    out["read-cron-fields.svg"] = svg(960, 540, heading(t("cr.f"), 22) + card(70, 140, 820, 200, "minute hour day month weekday", t("cr.cap"), True) + caption(t("cr.cap")), T["cr.f"][loc])
    out["read-cron-sunday.svg"] = svg(960, 540, heading(t("cr.s"), 22) + card(70, 140, 820, 200, "0 = 7 = Sunday", t("cr.cap"), True) + caption(t("cr.cap")), T["cr.s"][loc])
    return out


def main() -> None:
    for loc in LOCS:
        dest = ROOT if not FOLDERS[loc] else ROOT / FOLDERS[loc]
        dest.mkdir(parents=True, exist_ok=True)
        for name, body in files_for(loc).items():
            (dest / name).write_text(body, encoding="utf-8")
    print("svgs", 12 * len(LOCS))


if __name__ == "__main__":
    main()
