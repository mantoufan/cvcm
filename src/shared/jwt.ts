export type JwtOk = {
  ok: true;
  header: unknown;
  payload: unknown;
  headerRaw: string;
  payloadRaw: string;
  alg: string;
  expired: boolean | null;
};

export type JwtErr = { ok: false; error: "empty" | "format" | "decode" };
export type JwtResult = JwtOk | JwtErr;

export function decodeJwt(token: string, now = Date.now()): JwtResult {
  const raw = token.trim();
  if (!raw) return { ok: false, error: "empty" };
  const parts = raw.split(".");
  if (parts.length < 2 || parts.length > 3) return { ok: false, error: "format" };
  try {
    const headerRaw = utf8(b64url(parts[0]!));
    const payloadRaw = utf8(b64url(parts[1]!));
    const header = JSON.parse(headerRaw) as unknown;
    const payload = JSON.parse(payloadRaw) as unknown;
    const alg = header && typeof header === "object" && "alg" in header ? String((header as { alg: unknown }).alg) : "";
    const exp = payload && typeof payload === "object" && typeof (payload as { exp?: unknown }).exp === "number"
      ? (payload as { exp: number }).exp
      : null;
    return {
      ok: true,
      header,
      payload,
      headerRaw,
      payloadRaw,
      alg,
      expired: exp == null ? null : exp * 1000 < now,
    };
  } catch {
    return { ok: false, error: "decode" };
  }
}

function b64url(chunk: string): Uint8Array {
  const pad = chunk.length % 4 === 2 ? "==" : chunk.length % 4 === 3 ? "=" : "";
  const b64 = chunk.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function utf8(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}
