#!/usr/bin/env python3
"""SVGs for business-day, fraction, hourly-pay, and time-zone lessons."""
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
    "wd.title": pack("How to count business days", "怎么数工作日", "怎麼數工作日", "営業日の数え方", "근무일 세는 법", "Cách đếm ngày làm việc", "Cara hitung hari kerja", "Cómo contar días laborables"),
    "wd.both": pack("Both ends", "两头都算", "兩頭都算", "両端を含む", "양쪽 포함", "Cả hai đầu", "Kedua ujung", "Ambos extremos"),
    "wd.five": pack("Mon–Fri = 5", "周一到周五 = 5", "週一到週五 = 5", "月〜金 = 5", "월~금 = 5", "T2–T6 = 5", "Sen–Jum = 5", "Lun–vie = 5"),
    "wd.hol": pack("Holiday stays", "假日仍算", "假日仍算", "祝日は残る", "공휴일 포함", "Ngày lễ vẫn tính", "Libur tetap", "El festivo sigue"),
    "wd.cap": pack("Both ends count. Weekends drop out. A Wednesday holiday stays.", "两头都算。周末去掉。周三的假日仍算。", "兩頭都算。週末去掉。週三的假日仍算。", "両端を含む。週末は外す。水曜の祝日は残る。", "양쪽 포함. 주말은 빠짐. 수요일 공휴일은 남음.", "Tính cả hai đầu. Cuối tuần loại. Ngày lễ thứ Tư vẫn tính.", "Kedua ujung dihitung. Akhir pekan keluar. Libur Rabu tetap.", "Ambos extremos cuentan. El fin de semana sale. El festivo del miércoles sigue."),
    "fr.title": pack("How to simplify a fraction", "怎么约分", "怎麼約分", "分数を約分する方法", "분수 약분하는 법", "Cách rút gọn phân số", "Cara sederhanakan pecahan", "Cómo simplificar una fracción"),
    "fr.a": pack("4/6", "4/6", "4/6", "4/6", "4/6", "4/6", "4/6", "4/6"),
    "fr.b": pack("2/3", "2/3", "2/3", "2/3", "2/3", "2/3", "2/3", "2/3"),
    "fr.c": pack("0.75 → 3/4", "0.75 → 3/4", "0.75 → 3/4", "0.75 → 3/4", "0.75 → 3/4", "0.75 → 3/4", "0.75 → 3/4", "0.75 → 3/4"),
    "fr.cap": pack("4/6 becomes 2/3. A long decimal stops at denominator 10,000.", "4/6 变成 2/3。很长的小数，分母停在 10,000。", "4/6 變成 2/3。很長的小數，分母停在 10,000。", "4/6 は 2/3。長い小数は分母 10,000 で止まる。", "4/6은 2/3. 긴 소수는 분모 10,000에서 멈춤.", "4/6 thành 2/3. Số dài dừng ở mẫu 10.000.", "4/6 menjadi 2/3. Desimal panjang berhenti di 10.000.", "4/6 pasa a 2/3. Un decimal largo se detiene en 10.000."),
    "fr.sign": pack("Sign stays on the numerator.", "符号留在分子上。", "符號留在分子上。", "符号は分子。", "부호는 분자에.", "Dấu ở tử số.", "Tanda di pembilang.", "El signo queda en el numerador."),
    "hp.title": pack("How to convert hourly pay", "怎么把时薪换成年薪", "怎麼把時薪換成年薪", "時給を年収に換算", "시급을 연봉으로", "Cách đổi lương giờ", "Cara ubah upah per jam", "Cómo convertir el pago por hora"),
    "hp.rate": pack("One rate", "一个费率", "一個費率", "単価は一つ", "단가 하나", "Một mức", "Satu tarif", "Una tarifa"),
    "hp.math": pack("20 × 40 × 52", "20 × 40 × 52", "20 × 40 × 52", "20 × 40 × 52", "20 × 40 × 52", "20 × 40 × 52", "20 × 40 × 52", "20 × 40 × 52"),
    "hp.gross": pack("41,600.00 gross", "税前 41,600.00", "稅前 41,600.00", "税引前 41,600.00", "세전 41,600.00", "41.600,00 trước thuế", "41.600,00 kotor", "41.600,00 en bruto"),
    "hp.cap": pack("Gross only. Unpaid weeks lower the 52. Tax stays outside.", "只有税前。无薪周要改掉 52。税留在外面。", "只有稅前。無薪週要改掉 52。稅留在外面。", "税引前だけ。無給の週は 52 を下げる。税は外。", "세전만. 무급 주는 52를 낮춤. 세금은 밖.", "Chỉ trước thuế. Tuần không lương thì hạ 52. Thuế ở ngoài.", "Hanya kotor. Minggu tidak dibayar menurunkan 52. Pajak di luar.", "Solo el bruto. Semanas sin pagar bajan el 52. El impuesto queda fuera."),
    "tz.title": pack("How to convert a time zone", "怎么换算时区", "怎麼換算時區", "タイムゾーンの変換", "시간대 변환하는 법", "Cách đổi múi giờ", "Cara ubah zona waktu", "Cómo convertir una zona horaria"),
    "tz.src": pack("Their clock", "他们的钟", "他們的鐘", "相手の時計", "그들의 시계", "Đồng hồ của họ", "Jam mereka", "Su reloj"),
    "tz.dst": pack("Jan −05:00", "一月 −05:00", "一月 −05:00", "1月 −05:00", "1월 −05:00", "Tháng 1 −05:00", "Jan −05:00", "Ene −05:00"),
    "tz.jul": pack("Jul −04:00", "七月 −04:00", "七月 −04:00", "7月 −04:00", "7월 −04:00", "Tháng 7 −04:00", "Jul −04:00", "Jul −04:00"),
    "tz.cap": pack("Source owns the clock. Copy the UTC instant. Do not add the offset twice.", "来源是这个钟的时区。复制 UTC 瞬间。不要把偏移加两次。", "來源是這個鐘的時區。複製 UTC 瞬間。不要把偏移加兩次。", "変換元はその時計のゾーン。UTC をコピー。オフセットを二度足さない。", "출발은 그 시계의 시간대. UTC 순간을 복사. 오프셋을 두 번 더하지 마세요.", "Nguồn là múi của chiếc đồng hồ. Copy UTC. Đừng cộng độ lệch hai lần.", "Asal adalah zona jam itu. Salin UTC. Jangan tambah offset dua kali.", "El origen es la zona del reloj. Copie el UTC. No sume el desfase dos veces."),
}


def files_for(loc: str) -> dict[str, str]:
    t = lambda k: tx(loc, T[k])
    out: dict[str, str] = {}
    out["count-workdays.svg"] = svg(1280, 720, heading(t("wd.title")) + card(80, 150, 340, 220, t("wd.both"), t("wd.five")) + card(460, 150, 340, 220, t("wd.five"), t("wd.cap")) + card(840, 150, 360, 220, t("wd.hol"), t("wd.cap"), True) + caption(t("wd.cap"), 470, 80), T["wd.title"][loc])
    out["count-workdays-ends.svg"] = svg(960, 540, heading(t("wd.both"), 22) + card(70, 140, 820, 200, t("wd.five"), t("wd.cap"), True) + caption(t("wd.cap")), T["wd.both"][loc])
    out["count-workdays-holiday.svg"] = svg(960, 540, heading(t("wd.hol"), 22) + card(70, 140, 820, 200, t("wd.hol"), t("wd.cap"), True) + caption(t("wd.cap")), T["wd.hol"][loc])
    out["simplify-fraction.svg"] = svg(1280, 720, heading(t("fr.title")) + card(80, 150, 340, 220, t("fr.a"), t("fr.sign")) + card(460, 150, 340, 220, t("fr.b"), t("fr.sign"), True) + card(840, 150, 360, 220, t("fr.c"), t("fr.cap")) + caption(t("fr.cap"), 470, 80), T["fr.title"][loc])
    out["simplify-fraction-reduce.svg"] = svg(960, 540, heading(t("fr.b"), 22) + card(70, 140, 820, 200, t("fr.a"), t("fr.sign"), True) + caption(t("fr.sign")), T["fr.b"][loc])
    out["simplify-fraction-decimal.svg"] = svg(960, 540, heading(t("fr.c"), 22) + card(70, 140, 820, 200, t("fr.c"), t("fr.cap"), True) + caption(t("fr.cap")), T["fr.c"][loc])
    out["hourly-pay.svg"] = svg(1280, 720, heading(t("hp.title")) + card(80, 150, 340, 220, t("hp.rate"), t("hp.math")) + card(460, 150, 340, 220, t("hp.math"), t("hp.gross"), True) + card(840, 150, 360, 220, t("hp.gross"), t("hp.cap")) + caption(t("hp.cap"), 470, 80), T["hp.title"][loc])
    out["hourly-pay-gross.svg"] = svg(960, 540, heading(t("hp.gross"), 22) + card(70, 140, 820, 200, t("hp.math"), t("hp.gross"), True) + caption(t("hp.cap")), T["hp.gross"][loc])
    out["hourly-pay-tax.svg"] = svg(960, 540, heading(t("hp.rate"), 22) + card(70, 140, 820, 200, t("hp.rate"), t("hp.cap"), True) + caption(t("hp.cap")), T["hp.rate"][loc])
    out["convert-timezone.svg"] = svg(1280, 720, heading(t("tz.title")) + card(80, 150, 340, 220, t("tz.src"), t("tz.cap")) + card(460, 150, 340, 220, t("tz.dst"), t("tz.jul")) + card(840, 150, 360, 220, "UTC", t("tz.cap"), True) + caption(t("tz.cap"), 470, 80), T["tz.title"][loc])
    out["convert-timezone-source.svg"] = svg(960, 540, heading(t("tz.src"), 22) + card(70, 140, 820, 200, t("tz.src"), t("tz.cap"), True) + caption(t("tz.cap")), T["tz.src"][loc])
    out["convert-timezone-offset.svg"] = svg(960, 540, heading(t("tz.dst"), 22) + card(70, 140, 390, 200, t("tz.dst"), t("tz.cap")) + card(490, 140, 400, 200, t("tz.jul"), t("tz.cap"), True) + caption(t("tz.cap")), T["tz.dst"][loc])
    return out


def main() -> None:
    ROOT.mkdir(parents=True, exist_ok=True)
    for loc in LOCS:
        dest = ROOT if not FOLDERS[loc] else ROOT / FOLDERS[loc]
        dest.mkdir(parents=True, exist_ok=True)
        for name, body in files_for(loc).items():
            path = dest / name
            path.write_text(body, encoding="utf-8")
            print("wrote", path.relative_to(ROOT.parents[2]))


if __name__ == "__main__":
    main()
