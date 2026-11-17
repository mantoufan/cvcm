import { describe, expect, it } from "vitest";
import {
  alphaBand, apa2, apaP, apaUnit, between, chiGoodness, chiIndependence, criticalValue, cronbachAlpha, fromPercentile,
  parseMatrix, pValue, sampleSize, standardDeviation, tTest, zFor, zScore,
} from "../src/shared/academic-stats";

const close = (a: number, b: number, rel = 1e-9) => expect(Math.abs(a - b)).toBeLessThanOrEqual(rel * Math.max(1e-12, Math.abs(b)));
// Reference values from SciPy 1.16 (scipy.stats ttest_1samp / ttest_ind / ttest_rel / chi2_contingency / chisquare).
const A = [5.1, 4.9, 6.2, 5.8, 6.0, 5.5, 5.3, 6.1];
const B = [4.8, 4.7, 5.9, 5.0, 5.6, 5.2, 4.9, 5.4];

describe("APA formatting", () => {
  it("drops the leading zero and floors tiny p-values", () => {
    expect(apaP(0.0271)).toBe("p = .027");
    expect(apaP(0.0004)).toBe("p < .001");
    expect(apaP(1)).toBe("p = 1.000");
    expect(apaUnit(0.934)).toBe(".93");
    expect(apaUnit(-0.25)).toBe("-.25");
  });
});

describe("standard deviation", () => {
  it("sample and population", () => {
    const xs = [2, 4, 4, 4, 5, 5, 7, 9];
    close(standardDeviation(xs, "sample")!.sd, 2.138089935299395);
    const p = standardDeviation(xs, "population")!;
    close(p.sd, 2);
    expect(p.ss).toBeCloseTo(32, 10);
    close(p.se, 2 / Math.sqrt(8));
    expect(p.cv).toBeCloseTo(0.4, 12);
    expect(standardDeviation([3], "sample")).toBeNull();
    expect(standardDeviation([3], "population")!.sd).toBe(0);
  });
});

describe("sample size", () => {
  it("Cochran with and without a population", () => {
    close(zFor(95), 1.959963984540054);
    expect(sampleSize({ method: "proportion", confidence: 95, margin: 5, proportion: 50 })!.n).toBe(385);
    expect(sampleSize({ method: "proportion", confidence: 95, margin: 5, proportion: 50, population: 1000 })!.n).toBe(278);
    expect(sampleSize({ method: "proportion", confidence: 99, margin: 3, proportion: 50 })!.n).toBe(1844);
    expect(sampleSize({ method: "proportion", confidence: 95, margin: 5, proportion: 50, population: 100 })!.n).toBe(80);
  });
  it("Slovin", () => {
    expect(sampleSize({ method: "slovin", confidence: 95, margin: 5, population: 1000 })!.n).toBe(286);
    expect(sampleSize({ method: "slovin", confidence: 95, margin: 10, population: 500 })!.n).toBe(84);
    expect(sampleSize({ method: "slovin", confidence: 95, margin: 5 })).toBeNull();
  });
  it("a mean, and the response rate", () => {
    expect(sampleSize({ method: "mean", confidence: 95, margin: 2, sigma: 10 })!.n).toBe(97);
    expect(sampleSize({ method: "proportion", confidence: 95, margin: 5, proportion: 50, responseRate: 40 })!.invite).toBe(963);
    expect(sampleSize({ method: "proportion", confidence: 95, margin: 5, proportion: 50, population: 10.5 })).toBeNull();
  });
});

describe("Cronbach's alpha", () => {
  const text = "Q1\tQ2\tQ3\tQ4\tQ5\n4\t5\t4\t3\t4\n3\t4\t3\t3\t3\n5\t5\t4\t5\t5\n2\t3\t2\t2\t3\n4\t4\t5\t4\t4\n3\t3\t3\t4\t3\n5\t4\t5\t5\t4\n2\t2\t3\t2\t2\n4\t5\t4\t4\t5\n3\t3\t4\t3\t3\n4\t\t4\t4\t4";
  it("matches the reference, with item statistics", () => {
    const m = parseMatrix(text)!;
    expect(m.names).toEqual(["Q1", "Q2", "Q3", "Q4", "Q5"]);
    expect(m.rows).toHaveLength(10);
    expect(m.skipped).toBe(1);
    const r = cronbachAlpha(m)!;
    close(r.alpha, 0.934991974317817);
    close(r.standardized, 0.9346136012853028);
    const ref = [[0.969247643169082, 0.8913043478260869], [0.7706552287507428, 0.9304324469513832], [0.7084374039088921, 0.9405840886203422], [0.8224840736938628, 0.9211711711711712], [0.8728715609439694, 0.912108843537415]];
    r.items.forEach((it, j) => { close(it.itemTotal, ref[j]![0]!); close(it.alphaIfDeleted!, ref[j]![1]!); });
    expect(alphaBand(r.alpha)).toBe("excellent");
    expect(alphaBand(0.65)).toBe("questionable");
  });
  it("reads commas, spaces and comma decimals", () => {
    expect(parseMatrix("1,2,3\n2,3,4")!.rows).toEqual([[1, 2, 3], [2, 3, 4]]);
    expect(parseMatrix("1 2 3\n2 3 4")!.names).toEqual(["#1", "#2", "#3"]);
    expect(parseMatrix("1,5;2\n2;3,5", ",")!.rows).toEqual([[1.5, 2], [2, 3.5]]);
    expect(cronbachAlpha(parseMatrix("1 1\n1 1")!)).toBeNull();
  });
});

describe("t-tests", () => {
  it("one-sample", () => {
    const r = tTest("one", A, [], { mu: 5 })!;
    close(r.t, 3.569625885346298);
    close(r.p, 0.009101473008820858);
    close(r.ciLow + 5, 5.206762143815647);
    close(r.ciHigh + 5, 6.018237856184353);
  });
  it("Welch and Student", () => {
    const w = tTest("independent", A, B)!;
    close(w.t, 1.874887775384624);
    close(w.df, 13.707961050239279);
    close(w.p, 0.08227337664894663);
    close(w.ciLow, -0.06215427419858832, 1e-8);
    close(w.ciHigh, 0.912154274198588);
    const s = tTest("independent", A, B, { welch: false })!;
    expect(s.df).toBe(14);
    close(s.p, 0.08182306436737069);
    close(s.ciLow, -0.06118074870004947, 1e-8);
    const less = tTest("independent", A, B, { tail: "left" })!;
    close(less.p, 0.9588633116755267);
    expect(less.ciLow).toBe(-Infinity);
    close(less.ciHigh, 0.8248560823717432);
  });
  it("paired", () => {
    const r = tTest("paired", A, B)!;
    close(r.t, 5.666666666666669);
    close(r.p, 0.0007611846553941681);
    close(r.ciLow, 0.24765318113054116);
    const g = tTest("paired", A, B, { tail: "right" })!;
    close(g.p, 0.00038059232769708406);
    close(g.ciLow, 0.2829066046182495);
    expect(tTest("paired", A, B.slice(1))).toBeNull();
  });
});

describe("chi-square", () => {
  it("independence, Yates and Cramér's V", () => {
    const r = chiIndependence([[20, 15], [30, 35]])!;
    close(r.chi2, 1.098901098901099);
    close(r.p, 0.29450739368010714);
    const y = chiIndependence([[20, 15], [30, 35]], true)!;
    close(y.chi2, 0.7032967032967032);
    close(y.p, 0.4016781664697727);
    const t = chiIndependence([[10, 20, 30], [20, 20, 10]], true)!;
    expect(t.yates).toBe(false);
    close(t.chi2, 12.52777777777778);
    close(t.p, 0.0019038276076954943);
    close(t.v!, 0.3374742788552765);
    expect(chiIndependence([[0, 0], [1, 2]])).toBeNull();
  });
  it("goodness of fit", () => {
    close(chiGoodness([18, 22, 30, 30])!.p, 0.2289188643361048);
    expect(chiGoodness([50, 30, 20], [50, 30, 20])!.chi2).toBe(0);
    close(chiGoodness([45, 35, 20], [2, 1, 1])!.chi2, 5.5);
    close(chiGoodness([45, 35, 20], [0.5, 0.25, 0.25])!.p, 0.06392786120670757);
  });
});

describe("p-values and critical values", () => {
  it("from a statistic", () => {
    close(pValue("z", 1.959963984540054, "two")!, 0.05);
    close(pValue("z", -1.6448536269514722, "left")!, 0.05);
    close(pValue("t", 2.228138851986274, "two", 10)!, 0.05);
    close(pValue("chi2", 3.841458820694124, "right", 1)!, 0.05);
    close(pValue("f", 3.3541308285291964, "right", 2, 27)!, 0.05);
    expect(pValue("t", 2, "two")).toBeNull();
    expect(pValue("chi2", -1, "right", 2)).toBeNull();
  });
  it("critical values", () => {
    close(criticalValue("z", 0.05, "two")!, 1.959963984540054);
    close(criticalValue("z", 0.05, "left")!, -1.6448536269514722);
    close(criticalValue("t", 0.05, "two", 10)!, 2.228138851986274);
    close(criticalValue("chi2", 0.05, "right", 5)!, 11.070497693516353);
    close(criticalValue("f", 0.01, "right", 5, 10)!, 5.636326187669078);
  });
});

describe("z-scores", () => {
  it("areas, percentiles and ranges", () => {
    const z = zScore(130, 100, 15)!;
    expect(z.z).toBe(2);
    close(z.above, 0.022750131948179195);
    close(z.between, 0.9544997361036416);
    close(fromPercentile(97.5, 0, 1)!.z, 1.959963984540054);
    close(fromPercentile(90, 100, 15)!.x, 119.22327348316901);
    close(between(85, 115, 100, 15)!.p, 0.6826894921370859);
    expect(zScore(1, 0, 0)).toBeNull();
  });
});

describe("review regressions", () => {
  it("keeps tiny chi-square quantiles accurate", async () => {
    const { chiInvUpper } = await import("../src/shared/stat-dist");
    close(chiInvUpper(1 - 1e-6, 1), 1.5707963268860577e-12, 1e-6);
    close(chiInvUpper(0.99999, 1), 1.570796326862849e-10, 1e-6);
  });
  it("reads a first respondent with a missing score as data, not a header", () => {
    const m = parseMatrix("NA\t3\t4\n1\t2\t3\n2\t3\t3\n3\t4\t5")!;
    expect(m.names).toEqual(["#1", "#2", "#3"]);
    expect(m.rows).toHaveLength(3);
    expect(m.skipped).toBe(1);
  });
  it("computes Cramér's V from the uncorrected chi-square", () => {
    const plain = chiIndependence([[10, 5], [3, 12]])!;
    const yates = chiIndependence([[10, 5], [3, 12]], true)!;
    close(plain.v!, 0.4708709557974187);
    expect(yates.v).toBe(plain.v);
    expect(yates.chi2).toBeLessThan(plain.chi2);
  });
  it("never lets the population correction raise n, and refuses 0 % or 100 %", () => {
    const r = sampleSize({ method: "mean", confidence: 95, margin: 0.5, sigma: 0.1, population: 1000 })!;
    expect(r.exact).toBe(r.n0);
    expect(r.corrected).toBe(false);
    expect(sampleSize({ method: "proportion", confidence: 95, margin: 5, proportion: 0 })).toBeNull();
    expect(sampleSize({ method: "proportion", confidence: 95, margin: 5, proportion: 100 })).toBeNull();
  });
  it("gives a 90 % interval at α = 0.1", () => {
    const r = tTest("independent", A, B, { confidence: 90 })!;
    close(r.ciLow, 0.02514391762825624, 1e-8);
    close(r.ciHigh, 0.8248560823717432, 1e-9);
  });
  it("reads numeric item labels as a header when asked", () => {
    const text = "1 2 3\n4 5 4\n3 3 3\n5 4 5";
    expect(parseMatrix(text)!.rows).toHaveLength(4);
    const m = parseMatrix(text, ".", "yes")!;
    expect(m.names).toEqual(["1", "2", "3"]);
    expect(m.rows).toHaveLength(3);
    expect(parseMatrix("Q1 Q2\n1 2\n2 3", ".", "no")!.skipped).toBe(1);
  });
  it("refuses degrees of freedom past a million and tiny normal quantiles stay finite", async () => {
    const { normInv } = await import("../src/shared/stat-dist");
    expect(pValue("t", 2, "two", 2_000_000)).toBeNull();
    expect(criticalValue("t", 0.05, "two", 1e9)).toBeNull();
    close(criticalValue("t", 0.05, "two", 1_000_000)!, 1.9599663568141068, 1e-8);
    expect(Number.isFinite(normInv(1e-320))).toBe(true);
    expect(normInv(1e-320)).toBeLessThan(-38);
  });
  it("needs whole-number counts", () => {
    expect(chiIndependence([[1.5, 2], [3, 4]])).toBeNull();
    expect(chiGoodness([10.5, 9])).toBeNull();
    expect(chiGoodness([10, 9], [0.5, 0.5])).not.toBeNull();
  });
  it("round-three fixes", async () => {
    const { tUpper, tInvUpper } = await import("../src/shared/stat-dist");
    expect(apaP(0.99969)).toBe("p > .999");
    expect(apaP(0.9994)).toBe("p = .999");
    expect(tUpper(1e-6, 1e6)).toBeLessThan(0.5);
    close(tUpper(1e-6, 1e6), 0.4999996010578193, 1e-9);
    expect(tInvUpper(1e-15, 1)).toBeCloseTo(318309886183790.7, -3);
    expect(criticalValue("f", 1e-300, "right", 1, 1)).toBeNull();
    const m = parseMatrix("Q1,Q2,Q3\n1;2;3\n2;3;4", ",")!;
    expect(m.names).toEqual(["Q1", "Q2", "Q3"]);
    expect(m.rows).toEqual([[1, 2, 3], [2, 3, 4]]);
  });
  it("round-four fixes", () => {
    expect(parseMatrix("3,5 4,5 2,5 3,5\n4,0 3,5 3,0 4,5\n2,5 3,0 3,5 2,0", ",")!.rows).toHaveLength(3);
    const csv = parseMatrix("Q1,Q2,Q3\n4,5,3\n3,4,2", ",")!;
    expect(csv.names).toEqual(["Q1", "Q2", "Q3"]);
    expect(csv.rows).toEqual([[4, 5, 3], [3, 4, 2]]);
    const b = between(115, 85, 100, 15)!;
    expect(b.za).toBe(1);
    expect(b.zb).toBe(-1);
    close(b.p, 0.6826894921370859);
    const big = parseMatrix(Array.from({ length: 10_005 }, (_, i) => `${i % 5} ${(i * 3) % 5} ${(i * 7) % 5}`).join("\n"))!;
    expect(big.rows).toHaveLength(10_000);
    expect(big.truncated).toBe(true);
  });
  it("round-five fixes", () => {
    const two = parseMatrix("Q1,Q2\n4,5\n3,4\n5,5", ",")!;
    expect(two.rows).toEqual([[4, 5], [3, 4], [5, 5]]);
    expect(criticalValue("t", 0.5, "left", 10)).toBe(0);
    expect(criticalValue("t", 1e-300, "right", 1)).toBeNull();
    expect(pValue("t", 1e200, "right", 1)).toBeNull();
  });
  it("round-seven fixes", () => {
    const named = parseMatrix("Item A,Item B,Item C\n4,5,3\n3,4,2\n5,5,4", ",")!;
    expect(named.names).toEqual(["Item A", "Item B", "Item C"]);
    expect(named.rows).toHaveLength(3);
    expect(parseMatrix("4,5\n3,2\n5,5", ",")!.rows).toEqual([[4, 5], [3, 2], [5, 5]]);
    expect(parseMatrix("3,5 4,5\n2,5 3,0", ",")!.rows).toEqual([[3.5, 4.5], [2.5, 3]]);
    expect(parseMatrix("1e1 2 3\n−4 5 6\n7 8 9")!.rows).toEqual([[10, 2, 3], [-4, 5, 6], [7, 8, 9]]);
    // Scaling keeps 1e150-sized data exact; past ~1e154 the variance itself cannot be stored, so there is no result.
    close(standardDeviation([1e150, -1e150, 3e149], "sample")!.sd, 1.0148891565092221e150, 1e-12);
    expect(standardDeviation([1e160, -1e160, 3e159], "sample")).toBeNull();
    expect(tTest("one", A, [], { mu: NaN })).toBeNull();
  });
  it("round-eight fixes", () => {
    const z = standardDeviation([0.1, 0.2, -0.3], "sample")!;
    expect(z.cv).toBeNull();
    expect(z.mean).toBe(0);
    expect(standardDeviation([1e155, 3e155], "sample")).toBeNull();
    expect(apaP(0.04996)).toBe("p < .05");
    expect(apaP(0.0496)).toBe("p < .05");
    expect(apaP(0.051)).toBe("p = .051");
    expect(criticalValue("f", 1e-300, "right", 1, 1)).toBeNull();
    close(tTest("one", [1e160, 2e160, 3e160], [], { mu: 0 })!.t, 3.4641016151377544, 1e-12);
  });
  it("round-nine fixes", () => {
    expect(apaP(0.09996)).toBe("p < .10");
    expect(alphaBand(0.6999999999999998)).toBe("acceptable");
    expect(parseMatrix("1.234 2\n3 4\n5 6", ",")!.skipped).toBe(1);
  });
  it("round-ten fixes", () => {
    expect(apa2(-0.00014)).toBe("0.00");
    expect(apaUnit(-0.002)).toBe(".00");
    expect(sampleSize({ method: "proportion", confidence: 95, margin: 5, proportion: 50, population: 100, responseRate: 40 })!.invite).toBe(100);
    const sd = standardDeviation([1000000, -1000000, 0.000001], "sample")!;
    close(sd.mean, 0.000001 / 3, 1e-6);
    expect(sd.cv).not.toBeNull();
    const m = parseMatrix("Item A Item B Item C\n1 2 3\n2 3 4\n3 3 5")!;
    expect(m.names).toEqual(["#1", "#2", "#3"]);
    expect(m.rows).toHaveLength(3);
  });
});

