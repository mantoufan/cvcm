const HEX = "0123456789abcdef";

export function uuidV4(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  return formatUuidBytes(bytes, true, false);
}

export function formatUuidBytes(bytes: Uint8Array, hyphens: boolean, upper: boolean): string {
  if (bytes.length < 16) throw new Error("uuid-length");
  let hex = "";
  for (let i = 0; i < 16; i++) hex += HEX[(bytes[i]! >> 4) & 0xf]! + HEX[bytes[i]! & 0xf]!;
  const body = hyphens
    ? `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
    : hex;
  return upper ? body.toUpperCase() : body;
}

export function formatUuidString(id: string, hyphens: boolean, upper: boolean): string {
  const hex = id.replace(/-/g, "").toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(hex)) throw new Error("uuid-format");
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return formatUuidBytes(bytes, hyphens, upper);
}

export function generateUuids(count: number, hyphens: boolean, upper: boolean): string[] {
  const n = Math.max(1, Math.min(50, Math.round(count) || 1));
  const out: string[] = [];
  for (let i = 0; i < n; i++) out.push(formatUuidString(uuidV4(), hyphens, upper));
  return out;
}

export function isUuidV4(id: string): boolean {
  const hex = id.replace(/-/g, "").toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(hex)) return false;
  return hex[12] === "4" && "89ab".includes(hex[16]!);
}
