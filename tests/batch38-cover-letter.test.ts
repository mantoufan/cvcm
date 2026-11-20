// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STORAGE_KEY, mountCoverLetter, unmountCoverLetter } from "../src/client/cover-letter/ui";
import { setLocale } from "../src/client/i18n";
import {
  blankData,
  bodyText,
  buildCover,
  charCount,
  items,
  paragraphs,
  restoreData,
  sampleData,
  type CoverData,
} from "../src/shared/cover-letter";
import { COVER_TEMPLATES } from "../src/shared/cover-letter-templates";
import { letterDocx, letterText } from "../src/shared/letter-doc";
import { LOCALES } from "../src/shared/locale";

const withDate = (d: CoverData, date = "2026-11-20"): CoverData => ({ ...d, date });
const textOf = (loc: keyof typeof COVER_TEMPLATES, d: CoverData) => letterText(buildCover(COVER_TEMPLATES[loc], d).doc);

describe("cover letter helpers", () => {
  it("splits items and drops typed list marks", () => {
    expect(items("- one\n• two\n\n3. three\n  four  ")).toEqual(["one", "two", "three", "four"]);
  });
  it("splits a rewritten body on blank lines", () => {
    expect(paragraphs("First line\nstill first\n\n\nSecond\r\n\r\nThird  ")).toEqual(["First line\nstill first", "Second", "Third"]);
  });
  it("counts characters with and without spaces, a line break as one", () => {
    expect(charCount("가나 다\r\n라")).toEqual({ withSpaces: 6, withoutSpaces: 4 });
  });
  it("keeps only valid draft fields", () => {
    const tpl = COVER_TEMPLATES.id;
    const r = restoreData({ name: "A", scenario: "bogus", enclosures: [1, 1, 99, -1, 2.5, 0], custom: 3, extra: "x" }, tpl)!;
    expect(r.name).toBe("A");
    expect(r.scenario).toBe("experienced");
    expect(r.enclosures).toEqual([0, 1]);
    expect(r.custom).toBeNull();
    expect(restoreData("nope", tpl)).toBeNull();
  });
});

describe("cover letter templates", () => {
  it("picks a or an by sound", () => {
    const base = withDate(sampleData(COVER_TEMPLATES.en));
    for (const [role, want] of [["European sales manager", "as a European"], ["one-person IT lead", "as a one-person"], ["university tutor", "as a university"], ["office manager", "as an office"], ["MBA intern", "as an MBA"], ["hourly cashier", "as an hourly"], ["engineer", "as an engineer"], ["nurse", "as a nurse"]] as const) {
      expect(textOf("en", { ...base, role })).toContain(want);
    }
  });
  it("writes one year in the singular", () => {
    const one = { ...withDate(sampleData(COVER_TEMPLATES.en)), years: "1" };
    expect(textOf("en", one)).toContain("I have 1 year of experience");
    expect(textOf("en", { ...one, scenario: "change" })).toContain("After 1 year as");
    expect(textOf("en", { ...one, years: "11" })).toContain("11 years");
    expect(textOf("es", { ...withDate(sampleData(COVER_TEMPLATES.es)), years: "1" })).toContain("1 año de experiencia");
  });

  it.each(LOCALES)("%s: the sample letter has no fill-in marks", (loc) => {
    const tpl = COVER_TEMPLATES[loc];
    const text = textOf(loc, withDate(sampleData(tpl)));
    expect(text).not.toMatch(/[[［]/);
    expect(text).toContain(tpl.sample.name);
    if (tpl.sample.company) expect(text).toContain(tpl.sample.company);
  });

  it.each(LOCALES)("%s: an empty form still gives a readable letter and a date line", (loc) => {
    const tpl = COVER_TEMPLATES[loc];
    const built = buildCover(tpl, blankData());
    expect(letterText(built.doc).length).toBeGreaterThan(40);
    if (loc !== "ko") expect(built.dateLine).toBeGreaterThanOrEqual(0);
  });

  it("writes each English scenario's own opening", () => {
    const base = withDate(sampleData(COVER_TEMPLATES.en));
    expect(textOf("en", base)).toContain("I have 3 years of experience as a marketing coordinator");
    expect(textOf("en", { ...base, scenario: "graduate" })).toContain("I recently graduated with a bachelor's degree");
    expect(textOf("en", { ...base, scenario: "internship" })).toContain("I am currently studying for");
    expect(textOf("en", { ...base, scenario: "change" })).toContain("After 3 years as a marketing coordinator");
    expect(textOf("en", base)).toContain("November 20, 2026");
    expect(textOf("en", { ...base, manager: "" })).toContain("Dear Hiring Manager,");
  });

  it("uses an for vowel sounds", () => {
    const d = withDate({ ...sampleData(COVER_TEMPLATES.en), role: "accountant" });
    expect(textOf("en", d)).toContain("as an accountant");
  });

  it("fills the Indonesian heading, data table and enclosures", () => {
    const tpl = COVER_TEMPLATES.id;
    const d = withDate(sampleData(tpl));
    const built = buildCover(tpl, d);
    const text = letterText(built.doc);
    expect(text).toContain("Jakarta, 20 November 2026");
    expect(text).toContain("Perihal: Lamaran Pekerjaan sebagai Staf Administrasi\nLampiran: 4 berkas");
    expect(text).toContain("Tempat, tanggal lahir: Bandung, 14 Maret 2000");
    expect(text).toContain("4. Pas foto terbaru");
    expect(text).toContain("di Tempat");
    expect(letterText(buildCover(tpl, { ...d, enclosures: [] }).doc)).toContain("Lampiran: -");
  });

  it("writes the Vietnamese date with leading zeros for days under 10 and January–February", () => {
    const tpl = COVER_TEMPLATES.vi;
    expect(textOf("vi", withDate(sampleData(tpl), "2026-01-05"))).toContain("Hà Nội, ngày 05 tháng 01 năm 2026");
    expect(textOf("vi", withDate(sampleData(tpl), "2026-11-20"))).toContain("Hà Nội, ngày 20 tháng 11 năm 2026");
    expect(textOf("vi", sampleData(tpl))).toContain("ngày ..... tháng");
  });

  it("lays out the Japanese 送付状 with 拝啓…敬具 and 記…以上", () => {
    const text = textOf("ja", withDate(sampleData(COVER_TEMPLATES.ja)));
    const order = ["2026年11月20日", "株式会社みらい商事", "応募書類の送付について", "拝啓", "貴社採用サイトにて営業職の求人", "敬具", "記", "履歴書　1通", "以上"];
    let at = -1;
    for (const part of order) {
      const next = text.indexOf(part, at + 1);
      expect(next, part).toBeGreaterThan(at);
      at = next;
    }
    expect(textOf("ja", withDate({ ...sampleData(COVER_TEMPLATES.ja), enclosures: [] }))).not.toContain("以上");
  });

  it("prints the four Korean sections in order", () => {
    const text = textOf("ko", sampleData(COVER_TEMPLATES.ko));
    expect(text.indexOf("1. 성장과정")).toBeLessThan(text.indexOf("4. 입사 후 포부"));
    expect(textOf("ko", blankData())).toContain("(내용을 입력하세요)");
  });

  it("closes the Chinese letters with 此致 敬礼 and 敬祝 商祺", () => {
    expect(textOf("zh-CN", withDate(sampleData(COVER_TEMPLATES["zh-CN"])))).toMatch(/此致\n敬礼！\n\n求职人：张伟/);
    expect(textOf("zh-TW", withDate(sampleData(COVER_TEMPLATES["zh-TW"])))).toMatch(/敬祝\n商祺\n\n應徵者　林怡君　敬上/);
  });

  it("uses the visitor's own body when they edit it", () => {
    const tpl = COVER_TEMPLATES.en;
    const d = withDate(sampleData(tpl));
    expect(bodyText(tpl, d).split("\n\n").length).toBe(4);
    const text = textOf("en", { ...d, custom: "My own paragraph.\n\nAnother one." });
    expect(text).toContain("Dear Jordan Lee,\n\nMy own paragraph.\n\nAnother one.\n\nSincerely,");
  });

  it("writes a Word file", () => {
    const bytes = letterDocx(buildCover(COVER_TEMPLATES.id, withDate(sampleData(COVER_TEMPLATES.id))).doc, "a4");
    expect([...bytes.slice(0, 2)]).toEqual([0x50, 0x4b]);
  });
});

describe("cover letter ui", () => {
  let host: HTMLElement;
  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
    host = document.createElement("div");
    document.body.append(host);
  });
  afterEach(() => {
    unmountCoverLetter();
    host.remove();
    setLocale("en");
    vi.useRealTimers();
  });
  const q = <T extends HTMLElement>(sel: string) => host.querySelector<T>(sel)!;
  const sheetText = () => q("[data-out=sheet]").textContent ?? "";
  const type = (sel: string, value: string) => {
    const el = q<HTMLInputElement>(sel);
    el.value = value;
    el.dispatchEvent(new Event("input"));
    vi.advanceTimersByTime(500);
  };

  it("opens with the example letter, marks the date volatile and saves nothing at mount", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    mountCoverLetter(host);
    expect(q("h1").textContent).toBe("Cover letter generator");
    expect(sheetText()).toContain("Alex Morgan");
    expect(sheetText()).toContain("Brightside Foods");
    expect(q("[data-out=sheet]").querySelectorAll("[data-volatile]").length).toBe(1);
    vi.advanceTimersByTime(1000);
    expect(setItem).not.toHaveBeenCalled();
    setItem.mockRestore();
  });

  it("updates the preview and saves a draft as the visitor types", () => {
    mountCoverLetter(host);
    type("[data-field=company]", "Acme Corp");
    expect(sheetText()).toContain("Acme Corp");
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)!).en.company).toBe("Acme Corp");
    unmountCoverLetter();
    host.replaceChildren();
    mountCoverLetter(host);
    expect(q<HTMLInputElement>("[data-field=company]").value).toBe("Acme Corp");
  });

  it("hides fields a scenario does not use", () => {
    mountCoverLetter(host);
    const edu = q("[data-field=education]").closest("label")!;
    const role = q("[data-field=role]").closest("label")!;
    expect(edu.hidden).toBe(true);
    const sel = q<HTMLSelectElement>("[data-field=scenario]");
    sel.value = "graduate";
    sel.dispatchEvent(new Event("change"));
    vi.advanceTimersByTime(100);
    expect(edu.hidden).toBe(false);
    expect(role.hidden).toBe(true);
    expect(sheetText()).toContain("recently graduated");
  });

  it("turns the body into free text with Edit the text", () => {
    mountCoverLetter(host);
    const box = q<HTMLInputElement>("[data-field=edit]");
    box.checked = true;
    box.dispatchEvent(new Event("change"));
    const area = q<HTMLTextAreaElement>("[data-field=custom]");
    expect(area.value).toContain("I am writing to apply");
    type("[data-field=custom]", "Short and sweet.");
    expect(sheetText()).toContain("Short and sweet.");
    type("[data-field=company]", "Other Co");
    expect(sheetText()).not.toContain("I am writing to apply");
    box.checked = false;
    box.dispatchEvent(new Event("change"));
    vi.advanceTimersByTime(100);
    expect(sheetText()).toContain("I am writing to apply for the Marketing Specialist position at Other Co");
  });

  it("shows Korean character counts per section", () => {
    setLocale("ko");
    mountCoverLetter(host);
    expect(q("h1").textContent).toBe("자기소개서 양식");
    expect(host.querySelector("[data-field=edit]")).toBeNull();
    type("[data-field=growth]", "가나 다");
    expect(q("[data-out=count-growth]").textContent).toBe("공백 포함 4자 · 공백 제외 3자");
    expect(sheetText()).toContain("가나 다");
  });

  it("ticks enclosures in Indonesian", () => {
    setLocale("id");
    mountCoverLetter(host);
    expect(sheetText()).toContain("Lampiran: 4 berkas");
    const box = q<HTMLInputElement>("[data-field=enclosure-5]");
    box.checked = true;
    box.dispatchEvent(new Event("change"));
    vi.advanceTimersByTime(100);
    expect(sheetText()).toContain("Lampiran: 5 berkas");
    expect(sheetText()).toContain("Surat Keterangan Catatan Kepolisian (SKCK)");
  });

  it("clears the form to fill-in marks", () => {
    mountCoverLetter(host);
    q<HTMLButtonElement>("[data-action=clear]").click();
    vi.advanceTimersByTime(100);
    expect(sheetText()).toContain("[Your name]");
    expect(q<HTMLInputElement>("[data-field=name]").value).toBe("");
  });
});
