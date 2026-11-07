import { describe, expect, it } from "vitest";
import { evaluate, formatResult } from "../src/shared/calculator";
import { divisorCount, euclidSteps, factorize, factorText, gcd, isPrime, lcm } from "../src/shared/factors";
import { fancy, FANCY_STYLES } from "../src/shared/fancy-text";
import { midiToFreq, TUNINGS } from "../src/shared/tuner";
import { lessonsForTool } from "../src/shared/learn";
import en from "../src/locales/en.json";
import es from "../src/locales/es.json";
import id from "../src/locales/id.json";
import vi from "../src/locales/vi.json";

const value = (src: string, mode: "deg" | "rad" = "deg") => {
  const r = evaluate(src, mode);
  return r.ok ? formatResult(r.value) : r.error;
};

/** Each example the tutorials print, run through the tool's own code. */
describe("batch 21 tutorial examples", () => {
  it("links each tutorial from its tool", () => {
    expect(lessonsForTool("calculator")).toEqual(["use-scientific-calculator"]);
    expect(lessonsForTool("notepad")).toEqual(["use-online-notepad"]);
    expect(lessonsForTool("markdown")).toEqual(["preview-markdown"]);
    expect(lessonsForTool("gradient")).toEqual(["make-css-gradient"]);
    expect(lessonsForTool("fancy-text")).toEqual(["make-fancy-text"]);
    expect(lessonsForTool("coin-flip")).toEqual(["flip-coin"]);
    expect(lessonsForTool("guitar-tuner")).toEqual(["tune-guitar"]);
    expect(lessonsForTool("factors")).toEqual(["find-factors"]);
    expect(lessonsForTool("lcm-gcf")).toEqual(["find-lcm-gcf"]);
  });

  it("matches the calculator", () => {
    expect(value("2 + 3 × 4")).toBe("14");
    expect(value("(2 + 3) × 4")).toBe("20");
    expect(value("(2 + 6) ÷ (1 + 3)")).toBe("2");
    expect(value("sin(30)")).toBe("0.5");
    expect(value("sin(30)", "rad").startsWith("-0.988") || value("sin(30)", "rad").startsWith("−0.988")).toBe(true);
    expect(value("2^10")).toBe("1024");
    expect(value("200 × 10%")).toBe("20");
    expect(value("200 + 10%")).toBe("200.1");
    expect(value("200 × 1.1")).toBe("220");
    expect(value("log(1000)")).toBe("3");
    expect(value("ln(ℯ)")).toBe("1");
    expect(value("log2(8)")).toBe("3");
    expect(value("−2^2")).toMatch(/^[−-]4$/);
    expect(value("(−2)^2")).toBe("4");
    // A bracket left open is closed at the end; an extra one is the error.
    expect(value("(2 + 3")).toBe("5");
    expect(value("(2 + 6 ÷ (1 + 3")).toBe("3.5");
    expect(evaluate("2 + 3)")).toMatchObject({ ok: false, error: "syntax" });
    expect(evaluate("170!").ok).toBe(true);
    expect(evaluate("171!")).toMatchObject({ ok: false, error: "overflow" });
    expect(evaluate("1 ÷ 0")).toMatchObject({ ok: false, error: "domain" });
  });

  it("matches the factor and LCM tools", () => {
    const f360 = factorize(360n);
    expect(factorText(f360)).toBe("2³ × 3² × 5");
    expect(divisorCount(f360)).toBe(24);
    expect(divisorCount(factorize(36n))).toBe(9);
    expect(isPrime(97n)).toBe(true);
    expect(factorText(factorize(1001n))).toBe("7 × 11 × 13");
    expect(gcd(12n, 18n)).toBe(6n);
    expect(lcm(12n, 18n)).toBe(36n);
    expect(euclidSteps(12n, 18n).at(-1)).toMatchObject({ r: 0n, b: 6n });
    expect(gcd(8n, 15n)).toBe(1n);
    // Coprime as a group, but the LCM is not the product.
    expect(gcd(gcd(6n, 10n), 15n)).toBe(1n);
    expect(lcm(lcm(6n, 10n), 15n)).toBe(30n);
  });

  it("matches the tuner and fancy text", () => {
    const [low, , , , , high] = TUNINGS.guitar;
    expect(Math.round(midiToFreq(low))).toBe(82);
    expect(Math.round(midiToFreq(high))).toBe(330);
    const bold = FANCY_STYLES.find((s) => s === "bold")!;
    expect(fancy("cake", bold)).toBe("𝐜𝐚𝐤𝐞");
    expect(fancy("你好é", bold)).toBe("你好é");
    expect(fancy("你", "strike")).not.toBe("你");
    expect(fancy("ab", "upsideDown").length).toBe(2);
    expect(fancy("123", "script")).toBe("123");
  });

  it("writes decimals the way the calculator reads them in each language", () => {
    for (const [loc, pack] of [["es", es], ["id", id], ["vi", vi]] as const) {
      const lesson = pack.learn["use-scientific-calculator"];
      expect(lesson.s5b, loc).toContain("1,1");
      expect(lesson.s4b, loc).toContain("0,5");
      expect(lesson.s4b, loc).not.toMatch(/\d\.\d/);
    }
    expect(en.learn["use-scientific-calculator"].s5b).toContain("1.1");
  });
});
