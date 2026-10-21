// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { mountQuiz, mountQuizHub } from "../src/client/quiz/ui";
import { QUIZZES } from "../src/shared/quiz";

function mount(id: Parameters<typeof mountQuiz>[2], locale: Parameters<typeof mountQuiz>[1] = "en"): HTMLElement {
  document.body.innerHTML = "";
  const main = document.createElement("main");
  document.body.append(main);
  mountQuiz(main, locale, id);
  return main;
}

function answer(main: HTMLElement, pick: (i: number) => number): void {
  main.querySelectorAll(".quiz-q").forEach((q, i) => {
    const input = q.querySelectorAll<HTMLInputElement>("input")[pick(i)];
    input.checked = true;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function submit(main: HTMLElement): void {
  main.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
}

describe("test page UI", () => {
  it("asks for the missing answers before scoring", () => {
    const main = mount("anxiety");
    const first = main.querySelector<HTMLInputElement>(".quiz-q input")!;
    first.checked = true;
    first.dispatchEvent(new Event("change", { bubbles: true }));
    submit(main);
    expect(main.querySelector(".quiz-note")!.textContent).toContain("6 left");
    expect(main.querySelectorAll(".quiz-q.need")).toHaveLength(6);
    expect(main.querySelector<HTMLElement>("#result")!.hidden).toBe(true);
  });

  it("shows the PHQ-9 help box when item 9 is answered, even with a low total", () => {
    const main = mount("depression", "zh-CN");
    answer(main, (i) => (i === 8 ? 1 : 0));
    submit(main);
    const result = main.querySelector<HTMLElement>("#result")!;
    expect(result.hidden).toBe(false);
    expect(result.querySelector(".quiz-crisis")?.textContent).toContain("12356");
    expect(result.textContent).toContain("1 / 27");
  });

  it("updates a shown result when an answer changes", () => {
    const main = mount("depression");
    answer(main, () => 0);
    submit(main);
    expect(main.querySelector(".quiz-crisis")).toBeNull();
    const item9 = main.querySelectorAll(".quiz-q")[8].querySelectorAll<HTMLInputElement>("input")[2];
    item9.checked = true;
    item9.dispatchEvent(new Event("change", { bubbles: true }));
    expect(main.querySelector(".quiz-crisis")).not.toBeNull();
    expect(main.querySelector("#result")!.textContent).toContain("2 / 27");
    expect(main.querySelectorAll(".quiz-q")[8].querySelectorAll(".quiz-opt.on")).toHaveLength(1);
  });

  it("keeps the left count current after a failed submit", () => {
    const main = mount("anxiety");
    submit(main);
    expect(main.querySelector(".quiz-note")!.textContent).toContain("7 left");
    const first = main.querySelector<HTMLInputElement>(".quiz-q input")!;
    first.checked = true;
    first.dispatchEvent(new Event("change", { bubbles: true }));
    expect(main.querySelector(".quiz-note")!.textContent).toContain("6 left");
  });

  it("shows no help box for a low PHQ-9 without item 9", () => {
    const main = mount("depression");
    answer(main, () => 0);
    submit(main);
    expect(main.querySelector(".quiz-crisis")).toBeNull();
  });

  it("renders a result for every test and resets on start over", () => {
    for (const id of QUIZZES) {
      const main = mount(id);
      answer(main, (i) => i % 2);
      submit(main);
      const result = main.querySelector<HTMLElement>("#result")!;
      expect(result.hidden, id).toBe(false);
      expect(result.querySelectorAll(".quiz-score, .quiz-pair").length, id).toBeGreaterThan(0);
      const buttons = result.querySelectorAll("button");
      buttons[buttons.length - 1].dispatchEvent(new MouseEvent("click", { bubbles: true }));
      expect(result.hidden, id).toBe(true);
      expect(main.querySelectorAll(".quiz-q.done").length, id).toBe(0);
    }
  });

  it("shows the extraversion band with its score and the work style profile", () => {
    const main = mount("introvert", "zh-CN");
    answer(main, () => 2);
    submit(main);
    const result = main.querySelector<HTMLElement>("#result")!;
    expect(result.textContent).toContain("40 / 80");
    expect(result.querySelector(".quiz-crisis")).toBeNull();
    // Not a wellbeing check: no "not a diagnosis" line.
    expect(result.querySelector("p.muted")).toBeNull();
    const work = mount("work-style");
    answer(work, () => 2);
    submit(work);
    expect(work.querySelectorAll("#result .quiz-trait")).toHaveLength(4);
  });

  it("names the pets the answers ruled out", () => {
    const main = mount("pet");
    // Fur allergy (question 5, option 2): only fish and reptiles stay possible.
    answer(main, (i) => (i === 4 ? 1 : 0));
    submit(main);
    const note = [...main.querySelectorAll("#result p.muted")].map((p) => p.textContent ?? "").find((text) => text.startsWith("Ruled out"));
    expect(note).toContain("Dog");
    expect(note).toContain("Cat");
  });

  it("lists every test on the hub", () => {
    document.body.innerHTML = "<main></main>";
    const main = document.querySelector("main")!;
    mountQuizHub(main, "ja");
    for (const id of QUIZZES) expect(main.querySelector(`a[href="/ja/tests/${id}/"]`), id).not.toBeNull();
  });
});
