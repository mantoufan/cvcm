export function textToBinary(text: string): string {
  const bytes = new TextEncoder().encode(text);
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i++) parts.push(bytes[i]!.toString(2).padStart(8, "0"));
  return parts.join(" ");
}

export function binaryToText(raw: string): string | null {
  const bits = raw.trim().replace(/\s+/g, "");
  if (!bits) return "";
  if (!/^[01]+$/.test(bits) || bits.length % 8 !== 0) return null;
  const bytes = new Uint8Array(bits.length / 8);
  for (let i = 0; i < bytes.length; i++) bytes[i] = Number.parseInt(bits.slice(i * 8, i * 8 + 8), 2);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}
