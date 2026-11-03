import { describe, expect, it } from "vitest";
import { extendStreaks, flipFairCoins, percentText } from "../src/shared/coin";
import { TUNINGS, centsOff, centsText, detectPitch, midiToFreq, nearestTarget, noteName, searchRange } from "../src/shared/tuner";
import {
  divisorCount, divisorSum, divisors, euclidSteps, factorPairs, factorText, factorTextExpanded, factorize, gcd,
  gcfLcmByPrimes, isPrime, lcm, nextPrime, parseWhole, previousPrime, splitNumbers,
} from "../src/shared/factors";

describe("coin-flip", () => {
  it("takes one bit per coin and tracks streaks across presses", () => {
    expect(flipFairCoins(10, () => Uint8Array.of(0b00000101, 0b10))).toEqual(["heads", "tails", "heads", "tails", "tails", "tails", "tails", "tails", "tails", "heads"]);
    let s = extendStreaks({ longest: null, current: null }, ["heads", "tails", "tails"]);
    expect(s).toEqual({ longest: { face: "tails", length: 2 }, current: { face: "tails", length: 2 } });
    s = extendStreaks(s, ["tails", "heads"]);
    expect(s).toEqual({ longest: { face: "tails", length: 3 }, current: { face: "heads", length: 1 } });
    expect(percentText(1, 3)).toBe("33.3%");
    expect(percentText(0, 0)).toBe("—");
  });
  it("is fair over many real flips", () => {
    const faces = flipFairCoins(20000);
    const heads = faces.filter((f) => f === "heads").length;
    expect(faces).toHaveLength(20000);
    expect(Math.abs(heads - 10000)).toBeLessThan(600);
  });
});

function tone(freq: number, rate: number, n: number, harmonics = [1, 0.5, 0.3]): Float32Array {
  const buf = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let v = 0;
    harmonics.forEach((a, k) => { v += a * Math.sin((2 * Math.PI * freq * (k + 1) * i) / rate); });
    buf[i] = v * 0.2;
  }
  return buf;
}

describe("guitar-tuner", () => {
  it("names notes and cents", () => {
    expect(noteName(40)).toBe("E2");
    expect(noteName(69, "solfege")).toBe("La4");
    expect(noteName(63, "letter", true)).toBe("E♭4");
    expect(midiToFreq(69)).toBe(440);
    expect(midiToFreq(69, 432)).toBe(432);
    expect(Math.round(centsOff(445, 69))).toBe(20);
    expect([centsText(3.4), centsText(-12.2), centsText(0.2)]).toEqual(["+3", "−12", "0"]);
    expect(nearestTarget(83, "guitar")).toBe(40);
    expect(nearestTarget(250, "guitar")).toBe(59);
    expect(nearestTarget(452, "chromatic")).toBe(69);
  });
  it("detects the pitch of every guitar, bass and ukulele string within a cent", () => {
    for (const rate of [44100, 48000]) {
      for (const id of ["guitar", "bass", "ukulele", "violin"] as const) {
        const { min, max } = searchRange(id);
        for (const midi of TUNINGS[id]) {
          const f = midiToFreq(midi);
          const p = detectPitch(tone(f * Math.pow(2, 3 / 1200), rate, 4096), rate, min, max);
          expect(p, `${id} ${midi} @${rate}`).not.toBeNull();
          expect(Math.abs(centsOff(p!.freq, midi) - 3), `${id} ${midi} @${rate}`).toBeLessThan(1);
        }
      }
    }
  });
  it("hears a five-string bass's low B at 96 kHz with the larger window", () => {
    const { min, max } = searchRange("bass-5");
    const p = detectPitch(tone(midiToFreq(23), 96000, 8192), 96000, min, max);
    expect(Math.abs(centsOff(p!.freq, 23))).toBeLessThan(1);
  });
  it("ignores silence and noise", () => {
    expect(detectPitch(new Float32Array(4096), 48000)).toBeNull();
    let seed = 1;
    const noise = Float32Array.from({ length: 4096 }, () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 0.5);
    expect(detectPitch(noise, 48000, 70, 1000)).toBeNull();
  });
});

describe("factors", () => {
  it("parses whole numbers", () => {
    expect(parseWhole(" 1 234 567 ")).toEqual({ ok: true, n: 1234567n });
    expect(parseWhole("12,345")).toEqual({ ok: true, n: 12345n });
    expect(parseWhole("1.234.567")).toEqual({ ok: false, error: "notInteger" });
    expect(parseWhole("1.234.567", ".")).toEqual({ ok: true, n: 1234567n });
    expect(parseWhole("4.500")).toEqual({ ok: false, error: "notInteger" });
    expect(parseWhole("1,500", ".")).toEqual({ ok: false, error: "notInteger" });
    expect(parseWhole("4.5")).toEqual({ ok: false, error: "notInteger" });
    expect(parseWhole("1,23")).toEqual({ ok: false, error: "notInteger" });
    expect(parseWhole("-5")).toEqual({ ok: false, error: "notPositive" });
    expect(parseWhole("2.5e3")).toEqual({ ok: false, error: "notInteger" });
    expect(parseWhole("1".repeat(19))).toEqual({ ok: false, error: "tooBig" });
    expect(parseWhole("")).toEqual({ ok: false, error: "empty" });
    expect(splitNumbers("12, 18;24\n30 36")).toEqual(["12", "18", "24", "30", "36"]);
    expect(splitNumbers("12；18、24，30")).toEqual(["12", "18", "24", "30"]);
  });
  it("tests primes and factors big numbers exactly", () => {
    expect([0n, 1n, 2n, 3n, 4n, 97n, 561n].map(isPrime)).toEqual([false, false, true, true, false, true, false]);
    expect(isPrime(999999999999999989n)).toBe(true);
    expect(factorText(factorize(360n))).toBe("2³ × 3² × 5");
    expect(factorTextExpanded(factorize(360n))).toBe("2 × 2 × 2 × 3 × 3 × 5");
    expect(factorText(factorize(1n))).toBe("1");
    const semi = 999999937n * 999999929n;
    expect(factorize(semi)).toEqual([{ p: 999999929n, e: 1 }, { p: 999999937n, e: 1 }]);
    const f = factorize(720720n);
    expect(divisorCount(f)).toBe(240);
    expect(divisorSum(factorize(28n))).toBe(56n);
    expect(divisors(factorize(12n))).toEqual([1n, 2n, 3n, 4n, 6n, 12n]);
    expect(factorPairs(12n, divisors(factorize(12n)))).toEqual([[1n, 12n], [2n, 6n], [3n, 4n]]);
    expect(nextPrime(13n)).toBe(17n);
    expect(previousPrime(13n)).toBe(11n);
    expect(previousPrime(2n)).toBeNull();
  });
  it("finds GCF and LCM with steps", () => {
    expect(gcd(48n, 36n)).toBe(12n);
    expect(lcm(4n, 6n)).toBe(12n);
    expect(euclidSteps(36n, 48n).map((s) => `${s.a}=${s.q}×${s.b}+${s.r}`)).toEqual(["48=1×36+12", "36=3×12+0"]);
    const r = gcfLcmByPrimes([factorize(12n), factorize(18n), factorize(30n)]);
    expect(factorText(r.gcf)).toBe("2 × 3");
    expect(factorText(r.lcm)).toBe("2² × 3² × 5");
  });
});
