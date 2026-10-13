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

  it("lists every test on the hub", () => {
    document.body.innerHTML = "<main></main>";
    const main = document.querySelector("main")!;
    mountQuizHub(main, "ja");
    for (const id of QUIZZES) expect(main.querySelector(`a[href="/ja/tests/${id}/"]`), id).not.toBeNull();
  });
});
