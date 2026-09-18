#!/usr/bin/env python3
"""SVGs for PNG↔JPG, AVIF→JPG, and rotate/flip lessons."""
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
    "pj.title": pack("How to convert PNG to JPG", "怎么把 PNG 转成 JPG", "怎麼把 PNG 轉成 JPG", "PNGをJPGにする", "PNG를 JPG로", "Cách đổi PNG sang JPG", "Cara ubah PNG ke JPG", "Cómo pasar PNG a JPG"),
    "pj.png": pack("PNG · sharp · alpha", "PNG · 利 · 透明", "PNG · 利 · 透明", "PNG · Sharp · 透明", "PNG · 선명 · 투명", "PNG · nét · alpha", "PNG · tajam · alpha", "PNG · nítido · alfa"),
    "pj.jpg": pack("JPG · smaller · no alpha", "JPG · 更小 · 无透明", "JPG · 更小 · 無透明", "JPG · 小さい · アルファなし", "JPG · 더 작음 · 알파 없음", "JPG · nhẹ · không alpha", "JPG · lebih kecil · tanpa alpha", "JPG · más liviano · sin alfa"),
    "pj.cap": pack("A clear PNG background becomes a solid matte in JPG, often black.", "透明 PNG 转成 JPG 会变成实色，常常是黑底。", "透明 PNG 轉成 JPG 會變成實色，常常是黑底。", "透明PNGはJPGで塗りつぶされ、多くは黒。", "투명 PNG는 JPG에서 단색(종종 검정)이 됩니다.", "Nền PNG trong thành đặc trong JPG, thường đen.", "Latar PNG tembus jadi solid di JPG, sering hitam.", "El fondo PNG transparente se rellena en JPG, a menudo de negro."),
    "pj.why": pack("PNG keeps sharpness and transparency. JPG is smaller.", "PNG 保边缘和透明。JPG 更小。", "PNG 保邊緣和透明。JPG 更小。", "PNGはSharpと透明。JPGは小さい。", "PNG는 선명도와 투명. JPG는 더 작습니다.", "PNG giữ nét và nền trong. JPG nhẹ hơn.", "PNG jaga ketajaman dan transparansi. JPG lebih kecil.", "PNG conserva nitidez y transparencia. JPG pesa menos."),
    "pj.matte": pack("JPG fills the clear area, often black", "JPG 会填死透明处，常常是黑的", "JPG 會填死透明處，常常是黑的", "JPGは透明を埋め、多くは黒", "JPG는 투명 부분을 메우며 종종 검정", "JPG lấp vùng trong, thường đen", "JPG mengisi area tembus, sering hitam", "JPG rellena el área clara, a menudo de negro"),
    "jp.title": pack("How to convert JPG to PNG", "怎么把 JPG 转成 PNG", "怎麼把 JPG 轉成 PNG", "JPGをPNGにする", "JPG를 PNG로", "Cách đổi JPG sang PNG", "Cara ubah JPG ke PNG", "Cómo pasar JPG a PNG"),
    "jp.jpg": pack("JPG · already lossy", "JPG · 已经有损", "JPG · 已經有損", "JPG · すでに非可逆", "JPG · 이미 손실", "JPG · đã mất nét", "JPG · sudah lossy", "JPG · ya con pérdida"),
    "jp.png": pack("PNG · still opaque", "PNG · 仍然实底", "PNG · 仍然實底", "PNG · 不透明のまま", "PNG · 여전히 불투명", "PNG · vẫn đặc", "PNG · tetap buram", "PNG · sigue opaco"),
    "jp.cap": pack("Converting JPG to PNG does not make the background transparent.", "JPG 转 PNG 不会把背景变成透明。", "JPG 轉 PNG 不會把背景變成透明。", "JPG→PNGでは背景は透明にならない。", "JPG를 PNG로 바꾼다고 배경이 투명이 되지 않습니다.", "Đổi JPG sang PNG không làm nền trong.", "JPG ke PNG tidak membuat latar tembus.", "Pasar JPG a PNG no vuelve transparente el fondo."),
    "jp.why": pack("JPG is already lossy. PNG will not restore detail.", "JPG 已经有损。转成 PNG 不会找回细节。", "JPG 已經有損。轉成 PNG 不會找回細節。", "JPGはすでに非可逆。PNGにしても細部は戻らない。", "JPG는 이미 손실. PNG로 바꿔도 디테일은 안 돌아옵니다.", "JPG đã mất nét. Đổi PNG không lấy lại chi tiết.", "JPG sudah lossy. PNG tidak mengembalikan detail.", "JPG ya es con pérdida. PNG no recupera detalle."),
    "jp.myth": pack("No hole appears in the background", "背景不会出现透明洞", "背景不會出現透明洞", "背景に穴は開かない", "배경에 구멍이 생기지 않음", "Nền không thủng trong", "Latar tidak bolong", "No aparece un hueco en el fondo"),
    "av.title": pack("How to convert AVIF to JPG", "怎么把 AVIF 转成 JPG", "怎麼把 AVIF 轉成 JPG", "AVIFをJPGにする", "AVIF를 JPG로", "Cách đổi AVIF sang JPG", "Cara ubah AVIF ke JPG", "Cómo pasar AVIF a JPG"),
    "av.avif": pack("AVIF · smaller", "AVIF · 更小", "AVIF · 更小", "AVIF · 小さい", "AVIF · 더 작음", "AVIF · nhẹ hơn", "AVIF · lebih kecil", "AVIF · más liviano"),
    "av.jpg": pack("JPG · opens more places", "JPG · 更通用", "JPG · 更通用", "JPG · 通る", "JPG · 더 통함", "JPG · phổ biến hơn", "JPG · lebih diterima", "JPG · se acepta más"),
    "av.cap": pack("Chrome saves AVIF. Export JPG for older Windows, print, and chat.", "Chrome 存 AVIF。导出 JPG 给老 Windows、打印店和聊天。", "Chrome 存 AVIF。匯出 JPG 給老 Windows、列印店和聊天。", "ChromeはAVIF。古いWindows・印刷・チャットにはJPG。", "Chrome은 AVIF를 저장. 옛 Windows·인쇄·채팅에는 JPG.", "Chrome lưu AVIF. Xuất JPG cho Windows cũ, in, chat.", "Chrome simpan AVIF. Ekspor JPG untuk Windows lama, cetak, chat.", "Chrome guarda AVIF. Exporte JPG para Windows viejo, imprenta y chat."),
    "av.why": pack("AVIF is smaller. JPG opens on older Windows, print, and chat.", "AVIF 更小。JPG 在老 Windows、打印店和聊天里打得开。", "AVIF 更小。JPG 在老 Windows、列印店和聊天裡打得開。", "AVIFは小さい。JPGは古いWindows、印刷、チャットで開く。", "AVIF는 더 작고 JPG는 옛 Windows, 인쇄, 채팅에서 열립니다.", "AVIF nhẹ hơn. JPG mở trên Windows cũ, in, chat.", "AVIF lebih kecil. JPG terbuka di Windows lama, cetak, chat.", "AVIF pesa menos. JPG abre en Windows viejo, imprenta y chat."),
    "av.do": pack("Drop AVIF · pick JPG · open on the destination", "拖入 AVIF · 选 JPG · 到对方那里打开", "拖入 AVIF · 選 JPG · 到對方那裡打開", "AVIFを入れ · JPGを選び · 先で開く", "AVIF 넣기 · JPG 고르기 · 상대에서 열기", "Thả AVIF · chọn JPG · mở ở đích", "Letakkan AVIF · pilih JPG · buka di tujuan", "Suelte AVIF · elija JPG · ábralo en el destino"),
    "ro.title": pack("How to rotate or flip a photo", "怎么旋转或翻转照片", "怎麼旋轉或翻轉照片", "写真の回転と反転", "사진 회전·뒤집기", "Cách xoay hoặc lật ảnh", "Cara putar atau balik foto", "Cómo rotar o voltear una foto"),
    "ro.rot": pack("90° · 180°", "90° · 180°", "90° · 180°", "90° · 180°", "90° · 180°", "90° · 180°", "90° · 180°", "90° · 180°"),
    "ro.flip": pack("Flip = mirror", "翻转 = 镜子", "翻轉 = 鏡子", "反転 = 鏡", "뒤집기 = 거울", "Lật = gương", "Balik = cermin", "Voltear = espejo"),
    "ro.cap": pack("Rotate turns the photo. Flip is a mirror. Export writes pixels.", "旋转是转向。翻转是镜子。导出会把方向写进像素。", "旋轉是轉向。翻轉是鏡子。匯出會把方向寫進像素。", "回転は向き。反転は鏡。書き出しは画素に焼く。", "회전은 방향. 뒤집기는 거울. 보내면 픽셀에 들어갑니다.", "Xoay là quay. Lật là gương. Xuất ghi vào pixel.", "Putar memutar. Balik cermin. Ekspor menulis piksel.", "Rotar gira. Voltear es un espejo. Exportar escribe píxeles."),
    "ro.vs": pack("Rotate 90° / 180° turns the photo. Flip is a mirror.", "旋转 90°/180° 是转向。翻转是镜子。", "旋轉 90°/180° 是轉向。翻轉是鏡子。", "90°/180°は向き。反転は鏡。", "90°/180°는 방향을 돌림. 뒤집기는 거울.", "Xoay 90°/180° là quay. Lật là gương.", "Putar 90°/180° memutar. Balik adalah cermin.", "Rotar 90° / 180° gira. Voltear es un espejo."),
    "ro.bake": pack("Open the file. EXIF-only sideways photos become actually upright.", "打开文件。只有方向信息是横的图会真正立正。", "打開檔。只有方向資訊是橫的圖會真正立正。", "ファイルを開く。EXIFだけ横の写真が本当に正立する。", "파일을 여세요. EXIF만 가로였던 사진이 실제로 바로 섭니다.", "Mở file. Ảnh chỉ lệch vì EXIF sẽ đứng thật.", "Buka file. Foto yang miring hanya karena EXIF jadi tegak.", "Abra el archivo. Las fotos de lado solo por EXIF quedan derechas."),
}


def files_for(loc: str) -> dict[str, str]:
    t = lambda k: tx(loc, T[k])
    out: dict[str, str] = {}
    out["png-to-jpg.svg"] = svg(1280, 720, heading(t("pj.title")) + card(80, 140, 520, 280, "PNG", t("pj.png")) + card(680, 140, 520, 280, "JPG", t("pj.jpg"), True) + caption(t("pj.cap"), 520, 80), T["pj.title"][loc])
    out["png-to-jpg-why.svg"] = svg(960, 540, heading(t("pj.why"), 26) + card(70, 120, 380, 240, "PNG", t("pj.png")) + card(500, 120, 390, 240, "JPG", t("pj.jpg"), True) + caption(t("pj.cap")), T["pj.why"][loc])
    out["png-to-jpg-matte.svg"] = svg(960, 540, heading(t("pj.matte"), 24) + f'''
  <g font-family="{FONT}">
    <rect x="80" y="140" width="360" height="240" rx="20" fill="{SOFT}" stroke="{PINK}" stroke-width="3"/>
    <circle cx="260" cy="260" r="54" fill="none" stroke="{PINK}" stroke-width="8" stroke-dasharray="10 8"/>
    <text x="260" y="420" text-anchor="middle" fill="{DEEP}" font-size="18">PNG</text>
    <rect x="520" y="140" width="360" height="240" rx="20" fill="#1b1216" stroke="{PINK}" stroke-width="3"/>
    <circle cx="700" cy="260" r="54" fill="{PINK}"/>
    <text x="700" y="420" text-anchor="middle" fill="{DEEP}" font-size="18">JPG</text>
  </g>
''' + caption(t("pj.cap")), T["pj.matte"][loc])
    out["jpg-to-png.svg"] = svg(1280, 720, heading(t("jp.title")) + card(80, 140, 520, 280, "JPG", t("jp.jpg")) + card(680, 140, 520, 280, "PNG", t("jp.png"), True) + caption(t("jp.cap"), 520, 80), T["jp.title"][loc])
    out["jpg-to-png-why.svg"] = svg(960, 540, heading(t("jp.why"), 26) + card(70, 130, 820, 220, "JPG → PNG", t("jp.why"), True) + caption(t("jp.cap")), T["jp.why"][loc])
    out["jpg-to-png-myth.svg"] = svg(960, 540, heading(t("jp.myth"), 26) + f'''
  <g font-family="{FONT}">
    <rect x="80" y="130" width="800" height="240" rx="22" fill="#fff" stroke="#f7b6cb" stroke-width="3"/>
    <text x="120" y="240" fill="{INK}" font-size="24">{t("jp.myth")}</text>
    <text x="120" y="290" fill="{MUTED}" font-size="18">{t("jp.cap")}</text>
  </g>
''' + caption(t("jp.cap")), T["jp.myth"][loc])
    out["avif-to-jpg.svg"] = svg(1280, 720, heading(t("av.title")) + card(80, 140, 520, 280, "AVIF", t("av.avif")) + card(680, 140, 520, 280, "JPG", t("av.jpg"), True) + caption(t("av.cap"), 520, 80), T["av.title"][loc])
    out["avif-to-jpg-why.svg"] = svg(960, 540, heading(t("av.why"), 24) + card(70, 120, 380, 240, "AVIF", t("av.avif")) + card(500, 120, 390, 240, "JPG", t("av.jpg"), True) + caption(t("av.cap")), T["av.why"][loc])
    out["avif-to-jpg-do.svg"] = svg(960, 540, heading(t("av.do"), 24) + card(70, 130, 820, 220, "AVIF → JPG", t("av.do"), True) + caption(t("av.cap")), T["av.do"][loc])
    out["rotate-photo.svg"] = svg(1280, 720, heading(t("ro.title")) + f'''
  <g font-family="{FONT}">
    <rect x="120" y="150" width="200" height="280" rx="18" fill="{SOFT}" stroke="{PINK}" stroke-width="4"/>
    <text x="220" y="300" text-anchor="middle" fill="{DEEP}" font-size="22" font-weight="700">90°</text>
    <rect x="420" y="200" width="280" height="180" rx="18" fill="{SOFT}" stroke="{PINK}" stroke-width="4"/>
    <text x="560" y="305" text-anchor="middle" fill="{DEEP}" font-size="22" font-weight="700">180°</text>
    <rect x="800" y="150" width="200" height="280" rx="18" fill="#fff" stroke="#f7b6cb" stroke-width="4"/>
    <text x="900" y="290" text-anchor="middle" fill="{DEEP}" font-size="20" font-weight="700">{t("ro.flip")}</text>
  </g>
''' + caption(t("ro.cap"), 520, 80), T["ro.title"][loc])
    out["rotate-photo-turn.svg"] = svg(960, 540, heading(t("ro.vs"), 24) + card(70, 120, 380, 240, t("ro.rot"), t("ro.vs")) + card(500, 120, 390, 240, t("ro.flip"), t("ro.flip"), True) + caption(t("ro.cap")), T["ro.vs"][loc])
    out["rotate-photo-bake.svg"] = svg(960, 540, heading(t("ro.bake"), 22) + card(70, 130, 820, 220, "EXIF → pixels", t("ro.bake"), True) + caption(t("ro.cap")), T["ro.bake"][loc])
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
