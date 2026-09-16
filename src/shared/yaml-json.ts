export function yamlToJson(text: string): unknown {
  const lines = preprocess(text);
  if (lines.length === 0) return null;
  const { value } = parseBlock(lines, 0, -1);
  return value;
}

export function jsonToYaml(data: unknown): string {
  return dump(data, 0).replace(/\n+$/, "") + "\n";
}

type Line = { indent: number; text: string };

function preprocess(text: string): Line[] {
  const raw = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").split("\n");
  const out: Line[] = [];
  for (const line of raw) {
    const trimmed = line.replace(/\s+#.*$/, "");
    if (!trimmed.trim() || trimmed.trim() === "---" || trimmed.trim() === "...") continue;
    const indent = line.match(/^ */)?.[0].length ?? 0;
    out.push({ indent, text: trimmed.trim() });
  }
  return out;
}

function parseBlock(lines: Line[], start: number, parentIndent: number): { value: unknown; next: number } {
  if (start >= lines.length) return { value: null, next: start };
  const first = lines[start]!;
  if (first.indent <= parentIndent) return { value: null, next: start };
  if (first.text.startsWith("- ")) return parseList(lines, start, first.indent);
  return parseMap(lines, start, first.indent);
}

function parseMap(lines: Line[], start: number, indent: number): { value: Record<string, unknown>; next: number } {
  const obj: Record<string, unknown> = {};
  let i = start;
  while (i < lines.length) {
    const line = lines[i]!;
    if (line.indent < indent) break;
    if (line.indent > indent) throw new Error("yaml-indent");
    if (line.text.startsWith("- ")) break;
    const split = splitKey(line.text);
    if (!split) throw new Error("yaml-key");
    i += 1;
    if (split.inline !== undefined) {
      obj[split.key] = parseScalar(split.inline);
      continue;
    }
    const child = parseBlock(lines, i, indent);
    obj[split.key] = child.value;
    i = child.next;
  }
  return { value: obj, next: i };
}

function parseList(lines: Line[], start: number, indent: number): { value: unknown[]; next: number } {
  const list: unknown[] = [];
  let i = start;
  while (i < lines.length) {
    const line = lines[i]!;
    if (line.indent < indent) break;
    if (line.indent > indent) throw new Error("yaml-indent");
    if (!line.text.startsWith("- ")) break;
    const rest = line.text.slice(2);
    i += 1;
    if (!rest) {
      const child = parseBlock(lines, i, indent);
      list.push(child.value);
      i = child.next;
      continue;
    }
    const split = splitKey(rest);
    if (split && split.inline === undefined) {
      const child = parseBlock(lines, i, indent);
      list.push({ [split.key]: child.value });
      i = child.next;
    } else if (split && looksLikeKey(rest)) {
      const map: Record<string, unknown> = { [split.key]: parseScalar(split.inline ?? "") };
      while (i < lines.length && lines[i]!.indent > indent && !lines[i]!.text.startsWith("- ")) {
        const nested = parseMap(lines, i, lines[i]!.indent);
        Object.assign(map, nested.value);
        i = nested.next;
      }
      list.push(map);
    } else {
      list.push(parseScalar(rest));
    }
  }
  return { value: list, next: i };
}

function looksLikeKey(text: string): boolean {
  return /^(?:"[^"]*"|'[^']*'|[A-Za-z0-9_.-]+)\s*:/.test(text);
}

function splitKey(text: string): { key: string; inline?: string } | null {
  const m = text.match(/^(?:"([^"]*)"|'([^']*)'|([A-Za-z0-9_.-]+))\s*:(?:\s*(.*))?$/);
  if (!m) return null;
  const key = m[1] ?? m[2] ?? m[3] ?? "";
  const rest = (m[4] ?? "").trim();
  if (!rest) return { key };
  return { key, inline: rest };
}

function parseScalar(text: string): unknown {
  const raw = text.trim();
  if (raw === "" || raw === "~" || raw === "null") return null;
  if (raw === "true" || raw === "yes" || raw === "on") return true;
  if (raw === "false" || raw === "no" || raw === "off") return false;
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1);
  }
  if (/^-?\d+$/.test(raw)) return Number(raw);
  if (/^-?\d+\.\d+$/.test(raw)) return Number(raw);
  if (raw.startsWith("[") && raw.endsWith("]")) {
    const inner = raw.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(",").map((p) => parseScalar(p.trim()));
  }
  if (raw.startsWith("{") && raw.endsWith("}")) {
    const inner = raw.slice(1, -1).trim();
    const obj: Record<string, unknown> = {};
    if (!inner) return obj;
    for (const part of inner.split(",")) {
      const s = splitKey(part.trim());
      if (s) obj[s.key] = parseScalar(s.inline ?? "");
    }
    return obj;
  }
  return raw;
}

function dump(data: unknown, indent: number): string {
  const pad = "  ".repeat(indent);
  if (data == null) return `${pad}null\n`;
  if (typeof data === "boolean" || typeof data === "number") return `${pad}${data}\n`;
  if (typeof data === "string") return `${pad}${quote(data)}\n`;
  if (Array.isArray(data)) {
    if (data.length === 0) return `${pad}[]\n`;
    return data.map((item) => {
      if (item && typeof item === "object") {
        const inner = dump(item, indent + 1);
        return `${pad}-\n${inner}`;
      }
      return `${pad}- ${quoteScalar(item)}\n`;
    }).join("");
  }
  const rec = data as Record<string, unknown>;
  const keys = Object.keys(rec);
  if (keys.length === 0) return `${pad}{}\n`;
  return keys.map((key) => {
    const val = rec[key];
    if (val && typeof val === "object") return `${pad}${key}:\n${dump(val, indent + 1)}`;
    return `${pad}${key}: ${quoteScalar(val)}\n`;
  }).join("");
}

function quoteScalar(data: unknown): string {
  if (data == null) return "null";
  if (typeof data === "string") return quote(data);
  return String(data);
}

function quote(text: string): string {
  if (text === "" || /[:#{}[\],&*?]|^\s|\s$/.test(text) || ["true", "false", "null", "yes", "no"].includes(text)) {
    return JSON.stringify(text);
  }
  return text;
}
