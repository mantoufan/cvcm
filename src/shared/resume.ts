/**
 * Résumé builder model: one record for every layout (ATS CV, CV with photo, the Japanese 履歴書 and 職務経歴書, the
 * Korean 이력서), plus the date handling the layouts share. Loaded drafts and JSON files go through `parseResume`, so a
 * page never renders anything but plain strings of bounded length.
 */

export const RESUME_FORMATS = ["ats", "photo", "rirekisho", "shokumu", "kr"] as const;
export type ResumeFormat = (typeof RESUME_FORMATS)[number];
export type Era = "seireki" | "wareki";

export type Experience = { role: string; org: string; place: string; start: string; end: string; current: boolean; details: string };
export type Education = { school: string; degree: string; place: string; start: string; end: string; details: string };
export type Cert = { date: string; name: string };

export type Resume = {
  v: 1;
  format: ResumeFormat;
  era: Era;
  basics: {
    name: string;
    /** ふりがな (Japanese layouts only). */
    kana: string;
    /** Job title or the job sought (求职意向). */
    title: string;
    email: string;
    phone: string;
    address: string;
    /** One link per line (LinkedIn, portfolio). */
    links: string;
    /** YYYY-MM-DD, or "". */
    birth: string;
    /** Free text, optional (the 2021 MHLW 履歴書 example makes it optional). */
    gender: string;
    /** The "as of" date of the 履歴書 / 職務経歴書 / 이력서, YYYY-MM-DD; "" means today. */
    asOf: string;
    /** A JPEG data URL cropped to 3:4 in the page, or "". */
    photo: string;
  };
  summary: string;
  experience: Experience[];
  education: Education[];
  skills: string;
  languages: string;
  certs: Cert[];
  /** 志望の動機・自己PR (Japanese layouts). */
  motivation: string;
  /** 本人希望記入欄. */
  wishes: string;
  /** Anything else (기타, awards, volunteering). */
  extra: string;
};

export const MAX_ENTRIES = 30;
const MAX_TEXT = 4000;
const MAX_LINE = 300;
/** A cropped 300 × 400 JPEG is about 30–60 KB; allow headroom for a pasted file from another device. */
export const MAX_PHOTO_CHARS = 400_000;
const PHOTO_URL = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/;

export function emptyExperience(): Experience {
  return { role: "", org: "", place: "", start: "", end: "", current: false, details: "" };
}
export function emptyEducation(): Education {
  return { school: "", degree: "", place: "", start: "", end: "", details: "" };
}
export function emptyCert(): Cert {
  return { date: "", name: "" };
}

export function emptyResume(format: ResumeFormat): Resume {
  return {
    v: 1,
    format,
    era: "seireki",
    basics: { name: "", kana: "", title: "", email: "", phone: "", address: "", links: "", birth: "", gender: "", asOf: "", photo: "" },
    summary: "",
    experience: [emptyExperience()],
    education: [emptyEducation()],
    skills: "",
    languages: "",
    certs: [],
    motivation: "",
    wishes: "",
    extra: "",
  };
}

/** The layout a language opens with. */
export function defaultFormat(loc: string): ResumeFormat {
  if (loc === "ja") return "rirekisho";
  if (loc === "ko") return "kr";
  if (loc === "zh-CN" || loc === "zh-TW" || loc === "vi") return "photo";
  return "ats";
}

/** Layouts offered in a language: the Japanese and Korean forms are written in their own language. */
export function formatsFor(loc: string): ResumeFormat[] {
  if (loc === "ja") return ["rirekisho", "shokumu", "ats", "photo"];
  if (loc === "ko") return ["kr", "ats", "photo"];
  if (loc === "zh-CN" || loc === "zh-TW" || loc === "vi") return ["photo", "ats"];
  return ["ats", "photo"];
}

function str(value: unknown, max = MAX_LINE): string {
  if (typeof value !== "string") return "";
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").slice(0, max);
}

function obj(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function list<T>(value: unknown, read: (o: Record<string, unknown>) => T): T[] {
  return Array.isArray(value) ? value.slice(0, MAX_ENTRIES).map((v) => read(obj(v))) : [];
}

/** A draft or a JSON file → a clean résumé, or null when it is not one of ours. */
export function parseResume(input: unknown): Resume | null {
  const o = obj(input);
  if (o.v !== 1 || typeof o.basics !== "object" || o.basics === null) return null;
  const b = obj(o.basics);
  const format = RESUME_FORMATS.includes(o.format as ResumeFormat) ? (o.format as ResumeFormat) : "ats";
  const photo = typeof b.photo === "string" && b.photo.length <= MAX_PHOTO_CHARS && PHOTO_URL.test(b.photo) ? b.photo : "";
  return {
    v: 1,
    format,
    era: o.era === "wareki" ? "wareki" : "seireki",
    basics: {
      name: str(b.name), kana: str(b.kana), title: str(b.title), email: str(b.email), phone: str(b.phone),
      address: str(b.address, 600), links: str(b.links, 1200), birth: normalizeDate(str(b.birth)), gender: str(b.gender, 40),
      asOf: normalizeDate(str(b.asOf)), photo,
    },
    summary: str(o.summary, MAX_TEXT),
    experience: list(o.experience, (e) => ({
      role: str(e.role), org: str(e.org), place: str(e.place), start: normalizeYm(str(e.start)), end: normalizeYm(str(e.end)),
      current: e.current === true, details: str(e.details, MAX_TEXT),
    })),
    education: list(o.education, (e) => ({
      school: str(e.school), degree: str(e.degree), place: str(e.place), start: normalizeYm(str(e.start)), end: normalizeYm(str(e.end)),
      details: str(e.details, MAX_TEXT),
    })),
    skills: str(o.skills, MAX_TEXT),
    languages: str(o.languages, MAX_TEXT),
    certs: list(o.certs, (c) => ({ date: normalizeYm(str(c.date)), name: str(c.name) })),
    motivation: str(o.motivation, MAX_TEXT),
    wishes: str(o.wishes, MAX_TEXT),
    extra: str(o.extra, MAX_TEXT),
  };
}

/**
 * A typed month → "YYYY-MM": accepts 2021-04, 2021/4, 2021.4, 2021年4月, 202104 and a bare year (→ "YYYY").
 * Anything else is kept as typed, so the layout prints what the visitor wrote ("Summer 2020").
 */
export function normalizeYm(value: string): string {
  const v = value.trim();
  const m = /^(\d{4})\s*(?:[-/.年]\s*(\d{1,2})\s*月?|(\d{2}))$/.exec(v);
  if (m) {
    const month = Number(m[2] ?? m[3]);
    if (month >= 1 && month <= 12) return `${m[1]}-${String(month).padStart(2, "0")}`;
  }
  return v;
}

/** A typed date → "YYYY-MM-DD" (2021-04-01, 2021/4/1, 2021.4.1, 2021年4月1日, 20210401); else as typed. */
export function normalizeDate(value: string): string {
  const v = value.trim();
  const m = /^(\d{4})\s*[-/.年]\s*(\d{1,2})\s*[-/.月]\s*(\d{1,2})\s*日?$/.exec(v) ?? /^(\d{4})(\d{2})(\d{2})$/.exec(v);
  if (m) {
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const date = new Date(Date.UTC(y, mo - 1, d));
    if (date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d) {
      return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }
  return v;
}

export type Ymd = { y: number; m: number; d?: number };

/** "2021-04" / "2021-04-01" / "2021" → parts; null when the text is free-form. */
export function parseYmd(value: string): Ymd | null {
  const m = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(value);
  if (!m) return null;
  return { y: Number(m[1]), m: m[2] ? Number(m[2]) : 0, d: m[3] ? Number(m[3]) : undefined };
}

/** Japanese eras since Meiji 6 (the Gregorian calendar), first day of each. */
const ERAS: readonly { name: string; y: number; m: number; d: number }[] = [
  { name: "令和", y: 2019, m: 5, d: 1 },
  { name: "平成", y: 1989, m: 1, d: 8 },
  { name: "昭和", y: 1926, m: 12, d: 25 },
  { name: "大正", y: 1912, m: 7, d: 30 },
  { name: "明治", y: 1868, m: 1, d: 25 },
];

/**
 * A Gregorian date in 和暦: { era: "令和", year: "3" } ("元" for an era's first year). Without a day the month is
 * read as its 15th, so 1989-01 is 平成元年 and 2019-04 is 平成31年 (a résumé date names the month you started).
 */
export function wareki(p: Ymd): { era: string; year: string } {
  const day = p.d ?? 15;
  const month = p.m || 6;
  const key = p.y * 10000 + month * 100 + day;
  const era = ERAS.find((e) => key >= e.y * 10000 + e.m * 100 + e.d) ?? ERAS[ERAS.length - 1];
  const n = p.y - era.y + 1;
  return { era: era.name, year: n === 1 ? "元" : String(n) };
}

/** Whole years from a birth date to a day (満年齢). */
export function ageOn(birth: Ymd, on: { y: number; m: number; d: number }): number {
  let age = on.y - birth.y;
  if (on.m < birth.m || (on.m === birth.m && on.d < (birth.d ?? 1))) age--;
  return age;
}

/** Non-empty trimmed lines (bullets, links, skills). Leading "-", "•" or "・" is dropped. */
export function lines(text: string): string[] {
  return text.split(/\r?\n/).map((l) => l.trim().replace(/^[-•・*]\s*/, "")).filter(Boolean);
}

export function todayYmd(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
