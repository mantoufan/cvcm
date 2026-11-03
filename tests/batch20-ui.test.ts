// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountCoinFlip, unmountCoinFlip } from "../src/client/coin-flip/ui";
import { mountGuitarTuner, unmountGuitarTuner } from "../src/client/guitar-tuner/ui";
import { mountFactors, unmountFactors } from "../src/client/factors/ui";
import { mountLcmGcf, unmountLcmGcf } from "../src/client/lcm-gcf/ui";

let host: HTMLElement;

beforeEach(() => {
  vi.useFakeTimers();
  host = document.createElement("div");
  document.body.append(host);
});

afterEach(() => {
  unmountCoinFlip();
  unmountGuitarTuner();
  unmountFactors();
  unmountLcmGcf();
  host.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const q = <T extends HTMLElement>(sel: string) => host.querySelector<T>(sel)!;

describe("coin-flip ui", () => {
  it("flips after the spin and counts 100 coins at once", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    mountCoinFlip(host);
    q<HTMLButtonElement>("[data-action=flip]").click();
    expect(q("[data-out=result]").textContent).toBe("Flipping…");
    vi.advanceTimersByTime(800);
    expect(q("[data-out=result]").textContent).toMatch(/^(Heads|Tails)!$/);
    const count = q<HTMLSelectElement>("[data-field=count]");
    count.value = "100";
    q<HTMLButtonElement>("[data-action=flip]").click();
    vi.advanceTimersByTime(800);
    expect(q("[data-out=stats]").textContent).toContain("Total coins101");
    q<HTMLButtonElement>("[data-action=reset]").click();
    expect(q("[data-out=history]").textContent).toBe("No flips yet.");
  });
});

describe("guitar-tuner ui", () => {
  it("lists the strings of the picked tuning without touching the microphone", () => {
    mountGuitarTuner(host);
    const strings = () => Array.from(host.querySelectorAll("[data-out=strings] button")).map((b) => b.textContent);
    expect(strings()).toEqual(["Auto", "E2", "A2", "D3", "G3", "B3", "E4"]);
    // Picking a string marks it in place: the clicked button stays in the page (keyboard focus is kept).
    const a2 = q<HTMLButtonElement>("[data-string='45']");
    a2.click();
    expect(a2.isConnected).toBe(true);
    expect(a2.getAttribute("aria-pressed")).toBe("true");
    expect(q("[data-string=auto]").getAttribute("aria-pressed")).toBe("false");
    const tuning = q<HTMLSelectElement>("[data-field=tuning]");
    tuning.value = "guitar-half-down";
    tuning.dispatchEvent(new Event("change"));
    expect(strings()).toEqual(["Auto", "E♭2", "A♭2", "D♭3", "G♭3", "B♭3", "E♭4"]);
    tuning.value = "chromatic";
    tuning.dispatchEvent(new Event("change"));
    expect(strings()).toEqual([]);
    expect(q("[data-out=status]").textContent).toMatch(/Start tuner/);
  });
});

describe("factors ui", () => {
  it("factors the default and flags primes", () => {
    mountFactors(host);
    expect(q("[data-out=verdict]").textContent).toBe("360 is not prime (it is composite).");
    expect(q("[data-out=result]").textContent).toContain("2³ × 3² × 5");
    expect(q("[data-out=result]").textContent).toContain("Number of divisors24");
    q<HTMLButtonElement>("[data-example='97']").click();
    expect(q("[data-out=verdict]").textContent).toBe("97 is a prime number.");
    expect(q("[data-out=pairs]").textContent).toBe("1 × 97");
    const input = q<HTMLInputElement>("[data-field=number]");
    input.value = "4.5";
    input.dispatchEvent(new Event("input"));
    expect(q("[data-out=verdict]").textContent).toBe("Use digits only, without decimals.");
  });
});

describe("lcm-gcf ui", () => {
  it("finds the GCF and LCM with the working", () => {
    mountLcmGcf(host);
    expect(q("[data-out=result]").textContent).toBe("Greatest common factor (GCF)6Least common multiple (LCM)180");
    expect(q("[data-out=primes]").textContent).toContain("LCM = 2² × 3² × 5 = 180");
    q<HTMLButtonElement>("[data-example='48, 36']").click();
    expect(q("[data-out=euclid]").textContent).toContain("48 = 1 × 36 + 12");
    const input = q<HTMLTextAreaElement>("[data-field=numbers]");
    input.value = "12, x";
    input.dispatchEvent(new Event("input"));
    vi.advanceTimersByTime(200);
    expect(q("[data-out=error]").textContent).toBe("Not a positive whole number: x");
    input.value = "12, x, 1234567890123456789";
    input.dispatchEvent(new Event("input"));
    vi.advanceTimersByTime(200);
    expect(q("[data-out=error]").textContent).toBe("Each number can have up to 18 digits. Not a positive whole number: x");
    input.value = "1,500, 2,500";
    input.dispatchEvent(new Event("input"));
    vi.advanceTimersByTime(200);
    expect(q("[data-out=error]").textContent).toMatch(/^Commas separate numbers/);
  });
});
