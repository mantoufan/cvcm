#!/usr/bin/env python3
"""Instructional SVGs for second-batch lessons, one folder per locale."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "public" / "covers" / "tutorials"
PINK, DEEP, SOFT, INK, MUTED, LINE, WHITE, CARD = (
    "#c83f79", "#a13f6c", "#ffe4ee", "#59364b", "#876579", "#f2d9e5", "#fff7fb", "#ffffff",
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


def svg(w: int, h: int, inner: str, label: str) -> str:
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" role="img" aria-label="{xml(label)}">
  <rect width="{w}" height="{h}" rx="28" fill="{WHITE}"/>
  {inner}
</svg>
'''


def heading(text: str, size: int = 32) -> str:
    return f'<text x="48" y="54" fill="{DEEP}" font-size="{size}" font-weight="800" font-family="{FONT}">{text}</text>'


def caption(text: str, y: int = 500, x: int = 48) -> str:
    return f'<text x="{x}" y="{y}" fill="{MUTED}" font-size="18" font-family="{FONT}">{text}</text>'


def card(x, y, w, h, title, lines, accent=False) -> str:
    fill, stroke = (SOFT, PINK) if accent else (CARD, LINE)
    tspan = "".join(f'<tspan x="{x + 22}" dy="{22 if i else 0}">{line}</tspan>' for i, line in enumerate(lines))
    return f'''
  <rect x="{x}" y="{y}" width="{w}" height="{h}" rx="22" fill="{fill}" stroke="{stroke}" stroke-width="3"/>
  <text x="{x + 22}" y="{y + 40}" fill="{DEEP}" font-size="22" font-weight="700" font-family="{FONT}">{title}</text>
  <text x="{x + 22}" y="{y + 72}" fill="{INK}" font-size="18" font-family="{FONT}">{tspan}</text>
'''


T = {
    "wp.title": pack("How to convert WebP to PNG", "怎么把 WebP 转成 PNG", "怎麼把 WebP 轉成 PNG", "WebPをPNGにする", "WebP를 PNG로", "Cách đổi WebP sang PNG", "Cara ubah WebP ke PNG", "Cómo pasar WebP a PNG"),
    "wp.webp": pack("WebP · smaller", "WebP · 更小", "WebP · 更小", "WebP · 小さい", "WebP · 더 작음", "WebP · nhỏ hơn", "WebP · lebih kecil", "WebP · más liviano"),
    "wp.png": pack("PNG · opens more places", "PNG · 更通用", "PNG · 更通用", "PNG · 通る", "PNG · 더 통함", "PNG · phổ biến hơn", "PNG · lebih diterima", "PNG · se acepta más"),
    "wp.cap": pack("Pick PNG if you need a clear background. JPG will fill it.", "要透明底就选 PNG。JPG 会填死。", "要透明底就選 PNG。JPG 會填死。", "透明が要るならPNG。JPGは埋める。", "투명이 필요하면 PNG. JPG는 메웁니다.", "Cần nền trong thì chọn PNG. JPG sẽ lấp.", "Butuh latar tembus: PNG. JPG mengisi.", "Si necesita fondo transparente, PNG. JPG lo rellena."),
    "wp.why": pack("WebP is smaller. PNG is accepted more widely.", "WebP 更小。PNG 更通用。", "WebP 更小。PNG 更通用。", "WebPは小さい。PNGは通る。", "WebP는 작고 PNG는 더 통합니다.", "WebP nhỏ hơn. PNG phổ biến hơn.", "WebP lebih kecil. PNG lebih diterima.", "WebP pesa menos. PNG se acepta más."),
    "wp.w1": pack("Chrome downloads", "Chrome 下载", "Chrome 下載", "Chromeの保存", "Chrome 저장", "Chrome tải", "Unduhan Chrome", "Descarga de Chrome"),
    "wp.w2": pack("Smaller on the wire", "传输更小", "傳輸更小", "回線が軽い", "전송이 작음", "Đường truyền nhẹ", "Lebih hemat kuota", "Menos peso en red"),
    "wp.p1": pack("Forms and old apps", "表单和老软件", "表單和老軟體", "提出と古いアプリ", "서류와 옛 앱", "Form và app cũ", "Formulir dan app lama", "Formularios y apps viejas"),
    "wp.p2": pack("Can keep transparency", "能留透明底", "能留透明底", "透明を残せる", "투명을 남김", "Giữ nền trong", "Jaga transparansi", "Puede conservar transparencia"),
    "wp.alpha": pack("PNG keeps a clear background", "PNG 留下透明底", "PNG 留下透明底", "PNGは透明を残す", "PNG는 투명을 남김", "PNG giữ nền trong", "PNG menjaga latar tembus", "PNG conserva el fondo"),
    "wp.jpg": pack("JPG fills it in", "JPG 会填死", "JPG 會填死", "JPGは埋める", "JPG는 메움", "JPG sẽ lấp", "JPG mengisi", "JPG lo rellena"),
    "rs.title": pack("How to resize or compress an image", "怎么缩放或压缩图片", "怎麼縮放或壓縮圖片", "画像のリサイズと圧縮", "이미지 크기 조절·압축", "Cách thu nhỏ hoặc nén ảnh", "Cara ubah ukuran atau kompres gambar", "Cómo redimensionar o comprimir"),
    "rs.px": pack("Pixels", "像素", "像素", "画素", "픽셀", "Pixel", "Piksel", "Píxeles"),
    "rs.kb": pack("Kilobytes", "体积", "體積", "容量", "용량", "Dung lượng", "Kilobyte", "Kilos"),
    "rs.cap": pack("A 4000px photo can still be a huge JPEG. Set the real limit first.", "4000 像素仍可能很大。先写下真实上限。", "4000 像素仍可能很大。先寫下真實上限。", "4000pxでもJPEGは重い。先に上限を書く。", "4000px여도 JPEG가 클 수 있습니다. 한도부터 적으세요.", "Ảnh 4000px vẫn có thể rất nặng. Ghi giới hạn thật trước.", "Foto 4000px masih bisa JPEG besar. Tulis batas nyata dulu.", "Una foto de 4000 px aún puede ser enorme. Anote el límite real."),
    "rs.limit": pack("Write down the real limit", "写下真实上限", "寫下真實上限", "本当の上限を書く", "실제 한도를 적기", "Ghi giới hạn thật", "Tulis batas nyata", "Anote el límite real"),
    "rs.form": pack("Form: 1920 long edge", "表单：长边 1920", "表單：長邊 1920", "提出：長辺1920", "서류: 긴 변 1920", "Form: cạnh dài 1920", "Formulir: sisi 1920", "Formulario: lado 1920"),
    "rs.mail": pack("Email: under 2 MB", "邮箱：小于 2 MB", "信箱：小於 2 MB", "メール：2MB未満", "이메일: 2MB 이하", "Email: dưới 2 MB", "Email: di bawah 2 MB", "Correo: menos de 2 MB"),
    "rs.lock": pack("Keep the aspect lock", "锁住比例", "鎖住比例", "比率ロックを維持", "비율 잠금 유지", "Khóa tỉ lệ", "Kunci rasio", "Mantenga el candado"),
    "rs.unlock": pack("Unlock only to stretch", "只有拉扁才解锁", "只有拉扁才解鎖", "伸ばすときだけ解除", "늘릴 때만 잠금 해제", "Chỉ mở khi kéo méo", "Buka hanya untuk meregang", "Quite el candado solo para estirar"),
    "sp.title": pack("How to split a PDF", "怎么拆分 PDF", "怎麼拆分 PDF", "PDFを分割する方法", "PDF 나누는 법", "Cách tách PDF", "Cara pecah PDF", "Cómo dividir un PDF"),
    "sp.each": pack("Every page → ZIP", "每一页 → ZIP", "每一頁 → ZIP", "全ページ → ZIP", "페이지마다 → ZIP", "Mỗi trang → ZIP", "Tiap halaman → ZIP", "Cada página → ZIP"),
    "sp.range": pack("Range 1-3,5 → one file", "范围 1-3,5 → 一份", "範圍 1-3,5 → 一份", "範囲1-3,5 → 1ファイル", "구간 1-3,5 → 파일 하나", "Khoảng 1-3,5 → một file", "Rentang 1-3,5 → satu file", "Rango 1-3,5 → un archivo"),
    "sp.cap": pack("Locked PDFs often cannot split until you unlock them.", "加密 PDF 要先解锁再拆。", "加密 PDF 要先解鎖再拆。", "暗号化は先に解除。", "암호 PDF는 먼저 해제하세요.", "PDF khóa phải mở khóa trước.", "PDF terkunci harus dibuka dulu.", "Los cifrados hay que desbloquearlos."),
    "sp.eachT": pack("Every page as its own PDF", "每一页一份 PDF", "每一頁一份 PDF", "各ページがPDF", "페이지마다 PDF", "Mỗi trang một PDF", "Tiap halaman satu PDF", "Cada página es un PDF"),
    "sp.rangeT": pack("A range stays in one file", "范围还在同一份文件", "範圍還在同一份檔", "範囲は1ファイル", "구간은 한 파일", "Khoảng còn trong một file", "Rentang tetap satu file", "Un rango queda en un archivo"),
    "wm.title": pack("How to add a watermark to a photo", "怎么给照片加水印", "怎麼給照片加水印", "写真に透かしを入れる", "사진에 워터마크 넣기", "Cách gắn watermark lên ảnh", "Cara beri watermark pada foto", "Cómo añadir una marca de agua"),
    "wm.corner": pack("One corner", "角落一枚", "角落一枚", "隅の1つ", "모서리 하나", "Một góc", "Satu sudut", "Una esquina"),
    "wm.tile": pack("Tiled diagonal", "斜铺", "斜鋪", "斜めタイル", "대각선 타일", "Lát chéo", "Ubin diagonal", "Mosaico diagonal"),
    "wm.cap": pack("A mark nobody can read is useless. A mark that hides the product is also useless.", "看不清没用，挡住货也没用。", "看不清沒用，擋住貨也沒用。", "読めない印は無用。商品を隠す印も無用。", "안 읽히면 소용없고, 상품을 가려도 소용없습니다.", "Không đọc được thì vô dụng; che hàng cũng vô dụng.", "Tak terbaca sia-sia; menutupi barang juga.", "Ilegible no sirve; tapar el producto tampoco."),
    "wm.place": pack("Corner vs tiled", "角落还是斜铺", "角落還是斜鋪", "隅かタイルか", "모서리 대 타일", "Góc hay lát", "Sudut vs ubin", "Esquina o mosaico"),
    "wm.op": pack("Readable, not covering", "能读，不挡货", "能讀，不擋貨", "読めて隠さない", "읽히되 가리지 않음", "Đủ đọc, không che hàng", "Terbaca, tidak menutupi", "Legible, sin tapar"),
    "ex.title": pack("How to remove EXIF / location", "怎么去掉定位和 EXIF", "怎麼去掉定位和 EXIF", "位置情報とEXIFを除く", "위치·EXIF 제거", "Cách gỡ GPS / EXIF", "Cara hapus EXIF / lokasi", "Cómo quitar EXIF y la ubicación"),
    "ex.plus": pack("pixels + GPS", "像素 + 定位", "像素 + 定位", "画素 + GPS", "픽셀 + GPS", "pixel + GPS", "piksel + GPS", "píxeles + GPS"),
    "ex.only": pack("pixels only", "只剩像素", "只剩像素", "画素だけ", "픽셀만", "chỉ pixel", "piksel saja", "solo píxeles"),
    "ex.cap": pack("Export a copy. Keep the original if you still need the pin.", "导出一份。自己还要钉就留原图。", "匯出一份。自己還要釘就留原圖。", "コピーを書き出す。ピンが要る原版は残す。", "복사본을 보내세요. 핀이 필요하면 원본을 남기세요.", "Xuất một bản. Còn cần ghim thì giữ gốc.", "Ekspor salinan. Simpan asli jika butuh pin.", "Exporte una copia. Conserve el original si quiere el pin."),
    "ex.gps": pack("Photo file = pixels + GPS", "照片文件 = 像素 + 定位", "照片檔 = 像素 + 定位", "写真＝画素+GPS", "사진 = 픽셀 + GPS", "File ảnh = pixel + GPS", "File foto = piksel + GPS", "Archivo = píxeles + GPS"),
    "ex.check": pack("Drop the export again. Second pass should be clean.", "把导出再拖回来。第二次应该干净。", "把匯出再拖回來。第二次應該乾淨。", "書き出しを再ドロップ。2回目はきれい。", "보낸 파일을 다시 넣기. 두 번째는 깨끗해야 합니다.", "Thả bản xuất lại. Lần hai phải sạch.", "Letakkan hasilnya lagi. Pass kedua harus bersih.", "Suelte la exportación. La segunda pasada debe estar limpia."),
}


def files_for(loc: str) -> dict[str, str]:
    t = lambda k: tx(loc, T[k])
    out: dict[str, str] = {}
    out["webp-to-png.svg"] = svg(1280, 720, heading(t("wp.title")) + f'''
  <g font-family="{FONT}">
    <rect x="90" y="160" width="360" height="340" rx="24" fill="#ffe4ee" stroke="#c83f79" stroke-width="4"/>
    <text x="120" y="250" fill="#a13f6c" font-size="26" font-weight="700">{t("wp.webp")}</text>
    <path d="M500 320 h80" stroke="#c83f79" stroke-width="10" stroke-linecap="round"/>
    <polygon points="580,300 640,320 580,340" fill="#c83f79"/>
    <rect x="680" y="160" width="500" height="340" rx="24" fill="#fff" stroke="#c83f79" stroke-width="4"/>
    <text x="720" y="250" fill="#a13f6c" font-size="26" font-weight="700">{t("wp.png")}</text>
  </g>
''' + caption(t("wp.cap"), 620, 90), T["wp.title"][loc])
    out["webp-to-png-why.svg"] = svg(960, 540, heading(t("wp.why"), 28)
        + card(50, 110, 410, 300, t("wp.w1"), [t("wp.w2")])
        + card(500, 110, 410, 300, t("wp.p1"), [t("wp.p2")], True)
        + caption(t("wp.cap")), T["wp.why"][loc])
    out["webp-to-png-alpha.svg"] = svg(960, 540, heading(t("wp.alpha"), 28) + f'''
  <g font-family="{FONT}">
    <rect x="70" y="130" width="380" height="250" rx="20" fill="#fff" stroke="#c83f79" stroke-width="4"/>
    <text x="100" y="250" fill="#a13f6c" font-size="22" font-weight="700">{t("wp.alpha")}</text>
    <rect x="510" y="130" width="380" height="250" rx="20" fill="#ffe4ee" stroke="#f7b6cb" stroke-width="3"/>
    <text x="540" y="250" fill="#59364b" font-size="22">{t("wp.jpg")}</text>
  </g>
''' + caption(t("wp.cap")), T["wp.alpha"][loc])
    out["resize-image.svg"] = svg(1280, 720, heading(t("rs.title")) + f'''
  <g font-family="{FONT}">
    <rect x="100" y="170" width="420" height="320" rx="22" fill="#fff" stroke="#f7b6cb" stroke-width="4"/>
    <text x="140" y="260" fill="#a13f6c" font-size="28" font-weight="700">{t("rs.px")}</text>
    <text x="140" y="320" fill="#59364b" font-size="22">4000 × 3000</text>
    <rect x="620" y="170" width="520" height="320" rx="22" fill="#ffe4ee" stroke="#c83f79" stroke-width="4"/>
    <text x="660" y="260" fill="#a13f6c" font-size="28" font-weight="700">{t("rs.kb")}</text>
    <text x="660" y="320" fill="#59364b" font-size="22">2.4 MB → 380 KB</text>
  </g>
''' + caption(t("rs.cap"), 620, 100), T["rs.title"][loc])
    out["resize-image-limit.svg"] = svg(960, 540, heading(t("rs.limit"), 28)
        + card(50, 110, 410, 300, t("rs.form"), [t("rs.mail")], True)
        + card(500, 110, 410, 300, t("rs.px"), [t("rs.kb")])
        + caption(t("rs.cap")), T["rs.limit"][loc])
    out["resize-image-lock.svg"] = svg(960, 540, heading(t("rs.lock"), 28) + f'''
  <g font-family="{FONT}" font-size="22" fill="#59364b">
    <rect x="70" y="140" width="820" height="100" rx="18" fill="#ffe4ee" stroke="#c83f79" stroke-width="3"/>
    <text x="100" y="200">{t("rs.lock")}</text>
    <rect x="70" y="270" width="820" height="100" rx="18" fill="#fff" stroke="#f2d9e5" stroke-width="3"/>
    <text x="100" y="330">{t("rs.unlock")}</text>
  </g>
''' + caption(t("rs.cap")), T["rs.lock"][loc])
    out["split-pdf.svg"] = svg(1280, 720, heading(t("sp.title")) + f'''
  <g font-family="{FONT}">
    <rect x="80" y="160" width="280" height="340" rx="20" fill="#fff" stroke="#c83f79" stroke-width="5"/>
    <text x="110" y="240" fill="#a13f6c" font-size="24" font-weight="700">10 pages</text>
    <path d="M400 320 h70" stroke="#c83f79" stroke-width="10" stroke-linecap="round"/>
    <polygon points="470,300 530,320 470,340" fill="#c83f79"/>
    <rect x="560" y="180" width="160" height="200" rx="14" fill="#ffe4ee"/>
    <rect x="740" y="200" width="160" height="200" rx="14" fill="#ffe4ee"/>
    <rect x="920" y="220" width="160" height="200" rx="14" fill="#ffe4ee"/>
    <text x="560" y="520" fill="#59364b" font-size="20">{t("sp.each")}</text>
  </g>
''' + caption(t("sp.cap"), 640, 80), T["sp.title"][loc])
    out["split-pdf-each.svg"] = svg(960, 540, heading(t("sp.eachT"), 28) + f'''
  <g font-family="{FONT}">
    <text x="80" y="200" fill="#59364b" font-size="24">10 pages</text>
    <text x="80" y="280" fill="#c83f79" font-size="36" font-weight="800">→ 10 files · ZIP</text>
  </g>
''' + caption(t("sp.cap")), T["sp.eachT"][loc])
    out["split-pdf-range.svg"] = svg(960, 540, heading(t("sp.rangeT"), 28) + f'''
  <g font-family="{FONT}">
    <text x="80" y="200" fill="#59364b" font-size="24">1-3,5</text>
    <text x="80" y="280" fill="#c83f79" font-size="32" font-weight="800">{t("sp.range")}</text>
  </g>
''' + caption(t("sp.cap")), T["sp.rangeT"][loc])
    out["add-watermark.svg"] = svg(1280, 720, heading(t("wm.title")) + f'''
  <g font-family="{FONT}">
    <rect x="80" y="150" width="520" height="380" rx="24" fill="#ffe4ee"/>
    <text x="120" y="230" fill="#a13f6c" font-size="22" font-weight="700">{t("wm.corner")}</text>
    <rect x="430" y="430" width="120" height="50" rx="8" fill="#c83f79" opacity="0.55"/>
    <rect x="680" y="150" width="520" height="380" rx="24" fill="#fff" stroke="#f7b6cb" stroke-width="3"/>
    <text x="720" y="230" fill="#a13f6c" font-size="22" font-weight="700">{t("wm.tile")}</text>
    <g fill="#c83f79" opacity="0.35" font-size="20">
      <text x="740" y="300" transform="rotate(-24 740 300)">SHOP</text>
      <text x="860" y="380" transform="rotate(-24 860 380)">SHOP</text>
      <text x="780" y="460" transform="rotate(-24 780 460)">SHOP</text>
    </g>
  </g>
''' + caption(t("wm.cap"), 620, 80), T["wm.title"][loc])
    out["add-watermark-place.svg"] = svg(960, 540, heading(t("wm.place"), 28)
        + card(50, 110, 410, 300, t("wm.corner"), [t("wm.tile")])
        + card(500, 110, 410, 300, t("wm.tile"), [t("wm.corner")], True)
        + caption(t("wm.cap")), T["wm.place"][loc])
    out["add-watermark-opacity.svg"] = svg(960, 540, heading(t("wm.op"), 28) + f'''
  <g font-family="{FONT}">
    <rect x="70" y="140" width="820" height="240" rx="22" fill="#fff" stroke="#f7b6cb" stroke-width="3"/>
    <text x="110" y="250" fill="#59364b" font-size="24">{t("wm.op")}</text>
  </g>
''' + caption(t("wm.cap")), T["wm.op"][loc])
    out["remove-exif.svg"] = svg(1280, 720, heading(t("ex.title")) + f'''
  <g font-family="{FONT}">
    <rect x="90" y="160" width="420" height="360" rx="24" fill="#ffe4ee" stroke="#c83f79" stroke-width="4"/>
    <text x="130" y="280" fill="#a13f6c" font-size="26" font-weight="700">{t("ex.plus")}</text>
    <path d="M560 330 h80" stroke="#c83f79" stroke-width="10" stroke-linecap="round"/>
    <polygon points="640,310 700,330 640,350" fill="#c83f79"/>
    <rect x="730" y="160" width="460" height="360" rx="24" fill="#fff" stroke="#c83f79" stroke-width="4"/>
    <text x="770" y="280" fill="#a13f6c" font-size="26" font-weight="700">{t("ex.only")}</text>
  </g>
''' + caption(t("ex.cap"), 640, 90), T["ex.title"][loc])
    out["remove-exif-gps.svg"] = svg(960, 540, heading(t("ex.gps"), 28) + f'''
  <g font-family="{FONT}">
    <text x="80" y="220" fill="#59364b" font-size="24">{t("ex.plus")}</text>
    <text x="80" y="300" fill="#c83f79" font-size="32" font-weight="800">→ {t("ex.only")}</text>
  </g>
''' + caption(t("ex.cap")), T["ex.gps"][loc])
    out["remove-exif-check.svg"] = svg(960, 540, heading(t("ex.check"), 28) + f'''
  <g font-family="{FONT}" font-size="20" fill="#59364b">
    <rect x="70" y="130" width="820" height="90" rx="18" fill="#ffe4ee" stroke="#c83f79" stroke-width="3"/>
    <text x="100" y="185">1  →  2  →  3</text>
    <text x="80" y="320">{t("ex.check")}</text>
  </g>
''' + caption(t("ex.cap")), T["ex.check"][loc])
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
