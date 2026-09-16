function u16(bytes: Uint8Array, i: number): number {
  return (bytes[i]! << 8) | bytes[i + 1]!;
}

export function hasJpegExif(bytes: Uint8Array): boolean {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return false;
  let i = 2;
  while (i + 3 < bytes.length && bytes[i] === 0xff) {
    const marker = bytes[i + 1]!;
    if (marker === 0xda || marker === 0xd9) break;
    if (marker === 0x00 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    const len = u16(bytes, i + 2);
    if (len < 2 || i + 2 + len > bytes.length) break;
    if (marker === 0xe1) {
      const start = i + 4;
      if (start + 4 <= bytes.length) {
        const sig = String.fromCharCode(bytes[start]!, bytes[start + 1]!, bytes[start + 2]!, bytes[start + 3]!);
        if (sig === "Exif") return true;
      }
    }
    i += 2 + len;
  }
  return false;
}

export function hasPngMetadata(bytes: Uint8Array): boolean {
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  if (bytes.length < 8 || sig.some((b, i) => bytes[i] !== b)) return false;
  let i = 8;
  const tagged = new Set(["tEXt", "iTXt", "zTXt", "eXIf", "tIME"]);
  while (i + 8 <= bytes.length) {
    const len = (bytes[i]! << 24) | (bytes[i + 1]! << 16) | (bytes[i + 2]! << 8) | bytes[i + 3]!;
    const type = String.fromCharCode(bytes[i + 4]!, bytes[i + 5]!, bytes[i + 6]!, bytes[i + 7]!);
    if (tagged.has(type)) return true;
    i += 12 + len;
    if (type === "IEND") break;
  }
  return false;
}

export function hasWebpExif(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false;
  const riff = String.fromCharCode(...bytes.slice(0, 4));
  const webp = String.fromCharCode(...bytes.slice(8, 12));
  if (riff !== "RIFF" || webp !== "WEBP") return false;
  let i = 12;
  while (i + 8 <= bytes.length) {
    const type = String.fromCharCode(...bytes.slice(i, i + 4));
    const len = bytes[i + 4]! | (bytes[i + 5]! << 8) | (bytes[i + 6]! << 16) | (bytes[i + 7]! << 24);
    if (type === "EXIF" || type === "XMP ") return true;
    i += 8 + len + (len % 2);
  }
  return false;
}

export function detectMetadata(bytes: Uint8Array): boolean {
  return hasJpegExif(bytes) || hasPngMetadata(bytes) || hasWebpExif(bytes);
}
