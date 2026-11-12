import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MAX_SHOWN, byLength, parseRack, parseWordList, unscramble } from "../src/shared/word-unscramble";
import { BAGS, CUBIC_FOOT, CUBIC_YARD, bagsFor, solveConcrete, toMetres } from "../src/shared/concrete";
import { factorial, findZeros, niceStep, parseExpr, sampleCurve } from "../src/shared/graph-expr";
import { capsFor, closeTake, isBlack, keyRange, noteFrequency, noteName } from "../src/shared/piano";
import { formatQ, parseCoord, q, simplifyRoot, solveSlope } from "../src/shared/slope";
import { standardForm } from "../src/client/slope/ui";
import { STATIC_FILE } from "../src/shared/path";

const DICT = parseWordList(readFileSync(new URL("../public/words/enable.txt", import.meta.url), "utf8"));
const words = (letters: string, filters = {}) => {
  const r = parseRack(letters);
  if (!r.ok) throw new Error(r.error);
  return unscramble(DICT, r.rack, filters).words.map((w) => w.word);
};

describe("word unscrambler", () => {
  it("loads the whole ENABLE list as a static file", () => {
    expect(DICT).toHaveLength(172_823);
    expect(DICT.every((w) => /^[a-z]+$/.test(w))).toBe(true);
    expect(STATIC_FILE.test("/words/enable.txt")).toBe(true);
  });

  it("uses each typed letter at most as often as it was typed", () => {
    const found = words("listen");
    expect(found).toEqual(expect.arrayContaining(["listen", "silent", "enlist", "tinsel", "inlets", "lens", "tile"]));
    expect(found).not.toContain("tittle");
    // Longest first, then A–Z.
    expect(found.slice(0, 6)).toEqual(["elints", "enlist", "inlets", "listen", "silent", "tinsel"]);
    expect(words("aab")).not.toContain("baba");
  });

  it("lets a blank stand for one letter and marks it", () => {
    const r = parseRack("ca?");
    if (!r.ok) throw new Error();
    const res = unscramble(DICT, r.rack);
    const cat = res.words.find((w) => w.word === "cat");
    const act = res.words.find((w) => w.word === "act");
    expect(cat?.blanks).toEqual([2]);
    expect(act?.blanks).toEqual([2]);
    // Real letters are used before the blank.
    expect(res.words.find((w) => w.word === "ca")).toBeUndefined();
    expect(res.words.find((w) => w.word === "ta")?.blanks).toEqual([0]);
  });

  it("filters by length, start, end and a run of letters", () => {
    expect(words("tesrlan", { min: 7, max: 7 })).toEqual(expect.arrayContaining(["antlers", "rentals", "saltern", "sternal"]));
    expect(words("tesrlan", { startsWith: "re" }).every((w) => w.startsWith("re"))).toBe(true);
    expect(words("gnirtsa", { endsWith: "ing" })).toEqual(expect.arrayContaining(["rating", "string", "taring"]));
    expect(words("gnirtsa", { contains: "tin", min: 6, max: 6 })).toEqual(expect.arrayContaining(["rating"]));
  });

  it("reads accents, case and full-width blanks, and refuses empty or oversized racks", () => {
    const wide = parseRack("ｃａｔ");
    expect(wide.ok && wide.rack.length).toBe(3);
    const r = parseRack("CAFÉ？");
    expect(r.ok && r.rack.blanks).toBe(1);
    expect(r.ok && r.rack.length).toBe(5);
    expect(parseRack("12 -")).toEqual({ ok: false, error: "empty" });
    expect(parseRack("a".repeat(21))).toEqual({ ok: false, error: "tooLong" });
    expect(parseRack("ab????")).toEqual({ ok: false, error: "tooManyBlanks" });
  });

  it("caps the shown list but counts every match, and groups by length", () => {
    const r = parseRack("aeinrst???");
    if (!r.ok) throw new Error();
    const res = unscramble(DICT, r.rack);
    expect(res.total).toBeGreaterThan(MAX_SHOWN);
    expect(res.words).toHaveLength(MAX_SHOWN);
    const groups = byLength(res.words);
    expect(groups[0].length).toBe(10);
    expect(groups.map((g) => g.length)).toEqual([...groups.map((g) => g.length)].sort((a, b) => b - a));
  });
});

describe("concrete", () => {
  const ft = (v: number) => toMetres(v, "ft");
  const inch = (v: number) => toMetres(v, "in");

  it("works out a 10 × 10 ft, 4 in slab with 10% waste", () => {
    const r = solveConcrete({ shape: "slab", values: { length: ft(10), width: ft(10), thickness: inch(4) }, waste: 10 });
    if (!r.ok) throw new Error(r.error);
    expect(r.net / CUBIC_FOOT).toBeCloseTo(33.3333, 3);
    expect(r.net / CUBIC_YARD).toBeCloseTo(1.2346, 4);
    expect(r.total / r.net).toBeCloseTo(1.1, 10);
    expect(r.bags.find((b) => b.id === "lb80")?.count).toBe(62);
  });

  it("matches the bag yields printed on US premix", () => {
    const yard = CUBIC_YARD;
    expect(bagsFor(yard, BAGS[0].kg)).toBe(45);
    expect(bagsFor(yard, BAGS[1].kg)).toBe(60);
    expect(bagsFor(yard, BAGS[2].kg)).toBe(90);
  });

  it("solves columns, tubes, footings, walls and stairs", () => {
    const col = solveConcrete({ shape: "column", values: { diameter: 0.3, height: 1, quantity: 4 }, waste: 0 });
    expect(col.ok && col.net).toBeCloseTo(Math.PI * 0.15 ** 2 * 4, 10);
    const tube = solveConcrete({ shape: "tube", values: { outer: 0.5, inner: 0.3, height: 2 }, waste: 0 });
    expect(tube.ok && tube.net).toBeCloseTo(Math.PI * (0.25 ** 2 - 0.15 ** 2) * 2, 10);
    const footing = solveConcrete({ shape: "footing", values: { length: 10, width: 0.4, depth: 0.3 }, waste: 0 });
    expect(footing.ok && footing.net).toBeCloseTo(1.2, 10);
    const wall = solveConcrete({ shape: "wall", values: { length: 5, height: 2, thickness: 0.2, quantity: 2 }, waste: 0 });
    expect(wall.ok && wall.net).toBeCloseTo(4, 10);
    // 3 steps 1 m wide, 0.2 m rise, 0.3 m run: 1 × 0.3 × 0.2 × (1 + 2 + 3) = 0.36, plus a 0.5 m platform 0.6 m tall: 0.3.
    const stairs = solveConcrete({ shape: "stairs", values: { width: 1, rise: 0.2, run: 0.3, steps: 3, platform: 0.5 }, waste: 0 });
    expect(stairs.ok && stairs.net).toBeCloseTo(0.66, 10);
    const noPlatform = solveConcrete({ shape: "stairs", values: { width: 1, rise: 0.2, run: 0.3, steps: 3 }, waste: 0 });
    expect(noPlatform.ok && noPlatform.net).toBeCloseTo(0.36, 10);
  });

  it("says what is wrong", () => {
    expect(solveConcrete({ shape: "slab", values: { length: 1, width: 1 }, waste: 10 })).toEqual({ ok: false, error: "missing", field: "thickness" });
    expect(solveConcrete({ shape: "slab", values: { length: 1, width: Number.NaN, thickness: 0.1 }, waste: 10 })).toEqual({ ok: false, error: "invalid", field: "width" });
    expect(solveConcrete({ shape: "slab", values: { length: 1, width: 0, thickness: 0.1 }, waste: 10 })).toEqual({ ok: false, error: "invalid", field: "width" });
    expect(solveConcrete({ shape: "slab", values: { length: 1, width: 1, thickness: 0.1, quantity: 1.5 }, waste: 10 })).toEqual({ ok: false, error: "count", field: "quantity" });
    expect(solveConcrete({ shape: "tube", values: { outer: 0.3, inner: 0.3, height: 1 }, waste: 0 })).toEqual({ ok: false, error: "inner", field: "inner" });
    expect(solveConcrete({ shape: "slab", values: { length: 1, width: 1, thickness: 0.1 }, waste: 120 })).toEqual({ ok: false, error: "waste" });
  });
});

describe("graph expressions", () => {
  const f = (src: string, x: number, decimal: "." | "," = ".") => {
    const r = parseExpr(src, decimal);
    if (!r.ok) throw new Error(`${src}: ${r.error}`);
    return r.fn(x);
  };

  it("reads the usual ways of writing a function", () => {
    expect(f("x^2 - 2", 3)).toBe(7);
    expect(f("y = 2x + 1", 4)).toBe(9);
    expect(f("f(x) = 3(x + 1)", 1)).toBe(6);
    expect(f("x²", 5)).toBe(25);
    expect(f("-x^2", 3)).toBe(-9);
    expect(f("2^3^2", 0)).toBe(512);
    expect(f("2pi x", 1)).toBeCloseTo(2 * Math.PI, 12);
    expect(f("sqrt(x)", 9)).toBe(3);
    expect(f("√x", 16)).toBe(4);
    expect(f("|x - 3|", 1)).toBe(2);
    expect(f("2|x|", -3)).toBe(6);
    expect(f("ln(e)", 0)).toBe(1);
    expect(f("log(100)", 0)).toBe(2);
    expect(f("log10(1000)", 0)).toBeCloseTo(3, 12);
    expect(f("log2(8)", 0)).toBe(3);
    expect(f("sinx", Math.PI / 2)).toBe(1);
    expect(f("sin 2x", Math.PI / 4)).toBeCloseTo(1, 12);
    expect(f("sin x cos x", Math.PI / 4)).toBeCloseTo(0.5, 12);
    expect(f("sin(x)^2 + cos(x)^2", 1.234)).toBeCloseTo(1, 12);
    expect(f("x2", 3)).toBe(6);
    expect(f("exp(x)", 1)).toBeCloseTo(Math.E, 12);
    expect(f("3!", 0)).toBe(6);
    expect(f("x × 2 ÷ 4 − 1", 6)).toBe(2);
    expect(f("1,5x", 2, ",")).toBe(3);
  });

  it("gives real odd roots of negatives and a smooth factorial", () => {
    expect(f("x^(1/3)", -8)).toBeCloseTo(-2, 12);
    expect(f("x^(2/3)", -8)).toBeCloseTo(4, 12);
    expect(Number.isNaN(f("x^0.5", -4))).toBe(true);
    expect(factorial(5)).toBe(120);
    expect(factorial(0.5)).toBeCloseTo(Math.sqrt(Math.PI) / 2, 10);
  });

  it("refuses what it cannot read", () => {
    for (const bad of ["", "2 +", "sin(", "x)", "foo(x)", "2 ** ", "|x", "((((x"]) expect(parseExpr(bad).ok).toBe(false);
    expect(parseExpr("   ")).toEqual({ ok: false, error: "empty" });
    expect(parseExpr("(".repeat(200) + "x" + ")".repeat(200)).ok).toBe(false);
  });

  it("reads nested bars and log10 without brackets", () => {
    expect(f("|(2|x|)|", -3)).toBe(6);
    expect(f("|2|x|-1|", 3)).toBe(5);
    expect(f("|x|x", -2)).toBe(-4);
    expect(f("|x|sin(x)", -Math.PI / 2)).toBeCloseTo(-Math.PI / 2, 12);
    expect(f("log10 x", 1000)).toBeCloseTo(3, 12);
    expect(f("log20", 0)).toBeCloseTo(Math.log10(20), 12);
    expect(f("log100", 0)).toBeCloseTo(2, 12);
    expect(f("log2 8", 0)).toBe(3);
    expect(f("2e+1", 0)).toBeCloseTo(2 * Math.E + 1, 12);
    expect(f("sin^2 x + cos^2 x", 0.7)).toBeCloseTo(1, 12);
    expect(f("sin^2(x)", Math.PI / 2)).toBeCloseTo(1, 12);
    expect(f("8∶x", 2)).toBe(4);
    expect(parseExpr("1.250x", ",").ok).toBe(false);
    expect(f("1.25x", 2, ",")).toBe(2.5);
    expect(f("2e-1", 0)).toBeCloseTo(2 * Math.E - 1, 12);
  });

  it("gives up quickly on bars that cannot be read", () => {
    const t0 = performance.now();
    expect(parseExpr("|x".repeat(140) + "|").ok).toBe(false);
    expect(performance.now() - t0).toBeLessThan(500);
  });

  it("finds touching zeros and ignores curves that coincide", () => {
    const sq = parseExpr("(x-1)^2");
    if (!sq.ok) throw new Error();
    const z = findZeros(sq.fn, -9.7, 10.3);
    expect(z).toHaveLength(1);
    expect(z[0]).toBeCloseTo(1, 6);
    const near = parseExpr("x^2 + 0.001");
    if (!near.ok) throw new Error();
    expect(findZeros(near.fn, -9.7, 10.3)).toEqual([]);
    expect(findZeros(() => 0, -10, 10)).toEqual([]);
    expect(findZeros((x) => Math.abs(x) - x, -10, 10)).toEqual([]);
  });

  it("breaks step functions at each step", () => {
    const floor = parseExpr("floor(x)");
    if (!floor.ok) throw new Error();
    // floor steps at −4 … 4 inside (−4.5, 4.5): nine flat pieces, no vertical risers.
    expect(sampleCurve(floor.fn, { xMin: -4.5, xMax: 4.5, yMin: -7, yMax: 7 }, 900)).toHaveLength(10);
  });

  it("finds zeros and skips poles", () => {
    const sq = parseExpr("x^2 - 2");
    if (!sq.ok) throw new Error();
    const z = findZeros(sq.fn, -10, 10);
    expect(z).toHaveLength(2);
    expect(z[0]).toBeCloseTo(-Math.SQRT2, 9);
    expect(z[1]).toBeCloseTo(Math.SQRT2, 9);
    const inv = parseExpr("1/x");
    if (!inv.ok) throw new Error();
    expect(findZeros(inv.fn, -10, 10)).toEqual([]);
    const sin = parseExpr("sin(x)");
    if (!sin.ok) throw new Error();
    expect(findZeros(sin.fn, -10, 10).map((x) => Math.round(x / Math.PI))).toEqual([-3, -2, -1, 0, 1, 2, 3]);
  });

  it("breaks the curve at asymptotes and gaps", () => {
    const tan = parseExpr("tan(x)");
    if (!tan.ok) throw new Error();
    const view = { xMin: -5, xMax: 5, yMin: -5, yMax: 5 };
    // tan has poles at ±π/2 and ±3π/2 inside [−5, 5]: five pieces.
    expect(sampleCurve(tan.fn, view, 600)).toHaveLength(5);
    const root = parseExpr("sqrt(x)");
    if (!root.ok) throw new Error();
    const runs = sampleCurve(root.fn, view, 600);
    expect(runs).toHaveLength(1);
    expect(runs[0][0][0]).toBeGreaterThanOrEqual(0);
    const steep = parseExpr("x^3");
    if (!steep.ok) throw new Error();
    expect(sampleCurve(steep.fn, view, 600)).toHaveLength(1);
  });

  it("picks tidy grid steps", () => {
    expect(niceStep(20, 8)).toBe(2);
    expect(niceStep(20, 4)).toBe(5);
    expect(niceStep(0.02, 8)).toBeCloseTo(0.002, 12);
    expect(niceStep(1000, 8)).toBe(100);
  });
});

describe("piano", () => {
  it("names notes and tunes them to A4 = 440 Hz", () => {
    expect(noteFrequency(69)).toBe(440);
    expect(noteFrequency(60)).toBeCloseTo(261.6256, 4);
    expect(noteName(60)).toBe("C4");
    expect(noteName(61)).toBe("C♯4");
    expect(noteName(64, "solfege")).toBe("Mi");
    expect(noteName(21)).toBe("A0");
    expect([60, 61, 62, 63, 64, 65, 66].map(isBlack)).toEqual([false, true, false, true, false, false, true]);
  });

  it("lays out octaves with the top C, inside the 88 keys", () => {
    const keys = keyRange(3, 2);
    expect(keys[0]).toBe(48);
    expect(keys[keys.length - 1]).toBe(72);
    expect(keys).toHaveLength(25);
    expect(keyRange(7, 2).at(-1)).toBe(108);
  });

  it("shows the Q row's cap where both rows reach a note", () => {
    const caps = capsFor(48);
    expect(caps.get(48)).toBe("Z");
    expect(caps.get(49)).toBe("S");
    expect(caps.get(60)).toBe("Q");
    expect(caps.get(72)).toBe("I");
    expect(caps.get(61)).toBe("2");
    expect(caps.get(63)).toBe("3");
  });

  it("closes notes still held when a take ends", () => {
    const take = closeTake([{ t: 0, midi: 60, on: true }, { t: 0.5, midi: 64, on: true }, { t: 1, midi: 60, on: false }], 2);
    expect(take.at(-1)).toEqual({ t: 2, midi: 64, on: false });
    expect(take).toHaveLength(4);
  });
});

describe("slope", () => {
  const P = (s: string) => {
    const v = parseCoord(s, "en");
    if (!v) throw new Error(s);
    return v;
  };

  it("reads decimals, fractions and mixed numbers exactly", () => {
    expect(P("0.25")).toEqual(q(1n, 4n));
    expect(P("-3/4")).toEqual(q(-3n, 4n));
    expect(P("1 1/2")).toEqual(q(3n, 2n));
    expect(P("−2")).toEqual(q(-2n));
    expect(P("0.0000005")).toEqual(q(1n, 2_000_000n));
    expect(parseCoord("1e-25", "en")).toBeNull();
    expect(parseCoord("2,5", "es")).toEqual(q(5n, 2n));
    expect(parseCoord("", "en")).toBeUndefined();
    expect(parseCoord("1/0", "en")).toBeNull();
    expect(parseCoord("abc", "en")).toBeNull();
  });

  it("works out the line through (1, 2) and (4, 8)", () => {
    const r = solveSlope(P("1"), P("2"), P("4"), P("8"));
    if (!r.ok) throw new Error();
    expect(r.r.line).toEqual({ kind: "sloped", m: q(2n), b: q(0n) });
    expect(r.r.angle).toBeCloseTo(63.4349, 4);
    expect(r.r.radical).toEqual({ k: 3n, r: 5n });
    expect(r.r.distance).toBeCloseTo(Math.sqrt(45), 12);
    expect(r.r.midpoint).toEqual([q(5n, 2n), q(5n)]);
    expect(r.r.standard).toEqual({ a: 2n, b: -1n, c: 0n });
    expect(standardForm(2n, -1n, 0n)).toBe("2x − y = 0");
  });

  it("keeps fractions exact and handles horizontal and vertical lines", () => {
    const r = solveSlope(P("0"), P("1"), P("3"), P("3"));
    if (!r.ok || r.r.line.kind !== "sloped") throw new Error();
    expect(formatQ(r.r.line.m)).toBe("2/3");
    expect(formatQ(r.r.xIntercept!)).toBe("−3/2");
    expect(r.r.standard).toEqual({ a: 2n, b: -3n, c: -3n });
    const flat = solveSlope(P("1"), P("5"), P("4"), P("5"));
    expect(flat.ok && flat.r.xIntercept).toBeNull();
    expect(flat.ok && flat.r.standard).toEqual({ a: 0n, b: 1n, c: 5n });
    expect(standardForm(0n, 1n, 5n)).toBe("y = 5");
    const vertical = solveSlope(P("2"), P("1"), P("2"), P("7"));
    expect(vertical.ok && vertical.r.line).toEqual({ kind: "vertical", x: q(2n) });
    expect(vertical.ok && vertical.r.standard).toEqual({ a: 1n, b: 0n, c: 2n });
    expect(solveSlope(P("1"), P("1"), P("1"), P("1"))).toEqual({ ok: false, error: "same-point" });
  });

  it("simplifies square roots", () => {
    expect(simplifyRoot(72n)).toEqual({ k: 6n, r: 2n });
    expect(simplifyRoot(49n)).toEqual({ k: 7n, r: 1n });
    expect(simplifyRoot(13n)).toEqual({ k: 1n, r: 13n });
  });
});
