import { describe, expect, it } from "vitest";
import {
  ALPHABET, CATEGORIES, MAX_MISSES, WORDS, WORD_LANGS, canHint, cleanWord, guess, letterKey, misses, newGame, pool,
  reveal, status, strikes, takeHint,
} from "../src/shared/hangman";
import { MOVES, matchOver, noThrows, movesOf, play, reason } from "../src/shared/rps";
import { alcoholGrams, bacAfter, bacUnits, band, hoursUntil, peakBac } from "../src/shared/bac";
import { schedule, solve, toYears, fromYears } from "../src/shared/simple-interest";

describe("hangman", () => {
  it("has words in every language and category, all typeable with that language's keys", () => {
    for (const lang of WORD_LANGS) {
      for (const c of CATEGORIES) {
        const words = WORDS[lang][c];
        expect(words.length).toBeGreaterThanOrEqual(20);
        expect(new Set(words).size).toBe(words.length);
        for (const w of words) {
          expect(w).toBe(w.toLocaleUpperCase("en"));
          expect(cleanWord(w)).toBe(w);
          for (const ch of w) if (ch !== " " && ch !== "-") expect(ALPHABET[lang]).toContain(letterKey(ch));
        }
      }
      expect(pool(lang, "all").length).toBe(CATEGORIES.reduce((n, c) => n + WORDS[lang][c].length, 0));
    }
  });

  it("folds accents but keeps Ñ", () => {
    expect(letterKey("á")).toBe("A");
    expect(letterKey("Ü")).toBe("U");
    expect(letterKey("ñ")).toBe("Ñ");
    expect(letterKey("đ")).toBe("D");
    expect(cleanWord("Đà Nẵng")).toBe("ĐÀ NẴNG");
    expect(letterKey("1")).toBe("");
    expect(letterKey(" ")).toBe("");
  });

  it("plays a word to a win, ignoring repeats and symbols", () => {
    let g = newGame("PIÑA");
    expect(reveal(g)).toEqual([null, null, null, null]);
    g = guess(g, "a");
    expect(reveal(g)).toEqual([null, null, null, "A"]);
    expect(guess(g, "A")).toBe(g);
    expect(guess(g, "#")).toBe(g);
    g = guess(g, "N");
    expect(misses(g)).toEqual(["N"]);
    g = guess(guess(guess(g, "p"), "i"), "ñ");
    expect(status(g)).toBe("won");
    expect(guess(g, "Z")).toBe(g);
  });

  it("matches accented letters and shows spaces", () => {
    const g = guess(newGame("PAVO REAL"), "A");
    expect(reveal(g)).toEqual([null, "A", null, null, " ", null, null, "A", null]);
    expect(reveal(guess(newGame("CANADÁ"), "A")).filter((c) => c === "A" || c === "Á")).toHaveLength(3);
  });

  it("loses after six wrong guesses and reveals the word", () => {
    let g = newGame("CAT");
    for (const ch of "BDEFGH") g = guess(g, ch);
    expect(strikes(g)).toBe(MAX_MISSES);
    expect(status(g)).toBe("lost");
    expect(reveal(g, true).join("")).toBe("CAT");
  });

  it("gives a hint for one strike, never the last one or the final letter", () => {
    let g = newGame("DOG");
    g = takeHint(g, () => 0);
    expect(g.hints).toBe(1);
    expect(strikes(g)).toBe(1);
    expect(status(g)).toBe("playing");
    g = takeHint(g, () => 0);
    expect(canHint(g)).toBe(false); // one letter left
    expect(takeHint(g, () => 0)).toBe(g);
    let h = newGame("ABCDEF");
    for (const ch of "XYZQW") h = guess(h, ch);
    expect(strikes(h)).toBe(5);
    expect(canHint(h)).toBe(false);
  });

  it("cleans a friend's word", () => {
    expect(cleanWord("PIN\u0303A")).toBe("PIÑA");
    expect(cleanWord("  ice   cream ")).toBe("ICE CREAM");
    expect(cleanWord("x-ray")).toBe("X-RAY");
    expect(cleanWord("--ab--")).toBe("AB");
    expect(cleanWord("a --- b")).toBe("A-B");
    expect(cleanWord("a")).toBeNull();
    expect(cleanWord("abc1")).toBeNull();
    expect(cleanWord("a".repeat(31))).toBeNull();
  });
});

describe("rock paper scissors", () => {
  it("follows the classic and five-move rules: each move beats exactly half the others", () => {
    expect(play("rock", "scissors")).toBe("win");
    expect(play("rock", "paper")).toBe("lose");
    expect(play("paper", "paper")).toBe("draw");
    expect(play("spock", "rock")).toBe("win");
    expect(play("lizard", "spock")).toBe("win");
    for (const variant of ["classic", "spock"] as const) {
      const moves = movesOf(variant);
      for (const a of moves) {
        const wins = moves.filter((b) => play(a, b) === "win").length;
        expect(wins).toBe((moves.length - 1) / 2);
        for (const b of moves) if (a !== b) expect(play(b, a)).toBe(play(a, b) === "win" ? "lose" : "win");
      }
    }
    expect(movesOf("classic")).toEqual(["rock", "paper", "scissors"]);
    expect(MOVES).toHaveLength(5);
  });

  it("says why, from either side", () => {
    expect(reason("scissors", "paper")).toEqual({ winner: "scissors", verb: "cuts", loser: "paper" });
    expect(reason("paper", "scissors")).toEqual({ winner: "scissors", verb: "cuts", loser: "paper" });
    expect(reason("rock", "rock")).toBeNull();
  });

  it("ends a best-of match and counts throws", () => {
    expect(matchOver({ win: 2, lose: 1, draw: 3 }, 2)).toBe("win");
    expect(matchOver({ win: 1, lose: 3, draw: 0 }, 3)).toBe("lose");
    expect(matchOver({ win: 9, lose: 0, draw: 0 }, 0)).toBeNull();
    expect(Object.values(noThrows()).every((n) => n === 0)).toBe(true);
  });
});

describe("BAC", () => {
  it("follows the Widmark formula", () => {
    // Two 355 mL beers at 5 %: 28.0 g of alcohol.
    const g = alcoholGrams([{ ml: 355, abv: 5, count: 2 }]);
    expect(g).toBeCloseTo(28.01, 1);
    // 28 g, 80 kg man: 28 / (80,000 × 0.68) × 100 = 0.0515 %.
    const peak = peakBac(g, 80, "male");
    expect(peak).toBeCloseTo(0.0515, 3);
    expect(bacAfter(peak, 1)).toBeCloseTo(0.0365, 3);
    expect(bacAfter(peak, 10)).toBe(0);
    expect(peakBac(g, 80, "female")).toBeGreaterThan(peak);
  });

  it("converts units, bands and countdowns", () => {
    expect(bacUnits(0.08)).toEqual({ pct: 0.08, permille: 0.8, mg100: 80 });
    expect(hoursUntil(0.08, 0.05)).toBeCloseTo(2, 6);
    expect(hoursUntil(0.03, 0.05)).toBe(0);
    expect(band(0)).toBe("none");
    expect(band(0.03)).toBe("mild");
    expect(band(0.08)).toBe("impaired");
    expect(band(0.2)).toBe("heavy");
    expect(band(0.35)).toBe("danger");
  });

  it("skips empty or broken rows", () => {
    expect(alcoholGrams([{ ml: NaN, abv: 5, count: 1 }, { ml: 100, abv: 0, count: 2 }, { ml: 100, abv: 40, count: 0 }])).toBe(0);
    expect(peakBac(10, 0, "male")).toBe(0);
  });
});

describe("simple interest", () => {
  it("solves for each unknown and agrees with itself", () => {
    const a = solve("interest", { principal: 10_000, rate: 5, years: 3 })!;
    expect(a.interest).toBeCloseTo(1500, 9);
    expect(a.total).toBeCloseTo(11_500, 9);
    expect(solve("principal", { interest: 1500, rate: 5, years: 3 })!.principal).toBeCloseTo(10_000, 9);
    expect(solve("rate", { principal: 10_000, interest: 1500, years: 3 })!.rate).toBeCloseTo(5, 9);
    expect(solve("time", { principal: 10_000, interest: 1500, rate: 5 })!.years).toBeCloseTo(3, 9);
  });

  it("refuses zero divisors and negatives", () => {
    expect(solve("principal", { interest: 100, rate: 0, years: 2 })).toBeNull();
    expect(solve("rate", { principal: 100, interest: 10, years: 0 })).toBeNull();
    expect(solve("time", { principal: 0, interest: 10, rate: 5 })).toBeNull();
    expect(solve("interest", { principal: -1, rate: 5, years: 1 })).toBeNull();
    expect(solve("interest", { principal: 100, rate: 5 })).toBeNull();
    expect(solve("interest", { principal: 1e300, rate: 1e10, years: 1e10 })).toBeNull();
  });

  it("converts time and builds the yearly table with a part year", () => {
    expect(toYears(18, "months")).toBe(1.5);
    expect(toYears(90, "days", 360)).toBe(0.25);
    expect(fromYears(0.5, "days", 365)).toBe(182.5);
    const rows = schedule(solve("interest", { principal: 1000, rate: 10, years: 2.5 })!);
    expect(rows.map((r) => r.year)).toEqual([1, 2, 2.5]);
    expect(rows[1]!.balance).toBeCloseTo(1200, 9);
    expect(rows[1]!.compound).toBeCloseTo(1210, 9);
    const long = schedule(solve("interest", { principal: 1, rate: 1, years: 75.5 })!);
    expect(long.length).toBeLessThanOrEqual(50);
    expect(long.map((r) => r.year).slice(0, 2)).toEqual([2, 4]);
    expect(long[long.length - 1]!.year).toBe(75.5);
    expect(schedule(solve("interest", { principal: 1, rate: 1, years: 500 })!).at(-1)!.year).toBe(500);
    expect(schedule(solve("interest", { principal: 1, rate: 1, years: 3 })!).map((r) => r.year)).toEqual([1, 2, 3]);
    expect(schedule(solve("interest", { principal: 1, rate: 1e6, years: 200 })!).at(-1)!.compound).toBeNull();
  });
});
