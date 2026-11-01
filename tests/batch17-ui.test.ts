// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountClickTest, unmountClickTest } from "../src/client/click-test/ui";
import { mountReactionTime, unmountReactionTime } from "../src/client/reaction-time/ui";
import { mountTallyCounter, unmountTallyCounter } from "../src/client/tally-counter/ui";

let host: HTMLElement;

beforeEach(() => {
  vi.useFakeTimers();
  host = document.createElement("div");
  document.body.append(host);
});

afterEach(() => {
  unmountClickTest();
  unmountReactionTime();
  unmountTallyCounter();
  host.remove();
  window.localStorage.clear();
  vi.useRealTimers();
});

const q = <T extends HTMLElement>(sel: string) => host.querySelector<T>(sel)!;
const press = (el: HTMLElement) => el.dispatchEvent(new PointerEvent("pointerdown", { button: 0, bubbles: true }));

describe("click-test ui", () => {
  it("counts clicks until the time runs out and ignores clicks right after", () => {
    mountClickTest(host);
    const pad = q<HTMLButtonElement>("[data-action=pad]");
    for (let i = 0; i < 20; i++) press(pad);
    expect(q("[data-out=clicks]").textContent).toBe("20");
    vi.advanceTimersByTime(5000);
    expect(q(".click-result").textContent).toMatch(/^4\.00 CPS — 20 clicks in 5 s\./);
    press(pad);
    expect(q("[data-out=clicks]").textContent).toBe("20");
    // A held key does not repeat clicks.
    q<HTMLButtonElement>("[data-action=reset]").click();
    pad.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
    pad.dispatchEvent(new KeyboardEvent("keydown", { key: " ", repeat: true, bubbles: true }));
    expect(q("[data-out=clicks]").textContent).toBe("1");
  });
});

describe("reaction-time ui", () => {
  it("rejects a click on red and counts it as too soon", () => {
    mountReactionTime(host);
    const pad = q<HTMLButtonElement>("[data-action=pad]");
    press(pad);
    expect(pad.dataset.state).toBe("waiting");
    press(pad);
    expect(pad.dataset.state).toBe("early");
    expect(host.querySelectorAll(".reaction-list li")).toHaveLength(0);
    press(pad);
    vi.advanceTimersByTime(4600);
    expect(pad.dataset.state).toBe("go");
  });
});

describe("tally-counter ui", () => {
  it("counts with buttons and keys, stops at zero and remembers the counts", () => {
    mountTallyCounter(host);
    const plus = q<HTMLButtonElement>("[data-action=plus]");
    plus.click();
    plus.click();
    q<HTMLButtonElement>("[data-action=minus]").click();
    expect(q("[data-out=count]").textContent).toBe("1");
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
    expect(q("[data-out=count]").textContent).toBe("2");
    for (let i = 0; i < 5; i++) document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    expect(q("[data-out=count]").textContent).toBe("0");
    q<HTMLButtonElement>("[data-action=add]").click();
    const pluses = host.querySelectorAll<HTMLButtonElement>("[data-action=plus]");
    pluses[0].click();
    pluses[1].click();
    pluses[1].click();
    expect(q("[data-out=total]").textContent).toBe("Total: 3");
    unmountTallyCounter();
    host.replaceChildren();
    mountTallyCounter(host);
    expect([...host.querySelectorAll("[data-out=count]")].map((el) => el.textContent)).toEqual(["1", "2"]);
  });

  it("keeps the keyboard on the same counter and leaves other controls and held keys alone", () => {
    mountTallyCounter(host);
    const add = q<HTMLButtonElement>("[data-action=add]");
    add.click();
    add.click();
    const counts = () => [...host.querySelectorAll("[data-out=count]")].map((el) => el.textContent);
    // Highlight the second counter, then remove the first with the mouse: keys still change the same counter.
    host.querySelectorAll<HTMLButtonElement>("[data-action=plus]")[1].click();
    const x = host.querySelectorAll<HTMLButtonElement>("[data-action=remove]")[0];
    press(x);
    x.click();
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
    expect(counts()).toEqual(["2", "0"]);
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: " ", repeat: true, bubbles: true }));
    expect(counts()).toEqual(["2", "0"]);
    const link = document.createElement("a");
    link.href = "#faq";
    document.body.append(link);
    const space = new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true });
    link.dispatchEvent(space);
    expect(space.defaultPrevented).toBe(false);
    expect(counts()).toEqual(["2", "0"]);
    link.remove();
  });

  it("offers to undo a reset for a few seconds", () => {
    mountTallyCounter(host);
    const plus = q<HTMLButtonElement>("[data-action=plus]");
    for (let i = 0; i < 4; i++) plus.click();
    q<HTMLButtonElement>("[data-action=reset-all]").click();
    expect(q("[data-out=count]").textContent).toBe("0");
    const undo = q<HTMLButtonElement>("[data-action=undo]");
    expect(undo.hidden).toBe(false);
    undo.click();
    expect(q("[data-out=count]").textContent).toBe("4");
    expect(undo.hidden).toBe(true);
    q<HTMLButtonElement>("[data-action=reset-all]").click();
    vi.advanceTimersByTime(9000);
    expect(undo.hidden).toBe(true);
  });

  it("undoes only the counters that were reset", () => {
    mountTallyCounter(host);
    q<HTMLButtonElement>("[data-action=add]").click();
    const pluses = () => host.querySelectorAll<HTMLButtonElement>("[data-action=plus]");
    for (let i = 0; i < 5; i++) pluses()[0].click();
    pluses()[1].click();
    const counts = () => [...host.querySelectorAll("[data-out=count]")].map((el) => el.textContent);
    host.querySelectorAll<HTMLButtonElement>("[data-action=reset]")[0].click();
    pluses()[1].click();
    expect(counts()).toEqual(["0", "2"]);
    q<HTMLButtonElement>("[data-action=undo]").click();
    expect(counts()).toEqual(["5", "2"]);
    // A second reset while Undo is offered keeps the first values.
    q<HTMLButtonElement>("[data-action=reset-all]").click();
    q<HTMLButtonElement>("[data-action=reset-all]").click();
    q<HTMLButtonElement>("[data-action=undo]").click();
    expect(counts()).toEqual(["5", "2"]);
  });
});
