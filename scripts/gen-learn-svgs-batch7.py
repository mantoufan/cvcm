#!/usr/bin/env python3
"""SVGs for JSON, Base64, Unix time, and JWT lessons."""
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


def heading(text, size=28) -> str:
    return f'<text x="48" y="54" fill="{DEEP}" font-size="{size}" font-weight="800" font-family="{FONT}">{text}</text>'


def caption(text, y=500, x=48) -> str:
    return f'<text x="{x}" y="{y}" fill="{MUTED}" font-size="18" font-family="{FONT}">{text}</text>'


def card(x, y, w, h, title, line, accent=False) -> str:
    fill, stroke = (SOFT, PINK) if accent else (CARD, LINE)
    return f'''
  <rect x="{x}" y="{y}" width="{w}" height="{h}" rx="22" fill="{fill}" stroke="{stroke}" stroke-width="3"/>
  <text x="{x + 28}" y="{y + 52}" fill="{DEEP}" font-size="24" font-weight="700" font-family="{FONT}">{title}</text>
  <text x="{x + 28}" y="{y + 96}" fill="{INK}" font-size="18" font-family="{FONT}">{line}</text>
'''


T = {
    "js.title": pack("How to format JSON", "怎么格式化 JSON", "怎麼格式化 JSON", "JSONの整形方法", "JSON 포맷하는 법", "Cách định dạng JSON", "Cara format JSON", "Cómo formatear JSON"),
    "js.pretty": pack("Two spaces", "两个空格", "兩個空格", "2スペース", "두 칸", "Hai dấu cách", "Dua spasi", "Dos espacios"),
    "js.mini": pack("One line", "一行", "一行", "1行", "한 줄", "Một dòng", "Satu baris", "Una línea"),
    "js.quotes": pack("Quotes", "加引号", "加引號", "引用符", "따옴표", "Ngoặc kép", "Kutip", "Comillas"),
    "js.cap": pack("Pretty for reading. One line for sending. Both must parse.", "给读就排开。给发就一行。两种都要能解析。", "給讀就排開。給發就一行。兩種都要能解析。", "読むなら整形。送るなら1行。どちらも解析できること。", "읽기는 펼치기. 보내기는 한 줄. 둘 다 파싱되어야 합니다.", "Để đọc thì giãn. Để gửi thì một dòng. Cả hai phải phân tích được.", "Untuk dibaca: rapi. Untuk dikirim: satu baris. Keduanya harus terurai.", "Para leer, expanda. Para enviar, una línea. Ambos deben analizarse."),
    "js.rule": pack("Longer than 15 digits: put the integer in quotes.", "超过 15 位的整数要加引号。", "超過 15 位的整數要加引號。", "15桁を超える整数は引用符で。", "15자리를 넘는 정수는 따옴표 안에.", "Số dài hơn 15 chữ số phải trong ngoặc kép.", "Lebih dari 15 digit: taruh dalam kutip.", "Más de 15 dígitos: el entero va entre comillas."),
    "b64.title": pack("How to decode Base64", "怎么解码 Base64", "怎麼解碼 Base64", "Base64のデコード方法", "Base64 디코딩하는 법", "Cách giải mã Base64", "Cara dekode Base64", "Cómo decodificar Base64"),
    "b64.std": pack("Plus and slash", "加号和斜杠", "加號和斜線", "+ と /", "더하기와 슬래시", "Cộng và gạch chéo", "Plus dan garis miring", "Más y barra"),
    "b64.url": pack("Minus and underscore", "减号和下划线", "減號和底線", "- と _", "빼기와 밑줄", "Trừ và gạch dưới", "Minus dan garis bawah", "Menos y guion bajo"),
    "b64.text": pack("UTF-8 text", "UTF-8 文字", "UTF-8 文字", "UTF-8文字", "UTF-8 글", "Chữ UTF-8", "Teks UTF-8", "Texto UTF-8"),
    "b64.cap": pack("This page wants standard Base64. A picture or a PDF fails.", "这一页要标准 Base64。图片或 PDF 会失败。", "這一頁要標準 Base64。圖片或 PDF 會失敗。", "このページは標準Base64。画像やPDFは失敗。", "이 페이지는 표준 Base64. 그림이나 PDF는 실패합니다.", "Trang này cần Base64 chuẩn. Ảnh hoặc PDF sẽ thất bại.", "Halaman ini minta Base64 standar. Gambar atau PDF gagal.", "Esta página quiere Base64 estándar. Una imagen o un PDF falla."),
    "b64.rule": pack("Standard alphabet only. Decode prints text you can read.", "只要标准字母表。解码打出你能读的文字。", "只要標準字母表。解碼打出你能讀的文字。", "標準の文字種だけ。デコードは読める文字を出す。", "표준 알파벳만. 디코드는 읽을 수 있는 글을 출력합니다.", "Chỉ bảng chữ chuẩn. Giải mã in chữ bạn đọc được.", "Hanya alfabet standar. Dekode mencetak teks yang bisa dibaca.", "Solo el alfabeto estándar. Decodificar imprime texto que se lee."),
    "ut.title": pack("How to convert a Unix timestamp", "怎么换算 Unix 时间戳", "怎麼換算 Unix 時間戳", "Unixタイムスタンプの変換", "유닉스 타임스탬프 변환", "Cách đổi dấu thời gian Unix", "Cara ubah stempel waktu Unix", "Cómo convertir tiempo Unix"),
    "ut.s": pack("10 digits", "10 位", "10 位", "10桁", "10자리", "10 chữ số", "10 digit", "10 dígitos"),
    "ut.ms": pack("13 digits", "13 位", "13 位", "13桁", "13자리", "13 chữ số", "13 digit", "13 dígitos"),
    "ut.us": pack("16 digits", "16 位", "16 位", "16桁", "16자리", "16 chữ số", "16 digit", "16 dígitos"),
    "ut.sec": pack("seconds", "秒", "秒", "秒", "초", "giây", "detik", "segundos"),
    "ut.msec": pack("milliseconds", "毫秒", "毫秒", "ミリ秒", "밀리초", "mili giây", "milidetik", "milisegundos"),
    "ut.usec": pack("divide by 1,000 once", "除以 1,000 一次", "除以 1,000 一次", "1,000で一度割る", "1,000으로 한 번", "chia 1.000 một lần", "bagi 1.000 sekali", "dividir por 1.000 una vez"),
    "ut.cap": pack("Read ISO and local time. A wild year means the digits were wrong.", "看 ISO 和本地时间。年份离谱就是位数错了。", "看 ISO 和本地時間。年份離譜就是位數錯了。", "ISOとローカルを読む。年が変なら桁が違う。", "ISO와 로컬을 읽으세요. 연도가 이상하면 자릿수가 틀립니다.", "Đọc ISO và giờ máy. Năm kỳ lạ là đếm sai chữ số.", "Baca ISO dan waktu lokal. Tahun aneh berarti digitnya salah.", "Lea ISO y la hora local. Un año raro: los dígitos estaban mal."),
    "jwt.title": pack("How to read a JWT", "怎么读 JWT", "怎麼讀 JWT", "JWTの読み方", "JWT 읽는 법", "Cách đọc JWT", "Cara baca JWT", "Cómo leer un JWT"),
    "jwt.head": pack("Header", "头部", "頭部", "ヘッダ", "헤더", "Header", "Header", "Encabezado"),
    "jwt.pay": pack("Payload", "载荷", "載荷", "ペイロード", "페이로드", "Payload", "Payload", "Carga"),
    "jwt.sig": pack("Unchecked", "未校验", "未校驗", "未検証", "미확인", "Chưa kiểm", "Tidak diperiksa", "Sin comprobar"),
    "jwt.cap": pack("Decode shows JSON. Verify where the key lives.", "解码显示 JSON。到密钥所在的地方再校验。", "解碼顯示 JSON。到金鑰所在的地方再校驗。", "復号はJSONを見せる。鍵がある場所で検証する。", "디코드는 JSON을 보여 줍니다. 키가 있는 곳에서 확인하세요.", "Giải mã hiện JSON. Kiểm ở nơi giữ khóa.", "Dekode menampilkan JSON. Periksa di tempat kuncinya.", "Decodificar muestra JSON. Verifique donde esté la clave."),
    "jwt.exp": pack("Expired compares exp with the clock.", "过期只是拿 exp 和时钟比。", "過期只是拿 exp 和時鐘比。", "期限切れは exp と時計の比較。", "만료는 exp와 시계의 비교.", "Hết hạn là so exp với đồng hồ.", "Kedaluwarsa membandingkan exp dengan jam.", "Caducado compara exp con el reloj."),
}


def files_for(loc: str) -> dict[str, str]:
    t = lambda k: tx(loc, T[k])
    out: dict[str, str] = {}
    out["format-json.svg"] = svg(1280, 720, heading(t("js.title")) + card(80, 140, 340, 240, t("js.pretty"), t("js.cap")) + card(460, 140, 340, 240, t("js.mini"), t("js.cap")) + card(840, 140, 360, 240, t("js.quotes"), t("js.rule"), True) + caption(t("js.cap"), 480, 80), T["js.title"][loc])
    out["format-json-parse.svg"] = svg(960, 540, heading(t("js.cap"), 22) + card(70, 140, 820, 200, t("js.pretty"), t("js.cap"), True) + caption(t("js.cap")), T["js.cap"][loc])
    out["format-json-quotes.svg"] = svg(960, 540, heading(t("js.rule"), 22) + card(70, 140, 820, 200, t("js.quotes"), t("js.rule"), True) + caption(t("js.rule")), T["js.rule"][loc])
    out["decode-base64.svg"] = svg(1280, 720, heading(t("b64.title")) + card(80, 140, 340, 240, "+ /", t("b64.std")) + card(460, 140, 340, 240, "- _", t("b64.url")) + card(840, 140, 360, 240, t("b64.text"), t("b64.rule"), True) + caption(t("b64.cap"), 480, 80), T["b64.title"][loc])
    out["decode-base64-alpha.svg"] = svg(960, 540, heading(t("b64.std"), 22) + card(70, 140, 390, 200, "+ /", t("b64.std"), True) + card(490, 140, 400, 200, "- _", t("b64.url")) + caption(t("b64.cap")), T["b64.std"][loc])
    out["decode-base64-text.svg"] = svg(960, 540, heading(t("b64.text"), 22) + card(70, 140, 820, 200, t("b64.text"), t("b64.rule"), True) + caption(t("b64.cap")), T["b64.text"][loc])
    out["unix-time.svg"] = svg(1280, 720, heading(t("ut.title")) + card(80, 140, 340, 240, t("ut.s"), t("ut.sec")) + card(460, 140, 340, 240, t("ut.ms"), t("ut.msec")) + card(840, 140, 360, 240, t("ut.us"), t("ut.usec"), True) + caption(t("ut.cap"), 480, 80), T["ut.title"][loc])
    out["unix-time-digits.svg"] = svg(960, 540, heading(t("ut.s"), 22) + card(70, 140, 250, 200, t("ut.s"), t("ut.sec")) + card(350, 140, 250, 200, t("ut.ms"), t("ut.msec"), True) + card(630, 140, 260, 200, t("ut.us"), t("ut.usec")) + caption(t("ut.cap")), T["ut.s"][loc])
    out["unix-time-year.svg"] = svg(960, 540, heading(t("ut.cap"), 20) + card(70, 140, 820, 200, "ISO", t("ut.cap"), True) + caption(t("ut.cap")), T["ut.cap"][loc])
    out["read-jwt.svg"] = svg(1280, 720, heading(t("jwt.title")) + card(80, 140, 340, 240, t("jwt.head"), "alg") + card(460, 140, 340, 240, t("jwt.pay"), "exp") + card(840, 140, 360, 240, t("jwt.sig"), t("jwt.cap"), True) + caption(t("jwt.cap"), 480, 80), T["jwt.title"][loc])
    out["read-jwt-trust.svg"] = svg(960, 540, heading(t("jwt.sig"), 22) + card(70, 140, 820, 200, t("jwt.sig"), t("jwt.cap"), True) + caption(t("jwt.cap")), T["jwt.sig"][loc])
    out["read-jwt-exp.svg"] = svg(960, 540, heading(t("jwt.exp"), 22) + card(70, 140, 820, 200, "exp", t("jwt.exp"), True) + caption(t("jwt.exp")), T["jwt.exp"][loc])
    return out


def main() -> None:
    ROOT.mkdir(parents=True, exist_ok=True)
    for loc in LOCS:
        dest = ROOT if not FOLDERS[loc] else ROOT / FOLDERS[loc]
        dest.mkdir(parents=True, exist_ok=True)
        for name, body in files_for(loc).items():
            path = dest / name
            path.write_text(body, encoding="utf-8")
            print("wrote", path.relative_to(ROOT.parents[2]), path.stat().st_size)


if __name__ == "__main__":
    main()
