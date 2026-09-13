import type { PDFDocumentProxy } from "pdfjs-dist";

let lib: Promise<typeof import("pdfjs-dist")> | null = null;

export function loadPdfjs(): Promise<typeof import("pdfjs-dist")> {
  if (!lib) {
    lib = (async () => {
      const pdfjs = await import("pdfjs-dist");
      const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      return pdfjs;
    })();
  }
  return lib;
}

export async function openPdf(data: ArrayBuffer): Promise<PDFDocumentProxy> {
  const pdfjs = await loadPdfjs();
  const bytes = new Uint8Array(data.slice(0));
  return pdfjs.getDocument({
    data: bytes,
    disableAutoFetch: true,
    disableStream: true,
  }).promise;
}

export async function renderPdfPage(
  doc: PDFDocumentProxy,
  pageNumber: number,
  scale: number,
): Promise<HTMLCanvasElement> {
  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale: Math.max(0.5, Math.min(3, scale)) });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(viewport.width));
  canvas.height = Math.max(1, Math.round(viewport.height));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  await page.render({ canvasContext: ctx, canvas, viewport }).promise;
  return canvas;
}
