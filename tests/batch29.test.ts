import { describe, expect, it } from "vitest";
import { longestRun, roundEstimate, tailRun, tailShape, tailStraight } from "../src/shared/number-pattern";
import { guessMarket, phoneDigits, phoneNumerology, phoneNut, valuePhone } from "../src/shared/phone-value";
import { guessPlateMarket, normalizePlate, ukFormat, valuePlate } from "../src/shared/plate-value";
import { decodeIdn, parseDomain, pronounceable, twoWords, valueDomain } from "../src/shared/domain-value";
import { carValue, mileageFactor, retained } from "../src/shared/car-depreciation";
import { ageBand, netWorth } from "../src/shared/net-worth";
import { dcf, multipleRange } from "../src/shared/business-valuation";

const phone = (n: string, m: "cn" | "vn" | "intl") => {
  const r = valuePhone(n, m);
  if (!r.ok) throw new Error(`${n}: ${r.error}`);
  return r.value;
};
const plate = (p: string, m: "uk" | "vn" | "cn") => {
  const r = valuePlate(p, m);
  if (!r.ok) throw new Error(`${p}: ${r.error}`);
  return r.value;
};
const domain = (d: string) => {
  const r = valueDomain(d);
  if (!r.ok) throw new Error(`${d}: ${r.error}`);
  return r.value;
};

describe("digit patterns", () => {
  it("reads runs, straights and shapes at the end", () => {
    expect(tailRun("1388888")).toBe(5);
    expect(tailRun("")).toBe(0);
    expect(longestRun("1222234")).toEqual({ length: 4, digit: "2" });
    expect(tailStraight("905678")).toBe(4);
    expect(tailStraight("1254321")).toBe(5);
    expect(tailStraight("1357")).toBe(1);
    expect(tailShape("11223")).toBeNull();
    expect(tailShape("981122")).toBe("AABB");
    expect(tailShape("981212")).toBe("ABAB");
    expect(tailShape("981221")).toBe("ABBA");
    expect(tailShape("123123")).toBe("ABCABC");
    expect(tailShape("112233")).toBe("AABBCC");
    expect(tailShape("121212")).toBe("ABABAB");
    expect(tailShape("44448888")).toBe("AAAABBBB");
    expect(tailShape("12341234")).toBe("ABCDABCD");
  });

  it("rounds estimates to two significant figures", () => {
    expect(roundEstimate(12_345)).toBe(12_000);
    expect(roundEstimate(987)).toBe(990);
    expect(roundEstimate(7)).toBe(7);
    expect(roundEstimate(0)).toBe(0);
  });
});

describe("phone number value", () => {
  it("reads country codes, spaces and full-width digits", () => {
    expect(phoneDigits("+86 138-8888-6688", "cn")).toBe("13888886688");
    expect(phoneDigits("+84 903 686 868", "vn")).toBe("0903686868");
    expect(phoneDigits("１３８８８８８６６８８", "cn")).toBe("13888886688");
    expect(guessMarket("0903 686868", "cn")).toBe("vn");
    expect(guessMarket("+86 13912345678", "intl")).toBe("cn");
    expect(guessMarket("212 555 0000", "cn")).toBe("cn");
  });

  it("rejects numbers that are not valid in the market", () => {
    expect(valuePhone("", "cn")).toEqual({ ok: false, error: "empty" });
    expect(valuePhone("1234", "cn")).toEqual({ ok: false, error: "invalid" });
    expect(valuePhone("0123456789", "vn")).toEqual({ ok: false, error: "invalid" });
    expect(valuePhone("12345", "intl")).toEqual({ ok: false, error: "invalid" });
  });

  it("ranks the patterns buyers pay for", () => {
    const plain = phone("13912865207", "cn");
    const aabb = phone("13912861122", "cn");
    const four = phone("13912868888", "cn");
    const five = phone("13912388888", "cn");
    const eight = phone("18688888888", "cn");
    expect(plain.tier).toBe(0);
    expect(plain.features).toEqual([{ key: "plain" }]);
    expect(aabb.tier).toBe(2);
    expect(four.tier).toBe(3);
    expect(five.tier).toBe(4);
    expect(eight.tier).toBe(6);
    const values = [plain, aabb, four, five, eight].map((v) => v.estimate);
    expect(values).toEqual([...values].sort((a, b) => a - b));
    for (const v of [plain, aabb, four, five, eight]) {
      expect(v.low).toBeLessThanOrEqual(v.estimate);
      expect(v.high).toBeGreaterThanOrEqual(v.estimate);
      expect(v.score).toBeGreaterThanOrEqual(0);
      expect(v.score).toBeLessThanOrEqual(100);
    }
  });

  it("values a run of 4s lower in China, and two runs of four above one", () => {
    expect(phone("13912864444", "cn").tier).toBe(phone("13912868888", "cn").tier - 1);
    expect(phone("13544448888", "cn").tier).toBe(4);
    expect(phone("15012341234", "cn").features).toContainEqual({ key: "shape", shape: "ABCDABCD" });
  });

  it("finds Vietnamese lucky endings and straights", () => {
    expect(phone("0912398979", "vn").features).toContainEqual({ key: "luckyTail", tail: "79" });
    expect(phone("0901234567", "vn").tier).toBe(4);
    expect(phone("0988888888", "vn").currency).toBe("VND");
  });

  it("reads the 81 numbers and the nút", () => {
    // 8888 / 80 leaves 8, a lucky number; 4400 leaves 0, read as 80.
    expect(phoneNumerology("13912868888")).toEqual({ n: 8, good: true });
    expect(phoneNumerology("13912864400")).toEqual({ n: 80, good: false });
    expect(phoneNut("0903686868")).toBe(4);
    expect(phoneNut("0900000001")).toBe(10);
    expect(phone("13912868888", "cn").numerology).toEqual({ n: 8, good: true });
    expect(phone("0903686868", "vn").nut).toBe(4);
    expect(phone("2125550000", "intl").numerology).toBeNull();
  });
});

describe("number plate value", () => {
  it("normalises and classifies UK marks", () => {
    expect(normalizePlate(" ab12 cde ")).toBe("AB12CDE");
    expect(ukFormat("AB12CDE")).toBe("current");
    expect(ukFormat("A123BCD")).toBe("prefix");
    expect(ukFormat("ABC123D")).toBe("suffix");
    expect(ukFormat("1A")).toBe("dateless");
    expect(ukFormat("ABC1")).toBe("dateless");
    expect(ukFormat("ABCDE")).toBeNull();
  });

  it("prices shorter and dateless UK marks higher", () => {
    const two = plate("1 A", "uk");
    const four = plate("ABC 1", "uk");
    const prefix = plate("A1 ABC", "uk");
    const current = plate("AB12 CDE", "uk");
    expect(two.estimate).toBeGreaterThan(four.estimate);
    expect(four.estimate).toBeGreaterThan(prefix.estimate);
    expect(prefix.estimate).toBeGreaterThan(current.estimate);
    expect(two.currency).toBe("GBP");
    expect(two.features).toContainEqual({ key: "singleOne" });
    expect(plate("AB11 XXX", "uk").features.filter((f) => f.key === "sameDigits")).toHaveLength(1);
  });

  it("puts a Vietnamese five-of-a-kind in the top band, near its auction price", () => {
    const top = plate("51K-888.88", "vn");
    expect(top.tier).toBe(4);
    expect(top.features).toContainEqual({ key: "tailRun", n: 5, digit: "8" });
    expect(top.features).toContainEqual({ key: "bigCity" });
    // 51K-888.88 sold for 32.34 billion dong in 2023.
    expect(top.low).toBeLessThanOrEqual(32_340_000_000);
    expect(top.high).toBeGreaterThanOrEqual(32_340_000_000);
    expect(plate("29-B1 888.88", "vn").tier).toBe(4);
    const plain = plate("29A-123.67", "vn");
    expect(plain.tier).toBe(0);
    expect(plain.estimate).toBe(0);
  });

  it("reads mainland Chinese plates with or without the province", () => {
    expect(plate("京A·88888", "cn").tier).toBe(4);
    expect(plate("A88888", "cn").tier).toBe(4);
    expect(plate("沪AD12345", "cn").features).toContainEqual({ key: "letters" });
    expect(valuePlate("京I12345", "cn")).toEqual({ ok: false, error: "invalid" });
    expect(guessPlateMarket("粤B·88866", "uk")).toBe("cn");
    expect(guessPlateMarket("30K-686.86", "uk")).toBe("vn");
    expect(guessPlateMarket("AB12 CDE", "vn")).toBe("uk");
  });
});

describe("domain value", () => {
  it("parses links, www and second-level extensions", () => {
    expect(parseDomain("https://www.Example.com/path?q=1")).toEqual({ ok: true, sld: "example", tld: "com" });
    expect(parseDomain("shop.example.co.uk")).toEqual({ ok: true, sld: "example", tld: "co.uk" });
    expect(parseDomain("example")).toEqual({ ok: false, error: "noTld" });
    expect(parseDomain("-bad-.com")).toEqual({ ok: false, error: "invalid" });
    expect(parseDomain("  ")).toEqual({ ok: false, error: "empty" });
  });

  it("finds words and pronounceable names", () => {
    expect(twoWords("cloudkitchen")).toEqual(["cloud", "kitchen"]);
    expect(twoWords("zzqxv")).toBeNull();
    expect(pronounceable("lumo")).toBe(true);
    expect(pronounceable("xkcdq")).toBe(false);
  });

  it("orders names the way the aftermarket does", () => {
    const word = domain("cloud.com");
    const pair = domain("cloudshop.com");
    const brand = domain("lumora.com");
    const junk = domain("best-cheap-cars-online2024.com");
    expect(word.kind).toBe("word");
    expect(pair.kind).toBe("twoWords");
    expect(brand.kind).toBe("brandable");
    expect(word.estimate).toBeGreaterThan(pair.estimate);
    expect(pair.estimate).toBeGreaterThan(brand.estimate);
    expect(brand.estimate).toBeGreaterThan(junk.estimate);
    expect(junk.estimate).toBe(10);
  });

  it("values .com above other extensions and boosts hot words only as whole words", () => {
    expect(domain("cloud.com").estimate).toBeGreaterThan(domain("cloud.io").estimate);
    expect(domain("aibot.com").features).toContainEqual({ key: "hot", word: "ai" });
    expect(domain("air.com").features.some((f) => f.key === "hot")).toBe(false);
  });

  it("prices four-digit numbers by lucky and unlucky digits", () => {
    expect(domain("8888.com").estimate).toBeGreaterThan(domain("1235.com").estimate);
    expect(domain("1235.com").estimate).toBeGreaterThan(domain("1234.com").estimate);
    expect(domain("1234.com").features).toContainEqual({ key: "four" });
  });
});

describe("car depreciation", () => {
  it("follows the rule of thumb: 20% in year one, about 60% gone after five", () => {
    expect(retained(1, "average")).toBeCloseTo(0.8);
    expect(retained(5, "average")).toBeCloseTo(0.8 * 0.85 ** 4);
    expect(retained(0, "average")).toBe(1);
    expect(retained(5, "luxury")).toBeLessThan(retained(5, "average"));
    expect(retained(5, "truck")).toBeGreaterThan(retained(5, "average"));
  });

  it("adjusts for distance within ±20%", () => {
    expect(mileageFactor(12_000, "mi")).toBe(1);
    expect(mileageFactor(24_000, "mi")).toBeCloseTo(0.8);
    expect(mileageFactor(100_000, "km")).toBeCloseTo(0.8);
    expect(mileageFactor(12_000 * 1.609344, "km")).toBe(1);
    expect(mileageFactor(0, "km")).toBeCloseTo(1.2);
  });

  it("never values a car above its price and rejects bad input", () => {
    const r = carValue({ price: 30_000, years: 0, segment: "truck", condition: "excellent", yearlyDistance: 0, unit: "km" })!;
    expect(r.value).toBe(30_000);
    expect(carValue({ price: 0, years: 3, segment: "average", condition: "good", yearlyDistance: 1, unit: "km" })).toBeNull();
    expect(carValue({ price: 1, years: -1, segment: "average", condition: "good", yearlyDistance: 1, unit: "km" })).toBeNull();
    const five = carValue({ price: 30_000, years: 5, segment: "average", condition: "good", yearlyDistance: 12_000, unit: "mi" })!;
    expect(five.schedule).toHaveLength(11);
    expect(five.value).toBeCloseTo(five.schedule[5]!.value);
    expect(five.lostPct).toBeCloseTo(58.24, 1);
  });
});

describe("net worth", () => {
  it("adds assets, subtracts debts and reads bands", () => {
    const r = netWorth({ cash: 10_000, home: 300_000 }, { mortgage: 250_000, cards: 2_000 });
    expect(r).toEqual({ assets: 310_000, debts: 252_000, netWorth: 58_000, debtToAsset: 252_000 / 310_000 });
    // Signs are kept: an underwater investment lowers assets, a card in credit lowers debts.
    expect(netWorth({ cash: 10_000, investments: -5_000 }, { cards: -200 }).netWorth).toBe(5_200);
    expect(netWorth({}, { studentLoans: 30_000 }).netWorth).toBe(-30_000);
    expect(netWorth({}, {}).debtToAsset).toBeNull();
    expect(ageBand(34)).toBe("under35");
    expect(ageBand(35)).toBe("35to44");
    expect(ageBand(80)).toBe("75plus");
    expect(ageBand(5)).toBeNull();
  });
});

describe("business valuation", () => {
  it("discounts cash flows and adds a Gordon terminal value", () => {
    const r = dcf({ cashFlow: 100, growth: 0, discount: 0.1, terminalGrowth: 0, years: 1 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // Year 1: 100 / 1.1; terminal 100 / 0.1 = 1000, discounted one year.
    expect(r.result.forecastPv).toBeCloseTo(100 / 1.1);
    expect(r.result.terminalPv).toBeCloseTo(1000 / 1.1);
    expect(r.result.value).toBeCloseTo(1000);
    expect(dcf({ cashFlow: 100, growth: 0.05, discount: 0.03, terminalGrowth: 0.03, years: 5 })).toEqual({ ok: false, error: "discountBelowGrowth" });
    expect(dcf({ cashFlow: NaN, growth: 0, discount: 0.1, terminalGrowth: 0, years: 5 })).toEqual({ ok: false, error: "invalid" });
  });

  it("applies multiple ranges", () => {
    expect(multipleRange(100_000, [2, 3])).toEqual([200_000, 300_000]);
    expect(multipleRange(100_000, [3, 2])).toBeNull();
    expect(multipleRange(0, [2, 3])).toBeNull();
  });
});

describe("review fixes", () => {
  it("does not take a +1 number for a Chinese one, nor a valid local number for another market", () => {
    expect(guessMarket("+1 415 555 1234", "intl")).toBe("intl");
    expect(guessMarket("+1 415 555 1234", "cn")).toBe("intl");
    expect(guessMarket("0086 13912345678", "intl")).toBe("cn");
    expect(guessMarket("13912345678", "intl")).toBe("cn");
    expect(guessMarket("0903686868", "intl")).toBe("vn");
    expect(guessMarket("0912345678", "intl", true)).toBe("intl");
    expect(guessMarket("13912345678", "vn")).toBe("cn");
  });

  it("never shows $0 at the bottom of a phone range", () => {
    expect(phone("+1 212 555 3917", "intl").low).toBeGreaterThan(0);
  });

  it("reads a Vietnamese series digit before a 4-digit serial when the plate is written with a separator", () => {
    const old = plate("29B1-8888", "vn");
    expect(old.features).toContainEqual({ key: "tailRun", n: 4, digit: "8" });
    expect(old.tier).toBe(plate("51K-888.88", "vn").tier - 2);
  });

  it("values one-digit domains and ignores hot words with a single extra letter", () => {
    expect(domain("8.com").estimate).toBeGreaterThan(domain("88.com").estimate);
    expect(domain("beta.com").features.some((f) => f.key === "hot")).toBe(false);
    expect(domain("abet.com").features.some((f) => f.key === "hot")).toBe(false);
  });

  it("reads internationalised domains and second-level extensions", () => {
    const idn = domain("例子.com");
    expect(idn.kind).toBe("idn");
    expect(idn.features.some((f) => f.key === "hyphen")).toBe(false);
    expect(domain("tên.vn").sld.startsWith("xn--")).toBe(true);
    expect(decodeIdn("xn--fsqu00a")).toBe("例子");
    expect(domain("example.co.jp").estimate).toBeGreaterThan(domain("example.zz").estimate);
  });

  it("splits a Vietnamese series digit after any separator", () => {
    expect(plate("29B1_8888", "vn").tier).toBe(plate("29B1-8888", "vn").tier);
    expect(plate("29B1・8888", "vn").tier).toBe(plate("29B1-8888", "vn").tier);
  });

  it("survives invalid punycode and counts an IDN's own characters", () => {
    expect(decodeIdn("xn--tm80u")).toBeNull();
    expect(valueDomain("xn--tm80u.com").ok).toBe(true);
    const long = domain("中华人民共和国.com");
    expect(long.features).toContainEqual({ key: "length", n: 7 });
    expect(long.estimate).toBeGreaterThan(10);
  });

  it("reads +84 0… and +86 0…, and keeps Taiwanese plates out of the mainland pattern", () => {
    expect(phoneDigits("+84 0903 686 868", "vn")).toBe("0903686868");
    expect(guessMarket("+84 0903 686 868", "intl")).toBe("vn");
    expect(phoneDigits("+86 0139 1286 8888", "cn")).toBe("13912868888");
    expect(valuePlate("ABC-1234", "cn")).toEqual({ ok: false, error: "invalid" });
    expect(plate("粤B·D12345", "cn").plate).toBe("粤BD12345");
    expect(plate("粤B·12345F", "cn").tier).toBeGreaterThanOrEqual(0);
  });

  it("takes whole forecast years only", () => {
    expect(dcf({ cashFlow: 100, growth: 0, discount: 0.1, terminalGrowth: 0, years: 1.4 })).toEqual({ ok: false, error: "invalid" });
  });

  it("lets distance count only as it adds up", () => {
    expect(mileageFactor(24_000, "mi", 0)).toBe(1);
    expect(mileageFactor(24_000, "mi", 1.5)).toBeCloseTo(0.9);
    const fresh = carValue({ price: 30_000, years: 0, segment: "average", condition: "good", yearlyDistance: 24_000, unit: "mi" })!;
    expect(fresh.value).toBe(30_000);
  });
});
