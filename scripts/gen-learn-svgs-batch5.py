#!/usr/bin/env python3
"""SVGs for PNG→WebP, MP3→WAV, join-audio, and favicon lessons."""
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


def heading(text, size=32) -> str:
    return f'<text x="48" y="54" fill="{DEEP}" font-size="{size}" font-weight="800" font-family="{FONT}">{text}</text>'


def caption(text, y=500, x=48) -> str:
    return f'<text x="{x}" y="{y}" fill="{MUTED}" font-size="18" font-family="{FONT}">{text}</text>'


def card(x, y, w, h, title, line, accent=False) -> str:
    fill, stroke = (SOFT, PINK) if accent else (CARD, LINE)
    return f'''
  <rect x="{x}" y="{y}" width="{w}" height="{h}" rx="22" fill="{fill}" stroke="{stroke}" stroke-width="3"/>
  <text x="{x + 28}" y="{y + 48}" fill="{DEEP}" font-size="24" font-weight="700" font-family="{FONT}">{title}</text>
  <text x="{x + 28}" y="{y + 88}" fill="{INK}" font-size="18" font-family="{FONT}">{line}</text>
'''


T = {
    "pw.title": pack("How to convert PNG to WebP", "怎么把 PNG 转成 WebP", "怎麼把 PNG 轉成 WebP", "PNGをWebPにする", "PNG를 WebP로", "Cách đổi PNG sang WebP", "Cara ubah PNG ke WebP", "Cómo pasar PNG a WebP"),
    "pw.png": pack("PNG · larger · alpha", "PNG · 更大 · 透明", "PNG · 更大 · 透明", "PNG · 大きい · 透明", "PNG · 더 큼 · 투명", "PNG · nặng · alpha", "PNG · lebih besar · alpha", "PNG · más pesado · alfa"),
    "pw.webp": pack("WebP · smaller · alpha", "WebP · 更小 · 透明", "WebP · 更小 · 透明", "WebP · 小さい · 透明", "WebP · 더 작음 · 투명", "WebP · nhẹ · alpha", "WebP · lebih kecil · alpha", "WebP · más liviano · alfa"),
    "pw.cap": pack("WebP can keep a clear background. JPG cannot. Old forms may still want PNG.", "WebP 能留透明。JPG 不行。老表单可能仍要 PNG。", "WebP 能留透明。JPG 不行。老表單可能仍要 PNG。", "WebPは透明を残せる。JPGは不可。古い提出はまだPNG。", "WebP는 투명을 남깁니다. JPG는 안 됩니다. 옛 서류는 아직 PNG일 수 있습니다.", "WebP giữ nền trong. JPG thì không. Form cũ vẫn có thể cần PNG.", "WebP jaga latar tembus. JPG tidak. Formulir lama mungkin masih PNG.", "WebP puede conservar el fondo. JPG no. Los formularios viejos aún pueden pedir PNG."),
    "pw.why": pack("WebP is smaller than PNG and can keep a clear background.", "WebP 比 PNG 小，还能留透明。", "WebP 比 PNG 小，還能留透明。", "WebPはPNGより小さく透明も残せる。", "WebP는 PNG보다 작고 투명을 남길 수 있습니다.", "WebP nhẹ hơn PNG và giữ nền trong.", "WebP lebih kecil dari PNG dan bisa jaga latar tembus.", "WebP pesa menos que PNG y puede conservar el fondo."),
    "pw.alpha": pack("Pick WebP to keep alpha. JPG fills it in.", "要透明就选 WebP。JPG 会填死。", "要透明就選 WebP。JPG 會填死。", "透明ならWebP。JPGは埋める。", "투명이면 WebP. JPG는 메웁니다.", "Cần trong thì chọn WebP. JPG sẽ lấp.", "Butuh alpha: pilih WebP. JPG mengisi.", "Elija WebP para el alfa. JPG lo rellena."),
    "mw.title": pack("How to convert MP3 to WAV", "怎么把 MP3 转成 WAV", "怎麼把 MP3 轉成 WAV", "MP3をWAVにする", "MP3를 WAV로", "Cách đổi MP3 sang WAV", "Cara ubah MP3 ke WAV", "Cómo pasar MP3 a WAV"),
    "mw.mp3": pack("MP3 · already lossy", "MP3 · 已经有损", "MP3 · 已經有損", "MP3 · すでに非可逆", "MP3 · 이미 손실", "MP3 · đã mất nét", "MP3 · sudah lossy", "MP3 · ya con pérdida"),
    "mw.wav": pack("WAV · uncompressed PCM", "WAV · 未压缩 PCM", "WAV · 未壓縮 PCM", "WAV · 非圧縮PCM", "WAV · 비압축 PCM", "WAV · PCM không nén", "WAV · PCM tanpa kompresi", "WAV · PCM sin comprimir"),
    "mw.cap": pack("Converting does not restore what MP3 threw away. Play the downloaded WAV.", "转回去找不回 MP3 丢掉的。播下载的 WAV。", "轉回去找不回 MP3 丟掉的。播下載的 WAV。", "MP3が捨てたものは戻らない。保存したWAVを再生。", "MP3가 버린 것은 안 돌아옵니다. 받은 WAV를 재생하세요.", "Đổi lại không lấy được những gì MP3 bỏ. Phát WAV đã tải.", "Konversi tidak mengembalikan yang dibuang MP3. Putar WAV unduhan.", "Convertir no restaura lo que tiró el MP3. Reproduzca el WAV."),
    "mw.why": pack("WAV is uncompressed. MP3 already threw data away.", "WAV 未压缩。MP3 已经丢掉数据。", "WAV 未壓縮。MP3 已經丟掉資料。", "WAVは非圧縮。MP3はすでに捨てている。", "WAV는 비압축. MP3는 이미 버린 데이터가 있습니다.", "WAV không nén. MP3 đã bỏ dữ liệu.", "WAV tanpa kompresi. MP3 sudah membuang data.", "WAV no está comprimido. El MP3 ya tiró datos."),
    "mw.rate": pack("44.1 kHz for music · 48 kHz for video", "音乐 44.1 kHz · 视频 48 kHz", "音樂 44.1 kHz · 影片 48 kHz", "音楽44.1kHz · 映像48kHz", "음악 44.1kHz · 영상 48kHz", "Nhạc 44.1 kHz · video 48 kHz", "Musik 44.1 kHz · video 48 kHz", "Música 44.1 kHz · vídeo 48 kHz"),
    "ja.title": pack("How to join audio files / merge MP3s", "怎么拼接音频 / 合并 MP3", "怎麼拼接音訊 / 合併 MP3", "音声をつなぐ / MP3を結合", "오디오 이어붙이기 / MP3 합치기", "Cách ghép audio / gộp MP3", "Cara gabung audio / gabung MP3", "Cómo unir archivos de audio"),
    "ja.a": pack("1", "1", "1", "1", "1", "1", "1", "1"),
    "ja.b": pack("2", "2", "2", "2", "2", "2", "2", "2"),
    "ja.cap": pack("List order is playback order. You need two or more. Export is one WAV.", "列表顺序就是播放顺序。至少两段。导出一份 WAV。", "列表順序就是播放順序。至少兩段。匯出一份 WAV。", "リスト順が再生順。2本以上。WAVを1つ。", "목록 순서가 재생 순서. 두 개 이상. WAV 하나.", "Thứ tự list là thứ tự phát. Cần từ hai đoạn. Một WAV.", "Urutan daftar = urutan putar. Minimal dua. Satu WAV.", "El orden de la lista es el de reproducción. Dos o más. Un WAV."),
    "ja.order": pack("List order is playback order. You need two or more clips.", "列表顺序就是播放顺序。至少两段。", "列表順序就是播放順序。至少兩段。", "リスト順が再生順。2本以上。", "목록 순서가 재생 순서. 두 개 이상.", "Thứ tự list là thứ tự phát. Cần từ hai đoạn.", "Urutan daftar = urutan putar. Minimal dua klip.", "El orden de la lista es el de reproducción. Dos o más."),
    "ja.rate": pack("Later clips match the first clip's sample rate. Export is WAV.", "后面的对齐第一段的采样率。导出是 WAV。", "後面的對齊第一段的取樣率。匯出是 WAV。", "後続は先頭の周波数に合わせる。書き出しはWAV。", "뒤 클립은 첫 클립의 레이트에 맞춥니다. 보낸 파일은 WAV.", "Đoạn sau khớp tần số đoạn đầu. Xuất WAV.", "Klip berikutnya mengikuti rate klip pertama. Ekspor WAV.", "Los siguientes coinciden con la frecuencia del primero. La exportación es WAV."),
    "fv.title": pack("How to make a favicon", "怎么做网站图标 / favicon", "怎麼做網站圖示 / favicon", "ファビコンの作り方", "파비콘 만드는 법", "Cách làm favicon", "Cara buat favicon", "Cómo hacer un favicon"),
    "fv.cover": pack("Cover · may crop", "Cover · 可能裁切", "Cover · 可能裁切", "Cover · 切ることがある", "Cover · 자를 수 있음", "Cover · có thể cắt", "Cover · bisa memotong", "Cover · puede recortar"),
    "fv.contain": pack("Contain · letterbox", "Contain · 留边", "Contain · 留邊", "Contain · 余白", "Contain · 여백", "Contain · có lề", "Contain · ada bar", "Contain · bandas"),
    "fv.cap": pack("ICO is 16/32/48. PNG zip adds 180/192/512. Check the 16px file.", "ICO 是 16/32/48。PNG 压缩包还有 180/192/512。看 16 像素那份。", "ICO 是 16/32/48。PNG 壓縮檔還有 180/192/512。看 16 像素那份。", "ICOは16/32/48。PNGのZIPに180/192/512。16pxを見る。", "ICO는 16/32/48. PNG zip에 180/192/512. 16px 파일을 보세요.", "ICO là 16/32/48. Zip PNG thêm 180/192/512. Xem file 16px.", "ICO 16/32/48. Zip PNG menambah 180/192/512. Cek file 16px.", "El ICO es 16/32/48. El zip PNG añade 180/192/512. Mire el de 16 px."),
    "fv.fit": pack("Cover fills and may crop. Contain keeps the whole mark.", "Cover 铺满，可能裁切。Contain 放下整个标志。", "Cover 鋪滿，可能裁切。Contain 放下整個標誌。", "Coverは埋めて切ることがある。Containは全体。", "Cover는 채우며 자를 수 있습니다. Contain은 전체.", "Cover lấp ô, có thể cắt. Contain giữ cả dấu.", "Cover mengisi, bisa memotong. Contain menjaga seluruh tanda.", "Cover llena y puede recortar. Contain deja la marca entera."),
    "fv.sizes": pack("ICO 16/32/48 · PNG zip 180/192/512 · check 16px", "ICO 16/32/48 · PNG 包 180/192/512 · 看 16px", "ICO 16/32/48 · PNG 包 180/192/512 · 看 16px", "ICO 16/32/48 · PNG ZIP 180/192/512 · 16pxを見る", "ICO 16/32/48 · PNG zip 180/192/512 · 16px 확인", "ICO 16/32/48 · zip PNG 180/192/512 · xem 16px", "ICO 16/32/48 · zip PNG 180/192/512 · cek 16px", "ICO 16/32/48 · zip PNG 180/192/512 · mire 16 px"),
}


def files_for(loc: str) -> dict[str, str]:
    t = lambda k: tx(loc, T[k])
    out: dict[str, str] = {}
    out["png-to-webp.svg"] = svg(1280, 720, heading(t("pw.title")) + card(80, 140, 520, 280, "PNG", t("pw.png")) + card(680, 140, 520, 280, "WebP", t("pw.webp"), True) + caption(t("pw.cap"), 520, 80), T["pw.title"][loc])
    out["png-to-webp-why.svg"] = svg(960, 540, heading(t("pw.why"), 24) + card(70, 120, 380, 240, "PNG", t("pw.png")) + card(500, 120, 390, 240, "WebP", t("pw.webp"), True) + caption(t("pw.cap")), T["pw.why"][loc])
    out["png-to-webp-alpha.svg"] = svg(960, 540, heading(t("pw.alpha"), 24) + card(70, 130, 820, 220, "WebP ≠ JPG", t("pw.alpha"), True) + caption(t("pw.cap")), T["pw.alpha"][loc])
    out["mp3-to-wav.svg"] = svg(1280, 720, heading(t("mw.title")) + card(80, 140, 520, 280, "MP3", t("mw.mp3")) + card(680, 140, 520, 280, "WAV", t("mw.wav"), True) + caption(t("mw.cap"), 520, 80), T["mw.title"][loc])
    out["mp3-to-wav-why.svg"] = svg(960, 540, heading(t("mw.why"), 24) + card(70, 130, 820, 220, "MP3 → WAV", t("mw.why"), True) + caption(t("mw.cap")), T["mw.why"][loc])
    out["mp3-to-wav-rate.svg"] = svg(960, 540, heading(t("mw.rate"), 26) + card(70, 130, 820, 220, t("mw.rate"), t("mw.cap"), True) + caption(t("mw.cap")), T["mw.rate"][loc])
    out["join-audio.svg"] = svg(1280, 720, heading(t("ja.title")) + f'''
  <g font-family="{FONT}">
    <rect x="120" y="160" width="280" height="160" rx="20" fill="{SOFT}" stroke="{PINK}" stroke-width="4"/>
    <text x="260" y="255" text-anchor="middle" fill="{DEEP}" font-size="40" font-weight="800">1</text>
    <text x="430" y="255" fill="{PINK}" font-size="40" font-weight="800">+</text>
    <rect x="500" y="160" width="280" height="160" rx="20" fill="{SOFT}" stroke="{PINK}" stroke-width="4"/>
    <text x="640" y="255" text-anchor="middle" fill="{DEEP}" font-size="40" font-weight="800">2</text>
    <text x="810" y="255" fill="{PINK}" font-size="40" font-weight="800">→</text>
    <rect x="880" y="160" width="280" height="160" rx="20" fill="#fff" stroke="#f7b6cb" stroke-width="4"/>
    <text x="1020" y="255" text-anchor="middle" fill="{DEEP}" font-size="28" font-weight="800">WAV</text>
  </g>
''' + caption(t("ja.cap"), 420, 80), T["ja.title"][loc])
    out["join-audio-order.svg"] = svg(960, 540, heading(t("ja.order"), 24) + card(70, 130, 820, 220, "1 → 2 → WAV", t("ja.order"), True) + caption(t("ja.cap")), T["ja.order"][loc])
    out["join-audio-rate.svg"] = svg(960, 540, heading(t("ja.rate"), 22) + card(70, 130, 820, 220, "WAV", t("ja.rate"), True) + caption(t("ja.cap")), T["ja.rate"][loc])
    out["make-favicon.svg"] = svg(1280, 720, heading(t("fv.title")) + f'''
  <g font-family="{FONT}">
    <rect x="140" y="140" width="280" height="280" rx="24" fill="{SOFT}" stroke="{PINK}" stroke-width="4"/>
    <circle cx="280" cy="280" r="70" fill="{PINK}"/>
    <text x="280" y="460" text-anchor="middle" fill="{DEEP}" font-size="20">{t("fv.cover")}</text>
    <rect x="500" y="180" width="200" height="200" rx="20" fill="#fff" stroke="#f7b6cb" stroke-width="4"/>
    <circle cx="600" cy="280" r="48" fill="{PINK}"/>
    <text x="600" y="460" text-anchor="middle" fill="{DEEP}" font-size="20">32</text>
    <rect x="780" y="220" width="120" height="120" rx="16" fill="#fff" stroke="#f7b6cb" stroke-width="4"/>
    <circle cx="840" cy="280" r="28" fill="{PINK}"/>
    <text x="840" y="460" text-anchor="middle" fill="{DEEP}" font-size="20">16</text>
  </g>
''' + caption(t("fv.cap"), 530, 80), T["fv.title"][loc])
    out["make-favicon-fit.svg"] = svg(960, 540, heading(t("fv.fit"), 24) + card(70, 120, 380, 240, "Cover", t("fv.cover"), True) + card(500, 120, 390, 240, "Contain", t("fv.contain")) + caption(t("fv.cap")), T["fv.fit"][loc])
    out["make-favicon-sizes.svg"] = svg(960, 540, heading(t("fv.sizes"), 22) + card(70, 130, 820, 220, "ICO · PNG zip", t("fv.sizes"), True) + caption(t("fv.cap")), T["fv.sizes"][loc])
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
