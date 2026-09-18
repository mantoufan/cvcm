export function toSeconds(hours: number, minutes: number, seconds: number): number {
  const h = Number.isFinite(hours) ? Math.max(0, Math.floor(hours)) : 0;
  const m = Number.isFinite(minutes) ? Math.max(0, Math.floor(minutes)) : 0;
  const s = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return h * 3600 + m * 60 + s;
}

export function fromSeconds(total: number): { hours: number; minutes: number; seconds: number; label: string } {
  const t = Math.max(0, Math.floor(total));
  const hours = Math.floor(t / 3600);
  const minutes = Math.floor((t % 3600) / 60);
  const seconds = t % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return { hours, minutes, seconds, label: `${pad(hours)}:${pad(minutes)}:${pad(seconds)}` };
}
