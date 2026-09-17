#!/usr/bin/env python3
"""Instructional SVGs for keyword-backed lessons, one folder per locale."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "public" / "covers" / "tutorials"
PINK = "#c83f79"
DEEP = "#a13f6c"
SOFT = "#ffe4ee"
INK = "#59364b"
MUTED = "#876579"
LINE = "#f2d9e5"
WHITE = "#fff7fb"
CARD = "#ffffff"
FONT = "system-ui,'PingFang SC','Noto Sans SC','Hiragino Sans',sans-serif"

LOCS = ["en", "zh-CN", "zh-TW", "ja", "ko", "vi", "id", "es"]
FOLDERS = {
    "en": "",
    "zh-CN": "zh-cn",
    "zh-TW": "zh-tw",
    "ja": "ja",
    "ko": "ko",
    "vi": "vi",
    "id": "id",
    "es": "es",
}


def xml(s: str) -> str:
    return (
        s.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def pack(*vals: str) -> dict[str, str]:
    if len(vals) != 8:
        raise ValueError(vals)
    return dict(zip(LOCS, vals))


def tx(loc: str, row: dict[str, str]) -> str:
    return xml(row.get(loc) or row["en"])


def svg(w: int, h: int, inner: str, label: str) -> str:
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" role="img" aria-label="{xml(label)}">
  <rect width="{w}" height="{h}" rx="28" fill="{WHITE}"/>
  {inner}
</svg>
'''


def card(x, y, w, h, heading, lines, accent=False):
    fill = SOFT if accent else CARD
    stroke = PINK if accent else LINE
    tspan = "".join(
        f'<tspan x="{x + 22}" dy="{22 if i else 0}">{line}</tspan>'
        for i, line in enumerate(lines)
    )
    return f'''
  <rect x="{x}" y="{y}" width="{w}" height="{h}" rx="22" fill="{fill}" stroke="{stroke}" stroke-width="3"/>
  <text x="{x + 22}" y="{y + 40}" fill="{DEEP}" font-size="22" font-weight="700" font-family="{FONT}">{heading}</text>
  <text x="{x + 22}" y="{y + 72}" fill="{INK}" font-size="18" font-family="{FONT}">{tspan}</text>
'''


def heading(text, x=48, y=54, size=32):
    return f'<text x="{x}" y="{y}" fill="{DEEP}" font-size="{size}" font-weight="800" font-family="{FONT}">{text}</text>'


def caption(text, y=500, x=48):
    return f'<text x="{x}" y="{y}" fill="{MUTED}" font-size="18" font-family="{FONT}">{text}</text>'


def qr_url(loc: str) -> str:
    folder = FOLDERS[loc] or "en"
    return f"https://cv.cm/{folder}/qr/"


T = {
    "qr.title": pack("How to make a QR code", "怎么生成二维码", "怎麼產生 QR Code", "QRコードの作り方", "QR 코드 만드는 법", "Cách tạo mã QR", "Cara membuat kode QR", "Cómo crear un código QR"),
    "qr.s1": pack("1. Put a full URL in", "1. 放入完整网址", "1. 放入完整網址", "1. httpsのURLを入れる", "1. 전체 URL 넣기", "1. Dán URL đầy đủ", "1. Masukkan URL lengkap", "1. Ponga la URL completa"),
    "qr.s2": pack("2. Download PNG", "2. 下载 PNG", "2. 下載 PNG", "2. PNGを保存", "2. PNG 받기", "2. Tải PNG", "2. Unduh PNG", "2. Descargar PNG"),
    "qr.s3": pack("3. Scan with a phone before you print", "3. 打印前用手机扫一次", "3. 列印前用手機掃一次", "3. 印刷前にスマホで読む", "3. 인쇄 전에 폰으로 스캔", "3. Quét trước khi in", "3. Pindai sebelum cetak", "3. Escanear antes de imprimir"),
    "qr.cap": pack("A QR code is only a door. Test the door before you print fifty copies.", "二维码只是一扇门。印五十张之前先扫通。", "QR Code 只是一扇門。印五十張之前先掃通。", "QRは扉です。50枚刷る前に読んでください。", "QR은 문입니다. 50장 인쇄 전에 스캔하세요.", "Mã QR chỉ là một cánh cửa. Quét trước khi in năm mươi tờ.", "Kode QR hanya pintu. Uji sebelum cetak 50 salinan.", "Un QR es una puerta. Pruébela antes de imprimir cincuenta."),
    "qr.contents": pack("What should the code open?", "扫开什么？", "掃開什麼？", "何を開く？", "무엇이 열릴까?", "Mã sẽ mở gì?", "Apa yang dibuka?", "¿Qué debe abrir?"),
    "qr.url": pack("URL", "网址", "網址", "URL", "주소", "URL", "URL", "URL"),
    "qr.url1": pack("A page, menu,", "网页、菜单、", "網頁、菜單、", "ページ・メニュー", "페이지·메뉴·", "Trang, menu,", "Halaman, menu,", "Página, menú"),
    "qr.url2": pack("or payment link.", "收款：用 https。", "收款：用 https。", "支払いならhttps。", "결제는 https.", "hoặc thanh toán.", "atau bayar.", "o pago."),
    "qr.url3": pack("Use https.", "", "", "", "", "Dùng https.", "Pakai https.", "Use https."),
    "qr.text": pack("Plain text", "纯文字", "純文字", "テキスト", "텍스트", "Chữ thường", "Teks biasa", "Texto"),
    "qr.text1": pack("A Wi-Fi name,", "Wi-Fi 名、", "Wi-Fi 名、", "Wi-Fi名、", "Wi-Fi 이름,", "Tên Wi-Fi,", "Nama Wi-Fi,", "Nombre Wi-Fi,"),
    "qr.text2": pack("table number,", "桌号、短备注。", "桌號、短備註。", "卓番号、短いメモ。", "테이블 번호,", "số bàn,", "nomor meja,", "número de mesa,"),
    "qr.text3": pack("or short note.", "", "", "短いメモ。", "짧은 메모.", "ghi chú ngắn.", "catatan singkat.", "nota corta."),
    "qr.skip": pack("Skip", "不要", "不要", "入れない", "넣지 마세요", "Không", "Jangan", "No"),
    "qr.skip1": pack("Do not encode a", "不要编码文件。", "不要編碼檔案。", "ファイルは入れない。", "파일을 넣지 마세요.", "Đừng mã hóa tệp.", "Jangan encode berkas.", "No codifique un"),
    "qr.skip2": pack("file. Host the file,", "先上网再编链接。", "先上網再編連結。", "先に公開して", "파일을 올린 뒤", "Đăng tệp, rồi", "Unggah dulu,", "archivo. Súbalo"),
    "qr.skip3": pack("encode the link.", "", "", "連結を入れる。", "링크를 넣으세요.", "mã hóa liên kết.", "lalu encode tautan.", "y codifique el enlace."),
    "qr.contentsCap": pack("If the destination can change, encode a short URL you control.", "地址会变，就编一个你能改的短链。", "地址會變，就編一個你能改的短網址。", "後で変わるなら自分で管理できる短縮URL。", "주소가 바뀌면 직접 고칠 수 있는 짧은 링크.", "Nếu đích đổi, dùng URL ngắn bạn kiểm soát.", "Jika tujuan berubah, pakai URL pendek yang Anda kendalikan.", "Si el destino cambia, use una URL corta que controle."),
    "qr.scan": pack("Scan before you print", "打印前先扫", "列印前先掃", "印刷前に読む", "인쇄 전에 스캔", "Quét trước khi in", "Pindai sebelum cetak", "Escanear antes de imprimir"),
    "qr.cam": pack("Camera preview", "相机预览", "相機預覽", "カメラ", "카메라", "Xem camera", "Pratinjau kamera", "Vista de cámara"),
    "qr.hold": pack("Hold the phone 20–30 cm away.", "手机离 20–30 厘米。", "手機離 20–30 公分。", "20–30cm離す。", "20–30cm 떨어뜨리세요.", "Cách 20–30 cm.", "Jarak 20–30 cm.", "A 20–30 cm."),
    "qr.page": pack("The page must open, not a search box.", "必须打开页面，不要跳出搜索。", "必須打開頁面，不要跳出搜尋。", "ページが開くこと。検索は失敗。", "페이지가 열려야 합니다. 검색창이면 실패.", "Trang phải mở, không phải ô tìm kiếm.", "Halaman harus terbuka, bukan kotak pencarian.", "Debe abrir la página, no un buscador."),
    "qr.quiet": pack("Quiet zone: leave a white margin.", "静区：四周留白边。", "靜區：四周留白邊。", "余白（クワイエットゾーン）を残す。", "흰 여백을 남기세요.", "Để lề trắng quanh mã.", "Sisakan pinggir putih.", "Deje un margen blanco."),
    "qr.size": pack("Print at least 2 cm wide. Do not stretch.", "边长至少 2 厘米。不要拉扁。", "邊長至少 2 公分。不要拉扁。", "一辺2cm以上。縦横比は維持。", "한 변 2cm 이상. 늘리지 마세요.", "Cạnh ít nhất 2 cm. Đừng kéo méo.", "Sisi minimal 2 cm. Jangan diregang.", "Al menos 2 cm. No lo estire."),
    "qr.scanCap": pack("A code that fails in your kitchen will fail on the door.", "厨房里扫不开，门口也扫不开。", "廚房裡掃不開，門口也掃不開。", "台所で失敗するコードは玄関でも失敗します。", "부엌에서 실패하면 문에서도 실패합니다.", "Trong bếp đã hỏng thì ngoài cửa cũng hỏng.", "Gagal di dapur, gagal di pintu.", "Si falla en la cocina, fallará en la puerta."),
    "bc.title": pack("How to make a barcode", "怎么生成条码", "怎麼產生條碼", "バーコードの作り方", "바코드 만드는 법", "Cách tạo barcode", "Cara membuat barcode", "Cómo crear un código de barras"),
    "bc.ean": pack("EAN-13 for products", "EAN-13 用于商品", "EAN-13 用於商品", "EAN-13は商品", "EAN-13은 상품용", "EAN-13 cho sản phẩm", "EAN-13 untuk produk", "EAN-13 para productos"),
    "bc.128": pack("Code 128 for inventory and tickets", "Code 128 用于库存和工单", "Code 128 用於庫存和工單", "Code 128は在庫・チケット", "Code 128은 재고·티켓", "Code 128 cho kho và vé", "Code 128 untuk stok dan tiket", "Code 128 para inventario y tickets"),
    "bc.39": pack("Code 39 if the scanner is old", "老扫描枪用 Code 39", "老掃描器請用 Code 39", "古いスキャナならCode 39", "오래된 스캐너는 Code 39", "Súng cũ dùng Code 39", "Scanner lama: Code 39", "Code 39 si el lector es viejo"),
    "bc.cap": pack("A barcode is digits a scanner can read. Test with the scanner you will use.", "条码是扫描枪能读的数字。用真正会用的枪扫一次。", "條碼是掃描器能讀的數字。用真正會用的槍掃一次。", "バーコードはスキャナが読む数字。現場の機械で試す。", "바코드는 스캐너가 읽는 숫자입니다. 실제 기기로 테스트하세요.", "Barcode là số máy đọc được. Hãy quét bằng máy thật.", "Barcode adalah angka yang dibaca pemindai. Uji dengan pemindai nyata.", "Un código de barras son dígitos. Pruebe con el lector real."),
    "bc.types": pack("Pick the symbology first", "先选码制", "先選碼制", "先に種類を選ぶ", "먼저 종류를 고르세요", "Chọn loại mã trước", "Pilih simbologi dulu", "Elija el tipo primero"),
    "bc.128b1": pack("Letters and digits.", "字母和数字。", "字母和數字。", "英数字。", "글자와 숫자.", "Chữ và số.", "Huruf dan angka.", "Letras y dígitos."),
    "bc.128b2": pack("Warehouse, tickets,", "仓库、工单、", "倉庫、工單、", "倉庫・チケット・", "창고·티켓·", "Kho, vé,", "Gudang, tiket,", "Almacén, tickets,"),
    "bc.128b3": pack("internal IDs.", "内部编号。", "內部編號。", "内部ID。", "내부 번호.", "mã nội bộ.", "ID internal.", "IDs internos."),
    "bc.39b1": pack("Older scanners.", "老扫描枪。", "老掃描器。", "古いスキャナ。", "오래된 스캐너.", "Máy cũ.", "Scanner lama.", "Lectores viejos."),
    "bc.39b2": pack("Uppercase, digits,", "大写、数字、", "大寫、數字、", "大文字・数字・", "대문자·숫자·", "Chữ hoa, số,", "Huruf besar, angka,", "Mayúsculas, dígitos,"),
    "bc.39b3": pack("a few symbols.", "少量符号。", "少量符號。", "一部の記号。", "일부 기호.", "vài ký hiệu.", "sedikit simbol.", "pocos símbolos."),
    "bc.eanb1": pack("Retail products.", "零售商品。", "零售商品。", "小売商品。", "소매 상품.", "Hàng bán lẻ.", "Produk ritel.", "Productos retail."),
    "bc.eanb2": pack("12 digits + check.", "12 位加校验。", "12 位加校驗。", "12桁+チェック。", "12자리+체크.", "12 số + kiểm.", "12 digit + cek.", "12 dígitos + control."),
    "bc.eanb3": pack("Not a URL.", "不是网址。", "不是網址。", "URLではない。", "URL이 아님.", "Không phải URL.", "Bukan URL.", "No es una URL."),
    "bc.typesCap": pack("QR codes open links. Barcodes identify a thing. Do not mix them.", "二维码打开链接。条码识别货品。不要混用。", "QR 打開連結。條碼識別貨品。不要混用。", "QRはリンク。バーコードはモノ。混ぜない。", "QR은 링크, 바코드는 물건. 섞지 마세요.", "QR mở liên kết. Barcode nhận hàng. Đừng trộn.", "QR membuka tautan. Barcode mengidentifikasi barang.", "El QR abre un enlace. El código de barras identifica un artículo."),
    "bc.digits": pack("EAN-13 is 12 digits plus a check", "EAN-13：12 位加校验", "EAN-13：12 位加校驗", "EAN-13は12桁+チェック", "EAN-13은 12자리+체크", "EAN-13: 12 số + kiểm", "EAN-13: 12 digit + cek", "EAN-13: 12 dígitos + control"),
    "bc.parts": pack("country / company / item          check digit", "国家 / 厂商 / 货号          校验位", "國家 / 廠商 / 貨號          校驗位", "国 / 会社 / 品番          チェック", "국가 / 회사 / 품목          체크", "nước / công ty / hàng          số kiểm", "negara / perusahaan / item          cek", "país / empresa / ítem          dígito"),
    "bc.typeHint": pack("Type 12 digits. The tool adds the check digit. If a shop scanner rejects it, the check is wrong or the prefix is not yours.", "只输入 12 位，校验位由工具补。店里的枪拒读，不是校验错了就是前缀不属于你。", "只輸入 12 位，校驗位由工具補。店裡的槍拒讀，不是校驗錯了就是前綴不屬於你。", "12桁を入力。チェックはツールが付ける。店で弾かれたら桁かプレフィックス。", "12자리를 입력하세요. 체크는 도구가 넣습니다. 매장에서 거절되면 체크나 접두사가 틀린 것입니다.", "Nhập 12 số. Công cụ thêm số kiểm. Cửa hàng từ chối thì sai kiểm hoặc tiền tố không phải của bạn.", "Ketik 12 digit. Alat menambah cek. Ditolak toko: cek salah atau prefiks bukan milik Anda.", "Escriba 12 dígitos. La herramienta añade el control. Si la tienda lo rechaza, el control o el prefijo no es suyo."),
    "bc.digitsCap": pack("Do not invent a retail EAN that belongs to someone else.", "不要编别人的商品号。", "不要編別人的商品號。", "他人のGTINを作らない。", "남의 상품번호를 만들지 마세요.", "Đừng bịa GTIN của người khác.", "Jangan mengarang GTIN orang lain.", "No invente un EAN que sea de otro."),
    "mg.title": pack("How to merge PDF files", "怎么合并 PDF", "怎麼合併 PDF", "PDFを結合する方法", "PDF 합치는 법", "Cách gộp file PDF", "Cara gabung file PDF", "Cómo unir archivos PDF"),
    "mg.a": pack("A · 3 pages", "A · 3 页", "A · 3 頁", "A · 3ページ", "A · 3쪽", "A · 3 trang", "A · 3 halaman", "A · 3 páginas"),
    "mg.b": pack("B · 2 pages", "B · 2 页", "B · 2 頁", "B · 2ページ", "B · 2쪽", "B · 2 trang", "B · 2 halaman", "B · 2 páginas"),
    "mg.one": pack("One file · 5 pages", "一份文件 · 5 页", "一份檔 · 5 頁", "1つのファイル · 5ページ", "파일 하나 · 5쪽", "Một file · 5 trang", "Satu file · 5 halaman", "Un archivo · 5 páginas"),
    "mg.order": pack("Order is the list order.", "列表顺序就是页序。", "列表順序就是頁序。", "リストの順がページ順。", "목록 순서가 페이지 순서.", "Thứ tự danh sách là thứ tự trang.", "Urutan daftar = urutan halaman.", "El orden de la lista es el de las páginas."),
    "mg.reopen": pack("Reopen the download and count.", "下载后再打开数页数。", "下載後再打開數頁數。", "保存してページ数を数える。", "받은 뒤 페이지를 세요.", "Mở lại file và đếm trang.", "Buka unduhan dan hitung halaman.", "Ábralo y cuente las páginas."),
    "mg.cap": pack("Password-locked PDFs often cannot be merged until you unlock them.", "加密 PDF 要先解锁再合并。", "加密 PDF 要先解鎖再合併。", "暗号化PDFは先に解除。", "암호 PDF는 먼저 해제하세요.", "PDF khóa phải mở khóa trước.", "PDF terkunci harus dibuka dulu.", "Los PDF cifrados hay que desbloquearlos antes."),
    "mg.list": pack("List order is page order", "列表顺序就是页序", "列表順序就是頁序", "リスト順がページ順", "목록 순서가 페이지 순서", "Thứ tự danh sách là thứ tự trang", "Urutan daftar = urutan halaman", "El orden de la lista es el de las páginas"),
    "mg.cover": pack("1  Cover.pdf", "1  封面.pdf", "1  封面.pdf", "1  Cover.pdf", "1  Cover.pdf", "1  Bia.pdf", "1  Cover.pdf", "1  Portada.pdf"),
    "mg.contract": pack("2  Contract.pdf", "2  合同.pdf", "2  合約.pdf", "2  Contract.pdf", "2  Contract.pdf", "2  HopDong.pdf", "2  Kontrak.pdf", "2  Contrato.pdf"),
    "mg.app": pack("3  Appendix.pdf", "3  附录.pdf", "3  附錄.pdf", "3  Appendix.pdf", "3  Appendix.pdf", "3  PhuLuc.pdf", "3  Lampiran.pdf", "3  Anexo.pdf"),
    "mg.drag": pack("Drag to reorder", "拖动调整顺序", "拖曳調整順序", "ドラッグで並べ替え", "끌어서 순서 바꾸기", "Kéo để sắp xếp", "Seret untuk urutkan", "Arrastre para reordenar"),
    "mg.first": pack("The first row becomes page 1.", "第一行就是第 1 页。", "第一行就是第 1 頁。", "先頭が1ページ目。", "첫 줄이 1쪽.", "Hàng đầu là trang 1.", "Baris pertama = halaman 1.", "La primera fila es la página 1."),
    "mg.empty": pack("Empty pages in a source stay empty.", "源文件里的空白页还在。", "來源檔裡的空白頁還在。", "元の空白ページは残る。", "원본의 빈 페이지는 남습니다.", "Trang trống trong nguồn vẫn trống.", "Halaman kosong sumber tetap kosong.", "Las páginas vacías del origen se quedan."),
    "mg.count": pack("Check the page count after export.", "导出后核对页数。", "匯出後核對頁數。", "書き出し後にページ数を確認。", "보낸 뒤 쪽수를 확인하세요.", "Xuất xong hãy đếm trang.", "Setelah ekspor, hitung halaman.", "Después de exportar, cuente."),
    "mg.listCap": pack("If page 1 is wrong, the list was wrong — not the download.", "第 1 页不对，是列表错了，不是下载坏了。", "第 1 頁不對，是列表錯了，不是下載壞了。", "1ページ目が違うのはリストの順。", "1쪽이 틀리면 목록이 틀린 것입니다.", "Trang 1 sai thì do danh sách, không phải file tải.", "Halaman 1 salah: daftar salah, bukan unduhan.", "Si la página 1 falla, falló la lista, no la descarga."),
    "mg.check": pack("Verify the merged file", "核对合并结果", "核對合併結果", "結合結果を確認", "합친 파일 확인", "Kiểm tra file đã gộp", "Periksa hasil gabungan", "Compruebe el archivo unido"),
    "mg.open": pack("Open the download", "打开下载的文件", "打開下載的檔", "ダウンロードを開く", "받은 파일을 여세요", "Mở file đã tải", "Buka unduhan", "Abra la descarga"),
    "mg.math": pack("3 + 2 + 4 source pages should be 9 pages.", "3 + 2 + 4 页应该是 9 页。", "3 + 2 + 4 頁應該是 9 頁。", "3+2+4は9ページ。", "3+2+4는 9쪽이어야 합니다.", "3 + 2 + 4 phải thành 9 trang.", "3+2+4 harus 9 halaman.", "3 + 2 + 4 deben ser 9 páginas."),
    "mg.skim": pack("Skim the first page of each original block.", "每份原稿的第一页扫一眼。", "每份原稿的第一頁掃一眼。", "各元ファイルの先頭を見る。", "각 원본의 첫 쪽을 보세요.", "Xem trang đầu mỗi khối gốc.", "Lihat halaman pertama tiap blok.", "Mire la primera página de cada bloque."),
    "mg.missing": pack("If a file is missing, it was locked or not added.", "少了一份，多半是加密或没加进去。", "少了一份，多半是加密或沒加進去。", "欠けていれば暗号化か未追加。", "빠졌다면 암호이거나 안 넣은 것입니다.", "Thiếu file thì bị khóa hoặc chưa thêm.", "Hilang: terkunci atau tidak ditambah.", "Si falta uno, estaba cifrado o no se añadió."),
    "mg.checkCap": pack("Do not send the file until you have opened it once.", "打开过一次再发出去。", "打開過一次再寄出。", "一度開いてから送る。", "한 번 연 뒤에 보내세요.", "Mở một lần rồi mới gửi.", "Buka sekali sebelum kirim.", "Ábralo una vez antes de enviarlo."),
    "cp.title": pack("How to compress a PDF", "怎么压缩 PDF", "怎麼壓縮 PDF", "PDFを圧縮する方法", "PDF 압축하는 법", "Cách nén PDF", "Cara kompres PDF", "Cómo comprimir un PDF"),
    "cp.email": pack("email limit 10 MB", "邮箱上限 10 MB", "信箱上限 10 MB", "メール上限 10MB", "이메일 한도 10MB", "email tối đa 10 MB", "batas email 10 MB", "límite de correo 10 MB"),
    "cp.read": pack("pages still readable", "页面仍然能读", "頁面仍然能讀", "まだ読める", "여전히 읽을 수 있음", "trang vẫn đọc được", "halaman masih terbaca", "páginas aún legibles"),
    "cp.cap": pack("Compression re-encodes pages. Open a photo-heavy page after export.", "压缩会重编码。导出后打开一张带照片的页。", "壓縮會重編碼。匯出後打開一張帶照片的頁。", "圧縮は再エンコード。書き出し後に写真ページを開く。", "압축은 다시 인코딩합니다. 보낸 뒤 사진 페이지를 여세요.", "Nén mã hóa lại trang. Xuất xong mở một trang nhiều ảnh.", "Kompresi meng-encode ulang. Buka halaman berfoto setelah ekspor.", "Comprimir recodifica. Abra una página con fotos después."),
    "cp.limit": pack("Match the limit you actually have", "对准真实上限", "對準真實上限", "本当の上限に合わせる", "실제 한도에 맞추기", "Khớp giới hạn thật", "Cocokkan batas nyata", "Ajuste al límite real"),
    "cp.mail": pack("Email", "邮箱", "信箱", "メール", "이메일", "Email", "Email", "Correo"),
    "cp.mail1": pack("Often 10–25 MB.", "常见 10–25 MB。", "常見 10–25 MB。", "だいたい10–25MB。", "보통 10–25MB.", "Thường 10–25 MB.", "Sering 10–25 MB.", "Suele ser 10–25 MB."),
    "cp.mail2": pack("Compress, then", "压完再附一次。", "壓完再附一次。", "圧縮してから添付。", "압축한 뒤 첨부.", "Nén rồi đính.", "Kompres, lalu", "Comprima y"),
    "cp.mail3": pack("attach once.", "", "", "", "", "", "lampirkan sekali.", "adjunte una vez."),
    "cp.form": pack("Form upload", "表单上传", "表單上傳", "フォーム", "폼 업로드", "Form tải lên", "Unggah formulir", "Formulario"),
    "cp.form1": pack("Read the field.", "看字段要求。", "看欄位要求。", "欄を読む。", "칸을 읽으세요.", "Đọc ô yêu cầu.", "Baca kolomnya.", "Lea el campo."),
    "cp.form2": pack("Some want 2 MB.", "有的只要 2 MB。", "有的只要 2 MB。", "2MB指定もある。", "2MB인 곳도 있습니다.", "Có nơi chỉ 2 MB.", "Ada yang 2 MB.", "Algunos piden 2 MB."),
    "cp.form3": pack("Some want 20.", "有的要 20。", "有的要 20。", "20MBのことも。", "20인 곳도.", "Có nơi 20.", "Ada yang 20.", "Otros 20."),
    "cp.blur": pack("Too blurry", "太糊了", "太糊了", "潰れた", "너무 뭉갬", "Quá nhòe", "Terlalu pecah", "Demasiado borroso"),
    "cp.blur1": pack("Use less JPEG", "少压一点，", "少壓一點，", "JPEGを弱める。", "JPEG을 덜 누르세요.", "Nén JPEG nhẹ hơn.", "Kurangi JPEG.", "Menos JPEG,"),
    "cp.blur2": pack("quality loss.", "或把 PDF 拆开。", "或把 PDF 拆開。", "または分割。", "또는 PDF를 나누세요.", "Hoặc tách PDF.", "Atau pecah PDF.", "o divida el PDF."),
    "cp.blur3": pack("Or split the PDF.", "", "", "", "", "", "", ""),
    "cp.limitCap": pack("A smaller file that nobody can read is not a success.", "小到没人能读，不算成功。", "小到沒人能讀，不算成功。", "読めない小ささは成功ではない。", "못 읽는 작은 파일은 성공이 아닙니다.", "Nhỏ đến mức không đọc được thì chưa xong.", "File kecil yang tak terbaca bukan sukses.", "Un archivo ilegible no es un éxito."),
    "cp.quality": pack("Compare size against a real page", "对照真实页面看体积", "對照真實頁面看體積", "実ページとサイズを比べる", "실제 페이지와 용량 비교", "So dung lượng với trang thật", "Bandingkan ukuran dengan halaman nyata", "Compare el tamaño con una página real"),
    "cp.hard": pack("Stronger compression", "压得更狠", "壓得更狠", "強めの圧縮", "더 강하게", "Nén mạnh hơn", "Kompresi lebih kuat", "Más compresión"),
    "cp.mushy": pack("Text OK · photos mushy", "字还行 · 照片糊", "字還行 · 照片糊", "文字は可・写真は潰れる", "글자는 OK · 사진은 뭉갬", "Chữ ổn · ảnh nhòe", "Teks OK · foto pecah", "Texto OK · fotos pastosas"),
    "cp.mild": pack("Milder compression", "压得轻一点", "壓得輕一點", "弱めの圧縮", "더 약하게", "Nén nhẹ hơn", "Kompresi lebih ringan", "Menos compresión"),
    "cp.sharp": pack("Photos still sharp", "照片仍然清楚", "照片仍然清楚", "写真はまだSharp", "사진은 여전히 선명", "Ảnh vẫn nét", "Foto masih tajam", "Fotos aún nítidas"),
    "cp.qualityCap": pack("Pick the largest file that still fits the limit.", "选还能塞进上限的最大文件。", "選還能塞進上限的最大檔。", "上限に入る最大を選ぶ。", "한도에 들어가는 가장 큰 파일을 고르세요.", "Chọn file lớn nhất vẫn lọt giới hạn.", "Pilih file terbesar yang masih muat.", "Elija el archivo más grande que aún cabe."),
    "he.title": pack("How to convert HEIC to JPG", "怎么把 HEIC 转成 JPG", "怎麼把 HEIC 轉成 JPG", "HEICをJPGに変換", "HEIC를 JPG로", "Cách đổi HEIC sang JPG", "Cara ubah HEIC ke JPG", "Cómo pasar HEIC a JPG"),
    "he.iphone": pack("iPhone default", "iPhone 默认格式", "iPhone 預設格式", "iPhoneの標準", "iPhone 기본", "Mặc định iPhone", "Default iPhone", "Por defecto en iPhone"),
    "he.win": pack("Windows / WeChat", "Windows / 微信", "Windows / WeChat", "Windows / WeChat", "Windows / WeChat", "Windows / WeChat", "Windows / WeChat", "Windows / WeChat"),
    "he.fail": pack("often cannot open it", "经常打不开", "經常打不開", "開けないことが多い", "자주 열리지 않음", "thường không mở được", "sering tidak bisa dibuka", "a menudo no abre"),
    "he.same": pack("Same pixels, common format", "像素一样，格式更通用", "像素一樣，格式更通用", "画素はそのまま、互換性", "같은 픽셀, 흔한 포맷", "Cùng pixel, định dạng phổ biến", "Pixel sama, format umum", "Mismos píxeles, formato común"),
    "he.open": pack("Open it on the PC before sending", "发给电脑前先打开看", "寄到電腦前先打開看", "送る前にPCで開く", "보내기 전에 PC에서 여세요", "Gửi trước hãy mở trên PC", "Buka di PC sebelum kirim", "Ábralo en el PC antes de enviarlo"),
    "he.cap": pack("Safari and Chromium can decode HEIC. Firefox on Windows often cannot.", "Safari 和 Chrome 能解 HEIC。Windows 上的 Firefox 经常不行。", "Safari 和 Chrome 能解 HEIC。Windows 上的 Firefox 經常不行。", "SafariとChromeはHEIC可。WindowsのFirefoxは不可が多い。", "Safari와 Chrome은 HEIC를 엽니다. Windows Firefox는 자주 실패.", "Safari và Chrome đọc được HEIC. Firefox trên Windows thường không.", "Safari dan Chrome bisa HEIC. Firefox di Windows sering gagal.", "Safari y Chrome decodifican HEIC. Firefox en Windows suele fallar."),
    "he.why": pack("HEIC is smaller. JPG is compatible.", "HEIC 更小。JPG 更通用。", "HEIC 更小。JPG 更通用。", "HEICは小さい。JPGは通る。", "HEIC는 작고 JPG는 호환됩니다.", "HEIC nhỏ hơn. JPG phổ biến hơn.", "HEIC lebih kecil. JPG lebih kompatibel.", "HEIC pesa menos. JPG es compatible."),
    "he.keep": pack("Keep HEIC", "留下 HEIC", "留下 HEIC", "HEICは残す", "HEIC 유지", "Giữ HEIC", "Simpan HEIC", "Conserve HEIC"),
    "he.keep1": pack("On your phone.", "留在手机里。", "留在手機裡。", "電話に残す。", "폰에 두세요.", "Để trên điện thoại.", "Di ponsel.", "En el teléfono."),
    "he.keep2": pack("In iCloud.", "在 iCloud。", "在 iCloud。", "iCloudに。", "iCloud에.", "Trong iCloud.", "Di iCloud.", "En iCloud."),
    "he.keep3": pack("When space matters.", "要省空间时。", "要省空間時。", "容量が要るとき。", "용량이 아쉬울 때.", "Khi cần chỗ.", "Jika ruang penting.", "Si el espacio importa."),
    "he.jpg": pack("Export JPG", "导出 JPG", "匯出 JPG", "JPGを書き出す", "JPG보내기", "Xuất JPG", "Ekspor JPG", "Exportar JPG"),
    "he.jpg1": pack("Windows PCs.", "Windows 电脑。", "Windows 電腦。", "WindowsのPC。", "Windows PC.", "Máy Windows.", "PC Windows.", "PCs Windows."),
    "he.jpg2": pack("School forms.", "学校表单。", "學校表單。", "学校の提出。", "학교 서류.", "Form nhà trường.", "Formulir sekolah.", "Formularios escolares."),
    "he.jpg3": pack("Chat apps that reject HEIC.", "不认 HEIC 的聊天软件。", "不認 HEIC 的聊天軟體。", "HEICを拒むチャット。", "HEIC를 거부하는 채팅.", "Chat từ chối HEIC.", "Chat yang menolak HEIC.", "Chats que rechazan HEIC."),
    "he.whyCap": pack("Convert a copy. Keep the original HEIC if you still edit on iPhone.", "转的是副本。还在手机修图就留着 HEIC。", "轉的是副本。還在手機修圖就留著 HEIC。", "コピーを変換。iPhoneで編集するならHEICを残す。", "복사본을 변환하세요. 아이폰에서 계속 고치면 HEIC를 남기세요.", "Đổi bản sao. Còn sửa trên iPhone thì giữ HEIC.", "Ubah salinan. Jika masih edit di iPhone, simpan HEIC.", "Convierta una copia. Si sigue editando en el iPhone, conserve el HEIC."),
    "he.steps": pack("Drop the file, pick JPG, download", "拖入文件，选 JPG，下载", "拖入檔，選 JPG，下載", "ドロップしてJPGを選んで保存", "파일을 넣고 JPG를 고른 뒤 받기", "Thả tệp, chọn JPG, tải", "Letakkan berkas, pilih JPG, unduh", "Suelte el archivo, elija JPG, descargue"),
    "he.st1": pack("1  Open cv.cm in Safari or Chrome", "1  用 Safari 或 Chrome 打开 cv.cm", "1  用 Safari 或 Chrome 打開 cv.cm", "1  SafariかChromeでcv.cm", "1  Safari 또는 Chrome에서 cv.cm", "1  Mở cv.cm bằng Safari hoặc Chrome", "1  Buka cv.cm di Safari atau Chrome", "1  Abra cv.cm en Safari o Chrome"),
    "he.st2": pack("2  Drop .HEIC files · choose JPG", "2  拖入 .HEIC · 选 JPG", "2  拖入 .HEIC · 選 JPG", "2  .HEICをドロップしJPG", "2  .HEIC를 넣고 JPG 선택", "2  Thả .HEIC · chọn JPG", "2  Letakkan .HEIC · pilih JPG", "2  Suelte .HEIC · elija JPG"),
    "he.st3": pack("3  Download · open the JPG once", "3  下载 · 打开 JPG 看一眼", "3  下載 · 打開 JPG 看一眼", "3  保存してJPGを一度開く", "3  받고 JPG를 한 번 열기", "3  Tải · mở JPG một lần", "3  Unduh · buka JPG sekali", "3  Descargue · abra el JPG una vez"),
    "he.stepsCap": pack("If the preview is blank, this browser cannot decode HEIC. Switch browser.", "预览空白，就是这款浏览器解不了 HEIC。换 Safari 或 Chrome。", "預覽空白，就是這款瀏覽器解不了 HEIC。換 Safari 或 Chrome。", "プレビューが空ならこのブラウザはHEIC不可。乗り換える。", "미리보기가 비면 이 브라우저는 HEIC를 못 엽니다. 바꾸세요.", "Xem trước trống thì trình duyệt không đọc HEIC. Đổi trình duyệt.", "Pratinjau kosong: peramban ini tidak bisa HEIC. Ganti.", "Si la vista está en blanco, este navegador no decodifica HEIC. Cámbielo."),
    "jp.title": pack("How to convert JPG to PDF", "怎么把 JPG 转成 PDF", "怎麼把 JPG 轉成 PDF", "JPGをPDFにする", "JPG를 PDF로", "Cách chuyển JPG sang PDF", "Cara ubah JPG ke PDF", "Cómo pasar JPG a PDF"),
    "jp.one": pack("one PDF", "一份 PDF", "一份 PDF", "1つのPDF", "PDF 하나", "một PDF", "satu PDF", "un PDF"),
    "jp.pages": pack("page 1 · page 2 · page 3", "第 1 页 · 第 2 页 · 第 3 页", "第 1 頁 · 第 2 頁 · 第 3 頁", "1・2・3ページ", "1 · 2 · 3쪽", "trang 1 · 2 · 3", "hal. 1 · 2 · 3", "pág. 1 · 2 · 3"),
    "jp.size": pack("A4, Letter, or fit-to-photo", "A4、Letter，或按照片铺满", "A4、Letter，或依照片鋪滿", "A4 / Letter / 写真に合わせる", "A4, Letter, 또는 사진에 맞춤", "A4, Letter, hoặc vừa ảnh", "A4, Letter, atau pas foto", "A4, Letter o ajuste a la foto"),
    "jp.cap": pack("List order is page order. Reopen the PDF and flip through it.", "列表顺序就是页序。打开 PDF 翻一遍。", "列表順序就是頁序。打開 PDF 翻一遍。", "リスト順がページ順。PDFを開いてめくる。", "목록 순서가 페이지 순서. PDF를 열어 넘기세요.", "Thứ tự danh sách là thứ tự trang. Mở PDF và lật.", "Urutan daftar = urutan halaman. Buka PDF dan lihat.", "El orden de la lista es el de las páginas. Ábralo y páselo."),
    "jp.vs": pack("A4 vs fit-to-photo", "A4 还是按照片铺满", "A4 還是依照片鋪滿", "A4か写真に合わせるか", "A4 대 사진에 맞춤", "A4 hay vừa ảnh", "A4 vs pas foto", "A4 o ajuste a la foto"),
    "jp.a4": pack("A4 / Letter", "A4 / Letter", "A4 / Letter", "A4 / Letter", "A4 / Letter", "A4 / Letter", "A4 / Letter", "A4 / Letter"),
    "jp.a41": pack("Forms and printers.", "表单和打印机。", "表單和印表機。", "提出とプリンタ。", "서류와 프린터.", "Form và máy in.", "Formulir dan printer.", "Formularios e impresoras."),
    "jp.a42": pack("Photos get margins.", "照片会留边。", "照片會留邊。", "余白がつく。", "사진에 여백.", "Ảnh có lề.", "Foto dapat margin.", "Las fotos tienen margen."),
    "jp.a43": pack("Use for homework.", "交作业用这个。", "交作業用這個。", "宿題向き。", "숙제에 쓰세요.", "Dùng cho bài tập.", "Untuk PR.", "Para deberes."),
    "jp.fit": pack("Fit to photo", "按照片铺满", "依照片鋪滿", "写真に合わせる", "사진에 맞춤", "Vừa khít ảnh", "Pas ke foto", "Ajuste a la foto"),
    "jp.fit1": pack("One image fills the page.", "一张图铺满一页。", "一張圖鋪滿一頁。", "1枚がページいっぱい。", "한 장이 페이지를 채움.", "Một ảnh đầy trang.", "Satu gambar memenuhi halaman.", "Una imagen llena la página."),
    "jp.fit2": pack("Better for a lookbook.", "画册更合适。", "畫冊更合適。", "作品集向き。", "룩북에 나음.", "Hợp lookbook.", "Lebih baik untuk lookbook.", "Mejor para un lookbook."),
    "jp.fit3": pack("Worse for office printers.", "办公打印较差。", "辦公列印較差。", "事務プリンタには不向き。", "사무 프린터엔 나쁨.", "Máy in văn phòng kém hơn.", "Buruk untuk printer kantor.", "Peor para impresoras de oficina."),
    "jp.vsCap": pack("If a printer crops the edge, you picked fit-to-photo on an A4 job.", "打印机切边了，就是 A4 活用了铺满。", "印表機切邊了，就是 A4 活用了鋪滿。", "端が切れたらA4仕事にフィットを選んだ。", "가장자리가 잘리면 A4 작업에 맞춤을 고른 것입니다.", "Máy in cắt mép thì bạn chọn vừa ảnh cho việc A4.", "Printer memotong tepi: Anda pilih pas-foto untuk kerja A4.", "Si la impresora recorta, eligió ajuste a foto en un trabajo A4."),
    "jp.count": pack("Count pages after export", "导出后数页数", "匯出後數頁數", "書き出し後にページ数", "보낸 뒤 쪽수 세기", "Xuất xong đếm trang", "Hitung halaman setelah ekspor", "Cuente páginas tras exportar"),
    "jp.four": pack("4 photos dropped", "放入 4 张照片", "放入 4 張照片", "写真4枚", "사진 4장", "4 ảnh đã thả", "4 foto dimasukkan", "4 fotos soltadas"),
    "jp.arrow": pack("→ 4 pages", "→ 4 页", "→ 4 頁", "→ 4ページ", "→ 4쪽", "→ 4 trang", "→ 4 halaman", "→ 4 páginas"),
    "jp.three": pack("If you see 3, one file failed to decode.", "只有 3 页，就是有一张没解出来。", "只有 3 頁，就是有一張沒解出來。", "3なら1枚がデコード失敗。", "3쪽이면 한 장이 풀리지 않은 것입니다.", "Thấy 3 trang thì một tệp không giải được.", "Kalau 3, satu berkas gagal dibaca.", "Si ve 3, un archivo no se decodificó."),
    "jp.ff": pack("HEIC may fail in Firefox — convert to JPG first.", "Firefox 里 HEIC 可能失败 — 先转成 JPG。", "Firefox 裡 HEIC 可能失敗 — 先轉成 JPG。", "FirefoxのHEICは失敗しがち。先にJPGへ。", "Firefox에서 HEIC는 실패할 수 있습니다. 먼저 JPG로.", "HEIC có thể fail trên Firefox — đổi JPG trước.", "HEIC bisa gagal di Firefox — ubah ke JPG dulu.", "HEIC puede fallar en Firefox: páselo a JPG primero."),
    "jp.countCap": pack("Open the PDF. Do not trust the download toast alone.", "打开 PDF。不要只看下载提示。", "打開 PDF。不要只看下載提示。", "PDFを開く。トーストだけ信じない。", "PDF를 여세요. 다운로드 토스트만 믿지 마세요.", "Mở PDF. Đừng chỉ tin thông báo tải.", "Buka PDF. Jangan percaya toast unduhan saja.", "Abra el PDF. No confíe solo en el aviso de descarga."),
    "pj.title": pack("How to convert PDF to JPG", "怎么把 PDF 转成 JPG", "怎麼把 PDF 轉成 JPG", "PDFをJPGにする", "PDF를 JPG로", "Cách chuyển PDF sang JPG", "Cara ubah PDF ke JPG", "Cómo pasar un PDF a JPG"),
    "pj.scan": pack("scan.pdf · 3 pages", "scan.pdf · 3 页", "scan.pdf · 3 頁", "scan.pdf · 3ページ", "scan.pdf · 3쪽", "scan.pdf · 3 trang", "scan.pdf · 3 halaman", "scan.pdf · 3 páginas"),
    "pj.cap": pack("Each PDF page becomes one image. Choose scale before you download.", "每一页变成一张图。下载前选倍率。", "每一頁變成一張圖。下載前選倍率。", "各ページが1枚の画像。保存前に倍率。", "각 페이지가 이미지 하나. 받기 전에 배율을 고르세요.", "Mỗi trang PDF thành một ảnh. Chọn tỉ lệ trước khi tải.", "Tiap halaman jadi satu gambar. Pilih skala sebelum unduh.", "Cada página pasa a una imagen. Elija la escala antes de descargar."),
    "pj.scale": pack("Scale is resolution", "倍率就是清晰度", "倍率就是清晰度", "倍率は解像度", "배율이 해상도", "Tỉ lệ là độ nét", "Skala = resolusi", "La escala es la resolución"),
    "pj.1x1": pack("Smaller files.", "文件更小。", "檔更小。", "ファイルは軽い。", "파일이 작음.", "File nhỏ hơn.", "File lebih kecil.", "Archivos más pequeños."),
    "pj.1x2": pack("Fine for chat.", "聊天够用。", "聊天夠用。", "チャット向き。", "채팅용으로 충분.", "Đủ cho chat.", "Cukup untuk chat.", "Vale para el chat."),
    "pj.1x3": pack("Blurry if you zoom.", "放大就糊。", "放大就糊。", "拡大すると甘い。", "확대하면 흐림.", "Phóng to sẽ nhòe.", "Zoom jadi pecah.", "Borroso al ampliar."),
    "pj.2x1": pack("Sharper type.", "文字更利。", "文字更利。", "文字がSharp。", "글자가 더 선명.", "Chữ nét hơn.", "Teks lebih tajam.", "Texto más nítido."),
    "pj.2x2": pack("Better for reprint.", "再打印更好。", "再列印更好。", "再印刷向き。", "다시 인쇄에 나음.", "In lại tốt hơn.", "Lebih baik untuk cetak ulang.", "Mejor para reimprimir."),
    "pj.2x3": pack("Heavier ZIP.", "ZIP 更重。", "ZIP 更重。", "ZIPは重い。", "ZIP이 더 큼.", "ZIP nặng hơn.", "ZIP lebih berat.", "ZIP más pesado."),
    "pj.scaleCap": pack("If the JPG looks soft, raise the scale and export that page again.", "JPG 发虚，就提高倍率再导该页。", "JPG 發虛，就提高倍率再導該頁。", "甘いなら倍率を上げてそのページを再書き出し。", "JPG가 흐리면 배율을 높이고 그 쪽을 다시 보내세요.", "JPG mềm thì tăng tỉ lệ và xuất lại trang đó.", "JPG lembut: naikkan skala dan ekspor halaman itu lagi.", "Si el JPG se ve blando, suba la escala y exporte esa página otra vez."),
    "pj.check": pack("Open a page at 100%", "把一页放到 100%", "把一頁放到 100%", "100%で1ページ開く", "한 쪽을 100%로 열기", "Mở một trang ở 100%", "Buka satu halaman di 100%", "Abra una página al 100%"),
    "pj.l1": pack("Zoom to 100% and read a line of body text.", "放到 100%，读一行正文。", "放到 100%，讀一行正文。", "100%にして本文を1行読む。", "100%로 본문 한 줄을 읽으세요.", "Phóng 100% và đọc một dòng chữ.", "Zoom 100% dan baca satu baris.", "Al 100%, lea una línea de texto."),
    "pj.l2": pack("If digits in a table smear, use 2× and PNG.", "表格数字发糊，就用 2× 和 PNG。", "表格數字發糊，就用 2× 和 PNG。", "表の数字が潰れたら2×とPNG。", "표의 숫자가 뭉개지면 2×와 PNG.", "Số trong bảng nhòe thì dùng 2× và PNG.", "Angka di tabel pecah: 2× dan PNG.", "Si los dígitos de una tabla se corren, use 2× y PNG."),
    "pj.l3": pack("A ZIP of all pages is easier than one-by-one saves.", "多页打 ZIP，比一页页存省事。", "多頁打 ZIP，比一頁頁存省事。", "全ページZIPの方が逐次保存より楽。", "모든 쪽 ZIP이 하나씩 저장보다 쉽습니다.", "ZIP mọi trang dễ hơn lưu từng cái.", "ZIP semua halaman lebih mudah daripada satu-satu.", "Un ZIP de todas las páginas es más fácil que guardar una a una."),
    "pj.checkCap": pack("A thumbnail can look fine while the full page does not.", "缩略图好看，全页不一定好看。", "縮圖好看，全頁不一定好看。", "サムネは良くても実寸は違う。", "썸네일은 괜찮은데 원본은 아닐 수 있습니다.", "Hình nhỏ ổn nhưng trang đầy đủ chưa chắc.", "Thumbnail bagus, halaman penuh belum tentu.", "La miniatura puede verse bien y la página no."),
    "cr.title": pack("How to crop a photo", "怎么裁剪照片", "怎麼裁剪照片", "写真の切り抜き", "사진 자르기", "Cách cắt ảnh", "Cara potong foto", "Cómo recortar una foto"),
    "cr.keep": pack("4:5 keep", "留下 4:5", "留下 4:5", "4:5を残す", "4:5 유지", "Giữ 4:5", "Pertahankan 4:5", "Conserve 4:5"),
    "cr.pick": pack("Pick the ratio first", "先定比例", "先定比例", "先に比率", "비율을 먼저", "Chọn tỉ lệ trước", "Pilih rasio dulu", "Elija el ratio primero"),
    "cr.av": pack("1:1 avatar", "1:1 头像", "1:1 頭像", "1:1 アイコン", "1:1 아바타", "1:1 avatar", "1:1 avatar", "1:1 avatar"),
    "cr.feed": pack("4:5 portrait post", "4:5 竖图帖", "4:5 直圖貼", "4:5 縦投稿", "4:5 세로 게시", "4:5 bài dọc", "4:5 pos potret", "4:5 publicación vertical"),
    "cr.cover": pack("16:9 cover / landscape", "16:9 封面 / 横图", "16:9 封面 / 橫圖", "16:9 カバー / 横", "16:9 커버 / 가로", "16:9 bìa / ngang", "16:9 sampul / lanskap", "16:9 portada / paisaje"),
    "cr.then": pack("Then move the box, not the ratio.", "再挪框，不要改比例。", "再挪框，不要改比例。", "それから枠を動かす。比率は固定。", "그다음 상자를 옮기세요. 비율은 그대로.", "Rồi kéo khung, đừng đổi tỉ lệ.", "Lalu geser kotak, jangan rasio.", "Luego mueva el recuadro, no el ratio."),
    "cr.cap": pack("Cropping throws pixels away. Keep the original file.", "裁剪会丢掉像素。留着原图。", "裁剪會丟掉像素。留著原圖。", "切り抜きは画素を捨てる。元ファイルを残す。", "자르면 픽셀이 사라집니다. 원본을 남기세요.", "Cắt bỏ pixel. Giữ file gốc.", "Crop membuang piksel. Simpan file asli.", "Recortar tira píxeles. Conserve el original."),
    "cr.ratios": pack("Same subject, three ratios", "同一主体，三种比例", "同一主體，三種比例", "同じ被写体、3つの比率", "같은 피사체, 세 비율", "Cùng chủ thể, ba tỉ lệ", "Subjek sama, tiga rasio", "El mismo sujeto, tres ratios"),
    "cr.r11": pack("1:1 avatar", "1:1 头像", "1:1 頭像", "1:1 アイコン", "1:1 아바타", "1:1 avatar", "1:1 avatar", "1:1 avatar"),
    "cr.r45": pack("4:5 feed", "4:5 信息流", "4:5 資訊流", "4:5 フィード", "4:5 피드", "4:5 feed", "4:5 umpan", "4:5 feed"),
    "cr.r169": pack("16:9 cover", "16:9 封面", "16:9 封面", "16:9 カバー", "16:9 커버", "16:9 bìa", "16:9 sampul", "16:9 portada"),
    "cr.ratiosCap": pack("Instagram feed often shows 4:5. Stories are 9:16. Avatars are 1:1.", "信息流常见 4:5。故事 9:16。头像 1:1。", "資訊流常見 4:5。限時動態 9:16。頭像 1:1。", "フィードは4:5が多い。ストーリーは9:16。アイコンは1:1。", "피드은 흔히 4:5. 스토리는 9:16. 아바타는 1:1.", "Feed thường 4:5. Story 9:16. Avatar 1:1.", "Feed sering 4:5. Cerita 9:16. Avatar 1:1.", "El feed suele ser 4:5. Las stories, 9:16. El avatar, 1:1."),
    "cr.edges": pack("Walk the four edges", "走一圈四条边", "走一圈四條邊", "四辺を見る", "네 가장자리를 보세요", "Đi một vòng bốn cạnh", "Cek empat tepi", "Recorra los cuatro bordes"),
    "cr.head": pack("Headroom", "头顶", "頭頂", "頭上", "머리 위", "Trên đầu", "Atas kepala", "Encima de la cabeza"),
    "cr.head2": pack("Do not crop the skull.", "不要切到头骨。", "不要切到頭骨。", "頭を切らない。", "머리를 자르지 마세요.", "Đừng cắt sọ.", "Jangan potong tengkorak.", "No recorte el cráneo."),
    "cr.look": pack("Look space", "视线", "視線", "視線の先", "시선 쪽", "Hướng nhìn", "Arah pandang", "Espacio de mirada"),
    "cr.look2": pack("Leave room they look into.", "往哪看就往哪留空。", "往哪看就往哪留空。", "見ている方向に余白。", "보는 쪽에 공간을 두세요.", "Nhìn đâu thì chừa chỗ đó.", "Sisakan ruang ke arah pandang.", "Deje espacio hacia donde miran."),
    "cr.joint": pack("Joints", "关节", "關節", "関節", "관절", "Khớp", "Sendi", "Articulaciones"),
    "cr.joint2": pack("Do not cut wrists or knees.", "不要切手腕、膝盖。", "不要切手腕、膝蓋。", "手首や膝で切らない。", "손목·무릎을 자르지 마세요.", "Đừng cắt cổ tay, đầu gối.", "Jangan potong pergelangan atau lutut.", "No corte muñecas ni rodillas."),
    "cr.edge": pack("Edges", "边缘", "邊緣", "端", "가장자리", "Cạnh", "Tepi", "Bordes"),
    "cr.edge2": pack("No half-objects on the frame.", "不要半截物体贴边。", "不要半截物體貼邊。", "端に物体を半分残さない。", "가장자리에 반쪽 물건을 두지 마세요.", "Đừng để nửa đồ vật dính mép.", "Jangan objek setengah di tepi.", "Nada a medias en el borde."),
    "cr.edgesCap": pack("Export, reopen, and look at 100%. The crop tool preview is small.", "导出，再打开，放到 100%。裁剪预览很小。", "匯出，再打開，放到 100%。裁剪預覽很小。", "書き出して100%で見る。プレビューは小さい。", "보낸 뒤 100%로 보세요. 자르기 미리보기는 작습니다.", "Xuất, mở lại, xem 100%. Ô cắt rất nhỏ.", "Ekspor, buka lagi, lihat 100%. Pratinjau crop kecil.", "Exporte, reabra y mire al 100%. La vista previa es pequeña."),
}


def lines(loc: str, *keys: str) -> list[str]:
    out = [tx(loc, T[k]) for k in keys]
    return [s for s in out if s]


def files_for(loc: str) -> dict[str, str]:
    out: dict[str, str] = {}
    out["make-qr.svg"] = svg(
        1280,
        720,
        heading(tx(loc, T["qr.title"]))
        + f'''
  <rect x="80" y="120" width="360" height="360" rx="28" fill="#fff" stroke="#c83f79" stroke-width="8"/>
  <rect x="120" y="160" width="80" height="80" fill="#59364b"/>
  <rect x="320" y="160" width="80" height="80" fill="#59364b"/>
  <rect x="120" y="360" width="80" height="80" fill="#59364b"/>
  <rect x="220" y="250" width="40" height="40" fill="#c83f79"/>
  <rect x="280" y="310" width="28" height="28" fill="#59364b"/>
  <rect x="180" y="310" width="20" height="20" fill="#59364b"/>
  <path d="M520 280 h80" stroke="#c83f79" stroke-width="10" stroke-linecap="round"/>
  <polygon points="600,260 660,280 600,300" fill="#c83f79"/>
  <rect x="700" y="180" width="480" height="280" rx="28" fill="#ffe4ee" stroke="#f7b6cb" stroke-width="3"/>
  <text x="740" y="250" fill="#a13f6c" font-size="26" font-weight="700" font-family="{FONT}">{tx(loc, T["qr.s1"])}</text>
  <text x="740" y="300" fill="#59364b" font-size="22" font-family="{FONT}">{xml(qr_url(loc))}</text>
  <text x="740" y="360" fill="#59364b" font-size="22" font-family="{FONT}">{tx(loc, T["qr.s2"])}</text>
  <text x="740" y="410" fill="#59364b" font-size="22" font-family="{FONT}">{tx(loc, T["qr.s3"])}</text>
'''
        + caption(tx(loc, T["qr.cap"]), 640, 80),
        T["qr.title"][loc],
    )
    out["make-qr-contents.svg"] = svg(
        960,
        540,
        heading(tx(loc, T["qr.contents"]))
        + card(40, 100, 280, 320, tx(loc, T["qr.url"]), lines(loc, "qr.url1", "qr.url2", "qr.url3"), True)
        + card(340, 100, 280, 320, tx(loc, T["qr.text"]), lines(loc, "qr.text1", "qr.text2", "qr.text3"))
        + card(640, 100, 280, 320, tx(loc, T["qr.skip"]), lines(loc, "qr.skip1", "qr.skip2", "qr.skip3"))
        + caption(tx(loc, T["qr.contentsCap"])),
        T["qr.contents"][loc],
    )
    out["make-qr-scan.svg"] = svg(
        960,
        540,
        heading(tx(loc, T["qr.scan"]))
        + f'''
  <rect x="80" y="120" width="220" height="300" rx="36" fill="#fff" stroke="#c83f79" stroke-width="6"/>
  <rect x="110" y="160" width="160" height="160" rx="12" fill="#ffe4ee"/>
  <rect x="150" y="360" width="80" height="10" rx="5" fill="#f7b6cb"/>
  <text x="360" y="200" fill="#a13f6c" font-size="24" font-weight="700" font-family="{FONT}">{tx(loc, T["qr.cam"])}</text>
  <text x="360" y="250" fill="#59364b" font-size="20" font-family="{FONT}">{tx(loc, T["qr.hold"])}</text>
  <text x="360" y="300" fill="#59364b" font-size="20" font-family="{FONT}">{tx(loc, T["qr.page"])}</text>
  <text x="360" y="350" fill="#59364b" font-size="20" font-family="{FONT}">{tx(loc, T["qr.quiet"])}</text>
  <text x="360" y="400" fill="#59364b" font-size="20" font-family="{FONT}">{tx(loc, T["qr.size"])}</text>
'''
        + caption(tx(loc, T["qr.scanCap"])),
        T["qr.scan"][loc],
    )
    bars = "\n".join(
        f'      <rect x="{x}" y="30" width="{w}" height="140"/>'
        for x, w in [
            (30, 10), (48, 6), (62, 14), (84, 6), (100, 20), (130, 8), (150, 12),
            (172, 6), (190, 18), (220, 8), (240, 14), (266, 6), (286, 22),
            (320, 8), (340, 12), (364, 6), (382, 16), (410, 8), (430, 20), (462, 10),
        ]
    )
    out["make-barcode.svg"] = svg(
        1280,
        720,
        heading(tx(loc, T["bc.title"]))
        + f'''
  <g transform="translate(80,180)">
    <rect width="560" height="220" rx="16" fill="#fff" stroke="#f2d9e5" stroke-width="3"/>
    <g fill="#59364b">
{bars}
    </g>
    <text x="30" y="200" fill="#876579" font-size="22" font-family="ui-monospace,monospace">6901234567892</text>
  </g>
  <text x="700" y="250" fill="#a13f6c" font-size="24" font-weight="700" font-family="{FONT}">{tx(loc, T["bc.ean"])}</text>
  <text x="700" y="310" fill="#59364b" font-size="22" font-family="{FONT}">{tx(loc, T["bc.128"])}</text>
  <text x="700" y="370" fill="#59364b" font-size="22" font-family="{FONT}">{tx(loc, T["bc.39"])}</text>
'''
        + caption(tx(loc, T["bc.cap"]), 620, 80),
        T["bc.title"][loc],
    )
    out["make-barcode-types.svg"] = svg(
        960,
        540,
        heading(tx(loc, T["bc.types"]))
        + card(40, 100, 280, 330, "Code 128", lines(loc, "bc.128b1", "bc.128b2", "bc.128b3"), True)
        + card(340, 100, 280, 330, "Code 39", lines(loc, "bc.39b1", "bc.39b2", "bc.39b3"))
        + card(640, 100, 280, 330, "EAN-13", lines(loc, "bc.eanb1", "bc.eanb2", "bc.eanb3"))
        + caption(tx(loc, T["bc.typesCap"])),
        T["bc.types"][loc],
    )
    out["make-barcode-digits.svg"] = svg(
        960,
        540,
        heading(tx(loc, T["bc.digits"]), size=28)
        + f'''
  <rect x="60" y="140" width="840" height="160" rx="24" fill="#fff" stroke="#f7b6cb" stroke-width="3"/>
  <text x="90" y="210" fill="#59364b" font-size="36" font-family="ui-monospace,monospace">6 9 0 1 2 3 4 5 6 7 8 9  ?</text>
  <text x="90" y="260" fill="#876579" font-size="18" font-family="{FONT}">{tx(loc, T["bc.parts"])}</text>
  <text x="60" y="380" fill="#59364b" font-size="20" font-family="{FONT}">{tx(loc, T["bc.typeHint"])}</text>
'''
        + caption(tx(loc, T["bc.digitsCap"])),
        T["bc.digits"][loc],
    )
    out["merge-pdf.svg"] = svg(
        1280,
        720,
        heading(tx(loc, T["mg.title"]))
        + f'''
  <g font-family="{FONT}">
    <rect x="80" y="160" width="200" height="260" rx="18" fill="#fff" stroke="#f7b6cb" stroke-width="4"/>
    <text x="110" y="220" fill="#a13f6c" font-size="22" font-weight="700">{tx(loc, T["mg.a"])}</text>
    <rect x="320" y="160" width="200" height="260" rx="18" fill="#fff" stroke="#f7b6cb" stroke-width="4"/>
    <text x="350" y="220" fill="#a13f6c" font-size="22" font-weight="700">{tx(loc, T["mg.b"])}</text>
    <path d="M560 280 h70" stroke="#c83f79" stroke-width="10" stroke-linecap="round"/>
    <polygon points="630,260 690,280 630,300" fill="#c83f79"/>
    <rect x="720" y="140" width="480" height="300" rx="22" fill="#ffe4ee" stroke="#c83f79" stroke-width="4"/>
    <text x="760" y="220" fill="#a13f6c" font-size="26" font-weight="700">{tx(loc, T["mg.one"])}</text>
    <text x="760" y="280" fill="#59364b" font-size="20">{tx(loc, T["mg.order"])}</text>
    <text x="760" y="330" fill="#59364b" font-size="20">{tx(loc, T["mg.reopen"])}</text>
  </g>
'''
        + caption(tx(loc, T["mg.cap"]), 620, 80),
        T["mg.title"][loc],
    )
    out["merge-pdf-order.svg"] = svg(
        960,
        540,
        heading(tx(loc, T["mg.list"]))
        + f'''
  <g font-family="{FONT}" font-size="22" fill="#59364b">
    <rect x="70" y="120" width="360" height="80" rx="16" fill="#ffe4ee" stroke="#c83f79" stroke-width="3"/>
    <text x="100" y="170">{tx(loc, T["mg.cover"])}</text>
    <rect x="70" y="220" width="360" height="80" rx="16" fill="#fff" stroke="#f2d9e5" stroke-width="3"/>
    <text x="100" y="270">{tx(loc, T["mg.contract"])}</text>
    <rect x="70" y="320" width="360" height="80" rx="16" fill="#fff" stroke="#f2d9e5" stroke-width="3"/>
    <text x="100" y="370">{tx(loc, T["mg.app"])}</text>
    <text x="500" y="200" fill="#a13f6c" font-size="24" font-weight="700">{tx(loc, T["mg.drag"])}</text>
    <text x="500" y="250" font-size="18">{tx(loc, T["mg.first"])}</text>
    <text x="500" y="295" font-size="18">{tx(loc, T["mg.empty"])}</text>
    <text x="500" y="340" font-size="18">{tx(loc, T["mg.count"])}</text>
  </g>
'''
        + caption(tx(loc, T["mg.listCap"])),
        T["mg.list"][loc],
    )
    out["merge-pdf-check.svg"] = svg(
        960,
        540,
        heading(tx(loc, T["mg.check"]))
        + f'''
  <g font-family="{FONT}">
    <rect x="80" y="130" width="800" height="280" rx="24" fill="#fff" stroke="#f7b6cb" stroke-width="3"/>
    <text x="120" y="200" fill="#a13f6c" font-size="26" font-weight="700">{tx(loc, T["mg.open"])}</text>
    <text x="120" y="255" fill="#59364b" font-size="20">{tx(loc, T["mg.math"])}</text>
    <text x="120" y="305" fill="#59364b" font-size="20">{tx(loc, T["mg.skim"])}</text>
    <text x="120" y="355" fill="#59364b" font-size="20">{tx(loc, T["mg.missing"])}</text>
  </g>
'''
        + caption(tx(loc, T["mg.checkCap"])),
        T["mg.check"][loc],
    )
    out["compress-pdf.svg"] = svg(
        1280,
        720,
        heading(tx(loc, T["cp.title"]))
        + f'''
  <g font-family="{FONT}">
    <rect x="100" y="180" width="280" height="320" rx="20" fill="#fff" stroke="#f7b6cb" stroke-width="4"/>
    <text x="130" y="250" fill="#a13f6c" font-size="26" font-weight="700">24.1 MB</text>
    <text x="130" y="300" fill="#876579" font-size="18">{tx(loc, T["cp.email"])}</text>
    <path d="M430 330 h90" stroke="#c83f79" stroke-width="10" stroke-linecap="round"/>
    <polygon points="520,310 580,330 520,350" fill="#c83f79"/>
    <rect x="620" y="180" width="280" height="320" rx="20" fill="#ffe4ee" stroke="#c83f79" stroke-width="4"/>
    <text x="650" y="250" fill="#a13f6c" font-size="26" font-weight="700">6.4 MB</text>
    <text x="650" y="300" fill="#59364b" font-size="18">{tx(loc, T["cp.read"])}</text>
  </g>
'''
        + caption(tx(loc, T["cp.cap"]), 620, 100),
        T["cp.title"][loc],
    )
    out["compress-pdf-limit.svg"] = svg(
        960,
        540,
        heading(tx(loc, T["cp.limit"]), size=28)
        + card(50, 110, 270, 300, tx(loc, T["cp.mail"]), lines(loc, "cp.mail1", "cp.mail2", "cp.mail3"), True)
        + card(345, 110, 270, 300, tx(loc, T["cp.form"]), lines(loc, "cp.form1", "cp.form2", "cp.form3"))
        + card(640, 110, 270, 300, tx(loc, T["cp.blur"]), lines(loc, "cp.blur1", "cp.blur2", "cp.blur3"))
        + caption(tx(loc, T["cp.limitCap"])),
        T["cp.limit"][loc],
    )
    out["compress-pdf-quality.svg"] = svg(
        960,
        540,
        heading(tx(loc, T["cp.quality"]), size=28)
        + f'''
  <g font-family="{FONT}">
    <rect x="70" y="130" width="380" height="260" rx="20" fill="#fff" stroke="#f2d9e5" stroke-width="3"/>
    <text x="100" y="190" fill="#876579" font-size="18">{tx(loc, T["cp.hard"])}</text>
    <text x="100" y="250" fill="#a13f6c" font-size="40" font-weight="700">2.1 MB</text>
    <text x="100" y="310" fill="#59364b" font-size="18">{tx(loc, T["cp.mushy"])}</text>
    <rect x="510" y="130" width="380" height="260" rx="20" fill="#ffe4ee" stroke="#c83f79" stroke-width="3"/>
    <text x="540" y="190" fill="#876579" font-size="18">{tx(loc, T["cp.mild"])}</text>
    <text x="540" y="250" fill="#a13f6c" font-size="40" font-weight="700">7.8 MB</text>
    <text x="540" y="310" fill="#59364b" font-size="18">{tx(loc, T["cp.sharp"])}</text>
  </g>
'''
        + caption(tx(loc, T["cp.qualityCap"])),
        T["cp.quality"][loc],
    )
    out["heic-to-jpg.svg"] = svg(
        1280,
        720,
        heading(tx(loc, T["he.title"]))
        + f'''
  <g font-family="{FONT}">
    <rect x="90" y="160" width="320" height="360" rx="28" fill="#ffe4ee" stroke="#c83f79" stroke-width="4"/>
    <text x="130" y="240" fill="#a13f6c" font-size="26" font-weight="700">IMG_0123.HEIC</text>
    <text x="130" y="300" fill="#59364b" font-size="20">{tx(loc, T["he.iphone"])}</text>
    <text x="130" y="350" fill="#876579" font-size="18">{tx(loc, T["he.win"])}</text>
    <text x="130" y="390" fill="#876579" font-size="18">{tx(loc, T["he.fail"])}</text>
    <path d="M460 330 h90" stroke="#c83f79" stroke-width="10" stroke-linecap="round"/>
    <polygon points="550,310 610,330 550,350" fill="#c83f79"/>
    <rect x="650" y="160" width="480" height="360" rx="28" fill="#fff" stroke="#f7b6cb" stroke-width="4"/>
    <text x="700" y="240" fill="#a13f6c" font-size="26" font-weight="700">IMG_0123.jpg</text>
    <text x="700" y="300" fill="#59364b" font-size="20">{tx(loc, T["he.same"])}</text>
    <text x="700" y="360" fill="#59364b" font-size="20">{tx(loc, T["he.open"])}</text>
  </g>
'''
        + caption(tx(loc, T["he.cap"]), 640, 90),
        T["he.title"][loc],
    )
    out["heic-to-jpg-why.svg"] = svg(
        960,
        540,
        heading(tx(loc, T["he.why"]), size=28)
        + card(50, 110, 410, 300, tx(loc, T["he.keep"]), lines(loc, "he.keep1", "he.keep2", "he.keep3"))
        + card(500, 110, 410, 300, tx(loc, T["he.jpg"]), lines(loc, "he.jpg1", "he.jpg2", "he.jpg3"), True)
        + caption(tx(loc, T["he.whyCap"])),
        T["he.why"][loc],
    )
    out["heic-to-jpg-convert.svg"] = svg(
        960,
        540,
        heading(tx(loc, T["he.steps"]), size=28)
        + f'''
  <g font-family="{FONT}" font-size="20" fill="#59364b">
    <rect x="70" y="120" width="820" height="90" rx="18" fill="#ffe4ee" stroke="#c83f79" stroke-width="3"/>
    <text x="100" y="175">{tx(loc, T["he.st1"])}</text>
    <rect x="70" y="230" width="820" height="90" rx="18" fill="#fff" stroke="#f2d9e5" stroke-width="3"/>
    <text x="100" y="285">{tx(loc, T["he.st2"])}</text>
    <rect x="70" y="340" width="820" height="90" rx="18" fill="#fff" stroke="#f2d9e5" stroke-width="3"/>
    <text x="100" y="395">{tx(loc, T["he.st3"])}</text>
  </g>
'''
        + caption(tx(loc, T["he.stepsCap"])),
        T["he.steps"][loc],
    )
    out["jpg-to-pdf.svg"] = svg(
        1280,
        720,
        heading(tx(loc, T["jp.title"]))
        + f'''
  <g font-family="{FONT}">
    <rect x="80" y="180" width="160" height="200" rx="16" fill="#ffe4ee" stroke="#f7b6cb" stroke-width="3"/>
    <rect x="180" y="200" width="160" height="200" rx="16" fill="#fff" stroke="#f7b6cb" stroke-width="3"/>
    <rect x="280" y="220" width="160" height="200" rx="16" fill="#fff" stroke="#c83f79" stroke-width="4"/>
    <path d="M500 320 h80" stroke="#c83f79" stroke-width="10" stroke-linecap="round"/>
    <polygon points="580,300 640,320 580,340" fill="#c83f79"/>
    <rect x="680" y="160" width="460" height="360" rx="20" fill="#fff" stroke="#c83f79" stroke-width="5"/>
    <text x="720" y="240" fill="#a13f6c" font-size="26" font-weight="700">{tx(loc, T["jp.one"])}</text>
    <text x="720" y="300" fill="#59364b" font-size="20">{tx(loc, T["jp.pages"])}</text>
    <text x="720" y="360" fill="#59364b" font-size="20">{tx(loc, T["jp.size"])}</text>
  </g>
'''
        + caption(tx(loc, T["jp.cap"]), 620, 80),
        T["jp.title"][loc],
    )
    out["jpg-to-pdf-page.svg"] = svg(
        960,
        540,
        heading(tx(loc, T["jp.vs"]))
        + card(60, 110, 400, 310, tx(loc, T["jp.a4"]), lines(loc, "jp.a41", "jp.a42", "jp.a43"), True)
        + card(500, 110, 400, 310, tx(loc, T["jp.fit"]), lines(loc, "jp.fit1", "jp.fit2", "jp.fit3"))
        + caption(tx(loc, T["jp.vsCap"])),
        T["jp.vs"][loc],
    )
    out["jpg-to-pdf-pages.svg"] = svg(
        960,
        540,
        heading(tx(loc, T["jp.count"]))
        + f'''
  <g font-family="{FONT}">
    <text x="80" y="180" fill="#59364b" font-size="22">{tx(loc, T["jp.four"])}</text>
    <text x="80" y="240" fill="#c83f79" font-size="40" font-weight="800">{tx(loc, T["jp.arrow"])}</text>
    <text x="80" y="320" fill="#59364b" font-size="20">{tx(loc, T["jp.three"])}</text>
    <text x="80" y="370" fill="#59364b" font-size="20">{tx(loc, T["jp.ff"])}</text>
  </g>
'''
        + caption(tx(loc, T["jp.countCap"])),
        T["jp.count"][loc],
    )
    out["pdf-to-jpg.svg"] = svg(
        1280,
        720,
        heading(tx(loc, T["pj.title"]))
        + f'''
  <g font-family="{FONT}">
    <rect x="90" y="150" width="360" height="400" rx="22" fill="#fff" stroke="#c83f79" stroke-width="5"/>
    <text x="130" y="230" fill="#a13f6c" font-size="24" font-weight="700">{tx(loc, T["pj.scan"])}</text>
    <path d="M500 340 h80" stroke="#c83f79" stroke-width="10" stroke-linecap="round"/>
    <polygon points="580,320 640,340 580,360" fill="#c83f79"/>
    <rect x="680" y="160" width="160" height="200" rx="14" fill="#ffe4ee" stroke="#f7b6cb" stroke-width="3"/>
    <text x="700" y="270" fill="#a13f6c" font-size="18">p1.jpg</text>
    <rect x="860" y="180" width="160" height="200" rx="14" fill="#ffe4ee" stroke="#f7b6cb" stroke-width="3"/>
    <text x="880" y="290" fill="#a13f6c" font-size="18">p2.jpg</text>
    <rect x="1040" y="200" width="160" height="200" rx="14" fill="#ffe4ee" stroke="#f7b6cb" stroke-width="3"/>
    <text x="1060" y="310" fill="#a13f6c" font-size="18">p3.jpg</text>
  </g>
'''
        + caption(tx(loc, T["pj.cap"]), 640, 90),
        T["pj.title"][loc],
    )
    out["pdf-to-jpg-scale.svg"] = svg(
        960,
        540,
        heading(tx(loc, T["pj.scale"]))
        + card(50, 110, 410, 300, "1×", lines(loc, "pj.1x1", "pj.1x2", "pj.1x3"))
        + card(500, 110, 410, 300, "2×", lines(loc, "pj.2x1", "pj.2x2", "pj.2x3"), True)
        + caption(tx(loc, T["pj.scaleCap"])),
        T["pj.scale"][loc],
    )
    out["pdf-to-jpg-check.svg"] = svg(
        960,
        540,
        heading(tx(loc, T["pj.check"]))
        + f'''
  <g font-family="{FONT}" fill="#59364b" font-size="20">
    <rect x="70" y="130" width="820" height="260" rx="22" fill="#fff" stroke="#f7b6cb" stroke-width="3"/>
    <text x="110" y="200">{tx(loc, T["pj.l1"])}</text>
    <text x="110" y="250">{tx(loc, T["pj.l2"])}</text>
    <text x="110" y="300">{tx(loc, T["pj.l3"])}</text>
  </g>
'''
        + caption(tx(loc, T["pj.checkCap"])),
        T["pj.check"][loc],
    )
    out["crop-photo.svg"] = svg(
        1280,
        720,
        heading(tx(loc, T["cr.title"]))
        + f'''
  <g font-family="{FONT}">
    <rect x="80" y="140" width="640" height="420" rx="24" fill="#ffe4ee"/>
    <rect x="180" y="180" width="360" height="340" rx="8" fill="none" stroke="#c83f79" stroke-width="8"/>
    <text x="200" y="230" fill="#a13f6c" font-size="22" font-weight="700">{tx(loc, T["cr.keep"])}</text>
    <text x="780" y="230" fill="#a13f6c" font-size="24" font-weight="700">{tx(loc, T["cr.pick"])}</text>
    <text x="780" y="290" fill="#59364b" font-size="20">{tx(loc, T["cr.av"])}</text>
    <text x="780" y="340" fill="#59364b" font-size="20">{tx(loc, T["cr.feed"])}</text>
    <text x="780" y="390" fill="#59364b" font-size="20">{tx(loc, T["cr.cover"])}</text>
    <text x="780" y="460" fill="#59364b" font-size="20">{tx(loc, T["cr.then"])}</text>
  </g>
'''
        + caption(tx(loc, T["cr.cap"]), 640, 80),
        T["cr.title"][loc],
    )
    out["crop-photo-ratios.svg"] = svg(
        960,
        540,
        heading(tx(loc, T["cr.ratios"]))
        + f'''
  <g font-family="{FONT}">
    <rect x="50" y="100" width="240" height="240" rx="16" fill="#ffe4ee" stroke="#c83f79" stroke-width="4"/>
    <circle cx="170" cy="175" r="28" fill="#c83f79"/>
    <ellipse cx="170" cy="255" rx="55" ry="62" fill="#c83f79"/>
    <text x="70" y="380" fill="#a13f6c" font-size="20" font-weight="700">{tx(loc, T["cr.r11"])}</text>
    <rect x="340" y="80" width="220" height="275" rx="16" fill="#ffe4ee" stroke="#c83f79" stroke-width="4"/>
    <circle cx="450" cy="165" r="28" fill="#c83f79"/>
    <ellipse cx="450" cy="255" rx="55" ry="70" fill="#c83f79"/>
    <text x="360" y="400" fill="#a13f6c" font-size="20" font-weight="700">{tx(loc, T["cr.r45"])}</text>
    <rect x="610" y="145" width="300" height="170" rx="16" fill="#ffe4ee" stroke="#c83f79" stroke-width="4"/>
    <circle cx="760" cy="200" r="24" fill="#c83f79"/>
    <ellipse cx="760" cy="268" rx="70" ry="38" fill="#c83f79"/>
    <text x="630" y="360" fill="#a13f6c" font-size="20" font-weight="700">{tx(loc, T["cr.r169"])}</text>
  </g>
'''
        + caption(tx(loc, T["cr.ratiosCap"])),
        T["cr.ratios"][loc],
    )
    out["crop-photo-edges.svg"] = svg(
        960,
        540,
        heading(tx(loc, T["cr.edges"]))
        + f'''
  <rect x="310" y="90" width="340" height="300" rx="16" fill="#ffe4ee" stroke="#c83f79" stroke-width="6"/>
  <circle cx="480" cy="185" r="32" fill="#c83f79"/>
  <ellipse cx="480" cy="290" rx="70" ry="78" fill="#c83f79"/>
  <g font-family="{FONT}" fill="#a13f6c" font-size="20" font-weight="700">
    <text x="70" y="140">{tx(loc, T["cr.head"])}</text>
    <text x="70" y="170" fill="#59364b" font-size="16" font-weight="400">{tx(loc, T["cr.head2"])}</text>
    <text x="680" y="180">{tx(loc, T["cr.look"])}</text>
    <text x="680" y="210" fill="#59364b" font-size="16" font-weight="400">{tx(loc, T["cr.look2"])}</text>
    <text x="70" y="360">{tx(loc, T["cr.joint"])}</text>
    <text x="70" y="390" fill="#59364b" font-size="16" font-weight="400">{tx(loc, T["cr.joint2"])}</text>
    <text x="680" y="360">{tx(loc, T["cr.edge"])}</text>
    <text x="680" y="390" fill="#59364b" font-size="16" font-weight="400">{tx(loc, T["cr.edge2"])}</text>
  </g>
'''
        + caption(tx(loc, T["cr.edgesCap"])),
        T["cr.edges"][loc],
    )
    return out


def main() -> None:
    ROOT.mkdir(parents=True, exist_ok=True)
    for loc in LOCS:
        folder = FOLDERS[loc]
        dest = ROOT if not folder else ROOT / folder
        dest.mkdir(parents=True, exist_ok=True)
        for name, body in files_for(loc).items():
            path = dest / name
            path.write_text(body, encoding="utf-8")
            rel = path.relative_to(ROOT.parent.parent.parent)
            print("wrote", rel, path.stat().st_size)


if __name__ == "__main__":
    main()
