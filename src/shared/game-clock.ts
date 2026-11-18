/**
 * "m:ss.cc" game clock shared by the 3D games (lap times, cube solves, ring runs). Rounds down to the shown digits,
 * so 59.996 s reads 0:59.99, never 0:60.00.
 */
export function formatClock(ms: number, digits: 1 | 2 = 2): string {
  const unit = digits === 1 ? 100 : 10;
  const ticks = Math.floor(Math.max(0, ms) / unit);
  const perSecond = 1000 / unit;
  const m = Math.floor(ticks / (60 * perSecond));
  const s = Math.floor(ticks / perSecond) % 60;
  const frac = ticks % perSecond;
  return `${m}:${String(s).padStart(2, "0")}.${String(frac).padStart(digits, "0")}`;
}
