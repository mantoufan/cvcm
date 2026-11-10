/**
 * A file name stem from a title or a note's first line ("Shopping list"), without characters file systems refuse,
 * at most `max` characters; "" when nothing usable is left.
 */
export function titleStem(title: string, max = 60): string {
  const clean = title.replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().replace(/^\.+/, "");
  return Array.from(clean).slice(0, max).join("").trim();
}

export function baseName(name: string): string {
  const trimmed = name.replace(/\\/g, "/").split("/").pop() || "image";
  return trimmed.replace(/^\.+/, "") || "image";
}

export function stemAndExt(name: string): { stem: string; ext: string } {
  const base = baseName(name);
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return { stem: base, ext: "" };
  return { stem: base.slice(0, dot), ext: base.slice(dot + 1).toLowerCase() };
}

export type ImageFormat = "png" | "jpeg" | "webp" | "avif" | "bmp" | "ico" | "gif";

/** A file name's stem without characters file systems refuse, at most 80 characters; `fallback` when nothing is left. */
export function safeStem(name: string, fallback = "file"): string {
  return stemAndExt(name).stem.replace(/[^\w\u0080-\uFFFF.-]+/g, "_").slice(0, 80) || fallback;
}

export function outputFilename(
  originalName: string,
  mime: string,
  suffix = "-watermark",
): string {
  const ext =
    mime === "application/pdf"
      ? "pdf"
      : mime === "video/mp4"
        ? "mp4"
        : mime === "audio/wav" || mime === "audio/x-wav"
        ? "wav"
        : mime === "image/jpeg"
          ? "jpg"
          : mime === "image/webp"
            ? "webp"
            : mime === "image/avif"
              ? "avif"
              : mime === "image/bmp" || mime === "image/x-ms-bmp"
                ? "bmp"
                : mime === "image/gif"
                  ? "gif"
                  : mime === "image/x-icon" || mime === "image/vnd.microsoft.icon"
                    ? "ico"
                    : "png";
  return `${safeStem(originalName)}${suffix}.${ext}`;
}

export function mimeForFormat(format: ImageFormat): string {
  if (format === "jpeg") return "image/jpeg";
  if (format === "webp") return "image/webp";
  if (format === "avif") return "image/avif";
  if (format === "bmp") return "image/bmp";
  if (format === "ico") return "image/x-icon";
  if (format === "gif") return "image/gif";
  return "image/png";
}

export function lossyFormat(format: ImageFormat): boolean {
  return format === "jpeg" || format === "webp" || format === "avif";
}
