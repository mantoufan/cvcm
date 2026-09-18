#!/usr/bin/env python3
"""SVGs for collage, meme, word-count, trim-audio lessons."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "public" / "covers" / "tutorials"
DEEP, SOFT, INK, MUTED, PINK, WHITE = "#a13f6c", "#ffe4ee", "#59364b", "#876579", "#c83f79", "#fff7fb"
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


def heading(text, size=32) -> str:
    return f'<text x="48" y="54" fill="{DEEP}" font-size="{size}" font-weight="800" font-family="{FONT}">{text}</text>'


def caption(text, y=500, x=48) -> str:
    return f'<text x="{x}" y="{y}" fill="{MUTED}" font-size="18" font-family="{FONT}">{text}</text>'


T = {
    "c.title": pack("How to make a photo collage", "怎么做照片拼图", "怎麼做照片拼圖", "写真コラージュの作り方", "사진 콜라주 만드는 법", "Cách làm ảnh ghép", "Cara buat kolase foto", "Cómo hacer un collage"),
    "c.grid": pack("2×2 · 3×3", "2×2 · 3×3", "2×2 · 3×3", "2×2 · 3×3", "2×2 · 3×3", "2×2 · 3×3", "2×2 · 3×3", "2×2 · 3×3"),
    "c.size": pack("square · 4:5 · 9:16", "正方形 · 4:5 · 9:16", "正方形 · 4:5 · 9:16", "正方形 · 4:5 · 9:16", "정사각 · 4:5 · 9:16", "vuông · 4:5 · 9:16", "persegi · 4:5 · 9:16", "cuadrado · 4:5 · 9:16"),
    "c.cap": pack("Layout first. Then photos. Check faces after Cover.", "先定格子，再放图。Cover 之后看脸。", "先定格子，再放圖。Cover 之後看臉。", "先にレイアウト。Coverのあと顔を見る。", "레이아웃 먼저. Cover 뒤에 얼굴을 보세요.", "Bố cục trước. Rồi ảnh. Cover xong kiểm mặt.", "Layout dulu. Lalu foto. Setelah Cover, cek wajah.", "Primero la plantilla. Luego las fotos. Después de Cover, las caras."),
    "c.layout": pack("Pick the grid and the size first", "先选宫格和尺寸", "先選宮格和尺寸", "先にグリッドとサイズ", "격자와 크기를 먼저", "Chọn lưới và cỡ trước", "Pilih kisi dan ukuran dulu", "Elija cuadrícula y tamaño"),
    "c.fit": pack("Contain keeps the whole photo. Cover may crop faces.", "Contain 放下整张。Cover 可能切脸。", "Contain 放下整張。Cover 可能切臉。", "Containは全体。Coverは顔を切ることがある。", "Contain은 전체. Cover는 얼굴을 자를 수 있습니다.", "Contain giữ cả ảnh. Cover có thể cắt mặt.", "Contain menjaga seluruh foto. Cover bisa memotong wajah.", "Contain deja la foto entera. Cover puede recortar caras."),
    "m.title": pack("How to make a meme", "怎么做表情包", "怎麼做迷因圖", "ミームの作り方", "밈 만드는 법", "Cách làm meme", "Cara buat meme", "Cómo hacer un meme"),
    "m.top": pack("TOP LINE", "上一句", "上一句", "上の行", "윗줄", "DÒNG TRÊN", "BARIS ATAS", "ARRIBA"),
    "m.bot": pack("BOTTOM LINE", "下一句", "下一句", "下の行", "아랫줄", "DÒNG DƯỚI", "BARIS BAWAH", "ABAJO"),
    "m.cap": pack("Short lines. Stroke. Do not cover the face.", "句子要短。要描边。不要挡住脸。", "句子要短。要描邊。不要擋住臉。", "短く。縁。顔を隠さない。", "짧게. 테두리. 얼굴을 가리지 마세요.", "Câu ngắn. Có viền. Đừng che mặt.", "Kalimat pendek. Stroke. Jangan tutupi wajah.", "Líneas cortas. Trazo. No tape la cara."),
    "m.text": pack("Top sets up. Bottom pays off.", "上一句铺垫，下一句收束。", "上一句鋪墊，下一句收束。", "上は振り、下は落ち。", "위는 깔고 아래는 받습니다.", "Trên mở, dưới chốt.", "Atas setup, bawah punch.", "Arriba plantea, abajo cierra."),
    "m.stroke": pack("Stroke keeps type readable", "描边让字能读", "描邊讓字能讀", "縁で文字が読める", "테두리가 글자를 읽히게 함", "Viền giúp chữ đọc được", "Stroke membuat teks kebaca", "El trazo hace legible el texto"),
    "w.title": pack("How to count words and characters", "怎么统计字数和词数", "怎麼統計字數和詞數", "単語と文字数の数え方", "단어·글자 수 세는 법", "Cách đếm từ và ký tự", "Cara hitung kata dan karakter", "Cómo contar palabras y caracteres"),
    "w.words": pack("Words", "词", "詞", "単語", "단어", "Từ", "Kata", "Palabras"),
    "w.chars": pack("Characters", "字符", "字元", "文字", "글자", "Ký tự", "Karakter", "Caracteres"),
    "w.nosp": pack("No spaces", "不含空格", "不含空格", "空白なし", "공백 없음", "Không khoảng", "Tanpa spasi", "Sin espacios"),
    "w.cap": pack("Three jobs, three numbers. Chinese homework uses no-spaces.", "三件事，三个数。中文作业看不含空格。", "三件事，三個數。中文作業看不含空格。", "3つの仕事、3つの数。中国語宿題は空白なし。", "세 일, 세 숫자. 중국어 숙제는 공백 없는 글자.", "Ba việc, ba số. Bài Trung dùng không khoảng.", "Tiga kerja, tiga angka. PR Tionghoa: tanpa spasi.", "Tres trabajos, tres cifras. Los deberes en chino, sin espacios."),
    "w.which": pack("Know which number you need", "先知道要哪一个数", "先知道要哪一個數", "欲しい数字を決める", "필요한 숫자를 정하기", "Biết cần số nào", "Tahu angka mana", "Sepa qué número necesita"),
    "w.cjk": pack("For 字数 use characters with no spaces, not Words.", "字数看不含空格，不要看词数。", "字數看不含空格，不要看詞數。", "字数は空白なし。単語は使わない。", "자수는 공백 없는 글자. 단어를 쓰지 마세요.", "字数 dùng không khoảng, đừng dùng Words.", "字数: tanpa spasi, bukan Words.", "Para 字数 use sin espacios, no Words."),
    "a.title": pack("How to trim audio / cut an MP3", "怎么裁剪音频 / 剪 MP3", "怎麼裁剪音訊 / 剪 MP3", "音声のトリム / MP3を切る", "오디오 자르기 / MP3 컷", "Cách cắt audio / cắt MP3", "Cara potong audio / potong MP3", "Cómo recortar audio / cortar un MP3"),
    "a.start": pack("start", "起点", "起點", "開始", "시작", "đầu", "awal", "inicio"),
    "a.end": pack("end", "终点", "終點", "終了", "끝", "cuối", "akhir", "fin"),
    "a.cap": pack("Listen, then download WAV. Play the file before you send.", "先听，再下载 WAV。发出去之前播文件。", "先聽，再下載 WAV。寄出去之前播檔。", "聴いてからWAV。送る前にファイルを再生。", "들은 뒤 WAV. 보내기 전에 파일을 재생하세요.", "Nghe rồi tải WAV. Phát file trước khi gửi.", "Dengar, unduh WAV. Putar file sebelum kirim.", "Escuche, descargue WAV. Reproduzca el archivo antes de enviar."),
    "a.range": pack("Start and end on the waveform", "在波形上标起点和终点", "在波形上標起點和終點", "波形に開始と終了", "파형에 시작과 끝", "Đầu và cuối trên sóng", "Awal dan akhir di gelombang", "Inicio y fin en la onda"),
    "a.listen": pack("Export is WAV. Play the downloaded file.", "导出是 WAV。播下载的文件。", "匯出是 WAV。播下載的檔。", "書き出しはWAV。保存したファイルを再生。", "보낸 파일은 WAV. 받은 파일을 재생하세요.", "Xuất là WAV. Phát file đã tải.", "Ekspor WAV. Putar file unduhan.", "La exportación es WAV. Reproduzca el archivo."),
}


def files_for(loc: str) -> dict[str, str]:
    t = lambda k: tx(loc, T[k])
    out = {}
    cells = "".join(
        f'<rect x="{80 + (i % 2) * 170}" y="{140 + (i // 2) * 170}" width="150" height="150" rx="16" fill="{SOFT}" stroke="{PINK}" stroke-width="3"/>'
        for i in range(4)
    )
    out["make-collage.svg"] = svg(1280, 720, heading(t("c.title")) + f'''
  <g font-family="{FONT}">{cells}
    <text x="520" y="250" fill="{DEEP}" font-size="26" font-weight="700">{t("c.grid")}</text>
    <text x="520" y="320" fill="{INK}" font-size="22">{t("c.size")}</text>
  </g>
''' + caption(t("c.cap"), 620, 80), T["c.title"][loc])
    out["make-collage-layout.svg"] = svg(960, 540, heading(t("c.layout"), 28) + f'''
  <g font-family="{FONT}">
    <text x="70" y="200" fill="{DEEP}" font-size="28" font-weight="700">{t("c.grid")}</text>
    <text x="70" y="270" fill="{INK}" font-size="22">{t("c.size")}</text>
  </g>
''' + caption(t("c.cap")), T["c.layout"][loc])
    out["make-collage-fit.svg"] = svg(960, 540, heading(t("c.fit"), 26) + f'''
  <g font-family="{FONT}" font-size="22" fill="{INK}">
    <rect x="70" y="140" width="820" height="240" rx="20" fill="#fff" stroke="#f7b6cb" stroke-width="3"/>
    <text x="100" y="250">{t("c.fit")}</text>
  </g>
''' + caption(t("c.cap")), T["c.fit"][loc])
    out["make-meme.svg"] = svg(1280, 720, heading(t("m.title")) + f'''
  <g font-family="{FONT}">
    <rect x="200" y="120" width="880" height="480" rx="24" fill="{SOFT}" stroke="{PINK}" stroke-width="5"/>
    <text x="640" y="200" text-anchor="middle" fill="{DEEP}" font-size="36" font-weight="800">{t("m.top")}</text>
    <circle cx="640" cy="360" r="70" fill="{PINK}"/>
    <text x="640" y="540" text-anchor="middle" fill="{DEEP}" font-size="36" font-weight="800">{t("m.bot")}</text>
  </g>
''' + caption(t("m.cap"), 650, 80), T["m.title"][loc])
    out["make-meme-text.svg"] = svg(960, 540, heading(t("m.text"), 28) + f'''
  <g font-family="{FONT}">
    <text x="80" y="200" fill="{DEEP}" font-size="28" font-weight="700">{t("m.top")}</text>
    <text x="80" y="280" fill="{INK}" font-size="28" font-weight="700">{t("m.bot")}</text>
  </g>
''' + caption(t("m.cap")), T["m.text"][loc])
    out["make-meme-stroke.svg"] = svg(960, 540, heading(t("m.stroke"), 28) + f'''
  <g font-family="{FONT}">
    <text x="80" y="240" fill="#fff" stroke="{DEEP}" stroke-width="8" font-size="40" font-weight="800">{t("m.stroke")}</text>
  </g>
''' + caption(t("m.cap")), T["m.stroke"][loc])
    out["count-words.svg"] = svg(1280, 720, heading(t("w.title")) + f'''
  <g font-family="{FONT}">
    <rect x="80" y="160" width="340" height="300" rx="22" fill="{SOFT}" stroke="{PINK}" stroke-width="3"/>
    <text x="110" y="280" fill="{DEEP}" font-size="28" font-weight="700">{t("w.words")}</text>
    <rect x="460" y="160" width="340" height="300" rx="22" fill="#fff" stroke="#f7b6cb" stroke-width="3"/>
    <text x="490" y="280" fill="{DEEP}" font-size="28" font-weight="700">{t("w.chars")}</text>
    <rect x="840" y="160" width="360" height="300" rx="22" fill="#fff" stroke="#f7b6cb" stroke-width="3"/>
    <text x="870" y="280" fill="{DEEP}" font-size="28" font-weight="700">{t("w.nosp")}</text>
  </g>
''' + caption(t("w.cap"), 620, 80), T["w.title"][loc])
    out["count-words-which.svg"] = svg(960, 540, heading(t("w.which"), 28) + f'''
  <g font-family="{FONT}" font-size="22" fill="{INK}">
    <text x="80" y="180">{t("w.words")}</text>
    <text x="80" y="240">{t("w.chars")}</text>
    <text x="80" y="300">{t("w.nosp")}</text>
  </g>
''' + caption(t("w.cap")), T["w.which"][loc])
    out["count-words-cjk.svg"] = svg(960, 540, heading(t("w.cjk"), 26) + f'''
  <g font-family="{FONT}">
    <rect x="70" y="140" width="820" height="220" rx="20" fill="#fff" stroke="#f7b6cb" stroke-width="3"/>
    <text x="100" y="260" fill="{INK}" font-size="22">{t("w.cjk")}</text>
  </g>
''' + caption(t("w.cap")), T["w.cjk"][loc])
    out["trim-audio.svg"] = svg(1280, 720, heading(t("a.title")) + f'''
  <g font-family="{FONT}">
    <rect x="80" y="200" width="1120" height="220" rx="24" fill="#fff" stroke="#f7b6cb" stroke-width="3"/>
    <path d="M120 310 l40 -40 40 80 40 -60 40 40 40 -20 40 50 40 -70 40 30 40 10 40 -40 40 60 40 -30 40 20" fill="none" stroke="{PINK}" stroke-width="6"/>
    <line x1="320" y1="210" x2="320" y2="410" stroke="{DEEP}" stroke-width="4"/>
    <line x1="920" y1="210" x2="920" y2="410" stroke="{DEEP}" stroke-width="4"/>
    <text x="300" y="460" fill="{DEEP}" font-size="20">{t("a.start")}</text>
    <text x="900" y="460" fill="{DEEP}" font-size="20">{t("a.end")}</text>
  </g>
''' + caption(t("a.cap"), 620, 80), T["a.title"][loc])
    out["trim-audio-range.svg"] = svg(960, 540, heading(t("a.range"), 28) + f'''
  <g font-family="{FONT}">
    <text x="80" y="200" fill="{DEEP}" font-size="24">{t("a.start")} → {t("a.end")}</text>
    <text x="80" y="270" fill="{INK}" font-size="20">{t("a.range")}</text>
  </g>
''' + caption(t("a.cap")), T["a.range"][loc])
    out["trim-audio-listen.svg"] = svg(960, 540, heading(t("a.listen"), 28) + f'''
  <g font-family="{FONT}">
    <rect x="70" y="140" width="820" height="220" rx="20" fill="{SOFT}" stroke="{PINK}" stroke-width="3"/>
    <text x="100" y="260" fill="{INK}" font-size="22">{t("a.listen")}</text>
  </g>
''' + caption(t("a.cap")), T["a.listen"][loc])
    return out


def main() -> None:
    ROOT.mkdir(parents=True, exist_ok=True)
    for loc in LOCS:
        dest = ROOT if not FOLDERS[loc] else ROOT / FOLDERS[loc]
        dest.mkdir(parents=True, exist_ok=True)
        for name, body in files_for(loc).items():
            path = dest / name
            path.write_text(body, encoding="utf-8")
            print("wrote", path.relative_to(ROOT.parent.parent.parent), path.stat().st_size)


if __name__ == "__main__":
    main()
