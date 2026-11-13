/** Military (24-hour) time ↔ 12-hour time: parsing what people type, the four-digit form and how it is spoken. */
import { halfWidth } from "./factors";

export type ClockTime = { h: number; m: number; s: number | null; /** Typed as 2400: the end of the day, the same instant as 0000 the next day. */ endOfDay: boolean };

/**
 * Words that say which part of the day an hour is in, by how they turn a 12-hour reading (h = 0–12) into 0–23.
 * One table drives both the parser's patterns and the conversion, so the lists cannot drift apart.
 */
type Part = "am" | "pm" | "noon" | "evening" | "night";
const PARTS: Record<Part, readonly string[]> = {
  am: ["上午", "早上", "早晨", "凌晨", "午前", "오전", "새벽", "sáng", "pagi"],
  pm: ["下午", "傍晚", "午後", "오후", "chiều", "sore"],
  /** Around midday: 11 is still morning, 12 is noon, 1–4 afternoon. */
  noon: ["中午", "trưa", "siang"],
  /** Evening: 12 is midnight, every other hour is PM (晚上5点 is 17:00). */
  evening: ["晚上", "tối", "malam"],
  /** Night: 12 is midnight, 1–5 the small hours, 6–11 PM (夜里2点 02:00, 夜9時 21:00, 밤 9시 21:00). */
  night: ["夜里", "夜裡", "深夜", "夜晚", "夜", "밤", "đêm"],
};
/** Latin and Vietnamese abbreviations, only after the time ("2 pm", "9:05 SA"). */
const LATIN: Record<"am" | "pm", RegExp> = { am: /^(a\.?m\.?|a|s\.?a\.?)$/i, pm: /^(p\.?m\.?|p|c\.?h\.?)$/i };
const esc = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Longest first, so 夜里 wins over 夜.
const WORDS = Object.values(PARTS).flat().sort((x, y) => y.length - x.length).map(esc).join("|");
const TAIL = new RegExp(String.raw`^(.*?)\s*([ap]\.?\s?m\.?|[ap]|s\.?a\.?|c\.?h\.?|${WORDS})$`, "i");
const HEAD = new RegExp(String.raw`^(${WORDS}|s\.?a\.?|c\.?h\.?)\s*(.*)$`, "i");

function partOf(marker: string): Part | null {
  const m = marker.replace(/\s/g, "").toLowerCase();
  for (const [part, words] of Object.entries(PARTS) as [Part, readonly string[]][]) {
    if (words.some((w) => w.toLowerCase() === m)) return part;
  }
  if (LATIN.am.test(m)) return "am";
  if (LATIN.pm.test(m)) return "pm";
  return null;
}

/** Splits a leading or trailing part-of-day word (Latin, Chinese, Japanese, Korean, Vietnamese, Indonesian). */
function splitMeridiem(text: string): { clock: string; part: Part | null } | null {
  const compact = text.replace(/\s+/g, " ").trim();
  const pick = (marker: string, clock: string) => {
    const part = partOf(marker);
    return part ? { clock: clock.trim(), part } : null;
  };
  const head = HEAD.exec(compact);
  if (head && head[2]) return pick(head[1]!, head[2]);
  const tail = TAIL.exec(compact);
  if (tail && tail[1] && /\d$/.test(tail[1].trim())) return pick(tail[2]!, tail[1]);
  return { clock: compact, part: null };
}

/** An hour read on a 12-hour clock (0–12) with its part of the day, as 0–23. */
function toHour24(h: number, part: Part): number {
  switch (part) {
    case "am": return h % 12;
    case "pm": return (h % 12) + 12;
    case "noon": return h === 11 ? 11 : (h % 12) + 12;
    case "evening": return h === 12 || h === 0 ? 0 : h + 12;
    case "night": return h === 12 || h === 0 ? 0 : h < 6 ? h : h + 12;
  }
}

/**
 * Reads a time: "1430", "14:30", "0830 hours", "14:30:15", "2:30 pm", "2 PM", "下午2:30", "下午2点半", "晚上12点",
 * "午前0時", "夜9時", "오후 2시 30분", "14 giờ 30", "2 giờ 30 chiều", "jam 14.30", "14h30", "1430Z", "１４３０".
 * Returns null when it is not a time.
 */
export function parseTime(raw: string): ClockTime | null {
  // Full-width digits and colon from a CJK input method count as ASCII.
  let text = halfWidth(raw.trim())
    // A trailing Z is Zulu (UTC), as the page itself writes it: "1430Z".
    .replace(/\s*(z|zulu)$/i, "")
    .replace(/\s*(hours?|hrs?|horas?|jam)\.?$/i, "")
    // Indonesian writes the hour word first: "jam 14.30", "pukul 7".
    .replace(/^(jam|pukul)\s*/i, "")
    .replace(/(\d)\s*h$/i, "$1")
    // Hour words between the hour and the minutes are a colon ("2点30", "2시 30분", "14 giờ 30"); 半 is half past.
    .replace(/\s*(?:[时時시点點]|giờ)\s*[半반]/gi, ":30")
    .replace(/\s*(?:[时時시点點]|giờ)\s*(\d)/gi, ":$1")
    .replace(/[分분秒초]/g, "")
    .replace(/\s*(?:[时時시点點]|giờ)(?=\s*\D*$)/gi, "")
    .trim();
  if (!text) return null;
  text = text.replace(/(\d)h(\d)/i, "$1:$2");
  const split = splitMeridiem(text);
  if (!split) return null;
  const { clock, part } = split;
  let h: number, m: number, s: number | null = null;
  const colon = /^(\d{1,2})(?:[:.](\d{2}))?(?:[:.](\d{2}))?$/.exec(clock);
  const digits = /^(\d{3,4})$/.exec(clock);
  if (digits) {
    // Three or four digits with no colon: HMM or HHMM, the military way of writing it.
    const d = digits[1]!.padStart(4, "0");
    h = Number(d.slice(0, 2));
    m = Number(d.slice(2));
  } else if (colon) {
    // One or two digits alone are an hour: "7" is 07:00, "14" is 14:00.
    h = Number(colon[1]);
    m = colon[2] ? Number(colon[2]) : 0;
    s = colon[3] ? Number(colon[3]) : null;
  } else return null;
  if (m > 59 || (s !== null && s > 59)) return null;
  if (part) {
    // 0–12 with a part of the day; 0 is how Japan writes the hour after midnight or noon (午前0時, 午後0時).
    if (h > 12) return null;
    return { h: toHour24(h, part), m, s, endOfDay: false };
  }
  if (h === 24 && m === 0 && !s) return { h: 0, m: 0, s: null, endOfDay: true };
  if (h > 23) return null;
  return { h, m, s, endOfDay: false };
}

const two = (n: number) => String(n).padStart(2, "0");

/** "1430", or "2400" for the end of the day; seconds as "143015" are not used in military writing, so they are dropped. */
export function military(t: ClockTime): string {
  return t.endOfDay ? "2400" : `${two(t.h)}${two(t.m)}`;
}

/** "14:30" or "14:30:15" ("24:00" for the end of the day). */
export function colon24(t: ClockTime): string {
  if (t.endOfDay) return "24:00";
  return `${two(t.h)}:${two(t.m)}${t.s !== null ? `:${two(t.s)}` : ""}`;
}

/** 12-hour parts: hour 1–12, minutes, seconds and whether it is PM. */
export function twelve(t: ClockTime): { h: number; m: number; s: number | null; pm: boolean } {
  return { h: t.h % 12 || 12, m: t.m, s: t.s, pm: t.h >= 12 };
}

const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty"];

function spokenPair(n: number, leadingZero: boolean): string {
  if (n < 10) return leadingZero ? `zero ${ONES[n]}` : ONES[n]!;
  if (n < 20) return ONES[n]!;
  const tens = TENS[Math.floor(n / 10)]!;
  return n % 10 ? `${tens}-${ONES[n % 10]}` : tens;
}

/**
 * How the time is said in the US military: 0000 "zero hundred hours", 0800 "zero eight hundred hours",
 * 0805 "zero eight zero five hours", 1430 "fourteen thirty hours", 2400 "twenty-four hundred hours".
 */
export function spoken(t: ClockTime): string {
  if (t.endOfDay) return "twenty-four hundred hours";
  if (t.h === 0 && t.m === 0) return "zero hundred hours";
  const hour = t.h === 0 ? "zero zero" : spokenPair(t.h, true);
  const min = t.m === 0 ? "hundred" : spokenPair(t.m, true);
  return `${hour} ${min} hours`;
}

/** The hour-by-hour chart: 0000 … 2300 with the 12-hour time. */
export const CHART_HOURS = Array.from({ length: 24 }, (_, h) => h);
