#!/usr/bin/env python3
"""SVGs for day-count, date shift, ISO week, and VAT lessons."""
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
    "db.title": pack("How to count days between dates", "怎么数两个日期之间的天数", "怎麼數兩個日期之間的天數", "二つの日付の日数", "두 날짜 사이 일수", "Cách đếm số ngày", "Cara hitung hari", "Cómo contar los días"),
    "db.gap": pack("Mon to Fri = 4", "周一到周五 = 4", "週一到週五 = 4", "月〜金 = 4", "월~금 = 4", "T2–T6 = 4", "Sen–Jum = 4", "Lun–vie = 4"),
    "db.leap": pack("2024-02-28 → 03-01 = 2", "2024-02-28 到 03-01 = 2", "2024-02-28 到 03-01 = 2", "2024-02-28 → 03-01 = 2", "2024-02-28 → 03-01 = 2", "2024-02-28 → 03-01 = 2", "2024-02-28 → 03-01 = 2", "2024-02-28 → 03-01 = 2"),
    "db.cap": pack("A gap, not both ends. Weekends stay in.", "这是间隔，两头不算。周末留在里面。", "這是間隔，兩頭不算。週末留在裡面。", "間隔であり両端は含まない。週末は残る。", "간격이지 양쪽 포함이 아님. 주말은 남음.", "Đây là khoảng, không tính hai đầu. Cuối tuần vẫn trong.", "Ini jarak, bukan kedua ujung. Akhir pekan tetap.", "Es un hueco, no ambos extremos. El fin de semana sigue."),
    "sd.title": pack("How to add days to a date", "怎么给日期加减天数", "怎麼給日期加減天數", "日付に日数を足す", "날짜에 일수 더하기", "Cách cộng ngày", "Cara tambah hari", "Cómo sumar días"),
    "sd.leap": pack("2024-02-28 + 1", "2024-02-28 + 1", "2024-02-28 + 1", "2024-02-28 + 1", "2024-02-28 + 1", "2024-02-28 + 1", "2024-02-28 + 1", "2024-02-28 + 1"),
    "sd.out": pack("2024-02-29", "2024-02-29", "2024-02-29", "2024-02-29", "2024-02-29", "2024-02-29", "2024-02-29", "2024-02-29"),
    "sd.fri": pack("Friday + 1 = Saturday", "周五 + 1 = 周六", "週五 + 1 = 週六", "金曜 + 1 = 土曜", "금 + 1 = 토", "T6 + 1 = T7", "Jumat + 1 = Sabtu", "Vie + 1 = sáb"),
    "sd.cap": pack("Whole days only. The weekend is not skipped.", "只要整数天。周末不会被跳过。", "只要整數天。週末不會被跳過。", "整数日だけ。週末は飛ばさない。", "정수 일만. 주말은 건너뛰지 않음.", "Chỉ số nguyên ngày. Không bỏ cuối tuần.", "Hanya hari bulat. Akhir pekan tidak dilewati.", "Solo días enteros. El fin de semana no se salta."),
    "wk.title": pack("How to find the ISO week", "怎么查 ISO 周数", "怎麼查 ISO 週數", "ISO週番号の調べ方", "ISO 주 번호", "Cách tìm tuần ISO", "Cara cari minggu ISO", "Cómo hallar la semana ISO"),
    "wk.mon": pack("Monday = 1", "周一 = 1", "週一 = 1", "月曜 = 1", "월요일 = 1", "Thứ Hai = 1", "Senin = 1", "Lunes = 1"),
    "wk.sun": pack("Sunday = 7", "周日 = 7", "週日 = 7", "日曜 = 7", "일요일 = 7", "Chủ nhật = 7", "Minggu = 7", "Domingo = 7"),
    "wk.ex": pack("2021-01-01 = 2020-W53", "2021-01-01 = 2020-W53", "2021-01-01 = 2020-W53", "2021-01-01 = 2020-W53", "2021-01-01 = 2020-W53", "2021-01-01 = 2020-W53", "2021-01-01 = 2020-W53", "2021-01-01 = 2020-W53"),
    "wk.cap": pack("Week 1 holds the first Thursday.", "第 1 周装着第一个周四。", "第 1 週裝著第一個週四。", "第1週は最初の木曜を含む。", "1주가 첫 목요일을 담음.", "Tuần 1 chứa thứ Năm đầu tiên.", "Minggu 1 memuat Kamis pertama.", "La semana 1 contiene el primer jueves."),
    "vt.title": pack("How to add VAT to a price", "怎么给价格加增值税", "怎麼給價格加增值稅", "価格に消費税を足す", "가격에 부가세 더하기", "Cách cộng VAT", "Cara tambah PPN", "Cómo añadir el IVA"),
    "vt.ex": pack("100 + 20% = 120.00", "100 + 20% = 120.00", "100 + 20% = 120.00", "100 + 20% = 120.00", "100 + 20% = 120.00", "100 + 20% = 120,00", "100 + 20% = 120,00", "100 + 20% = 120,00"),
    "vt.inc": pack("120 includes 20.00", "120 里的税是 20.00", "120 裡的稅是 20.00", "120 に含まれる税は 20.00", "120 안의 세금은 20.00", "120 gồm thuế 20,00", "120 berisi pajak 20,00", "120 incluye 20,00"),
    "vt.no": pack("Not 24.00", "不是 24.00", "不是 24.00", "24.00 ではない", "24.00이 아님", "Không phải 24,00", "Bukan 24,00", "No es 24,00"),
    "vt.cap": pack("Exclusive adds tax. Inclusive splits a gross price.", "不含税是把税加上。含税是把总价拆开。", "不含稅是把稅加上。含稅是把總價拆開。", "税別は税を足す。税込は総額を分ける。", "별도는 세금을 더함. 포함은 총액을 나눔.", "Chưa gồm thì cộng thuế. Đã gồm thì tách tổng.", "Eksklusif menambah pajak. Inklusif memecah harga kotor.", "Exclusivo suma el impuesto. Inclusivo parte el bruto."),
}


def files_for(loc: str) -> dict[str, str]:
    t = lambda k: tx(loc, T[k])
    out: dict[str, str] = {}
    out["days-between.svg"] = svg(1280, 720, heading(t("db.title")) + card(80, 150, 340, 220, t("db.gap"), t("db.cap")) + card(460, 150, 360, 220, "4", t("db.cap"), True) + card(860, 150, 340, 220, t("db.leap"), t("db.cap")) + caption(t("db.cap"), 470, 80), T["db.title"][loc])
    out["days-between-gap.svg"] = svg(960, 540, heading(t("db.gap"), 22) + card(70, 140, 820, 200, t("db.gap"), t("db.cap"), True) + caption(t("db.cap")), T["db.gap"][loc])
    out["days-between-leap.svg"] = svg(960, 540, heading(t("db.leap"), 22) + card(70, 140, 820, 200, "2", t("db.leap"), True) + caption(t("db.cap")), T["db.leap"][loc])
    out["shift-date.svg"] = svg(1280, 720, heading(t("sd.title")) + card(80, 150, 360, 220, t("sd.leap"), t("sd.out"), True) + card(480, 150, 320, 220, t("sd.out"), t("sd.cap")) + card(840, 150, 360, 220, t("sd.fri"), t("sd.cap")) + caption(t("sd.cap"), 470, 80), T["sd.title"][loc])
    out["shift-date-leap.svg"] = svg(960, 540, heading(t("sd.leap"), 22) + card(70, 140, 820, 200, t("sd.out"), t("sd.cap"), True) + caption(t("sd.cap")), T["sd.leap"][loc])
    out["shift-date-weekend.svg"] = svg(960, 540, heading(t("sd.fri"), 22) + card(70, 140, 820, 200, t("sd.fri"), t("sd.cap"), True) + caption(t("sd.cap")), T["sd.fri"][loc])
    out["iso-week.svg"] = svg(1280, 720, heading(t("wk.title")) + card(80, 150, 340, 220, t("wk.mon"), t("wk.cap")) + card(460, 150, 340, 220, t("wk.sun"), t("wk.cap")) + card(840, 150, 360, 220, t("wk.ex"), t("wk.cap"), True) + caption(t("wk.cap"), 470, 80), T["wk.title"][loc])
    out["iso-week-monday.svg"] = svg(960, 540, heading(t("wk.mon"), 22) + card(70, 140, 390, 200, t("wk.mon"), t("wk.cap"), True) + card(490, 140, 400, 200, t("wk.sun"), t("wk.cap")) + caption(t("wk.cap")), T["wk.mon"][loc])
    out["iso-week-year.svg"] = svg(960, 540, heading(t("wk.ex"), 22) + card(70, 140, 820, 200, "2020-W53", t("wk.cap"), True) + caption(t("wk.cap")), T["wk.ex"][loc])
    out["vat-price.svg"] = svg(1280, 720, heading(t("vt.title")) + card(80, 150, 520, 220, t("vt.ex"), t("vt.cap"), True) + card(640, 150, 560, 220, t("vt.inc"), t("vt.no")) + caption(t("vt.cap"), 470, 80), T["vt.title"][loc])
    out["vat-price-add.svg"] = svg(960, 540, heading(t("vt.ex"), 22) + card(70, 140, 820, 200, t("vt.ex"), t("vt.cap"), True) + caption(t("vt.cap")), T["vt.ex"][loc])
    out["vat-price-split.svg"] = svg(960, 540, heading(t("vt.inc"), 22) + card(70, 140, 820, 200, t("vt.no"), t("vt.cap"), True) + caption(t("vt.cap")), T["vt.inc"][loc])
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
