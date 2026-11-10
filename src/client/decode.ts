import { isSvgFile, readSvg, sizedSvg, svgPixelSize, svgText, type SvgInfo } from "../shared/svg-size";

/**
 * Any picture the browser can read. An SVG is drawn from its source at its own size (given an explicit width and height
 * first, which Firefox needs and an SVG without one would otherwise come out at 300 × 150 or fail).
 */
export async function decodeImage(
  file: Blob,
): Promise<{ bitmap: ImageBitmap; width: number; height: number }> {
  if (isSvgFile({ name: file instanceof File ? file.name : "", type: file.type })) {
    // An SVG whose root we cannot read (a prefixed svg:svg, say) or draw still gets the browser's own try below.
    const svg = await readSvgFile(file);
    if (svg) {
      try {
        return await drawSvg(svg, 1);
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

export type SvgSource = { text: string; info: SvgInfo };

/** An SVG file's text (in its declared encoding) and root size; null when its root tag cannot be read. */
export async function readSvgFile(file: Blob): Promise<SvgSource | null> {
  const text = svgText(await file.arrayBuffer());
  const info = readSvg(text);
  return info ? { text, info } : null;
}

/** An SVG drawn from its source at its own size × `scale` (capped by svgPixelSize), vector-sharp. */
export async function drawSvg(svg: SvgSource, scale: number): Promise<{ bitmap: ImageBitmap; width: number; height: number }> {
  const { width, height } = svgPixelSize(svg.info, scale);
  return { bitmap: await rasterizeSvg(sizedSvg(svg.text, svg.info, width, height), width, height), width, height };
}

/** Draws SVG text (already sized to `width` × `height`) as an image onto a canvas of that size. */
async function rasterizeSvg(svg: string, width: number, height: number): Promise<ImageBitmap> {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const img = await loadImage(url);
    return await createImageBitmap(drawToCanvas(img, width, height));
  } finally {
    URL.revokeObjectURL(url);
  }
}
