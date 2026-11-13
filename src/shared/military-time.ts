/** Military (24-hour) time ↔ 12-hour time: parsing what people type, the four-digit form and how it is spoken. */

export type ClockTime = { h: number; m: number; s: number | null; /** Typed as 2400: the end of the day, the same instant as 0000 the next day. */ endOfDay: boolean };

const AM = /^(am|a\.m\.?|a|上午|早上|早晨|凌晨|午前|오전|sa|s\.a\.?|sáng)$/i;
const PM = /^(pm|p\.m\.?|p|下午|中午|傍晚|午後|오후|ch|c\.h\.?|chiều|trưa)$/i;
/** Evening words: PM, except that 12 in the evening is midnight (晚上12点, 12 giờ đêm). */
const NIGHT = /^(晚上|夜里|夜裡|夜晚|夜|밤|tối|đêm)$/i;
const MARKERS = String.raw`[ap]\.?\s?m\.?|[ap]|s\.?a\.?|c\.?h\.?|sáng|chiều|trưa|tối|đêm|上午|早上|早晨|凌晨|下午|中午|傍晚|晚上|夜里|夜裡|夜晚|午前|午後|오전|오후|밤`;
const TAIL = new RegExp(`^(.*?)\\s*(${MARKERS})$`, "i");
const HEAD = new RegExp(`^(${MARKERS.replace(String.raw`[ap]\.?\s?m\.?|[ap]|`, "")})\\s*(.*)$`, "i");

type Meridiem = "am" | "pm" | "night";

/** Splits a leading or trailing AM/PM marker (Latin, Chinese, Japanese, Korean, Vietnamese) from the clock part. */
function splitMeridiem(text: string): { clock: string; mer: Meridiem | null } | null {
  const compact = text.replace(/\s+/g, " ").trim();
  const pick = (marker: string, clock: string) => {
    const m = marker.replace(/\s/g, "");
    if (AM.test(m)) return { clock: clock.trim(), mer: "am" as const };
    if (PM.test(m)) return { clock: clock.trim(), mer: "pm" as const };
    if (NIGHT.test(m)) return { clock: clock.trim(), mer: "night" as const };
    return null;
  };
  const head = HEAD.exec(compact);
  if (head && head[2]) return pick(head[1]!, head[2]);
  const tail = TAIL.exec(compact);
  if (tail && tail[1] && /\d$/.test(tail[1].trim())) return pick(tail[2]!, tail[1]);
  return { clock: compact, mer: null };
}

/**
 * Reads a time: "1430", "14:30", "0830 hours", "14:30:15", "2:30 pm", "2 PM", "下午2:30", "下午2点半", "晚上12点",
 * "午前0時", "오후 2시 30분", "14 giờ 30", "2 giờ 30 chiều", "14h30". Returns null when it is not a time.
 */
export function parseTime(raw: string): ClockTime | null {
  let text = raw.trim()
    .replace(/[：]/g, ":")
    .replace(/\s*(hours?|hrs?|horas?|jam)\.?$/i, "")
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
  const { clock, mer } = split;
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
  if (mer) {
    // 0–12 with a marker; 0 is how Japan writes the hour after midnight or noon (午前0時, 午後0時).
    if (h > 12) return null;
    if (mer === "night") h = h === 12 ? 0 : (h % 12) + 12;
    else h = (h % 12) + (mer === "pm" ? 12 : 0);
    return { h, m, s, endOfDay: false };
  }
  if (h === 24 && m === 0 && !s) return { h: 0, m: 0, s, endOfDay: true };
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
