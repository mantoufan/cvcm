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

/** 1-based page numbers, unique, sorted. Empty spec means all pages. */
export function parsePageRanges(spec: string, pageCount: number): number[] {
  const n = Math.max(0, Math.floor(pageCount));
  if (n === 0) return [];
  const raw = spec.trim();
  if (!raw) return Array.from({ length: n }, (_, i) => i + 1);
  const out: number[] = [];
  const seen = new Set<number>();
  for (const part of raw.split(",")) {
    const token = part.trim();
    if (!token) continue;
    const m = token.match(/^(\d+)(?:\s*[-–—]\s*(\d+))?$/);
    if (!m) throw new Error("range");
    let a = Number(m[1]);
    let b = m[2] ? Number(m[2]) : a;
    if (a > b) [a, b] = [b, a];
    a = Math.max(1, Math.min(n, a));
    b = Math.max(1, Math.min(n, b));
    for (let p = a; p <= b; p++) {
      if (seen.has(p)) continue;
      seen.add(p);
      out.push(p);
    }
  }
  if (out.length === 0) throw new Error("range");
  return out;
}

export async function extractPdfPages(
  buffer: ArrayBuffer | Uint8Array,
  pages1: number[],
): Promise<Uint8Array> {
  const { PDFDocument } = await import("pdf-lib");
  const src = await PDFDocument.load(buffer, { ignoreEncryption: true });
  const count = src.getPageCount();
  const idx = pages1
    .map((p) => p - 1)
    .filter((i) => i >= 0 && i < count);
  if (idx.length === 0) throw new Error("empty");
  const out = await PDFDocument.create();
  const copied = await out.copyPages(src, idx);
  for (const page of copied) out.addPage(page);
  return out.save();
}

export async function splitPdfEachPage(buffer: ArrayBuffer | Uint8Array): Promise<Uint8Array[]> {
  const { PDFDocument } = await import("pdf-lib");
  const src = await PDFDocument.load(buffer, { ignoreEncryption: true });
  const count = src.getPageCount();
  if (count === 0) throw new Error("empty");
  const files: Uint8Array[] = [];
  for (let i = 0; i < count; i++) {
    const out = await PDFDocument.create();
    const [page] = await out.copyPages(src, [i]);
    out.addPage(page);
    files.push(await out.save());
  }
  return files;
}
