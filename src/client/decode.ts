import { isSvgFile, readSvg, sizedSvg, svgPixelSize } from "../shared/svg-size";

/**
 * Any picture the browser can read. An SVG is drawn from its source at its own size (given an explicit width and height
 * first, which Firefox needs and an SVG without one would otherwise come out at 300 × 150 or fail).
 */
export async function decodeImage(
  file: Blob,
): Promise<{ bitmap: ImageBitmap; width: number; height: number }> {
  if (isSvgFile({ name: file instanceof File ? file.name : "", type: file.type })) {
    const text = await file.text();
    const info = readSvg(text);
    // An SVG whose root we cannot read (a prefixed svg:svg, say) still gets the browser's own try below.
    if (info) {
      const { width, height } = svgPixelSize(info, 1);
      try {
        return { bitmap: await rasterizeSvg(sizedSvg(text, info, width, height), width, height), width, height };
      } catch {
        // Fall through.
      }
    }
  }
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    return { bitmap, width: bitmap.width, height: bitmap.height };
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImage(url);
      const bitmap = await createImageBitmap(img);
      return { bitmap, width: bitmap.width, height: bitmap.height };
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

/** An <img> loaded from a same-page (blob:) URL. */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("decode"));
    img.src = src;
  });
}

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  mime: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob"))), mime, quality);
  });
}

export function drawToCanvas(
  source: CanvasImageSource,
  width: number,
  height: number,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** Draws SVG text (already sized to `width` × `height`) as an image onto a canvas of that size: vector-sharp at any scale. */
export async function rasterizeSvg(svg: string, width: number, height: number): Promise<ImageBitmap> {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const img = await loadImage(url);
    return await createImageBitmap(drawToCanvas(img, width, height));
  } finally {
    URL.revokeObjectURL(url);
  }
}
