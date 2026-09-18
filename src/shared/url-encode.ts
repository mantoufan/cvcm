export function encodeUrl(text: string): string {
  return encodeURIComponent(text);
}

export function decodeUrl(raw: string): string | null {
  const s = raw.trim().replace(/\+/g, "%20");
  if (!s) return "";
  try {
    return decodeURIComponent(s);
  } catch {
    return null;
  }
}
