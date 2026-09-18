export function textToHex(text: string): string {
  const bytes = new TextEncoder().encode(text);
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i++) parts.push(bytes[i]!.toString(16).padStart(2, "0"));
  return parts.join(" ");
}

export function hexToText(raw: string): string | null {
  if (!raw.trim()) return "";
  const hex = raw.replace(/[^0-9a-fA-F]/g, "");
  if (!hex || hex.length % 2 !== 0) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}
