// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { mountFuelCost, unmountFuelCost } from "../src/client/fuel-cost/ui";
import { mountDueDate, unmountDueDate } from "../src/client/due-date/ui";
import { mountReadingTime, unmountReadingTime } from "../src/client/reading-time/ui";

const q = <T extends Element>(host: Element, sel: string) => host.querySelector(sel) as unknown as T;
const dds = (host: Element) => [...host.querySelectorAll("dd")].map((d) => d.textContent);
function change(el: HTMLInputElement | HTMLSelectElement, value: string, ev = "change") {
  el.value = value;
  el.dispatchEvent(new Event(ev, { bubbles: true }));
}

describe("due date, fuel cost and reading time UI", () => {
  it("fuel cost unit switches round-trip without drift", () => {
    const host = document.createElement("div");
    mountFuelCost(host);
    const dist = q<HTMLInputElement>(host, "[data-field=distance]");
    const du = q<HTMLSelectElement>(host, "[data-field=distanceUnit]");
    const eu = q<HTMLSelectElement>(host, "[data-field=economyUnit]");
    const pu = q<HTMLSelectElement>(host, "[data-field=priceUnit]");
    change(dist, "0.33", "input");
    const before = dds(host)[0];
    for (let i = 0; i < 5; i++) { change(du, "mi"); change(du, "km"); }
    expect(dist.value).toBe("0.3");
    expect(dds(host)[0]).toBe(before);
    change(eu, "mpg"); change(pu, "gal");
    expect(dds(host)[0]).toBe(before);
    expect(dds(host)[1]).toMatch(/gal/);
    change(eu, "l100km"); change(pu, "l");
    expect(dds(host)[0]).toBe(before);
    unmountFuelCost();
  });

  it("due date mode switch keeps the same pregnancy, even with a blank cycle", () => {
    const host = document.createElement("div");
    mountDueDate(host);
    const date = q<HTMLInputElement>(host, "[data-field=date]");
    const mode = q<HTMLSelectElement>(host, "[data-field=mode]");
    const cycle = q<HTMLInputElement>(host, "[data-field=cycle]");
    change(date, "2026-01-01", "input");
    const due = dds(host)[0];
    change(cycle, "", "input");
    change(mode, "due");
    expect(date.value).toBe("2026-10-08");
    expect(dds(host)[0]).toBe(due);
    change(mode, "conception");
    expect(date.value).toBe("2026-01-15");
    expect(dds(host)[0]).toBe(due);
    unmountDueDate();
  });

  it("reading time shows both counts for mixed text", () => {
    const host = document.createElement("div");
    mountReadingTime(host);
    change(q<HTMLTextAreaElement>(host, "[data-field=text]") as unknown as HTMLInputElement, "你好世界 hello there friend", "input");
    const labels = [...host.querySelectorAll("dt")].map((d) => d.textContent ?? "");
    const values = dds(host);
    const at = (re: RegExp) => values[labels.findIndex((l) => re.test(l))];
    expect(at(/words$/i)).toBe("3");
    expect(at(/cjkChars$|CJK/)).toBe("4");
    unmountReadingTime();
  });
});
