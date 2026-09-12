function u(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.byteLength, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.byteLength;
  }
  return out;
}

export type PdfJpegPage = { jpeg: Uint8Array; width: number; height: number };
export type PdfPageMode = "a4" | "letter" | "fit";

export const PDF_PAGE = {
  a4: { w: 595.28, h: 841.89 },
  letter: { w: 612, h: 792 },
} as const;

const MARGIN = 24;

export function mediaBox(page: PdfJpegPage, mode: PdfPageMode): { w: number; h: number } {
  if (mode !== "fit") return PDF_PAGE[mode];
  const long = PDF_PAGE.a4.h;
  const max = Math.max(page.width, page.height) || 1;
  return { w: (page.width / max) * long, h: (page.height / max) * long };
}

export function pdfFromJpegs(pages: PdfJpegPage[], mode: PdfPageMode = "a4"): Uint8Array {
  if (pages.length === 0) throw new Error("empty");
  const n = pages.length;
  const objs: Uint8Array[] = [];
  objs[1] = u("<< /Type /Catalog /Pages 2 0 R >>");
  const kids = Array.from({ length: n }, (_, i) => `${3 + i} 0 R`).join(" ");
  objs[2] = u(`<< /Type /Pages /Kids [${kids}] /Count ${n} >>`);

  const contentId = (i: number) => 3 + n + i;
  const imageId = (i: number) => 3 + 2 * n + i;

  pages.forEach((page, i) => {
    const media = mediaBox(page, mode);
    const box = fit(page.width, page.height, Math.max(1, media.w - MARGIN * 2), Math.max(1, media.h - MARGIN * 2));
    const x = (media.w - box.w) / 2;
    const y = (media.h - box.h) / 2;
    const stream = u(`q ${box.w.toFixed(2)} 0 0 ${box.h.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm /Im${i} Do Q`);
    objs[3 + i] = u(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${media.w.toFixed(2)} ${media.h.toFixed(2)}] /Resources << /XObject << /Im${i} ${imageId(i)} 0 R >> >> /Contents ${contentId(i)} 0 R >>`,
    );
    objs[contentId(i)] = concat([
      u(`<< /Length ${stream.byteLength} >>\nstream\n`),
      stream,
      u("\nendstream"),
    ]);
    objs[imageId(i)] = concat([
      u(
        `<< /Type /XObject /Subtype /Image /Width ${Math.round(page.width)} /Height ${Math.round(page.height)} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpeg.byteLength} >>\nstream\n`,
      ),
      page.jpeg,
      u("\nendstream"),
    ]);
  });

  const chunks: Uint8Array[] = [u("%PDF-1.4\n")];
  const offsets = [0];
  let pos = chunks[0].byteLength;
  const maxId = 2 + 3 * n;
  for (let id = 1; id <= maxId; id++) {
    offsets[id] = pos;
    const body = concat([u(`${id} 0 obj\n`), objs[id], u("\nendobj\n")]);
    chunks.push(body);
    pos += body.byteLength;
  }
  const xrefPos = pos;
  let xref = `xref\n0 ${maxId + 1}\n0000000000 65535 f \n`;
  for (let id = 1; id <= maxId; id++) {
    xref += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }
  const tail = u(
    `${xref}trailer\n<< /Size ${maxId + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`,
  );
  chunks.push(tail);
  return concat(chunks);
}

function fit(w: number, h: number, maxW: number, maxH: number): { w: number; h: number } {
  const s = Math.min(maxW / w, maxH / h);
  return { w: w * s, h: h * s };
}
