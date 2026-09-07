export type S3Config = {
  accessKey: string;
  secret: string;
  region: string;
  host: string;
  bucket: string;
};

function uriEncode(value: string, encodeSlash: boolean): string {
  let out = "";
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0;
    const unreserved =
      (code >= 0x41 && code <= 0x5a) ||
      (code >= 0x61 && code <= 0x7a) ||
      (code >= 0x30 && code <= 0x39) ||
      ch === "-" ||
      ch === "_" ||
      ch === "." ||
      ch === "~";
    if (unreserved || (ch === "/" && !encodeSlash)) out += ch;
    else out += `%${code.toString(16).toUpperCase().padStart(2, "0")}`;
  }
  return out;
}

async function hmac(key: BufferSource, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(data));
}

async function hmacHex(key: BufferSource, data: string): Promise<string> {
  const buf = await hmac(key, data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function signingKey(secret: string, dateStamp: string, region: string): Promise<ArrayBuffer> {
  const kDate = await hmac(new TextEncoder().encode(`AWS4${secret}`), dateStamp);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, "s3");
  return hmac(kService, "aws4_request");
}

function amzParts(now: Date): { amz: string; stamp: string } {
  const iso = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const amz = `${iso.slice(0, 15)}Z`;
  return { amz, stamp: amz.slice(0, 8) };
}

export async function presignS3Put(
  cfg: S3Config,
  key: string,
  now = new Date(),
  expiresSec = 600,
): Promise<string> {
  const { amz, stamp } = amzParts(now);
  const credential = `${cfg.accessKey}/${stamp}/${cfg.region}/s3/aws4_request`;
  const qs: Array<[string, string]> = [
    ["X-Amz-Algorithm", "AWS4-HMAC-SHA256"],
    ["X-Amz-Credential", credential],
    ["X-Amz-Date", amz],
    ["X-Amz-Expires", String(expiresSec)],
    ["X-Amz-SignedHeaders", "host"],
  ];
  const canonicalQs = qs
    .map(([k, v]) => `${uriEncode(k, true)}=${uriEncode(v, true)}`)
    .sort()
    .join("&");
  const path = `/${key}`;
  const canonical = [
    "PUT",
    uriEncode(path, false),
    canonicalQs,
    `host:${cfg.host}`,
    "",
    "host",
    "UNSIGNED-PAYLOAD",
  ].join("\n");
  const scope = `${stamp}/${cfg.region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amz,
    scope,
    await sha256Hex(canonical),
  ].join("\n");
  const sig = await hmacHex(await signingKey(cfg.secret, stamp, cfg.region), stringToSign);
  return `https://${cfg.host}${path}?${canonicalQs}&X-Amz-Signature=${sig}`;
}

export async function s3Delete(cfg: S3Config, key: string, now = new Date()): Promise<void> {
  const { amz, stamp } = amzParts(now);
  const path = `/${key}`;
  const payload = "UNSIGNED-PAYLOAD";
  const canonical = [
    "DELETE",
    uriEncode(path, false),
    "",
    `host:${cfg.host}`,
    `x-amz-content-sha256:${payload}`,
    `x-amz-date:${amz}`,
    "",
    "host;x-amz-content-sha256;x-amz-date",
    payload,
  ].join("\n");
  const scope = `${stamp}/${cfg.region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amz,
    scope,
    await sha256Hex(canonical),
  ].join("\n");
  const sig = await hmacHex(await signingKey(cfg.secret, stamp, cfg.region), stringToSign);
  const auth = `AWS4-HMAC-SHA256 Credential=${cfg.accessKey}/${scope}, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=${sig}`;
  await fetch(`https://${cfg.host}${path}`, {
    method: "DELETE",
    headers: {
      authorization: auth,
      "x-amz-content-sha256": payload,
      "x-amz-date": amz,
    },
  });
}

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function publicS3Url(cfg: S3Config, key: string): string {
  return `https://${cfg.host}/${key}`;
}

export function s3KeysInBody(body: string, host: string): string[] {
  const re = new RegExp(`https://${host.replace(/\./g, "\\.")}/(clip/[a-z0-9]+/[^\\s)<>"']+)`, "gi");
  const keys = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = re.exec(body))) keys.add(match[1]);
  return [...keys];
}
