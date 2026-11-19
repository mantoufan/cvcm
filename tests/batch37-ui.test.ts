// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EXAMPLE, mountTitleCase, unmountTitleCase } from "../src/client/title-case/ui";
import { mountWordsToPages, unmountWordsToPages } from "../src/client/words-to-pages/ui";
import { titleCase } from "../src/shared/title-case";

let host: HTMLElement;

beforeEach(() => {
  vi.useFakeTimers();
  host = document.createElement("div");
  document.body.append(host);
});

afterEach(() => {
  unmountTitleCase();
  unmountWordsToPages();
  host.remove();
  vi.useRealTimers();
});

const q = <T extends HTMLElement>(sel: string) => host.querySelector<T>(sel)!;
const text = (sel: string) => q(sel).textContent ?? "";
const set = (sel: string, value: string, event = "input") => {
  const el = q<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(sel);
  el.value = value;
  el.dispatchEvent(new Event(event));
  vi.advanceTimersByTime(200);
};

describe("title case ui", () => {
  it("converts the example in APA and switches styles", () => {
    mountTitleCase(host);
    expect(q<HTMLTextAreaElement>("[data-out=titles]").value).toBe(titleCase(EXAMPLE, "apa"));
    expect(text("[data-out=rule]")).toContain("APA");
    set("[data-field=style]", "sentence", "change");
    expect(q<HTMLTextAreaElement>("[data-out=titles]").value).toBe("The effects of social media on self-esteem: A meta-analysis of studies from 2010 to 2020");
  });
  it("converts every line and disables copy when empty", () => {
    mountTitleCase(host);
    set("[data-field=titles]", "first title\nsecond title");
    expect(q<HTMLTextAreaElement>("[data-out=titles]").value).toBe("First Title\nSecond Title");
    set("[data-field=titles]", "   ");
    expect(q<HTMLButtonElement>("[data-action=copy]").disabled).toBe(true);
  });
});

describe("words to pages ui", () => {
  it("opens with 1,000 words in an APA essay: 2.8 pages and a table", () => {
    mountWordsToPages(host);
    expect(text("[data-out=result]")).toContain("Pages2.8");
    expect(text("[data-out=result]")).toContain("Words per page351");
    expect(text("[data-out=result]")).toContain("Lines per page23");
    expect(text("[data-out=note]")).toBe("The text runs onto page 3, which is about 85 % full.");
    expect(host.querySelectorAll("[data-out=table] tbody tr")).toHaveLength(11);
    set("[data-field=spacing]", "1", "change");
    expect(text("[data-out=result]")).toContain("Pages1.4");
  });
  it("turns pages into words and counts pasted text", () => {
    mountWordsToPages(host);
    set("[data-field=mode]", "pages", "change");
    expect(q("[data-field=pages]").closest("label")!.hidden).toBe(false);
    expect(text("[data-out=result]")).toContain("Words that fill these pages1,760");
    set("[data-field=pages]", "0.01");
    expect(text("[data-out=result]")).toContain("Words that fill these pages4");
    set("[data-field=mode]", "text", "change");
    expect(text("[data-out=result]")).toContain("Paste some text");
    expect(q<HTMLButtonElement>("[data-action=copy]").disabled).toBe(true);
    set("[data-field=text]", "word ".repeat(100));
    expect(text("[data-out=result]")).toContain("Words in your text100");
    // Less than a page of text keeps the measured figure.
    expect(text("[data-out=result]")).toContain("Words per page351");
    set("[data-field=text]", "字".repeat(2000));
    // Your own text sets the words per page: 36 characters on the indented first line, then 39 a line:
    // 52 lines, 2,000 ÷ 52 × 23 = 885 (the English sample would say 351).
    expect(text("[data-out=result]")).toContain("Words per page885");
    set("[data-field=mode]", "words", "change");
    set("[data-field=words]", "10");
    expect(text("[data-out=result]")).toContain("Pages< 0.1");
    set("[data-field=words]", "0");
    expect(text("[data-out=result]")).toContain("above zero");
  });
});
