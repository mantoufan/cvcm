export function normalizeMemeText(text: string, caps: boolean): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  return caps ? collapsed.toUpperCase() : collapsed;
}

export function wrapByWidth(
  text: string,
  maxWidth: number,
  measure: (value: string) => number,
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (!current || measure(next) <= maxWidth) {
      current = next;
      continue;
    }
    lines.push(current);
    current = word;
  }
  if (current) lines.push(current);
  return lines.slice(0, 5);
}

export function memeFontSize(width: number, height: number, scale: number): number {
  const edge = Math.min(width, height);
  return Math.max(16, Math.round(edge * 0.085 * Math.max(0.5, Math.min(2, scale))));
}

export function memeStrokeWidth(fontSize: number): number {
  return Math.max(2, Math.round(fontSize / 10));
}
