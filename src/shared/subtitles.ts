/** Timed transcript segments → plain text, SRT and WebVTT. */
export type Segment = { start: number; end: number; text: string };

function clock(seconds: number, sep: "," | "."): string {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const rest = ms % 1000;
  const pad = (n: number, w = 2): string => String(n).padStart(w, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}${sep}${pad(rest, 3)}`;
}

/** Drop empty segments, trim text, and keep every cue at least a moment long and in order. */
export function cleanSegments(segments: readonly Segment[]): Segment[] {
  const out: Segment[] = [];
  for (const seg of segments) {
    const text = seg.text.replace(/\s+/g, " ").trim();
    if (!text) continue;
    const start = Math.max(0, seg.start, out.length ? out[out.length - 1].end : 0);
    const end = Math.max(seg.end, start + 0.3);
    out.push({ start, end, text });
  }
  return out;
}

export function toSrt(segments: readonly Segment[]): string {
  return cleanSegments(segments)
    .map((seg, i) => `${i + 1}\n${clock(seg.start, ",")} --> ${clock(seg.end, ",")}\n${seg.text}\n`)
    .join("\n");
}

export function toVtt(segments: readonly Segment[]): string {
  const cues = cleanSegments(segments).map((seg) => `${clock(seg.start, ".")} --> ${clock(seg.end, ".")}\n${seg.text}\n`);
  return `WEBVTT\n\n${cues.join("\n")}`;
}

/** Plain text, one segment per line (Whisper segments end on sentence or pause boundaries). */
export function toText(segments: readonly Segment[]): string {
  return cleanSegments(segments).map((seg) => seg.text).join("\n");
}

/** "1:05" / "1:02:03" for the segment list. */
export function shortClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}
