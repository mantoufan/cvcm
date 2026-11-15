import { describe, expect, it } from "vitest";
import { seeded } from "../src/shared/random";
import { LOCALES } from "../src/shared/locale";
import { MIN_FALL, START_FALL, fallSeconds, kanaUnits, matches, romajiMatches, scoreOf, spawnSeconds, stageOf, stripMarks, summary } from "../src/shared/typing-game";
import { wordsFor } from "../src/shared/typing-game-words";
import * as cc from "../src/shared/chinese-checkers";

describe("typing game matcher", () => {
  it("ignores case, width and surrounding spaces", () => {
    expect(matches({ text: "Apple" }, "  apple ", "en")).toBe(true);
    expect(matches({ text: "apple" }, "ａｐｐｌｅ", "en")).toBe(true);
    expect(matches({ text: "apple" }, "appl", "en")).toBe(false);
  });

  it("accepts Spanish and Vietnamese words with or without accents", () => {
    expect(matches({ text: "canción" }, "canción", "es")).toBe(true);
    expect(matches({ text: "canción" }, "cancion", "es")).toBe(true);
    expect(matches({ text: "cà phê" }, "ca phe", "vi")).toBe(true);
    expect(matches({ text: "đường" }, "duong", "vi")).toBe(true);
    expect(stripMarks("Hà Nội")).toBe("Ha Noi");
  });

  it("accepts Chinese characters or toneless pinyin", () => {
    const w = { text: "苹果", reading: "pingguo" };
    expect(matches(w, "苹果", "zh-CN")).toBe(true);
    expect(matches(w, "pingguo", "zh-CN")).toBe(true);
    expect(matches(w, "ping guo", "zh-CN")).toBe(true);
    expect(matches(w, "píngguǒ", "zh-CN")).toBe(true);
    expect(matches(w, "pingg", "zh-CN")).toBe(false);
  });

  it("accepts Japanese written form, kana, katakana and romaji variants", () => {
    const w = { text: "東京", reading: "とうきょう" };
    for (const s of ["東京", "とうきょう", "トウキョウ", "toukyou", "toukyo" + "u"]) expect(matches(w, s, "ja")).toBe(true);
    expect(matches(w, "tokyo", "ja")).toBe(false);
    expect(romajiMatches("すし", "sushi")).toBe(true);
    expect(romajiMatches("すし", "susi")).toBe(true);
    expect(romajiMatches("ちず", "tizu")).toBe(true);
    expect(romajiMatches("つき", "tuki")).toBe(true);
    expect(romajiMatches("ふじさん", "huzisan")).toBe(true);
    expect(romajiMatches("ふじさん", "fujisann")).toBe(true);
  });

  it("handles ん and っ the way an input method does", () => {
    expect(romajiMatches("しんかんせん", "shinkansen")).toBe(true); // n before k, and at the end
    expect(romajiMatches("こんにちは", "konnnichiha")).toBe(true);
    expect(romajiMatches("こんにちは", "kon'nichiha")).toBe(true);
    expect(romajiMatches("こんにちは", "konichiha")).toBe(false); // a single n before な-row is ambiguous
    expect(romajiMatches("きっぷ", "kippu")).toBe(true);
    expect(romajiMatches("きっぷ", "kixtupu")).toBe(true);
    expect(romajiMatches("まっちゃ", "matcha")).toBe(true);
    expect(romajiMatches("まっちゃ", "maccha")).toBe(true);
    expect(romajiMatches("ちーず", "chi-zu")).toBe(true);
  });

  it("every Japanese reading can be typed in romaji", () => {
    for (const w of wordsFor("ja")) {
      expect(kanaUnits(w.reading!).every((u) => u.options.length > 0 || u.kana === "っ" || u.kana === "ん"), w.reading).toBe(true);
    }
  });
});

describe("typing game words and speed", () => {
  it("has at least 150 unique words per language, with readings where needed", () => {
    for (const loc of LOCALES) {
      const words = wordsFor(loc);
      expect(words.length, loc).toBeGreaterThanOrEqual(150);
      expect(new Set(words.map((w) => w.text)).size, loc).toBe(words.length);
      if (loc === "ja" || loc === "zh-CN" || loc === "zh-TW") expect(words.every((w) => w.reading), loc).toBe(true);
      if (loc === "zh-CN" || loc === "zh-TW") expect(words.every((w) => /^[a-z]+$/.test(w.reading!)), loc).toBe(true);
    }
  });

  it("speeds up every five words down to a floor", () => {
    expect(fallSeconds("easy", 0)).toBe(START_FALL.easy);
    expect(fallSeconds("easy", 4)).toBe(START_FALL.easy);
    expect(fallSeconds("easy", 5)).toBeLessThan(START_FALL.easy);
    expect(fallSeconds("hard", 1000)).toBe(MIN_FALL);
    expect(fallSeconds("hard", 0)).toBeLessThan(fallSeconds("medium", 0));
    expect(spawnSeconds("medium", 0)).toBeCloseTo(fallSeconds("medium", 0) / 3);
    expect(stageOf(0)).toBe(1);
    expect(stageOf(10)).toBe(3);
  });

  it("scores characters and summarises speed and accuracy", () => {
    expect(scoreOf({ text: "東京", reading: "とうきょう" })).toBe(2);
    expect(scoreOf({ text: "apple" })).toBe(5);
    expect(summary(120, 9, 10, 60)).toEqual({ cpm: 120, accuracy: 90 });
    expect(summary(0, 0, 0, 0)).toEqual({ cpm: 0, accuracy: 100 });
  });
});

describe("chinese checkers", () => {
  it("has a 121-hole star with 10-hole points and six neighbours inside", () => {
    expect(cc.HOLE_COUNT).toBe(121);
    expect(cc.HOME[1]).toHaveLength(10);
    expect(cc.HOME[2]).toHaveLength(10);
    // The central hexagon (61 holes) is fully surrounded except its rim's outward sides; every hole has ≥ 2 neighbours.
    const centre = cc.HOLES.findIndex((h) => h.x === 0 && h.y === 0 && h.z === 0);
    expect(cc.NEIGHBOURS[centre]!.every((n) => n !== undefined)).toBe(true);
    expect(cc.NEIGHBOURS.every((n) => n.filter((x) => x !== undefined).length >= 2)).toBe(true);
    // Adjacency is symmetric.
    cc.NEIGHBOURS.forEach((list, i) => list.forEach((n, d) => { if (n !== undefined) expect(cc.NEIGHBOURS[n]![(d + 3) % 6]).toBe(i); }));
  });

  it("steps to empty neighbours and chains jumps", () => {
    const g = cc.startGame();
    const board = new Array<number>(cc.HOLE_COUNT).fill(0);
    const at = (x: number, y: number, z: number) => cc.HOLES.findIndex((h) => h.x === x && h.y === y && h.z === z);
    const a = at(0, 0, 0);
    board[a] = 1;
    board[at(1, 0, -1)] = 2; // jump over → (2,0,-2)
    board[at(3, 0, -3)] = 1; // then over → (4,0,-4)
    const dest = cc.destinations(board, a);
    expect(dest.get(at(2, 0, -2))).toEqual([a, at(2, 0, -2)]);
    expect(dest.get(at(4, 0, -4))).toEqual([a, at(2, 0, -2), at(4, 0, -4)]);
    expect(dest.has(at(0, 1, -1))).toBe(true); // a plain step
    expect(dest.has(at(1, 0, -1))).toBe(false); // occupied
    // Legality checks the same paths.
    const game = { board, turn: 1 as const };
    expect(cc.isLegal(game, [a, at(2, 0, -2), at(4, 0, -4)])).toBe(true);
    expect(cc.isLegal(game, [a, at(4, 0, -4)])).toBe(false);
    expect(cc.legalMoves(g).length).toBeGreaterThan(0);
  });

  it("wins when the target is full with at least one own marble", () => {
    const board = new Array<number>(cc.HOLE_COUNT).fill(0);
    for (const i of cc.TARGET[1]) board[i] = 1;
    expect(cc.winner(board)).toBe(1);
    const blocked = new Array<number>(cc.HOLE_COUNT).fill(0);
    cc.TARGET[1].forEach((i, k) => { blocked[i] = k === 0 ? 1 : 2; });
    expect(cc.winner(blocked)).toBe(1);
    expect(cc.winner(cc.startGame().board)).toBeNull();
  });

  it("the computer moves forward in an open position and games finish", () => {
    const g = cc.startGame();
    for (const level of cc.CC_LEVELS) {
      const m = cc.bestMove(g, level, seeded(2))!;
      expect(cc.isLegal(g, m)).toBe(true);
      const from = cc.HOLES[m[0]!]!;
      const to = cc.HOLES[m[m.length - 1]!]!;
      expect(to.z).toBeLessThanOrEqual(from.z); // side 1 heads up (towards z = −8)
    }
    let game = cc.startGame();
    const r = seeded(9);
    let plies = 0;
    while (!cc.winner(game.board) && plies < 600) {
      game = cc.play(game, cc.bestMove(game, "medium", r)!)!;
      plies++;
    }
    expect(cc.winner(game.board)).not.toBeNull();
  });

  it("replays saves and stops at an illegal move", () => {
    const g = cc.startGame();
    const m = cc.legalMoves(g)[0]!;
    const { moves, game } = cc.replay([m, [0, 1], "x"]);
    expect(moves).toEqual([m]);
    expect(game.turn).toBe(2);
  });
});
