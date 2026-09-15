export type DiffKind = "eq" | "add" | "del";
export type DiffLine = { kind: DiffKind; text: string };

const MAX_LINES = 2000;

export function splitLines(text: string): string[] {
  if (text.length === 0) return [];
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
}

export function normalizeLine(text: string, ignoreSpace: boolean): string {
  return ignoreSpace ? text.replace(/\s+/g, " ").trim() : text;
}

export function diffLines(left: string, right: string, ignoreSpace = false): DiffLine[] {
  const a = splitLines(left).slice(0, MAX_LINES).map((line) => normalizeLine(line, ignoreSpace));
  const b = splitLines(right).slice(0, MAX_LINES).map((line) => normalizeLine(line, ignoreSpace));
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    const row = dp[i]!;
    const next = dp[i + 1]!;
    for (let j = m - 1; j >= 0; j--) {
      row[j] = a[i] === b[j] ? next[j + 1]! + 1 : Math.max(next[j]!, row[j + 1]!);
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ kind: "eq", text: a[i]! });
      i += 1;
      j += 1;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      out.push({ kind: "del", text: a[i]! });
      i += 1;
    } else {
      out.push({ kind: "add", text: b[j]! });
      j += 1;
    }
  }
  while (i < n) {
    out.push({ kind: "del", text: a[i]! });
    i += 1;
  }
  while (j < m) {
    out.push({ kind: "add", text: b[j]! });
    j += 1;
  }
  return out;
}

export function diffCounts(lines: DiffLine[]): { added: number; removed: number; same: number } {
  let added = 0;
  let removed = 0;
  let same = 0;
  for (const line of lines) {
    if (line.kind === "add") added += 1;
    else if (line.kind === "del") removed += 1;
    else same += 1;
  }
  return { added, removed, same };
}

export function unifiedDiff(lines: DiffLine[]): string {
  return lines.map((line) => {
    if (line.kind === "add") return `+ ${line.text}`;
    if (line.kind === "del") return `- ${line.text}`;
    return `  ${line.text}`;
  }).join("\n");
}
