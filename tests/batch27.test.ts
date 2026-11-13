import { describe, expect, it } from "vitest";
import { LEVELS, conflicts, countSolutions, generate, solve, solveBySingles, toLine } from "../src/shared/sudoku";
import { bestMoves, computerMove, emptyCells, other, outcome, winOrBlock, type Cell, type Mark } from "../src/shared/tictactoe";
import { colon24, military, parseTime, spoken } from "../src/shared/military-time";
import { STATURE_BOYS, STATURE_GIRLS } from "../src/shared/height-cdc";
import { heightAtZ, lmsAt, midParental, normalCdf, percentileProjection, toFeetInches, zScore } from "../src/shared/height";
import { PLATE_COUNT, PLATE_KINDS, STRENGTH, makeTest, plateColours, rgbToLms, score } from "../src/shared/color-vision";

describe("sudoku", () => {
  it("makes puzzles with exactly one solution that agree with their clues, the same for the same seed", () => {
    for (const level of LEVELS) {
      for (const seed of [1, 2, 3, 2027, 999_999]) {
        const p = generate(seed, level);
        expect(countSolutions(p.clues, 2)).toBe(1);
        expect(solve(p.clues)).toEqual(p.solution);
        p.clues.forEach((d, i) => d && expect(d).toBe(p.solution[i]));
        expect(generate(seed, level)).toEqual(p);
      }
    }
  });

  it("grades levels: easy by naked singles, medium by singles, hard and expert need more", () => {
    for (const seed of [5, 6, 7]) {
      expect(solveBySingles(generate(seed, "easy").clues, true).every(Boolean)).toBe(true);
      expect(solveBySingles(generate(seed, "medium").clues).every(Boolean)).toBe(true);
      expect(solveBySingles(generate(seed, "hard").clues, true).every(Boolean)).toBe(false);
      expect(solveBySingles(generate(seed, "expert").clues).every(Boolean)).toBe(false);
    }
    const count = (level: (typeof LEVELS)[number]) => generate(11, level).clues.filter(Boolean).length;
    expect(count("easy")).toBeGreaterThan(count("medium"));
    expect(count("medium")).toBeGreaterThan(count("expert"));
  });

  it("finds clashes and writes the 81-character line", () => {
    const g = new Array<number>(81).fill(0);
    g[0] = 5;
    g[8] = 5;
    g[40] = 5;
    expect([...conflicts(g)].sort((a, b) => a - b)).toEqual([0, 8]);
    expect(toLine(g)).toHaveLength(81);
    expect(toLine(g).startsWith("5.......5")).toBe(true);
    expect(countSolutions(g, 2)).toBe(0);
  });
});

describe("tic-tac-toe", () => {
  it("reads wins, draws and games in progress", () => {
    const b = (s: string) => s.split("").map((c) => (c === "." ? "" : c)) as Cell[];
    expect(outcome(b("XXXOO...."))).toEqual({ winner: "X", line: [0, 1, 2] });
    expect(outcome(b("O.XOX.O.X"))).toEqual({ winner: "O", line: [0, 3, 6] });
    expect(outcome(b("XOXXOOOXX"))).toEqual({ winner: "draw" });
    expect(outcome(b("X........"))).toBeNull();
    expect(winOrBlock(b("XX.OO...."), "O")).toBe(5);
    expect(winOrBlock(b("XX.O....."), "O")).toBe(2);
  });

  it("never loses on hard, whoever starts and however the other side plays", () => {
    const lost: string[] = [];
    const walk = (board: Cell[], turn: Mark, cpu: Mark) => {
      const o = outcome(board);
      if (o) {
        if (o.winner === other(cpu)) lost.push(board.join(","));
        return;
      }
      if (turn === cpu) {
        for (const i of bestMoves(board, cpu)) {
          board[i] = cpu;
          walk(board, other(turn), cpu);
          board[i] = "";
        }
        return;
      }
      for (const i of emptyCells(board)) {
        board[i] = turn;
        walk(board, other(turn), cpu);
        board[i] = "";
      }
    };
    walk(new Array<Cell>(9).fill(""), "X", "X");
    walk(new Array<Cell>(9).fill(""), "X", "O");
    expect(lost).toEqual([]);
  });

  it("medium takes a win, then a block, before a random cell", () => {
    const b = (s: string) => s.split("").map((c) => (c === "." ? "" : c)) as Cell[];
    expect(computerMove(b("OO.XX...."), "O", "medium", () => 0)).toBe(2);
    expect(computerMove(b("XX..O...."), "O", "medium", () => 0)).toBe(2);
    expect(computerMove(b("X........"), "O", "easy", () => 3)).toBe(4);
  });
});

describe("military time", () => {
  it.each([
    ["1430", "1430", "14:30"],
    ["14:30", "1430", "14:30"],
    ["0830 hours", "0830", "08:30"],
    ["14:30:15", "1430", "14:30:15"],
    ["2:30 pm", "1430", "14:30"],
    ["2 PM", "1400", "14:00"],
    ["12:00 am", "0000", "00:00"],
    ["12 pm", "1200", "12:00"],
    ["12:45 a.m.", "0045", "00:45"],
    ["2400", "2400", "24:00"],
    ["230", "0230", "02:30"],
    ["7", "0700", "07:00"],
    ["下午2:30", "1430", "14:30"],
    ["오후 2시 30분", "1430", "14:30"],
    ["午後3時", "1500", "15:00"],
    ["9:05 SA", "0905", "09:05"],
    ["2:30 CH", "1430", "14:30"],
    ["14h30", "1430", "14:30"],
  ])("reads %s", (input, mil, h24) => {
    const t = parseTime(input)!;
    expect(military(t)).toBe(mil);
    expect(colon24(t)).toBe(h24);
  });

  it.each(["", "abc", "25:00", "12:60", "13 pm", "0 am", "2460"])("refuses %j", (input) => {
    expect(parseTime(input)).toBeNull();
  });

  it("says times the US military way", () => {
    const say = (s: string) => spoken(parseTime(s)!);
    expect(say("0000")).toBe("zero hundred hours");
    expect(say("0800")).toBe("zero eight hundred hours");
    expect(say("0805")).toBe("zero eight zero five hours");
    expect(say("0030")).toBe("zero zero thirty hours");
    expect(say("1430")).toBe("fourteen thirty hours");
    expect(say("1200")).toBe("twelve hundred hours");
    expect(say("1945")).toBe("nineteen forty-five hours");
    expect(say("2400")).toBe("twenty-four hundred hours");
  });
});

describe("height calculator", () => {
  it("uses Tanner's mid-parental target and ±8.5 cm range", () => {
    expect(midParental(178, 165, "boy")).toEqual({ cm: 178, low: 169.5, high: 186.5 });
    expect(midParental(178, 165, "girl").cm).toBe(165);
  });

  it("reads the CDC table: exact rows, interpolation, the median at z = 0", () => {
    expect(STATURE_BOYS).toHaveLength(218);
    expect(STATURE_GIRLS).toHaveLength(218);
    expect(STATURE_BOYS[0]![0]).toBe(24);
    expect(STATURE_BOYS.at(-1)![0]).toBe(240);
    const row = STATURE_GIRLS.find((r) => r[0] === 120.5)!;
    expect(lmsAt("girl", 120.5)).toEqual({ L: row[1], M: row[2], S: row[3] });
    const mid = lmsAt("boy", 120);
    const a = STATURE_BOYS.find((r) => r[0] === 119.5)!;
    const b = STATURE_BOYS.find((r) => r[0] === 120.5)!;
    expect(mid.M).toBeCloseTo((a[2] + b[2]) / 2, 9);
    expect(zScore(mid.M, mid)).toBeCloseTo(0, 12);
    expect(heightAtZ(zScore(150, mid), mid)).toBeCloseTo(150, 9);
    // A child on the median stays on it: the CDC median at 20 is 176.8 cm for boys.
    expect(percentileProjection("boy", 120, mid.M).adultCm).toBeCloseTo(176.849, 2);
    expect(percentileProjection("boy", 120, mid.M).percentile).toBeCloseTo(50, 4);
  });

  it("has a standard normal CDF good to 1e-6 and converts to feet and inches", () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 6);
    expect(normalCdf(1.959964)).toBeCloseTo(0.975, 6);
    expect(normalCdf(-1)).toBeCloseTo(0.158655, 6);
    expect(toFeetInches(182.88)).toEqual({ ft: 6, inch: 0 });
    expect(toFeetInches(182.8)).toEqual({ ft: 6, inch: 0 });
    expect(toFeetInches(175)).toEqual({ ft: 5, inch: 8.9 });
  });

  it("caps extreme z-scores so a typo is not projected", () => {
    expect(percentileProjection("girl", 60, 400).z).toBe(3);
  });
});

describe("colour vision plates", () => {
  it("moves only the plate's own cone between figure and background, inside the screen gamut", () => {
    const cone = { protan: 0, deutan: 1, tritan: 2 } as const;
    for (const kind of PLATE_KINDS) {
      for (const strength of STRENGTH[kind]) {
        for (const sign of [1, -1] as const) {
          const { bg, fig } = plateColours(kind, strength, sign);
          bg.forEach((v, i) => {
            if (i === cone[kind]) expect(Math.abs(fig[i]! / v - 1)).toBeGreaterThan(strength / 4);
            else expect(fig[i]).toBe(v);
          });
        }
      }
    }
  });

  it("builds the same 13 plates for a seed: the check plate, then four levels of each kind", () => {
    const test = makeTest(1);
    expect(test).toHaveLength(PLATE_COUNT);
    expect(test[0]!.kind).toBe("demo");
    for (const kind of PLATE_KINDS) {
      expect(test.filter((p) => p.kind === kind).map((p) => p.level).sort()).toEqual([0, 1, 2, 3]);
    }
    expect(new Set(test.map((p) => p.number)).size).toBe(PLATE_COUNT);
    for (const p of test) {
      expect(p.number).toBeGreaterThanOrEqual(12);
      expect(p.number).toBeLessThanOrEqual(98);
      expect(p.dots.length).toBeGreaterThan(300);
      for (const d of p.dots) expect(d.fill).toMatch(/^#[0-9a-f]{6}$/);
      // Some dots draw the number and most draw the background.
      const colours = new Set(p.dots.map((d) => d.fill));
      expect(colours.size).toBeGreaterThan(50);
    }
    expect(makeTest(1)).toEqual(test);
    expect(makeTest(2).map((p) => p.number)).not.toEqual(test.map((p) => p.number));
  });

  it("keeps the figure's brightness spread the same as the background's", () => {
    // Mean brightness (L + M) of figure and background dots on a red–green plate differ by less than the jitter.
    const test = makeTest(3);
    const plate = test.find((p) => p.kind === "deutan" && p.level === 1)!;
    const lum = (hex: string) => {
      const rgb = [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16)) as [number, number, number];
      const [L, M] = rgbToLms(rgb);
      return L! + M!;
    };
    const all = plate.dots.map((d) => lum(d.fill));
    const min = Math.min(...all);
    const max = Math.max(...all);
    expect(max / min).toBeGreaterThan(1.3);
  });

  it("scores each kind: one miss is normal, two mild, three or more strong", () => {
    const test = makeTest(1);
    const right = test.map((p) => p.number);
    expect(score(test, right).map((v) => v.grade)).toEqual(["normal", "normal", "normal"]);
    const answers: (number | null)[] = right.slice();
    let missed = 0;
    test.forEach((p, i) => {
      if (p.kind === "deutan" && missed < 3) {
        answers[i] = null;
        missed++;
      }
      if (p.kind === "protan" && p.level >= 2) answers[i] = null;
    });
    const v = score(test, answers);
    expect(v.find((x) => x.kind === "deutan")).toMatchObject({ correct: 1, total: 4, grade: "strong" });
    expect(v.find((x) => x.kind === "protan")).toMatchObject({ correct: 2, grade: "mild" });
    expect(v.find((x) => x.kind === "tritan")!.grade).toBe("normal");
  });
});

describe("military time in other languages", () => {
  it.each([["1430 horas", "1430"], ["0800 jam", "0800"], ["1905 giờ", "1905"], ["1800시", "1800"]])("reads %s", (input, mil) => {
    expect(military(parseTime(input)!)).toBe(mil);
  });
});
