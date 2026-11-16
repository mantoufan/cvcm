import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CATEGORIES, WORDS, letterKey } from "../src/shared/hangman";
import { LOCALES } from "../src/shared/locale";
import { MOVES, play, type Move } from "../src/shared/rps";
import { ELIMINATION, alcoholGrams, bacAfter, peakBac } from "../src/shared/bac";

describe("batch 32 tutorials", () => {
  it("draws the hangman letter chart from the game's own word lists", () => {
    const share = JSON.parse(readFileSync("scripts/learn-src/batch32/hangman-letter-share.json", "utf8")) as Record<string, [string, number][]>;
    for (const lang of ["en", "es", "id"] as const) {
      const words = CATEGORIES.flatMap((c) => [...WORDS[lang][c]]);
      const keys = new Set(words.flatMap((w) => [...w].map(letterKey).filter(Boolean)));
      const top = [...keys]
        .map((k) => [k, Math.round((words.filter((w) => [...w].some((ch) => letterKey(ch) === k)).length / words.length) * 100)] as [string, number])
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 12);
      expect(share[lang], `update scripts/learn-src/batch32/hangman-letter-share.json: ${JSON.stringify(top)}`).toEqual(top);
    }
  });

  it("has a title and description for each tutorial in every locale", () => {
    for (const locale of LOCALES) {
      const meta = (JSON.parse(readFileSync(`src/locales/${locale}.json`, "utf8")) as { meta: Record<string, string> }).meta;
      for (const name of ["PlayHangman", "PlayRockPaperScissors", "CalculateBac", "CalculateSimpleInterest"]) {
        expect(meta[`title${name}`], `${locale} title${name}`).toMatch(/\| cv\.cm$/);
        expect(meta[`desc${name}`]?.length, `${locale} desc${name}`).toBeGreaterThan(60);
      }
    }
  });
});

describe("batch 32 tutorials stay in step with the tools", () => {
  it("quotes the chart's first letter and share in each locale's hangman copy", () => {
    const share = JSON.parse(readFileSync("scripts/learn-src/batch32/hangman-letter-share.json", "utf8")) as Record<string, [string, number][]>;
    for (const locale of LOCALES) {
      const list = locale === "es" || locale === "id" ? locale : "en";
      const pct = share[list]![0]![1];
      const copy = (JSON.parse(readFileSync(`scripts/learn-src/batch32/${locale}.json`, "utf8")) as { lessons: Record<string, { copy: Record<string, string> }> }).lessons["play-hangman"]!.copy;
      expect(copy.s3b, `${locale} s3b`).toContain(`${pct}`);
      // Letters standing alone (not inside a word like "English"), in the order the text names them.
      const standalone = (text: string) => text.match(/(?<!\p{Script=Latin})[A-Z](?!\p{Script=Latin})/gu) ?? [];
      const letters = (text: string) => [...new Set(standalone(text))].join("");
      const six = share[list]!.slice(0, 6).map(([l]) => l).join("");
      expect(letters(copy.s3b), `${locale} s3b order`).toBe(six);
      // FAQ a2 names the same first letter, share and order; the note gives the other lists' first four letters.
      const data = JSON.parse(readFileSync(`scripts/learn-src/batch32/${locale}.json`, "utf8")) as { lessons: Record<string, { copy: Record<string, string>; faq: Record<string, string> }> };
      const a2 = data.lessons["play-hangman"]!.faq.a2!;
      expect(a2, `${locale} a2`).toContain(`${pct}`);
      expect(letters(a2), `${locale} a2 order`).toBe(six);
      for (const other of (["en", "es", "id"] as const).filter((x) => x !== list)) {
        expect(standalone(copy.note).join(""), `${locale} note (${other})`).toContain(share[other]!.slice(0, 4).map(([l]) => l).join(""));
      }
      const folder = locale === "en" ? "" : `${locale.toLowerCase()}/`;
      const svg = readFileSync(`public/covers/tutorials/${folder}play-hangman-letters.svg`, "utf8");
      for (const [, p] of share[list]!) expect(svg, `${locale} svg`).toContain(`>${p} %<`);
    }
  });

  it("draws the rock paper scissors arrows from the tool's rules", () => {
    const src = readFileSync("scripts/gen-learn-svgs-batch32.py", "utf8");
    const block = /^BEATS = \{([\s\S]*?)^\}/m.exec(src)![1]!;
    const edges = [...block.matchAll(/"(\w+)": \("(\w+)", "(\w+)"\)/g)].flatMap((m) => [[m[1], m[2]], [m[1], m[3]]] as [Move, Move][]);
    expect(edges).toHaveLength(10);
    for (const a of MOVES) for (const b of MOVES) {
      if (a === b) continue;
      expect(edges.some(([x, y]) => x === a && y === b), `${a} vs ${b}`).toBe(play(a, b) === "win");
    }
  });

  it("draws the BAC example with the calculator's own constants", () => {
    const grams = alcoholGrams([{ ml: 355, abv: 5, count: 3 }]);
    const peak = peakBac(grams, 70, "male");
    const after = bacAfter(peak, 2);
    const formula = readFileSync("public/covers/tutorials/calculate-bac-formula.svg", "utf8");
    const curve = readFileSync("public/covers/tutorials/calculate-bac-curve.svg", "utf8");
    expect(formula).toContain(`${Math.round(grams)} ÷`);
    expect(formula).toContain(`${ELIMINATION}`);
    expect(formula).toContain(`= ${peak.toFixed(3)} − ${(ELIMINATION * 2).toFixed(3)} = ${after.toFixed(3)} %`);
    expect(curve).toContain(`${peak.toFixed(3)} %`);
    expect(curve).toContain(`${after.toFixed(3)} %`);
    expect(curve).toContain(`≈ ${(peak / ELIMINATION).toFixed(1)} h`);
    // The localized copies write the same numbers with their own decimal mark.
    for (const locale of LOCALES) {
      const mark = ["es", "id", "vi"].includes(locale) ? "," : ".";
      const n = (x: number, d: number) => x.toFixed(d).replace(".", mark);
      const folder = locale === "en" ? "" : `${locale.toLowerCase()}/`;
      const f = readFileSync(`public/covers/tutorials/${folder}calculate-bac-formula.svg`, "utf8");
      const c = readFileSync(`public/covers/tutorials/${folder}calculate-bac-curve.svg`, "utf8");
      expect(f, locale).toContain(`= ${n(peak, 3)} − ${n(ELIMINATION * 2, 3)} = ${n(after, 3)} %`);
      expect(c, locale).toContain(`${n(after, 3)} %`);
      expect(c, locale).toContain(`≈ ${n(peak / ELIMINATION, 1)} `);
    }
  });
});
