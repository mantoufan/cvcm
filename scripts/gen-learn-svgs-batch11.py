#!/usr/bin/env python3
"""SVGs for discount, URL, age, and aspect-ratio lessons."""
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
    "dc.title": pack("How to calculate a discount", "怎么算折扣", "怎麼算折扣", "割引の計算方法", "할인 계산하는 법", "Cách tính giảm giá", "Cara hitung diskon", "Cómo calcular un descuento"),
    "dc.sale": pack("20% off 100 = 80.00", "100 的 20% = 80.00", "100 的 20% = 80.00", "100 の 20% = 80.00", "100의 20% = 80.00", "Giảm 20% của 100 = 80,00", "20% dari 100 = 80,00", "20% de 100 = 80,00"),
    "dc.not": pack("Not a 20% margin", "不是 20% 利润率", "不是 20% 利潤率", "利益率 20% ではない", "이익률 20%가 아님", "Không phải biên 20%", "Bukan margin 20%", "No es un margen del 20%"),
    "dc.over": pack("120% off = -20.00", "120% 折扣 = -20.00", "120% 折扣 = -20.00", "120% 引き = -20.00", "120% 할인 = -20.00", "Giảm 120% = −20,00", "Diskon 120% = −20,00", "120% = −20,00"),
    "dc.cap": pack("A discount cuts the list price. A margin is profit over price.", "折扣是从标价上减。利润率是利润除以售价。", "折扣是從標價上減。利潤率是利潤除以售價。", "割引は定価から引く。利益率は利益÷売価。", "할인은 정가에서 깎음. 이익률은 이익 나누기 판매가.", "Giảm giá cắt từ giá niêm yết. Biên là lợi nhuận chia giá bán.", "Diskon memotong harga daftar. Margin adalah laba dibagi harga.", "El descuento recorta el precio de lista. El margen es beneficio sobre precio."),
    "ur.title": pack("How to encode a URL", "怎么做网址编码", "怎麼做網址編碼", "URLエンコードの方法", "URL 인코딩하는 법", "Cách mã hóa URL", "Cara enkode URL", "Cómo codificar una URL"),
    "ur.sp": pack("space = %20", "空格 = %20", "空格 = %20", "空白 = %20", "공백 = %20", "dấu cách = %20", "spasi = %20", "espacio = %20"),
    "ur.sl": pack("slash = %2F", "斜杠 = %2F", "斜線 = %2F", "スラッシュ = %2F", "슬래시 = %2F", "gạch chéo = %2F", "garis miring = %2F", "barra = %2F"),
    "ur.pl": pack("+ decodes as space", "+ 解码成空格", "+ 解碼成空格", "+ は空白に復号", "+는 공백으로", "+ giải thành dấu cách", "+ menjadi spasi", "+ se decodifica como espacio"),
    "ur.cap": pack("Encode a value when the address must stay openable.", "地址还要能打开时，只编码那个值。", "地址還要能打開時，只編碼那個值。", "アドレスを開けるままにするなら値だけ符号化。", "주소가 열려야 하면 값만 인코딩.", "Địa chỉ còn phải mở được thì chỉ mã hóa giá trị.", "Jika alamat harus tetap terbuka, enkode hanya nilainya.", "Si la dirección debe poder abrirse, codifique solo el valor."),
    "ag.title": pack("How to calculate age", "怎么算年龄", "怎麼算年齡", "年齢の計算方法", "나이 계산하는 법", "Cách tính tuổi", "Cara hitung umur", "Cómo calcular la edad"),
    "ag.a": pack("14 Mar 2026 = 25y", "2026-03-14 = 25 岁", "2026-03-14 = 25 歲", "2026-03-14 = 25歳", "2026-03-14 = 25세", "14/3/2026 = 25 tuổi", "14 Mar 2026 = 25 th", "14 mar 2026 = 25 años"),
    "ag.b": pack("15 Mar 2026 = 26y", "2026-03-15 = 26 岁", "2026-03-15 = 26 歲", "2026-03-15 = 26歳", "2026-03-15 = 26세", "15/3/2026 = 26 tuổi", "15 Mar 2026 = 26 th", "15 mar 2026 = 26 años"),
    "ag.cap": pack("Born 15 Mar 2000. The year waits for the birthday.", "2000 年 3 月 15 日出生。这一岁要等到生日。", "2000 年 3 月 15 日出生。這一歲要等到生日。", "2000年3月15日生まれ。その一歳は誕生日まで待つ。", "2000년 3월 15일생. 그 한 살은 생일을 기다림.", "Sinh 15/3/2000. Tuổi đó đợi đến sinh nhật.", "Lahir 15 Mar 2000. Tahun itu menunggu ulang tahun.", "Nacido el 15 mar 2000. El año espera al cumpleaños."),
    "as.title": pack("How to find an aspect ratio", "怎么算宽高比", "怎麼算寬高比", "アスペクト比の求め方", "화면 비율 구하는 법", "Cách tìm tỉ lệ khung", "Cara cari rasio aspek", "Cómo hallar la relación"),
    "as.l": pack("1920×1080 = 16:9", "1920×1080 = 16:9", "1920×1080 = 16:9", "1920×1080 = 16:9", "1920×1080 = 16:9", "1920×1080 = 16:9", "1920×1080 = 16:9", "1920×1080 = 16:9"),
    "as.p": pack("1080×1920 = 9:16", "1080×1920 = 9:16", "1080×1920 = 9:16", "1080×1920 = 9:16", "1080×1920 = 9:16", "1080×1920 = 9:16", "1080×1920 = 9:16", "1080×1920 = 9:16"),
    "as.cap": pack("Round to whole pixels. The photo is not cropped.", "先收成整数像素。照片不会被裁。", "先收成整數像素。照片不會被裁。", "先に整数ピクセルへ。写真は切らない。", "먼저 정수 픽셀로. 사진은 잘리지 않음.", "Làm tròn pixel nguyên. Ảnh không bị cắt.", "Bulatkan ke piksel utuh. Foto tidak dipotong.", "Redondee a píxeles enteros. La foto no se recorta."),
}


def files_for(loc: str) -> dict[str, str]:
    t = lambda k: tx(loc, T[k])
    out = {}
    out["percent-off.svg"] = svg(1280, 720, heading(t("dc.title")) + card(80, 150, 520, 220, t("dc.sale"), t("dc.not"), True) + card(640, 150, 560, 220, t("dc.over"), t("dc.cap")) + caption(t("dc.cap"), 470, 80), T["dc.title"][loc])
    out["percent-off-sale.svg"] = svg(960, 540, heading(t("dc.sale"), 22) + card(70, 140, 820, 200, t("dc.not"), t("dc.cap"), True) + caption(t("dc.cap")), T["dc.sale"][loc])
    out["percent-off-over.svg"] = svg(960, 540, heading(t("dc.over"), 22) + card(70, 140, 820, 200, t("dc.over"), t("dc.cap"), True) + caption(t("dc.cap")), T["dc.over"][loc])
    out["encode-url.svg"] = svg(1280, 720, heading(t("ur.title")) + card(80, 150, 340, 220, t("ur.sp"), t("ur.cap")) + card(460, 150, 340, 220, t("ur.sl"), t("ur.cap")) + card(840, 150, 360, 220, t("ur.pl"), t("ur.cap"), True) + caption(t("ur.cap"), 470, 80), T["ur.title"][loc])
    out["encode-url-space.svg"] = svg(960, 540, heading(t("ur.sp"), 22) + card(70, 140, 820, 200, t("ur.pl"), t("ur.cap"), True) + caption(t("ur.cap")), T["ur.sp"][loc])
    out["encode-url-slash.svg"] = svg(960, 540, heading(t("ur.sl"), 22) + card(70, 140, 820, 200, t("ur.sl"), t("ur.cap"), True) + caption(t("ur.cap")), T["ur.sl"][loc])
    out["calculate-age.svg"] = svg(1280, 720, heading(t("ag.title")) + card(80, 150, 520, 220, t("ag.a"), t("ag.cap")) + card(640, 150, 560, 220, t("ag.b"), t("ag.cap"), True) + caption(t("ag.cap"), 470, 80), T["ag.title"][loc])
    out["calculate-age-before.svg"] = svg(960, 540, heading(t("ag.a"), 22) + card(70, 140, 820, 200, "25y 11m 27d", t("ag.cap"), True) + caption(t("ag.cap")), T["ag.a"][loc])
    out["calculate-age-day.svg"] = svg(960, 540, heading(t("ag.b"), 22) + card(70, 140, 820, 200, "26y 0m 0d", t("ag.cap"), True) + caption(t("ag.cap")), T["ag.b"][loc])
    out["aspect-ratio.svg"] = svg(1280, 720, heading(t("as.title")) + card(80, 150, 520, 220, t("as.l"), t("as.cap"), True) + card(640, 150, 560, 220, t("as.p"), t("as.cap")) + caption(t("as.cap"), 470, 80), T["as.title"][loc])
    out["aspect-ratio-order.svg"] = svg(960, 540, heading(t("as.l"), 22) + card(70, 140, 390, 200, "16:9", t("as.l"), True) + card(490, 140, 400, 200, "9:16", t("as.p")) + caption(t("as.cap")), T["as.l"][loc])
    out["aspect-ratio-round.svg"] = svg(960, 540, heading(t("as.cap"), 20) + card(70, 140, 820, 200, t("as.l"), t("as.cap"), True) + caption(t("as.cap")), T["as.cap"][loc])
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
