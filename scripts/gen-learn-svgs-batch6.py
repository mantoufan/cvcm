#!/usr/bin/env python3
"""SVGs for signature, screenshot, invoice, and password lessons."""
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
    "sg.title": pack("How to draw a signature PNG", "怎么手写签名 PNG", "怎麼手寫簽名 PNG", "署名PNGの描き方", "서명 PNG 그리는 법", "Cách vẽ chữ ký PNG", "Cara gambar tanda tangan PNG", "Cómo dibujar una firma PNG"),
    "sg.pic": pack("A picture of a name", "名字的图", "名字的圖", "名前の絵", "이름의 그림", "Ảnh chữ tên", "Gambar nama", "Imagen del nombre"),
    "sg.not": pack("Not a legal e-sign", "不是法律电子签", "不是法律電子簽", "法的電子署名ではない", "법적 전자서명 아님", "Không phải chữ ký điện tử pháp lý", "Bukan e-sign legal", "No es e-sign legal"),
    "sg.cap": pack("Export crops to the ink. The PNG background is clear. Check it at form size.", "导出会按墨迹裁切。PNG 底透明。按表单那么大看。", "匯出會按墨跡裁切。PNG 底透明。按表單那麼大看。", "書き出しはインクに切る。背景は透明。欄の大きさで見る。", "보내면 잉크에 맞춰 자릅니다. 배경은 투명. 서류 크기로 보세요.", "Xuất cắt theo nét. Nền PNG trong. Xem cỡ form.", "Ekspor memotong ke tinta. Latar tembus. Cek seukuran formulir.", "Exportar recorta a la tinta. Fondo transparente. Mírelo al tamaño del formulario."),
    "sg.legal": pack("This is a picture of a name. It does not bind a PDF.", "这是名字的图。不会给 PDF 赋予效力。", "這是名字的圖。不會給 PDF 賦予效力。", "名前の絵。PDFを拘束しない。", "이름의 그림. PDF를 구속하지 않습니다.", "Ảnh chữ tên. Không ràng PDF.", "Gambar nama. Tidak mengikat PDF.", "Una imagen del nombre. No vincula un PDF."),
    "sg.crop": pack("Cropped to the ink · clear background", "按墨迹裁切 · 透明底", "按墨跡裁切 · 透明底", "インクに切り抜き · 透明", "잉크에 맞춤 · 투명 배경", "Cắt theo nét · nền trong", "Terpotong ke tinta · latar tembus", "Recortado a la tinta · fondo transparente"),
    "sc.title": pack("How to annotate a screenshot", "怎么给截图做标注", "怎麼給截圖做標註", "スクリーンショットの注釈", "스크린샷 주석 다는 법", "Cách chú thích ảnh chụp màn hình", "Cara anotasi tangkapan layar", "Cómo anotar una captura"),
    "sc.box": pack("Box", "框", "框", "枠", "상자", "Khung", "Kotak", "Recuadro"),
    "sc.arrow": pack("Arrow", "箭头", "箭頭", "矢印", "화살표", "Mũi tên", "Panah", "Flecha"),
    "sc.text": pack("Two words", "两个词", "兩個詞", "2語", "두 단어", "Hai từ", "Dua kata", "Dos palabras"),
    "sc.cap": pack("Box the broken control. Arrow the tap. Check at chat size.", "坏掉的控件套框。要点的画箭头。按聊天那么大看。", "壞掉的控制項套框。要點的畫箭頭。按聊天那麼大看。", "壊れた操作は枠。タップは矢印。チャットの大きさで見る。", "깨진 컨트롤은 상자. 탭은 화살표. 채팅 크기로 보세요.", "Điều khiển hỏng thì khung. Chỗ bấm thì mũi tên. Xem cỡ chat.", "Kontrol rusak: kotak. Ketukan: panah. Cek seukuran chat.", "Recuadre el control roto. Flecha en el toque. Mírelo al tamaño de un chat."),
    "sc.marks": pack("Box · arrow · two words, not a paragraph", "框 · 箭头 · 两个词，不要一段", "框 · 箭頭 · 兩個詞，不要一段", "枠・矢印・2語。段落を書かない", "상자 · 화살표 · 두 단어, 문단 금지", "Khung · mũi tên · hai từ, đừng một đoạn", "Kotak · panah · dua kata, bukan paragraf", "Recuadro · flecha · dos palabras, no un párrafo"),
    "sc.png": pack("Export is PNG. Keep the unmarked original.", "导出是 PNG。没标的原图留下。", "匯出是 PNG。沒標的原圖留下。", "書き出しはPNG。無印の原版は残す。", "보낸 파일은 PNG. 표시 없는 원본을 남기세요.", "Xuất PNG. Giữ bản gốc chưa đánh.", "Ekspor PNG. Simpan asli tanpa tanda.", "La exportación es PNG. Conserve el original sin marcas."),
    "iv.title": pack("How to make an invoice PDF", "怎么做发票 PDF", "怎麼做發票 PDF", "請求書PDFの作り方", "인보이스 PDF 만드는 법", "Cách làm hóa đơn PDF", "Cara buat faktur PDF", "Cómo hacer una factura PDF"),
    "iv.from": pack("From", "卖方", "賣方", "差出人", "보내는 사람", "Bên bán", "Dari", "De"),
    "iv.to": pack("Bill-to", "买方", "買方", "宛先", "받는 사람", "Bên mua", "Tagih ke", "Facturar a"),
    "iv.line": pack("qty × price", "数量 × 单价", "數量 × 單價", "数量×単価", "수량×단가", "số lượng × đơn giá", "qty × harga", "cantidad × precio"),
    "iv.cap": pack("Tax is a percent of the subtotal. Open the PDF. This is not a tax return.", "税是小计的百分比。打开 PDF。这不是税务申报。", "稅是小計的百分比。打開 PDF。這不是稅務申報。", "税は小計の%。PDFを開く。税務申告ではない。", "세금은 소계의 퍼센트. PDF를 여세요. 세금 신고서가 아닙니다.", "Thuế là phần trăm tạm tính. Mở PDF. Không phải tờ khai thuế.", "Pajak adalah persen subtotal. Buka PDF. Bukan SPT pajak.", "El impuesto es un porcentaje del subtotal. Abra el PDF. No es una declaración fiscal."),
    "iv.lines": pack("From, bill-to, and one line per item.", "卖方、买方，每样东西一行。", "賣方、買方，每樣東西一行。", "差出人・宛先。1品1行。", "보내는 사람, 받는 사람, 품목마다 한 줄.", "Bên bán, bên mua, mỗi món một hàng.", "Dari, tagih ke, satu baris per barang.", "De, facturar a, y una línea por ítem."),
    "iv.tax": pack("Tax % of subtotal · not a tax return", "税是小计的% · 不是税务申报", "稅是小計的% · 不是稅務申報", "税は小計の% · 税務申告ではない", "세금은 소계의 % · 신고서가 아님", "Thuế % tạm tính · không phải tờ khai", "Pajak % subtotal · bukan SPT", "Impuesto % del subtotal · no es una declaración"),
    "pw.title": pack("How to generate a strong password", "怎么生成强密码", "怎麼生成強密碼", "強いパスワードの作り方", "강한 비밀번호 만드는 법", "Cách tạo mật khẩu mạnh", "Cara buat kata sandi kuat", "Cómo generar una contraseña fuerte"),
    "pw.len": pack("16+", "16+", "16+", "16+", "16+", "16+", "16+", "16+"),
    "pw.set": pack("letters · digits · symbols", "字母 · 数字 · 符号", "字母 · 數字 · 符號", "字母・数字・記号", "글자 · 숫자 · 기호", "chữ · số · ký hiệu", "huruf · angka · simbol", "letras · dígitos · símbolos"),
    "pw.cap": pack("Copy once. Paste into one account. Do not email it. Close the tab.", "复制一次。贴进一个账号。不要发邮件。关掉标签页。", "複製一次。貼進一個帳號。不要寄信。關掉分頁。", "一度コピー。1アカウントに貼る。メールしない。タブを閉じる。", "한 번 복사. 한 계정에 붙이기. 이메일 금지. 탭을 닫기.", "Copy một lần. Dán một tài khoản. Đừng email. Đóng tab.", "Salin sekali. Tempel satu akun. Jangan email. Tutup tab.", "Copie una vez. Péguela en una cuenta. No la envíe por correo. Cierre la pestaña."),
    "pw.rule": pack("Length 16+. Exclude 0 O I l 1 if you will type it.", "长度 16+。要手打就排除 0 O I l 1。", "長度 16+。要手打就排除 0 O I l 1。", "長さ16+。手入力なら0 O I l 1を除外。", "길이 16+. 직접 칠 거면 0 O I l 1을 빼세요.", "Dài 16+. Sẽ gõ tay thì loại 0 O I l 1.", "Panjang 16+. Akan diketik: kecualikan 0 O I l 1.", "Longitud 16+. Si la va a teclear, excluya 0 O I l 1."),
    "pw.copy": pack("Copy once · one account · close the tab", "复制一次 · 一个账号 · 关掉标签页", "複製一次 · 一個帳號 · 關掉分頁", "一度コピー · 1アカウント · タブを閉じる", "한 번 복사 · 한 계정 · 탭을 닫기", "Copy một lần · một tài khoản · đóng tab", "Salin sekali · satu akun · tutup tab", "Copie una vez · una cuenta · cierre la pestaña"),
}


def files_for(loc: str) -> dict[str, str]:
    t = lambda k: tx(loc, T[k])
    out: dict[str, str] = {}
    out["make-signature.svg"] = svg(1280, 720, heading(t("sg.title")) + card(80, 140, 520, 280, t("sg.pic"), t("sg.not")) + card(680, 140, 520, 280, "PNG", t("sg.crop"), True) + caption(t("sg.cap"), 520, 80), T["sg.title"][loc])
    out["make-signature-legal.svg"] = svg(960, 540, heading(t("sg.legal"), 24) + card(70, 130, 820, 220, t("sg.not"), t("sg.legal"), True) + caption(t("sg.cap")), T["sg.legal"][loc])
    out["make-signature-crop.svg"] = svg(960, 540, heading(t("sg.crop"), 24) + card(70, 130, 820, 220, "PNG", t("sg.crop"), True) + caption(t("sg.cap")), T["sg.crop"][loc])
    out["annotate-screenshot.svg"] = svg(1280, 720, heading(t("sc.title")) + f'''
  <g font-family="{FONT}">
    <rect x="140" y="140" width="320" height="240" rx="20" fill="#fff" stroke="{PINK}" stroke-width="5"/>
    <text x="300" y="275" text-anchor="middle" fill="{DEEP}" font-size="22">{t("sc.box")}</text>
    <line x1="520" y1="200" x2="720" y2="320" stroke="{PINK}" stroke-width="8" stroke-linecap="round"/>
    <polygon points="720,320 680,300 700,270" fill="{PINK}"/>
    <text x="620" y="420" text-anchor="middle" fill="{DEEP}" font-size="20">{t("sc.arrow")}</text>
    <text x="920" y="280" text-anchor="middle" fill="{DEEP}" font-size="28" font-weight="800">{t("sc.text")}</text>
  </g>
''' + caption(t("sc.cap"), 520, 80), T["sc.title"][loc])
    out["annotate-screenshot-marks.svg"] = svg(960, 540, heading(t("sc.marks"), 22) + card(70, 130, 820, 220, t("sc.marks"), t("sc.cap"), True) + caption(t("sc.cap")), T["sc.marks"][loc])
    out["annotate-screenshot-png.svg"] = svg(960, 540, heading(t("sc.png"), 24) + card(70, 130, 820, 220, "PNG", t("sc.png"), True) + caption(t("sc.cap")), T["sc.png"][loc])
    out["make-invoice.svg"] = svg(1280, 720, heading(t("iv.title")) + card(80, 140, 360, 260, t("iv.from"), t("iv.lines")) + card(460, 140, 360, 260, t("iv.to"), t("iv.line")) + card(840, 140, 360, 260, "PDF", t("iv.tax"), True) + caption(t("iv.cap"), 500, 80), T["iv.title"][loc])
    out["make-invoice-lines.svg"] = svg(960, 540, heading(t("iv.lines"), 24) + card(70, 130, 820, 220, t("iv.line"), t("iv.lines"), True) + caption(t("iv.cap")), T["iv.lines"][loc])
    out["make-invoice-tax.svg"] = svg(960, 540, heading(t("iv.tax"), 24) + card(70, 130, 820, 220, t("iv.tax"), t("iv.cap"), True) + caption(t("iv.cap")), T["iv.tax"][loc])
    out["make-password.svg"] = svg(1280, 720, heading(t("pw.title")) + card(80, 140, 360, 260, t("pw.len"), t("pw.rule")) + card(460, 140, 360, 260, t("pw.set"), t("pw.rule")) + card(840, 140, 360, 260, t("pw.copy"), t("pw.cap"), True) + caption(t("pw.cap"), 500, 80), T["pw.title"][loc])
    out["make-password-rule.svg"] = svg(960, 540, heading(t("pw.rule"), 24) + card(70, 130, 820, 220, t("pw.len"), t("pw.rule"), True) + caption(t("pw.cap")), T["pw.rule"][loc])
    out["make-password-copy.svg"] = svg(960, 540, heading(t("pw.copy"), 24) + card(70, 130, 820, 220, t("pw.copy"), t("pw.cap"), True) + caption(t("pw.cap")), T["pw.copy"][loc])
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
