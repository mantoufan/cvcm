import { describe, expect, it } from "vitest";
import { LOCALES } from "../src/shared/locale";
import { WS_COUNT, WS_LEVELS, WS_SIZES, WS_THEMES, generate, gridLetters, lineCells, matchSelection, themeWords } from "../src/shared/word-search";

describe("word search", () => {
  it("places every word along a straight line in the grid", () => {
    for (const loc of LOCALES) for (const size of WS_SIZES) for (const level of WS_LEVELS) {
      const p = generate(loc, "animals", size, level, 1);
      expect(p.grid).toHaveLength(size * size);
      expect(p.grid.every((c) => c.length > 0)).toBe(true);
      // At least most of the target count fits.
      expect(p.words.length).toBeGreaterThanOrEqual(WS_COUNT[size] - 2);
      for (const w of p.words) {
        expect(w.cells.map((c) => p.grid[c]).join("")).toBe(w.letters.join(""));
        const line = lineCells(size, w.cells[0]!, w.cells[w.cells.length - 1]!);
        expect(line).toEqual(w.cells);
      }
    }
  });

  it("only uses the level's directions", () => {
    for (const level of WS_LEVELS) for (let n = 1; n <= 5; n++) {
      const p = generate("en", "food", 12, level, n);
      for (const w of p.words) {
        const dr = Math.sign(Math.floor(w.cells[1]! / 12) - Math.floor(w.cells[0]! / 12));
        const dc = Math.sign((w.cells[1]! % 12) - (w.cells[0]! % 12));
        if (level === "easy") expect([[0, 1], [1, 0]]).toContainEqual([dr, dc]);
        if (level === "medium") expect(dr >= 0 || dc === 1).toBe(true);
      }
    }
  });

  it("is the same puzzle for the same number", () => {
    expect(generate("es", "home", 15, "hard", 42).grid).toEqual(generate("es", "home", 15, "hard", 42).grid);
    expect(generate("es", "home", 15, "hard", 42).grid).not.toEqual(generate("es", "home", 15, "hard", 43).grid);
  });

  it("finds a word selected either way, but not a partial one", () => {
    const p = generate("en", "animals", 10, "medium", 3);
    const w = p.words[0]!;
    const none = new Set<number>();
    expect(matchSelection(p, w.cells, none)).toBe(0);
    expect(matchSelection(p, [...w.cells].reverse(), none)).toBe(0);
    expect(matchSelection(p, w.cells.slice(0, -1), none)).toBe(-1);
    expect(matchSelection(p, w.cells, new Set([0]))).not.toBe(0);
    expect(lineCells(10, 0, 12)).toBeNull();
    expect(lineCells(10, 0, 22)).toEqual([0, 11, 22]);
  });

  it("strips accents and spaces for the grid but keeps Ñ, and splits CJK by character", () => {
    expect(gridLetters("es", "Limón").join("")).toBe("LIMON");
    expect(gridLetters("es", "Montaña").join("")).toBe("MONTAÑA");
    expect(gridLetters("vi", "đại bàng").join("")).toBe("DAIBANG");
    expect(gridLetters("id", "kura-kura").join("")).toBe("KURAKURA");
    expect(gridLetters("zh-CN", "长颈鹿")).toEqual(["长", "颈", "鹿"]);
    expect(gridLetters("ko", "고양이")).toEqual(["고", "양", "이"]);
  });

  it("has enough unique words per theme that fit the smallest grid", () => {
    for (const loc of LOCALES) for (const theme of WS_THEMES) {
      const list = themeWords(loc, theme);
      const grid = list.map((w) => gridLetters(loc, w).join(""));
      expect(new Set(grid).size, `${loc} ${theme} duplicates`).toBe(grid.length);
      const fits = grid.filter((g) => [...g].length >= (["zh-CN", "zh-TW", "ja", "ko"].includes(loc) ? 2 : 3) && [...g].length <= 10);
      expect(fits.length, `${loc} ${theme}`).toBeGreaterThanOrEqual(16);
    }
  });

  it("fills CJK grids with characters of that script", () => {
    const zh = generate("zh-CN", "food", 10, "easy", 1);
    expect(zh.grid.every((c) => /\p{Script=Han}/u.test(c))).toBe(true);
    const ja = generate("ja", "food", 10, "easy", 1);
    expect(ja.grid.every((c) => /[\p{Script=Katakana}ー]/u.test(c))).toBe(true);
    const ko = generate("ko", "food", 10, "easy", 1);
    expect(ko.grid.every((c) => /\p{Script=Hangul}/u.test(c))).toBe(true);
  });
});
