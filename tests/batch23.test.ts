import { describe, expect, it } from "vitest";
import { annuityPayment, mortgage } from "../src/shared/mortgage";
import { equationText, num, simplifySqrt, solveQuadratic } from "../src/shared/quadratic";
import { makeTeams, parseNames, planTeams, requestedTeams, shuffle, teamCount } from "../src/shared/teams";
import { randomBelow } from "../src/shared/random";
import { aspectRatio, physical, realResolution, resolutionName } from "../src/shared/screen";
import { nextAlarm, parseClock, remainingText, untilParts } from "../src/shared/alarm";
import { lessonsForTool } from "../src/shared/learn";

describe("mortgage", () => {
  it("matches the standard annuity formula", () => {
    const r = mortgage({ price: 400000, downPct: 20, rate: 6.5, years: 30, method: "annuity" })!;
    expect(r.loan).toBe(320000);
    expect(r.firstPayment.toFixed(2)).toBe("2022.62");
    expect(r.lastPayment.toFixed(2)).toBe("2022.62");
    expect(Math.round(r.interest)).toBe(408142);
    expect(r.schedule).toHaveLength(30);
    expect(r.schedule.at(-1)!.balance).toBe(0);
    expect(Math.round(r.schedule[0]!.interest)).toBe(20695);
    expect(Math.round(r.schedule[0]!.principal)).toBe(3577);
    expect(Math.round(r.schedule[14]!.principal)).toBe(8864);
  });

  it("works out equal principal", () => {
    const r = mortgage({ price: 400000, downPct: 20, rate: 6.5, years: 30, method: "principal" })!;
    expect(r.firstPayment.toFixed(2)).toBe("2622.22");
    expect(r.lastPayment.toFixed(2)).toBe("893.70");
    expect(r.monthlyDrop.toFixed(2)).toBe("4.81");
    expect(Math.round(r.interest)).toBe(312867);
  });

  it("handles 0% and rejects bad input", () => {
    expect(annuityPayment(1200, 0, 12)).toBe(100);
    expect(annuityPayment(1200, 1e-17, 12)).toBeCloseTo(100, 9);
    expect(mortgage({ price: 120000, downPct: 0, rate: 0, years: 10, method: "annuity" })!.interest).toBeCloseTo(0, 6);
    expect(mortgage({ price: 0, downPct: 0, rate: 5, years: 30, method: "annuity" })).toBeNull();
    expect(mortgage({ price: 100, downPct: 100, rate: 5, years: 30, method: "annuity" })).toBeNull();
    expect(mortgage({ price: 100, downPct: 10, rate: 5, years: 2.5, method: "annuity" })).toBeNull();
    expect(mortgage({ price: 100, downPct: 10, rate: 5, years: 51, method: "annuity" })).toBeNull();
  });
});

describe("quadratic", () => {
  it("solves the tutorial examples", () => {
    const a = solveQuadratic(1, -3, 2)!;
    expect(a.d).toBe(1);
    expect(a.roots).toEqual({ kind: "two", x1: 1, x2: 2 });
    expect(a.exact).toEqual(["1", "2"]);
    expect(a.factored).toBe("(x − 1)(x − 2)");
    expect(a.vertex).toEqual({ x: 1.5, y: -0.25 });
    const b = solveQuadratic(1, -2, -1)!;
    expect(b.exact).toEqual(["1 ± √2"]);
    expect(b.factored).toBeNull();
    const c = solveQuadratic(1, 2, 5)!;
    expect(c.roots).toEqual({ kind: "complex", re: -1, im: 2 });
    expect(c.exact).toEqual(["−1 ± 2i"]);
    expect(solveQuadratic(1, 0, -4)!.factored).toBe("(x + 2)(x − 2)");
  });

  it("writes exact and factored forms", () => {
    expect(solveQuadratic(2, 5, -3)!.exact).toEqual(["−3", "1/2"]);
    expect(solveQuadratic(2, 5, -3)!.factored).toBe("(x + 3)(2x − 1)");
    expect(solveQuadratic(1, 2, 1)!.factored).toBe("(x + 1)²");
    expect(solveQuadratic(3, 6, 3)!.factored).toBe("3(x + 1)²");
    expect(solveQuadratic(1, -3, 0)!.factored).toBe("x(x − 3)");
    expect(solveQuadratic(-1, 2, 3)!.factored).toBe("−(x − 3)(x + 1)");
    expect(solveQuadratic(1, 1, 1)!.exact).toEqual(["(−1 ± i√3) / 2"]);
    expect(solveQuadratic(2, 4, 6)!.exact).toEqual(["−1 ± i√2"]);
    expect(solveQuadratic(1, 0, 1)!.exact).toEqual(["±i"]);
    expect(solveQuadratic(0.5, 1.2, -3)!.exact).toBeNull();
    expect(solveQuadratic(0, 1, 1)).toBeNull();
    expect(simplifySqrt(72)).toEqual({ k: 6, m: 2 });
  });

  it("keeps small roots accurate when b² is much larger than 4ac", () => {
    const r = solveQuadratic(1, -1e8, 1)!;
    expect(r.roots.kind).toBe("two");
    if (r.roots.kind === "two") expect(r.roots.x1).toBeCloseTo(1e-8, 15);
  });

  it("treats a rounded-off zero discriminant as one root", () => {
    const r = solveQuadratic(1, 0.2, 0.01)!;
    expect(r.d).toBe(0);
    expect(r.roots).toEqual({ kind: "one", x: -0.1 });
    expect(solveQuadratic(0.01, 0.2, 1)!.vertex).toEqual({ x: -10, y: -0 });
    // Whole numbers stay exact: Δ = 1 is not rounded away.
    expect(solveQuadratic(1, 999999, 249999500000)!.d).toBe(999999 ** 2 - 4 * 249999500000);
  });

  it("prints tiny values instead of 0", () => {
    expect(num(1e-7)).toBe("1e-7");
    expect(num(1.5e-6)).toBe("0.0000015");
    expect(num(3.4567e-5)).toBe("0.000034567");
    expect(num(-2.5e-9)).toBe("−2.5e-9");
    expect(num(0.1 + 0.2)).toBe("0.3");
    expect(num(-0)).toBe("0");
  });

  it("finds exact forms quickly for the largest whole coefficients", () => {
    const t0 = performance.now();
    solveQuadratic(1, 999983, -999979);
    expect(performance.now() - t0).toBeLessThan(100);
  });

  it("prints equations with real minus signs", () => {
    expect(equationText(1, -3, 2)).toBe("x² − 3x + 2 = 0");
    expect(equationText(-1, 0, 4)).toBe("−x² + 4 = 0");
    expect(equationText(2.5, 1, 0)).toBe("2.5x² + x = 0");
  });
});

describe("teams", () => {
  it("parses names from lines and commas", () => {
    expect(parseNames("Ann, Ben，Cy、Dee; Eve")).toEqual(["Ann", "Ben", "Cy", "Dee", "Eve"]);
    // A column pasted from a spreadsheet: each line is one person, commas and all.
    expect(parseNames("Smith, John\r\nDoe, Jane\n\n  Eve  ")).toEqual(["Smith, John", "Doe, Jane", "Eve"]);
  });

  it("counts teams the way the tutorial says", () => {
    expect(teamCount(12, "count", 3)).toBe(3);
    expect(teamCount(12, "size", 5)).toBe(3);
    expect(teamCount(10, "size", 3)).toBe(4);
    expect(teamCount(4, "count", 9)).toBe(4);
    expect(teamCount(500, "size", 1)).toBe(50);
    expect(teamCount(0, "count", 3)).toBe(0);
    // People per team 2 for 500 names asks for 250 teams; the page warns that it made 50.
    expect(requestedTeams(500, "size", 2)).toBe(250);
    expect(teamCount(500, "size", 2)).toBe(50);
    expect(planTeams(500, "size", 2)).toEqual({ ok: true, teams: 50, capped: true });
    expect(planTeams(12, "size", 20)).toEqual({ ok: false, error: "oneTeam" });
    expect(planTeams(1, "count", 3)).toEqual({ ok: false, error: "needTwo" });
    expect(planTeams(501, "count", 3)).toEqual({ ok: false, error: "tooMany" });
    expect(planTeams(12, "count", 0)).toEqual({ ok: false, error: "badNumber" });
  });

  it("deals every name once into teams that differ by at most one", () => {
    const names = Array.from({ length: 10 }, (_, i) => `n${i}`);
    for (let run = 0; run < 50; run++) {
      const teams = makeTeams(names, 3);
      const sizes = teams.map((t) => t.length).sort();
      expect(sizes).toEqual([3, 3, 4]);
      expect(teams.flat().sort()).toEqual([...names].sort());
    }
  });

  it("shuffles uniformly by rejection and Fisher–Yates", () => {
    let calls = 0;
    // The first draw is in the biased top of the range for n = 3 and must be rejected.
    const fake = (buf: Uint32Array) => { buf[0] = calls++ === 0 ? 0xffffffff : 4; return buf; };
    expect(randomBelow(3, fake)).toBe(1);
    expect(shuffle([1, 2, 3], () => 0)).toEqual([2, 3, 1]);
  });
});

describe("screen", () => {
  it("names ratios and resolutions", () => {
    expect(aspectRatio(1920, 1080)).toBe("16:9");
    expect(aspectRatio(1366, 768)).toBe("16:9");
    expect(aspectRatio(1440, 900)).toBe("16:10");
    expect(aspectRatio(2560, 1080)).toBe("21:9");
    expect(aspectRatio(3440, 1440)).toBe("21:9");
    expect(aspectRatio(1280, 1024)).toBe("5:4");
    expect(aspectRatio(390, 844)).toBe("19.5:9");
    expect(resolutionName(1920, 1080)).toBe("Full HD (1080p)");
    expect(resolutionName(1080, 1920)).toBe("Full HD (1080p)");
    expect(resolutionName(1000, 700)).toBeNull();
    expect(physical(1536, 1.25)).toBe(1920);
    expect(physical(390, 3)).toBe(1170);
    // Rounded CSS sizes snap back to the real panel.
    expect(realResolution(1707, 960, 1.5)).toEqual({ w: 2560, h: 1440 });
    expect(realResolution(1707, 1067, 1.5)).toEqual({ w: 2560, h: 1600 });
    expect(realResolution(1504, 1003, 1.5)).toEqual({ w: 2256, h: 1504 });
    expect(realResolution(1003, 1504, 1.5)).toEqual({ w: 1504, h: 2256 });
    expect(realResolution(1000, 700, 1)).toEqual({ w: 1000, h: 700 });
    expect(realResolution(1919, 1080, 1)).toEqual({ w: 1919, h: 1080 });
    expect(realResolution(1829, 1143, 1.75)).toEqual({ w: 3200, h: 2000 });
    expect(realResolution(1600, 1067, 1.5)).toEqual({ w: 2400, h: 1600 });
    expect(realResolution(1093, 614, 1.25)).toEqual({ w: 1366, h: 768 });
    expect(realResolution(1536, 864, 1.25)).toEqual({ w: 1920, h: 1080 });
    expect(realResolution(1470, 956, 2)).toEqual({ w: 2940, h: 1912 });
  });
});

describe("alarm", () => {
  it("parses clock times", () => {
    expect(parseClock("07:00")).toBe(420);
    expect(parseClock("7:05")).toBe(425);
    expect(parseClock("23:59:00")).toBe(1439);
    expect(parseClock("24:00")).toBeNull();
    expect(parseClock("")).toBeNull();
  });

  it("rings tomorrow when the time has passed", () => {
    const now = new Date(2026, 10, 9, 23, 30, 0);
    const at = nextAlarm(now, 420);
    expect(at.getDate()).toBe(10);
    expect(at.getHours()).toBe(7);
    expect(untilParts(at.getTime() - now.getTime())).toEqual({ h: 7, m: 30 });
    expect(nextAlarm(new Date(2026, 10, 9, 6, 0), 420).getDate()).toBe(9);
    // The same minute as now is already past: tomorrow.
    expect(nextAlarm(new Date(2026, 10, 9, 7, 0, 0), 420).getDate()).toBe(10);
    expect(remainingText(27_000_000)).toBe("7:30:00");
    expect(remainingText(65_100)).toBe("01:06");
  });
});

describe("batch 23 tutorials", () => {
  it("links each tutorial from its tool", () => {
    expect(lessonsForTool("mortgage")).toEqual(["calculate-mortgage"]);
    expect(lessonsForTool("quadratic")).toEqual(["solve-quadratic"]);
    expect(lessonsForTool("team-generator")).toEqual(["make-random-teams"]);
    expect(lessonsForTool("screen-resolution")).toEqual(["check-screen-resolution"]);
    expect(lessonsForTool("alarm")).toEqual(["set-online-alarm"]);
  });
});
