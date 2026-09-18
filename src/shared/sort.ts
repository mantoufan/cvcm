export type SortMode = "az" | "za" | "unique";

export function sortLines(text: string, mode: SortMode): string {
  const lines = text.split(/\r\n|\n|\r/);
  if (mode === "unique") {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const line of lines) {
      if (seen.has(line)) continue;
      seen.add(line);
      out.push(line);
    }
    return out.join("\n");
  }
  const copy = lines.slice();
  copy.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  if (mode === "za") copy.reverse();
  return copy.join("\n");
}
