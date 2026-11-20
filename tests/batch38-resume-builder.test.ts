// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STORE, mountResumeBuilder, unmountResumeBuilder } from "../src/client/resume-builder/ui";
import { formatDate, formatYm, renderResume } from "../src/client/resume-builder/render";
import { setLocale, t } from "../src/client/i18n";
import { LOCALES } from "../src/shared/locale";
import { ageOn, defaultFormat, emptyResume, formatsFor, normalizeDate, normalizeYm, parseResume, wareki } from "../src/shared/resume";
import { DOC_HEADINGS, sampleResume } from "../src/shared/resume-samples";

describe("resume model", () => {
  it("reads typed months and dates", () => {
    expect(normalizeYm("2021/4")).toBe("2021-04");
    expect(normalizeYm("2021.04")).toBe("2021-04");
    expect(normalizeYm("2021年4月")).toBe("2021-04");
    expect(normalizeYm("202104")).toBe("2021-04");
    expect(normalizeYm("2021-13")).toBe("2021-13");
    expect(normalizeYm("Summer 2020")).toBe("Summer 2020");
    expect(normalizeDate("1996/4/12")).toBe("1996-04-12");
    expect(normalizeDate("1996年4月12日")).toBe("1996-04-12");
    expect(normalizeDate("2023-02-30")).toBe("2023-02-30");
  });

  it("converts to Japanese era years", () => {
    expect(wareki({ y: 2019, m: 4 })).toEqual({ era: "平成", year: "31" });
    expect(wareki({ y: 2019, m: 5 })).toEqual({ era: "令和", year: "元" });
    expect(wareki({ y: 2021, m: 4 })).toEqual({ era: "令和", year: "3" });
    expect(wareki({ y: 1989, m: 1, d: 7 })).toEqual({ era: "昭和", year: "64" });
    expect(wareki({ y: 1989, m: 1 })).toEqual({ era: "平成", year: "元" });
    expect(wareki({ y: 1996, m: 4, d: 12 })).toEqual({ era: "平成", year: "8" });
  });

  it("counts whole years of age", () => {
    expect(ageOn({ y: 1996, m: 4, d: 12 }, { y: 2026, m: 4, d: 11 })).toBe(29);
    expect(ageOn({ y: 1996, m: 4, d: 12 }, { y: 2026, m: 4, d: 12 })).toBe(30);
  });

  it("only accepts its own files and cleans what it keeps", () => {
    expect(parseResume(null)).toBeNull();
    expect(parseResume({ v: 2, basics: {} })).toBeNull();
    const r = parseResume({
      v: 1, format: "nope", basics: { name: "A\u0007B", photo: "javascript:alert(1)" },
      experience: Array.from({ length: 50 }, () => ({ role: 5, org: "X" })),
    })!;
    expect(r.format).toBe("ats");
    expect(r.basics.name).toBe("AB");
    expect(r.basics.photo).toBe("");
    expect(r.experience).toHaveLength(30);
    expect(r.experience[0].role).toBe("");
    const ok = parseResume({ v: 1, basics: { photo: "data:image/jpeg;base64,AAAA" } })!;
    expect(ok.basics.photo).toBe("data:image/jpeg;base64,AAAA");
  });

  it("round-trips every sample through JSON", () => {
    for (const loc of LOCALES) {
      const s = sampleResume(loc);
      expect(s.format).toBe(defaultFormat(loc));
      expect(formatsFor(loc)).toContain(s.format);
      expect(parseResume(JSON.parse(JSON.stringify(s)))).toEqual(s);
      expect(DOC_HEADINGS[loc]).toBeDefined();
    }
  });

  it("formats months per language", () => {
    expect(formatYm("2021-04", "en")).toBe("Apr 2021");
    expect(formatYm("2021-04", "zh-CN")).toBe("2021.04");
    expect(formatYm("2021-04", "vi")).toBe("04/2021");
    expect(formatYm("2021-04", "ja")).toBe("2021年4月");
    expect(formatYm("2021-04", "ja", "wareki")).toBe("令和3年4月");
    expect(formatDate("2026-11-20", "ko")).toBe("2026년 11월 20일");
  });
});

describe("resume layouts", () => {
  it("writes the 履歴書 history rows in order and ends with 以上", () => {
    const doc = renderResume(sampleResume("ja"), "ja");
    const rows = [...doc.querySelectorAll(".rs-jp-hist")[0].querySelectorAll("tbody tr")].map((tr) => [...tr.children].map((c) => c.textContent));
    expect(rows[0][2]).toBe("学歴");
    expect(rows[1]).toEqual(["2012", "4", "東京都立青葉高等学校 入学"]);
    expect(rows.some((r) => r[2] === "桜ヶ丘大学 経済学部 経営学科 卒業")).toBe(true);
    const jobs = rows.findIndex((r) => r[2] === "職歴");
    expect(rows[jobs + 1]).toEqual(["2019", "4", "株式会社みどり商事 入社"]);
    expect(rows.at(-2)![2]).toBe("現在に至る");
    expect(rows.at(-1)![2]).toBe("以上");
    // No commute / dependants / spouse boxes (removed from the 2021 MHLW example form).
    expect(doc.textContent).not.toMatch(/通勤時間|扶養家族|配偶者/);
  });

  it("uses era years when asked", () => {
    const r = sampleResume("ja");
    r.era = "wareki";
    const doc = renderResume(r, "ja");
    expect(doc.textContent).toContain("平成314株式会社みどり商事 入社");
    expect(doc.textContent).toContain("平成8年4月12日生");
  });

  it("marks today-dependent text volatile and keeps a typed date", () => {
    const r = sampleResume("ko");
    expect(renderResume(r, "ko").querySelector("[data-volatile]")).not.toBeNull();
    r.basics.asOf = "2026-03-02";
    const doc = renderResume(r, "ko");
    expect(doc.querySelector("[data-volatile]")).toBeNull();
    expect(doc.textContent).toContain("2026년 3월 2일");
    expect(doc.textContent).toContain("위의 기재 사항은 사실과 틀림없습니다.");
  });

  it("prints the ATS layout without a photo and the photo layout with one", () => {
    const r = sampleResume("en");
    r.basics.photo = "data:image/jpeg;base64,AAAA";
    expect(renderResume(r, "en").querySelector("img")).toBeNull();
    r.format = "photo";
    expect(renderResume(r, "en").querySelector("img.rs-photo")).not.toBeNull();
  });

  it("puts the Chinese self-evaluation last", () => {
    const doc = renderResume(sampleResume("zh-CN"), "zh-CN");
    const heads = [...doc.querySelectorAll(".rs-h")].map((e) => e.textContent);
    expect(heads.at(-1)).toBe("自我评价");
  });

  it("renders an empty résumé without errors in every layout", () => {
    for (const f of ["ats", "photo", "rirekisho", "shokumu", "kr"] as const) {
      expect(renderResume(emptyResume(f), "en").childElementCount).toBeGreaterThan(0);
    }
  });
});

describe("resume builder ui", () => {
  let host: HTMLElement;
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    host = document.createElement("div");
    document.body.append(host);
  });
  afterEach(() => {
    unmountResumeBuilder();
    host.remove();
    setLocale("en");
    vi.useRealTimers();
    localStorage.clear();
  });
  const q = <T extends HTMLElement>(sel: string) => host.querySelector<T>(sel)!;

  it("opens with the example and saves nothing until an edit", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    mountResumeBuilder(host);
    expect(q("h1").textContent).toBe(t("resumeBuilder.title"));
    expect(q("[data-out=sheet]").textContent).toContain("Jordan Lee");
    vi.advanceTimersByTime(2000);
    expect(setItem).not.toHaveBeenCalled();
    const name = q<HTMLInputElement>("[data-field=name]");
    name.value = "Sam Rivera";
    name.dispatchEvent(new Event("input"));
    vi.advanceTimersByTime(1000);
    expect(q("[data-out=sheet]").textContent).toContain("Sam Rivera");
    expect(JSON.parse(localStorage.getItem(STORE)!).en.r.basics.name).toBe("Sam Rivera");
    setItem.mockRestore();
  });

  it("reopens the saved draft", () => {
    const r = sampleResume("en");
    r.basics.name = "Draft Person";
    localStorage.setItem(STORE, JSON.stringify({ en: { r, paper: "a4" } }));
    mountResumeBuilder(host);
    expect(q("[data-out=sheet]").textContent).toContain("Draft Person");
    expect(q("[data-out=sheet]").classList.contains("doc-a4")).toBe(true);
  });

  it("adds, moves and removes entries", () => {
    mountResumeBuilder(host);
    const count = () => host.querySelectorAll("[data-list=add-experience] fieldset").length;
    expect(count()).toBe(2);
    q<HTMLButtonElement>("[data-action=add-experience]").click();
    expect(count()).toBe(3);
    const roles = () => [...host.querySelectorAll<HTMLInputElement>("[data-list=add-experience] [data-field=role]")].map((i) => i.value);
    expect(roles()[0]).toBe("Marketing Manager");
    host.querySelectorAll<HTMLButtonElement>("[data-list=add-experience] [data-action=down]")[0].click();
    expect(roles()[1]).toBe("Marketing Manager");
    host.querySelectorAll<HTMLButtonElement>("[data-list=add-experience] [data-action=remove]")[2].click();
    expect(count()).toBe(2);
  });

  it("shows the 履歴書 on the Japanese page and switches to the 職務経歴書", () => {
    setLocale("ja");
    mountResumeBuilder(host);
    expect(q<HTMLSelectElement>("[data-field=format]").value).toBe("rirekisho");
    expect(q("[data-out=sheet]").textContent).toContain("履歴書");
    expect(q("[data-field=kana]")).not.toBeNull();
    const sel = q<HTMLSelectElement>("[data-field=format]");
    sel.value = "shokumu";
    sel.dispatchEvent(new Event("change"));
    vi.advanceTimersByTime(200);
    expect(q("[data-out=sheet]").textContent).toContain("職務経歴書");
    expect(q("[data-out=sheet]").textContent).toContain("■職務要約");
    expect(host.querySelector("[data-field=kana]")).toBeNull();
  });

  it("asks twice before clearing", () => {
    mountResumeBuilder(host);
    const clear = q<HTMLButtonElement>("[data-action=clear]");
    clear.click();
    expect(q("[data-out=sheet]").textContent).toContain("Jordan Lee");
    clear.click();
    vi.advanceTimersByTime(200);
    expect(q("[data-out=sheet]").textContent).not.toContain("Jordan Lee");
  });

  it("has every label in every language", () => {
    for (const loc of LOCALES) {
      setLocale(loc);
      for (const key of ["title", "print", "f_ats", "fh_rirekisho", "photoIdLink", "printHint"]) {
        expect(t(`resumeBuilder.${key}`), `${loc} ${key}`).not.toBe(`resumeBuilder.${key}`);
      }
    }
  });
});
