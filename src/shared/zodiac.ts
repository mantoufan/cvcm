export const SIGNS = ["aries", "taurus", "gemini", "cancer", "leo", "virgo", "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces"] as const;
export type Sign = (typeof SIGNS)[number];
export const SIGN_SYMBOL: Record<Sign, string> = {
  aries: "♈", taurus: "♉", gemini: "♊", cancer: "♋", leo: "♌", virgo: "♍",
  libra: "♎", scorpio: "♏", sagittarius: "♐", capricorn: "♑", aquarius: "♒", pisces: "♓",
};
/** First day [month, day] of each sign in the usual tropical tables; the exact day can move by one from year to year. */
export const SIGN_START: Record<Sign, readonly [number, number]> = {
  aries: [3, 21], taurus: [4, 20], gemini: [5, 21], cancer: [6, 21], leo: [7, 23], virgo: [8, 23],
  libra: [9, 23], scorpio: [10, 23], sagittarius: [11, 22], capricorn: [12, 22], aquarius: [1, 20], pisces: [2, 19],
};
export const SIGN_ELEMENT: Record<Sign, "fire" | "earth" | "air" | "water"> = {
  aries: "fire", leo: "fire", sagittarius: "fire",
  taurus: "earth", virgo: "earth", capricorn: "earth",
  gemini: "air", libra: "air", aquarius: "air",
  cancer: "water", scorpio: "water", pisces: "water",
};

export const ANIMALS = ["rat", "ox", "tiger", "rabbit", "dragon", "snake", "horse", "goat", "monkey", "rooster", "dog", "pig"] as const;
export type Animal = (typeof ANIMALS)[number];
export const ANIMAL_EMOJI: Record<Animal, string> = {
  rat: "🐀", ox: "🐂", tiger: "🐅", rabbit: "🐇", dragon: "🐉", snake: "🐍",
  horse: "🐎", goat: "🐐", monkey: "🐒", rooster: "🐓", dog: "🐕", pig: "🐖",
};
export const ELEMENTS = ["wood", "fire", "earth", "metal", "water"] as const;
export type Element = (typeof ELEMENTS)[number];
const STEMS = "甲乙丙丁戊己庚辛壬癸";
const BRANCHES = "子丑寅卯辰巳午未申酉戌亥";

export function westernSign(month: number, day: number): Sign {
  const md = month * 100 + day;
  // Walk the signs in calendar order from Capricorn's January part.
  const order: Sign[] = ["aquarius", "pisces", "aries", "taurus", "gemini", "cancer", "leo", "virgo", "libra", "scorpio", "sagittarius", "capricorn"];
  let sign: Sign = "capricorn";
  for (const s of order) {
    const [m, d] = SIGN_START[s];
    if (md >= m * 100 + d) sign = s;
  }
  return sign;
}

/** Sexagenary year facts for a lunar year that starts in Gregorian `year`. */
export function lunarYear(year: number): { animal: Animal; element: Element; yin: boolean; ganzhi: string } {
  const stem = (((year - 4) % 10) + 10) % 10;
  const branch = (((year - 4) % 12) + 12) % 12;
  return { animal: ANIMALS[branch], element: ELEMENTS[stem >> 1], yin: stem % 2 === 1, ganzhi: STEMS[stem] + BRANCHES[branch] };
}

/**
 * Chinese (lunisolar) New Year dates, from the Chinese calendar in Intl when the runtime has it.
 * Returns [month, day] in `year`, or null when Intl cannot tell.
 */
const newYears = new Map<number, readonly [number, number] | null>();

export function lunarNewYear(year: number): readonly [number, number] | null {
  if (newYears.has(year)) return newYears.get(year)!;
  const found = findNewYear(year);
  newYears.set(year, found);
  return found;
}

function findNewYear(year: number): readonly [number, number] | null {
  const fmt = chineseFormatter();
  if (!fmt) return null;
  // New Year falls between 21 January and 20 February.
  for (let d = 0; d < 32; d++) {
    const date = new Date(Date.UTC(year, 0, 21 + d, 12));
    const parts = fmt.formatToParts(date);
    const month = parts.find((p) => p.type === "month")?.value;
    const day = parts.find((p) => p.type === "day")?.value;
    if (month === "1" && day === "1") return [date.getUTCMonth() + 1, date.getUTCDate()];
  }
  return null;
}

let cached: Intl.DateTimeFormat | null | undefined;
function chineseFormatter(): Intl.DateTimeFormat | null {
  if (cached !== undefined) return cached;
  try {
    const f = new Intl.DateTimeFormat("en-u-ca-chinese", { timeZone: "UTC", month: "numeric", day: "numeric" });
    cached = f.resolvedOptions().calendar === "chinese" ? f : null;
  } catch {
    cached = null;
  }
  return cached;
}

export type ZodiacResult = {
  sign: Sign;
  lunarYearStart: number;
  newYear: readonly [number, number] | null;
  beforeNewYear: boolean;
  uncertain: boolean;
} & ReturnType<typeof lunarYear>;

/** Western sign and Chinese zodiac for a birth date (Gregorian, 1900–2100). */
export function zodiacFor(year: number, month: number, day: number): ZodiacResult | null {
  if (![year, month, day].every(Number.isInteger) || year < 1900 || year > 2100) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  const newYear = lunarNewYear(year);
  const md = month * 100 + day;
  // New Year is never before 21 January, so earlier birthdays always belong to the previous lunar year.
  const beforeNewYear = newYear ? md < newYear[0] * 100 + newYear[1] : md < 121;
  // Without the calendar, a birthday from 21 January to 19 February may belong to either year (20 February never does).
  const uncertain = !newYear && md >= 121 && md < 220;
  const lunarYearStart = beforeNewYear ? year - 1 : year;
  return { sign: westernSign(month, day), lunarYearStart, newYear, beforeNewYear, uncertain, ...lunarYear(lunarYearStart) };
}
