// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountConcrete, unmountConcrete } from "../src/client/concrete/ui";
import { mountSlope, unmountSlope } from "../src/client/slope/ui";
import { mountWordUnscrambler, unmountWordUnscrambler } from "../src/client/word-unscrambler/ui";
import { MAX_FUNCS, mountGraphingCalculator, unmountGraphingCalculator } from "../src/client/graphing-calculator/ui";
import { mountPiano, unmountPiano } from "../src/client/piano/ui";

let host: HTMLElement;

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
});

afterEach(() => {
  unmountConcrete();
  unmountSlope();
  unmountWordUnscrambler();
  unmountGraphingCalculator();
  unmountPiano();
  host.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const q = <T extends HTMLElement>(sel: string) => host.querySelector<T>(sel)!;
const set = (sel: string, value: string, event = "input") => {
  const el = q<HTMLInputElement | HTMLSelectElement>(sel);
  el.value = value;
  el.dispatchEvent(new Event(event));
};

describe("concrete ui", () => {
  it("starts with a 10 × 10 ft, 4 in slab in yards and 80 lb bags", () => {
    mountConcrete(host);
    expect(q("[data-out=main]").textContent).toBe("1.3580247 yd³");
    expect(q("[data-out=bags]").textContent).toContain("62");
    expect(q("[data-out=bags]").querySelectorAll("dt")).toHaveLength(3);
  });

  it("converts what was typed when the units change, and explains errors", () => {
    mountConcrete(host);
    set("[data-field=system]", "metric", "change");
    expect(q<HTMLInputElement>("[data-field=length]").value).toBe("3.048");
    expect(q<HTMLInputElement>("[data-field=thickness]").value).toBe("10.16");
    expect(q<HTMLSelectElement>("[data-unit=thickness]").value).toBe("cm");
    expect(q("[data-out=main]").textContent).toBe("1.0382844 m³");
    set("[data-field=shape]", "tube", "change");
    // Every shape starts with a worked example.
    expect(q("[data-out=error]").textContent).toBe("");
    set("[data-field=outer]", "");
    expect(q("[data-out=error]").textContent).toBe("Fill in Outer diameter.");
    set("[data-field=outer]", "30");
    set("[data-field=inner]", "40");
    set("[data-field=height]", "1");
    expect(q("[data-out=error]").textContent).toBe("The inner diameter must be smaller than the outer one.");
    set("[data-field=inner]", "20");
    expect(q("[data-out=error]").textContent).toBe("");
    set("[data-field=waste]", "abc");
    expect(q("[data-out=error]").textContent).toBe("Waste must be a percentage from 0 to 100.");
  });

  it("keeps sizes and units per shape, so a slab's feet are not read as a footing's inches", () => {
    mountConcrete(host);
    set("[data-field=width]", "8");
    set("[data-field=shape]", "footing", "change");
    expect(q<HTMLInputElement>("[data-field=width]").value).toBe("12");
    expect(q<HTMLSelectElement>("[data-unit=width]").value).toBe("in");
    set("[data-field=shape]", "slab", "change");
    expect(q<HTMLInputElement>("[data-field=width]").value).toBe("8");
    expect(q<HTMLSelectElement>("[data-unit=width]").value).toBe("ft");
  });

  it("lets each size have its own unit", () => {
    mountConcrete(host);
    set("[data-unit=thickness]", "ft", "change");
    set("[data-field=thickness]", "1");
    // 10 × 10 × 1 ft = 100 ft³ = 3.7037037 yd³, plus 10%.
    expect(q("[data-out=main]").textContent).toBe("4.0740741 yd³");
  });
});

describe("slope ui", () => {
  it("shows the slope, the forms of the line and the working", () => {
    mountSlope(host);
    expect(q("[data-out=main]").textContent).toBe("m = 2");
    const rows = q("[data-out=rows]").textContent!;
    expect(rows).toContain("y = 2x");
    expect(rows).toContain("y − 2 = 2(x − 1)");
    expect(rows).toContain("2x − y = 0");
    expect(rows).toContain("3√5 ≈ 6.7082039");
    expect(rows).toContain("(5/2, 5)");
    expect(host.querySelectorAll(".slope-graph circle")).toHaveLength(2);
  });

  it("brackets fractional slopes and handles vertical lines and repeats", () => {
    mountSlope(host);
    set("[data-field=x1]", "0");
    set("[data-field=y1]", "1/2");
    set("[data-field=x2]", "3");
    set("[data-field=y2]", "2.5");
    expect(q("[data-out=main]").textContent).toBe("m = 2/3 ≈ 0.66666667");
    expect(q("[data-out=rows]").textContent).toContain("y = (2/3)x + 1/2");
    set("[data-field=x2]", "0");
    expect(q("[data-out=main]").textContent).toBe("Slope is undefined (vertical line)");
    expect(q("[data-out=rows]").textContent).toContain("x = 0");
    set("[data-field=y2]", "0.5");
    expect(q("[data-out=error]").textContent).toBe("The two points are the same. Move one of them to make a line.");
    set("[data-field=y1]", "0");
    set("[data-field=y2]", "0");
    set("[data-field=x2]", "3");
    expect(q("[data-out=rows]").textContent).toContain("Every point (the line is the x-axis)");
    set("[data-field=y2]", "x");
    expect(q("[data-out=error]").textContent).toBe("y₂ must be a number or a fraction such as 3/4.");
  });

  it("swaps the points", () => {
    mountSlope(host);
    q<HTMLButtonElement>("[data-action=swap]").click();
    expect(q<HTMLInputElement>("[data-field=x1]").value).toBe("4");
    expect(q("[data-out=main]").textContent).toBe("m = 2");
  });
});

describe("word unscrambler ui", () => {
  it("loads the word list once and lists words by length with blanks marked", async () => {
    const fetchMock = vi.fn(async () => new Response("act\ncat\ncart\nchat\ntac\ndog\n"));
    vi.stubGlobal("fetch", fetchMock);
    mountWordUnscrambler(host);
    expect(q("[data-out=status]").textContent).toBe("Type some letters to see the words they make.");
    set("[data-field=letters]", "ca?t");
    q<HTMLFormElement>("form").dispatchEvent(new Event("submit"));
    await vi.waitFor(() => expect(q("[data-out=status]").textContent).toBe("5 words found."));
    expect(fetchMock).toHaveBeenCalledWith("/words/enable.txt");
    const groups = host.querySelectorAll("[data-length]");
    expect([...groups].map((g) => g.getAttribute("data-length"))).toEqual(["4", "3"]);
    expect(groups[0].textContent).toContain("Uses every letter");
    expect(host.querySelectorAll(".unscramble-blank")).toHaveLength(2);
    set("[data-field=length]", "3", "change");
    expect(q("[data-out=status]").textContent).toBe("3 words found.");
    set("[data-field=letters]", "a????");
    q<HTMLFormElement>("form").dispatchEvent(new Event("submit"));
    expect(q("[data-out=status]").textContent).toBe("Use at most 3 blanks.");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("graphing calculator ui", () => {
  it("starts with two functions, flags bad input and caps the rows", () => {
    mountGraphingCalculator(host);
    const inputs = host.querySelectorAll<HTMLInputElement>("[data-field=expr]");
    expect([...inputs].map((i) => i.value)).toEqual(["x^2 - 2", "sin(x)"]);
    inputs[0].value = "2 +";
    inputs[0].dispatchEvent(new Event("input"));
    expect(host.querySelector("[data-out=expr-error]")!.textContent).toBe("This cannot be read as a function of x. Check the brackets and operators.");
    for (let i = 0; i < 10; i++) q<HTMLButtonElement>("[data-action=add]").click();
    expect(host.querySelectorAll("[data-field=expr]")).toHaveLength(MAX_FUNCS);
    expect(q<HTMLButtonElement>("[data-action=add]").disabled).toBe(true);
    q<HTMLButtonElement>("[data-action=remove]").click();
    expect(q<HTMLButtonElement>("[data-action=add]").disabled).toBe(false);
  });

  it("lists zeros, intercepts and crossings in view", async () => {
    vi.useFakeTimers();
    mountGraphingCalculator(host);
    vi.advanceTimersByTime(300);
    const text = q("[data-out=points]").textContent!;
    expect(text).toContain("y1 = 0 at (-1.4142136, 0)");
    expect(text).toContain("y1 = 0 at (1.4142136, 0)");
    expect(text).toContain("y1 crosses the y-axis at (0, -2)");
    expect(text).toContain("y1 and y2 cross at");
  });

  it("renames the points when a hidden row is removed, and caps a long list", () => {
    vi.useFakeTimers();
    mountGraphingCalculator(host);
    q<HTMLButtonElement>("[data-action=add]").click();
    const exprs = host.querySelectorAll<HTMLInputElement>("[data-field=expr]");
    exprs[2].value = "x";
    exprs[2].dispatchEvent(new Event("input"));
    host.querySelectorAll<HTMLInputElement>("[data-field=show]")[1].click();
    vi.advanceTimersByTime(300);
    expect(q("[data-out=points]").textContent).toContain("y1 and y3 cross");
    host.querySelectorAll<HTMLButtonElement>("[data-action=remove]")[1].click();
    vi.advanceTimersByTime(300);
    expect(q("[data-out=points]").textContent).toContain("y1 and y2 cross");
    exprs[0].value = "sin(20x)";
    exprs[0].dispatchEvent(new Event("input"));
    vi.advanceTimersByTime(300);
    expect(q("[data-out=more-points]").textContent).toMatch(/more in this view/);
  });
});

describe("piano ui", () => {
  class FakeParam {
    value = 0;
    setValueAtTime() { return this; }
    linearRampToValueAtTime() { return this; }
    setTargetAtTime() { return this; }
    cancelScheduledValues() { return this; }
  }
  class FakeNode {
    gain = new FakeParam();
    frequency = new FakeParam();
    Q = new FakeParam();
    threshold = new FakeParam();
    ratio = new FakeParam();
    type = "";
    connect(n: unknown) { return n; }
    disconnect() {}
    start() {}
    stop() {}
  }
  class FakeContext {
    state = "running";
    currentTime = 0;
    destination = new FakeNode();
    static made = 0;
    constructor() { FakeContext.made++; }
    createGain() { return new FakeNode(); }
    createOscillator() { return new FakeNode(); }
    createBiquadFilter() { return new FakeNode(); }
    createDynamicsCompressor() { return new FakeNode(); }
    resume() { return Promise.resolve(); }
    close() { return Promise.resolve(); }
  }

  it("plays notes from the computer keyboard and records a take", () => {
    vi.stubGlobal("AudioContext", FakeContext);
    mountPiano(host);
    expect(host.querySelectorAll(".piano-key.white")).toHaveLength(15);
    expect(q("[data-out=range]").textContent).toBe("C3 – C5");
    q<HTMLButtonElement>("[data-action=record]").click();
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyQ" }));
    expect(q('[data-midi="60"]').classList.contains("down")).toBe(true);
    expect(FakeContext.made).toBe(1);
    window.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyQ" }));
    expect(q('[data-midi="60"]').classList.contains("down")).toBe(false);
    q<HTMLButtonElement>("[data-action=record]").click();
    expect(q("[data-out=status]").textContent).toMatch(/^1 notes recorded/);
    expect(q<HTMLButtonElement>("[data-action=play]").disabled).toBe(false);
    q<HTMLButtonElement>("[data-action=clear]").click();
    expect(q("[data-out=status]").textContent).toBe("Nothing recorded yet.");
  });

  it("records a note held by the pedal until the pedal lifts, and does not draw it pressed", () => {
    vi.stubGlobal("AudioContext", FakeContext);
    mountPiano(host);
    q<HTMLButtonElement>("[data-action=record]").click();
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" }));
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyQ" }));
    window.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyQ" }));
    set("[data-field=labels]", "keys", "change");
    expect(q('[data-midi="60"]').classList.contains("down")).toBe(false);
    window.dispatchEvent(new KeyboardEvent("keyup", { code: "Space" }));
    q<HTMLButtonElement>("[data-action=record]").click();
    expect(q("[data-out=status]").textContent).toMatch(/^1 notes recorded/);
  });

  it("moves the keyboard by octaves and labels keys", () => {
    vi.stubGlobal("AudioContext", FakeContext);
    mountPiano(host);
    q<HTMLButtonElement>("[data-action=octave-up]").click();
    expect(q("[data-out=range]").textContent).toBe("C4 – C6");
    for (let i = 0; i < 8; i++) q<HTMLButtonElement>("[data-action=octave-down]").click();
    // The 88-key piano starts at A0.
    expect(q("[data-out=range]").textContent).toBe("A0 – C2");
    for (let i = 0; i < 4; i++) q<HTMLButtonElement>("[data-action=octave-up]").click();
    set("[data-field=labels]", "keys", "change");
    expect(q("[data-out=range]").textContent).toBe("C4 – C6");
    expect(q('[data-midi="60"]').textContent).toBe("Z");
    expect(q('[data-midi="72"]').textContent).toBe("Q");
  });
});
