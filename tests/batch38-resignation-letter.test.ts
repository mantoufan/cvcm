// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountResignationLetter, unmountResignationLetter } from "../src/client/resignation-letter/ui";
import { setLocale } from "../src/client/i18n";
import { LOCALES } from "../src/shared/locale";
import { letterDocxXml, letterText } from "../src/shared/letter-doc";
import {
  buildLetter,
  daysBetween,
  defaultForm,
  reiwaYear,
  serviceMonths,
  taiwanNoticeDays,
  type RlForm,
} from "../src/shared/resignation-letter";
import { RL_TEMPLATES } from "../src/shared/resignation-letter-templates";

const filled = (loc: keyof typeof RL_TEMPLATES, extra: Partial<RlForm> = {}): RlForm => ({
  ...defaultForm(RL_TEMPLATES[loc]),
  name: "Alex Chen",
  title: "Designer",
  department: "Design",
  company: "Acme",
  recipient: "Sam",
  place: "City",
  startDate: "2024-03-01",
  lastDay: "2026-12-04",
  date: "2026-11-20",
  ...extra,
});

describe("resignation letter logic", () => {
  it("counts days and months of service", () => {
    expect(daysBetween("2026-11-20", "2026-12-04")).toBe(14);
    expect(daysBetween("", "2026-12-04")).toBeNull();
    expect(serviceMonths("2024-03-01", "2026-11-20")).toBe(32);
    expect(serviceMonths("2026-01-31", "2026-02-28")).toBe(1);
    expect(serviceMonths("2026-01-31", "2026-02-27")).toBe(0);
  });

  it("applies the Taiwan Labor Standards Act notice periods", () => {
    expect(taiwanNoticeDays(2)).toBeNull();
    expect(taiwanNoticeDays(3)).toBe(10);
    expect(taiwanNoticeDays(11)).toBe(10);
    expect(taiwanNoticeDays(12)).toBe(20);
    expect(taiwanNoticeDays(35)).toBe(20);
    expect(taiwanNoticeDays(36)).toBe(30);
  });

  it("writes Reiwa years, 元年 for 2019", () => {
    expect(reiwaYear(2019, 5)).toBe("元");
    expect(reiwaYear(2019, 4)).toBeNull();
    expect(reiwaYear(2026, 11)).toBe("8");
  });

  it("builds a letter in every locale, blank and filled, with no placeholders left when filled", () => {
    for (const loc of LOCALES) {
      const tpl = RL_TEMPLATES[loc];
      for (const kind of tpl.kinds.map(([k]) => k)) {
        for (const scenario of tpl.scenarios.length ? tpl.scenarios.map(([s]) => s) : [""]) {
          const blank = letterText(buildLetter(tpl, { ...defaultForm(tpl), kind, scenario }));
          expect(blank.length, `${loc} ${kind} ${scenario}`).toBeGreaterThan(40);
          const text = letterText(buildLetter(tpl, filled(loc, { kind, scenario })));
          expect(text, `${loc}`).toContain("Alex Chen");
          expect(text).not.toMatch(/\[|____|\.\.\.\.\.|〇〇|○○○/);
        }
      }
    }
  });

  it("formats the Japanese 退職届 vertically with 私儀 and the 令和 date", () => {
    const doc = buildLetter(RL_TEMPLATES.ja, filled("ja"));
    expect(doc.vertical).toBe(true);
    const text = letterText(doc);
    expect(text).toContain("退職届");
    expect(text).toContain("私儀");
    expect(text).toContain("令和8年12月4日をもって退職いたします。");
    const negai = letterText(buildLetter(RL_TEMPLATES.ja, filled("ja", { kind: "negai", era: "seireki", vertical: false })));
    expect(negai).toContain("2026年12月4日をもって退職いたしたく、ここにお願い申し上げます。");
    expect(negai).toContain("以上");
    expect(letterDocxXml(doc, "a4")).toContain('<w:textDirection w:val="tbRl"/>');
  });

  it("uses the Korean form table and the Vietnamese national motto", () => {
    const ko = buildLetter(RL_TEMPLATES.ko, filled("ko"));
    const table = ko.lines.find((l) => l.table)!.table!;
    expect(table.map(([k]) => k)).toEqual(["소속", "직위", "성명", "입사일", "퇴사 예정일", "사직 사유"]);
    expect(letterDocxXml(ko, "a4")).toContain("<w:tbl>");
    const vi = letterText(buildLetter(RL_TEMPLATES.vi, filled("vi")));
    expect(vi).toContain("CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM");
    expect(vi).toContain("ngày 04 tháng 12 năm 2026");
  });

  it("writes 民國 years in Taiwan and 此致 敬礼 in mainland letters", () => {
    expect(letterText(buildLetter(RL_TEMPLATES["zh-TW"], filled("zh-TW")))).toContain("中華民國115年11月20日");
    const cn = letterText(buildLetter(RL_TEMPLATES["zh-CN"], filled("zh-CN")));
    expect(cn).toMatch(/此致\n敬礼！/);
  });

  it("replaces only the body when the text is edited", () => {
    const f = filled("en", { custom: true, body: "First paragraph.\n\nSecond paragraph." });
    const text = letterText(buildLetter(RL_TEMPLATES.en, f));
    expect(text).toContain("First paragraph.\n\nSecond paragraph.");
    expect(text).toContain("Dear Sam,");
    expect(text).toContain("Sincerely,");
    expect(text).not.toContain("formal notice");
  });
});

describe("resignation letter ui", () => {
  let host: HTMLElement;
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    host = document.createElement("div");
    document.body.append(host);
  });
  afterEach(() => {
    unmountResignationLetter();
    host.remove();
    setLocale("en");
    vi.useRealTimers();
  });
  const q = <T extends HTMLElement>(sel: string) => host.querySelector<T>(sel)!;
  const set = (sel: string, value: string, event = "input") => {
    const el = q<HTMLInputElement | HTMLSelectElement>(sel);
    el.value = value;
    el.dispatchEvent(new Event(event));
    vi.advanceTimersByTime(100);
  };

  it("mounts a blank template without writing storage, then updates and saves", () => {
    setLocale("en");
    mountResignationLetter(host);
    expect(q("h1").textContent).toBe("Resignation letter generator");
    expect(q("[data-out=sheet]").textContent).toContain("[Your name]");
    expect(localStorage.getItem("cvcm.resignation-letter.v1")).toBeNull();
    set("[data-field=name]", "Jordan Lee");
    expect(q("[data-out=sheet]").textContent).toContain("Jordan Lee");
    set("[data-field=scenario]", "retirement", "change");
    expect(q("[data-out=sheet]").textContent).toContain("retire");
    vi.advanceTimersByTime(500);
    expect(JSON.parse(localStorage.getItem("cvcm.resignation-letter.v1")!).form.name).toBe("Jordan Lee");
  });

  it("switches to edited text seeded with the generated body", () => {
    setLocale("en");
    mountResignationLetter(host);
    const box = q<HTMLInputElement>("[data-field=custom]");
    box.checked = true;
    box.dispatchEvent(new Event("change"));
    const area = q<HTMLTextAreaElement>("[data-field=body]");
    expect(area.hidden).toBe(false);
    expect(area.value).toContain("formal notice");
    area.value = "My own words.";
    area.dispatchEvent(new Event("input"));
    vi.advanceTimersByTime(100);
    expect(q("[data-out=sheet]").textContent).toContain("My own words.");
    expect(q("[data-out=sheet]").textContent).not.toContain("formal notice");
  });

  it("shows the Taiwan notice period from the start date", () => {
    setLocale("zh-TW");
    mountResignationLetter(host);
    set("[data-field=startDate]", "2024-03-01");
    set("[data-field=date]", "2026-11-20");
    expect(q("[data-out=notice]").textContent).toContain("20 日前預告");
  });

  it("renders every locale with its own labels", () => {
    for (const loc of LOCALES) {
      setLocale(loc);
      host.replaceChildren();
      mountResignationLetter(host);
      expect(host.textContent, loc).not.toMatch(/resignationLetter\./);
      unmountResignationLetter();
    }
  });
});
