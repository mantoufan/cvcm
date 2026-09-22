#!/usr/bin/env python3
"""SVGs for margin, base, duration, and percentage lessons."""
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


def heading(text, size=26) -> str:
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
    "mg.title": pack("How to calculate a profit margin", "怎么算利润率", "怎麼算利潤率", "利益率の計算方法", "이익률 계산하는 법", "Cách tính biên lợi nhuận", "Cara hitung margin laba", "Cómo calcular un margen"),
    "mg.cost": pack("Cost 50", "成本 50", "成本 50", "原価 50", "원가 50", "Vốn 50", "Biaya 50", "Coste 50"),
    "mg.price": pack("Price 80", "售价 80", "售價 80", "売価 80", "판매가 80", "Giá 80", "Harga 80", "Precio 80"),
    "mg.m": pack("Margin 37.50%", "利润率 37.50%", "利潤率 37.50%", "利益率 37.50%", "이익률 37.50%", "Biên 37,50%", "Margin 37,50%", "Margen 37,50%"),
    "mg.u": pack("Markup 60.00%", "加价率 60.00%", "加價率 60.00%", "マークアップ 60.00%", "마크업 60.00%", "Markup 60,00%", "Markup 60,00%", "Markup 60,00%"),
    "mg.cap": pack("Margin divides by the price. Markup divides by the cost.", "利润率除以售价。加价率除以成本。", "利潤率除以售價。加價率除以成本。", "利益率は売価で割る。マークアップは原価で割る。", "이익률은 판매가로. 마크업은 원가로.", "Biên chia giá bán. Markup chia giá vốn.", "Margin membagi harga. Markup membagi biaya.", "El margen divide por el precio. El markup divide por el coste."),
    "rd.title": pack("How to convert between bases", "怎么在进制之间换算", "怎麼在進制之間換算", "進数を変換する方法", "진법 사이 변환하는 법", "Cách đổi số giữa các cơ số", "Cara ubah antar basis", "Cómo convertir entre bases"),
    "rd.dec": pack("255 base 10", "十进制 255", "十進制 255", "10進 255", "10진 255", "Cơ số 10: 255", "Basis 10: 255", "Base 10: 255"),
    "rd.hex": pack("FF base 16", "十六进制 FF", "十六進制 FF", "16進 FF", "16진 FF", "Cơ số 16: FF", "Basis 16: FF", "Base 16: FF"),
    "rd.bin": pack("No 0x, no dot", "不要 0x，不要小数点", "不要 0x，不要小數點", "0x も小数点も無し", "0x도 점도 없음", "Không 0x, không chấm", "Tanpa 0x, tanpa titik", "Sin 0x, sin punto"),
    "rd.cap": pack("Bases 2–36. Output letters are uppercase.", "进制 2–36。结果字母是大写。", "進制 2–36。結果字母是大寫。", "基数 2–36。出力は大文字。", "진법 2–36. 결과 글자는 대문자.", "Cơ số 2–36. Chữ kết quả viết hoa.", "Basis 2–36. Huruf hasil kapital.", "Bases 2–36. Las letras salen en mayúsculas."),
    "du.title": pack("How to add hours and minutes", "怎么把小时和分钟相加", "怎麼把小時和分鐘相加", "時間と分を足す方法", "시간과 분 더하는 법", "Cách cộng giờ và phút", "Cara jumlahkan jam dan menit", "Cómo sumar horas y minutos"),
    "du.a": pack("1:30:00", "1:30:00", "1:30:00", "1:30:00", "1:30:00", "1:30:00", "1:30:00", "1:30:00"),
    "du.b": pack("0:45:00", "0:45:00", "0:45:00", "0:45:00", "0:45:00", "0:45:00", "0:45:00", "0:45:00"),
    "du.c": pack("2:15:00", "2:15:00", "2:15:00", "2:15:00", "2:15:00", "2:15:00", "2:15:00", "2:15:00"),
    "du.bad": pack("0:90:00 is not valid", "0:90:00 不合法", "0:90:00 不合法", "0:90:00 は無効", "0:90:00은 안 됨", "0:90:00 không hợp lệ", "0:90:00 tidak sah", "0:90:00 no es válido"),
    "du.cap": pack("A length, not a clock. A longer second time gives a minus.", "这是时长，不是钟点。第二段更长就出现减号。", "這是時長，不是鐘點。第二段更長就出現減號。", "長さであり時刻ではない。二つ目が長いとマイナス。", "길이지 시계가 아님. 둘째가 더 길면 빼기.", "Đây là khoảng, không phải đồng hồ. Khoảng sau dài hơn thì có dấu trừ.", "Ini durasi, bukan jam. Durasi kedua lebih panjang memberi minus.", "Es una duración, no un reloj. Si la segunda es más larga, aparece un menos."),
    "pc.title": pack("How to calculate a percentage", "怎么算百分比", "怎麼算百分比", "パーセントの計算方法", "백분율 계산하는 법", "Cách tính phần trăm", "Cara hitung persentase", "Cómo calcular un porcentaje"),
    "pc.a": pack("25% of 200 = 50", "200 的 25% = 50", "200 的 25% = 50", "200 の 25% = 50", "200의 25% = 50", "25% của 200 = 50", "25% dari 200 = 50", "25% de 200 = 50"),
    "pc.b": pack("25 is 12.5% of 200", "25 是 200 的 12.5%", "25 是 200 的 12.5%", "25 は 200 の 12.5%", "25는 200의 12.5%", "25 là 12,5% của 200", "25 adalah 12,5% dari 200", "25 es el 12,5% de 200"),
    "pc.c": pack("200 + 25% = 250", "200 + 25% = 250", "200 + 25% = 250", "200 + 25% = 250", "200 + 25% = 250", "200 + 25% = 250", "200 + 25% = 250", "200 + 25% = 250"),
    "pc.cap": pack("Four different answers. Copy the line that matches the question.", "四个不同的答案。复制对上问题的那一行。", "四個不同的答案。複製對上問題的那一行。", "四つの別の答え。問いに合う行をコピー。", "서로 다른 네 답. 질문에 맞는 줄을 복사.", "Bốn đáp án khác nhau. Copy dòng khớp câu hỏi.", "Empat jawaban berbeda. Salin baris yang cocok.", "Cuatro respuestas distintas. Copie la línea que coincide."),
}


def files_for(loc: str) -> dict[str, str]:
    t = lambda k: tx(loc, T[k])
    out: dict[str, str] = {}
    out["profit-margin.svg"] = svg(1280, 720, heading(t("mg.title")) + card(80, 150, 340, 220, t("mg.cost"), t("mg.m")) + card(460, 150, 340, 220, t("mg.price"), t("mg.u"), True) + card(840, 150, 360, 220, "30.00", t("mg.cap")) + caption(t("mg.cap"), 470, 80), T["mg.title"][loc])
    out["profit-margin-split.svg"] = svg(960, 540, heading(t("mg.m"), 22) + card(70, 140, 390, 200, t("mg.m"), t("mg.cap"), True) + card(490, 140, 400, 200, t("mg.u"), t("mg.cap")) + caption(t("mg.cap")), T["mg.m"][loc])
    out["profit-margin-zero.svg"] = svg(960, 540, heading(t("mg.cap"), 20) + card(70, 140, 820, 200, t("mg.cost"), t("mg.cap"), True) + caption(t("mg.cap")), T["mg.cap"][loc])
    out["convert-base.svg"] = svg(1280, 720, heading(t("rd.title")) + card(80, 150, 340, 220, t("rd.dec"), t("rd.cap")) + card(460, 150, 340, 220, t("rd.hex"), t("rd.cap"), True) + card(840, 150, 360, 220, t("rd.bin"), t("rd.cap")) + caption(t("rd.cap"), 470, 80), T["rd.title"][loc])
    out["convert-base-ff.svg"] = svg(960, 540, heading(t("rd.hex"), 22) + card(70, 140, 820, 200, t("rd.dec"), t("rd.hex"), True) + caption(t("rd.cap")), T["rd.hex"][loc])
    out["convert-base-prefix.svg"] = svg(960, 540, heading(t("rd.bin"), 22) + card(70, 140, 820, 200, t("rd.bin"), t("rd.cap"), True) + caption(t("rd.cap")), T["rd.bin"][loc])
    out["add-duration.svg"] = svg(1280, 720, heading(t("du.title")) + card(80, 150, 340, 220, t("du.a"), t("du.bad")) + card(460, 150, 340, 220, t("du.b"), t("du.cap")) + card(840, 150, 360, 220, t("du.c"), t("du.cap"), True) + caption(t("du.cap"), 470, 80), T["du.title"][loc])
    out["add-duration-sum.svg"] = svg(960, 540, heading(t("du.c"), 22) + card(70, 140, 820, 200, t("du.a"), t("du.c"), True) + caption(t("du.bad")), T["du.c"][loc])
    out["add-duration-minus.svg"] = svg(960, 540, heading(t("du.cap"), 18) + card(70, 140, 820, 200, "-0:15:00", t("du.cap"), True) + caption(t("du.cap")), T["du.cap"][loc])
    out["calculate-percent.svg"] = svg(1280, 720, heading(t("pc.title")) + card(80, 150, 520, 200, t("pc.a"), t("pc.b")) + card(640, 150, 560, 200, t("pc.c"), t("pc.cap"), True) + caption(t("pc.cap"), 460, 80), T["pc.title"][loc])
    out["calculate-percent-lines.svg"] = svg(960, 540, heading(t("pc.a"), 22) + card(70, 140, 820, 200, t("pc.b"), t("pc.cap"), True) + caption(t("pc.cap")), T["pc.a"][loc])
    out["calculate-percent-zero.svg"] = svg(960, 540, heading(t("pc.cap"), 18) + card(70, 140, 820, 200, t("pc.c"), t("pc.cap"), True) + caption(t("pc.cap")), T["pc.cap"][loc])
    return out


def main() -> None:
    ROOT.mkdir(parents=True, exist_ok=True)
    for loc in LOCS:
        dest = ROOT if not FOLDERS[loc] else ROOT / FOLDERS[loc]
        dest.mkdir(parents=True, exist_ok=True)
        for name, body in files_for(loc).items():
            (dest / name).write_text(body, encoding="utf-8")
    print("svgs", 12 * len(LOCS))


if __name__ == "__main__":
    main()
