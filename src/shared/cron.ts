const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

export type CronOk = { ok: true; fields: string[]; summary: string };
export type CronErr = { ok: false; error: "empty" | "fields" | "range" };
export type CronResult = CronOk | CronErr;

type Field = { kind: "any" } | { kind: "list"; values: number[] } | { kind: "step"; start: number; step: number; max: number };

export function describeCron(expr: string): CronResult {
  const raw = expr.trim().replace(/\s+/g, " ");
  if (!raw) return { ok: false, error: "empty" };
  const parts = raw.split(" ");
  if (parts.length !== 5) return { ok: false, error: "fields" };
  const bounds: Array<[number, number]> = [
    [0, 59],
    [0, 23],
    [1, 31],
    [1, 12],
    [0, 7],
  ];
  const parsed: Field[] = [];
  for (let i = 0; i < 5; i++) {
    const field = parseField(parts[i]!, bounds[i]![0], bounds[i]![1]);
    if (!field) return { ok: false, error: "range" };
    parsed.push(field);
  }
  const min = speak(parsed[0]!, "minute", 0, 59);
  const hour = speak(parsed[1]!, "hour", 0, 23);
  const dom = speak(parsed[2]!, "day-of-month", 1, 31);
  const month = speakMonth(parsed[3]!);
  const dow = speakDow(parsed[4]!);
  const summary = [min, hour, dom, month, dow].filter(Boolean).join("; ");
  return { ok: true, fields: parts, summary };
}

function parseField(raw: string, min: number, max: number): Field | null {
  if (raw === "*") return { kind: "any" };
  const step = raw.match(/^\*(?:\/(\d+))$/);
  if (step) {
    const n = Number(step[1]);
    if (!Number.isInteger(n) || n < 1) return null;
    return { kind: "step", start: min, step: n, max };
  }
  const values = new Set<number>();
  for (const part of raw.split(",")) {
    const every = part.match(/^(\d+)-(\d+)(?:\/(\d+))?$/);
    if (every) {
      const a = Number(every[1]);
      const b = Number(every[2]);
      const s = every[3] ? Number(every[3]) : 1;
      if (!inRange(a, min, max) || !inRange(b, min, max) || s < 1 || a > b) return null;
      for (let n = a; n <= b; n += s) values.add(n);
      continue;
    }
    if (!/^\d+$/.test(part)) return null;
    const n = Number(part);
    if (!inRange(n, min, max)) return null;
    values.add(n);
  }
  return { kind: "list", values: [...values].sort((a, b) => a - b) };
}

function inRange(n: number, min: number, max: number): boolean {
  return Number.isInteger(n) && n >= min && n <= max;
}

function speak(field: Field, unit: string, min: number, max: number): string {
  if (field.kind === "any") return `every ${unit}`;
  if (field.kind === "step") {
    if (field.step === 1) return `every ${unit}`;
    return `every ${field.step} ${unit}s`;
  }
  if (field.values.length === max - min + 1) return `every ${unit}`;
  return `${unit} ${field.values.join(", ")}`;
}

function speakMonth(field: Field): string {
  if (field.kind === "any") return "every month";
  if (field.kind === "step") return `every ${field.step} month(s)`;
  return field.values.map((n) => MONTHS[(n - 1) % 12]).join(", ");
}

function speakDow(field: Field): string {
  if (field.kind === "any") return "every weekday";
  if (field.kind === "step") return `every ${field.step} weekday(s)`;
  const names = field.values.map((n) => DAYS[n === 7 ? 0 : n]);
  return [...new Set(names)].join(", ");
}
