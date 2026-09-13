export async function mergePdfBuffers(buffers: Array<ArrayBuffer | Uint8Array>): Promise<Uint8Array> {
  const { PDFDocument } = await import("pdf-lib");
  const out = await PDFDocument.create();
  for (const buf of buffers) {
    const src = await PDFDocument.load(buf, { ignoreEncryption: true });
    const copied = await out.copyPages(src, src.getPageIndices());
    for (const page of copied) out.addPage(page);
  }
  if (out.getPageCount() === 0) throw new Error("empty");
  return out.save();
}

export async function pdfPageCount(buffer: ArrayBuffer | Uint8Array): Promise<number> {
  const { PDFDocument } = await import("pdf-lib");
  const src = await PDFDocument.load(buffer, { ignoreEncryption: true });
  return src.getPageCount();
}
