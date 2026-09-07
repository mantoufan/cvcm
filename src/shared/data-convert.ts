import { renderClip } from "./md";

export type DataMode =
  | "json-pretty"
  | "json-minify"
  | "csv-json"
  | "json-csv"
  | "base64-encode"
  | "base64-decode"
  | "url-encode"
  | "url-decode"
  | "md-html"
  | "html-md";

export function convertData(mode: DataMode, input: string): string {
  const text = input.replace(/^\uFEFF/, "");
  switch (mode) {
    case "json-pretty":
      return JSON.stringify(JSON.parse(text || "null"), null, 2);
    case "json-minify":
      return JSON.stringify(JSON.parse(text || "null"));
    case "csv-json":
      return JSON.stringify(csvToRows(text), null, 2);
    case "json-csv":
      return rowsToCsv(JSON.parse(text || "[]"));
    case "base64-encode":
      return btoaUtf8(text);
    case "base64-decode":
      return atobUtf8(text.trim());
    case "url-encode":
      return encodeURIComponent(text);
    case "url-decode":
      return decodeURIComponent(text.trim());
    case "md-html":
      return renderClip(text);
    case "html-md":
      return htmlToMd(text);
    default:
      return text;
  }
}

export function csvToRows(text: string): Record<string, string>[] {
  const rows = parseCsv(text);
  if (rows.length === 0) return [];
  const headers = rows[0].map((h, i) => h || `col${i + 1}`);
  return rows.slice(1).map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = row[i] ?? "";
    });
    return obj;
  });
}

export function rowsToCsv(data: unknown): string {
  if (!Array.isArray(data)) throw new Error("csv");
  if (data.length === 0) return "";
  const keys = Array.from(
    data.reduce((set: Set<string>, row) => {
      if (row && typeof row === "object") Object.keys(row).forEach((k) => set.add(k));
      return set;
    }, new Set<string>()),
  );
  const lines = [keys.map(csvCell).join(",")];
  for (const row of data) {
    const rec = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
    lines.push(keys.map((k) => csvCell(rec[k] == null ? "" : String(rec[k]))).join(","));
  }
  return lines.join("\n");
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let i = 0;
  let quoted = false;
  const src = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  while (i < src.length) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i += 2;
        continue;
      }
      if (ch === '"') {
        quoted = false;
        i++;
        continue;
      }
      cell += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      quoted = true;
      i++;
      continue;
    }
    if (ch === ",") {
      row.push(cell);
      cell = "";
      i++;
      continue;
    }
    if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      i++;
      continue;
    }
    cell += ch;
    i++;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c !== ""));
}

function btoaUtf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function atobUtf8(text: string): string {
  const bin = atob(text);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function htmlToMd(html: string): string {
  let s = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "# $1\n\n")
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "## $1\n\n")
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "### $1\n\n")
    .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, "**$1**")
    .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, "**$1**")
    .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, "*$1*")
    .replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, "*$1*")
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, "`$1`")
    .replace(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)")
    .replace(/<img[^>]*src=["']([^"']+)["'][^>]*>/gi, "![]($1)")
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "- $1\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ");
  return s.replace(/\n{3,}/g, "\n\n").trim();
}

export function extForMode(mode: DataMode): string {
  if (mode === "csv-json" || mode === "json-pretty" || mode === "json-minify") return "json";
  if (mode === "json-csv") return "csv";
  if (mode === "md-html") return "html";
  if (mode === "html-md") return "md";
  return "txt";
}
