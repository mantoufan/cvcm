// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clock, mountSudoku, unmountSudoku } from "../src/client/sudoku/ui";
import { mountTicTacToe, unmountTicTacToe } from "../src/client/tic-tac-toe/ui";
import { mountColorBlindnessTest, unmountColorBlindnessTest } from "../src/client/color-blindness-test/ui";
import { mountMilitaryTime, unmountMilitaryTime } from "../src/client/military-time/ui";
import { mountHeight, unmountHeight } from "../src/client/height-calculator/ui";
import { generate } from "../src/shared/sudoku";
import { makeTest } from "../src/shared/color-vision";

let host: HTMLElement;

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  window.localStorage.clear();
});

afterEach(() => {
  unmountSudoku();
  unmountTicTacToe();
  unmountColorBlindnessTest();
  unmountMilitaryTime();
  unmountHeight();
  host.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const q = <T extends HTMLElement>(sel: string) => host.querySelector<T>(sel)!;
const set = (sel: string, value: string, event = "input") => {
  const el = q<HTMLInputElement | HTMLSelectElement>(sel);
  el.value = value;
  el.dispatchEvent(new Event(event));
};
const key = (el: Element, k: string, code = "") => el.dispatchEvent(new KeyboardEvent("keydown", { key: k, code, bubbles: true }));

describe("sudoku ui", () => {
  it("starts on the fixed medium puzzle with its clues", () => {
    mountSudoku(host);
    const p = generate(2027, "medium");
    const cells = host.querySelectorAll<HTMLButtonElement>("[data-cell]");
    expect(cells).toHaveLength(81);
    expect(q("[data-out=number]").textContent).toBe("Puzzle #2027");
    p.clues.forEach((d, i) => {
      expect(cells[i]!.textContent).toBe(d ? String(d) : "");
      expect(cells[i]!.classList.contains("given")).toBe(!!d);
    });
    expect(q("[data-out=status]").textContent).toBe(`${p.clues.filter(Boolean).length} of 81 cells filled`);
  });

  it("enters digits and notes, marks clashes and mistakes, undoes and saves", () => {
    mountSudoku(host);
    const p = generate(2027, "medium");
    const empty = p.clues.findIndex((d) => !d);
    const cell = q<HTMLButtonElement>(`[data-cell="${empty}"]`);
    cell.click();
    expect(cell.classList.contains("sel")).toBe(true);
    const right = p.solution[empty]!;
    const wrong = right === 9 ? 8 : right + 1;
    key(cell, String(wrong), `Digit${wrong}`);
    expect(cell.textContent).toBe(String(wrong));
    q<HTMLInputElement>("[data-field=mistakes]").click();
    expect(cell.classList.contains("wrong")).toBe(true);
    key(cell, "Backspace");
    expect(cell.textContent).toBe("");
    q<HTMLButtonElement>("[data-action=notes]").click();
    expect(q("[data-action=notes]").getAttribute("aria-pressed")).toBe("true");
    q<HTMLButtonElement>('[data-digit="1"]').click();
    q<HTMLButtonElement>('[data-digit="2"]').click();
    expect(cell.querySelectorAll(".sudoku-notes span")[1]!.textContent).toBe("2");
    q<HTMLButtonElement>("[data-action=undo]").click();
    expect(cell.querySelectorAll(".sudoku-notes span")[1]!.textContent).toBe("");
    key(cell, "n");
    key(cell, String(right), `Digit${right}`);
    expect(cell.textContent).toBe(String(right));
    const saved = JSON.parse(window.localStorage.getItem("cvcm.sudoku.v1")!);
    expect(saved).toMatchObject({ seed: 2027, level: "medium" });
    expect(saved.cells[empty]).toBe(right);
    // A placed digit clears it from its peers' notes; clues never change.
    const given = p.clues.findIndex(Boolean);
    q<HTMLButtonElement>(`[data-cell="${given}"]`).click();
    key(q(`[data-cell="${given}"]`), "Backspace");
    expect(q(`[data-cell="${given}"]`).textContent).toBe(String(p.clues[given]));
  });

  it("moves with the arrow keys and fills a cell with Hint", () => {
    mountSudoku(host);
    const p = generate(2027, "medium");
    q<HTMLButtonElement>('[data-cell="0"]').click();
    key(q('[data-cell="0"]'), "ArrowRight");
    expect(q('[data-cell="1"]').classList.contains("sel")).toBe(true);
    key(q('[data-cell="1"]'), "ArrowUp");
    expect(q('[data-cell="73"]').classList.contains("sel")).toBe(true);
    const empty = p.clues.findIndex((d) => !d);
    q<HTMLButtonElement>(`[data-cell="${empty}"]`).click();
    q<HTMLButtonElement>("[data-action=hint]").click();
    expect(q(`[data-cell="${empty}"]`).textContent).toBe(String(p.solution[empty]));
  });

  it("reports a solved grid and restores a saved game", () => {
    const p = generate(2027, "medium");
    const cells = p.solution.slice();
    const last = p.clues.findIndex((d) => !d);
    cells[last] = 0;
    window.localStorage.setItem("cvcm.sudoku.v1", JSON.stringify({ seed: 2027, level: "medium", cells, notes: new Array(81).fill(0), elapsed: 65, hints: 0 }));
    mountSudoku(host);
    expect(q("[data-out=time]").textContent).toBe("1:05");
    q<HTMLButtonElement>(`[data-cell="${last}"]`).click();
    q<HTMLButtonElement>(`[data-digit="${p.solution[last]}"]`).click();
    expect(q("[data-out=status]").textContent).toBe("Solved in 1:05!");
    expect(clock(3725)).toBe("1:02:05");
  });

  it("starts a new puzzle of the chosen level", () => {
    mountSudoku(host);
    set("[data-field=level]", "easy", "change");
    const n = Number(q("[data-out=number]").textContent!.replace(/\D/g, ""));
    const p = generate(n, "easy");
    const cells = host.querySelectorAll<HTMLButtonElement>("[data-cell]");
    p.clues.forEach((d, i) => expect(cells[i]!.textContent).toBe(d ? String(d) : ""));
  });
});

describe("tic-tac-toe ui", () => {
  it("plays against the hard computer, which answers a corner with the centre", () => {
    vi.useFakeTimers();
    mountTicTacToe(host);
    expect(q("[data-out=status]").textContent).toBe("Your turn (X).");
    q<HTMLButtonElement>('[data-cell="0"]').click();
    expect(q("[data-out=status]").textContent).toBe("The computer is thinking…");
    expect(q<HTMLButtonElement>('[data-cell="1"]').disabled).toBe(true);
    vi.advanceTimersByTime(400);
    expect(q('[data-cell="4"]').textContent).toBe("O");
    expect(q<HTMLButtonElement>('[data-cell="1"]').disabled).toBe(false);
  });

  it("lets two players take turns and counts the win", () => {
    mountTicTacToe(host);
    set("[data-field=mode]", "friend", "change");
    expect((q("[data-field=level]").closest("label") as HTMLElement).hidden).toBe(true);
    for (const i of [0, 3, 1, 4, 2]) q<HTMLButtonElement>(`[data-cell="${i}"]`).click();
    expect(q("[data-out=status]").textContent).toBe("X wins!");
    expect([...host.querySelectorAll(".ttt-cell.win")].map((c) => c.getAttribute("data-cell"))).toEqual(["0", "1", "2"]);
    expect(q("[data-out=score]").textContent).toContain("X (X)1");
    q<HTMLButtonElement>("[data-action=new]").click();
    expect(q('[data-cell="0"]').textContent).toBe("");
    expect(q("[data-out=score]").textContent).toContain("X (X)1");
  });

  it("lets the computer start when you play O", () => {
    vi.useFakeTimers();
    mountTicTacToe(host);
    set("[data-field=side]", "O", "change");
    vi.advanceTimersByTime(400);
    expect([...host.querySelectorAll(".ttt-cell")].filter((c) => c.textContent === "X")).toHaveLength(1);
  });
});

describe("colour blindness test ui", () => {
  it("shows the check plate first and walks through all 13", () => {
    mountColorBlindnessTest(host);
    const test = makeTest(1);
    expect(q("[data-out=progress]").textContent).toBe("Plate 1 of 13");
    expect(host.querySelectorAll(".cv-plate circle")).toHaveLength(test[0]!.dots.length);
    q<HTMLButtonElement>("[data-action=next]").click();
    expect(q("[data-out=error]").textContent).toBe("Type the one- or two-digit number, or tap I see no number.");
    test.forEach((p, i) => {
      if (p.kind === "deutan") q<HTMLButtonElement>("[data-action=none]").click();
      else {
        set("[data-field=answer]", i === 1 ? String(p.number).replace(/\d/g, (d) => String.fromCharCode(0xff10 + Number(d))) : String(p.number));
        q<HTMLButtonElement>("[data-action=next]").click();
      }
    });
    expect(q("[data-out=progress]").textContent).toBe("Test finished");
    expect(q("[data-out=summary]").textContent).toBe("Signs of a strong green (deutan) colour deficiency.");
    expect(q("[data-out=scores]").textContent).toContain("0 of 4 right");
    expect(host.querySelectorAll("[data-out=review] tbody tr")).toHaveLength(13);
    expect(q<HTMLElement>("[data-out=form]").hidden).toBe(true);
    q<HTMLButtonElement>("[data-action=retake]").click();
    expect(q("[data-out=progress]").textContent).toBe("Plate 1 of 13");
    expect(q<HTMLElement>("[data-out=result]").hidden).toBe(true);
  });

  it("asks to check the screen when the check plate is missed", () => {
    mountColorBlindnessTest(host);
    for (let i = 0; i < 13; i++) q<HTMLButtonElement>("[data-action=none]").click();
    expect(q("[data-out=summary]").textContent).toContain("The first plate, which everyone should read, was missed.");
  });
});

describe("military time ui", () => {
  it("converts both ways and lists the chart", () => {
    mountMilitaryTime(host);
    expect(q("[data-out=main]").textContent).toBe("1430 = 2:30 PM");
    expect(q("[data-out=rows]").textContent).toContain("fourteen thirty hours");
    set("[data-field=time]", "7:05 pm");
    expect(q("[data-out=main]").textContent).toBe("1905 = 7:05 PM");
    set("[data-field=time]", "2400");
    expect(q("[data-out=rows]").textContent).toContain("12:00 AM (end of the day)");
    set("[data-field=time]", "25:00");
    expect(q("[data-out=error]").textContent).toBe("That is not a time. Try 1430, 14:30 or 2:30 pm.");
    set("[data-field=time]", "");
    expect(q("[data-out=error]").textContent).toBe("Type a time.");
    q<HTMLButtonElement>('[data-preset="0000"]').click();
    expect(q("[data-out=main]").textContent).toBe("0000 = 12:00 AM");
    expect(host.querySelectorAll("[data-out=chart] tbody tr")).toHaveLength(12);
    expect(q("[data-out=now-zulu]").textContent).toMatch(/^\d{4}Z$/);
  });
});

describe("height calculator ui", () => {
  it("starts in feet and inches in English with both estimates", () => {
    mountHeight(host);
    expect(q<HTMLSelectElement>("[data-field=system]").value).toBe("imperial");
    expect(q<HTMLInputElement>("[data-field=father-ft]").value).toBe("5");
    expect(q<HTMLInputElement>("[data-field=father-in]").value).toBe("10.1");
    const rows = q("[data-out=rows]").textContent!;
    expect(rows).toContain("5 ft 10.1 in (178 cm)");
    expect(q("[data-out=main]").textContent).toMatch(/^Predicted adult height: 5 ft 10\.1 in from the parents, 5 ft \d+(\.\d)? in from the growth chart$/);
  });

  it("switches to centimetres keeping the values, and explains bad input", () => {
    mountHeight(host);
    set("[data-field=system]", "metric", "change");
    expect(q<HTMLInputElement>("[data-field=father-cm]").value).toBe("178");
    expect(q<HTMLInputElement>("[data-field=child-cm]").value).toBe("138");
    set("[data-field=child-cm]", "");
    expect(q("[data-out=main]").textContent).toBe("Predicted adult height: 178 cm (5 ft 10.1 in)");
    set("[data-field=sex]", "girl", "change");
    expect(q("[data-out=main]").textContent).toBe("Predicted adult height: 165 cm (5 ft 5 in)");
    set("[data-field=mother-cm]", "16.5");
    expect(q("[data-out=error]").textContent).toBe("Mother's height must be between 120 cm and 230 cm.");
    set("[data-field=mother-cm]", "");
    expect(q("[data-out=error]").textContent).toBe("Enter both parents' heights.");
    set("[data-field=mother-cm]", "165");
    set("[data-field=child-cm]", "120");
    set("[data-field=years]", "1");
    expect(q("[data-out=error]").textContent).toBe("Age must be between 2 and 20 years, with months from 0 to 11.");
    set("[data-field=years]", "7");
    expect(q("[data-out=error]").textContent).toBe("");
    expect(q("[data-out=rows]").textContent).toContain("Percentile now");
  });
});
