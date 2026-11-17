// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountStandardDeviation, unmountStandardDeviation } from "../src/client/standard-deviation/ui";
import { mountSampleSize, unmountSampleSize } from "../src/client/sample-size/ui";
import { mountCronbach, unmountCronbach } from "../src/client/cronbach-alpha/ui";
import { mountTTest, unmountTTest } from "../src/client/t-test/ui";
import { mountChiSquare, unmountChiSquare } from "../src/client/chi-square/ui";
import { mountPValue, unmountPValue } from "../src/client/p-value/ui";
import { mountZScore, unmountZScore } from "../src/client/z-score/ui";
import { fmt, fmtP } from "../src/client/academic/common";
import { cronbachAlpha, parseMatrix } from "../src/shared/academic-stats";

let host: HTMLElement;

beforeEach(() => {
  vi.useFakeTimers();
  host = document.createElement("div");
  document.body.append(host);
});

afterEach(() => {
  unmountStandardDeviation();
  unmountSampleSize();
  unmountCronbach();
  unmountTTest();
  unmountChiSquare();
  unmountPValue();
  unmountZScore();
  host.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const q = <T extends HTMLElement>(sel: string) => host.querySelector<T>(sel)!;
const text = (sel: string) => q(sel).textContent ?? "";
const set = (sel: string, value: string, event = "input") => {
  const el = q<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(sel);
  el.value = value;
  el.dispatchEvent(new Event(event));
  vi.advanceTimersByTime(200);
};

describe("standard deviation ui", () => {
  it("shows the sample SD, the formula and the step table", () => {
    mountStandardDeviation(host);
    expect(text("[data-out=result]")).toContain("Standard deviation (s)2.13809");
    expect(text("[data-out=formula]")).toBe("s² = Σ(x − x̄)² ÷ (n − 1) = 32 ÷ 7 = 4.571429; s = √4.571429 = 2.13809");
    expect(host.querySelectorAll("[data-out=steps] tbody tr")).toHaveLength(8);
    set("[data-field=kind]", "population", "change");
    expect(text("[data-out=result]")).toContain("Standard deviation (σ)2");
  });
  it("reads comma decimals and asks for two values in a sample", () => {
    mountStandardDeviation(host);
    set("[data-field=decimal]", ",", "change");
    set("[data-field=numbers]", "1,5 2,5");
    expect(text("[data-out=result]")).toContain("Mean2");
    set("[data-field=numbers]", "7");
    expect(text("[data-out=result]")).toContain("at least two numbers");
    expect(q<HTMLButtonElement>("[data-action=copy]").disabled).toBe(true);
  });
});

describe("sample size ui", () => {
  it("gives 385 by default, 278 for 1000 people, and a reference table", () => {
    mountSampleSize(host);
    expect(text("[data-out=result]")).toContain("Sample size385");
    expect(host.querySelectorAll("[data-out=table] tbody tr")).toHaveLength(6);
    set("[data-field=population]", "1000");
    expect(text("[data-out=result]")).toContain("Sample size278");
    expect(text("[data-out=formula]")).toContain("n = n₀ ÷ (1 + (n₀ − 1) ÷ N)");
    set("[data-field=response]", "40");
    expect(text("[data-out=result]")).toContain("People to invite at 40 % response695");
  });
  it("switches to Slovin and needs a population", () => {
    mountSampleSize(host);
    set("[data-field=method]", "slovin", "change");
    expect(q("[data-field=confidence]").closest("label")!.hidden).toBe(true);
    expect(text("[data-out=result]")).toContain("needs the population size");
    set("[data-field=population]", "1000");
    expect(text("[data-out=result]")).toContain("Sample size286");
    set("[data-field=method]", "proportion", "change");
    set("[data-field=population]", "10,000");
    expect(text("[data-out=result]")).toContain("Sample size370");
    set("[data-field=proportion]", "50%");
    set("[data-field=method]", "slovin", "change");
    expect(text("[data-out=result]")).toContain("Sample size385");
    set("[data-field=population]", "1o00");
    expect(text("[data-out=result]")).toContain("Check the values");
  });
});

describe("Cronbach's alpha ui", () => {
  it("computes the example and flags items", () => {
    mountCronbach(host);
    expect(text("[data-out=result]")).toContain("Cronbach's alpha (α)0.935");
    expect(text("[data-out=band]")).toBe("Internal consistency: excellent (α ≥ 0.9).");
    expect(text("[data-out=apa]")).toBe("APA style: Cronbach's α = .93 (5 items, n = 10).");
    expect(host.querySelectorAll("[data-out=items] tbody tr")).toHaveLength(5);
    expect(text("[data-out=items]")).toContain("0.941 ↑");
  });
  it("takes numeric item labels as a header when asked", () => {
    mountCronbach(host);
    set("[data-field=matrix]", "1 2 3\n4 5 4\n3 3 3\n5 4 5\n2 2 3");
    expect(text("[data-out=result]")).toContain("Respondents (n)5");
    set("[data-field=header]", "yes", "change");
    expect(text("[data-out=result]")).toContain("Respondents (n)4");
  });
  it("explains a negative alpha", () => {
    mountCronbach(host);
    set("[data-field=matrix]", "1 5\n2 4\n3 3\n4 2\n5 2");
    expect(text("[data-out=band]")).toContain("reverse-worded");
  });
});

describe("t-test ui", () => {
  it("runs Welch by default and writes an APA line", () => {
    mountTTest(host);
    expect(text("[data-out=result]")).toContain("t1.8749");
    expect(text("[data-out=result]")).toContain("Degrees of freedom13.71");
    expect(text("[data-out=result]")).toContain("p-value (two-tailed)0.0823");
    expect(text("[data-out=apa]")).toBe("APA style: t(13.71) = 1.87, p = .082, d = 0.94");
    expect(text("[data-out=verdict]")).toBe("Not significant at α = 0.05.");
    expect(host.querySelector("[data-out=plot] svg")).not.toBeNull();
    set("[data-field=alpha]", "0.1", "change");
    expect(text("[data-out=result]")).toContain("90 % confidence interval[0.0251, 0.8249]");
    expect(text("[data-out=verdict]")).toBe("Significant at α = 0.1: the difference is unlikely to be chance alone.");
  });
  it("rewrites the untouched example when the decimal mark changes", () => {
    mountTTest(host);
    set("[data-field=decimal]", ",", "change");
    expect(q<HTMLTextAreaElement>("[data-field=a]").value).toBe("5,1 4,9 6,2 5,8 6,0 5,5 5,3 6,1");
    expect(text("[data-out=apa]")).toBe("APA style: t(13.71) = 1.87, p = .082, d = 0.94");
    set("[data-field=decimal]", ".", "change");
    expect(q<HTMLTextAreaElement>("[data-field=a]").value).toBe("5.1 4.9 6.2 5.8 6.0 5.5 5.3 6.1");
  });
  it("paired and one-sample", () => {
    mountTTest(host);
    set("[data-field=kind]", "paired", "change");
    expect(text("[data-out=apa]")).toBe("APA style: t(7) = 5.67, p < .001, d_z = 2.00");
    expect(text("[data-out=verdict]")).toContain("Significant at α = 0.05");
    set("[data-field=b]", "1 2 3");
    expect(text("[data-out=result]")).toContain("same number of values in both lists (8 and 3)");
    set("[data-field=b]", "4.8 4.7 x 5.0 5.6 5.2 4.9 5.4 5.0");
    expect(text("[data-out=result]")).toContain("skipped entry would shift the pairs");
    expect(text("[data-out=note]")).toBe("Skipped 1 entries that are not numbers: x");
    expect(q<HTMLInputElement>("[data-field=mu]").getAttribute("inputmode")).toBe("text");
    set("[data-field=kind]", "one", "change");
    expect(q("[data-field=b]").closest("label")!.hidden).toBe(true);
    expect(text("[data-out=apa]")).toBe("APA style: t(7) = 3.57, p = .009, d = 1.26");
  });
});

describe("chi-square ui", () => {
  it("tests the 2 × 2 example, with Yates", () => {
    mountChiSquare(host);
    expect(text("[data-out=result]")).toContain("Chi-square (χ²)1.0989");
    expect(text("[data-out=apa]")).toBe("Not significant at α = 0.05. APA style: χ²(1, N = 100) = 1.10, p = .295, V = .10");
    q<HTMLInputElement>("[data-field=yates]").checked = true;
    q("[data-field=yates]").dispatchEvent(new Event("change"));
    expect(text("[data-out=result]")).toContain("Chi-square (χ²)0.7033");
    expect(text("[data-out=apa]")).toContain("= 0.70 (with Yates' correction), p = .402, V = .10");
    set("[data-field=alpha]", "0.1", "change");
    expect(text("[data-out=apa]")).toContain("Not significant at α = 0.1.");
    set("[data-cell='t0-0']", "20.5");
    expect(text("[data-out=result]")).toContain("whole-number count");
  });
  it("keeps typed counts when the table grows, and does goodness of fit", () => {
    mountChiSquare(host);
    set("[data-field=cols]", "3", "change");
    expect(q<HTMLInputElement>("[data-cell='t0-0']").value).toBe("20");
    expect(text("[data-out=result]")).toContain("Fill every cell");
    set("[data-cell='t0-2']", "30");
    set("[data-cell='t1-2']", "10");
    expect(text("[data-out=result]")).toContain("Degrees of freedom2");
    set("[data-field=mode]", "goodness", "change");
    expect(text("[data-out=result]")).toContain("p-value0.2289");
    set("[data-field=expected]", "custom", "change");
    expect(text("[data-out=result]")).toContain("Every expected share must be a number above zero.");
    for (const [j, v] of ["1", "1", "1", "1"].entries()) set(`[data-cell='e${j}']`, v);
    expect(text("[data-out=result]")).toContain("p-value0.2289");
  });
  it("warns about small expected counts", () => {
    mountChiSquare(host);
    set("[data-cell='t0-0']", "2");
    set("[data-cell='t0-1']", "1");
    expect(text("[data-out=warn]")).toContain("Fisher's exact test");
  });
});

describe("p-value ui", () => {
  it("z = 1.96 two-tailed is 0.05, and critical values", () => {
    mountPValue(host);
    // 0.0499958 is just under 0.05: shown with its digits, not rounded onto the cut-off.
    expect(text("[data-out=result]")).toContain("p-value0.0499958");
    set("[data-field=dist]", "chi2", "change");
    expect(q<HTMLSelectElement>("[data-field=tail]").disabled).toBe(true);
    set("[data-field=stat]", "3.841458820694124");
    set("[data-field=df1]", "1");
    expect(text("[data-out=result]")).toContain("p-value0.0500");
    set("[data-field=mode]", "critical", "change");
    set("[data-field=dist]", "t", "change");
    expect(text("[data-out=result]")).toContain("Critical value± 12.7062");
    expect(text("[data-out=verdict]")).toBe("Reject the null hypothesis when |t| ≥ 12.7062.");
    set("[data-field=tail]", "left", "change");
    set("[data-field=dist]", "f", "change");
    expect(q<HTMLSelectElement>("[data-field=tail]").value).toBe("right");
    set("[data-field=dist]", "z", "change");
    expect(text("[data-out=result]")).toContain("Critical value-1.6449");
  });
});

describe("z-score ui", () => {
  it("value, percentile and between", () => {
    mountZScore(host);
    expect(text("[data-out=result]")).toContain("z-score2");
    expect(text("[data-out=result]")).toContain("Below (percentile)97.72 %");
    set("[data-field=mode]", "percentile", "change");
    expect(text("[data-out=result]")).toContain("Value at this percentile119.2233");
    set("[data-field=mode]", "between", "change");
    expect(text("[data-out=result]")).toContain("Probability between68.27 %");
    set("[data-field=sigma]", "0");
    expect(text("[data-out=result]")).toContain("standard deviation above zero");
  });
});

describe("formatting and the medium-pass fixes", () => {
  it("keeps significant digits for small values and p close to 1", () => {
    expect(fmt(0.000149, 4)).toBe("0.000149");
    expect(fmt(0.5, 4)).toBe("0.5");
    expect(fmtP(0.999994)).toBe("0.999994");
    expect(fmtP(0.5)).toBe("0.5000");
  });
  it("refuses standardized alpha when an item is constant", () => {
    const r = cronbachAlpha(parseMatrix("1 2 3\n2 2 4\n3 2 4\n4 2 5")!)!;
    expect(Number.isFinite(r.alpha)).toBe(true);
    expect(r.standardized).toBeNaN();
  });
});
