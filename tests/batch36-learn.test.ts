import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LOCALES } from "../src/shared/locale";
import { TUTORIAL_DIAGRAMS } from "../src/shared/learn";
import { TUTORIAL_GROUPS } from "../src/shared/path";
import { between, chiIndependence, criticalValue, cronbachAlpha, parseMatrix, pValue, sampleSize, standardDeviation, tTest, zScore } from "../src/shared/academic-stats";
import { SAMPLE } from "../src/client/cronbach-alpha/ui";

const IDS = [
  "calculate-standard-deviation", "calculate-sample-size", "calculate-cronbach-alpha", "run-t-test", "run-chi-square-test",
  "find-p-value", "calculate-z-score", "cite-apa", "cite-mla", "cite-harvard",
] as const;
const svg = (name: string, locale = "en") => readFileSync(`public/covers/tutorials/${locale === "en" ? "" : `${locale.toLowerCase()}/`}${name}.svg`, "utf8");
const en = JSON.parse(readFileSync("scripts/learn-src/batch36/en.json", "utf8")) as { lessons: Record<string, { copy: Record<string, string> }> };
const copy = (id: string) => Object.values(en.lessons[id]!.copy).join(" ");

describe("batch 36 tutorials", () => {
  it("are one tutorial group with two diagrams each, drawn in every locale", () => {
    expect(TUTORIAL_GROUPS.find((g) => g.id === "academic")?.tutorials).toEqual([...IDS]);
    for (const id of IDS) {
      const diagrams = TUTORIAL_DIAGRAMS[id]!;
      expect(diagrams, id).toHaveLength(2);
      expect(diagrams[0]!.step, id).toBeLessThan(diagrams[1]!.step);
      for (const locale of LOCALES) for (const d of diagrams) {
        const file = `public/covers/tutorials/${locale === "en" ? "" : `${locale.toLowerCase()}/`}${d.src.split("/").pop()}`;
        expect(existsSync(file), file).toBe(true);
      }
    }
  });

  it("has a title, description and group name in every locale", () => {
    for (const locale of LOCALES) {
      const pack = JSON.parse(readFileSync(`src/locales/${locale}.json`, "utf8")) as { meta: Record<string, string>; learn: { groups: Record<string, string> } };
      expect(pack.learn.groups.academic, locale).toBeTruthy();
      for (const id of IDS) {
        const name = id.split("-").map((w) => w[0]!.toUpperCase() + w.slice(1)).join("");
        expect(pack.meta[`title${name}`], `${locale} title${name}`).toMatch(/\| cv\.cm$/);
        // CJK says in about half the characters what Latin-script languages say.
        expect(pack.meta[`desc${name}`]?.length, `${locale} desc${name}`).toBeGreaterThan(/^(zh|ja|ko)/.test(locale) ? 30 : 60);
      }
    }
  });
});

describe("batch 36 tutorials stay in step with the tools", () => {
  it("standard deviation: sum of squares, variances and SDs", () => {
    const data = [2, 4, 4, 4, 5, 5, 7, 9];
    const s = standardDeviation(data, "sample")!;
    const p = standardDeviation(data, "population")!;
    expect([s.ss, s.variance.toFixed(3), s.sd.toFixed(3), p.sd]).toEqual([32, "4.571", "2.138", 2]);
    expect(svg("calculate-standard-deviation-deviations")).toContain("= 32<");
    expect(svg("calculate-standard-deviation-divide")).toContain(`√4.571 = ${s.sd.toFixed(3)}`);
    expect(svg("calculate-standard-deviation-divide")).toContain("√4 = 2");
    expect(copy("calculate-standard-deviation")).toContain("2.138");
    expect(copy("calculate-standard-deviation")).toContain(`${s.se.toFixed(2)}`);
  });

  it("sample size: Cochran, the population correction, Slovin and the margin chart", () => {
    // The worked line uses the rounded z it prints: 1.96² × 0.5 × 0.5 ÷ 0.05² = 384.16.
    expect(svg("calculate-sample-size-cochran")).toContain("= 384.2<");
    expect(copy("calculate-sample-size")).toContain("384.2");
    const base = { method: "proportion" as const, confidence: 95, proportion: 50 };
    expect(sampleSize({ ...base, margin: 5 })!.n).toBe(385);
    expect(sampleSize({ ...base, margin: 5, population: 1000 })!.n).toBe(278);
    expect(sampleSize({ method: "slovin", confidence: 95, margin: 5, population: 1000 })!.n).toBe(286);
    expect(sampleSize({ ...base, margin: 5, responseRate: 40 })!.invite).toBe(963);
    const chart = svg("calculate-sample-size-margins");
    for (const m of [10, 5, 4, 3, 2]) expect(chart, `±${m}`).toContain(`>${sampleSize({ ...base, margin: m })!.n.toLocaleString("en")}<`);
    for (const n of ["385", "278", "286", "963"]) expect(copy("calculate-sample-size")).toContain(n);
  });

  it("Cronbach's alpha: the example scale", () => {
    const r = cronbachAlpha(parseMatrix(SAMPLE)!)!;
    const matrix = svg("calculate-cronbach-alpha-matrix");
    expect(matrix).toContain(`α = ${r.alpha.toFixed(3)}`);
    expect(matrix).toContain(r.sumItemVariance.toFixed(2));
    expect(matrix).toContain(r.totalVariance.toFixed(2));
    expect(copy("calculate-cronbach-alpha")).toContain(r.alpha.toFixed(3));
    expect(svg("calculate-cronbach-alpha-bands")).toContain(`α = ${r.alpha.toFixed(3)}`);
  });

  it("t-test: the two example groups", () => {
    const A = [5.1, 4.9, 6.2, 5.8, 6.0, 5.5, 5.3, 6.1];
    const B = [4.8, 4.7, 5.9, 5.0, 5.6, 5.2, 4.9, 5.4];
    const r = tTest("independent", A, B)!;
    const line = `t(${r.df.toFixed(2)}) = ${r.t.toFixed(2)}, p = ${r.p.toFixed(3).replace(/^0/, "")}`;
    expect(copy("run-t-test")).toContain(line);
    expect(copy("run-t-test")).toContain(`d = ${r.d.toFixed(2)}`);
    expect(copy("run-t-test")).toContain(`${r.ciLow.toFixed(2).replace("-", "−")} to ${r.ciHigh.toFixed(2)}`);
    expect(svg("run-t-test-curve")).toContain(`t(${r.df.toFixed(2)}) → p = ${r.p.toFixed(3)}`);
    expect(svg("run-t-test-curve")).toContain(`${(r.p / 2).toFixed(3)} `);
  });

  it("chi-square: the 2 × 2 example", () => {
    const r = chiIndependence([[20, 15], [30, 35]])!;
    expect(svg("run-chi-square-test-tables")).toContain(`= ${r.chi2.toFixed(2)}<`);
    expect(svg("run-chi-square-test-curve")).toContain(`p = ${r.p.toFixed(3)}`);
    expect(svg("run-chi-square-test-curve")).toContain(criticalValue("chi2", 0.05, "right", 1)!.toFixed(2));
    expect(copy("run-chi-square-test")).toContain(`χ²(1, N = 100) = ${r.chi2.toFixed(2)}, p = ${r.p.toFixed(3).replace(/^0/, "")}`);
  });

  it("p-values and z-scores", () => {
    expect(pValue("z", 1.96, "two")!.toFixed(2)).toBe("0.05");
    expect(pValue("z", 1.96, "right")!.toFixed(3)).toBe("0.025");
    expect(copy("find-p-value")).toContain(`±${criticalValue("t", 0.05, "two", 10)!.toFixed(3)}`);
    const z = zScore(130, 100, 15)!;
    expect(svg("calculate-z-score-formula")).toContain(`${(z.below * 100).toFixed(2)} %`);
    const rule = svg("calculate-z-score-rule");
    for (const k of [1, 2, 3]) expect(rule).toContain(`${(between(-k, k, 0, 1)!.p * 100).toFixed(2)} %`);
    expect(copy("calculate-z-score")).toContain(`${(z.below * 100).toFixed(2)} %`);
  });

  it("MLA examples use title case, the year and a doi.org link, as the steps say", () => {
    for (const name of ["cite-mla-elements", "cite-mla-in-text"]) {
      const s = svg(name);
      expect(s).toContain("Deep Learning.");
      expect(s).not.toContain("May 2015");
    }
    expect(svg("cite-mla-in-text")).toContain("https://doi.org/");
    expect(svg("find-p-value-tails")).not.toContain("0.050");
  });

  it("writes decimals with each locale's mark in the diagrams", () => {
    expect(svg("calculate-standard-deviation-divide", "es")).toContain("2,138");
    expect(svg("calculate-standard-deviation-divide", "zh-CN")).toContain("2.138");
  });
});
