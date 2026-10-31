// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountWheel, unmountWheel } from "../src/client/wheel/ui";

let host: HTMLElement;

beforeEach(() => {
  vi.useFakeTimers();
  host = document.createElement("div");
  document.body.append(host);
  mountWheel(host);
});

afterEach(() => {
  unmountWheel();
  host.remove();
  vi.useRealTimers();
});

const field = <T extends HTMLElement>(sel: string) => host.querySelector<T>(sel)!;
const history = () => [...host.querySelectorAll(".wheel-history li")].map((li) => li.textContent);

function setList(text: string): void {
  const ta = field<HTMLTextAreaElement>("textarea");
  ta.value = text;
  ta.dispatchEvent(new Event("input"));
}

function spin(times: number): void {
  for (let i = 0; i < times; i++) {
    field<HTMLButtonElement>("[data-action=spin]").click();
    vi.advanceTimersByTime(5000);
  }
}

describe("wheel history", () => {
  it("lists draws in order and completes an elimination with the last name", () => {
    setList("A\nB\nC\nD\nE");
    const box = field<HTMLInputElement>("[data-field=remove]");
    box.checked = true;
    box.dispatchEvent(new Event("change"));
    spin(4);
    const order = history();
    expect(order).toHaveLength(5);
    expect(new Set(order)).toEqual(new Set(["A", "B", "C", "D", "E"]));
    expect(field<HTMLTextAreaElement>("textarea").value).toBe(order[4]);
    expect(field(".wheel-winner").textContent).toContain(`Last place: ${order[4]}`);
    expect(field<HTMLButtonElement>("[data-action=spin]").disabled).toBe(true);
    // A new list after a finished round starts a new order.
    setList("X\nY");
    spin(1);
    expect(history()).toHaveLength(2);
    expect(new Set(history())).toEqual(new Set(["X", "Y"]));
  });

  it("removes every copy of a winner during an elimination", () => {
    setList("A\nA\nB");
    const box = field<HTMLInputElement>("[data-field=remove]");
    box.checked = true;
    box.dispatchEvent(new Event("change"));
    spin(1);
    expect(new Set(history())).toEqual(new Set(["A", "B"]));
    expect(history()).toHaveLength(2);
  });

  it("starts fresh when remove-winner is ticked", () => {
    spin(2);
    expect(history()).toHaveLength(2);
    const box = field<HTMLInputElement>("[data-field=remove]");
    box.checked = true;
    box.dispatchEvent(new Event("change"));
    expect(history()).toEqual([]);
    expect(field(".wheel-winner").textContent).toBe("");
  });
});
