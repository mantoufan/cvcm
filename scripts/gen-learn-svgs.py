#!/usr/bin/env python3
"""Instructional SVGs for the first keyword-backed lessons."""
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "public" / "covers" / "tutorials"
PINK = "#c83f79"
DEEP = "#a13f6c"
SOFT = "#ffe4ee"
INK = "#59364b"
MUTED = "#876579"
LINE = "#f2d9e5"
WHITE = "#fff7fb"
CARD = "#ffffff"

def svg(w: int, h: int, inner: str, label: str) -> str:
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" role="img" aria-label="{label}">
  <rect width="{w}" height="{h}" rx="28" fill="{WHITE}"/>
  {inner}
</svg>
'''

def card(x, y, w, h, title, lines, accent=False):
    fill = SOFT if accent else CARD
    stroke = PINK if accent else LINE
    tspan = "".join(
        f'<tspan x="{x + 22}" dy="{22 if i else 0}">{line}</tspan>'
        for i, line in enumerate(lines)
    )
    return f'''
  <rect x="{x}" y="{y}" width="{w}" height="{h}" rx="22" fill="{fill}" stroke="{stroke}" stroke-width="3"/>
  <text x="{x + 22}" y="{y + 40}" fill="{DEEP}" font-size="22" font-weight="700" font-family="system-ui,sans-serif">{title}</text>
  <text x="{x + 22}" y="{y + 72}" fill="{INK}" font-size="18" font-family="system-ui,sans-serif">{tspan}</text>
'''

def title(text, x=48, y=54):
    return f'<text x="{x}" y="{y}" fill="{DEEP}" font-size="32" font-weight="800" font-family="system-ui,sans-serif">{text}</text>'

def caption(text, y=500, x=48):
    return f'<text x="{x}" y="{y}" fill="{MUTED}" font-size="18" font-family="system-ui,sans-serif">{text}</text>'

FILES: dict[str, str] = {}

FILES["make-qr.svg"] = svg(1280, 720, title("How to make a QR code") + '''
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
  <text x="740" y="250" fill="#a13f6c" font-size="28" font-weight="700" font-family="system-ui,sans-serif">1. Put a full URL in</text>
  <text x="740" y="300" fill="#59364b" font-size="24" font-family="system-ui,sans-serif">https://cv.cm/en/qr/</text>
  <text x="740" y="360" fill="#59364b" font-size="24" font-family="system-ui,sans-serif">2. Download PNG</text>
  <text x="740" y="410" fill="#59364b" font-size="24" font-family="system-ui,sans-serif">3. Scan with a phone before you print</text>
''' + caption("A QR code is only a door. Test the door before you print fifty copies.", 640, 80), "How to make a QR code")

FILES["make-qr-contents.svg"] = svg(960, 540, title("What should the code open?") +
    card(40, 100, 280, 320, "URL", ["A page, menu,", "or payment link.", "Use https."], True) +
    card(340, 100, 280, 320, "Plain text", ["A Wi-Fi name,", "table number,", "or short note."]) +
    card(640, 100, 280, 320, "Skip", ["Do not encode a", "file. Host the file,", "encode the link."]) +
    caption("If the destination can change, encode a short URL you control."), "QR code contents")

FILES["make-qr-scan.svg"] = svg(960, 540, title("Scan before you print") + '''
  <rect x="80" y="120" width="220" height="300" rx="36" fill="#fff" stroke="#c83f79" stroke-width="6"/>
  <rect x="110" y="160" width="160" height="160" rx="12" fill="#ffe4ee"/>
  <rect x="150" y="360" width="80" height="10" rx="5" fill="#f7b6cb"/>
  <text x="360" y="200" fill="#a13f6c" font-size="26" font-weight="700" font-family="system-ui,sans-serif">Camera preview</text>
  <text x="360" y="250" fill="#59364b" font-size="22" font-family="system-ui,sans-serif">Hold the phone 20–30 cm away.</text>
  <text x="360" y="300" fill="#59364b" font-size="22" font-family="system-ui,sans-serif">The page must open, not a search box.</text>
  <text x="360" y="350" fill="#59364b" font-size="22" font-family="system-ui,sans-serif">Quiet zone: leave a white margin.</text>
  <text x="360" y="400" fill="#59364b" font-size="22" font-family="system-ui,sans-serif">Print at least 2 cm wide. Do not stretch.</text>
''' + caption("A code that fails in your kitchen will fail on the door."), "Scan a QR code before printing")

FILES["make-barcode.svg"] = svg(1280, 720, title("How to make a barcode") + '''
  <g transform="translate(80,180)">
    <rect width="560" height="220" rx="16" fill="#fff" stroke="#f2d9e5" stroke-width="3"/>
    <g fill="#59364b">
      <rect x="30" y="30" width="10" height="140"/>
      <rect x="48" y="30" width="6" height="140"/>
      <rect x="62" y="30" width="14" height="140"/>
      <rect x="84" y="30" width="6" height="140"/>
      <rect x="100" y="30" width="20" height="140"/>
      <rect x="130" y="30" width="8" height="140"/>
      <rect x="150" y="30" width="12" height="140"/>
      <rect x="172" y="30" width="6" height="140"/>
      <rect x="190" y="30" width="18" height="140"/>
      <rect x="220" y="30" width="8" height="140"/>
      <rect x="240" y="30" width="14" height="140"/>
      <rect x="266" y="30" width="6" height="140"/>
      <rect x="286" y="30" width="22" height="140"/>
      <rect x="320" y="30" width="8" height="140"/>
      <rect x="340" y="30" width="12" height="140"/>
      <rect x="364" y="30" width="6" height="140"/>
      <rect x="382" y="30" width="16" height="140"/>
      <rect x="410" y="30" width="8" height="140"/>
      <rect x="430" y="30" width="20" height="140"/>
      <rect x="462" y="30" width="10" height="140"/>
    </g>
    <text x="30" y="200" fill="#876579" font-size="22" font-family="ui-monospace,monospace">6901234567892</text>
  </g>
  <text x="700" y="250" fill="#a13f6c" font-size="28" font-weight="700" font-family="system-ui,sans-serif">EAN-13 for products</text>
  <text x="700" y="310" fill="#59364b" font-size="24" font-family="system-ui,sans-serif">Code 128 for inventory and tickets</text>
  <text x="700" y="370" fill="#59364b" font-size="24" font-family="system-ui,sans-serif">Code 39 if the scanner is old</text>
''' + caption("A barcode is digits a scanner can read. Test with the scanner you will use.", 620, 80), "How to make a barcode")

FILES["make-barcode-types.svg"] = svg(960, 540, title("Pick the symbology first") +
    card(40, 100, 280, 330, "Code 128", ["Letters and digits.", "Warehouse, tickets,", "internal IDs."], True) +
    card(340, 100, 280, 330, "Code 39", ["Older scanners.", "Uppercase, digits,", "a few symbols."]) +
    card(640, 100, 280, 330, "EAN-13", ["Retail products.", "12 digits + check.", "Not a URL."]) +
    caption("QR codes open links. Barcodes identify a thing. Do not mix them."), "Barcode types")

FILES["make-barcode-digits.svg"] = svg(960, 540, title("EAN-13 is 12 digits plus a check") + '''
  <rect x="60" y="140" width="840" height="160" rx="24" fill="#fff" stroke="#f7b6cb" stroke-width="3"/>
  <text x="90" y="210" fill="#59364b" font-size="36" font-family="ui-monospace,monospace">6 9 0 1 2 3 4 5 6 7 8 9  ?</text>
  <text x="90" y="260" fill="#876579" font-size="20" font-family="system-ui,sans-serif">country / company / item          check digit</text>
  <text x="60" y="380" fill="#59364b" font-size="22" font-family="system-ui,sans-serif">Type 12 digits. The tool adds the check digit. If a shop scanner rejects it, the check is wrong or the prefix is not yours.</text>
''' + caption("Do not invent a retail EAN that belongs to someone else."), "EAN-13 check digit")

FILES["merge-pdf.svg"] = svg(1280, 720, title("How to merge PDF files") + '''
  <g font-family="system-ui,sans-serif">
    <rect x="80" y="160" width="200" height="260" rx="18" fill="#fff" stroke="#f7b6cb" stroke-width="4"/>
    <text x="110" y="220" fill="#a13f6c" font-size="22" font-weight="700">A · 3 pages</text>
    <rect x="320" y="160" width="200" height="260" rx="18" fill="#fff" stroke="#f7b6cb" stroke-width="4"/>
    <text x="350" y="220" fill="#a13f6c" font-size="22" font-weight="700">B · 2 pages</text>
    <path d="M560 280 h70" stroke="#c83f79" stroke-width="10" stroke-linecap="round"/>
    <polygon points="630,260 690,280 630,300" fill="#c83f79"/>
    <rect x="720" y="140" width="480" height="300" rx="22" fill="#ffe4ee" stroke="#c83f79" stroke-width="4"/>
    <text x="760" y="220" fill="#a13f6c" font-size="28" font-weight="700">One file · 5 pages</text>
    <text x="760" y="280" fill="#59364b" font-size="22">Order is the list order.</text>
    <text x="760" y="330" fill="#59364b" font-size="22">Reopen the download and count.</text>
  </g>
''' + caption("Password-locked PDFs often cannot be merged until you unlock them.", 620, 80), "How to merge PDF files")

FILES["merge-pdf-order.svg"] = svg(960, 540, title("List order is page order") + '''
  <g font-family="system-ui,sans-serif" font-size="22" fill="#59364b">
    <rect x="70" y="120" width="360" height="80" rx="16" fill="#ffe4ee" stroke="#c83f79" stroke-width="3"/>
    <text x="100" y="170">1  Cover.pdf</text>
    <rect x="70" y="220" width="360" height="80" rx="16" fill="#fff" stroke="#f2d9e5" stroke-width="3"/>
    <text x="100" y="270">2  Contract.pdf</text>
    <rect x="70" y="320" width="360" height="80" rx="16" fill="#fff" stroke="#f2d9e5" stroke-width="3"/>
    <text x="100" y="370">3  Appendix.pdf</text>
    <text x="500" y="200" fill="#a13f6c" font-size="26" font-weight="700">Drag to reorder</text>
    <text x="500" y="260">The first row becomes page 1.</text>
    <text x="500" y="310">Empty pages in a source stay empty.</text>
    <text x="500" y="360">Check the page count after export.</text>
  </g>
''' + caption("If page 1 is wrong, the list was wrong — not the download."), "PDF merge order")

FILES["merge-pdf-check.svg"] = svg(960, 540, title("Verify the merged file") + '''
  <g font-family="system-ui,sans-serif">
    <rect x="80" y="130" width="800" height="280" rx="24" fill="#fff" stroke="#f7b6cb" stroke-width="3"/>
    <text x="120" y="210" fill="#a13f6c" font-size="28" font-weight="700">Open the download</text>
    <text x="120" y="270" fill="#59364b" font-size="22">3 + 2 + 4 source pages should be 9 pages.</text>
    <text x="120" y="320" fill="#59364b" font-size="22">Skim the first page of each original block.</text>
    <text x="120" y="370" fill="#59364b" font-size="22">If a file is missing, it was locked or not added.</text>
  </g>
''' + caption("Do not send the file until you have opened it once."), "Check merged PDF page count")

FILES["compress-pdf.svg"] = svg(1280, 720, title("How to compress a PDF") + '''
  <g font-family="system-ui,sans-serif">
    <rect x="100" y="180" width="280" height="320" rx="20" fill="#fff" stroke="#f7b6cb" stroke-width="4"/>
    <text x="130" y="250" fill="#a13f6c" font-size="26" font-weight="700">24.1 MB</text>
    <text x="130" y="300" fill="#876579" font-size="20">email limit 10 MB</text>
    <path d="M430 330 h90" stroke="#c83f79" stroke-width="10" stroke-linecap="round"/>
    <polygon points="520,310 580,330 520,350" fill="#c83f79"/>
    <rect x="620" y="180" width="280" height="320" rx="20" fill="#ffe4ee" stroke="#c83f79" stroke-width="4"/>
    <text x="650" y="250" fill="#a13f6c" font-size="26" font-weight="700">6.4 MB</text>
    <text x="650" y="300" fill="#59364b" font-size="20">pages still readable</text>
  </g>
''' + caption("Compression re-encodes pages. Open a photo-heavy page after export.", 620, 100), "How to compress a PDF")

FILES["compress-pdf-limit.svg"] = svg(960, 540, title("Match the limit you actually have") +
    card(50, 110, 270, 300, "Email", ["Often 10–25 MB.", "Compress, then", "attach once."], True) +
    card(345, 110, 270, 300, "Form upload", ["Read the field.", "Some want 2 MB.", "Some want 20."]) +
    card(640, 110, 270, 300, "Too blurry", ["Use less JPEG", "quality loss.", "Or split the PDF."]) +
    caption("A smaller file that nobody can read is not a success."), "PDF size limits")

FILES["compress-pdf-quality.svg"] = svg(960, 540, title("Compare size against a real page") + '''
  <g font-family="system-ui,sans-serif">
    <rect x="70" y="130" width="380" height="260" rx="20" fill="#fff" stroke="#f2d9e5" stroke-width="3"/>
    <text x="100" y="190" fill="#876579" font-size="20">Stronger compression</text>
    <text x="100" y="250" fill="#a13f6c" font-size="40" font-weight="700">2.1 MB</text>
    <text x="100" y="310" fill="#59364b" font-size="20">Text OK · photos mushy</text>
    <rect x="510" y="130" width="380" height="260" rx="20" fill="#ffe4ee" stroke="#c83f79" stroke-width="3"/>
    <text x="540" y="190" fill="#876579" font-size="20">Milder compression</text>
    <text x="540" y="250" fill="#a13f6c" font-size="40" font-weight="700">7.8 MB</text>
    <text x="540" y="310" fill="#59364b" font-size="20">Photos still sharp</text>
  </g>
''' + caption("Pick the largest file that still fits the limit."), "PDF compression quality")

FILES["heic-to-jpg.svg"] = svg(1280, 720, title("How to convert HEIC to JPG") + '''
  <g font-family="system-ui,sans-serif">
    <rect x="90" y="160" width="320" height="360" rx="28" fill="#ffe4ee" stroke="#c83f79" stroke-width="4"/>
    <text x="130" y="240" fill="#a13f6c" font-size="28" font-weight="700">IMG_0123.HEIC</text>
    <text x="130" y="300" fill="#59364b" font-size="22">iPhone default</text>
    <text x="130" y="350" fill="#876579" font-size="20">Windows / WeChat</text>
    <text x="130" y="390" fill="#876579" font-size="20">often cannot open it</text>
    <path d="M460 330 h90" stroke="#c83f79" stroke-width="10" stroke-linecap="round"/>
    <polygon points="550,310 610,330 550,350" fill="#c83f79"/>
    <rect x="650" y="160" width="480" height="360" rx="28" fill="#fff" stroke="#f7b6cb" stroke-width="4"/>
    <text x="700" y="240" fill="#a13f6c" font-size="28" font-weight="700">IMG_0123.jpg</text>
    <text x="700" y="300" fill="#59364b" font-size="22">Same pixels, common format</text>
    <text x="700" y="360" fill="#59364b" font-size="22">Open it on the PC before sending</text>
  </g>
''' + caption("Safari and Chromium can decode HEIC. Firefox on Windows often cannot.", 640, 90), "How to convert HEIC to JPG")

FILES["heic-to-jpg-why.svg"] = svg(960, 540, title("HEIC is smaller. JPG is compatible.") +
    card(50, 110, 410, 300, "Keep HEIC", ["On your phone.", "In iCloud.", "When space matters."]) +
    card(500, 110, 410, 300, "Export JPG", ["Windows PCs.", "School forms.", "Chat apps that reject HEIC."], True) +
    caption("Convert a copy. Keep the original HEIC if you still edit on iPhone."), "Why convert HEIC")

FILES["heic-to-jpg-convert.svg"] = svg(960, 540, title("Drop the file, pick JPG, download") + '''
  <g font-family="system-ui,sans-serif" font-size="22" fill="#59364b">
    <rect x="70" y="120" width="820" height="90" rx="18" fill="#ffe4ee" stroke="#c83f79" stroke-width="3"/>
    <text x="100" y="175">1  Open cv.cm in Safari or Chrome</text>
    <rect x="70" y="230" width="820" height="90" rx="18" fill="#fff" stroke="#f2d9e5" stroke-width="3"/>
    <text x="100" y="285">2  Drop .HEIC files · choose JPG</text>
    <rect x="70" y="340" width="820" height="90" rx="18" fill="#fff" stroke="#f2d9e5" stroke-width="3"/>
    <text x="100" y="395">3  Download · open the JPG once</text>
  </g>
''' + caption("If the preview is blank, this browser cannot decode HEIC. Switch browser."), "HEIC conversion steps")

FILES["jpg-to-pdf.svg"] = svg(1280, 720, title("How to convert JPG to PDF") + '''
  <g font-family="system-ui,sans-serif">
    <rect x="80" y="180" width="160" height="200" rx="16" fill="#ffe4ee" stroke="#f7b6cb" stroke-width="3"/>
    <rect x="180" y="200" width="160" height="200" rx="16" fill="#fff" stroke="#f7b6cb" stroke-width="3"/>
    <rect x="280" y="220" width="160" height="200" rx="16" fill="#fff" stroke="#c83f79" stroke-width="4"/>
    <path d="M500 320 h80" stroke="#c83f79" stroke-width="10" stroke-linecap="round"/>
    <polygon points="580,300 640,320 580,340" fill="#c83f79"/>
    <rect x="680" y="160" width="460" height="360" rx="20" fill="#fff" stroke="#c83f79" stroke-width="5"/>
    <text x="720" y="240" fill="#a13f6c" font-size="26" font-weight="700">one PDF</text>
    <text x="720" y="300" fill="#59364b" font-size="22">page 1 · page 2 · page 3</text>
    <text x="720" y="360" fill="#59364b" font-size="22">A4, Letter, or fit-to-photo</text>
  </g>
''' + caption("List order is page order. Reopen the PDF and flip through it.", 620, 80), "How to convert JPG to PDF")

FILES["jpg-to-pdf-page.svg"] = svg(960, 540, title("A4 vs fit-to-photo") +
    card(60, 110, 400, 310, "A4 / Letter", ["Forms and printers.", "Photos get margins.", "Use for homework."], True) +
    card(500, 110, 400, 310, "Fit to photo", ["One image fills the page.", "Better for a lookbook.", "Worse for office printers."]) +
    caption("If a printer crops the edge, you picked fit-to-photo on an A4 job."), "PDF page size")

FILES["jpg-to-pdf-pages.svg"] = svg(960, 540, title("Count pages after export") + '''
  <g font-family="system-ui,sans-serif">
    <text x="80" y="180" fill="#59364b" font-size="24">4 photos dropped</text>
    <text x="80" y="240" fill="#c83f79" font-size="40" font-weight="800">→ 4 pages</text>
    <text x="80" y="320" fill="#59364b" font-size="22">If you see 3, one file failed to decode.</text>
    <text x="80" y="370" fill="#59364b" font-size="22">HEIC may fail in Firefox — convert to JPG first.</text>
  </g>
''' + caption("Open the PDF. Do not trust the download toast alone."), "Verify JPG to PDF pages")

FILES["pdf-to-jpg.svg"] = svg(1280, 720, title("How to convert PDF to JPG") + '''
  <g font-family="system-ui,sans-serif">
    <rect x="90" y="150" width="360" height="400" rx="22" fill="#fff" stroke="#c83f79" stroke-width="5"/>
    <text x="130" y="230" fill="#a13f6c" font-size="26" font-weight="700">scan.pdf · 3 pages</text>
    <path d="M500 340 h80" stroke="#c83f79" stroke-width="10" stroke-linecap="round"/>
    <polygon points="580,320 640,340 580,360" fill="#c83f79"/>
    <rect x="680" y="160" width="160" height="200" rx="14" fill="#ffe4ee" stroke="#f7b6cb" stroke-width="3"/>
    <text x="700" y="270" fill="#a13f6c" font-size="18">p1.jpg</text>
    <rect x="860" y="180" width="160" height="200" rx="14" fill="#ffe4ee" stroke="#f7b6cb" stroke-width="3"/>
    <text x="880" y="290" fill="#a13f6c" font-size="18">p2.jpg</text>
    <rect x="1040" y="200" width="160" height="200" rx="14" fill="#ffe4ee" stroke="#f7b6cb" stroke-width="3"/>
    <text x="1060" y="310" fill="#a13f6c" font-size="18">p3.jpg</text>
  </g>
''' + caption("Each PDF page becomes one image. Choose scale before you download.", 640, 90), "How to convert PDF to JPG")

FILES["pdf-to-jpg-scale.svg"] = svg(960, 540, title("Scale is resolution") +
    card(50, 110, 410, 300, "1×", ["Smaller files.", "Fine for chat.", "Blurry if you zoom."]) +
    card(500, 110, 410, 300, "2×", ["Sharper type.", "Better for reprint.", "Heavier ZIP."], True) +
    caption("If the JPG looks soft, raise the scale and export that page again."), "PDF to JPG scale")

FILES["pdf-to-jpg-check.svg"] = svg(960, 540, title("Open a page at 100%") + '''
  <g font-family="system-ui,sans-serif" fill="#59364b" font-size="22">
    <rect x="70" y="130" width="820" height="260" rx="22" fill="#fff" stroke="#f7b6cb" stroke-width="3"/>
    <text x="110" y="200">Zoom to 100% and read a line of body text.</text>
    <text x="110" y="250">If digits in a table smear, use 2× and PNG.</text>
    <text x="110" y="300">A ZIP of all pages is easier than one-by-one saves.</text>
  </g>
''' + caption("A thumbnail can look fine while the full page does not."), "Check PDF to JPG output")

FILES["crop-photo.svg"] = svg(1280, 720, title("How to crop a photo") + '''
  <g font-family="system-ui,sans-serif">
    <rect x="80" y="140" width="640" height="420" rx="24" fill="#ffe4ee"/>
    <rect x="180" y="180" width="360" height="340" rx="8" fill="none" stroke="#c83f79" stroke-width="8"/>
    <text x="200" y="230" fill="#a13f6c" font-size="22" font-weight="700">4:5 keep</text>
    <text x="780" y="230" fill="#a13f6c" font-size="26" font-weight="700">Pick the ratio first</text>
    <text x="780" y="290" fill="#59364b" font-size="22">1:1 avatar</text>
    <text x="780" y="340" fill="#59364b" font-size="22">4:5 portrait post</text>
    <text x="780" y="390" fill="#59364b" font-size="22">16:9 cover / landscape</text>
    <text x="780" y="460" fill="#59364b" font-size="22">Then move the box, not the ratio.</text>
  </g>
''' + caption("Cropping throws pixels away. Keep the original file.", 640, 80), "How to crop a photo")

FILES["crop-photo-ratios.svg"] = svg(960, 540, title("Same subject, three ratios") + '''
  <g font-family="system-ui,sans-serif">
    <rect x="50" y="100" width="240" height="240" rx="16" fill="#ffe4ee" stroke="#c83f79" stroke-width="4"/>
    <circle cx="170" cy="175" r="28" fill="#c83f79"/>
    <ellipse cx="170" cy="255" rx="55" ry="62" fill="#c83f79"/>
    <text x="70" y="380" fill="#a13f6c" font-size="20" font-weight="700">1:1 avatar</text>
    <rect x="340" y="80" width="220" height="275" rx="16" fill="#ffe4ee" stroke="#c83f79" stroke-width="4"/>
    <circle cx="450" cy="165" r="28" fill="#c83f79"/>
    <ellipse cx="450" cy="255" rx="55" ry="70" fill="#c83f79"/>
    <text x="360" y="400" fill="#a13f6c" font-size="20" font-weight="700">4:5 feed</text>
    <rect x="610" y="145" width="300" height="170" rx="16" fill="#ffe4ee" stroke="#c83f79" stroke-width="4"/>
    <circle cx="760" cy="200" r="24" fill="#c83f79"/>
    <ellipse cx="760" cy="268" rx="70" ry="38" fill="#c83f79"/>
    <text x="630" y="360" fill="#a13f6c" font-size="20" font-weight="700">16:9 cover</text>
  </g>
''' + caption("Instagram feed often shows 4:5. Stories are 9:16. Avatars are 1:1."), "Crop ratios")

FILES["crop-photo-edges.svg"] = svg(960, 540, title("Walk the four edges") + '''
  <rect x="310" y="90" width="340" height="300" rx="16" fill="#ffe4ee" stroke="#c83f79" stroke-width="6"/>
  <circle cx="480" cy="185" r="32" fill="#c83f79"/>
  <ellipse cx="480" cy="290" rx="70" ry="78" fill="#c83f79"/>
  <g font-family="system-ui,sans-serif" fill="#a13f6c" font-size="20" font-weight="700">
    <text x="70" y="140">Headroom</text>
    <text x="70" y="170" fill="#59364b" font-size="16" font-weight="400">Do not crop the skull.</text>
    <text x="680" y="180">Look space</text>
    <text x="680" y="210" fill="#59364b" font-size="16" font-weight="400">Leave room they look into.</text>
    <text x="70" y="360">Joints</text>
    <text x="70" y="390" fill="#59364b" font-size="16" font-weight="400">Do not cut wrists or knees.</text>
    <text x="680" y="360">Edges</text>
    <text x="680" y="390" fill="#59364b" font-size="16" font-weight="400">No half-objects on the frame.</text>
  </g>
''' + caption("Export, reopen, and look at 100%. The crop tool preview is small."), "Check crop edges")

def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for name, body in FILES.items():
        path = OUT / name
        path.write_text(body)
        print("wrote", path.relative_to(OUT.parent.parent.parent), path.stat().st_size)

if __name__ == "__main__":
    main()
