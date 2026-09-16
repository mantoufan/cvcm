export function clampRange(start: number, end: number, duration: number): { start: number; end: number } {
  const dur = Math.max(0, duration);
  let a = Number.isFinite(start) ? start : 0;
  let b = Number.isFinite(end) ? end : dur;
  a = Math.min(dur, Math.max(0, a));
  b = Math.min(dur, Math.max(0, b));
  if (b < a) {
    const tmp = a;
    a = b;
    b = tmp;
  }
  if (dur >= 0.01 && b - a < 0.01) {
    if (a + 0.01 <= dur) b = a + 0.01;
    else a = Math.max(0, b - 0.01);
  }
  return { start: a, end: b };
}

export function sliceChannels(
  channels: Float32Array[],
  sampleRate: number,
  start: number,
  end: number,
): Float32Array[] {
  if (!channels.length) return [];
  const rate = Math.max(1, sampleRate);
  const duration = (channels[0]?.length ?? 0) / rate;
  const range = clampRange(start, end, duration);
  const i0 = Math.floor(range.start * rate);
  const i1 = Math.max(i0 + 1, Math.ceil(range.end * rate));
  return channels.map((ch) => ch.subarray(i0, Math.min(ch.length, i1)).slice());
}

export function waveformPeaks(channel: Float32Array, buckets: number): number[] {
  const n = Math.max(1, Math.round(buckets) || 1);
  const peaks = new Array<number>(n).fill(0);
  if (!channel.length) return peaks;
  const step = channel.length / n;
  for (let i = 0; i < n; i++) {
    const a = Math.floor(i * step);
    const b = Math.max(a + 1, Math.min(channel.length, Math.floor((i + 1) * step)));
    let m = 0;
    for (let j = a; j < b; j++) m = Math.max(m, Math.abs(channel[j] || 0));
    peaks[i] = m;
  }
  return peaks;
}

export function formatClock(sec: number): string {
  const s = Math.max(0, Number.isFinite(sec) ? sec : 0);
  const total = Math.round(s * 100);
  const m = Math.floor(total / 6000);
  const rest = total % 6000;
  const whole = Math.floor(rest / 100);
  const frac = rest % 100;
  return `${m}:${String(whole).padStart(2, "0")}.${String(frac).padStart(2, "0")}`;
}
