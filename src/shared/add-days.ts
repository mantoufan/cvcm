import { parseIsoDate } from "./age";

function toIso(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(iso: string, n: number): string | null {
  const d = parseIsoDate(iso);
  if (!d || !Number.isInteger(n)) return null;
  d.setUTCDate(d.getUTCDate() + n);
  return toIso(d);
}
