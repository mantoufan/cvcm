export function formatElapsed(ms: number): string {
  const n = Number.isFinite(ms) && ms > 0 ? ms : 0;
  const totalCs = Math.floor(n / 10);
  const cs = totalCs % 100;
  const totalSec = Math.floor(totalCs / 100);
  const s = totalSec % 60;
  const totalMin = Math.floor(totalSec / 60);
  const m = totalMin % 60;
  const h = Math.floor(totalMin / 60);
  const pad = (v: number) => String(v).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(cs)}`;
}
