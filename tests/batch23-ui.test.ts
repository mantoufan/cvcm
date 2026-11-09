// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountMortgage, unmountMortgage } from "../src/client/mortgage/ui";
import { mountQuadratic, unmountQuadratic } from "../src/client/quadratic/ui";
import { mountTeamGenerator, unmountTeamGenerator } from "../src/client/team-generator/ui";
import { mountScreenResolution, unmountScreenResolution } from "../src/client/screen-resolution/ui";
import { mountAlarm, unmountAlarm } from "../src/client/alarm/ui";

let host: HTMLElement;

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
});

afterEach(() => {
  unmountMortgage();
  unmountQuadratic();
  unmountTeamGenerator();
  unmountScreenResolution();
  unmountAlarm();
  host.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const q = <T extends HTMLElement>(sel: string) => host.querySelector<T>(sel)!;
const set = (sel: string, value: string, event = "input") => {
  const el = q<HTMLInputElement | HTMLSelectElement>(sel);
  el.value = value;
  el.dispatchEvent(new Event(event));
};

describe("mortgage ui", () => {
  it("shows the payment, switches method and lists every year", () => {
    mountMortgage(host);
    expect(q("[data-out=result]").textContent).toContain("2,022.62");
    expect(host.querySelectorAll("[data-out=schedule] tbody tr")).toHaveLength(30);
    set("[data-field=method]", "principal", "change");
    expect(q("[data-out=result]").textContent).toContain("2,622.22");
    expect(q("[data-out=result]").textContent).toContain("893.70");
    set("[data-field=years]", "0");
    expect(q("[data-out=error]").textContent).not.toBe("");
    expect(q("[data-out=schedule]").childElementCount).toBe(0);
  });
});

describe("quadratic ui", () => {
  it("solves, factors and draws", () => {
    mountQuadratic(host);
    expect(q("[data-out=equation]").textContent).toBe("x² − 3x + 2 = 0");
    expect(q("[data-out=result]").textContent).toContain("(x − 1)(x − 2) = 0");
    expect(host.querySelectorAll("[data-out=graph] .quad-root")).toHaveLength(2);
    q<HTMLButtonElement>("[data-example='1,2,5']").click();
    expect(q("[data-out=result]").textContent).toContain("−1 ± 2i");
    expect(host.querySelectorAll("[data-out=graph] .quad-root")).toHaveLength(0);
    set("[data-field=a]", "0");
    expect(q("[data-out=error]").textContent).toContain("x = −2.5");
    set("[data-field=b]", "");
    set("[data-field=c]", "");
    expect(q("[data-out=error]").textContent).toContain("no x");
  });
});

describe("team generator ui", () => {
  it("previews the split and only draws on Generate", () => {
    mountTeamGenerator(host);
    expect(q("[data-out=count]").textContent).toBe("12 names → 3 teams of 4");
    expect(host.querySelectorAll("[data-out=teams] li strong")).toHaveLength(0);
    set("[data-field=mode]", "size", "change");
    set("[data-field=value]", "5");
    expect(q("[data-out=count]").textContent).toBe("12 names → 3 teams of 4");
    set("[data-field=value]", "7");
    expect(q("[data-out=count]").textContent).toBe("12 names → 2 teams of 6");
    q<HTMLButtonElement>("[data-action=generate]").click();
    const teams = host.querySelectorAll("[data-out=teams] li");
    expect(teams).toHaveLength(2);
    const names = Array.from(host.querySelectorAll(".team-names")).flatMap((el) => el.textContent!.split(", "));
    expect(names.sort()).toEqual(["Alex", "Ben", "Chloe", "Daniel", "Emma", "Finn", "Grace", "Henry", "Ivy", "Jack", "Kate", "Leo"]);
    set("[data-field=names]", "Solo");
    q<HTMLButtonElement>("[data-action=generate]").click();
    expect(q("[data-out=error]").textContent).toBe("Add at least two names.");
  });
});

describe("screen resolution ui", () => {
  it("reports real pixels from CSS size and pixel ratio", () => {
    vi.stubGlobal("devicePixelRatio", 1.25);
    vi.stubGlobal("screen", { width: 1536, height: 864, availWidth: 1536, availHeight: 824, colorDepth: 24 });
    mountScreenResolution(host);
    expect(q("[data-out=resolution]").textContent).toBe("1920 × 1080");
    const details = q("[data-out=details]").textContent!;
    expect(details).toContain("Full HD (1080p)");
    expect(details).toContain("1.25 (125%)");
    expect(details).toContain("16:9");
    expect(details).toContain("24-bit");
  });
});

describe("alarm ui", () => {
  it("counts down, rings, snoozes and stops", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 9, 23, 30, 0));
    mountAlarm(host);
    expect(q("[data-out=status]").textContent).toBe("No alarm set.");
    q<HTMLButtonElement>("[data-action=set]").click();
    expect(q("[data-out=status]").textContent).toContain("rings in 7 h 30 min");
    expect(q("[data-action=set]").textContent).toBe("Cancel alarm");
    // Jump the wall clock to just before 07:00 rather than running 100,000 ticks.
    vi.setSystemTime(new Date(2026, 10, 10, 6, 59, 59));
    vi.advanceTimersByTime(1500);
    expect(q<HTMLElement>("[data-out=ring]").hidden).toBe(false);
    expect(document.title.startsWith("⏰")).toBe(true);
    q<HTMLButtonElement>("[data-action=snooze-5]").click();
    expect(q<HTMLElement>("[data-out=ring]").hidden).toBe(true);
    expect(q("[data-out=status]").textContent).toContain("0 h 5 min");
    vi.setSystemTime(Date.now() + 5 * 60 * 1000 - 500);
    vi.advanceTimersByTime(1000);
    expect(q<HTMLElement>("[data-out=ring]").hidden).toBe(false);
    q<HTMLButtonElement>("[data-action=stop]").click();
    expect(q("[data-out=status]").textContent).toBe("No alarm set.");
    expect(document.title.startsWith("⏰")).toBe(false);
  });

  it("stops by itself after ten minutes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 9, 6, 59, 0));
    mountAlarm(host);
    q<HTMLButtonElement>("[data-action=set]").click();
    vi.advanceTimersByTime(60_500);
    expect(q<HTMLElement>("[data-out=ring]").hidden).toBe(false);
    vi.setSystemTime(Date.now() + 10 * 60_000);
    vi.advanceTimersByTime(500);
    expect(q("[data-out=status]").textContent).toContain("10 minutes");
    expect(q<HTMLElement>("[data-out=ring]").hidden).toBe(true);
  });
});
