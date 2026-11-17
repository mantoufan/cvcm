import { describe, expect, it } from "vitest";
import { civilDate, dayNumber, fromLunar, leapMonthOf, lunarNewYear, lunarRange, toLunar, ganzhi, rokuyo, solarTerms, moonPhases, dayAt, setLunarData, type LunarData } from "../src/shared/lunar";
import data from "../src/shared/calendar-data.json";

setLunarData(data as LunarData);

// ICU's Chinese calendar (astronomical, Beijing time) as the reference for the UTC+8 tables.
const icu = new Intl.DateTimeFormat("en-u-ca-chinese", { timeZone: "UTC", year: "numeric", month: "numeric", day: "numeric" });
function icuLunar(n: number): { month: number; leap: boolean; day: number } {
  const parts = icu.formatToParts(new Date(n * 86400000));
  const month = parts.find((p) => p.type === "month")!.value;
  return { month: parseInt(month, 10), leap: /bis/.test(month), day: parseInt(parts.find((p) => p.type === "day")!.value, 10) };
}

describe("lunar tables", () => {
  it("match ICU's Chinese calendar from 1929 on, except where ICU is off by a near-midnight new moon", () => {
    // Before 1929 China kept Beijing mean time (UTC+7:45:40), which ICU models and these UTC+8 tables do not.
    // The months listed below are ICU errors: there a new moon falls within minutes of Beijing midnight and ICU's
    // approximation lands on the other day. The official dates are checked in the next test (2027, 2030, 2018).
    const icuOff = new Set(["1954-2", "1954-3", "1955-2", "1955-3", "1987-7", "1987-8", "1987-9", "1999-1", "1999-2", "2012-8", "2012-9", "2018-11", "2018-12", "2027-2", "2027-3", "2030-2", "2030-3", "2070-3", "2070-4", "2097-8", "2097-9"]);
    const misses: string[] = [];
    for (let n = dayNumber(1929, 3, 1); n <= dayNumber(2099, 12, 31); n++) {
      const ours = toLunar(n, "cn")!;
      const ref = icuLunar(n);
      const [y, m] = civilDate(n);
      if (icuOff.has(`${y}-${m}`)) continue;
      if (ours.month !== ref.month || ours.day !== ref.day || ours.leap !== ref.leap) misses.push(`${civilDate(n).join("-")} ours ${ours.month}${ours.leap ? "L" : ""}/${ours.day} icu ${ref.month}${ref.leap ? "L" : ""}/${ref.day}`);
    }
    expect(misses).toEqual([]);
  });

  it("knows lunar new year in each reckoning", () => {
    const iso = (n: number | null) => (n === null ? null : civilDate(n).map((v) => String(v).padStart(2, "0")).join("-"));
    expect(iso(lunarNewYear(2026, "cn"))).toBe("2026-02-17");
    expect(iso(lunarNewYear(2027, "cn"))).toBe("2027-02-06");
    expect(iso(lunarNewYear(2028, "cn"))).toBe("2028-01-26");
    expect(iso(lunarNewYear(2030, "cn"))).toBe("2030-02-03");
    expect(iso(lunarNewYear(1999, "cn"))).toBe("1999-02-16");
    expect(iso(fromLunar(2018, 10, 1))).toBe("2018-11-08");
    expect(iso(fromLunar(2012, 7, 1))).toBe("2012-08-17");
    expect(leapMonthOf(1987)).toBe(6);
    expect(leapMonthOf(2028)).toBe(5);
    expect(iso(lunarNewYear(2027, "vn"))).toBe("2027-02-06");
    expect(iso(lunarNewYear(2027, "kr"))).toBe("2027-02-07");
    // Vietnam's Tết a month before China's in 1985 (UTC+7 vs UTC+8).
    expect(iso(lunarNewYear(1985, "vn"))).toBe("1985-01-21");
    expect(iso(lunarNewYear(1985, "cn"))).toBe("1985-02-20");
    // Korea's 설날 2027 is 2027-02-07 (우주항공청 2027년 월력요항).
  });

  it("round-trips", () => {
    for (let n = lunarRange()[0]; n < lunarRange()[1]; n += 7) {
      const l = toLunar(n)!;
      expect(fromLunar(l.year, l.month, l.day, l.leap)).toBe(n);
    }
    expect(fromLunar(2027, 1.5, 1)).toBeNull();
    expect(fromLunar(2027, 1, 1.5)).toBeNull();
    expect(ganzhi(2026)).toBe("丙午");
    expect(ganzhi(2027)).toBe("丁未");
  });

  it("dates solar terms and moon phases", () => {
    const iso = (n: number) => civilDate(n).join("-");
    const winter = solarTerms().find((t) => t.index === 21 && civilDate(dayAt(t.at, 8))[0] === 2026)!;
    expect(iso(dayAt(winter.at, 8))).toBe("2026-12-22");
    expect(solarTerms().length).toBe(120);
    expect(moonPhases().length).toBeGreaterThan(240);
    expect(rokuyo({ year: 2027, month: 1, day: 1, leap: false, monthDays: 30 })).toBe(2);
  });
});
