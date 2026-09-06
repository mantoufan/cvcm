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

export function outputFilename(
  originalName: string,
  mime: string,
  suffix = "-watermark",
): string {
  const { stem } = stemAndExt(originalName);
  const ext =
    mime === "image/jpeg"
      ? "jpg"
      : mime === "image/webp"
        ? "webp"
        : "png";
  const safe = stem.replace(/[^\w\u0080-\uFFFF.-]+/g, "_").slice(0, 80) || "image";
  return `${safe}${suffix}.${ext}`;
}

export function mimeForFormat(format: "png" | "jpeg" | "webp"): string {
  if (format === "jpeg") return "image/jpeg";
  if (format === "webp") return "image/webp";
  return "image/png";
}
