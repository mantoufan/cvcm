/** IPv4 subnet math on unsigned 32-bit numbers. */

export function parseIpv4(raw: string): number | null {
  const parts = raw.trim().split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n > 255) return null;
    value = value * 256 + n;
  }
  return value;
}

export function formatIpv4(value: number): string {
  const v = value >>> 0;
  return [v >>> 24, (v >>> 16) & 255, (v >>> 8) & 255, v & 255].join(".");
}

export function prefixToMask(prefix: number): number {
  return prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
}

/** Prefix length of a contiguous netmask such as 255.255.255.0, or null for a mask with holes. */
export function maskToPrefix(mask: number): number | null {
  const m = mask >>> 0;
  for (let p = 0; p <= 32; p++) if (prefixToMask(p) === m) return p;
  return null;
}

/** "10.0.0.1/24", "10.0.0.1 255.255.255.0", or a bare address (/32). */
export function parseCidr(raw: string): { ip: number; prefix: number } | null {
  const text = raw.trim();
  const slash = /^([\d.]+)\s*\/\s*(\d{1,2})$/.exec(text);
  if (slash) {
    const ip = parseIpv4(slash[1]);
    const prefix = Number(slash[2]);
    if (ip == null || prefix > 32) return null;
    return { ip, prefix };
  }
  const pair = /^([\d.]+)\s+([\d.]+)$/.exec(text);
  if (pair) {
    const ip = parseIpv4(pair[1]);
    const mask = parseIpv4(pair[2]);
    const prefix = mask == null ? null : maskToPrefix(mask);
    if (ip == null || prefix == null) return null;
    return { ip, prefix };
  }
  const ip = parseIpv4(text);
  return ip == null ? null : { ip, prefix: 32 };
}

export type Subnet = {
  cidr: string;
  prefix: number;
  network: string;
  broadcast: string;
  mask: string;
  wildcard: string;
  firstHost: string;
  lastHost: string;
  /** Every address in the block, network and broadcast included. */
  total: number;
  /** Addresses a host can use: total − 2, except /31 (2, RFC 3021) and /32 (1). */
  usable: number;
};

export function subnetOf(raw: string): Subnet | null {
  const parsed = parseCidr(raw);
  if (!parsed) return null;
  const { ip, prefix } = parsed;
  const mask = prefixToMask(prefix);
  const network = (ip & mask) >>> 0;
  const total = 2 ** (32 - prefix);
  const broadcast = network + total - 1;
  const tiny = prefix >= 31;
  return {
    cidr: `${formatIpv4(network)}/${prefix}`,
    prefix,
    network: formatIpv4(network),
    broadcast: formatIpv4(broadcast),
    mask: formatIpv4(mask),
    wildcard: formatIpv4(~mask >>> 0),
    firstHost: formatIpv4(tiny ? network : network + 1),
    lastHost: formatIpv4(tiny ? broadcast : broadcast - 1),
    total,
    usable: tiny ? total : total - 2,
  };
}

/** Smallest list of CIDR blocks that covers start..end exactly. Null if either end is invalid or start > end. */
export function rangeToCidrs(startRaw: string, endRaw: string): string[] | null {
  const start = parseIpv4(startRaw);
  const end = parseIpv4(endRaw);
  if (start == null || end == null || start > end) return null;
  const out: string[] = [];
  let cur = start;
  while (cur <= end) {
    // Largest block aligned at cur...
    let size = cur === 0 ? 2 ** 32 : 2 ** countTrailingZeros(cur);
    // ...that does not run past end.
    while (cur + size - 1 > end) size /= 2;
    out.push(`${formatIpv4(cur)}/${32 - Math.log2(size)}`);
    cur += size;
  }
  return out;
}

function countTrailingZeros(n: number): number {
  let count = 0;
  let v = n;
  while (count < 32 && v % 2 === 0) {
    v /= 2;
    count += 1;
  }
  return count;
}
