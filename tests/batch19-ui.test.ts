// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountCalculator, unmountCalculator } from "../src/client/calculator/ui";
import { mountNotepad, unmountNotepad } from "../src/client/notepad/ui";
import { mountMarkdown, unmountMarkdown } from "../src/client/markdown/ui";
import { mountGradient, unmountGradient } from "../src/client/gradient/ui";
import { mountFancyText, unmountFancyText } from "../src/client/fancy-text/ui";
import { FANCY_STYLES } from "../src/shared/fancy-text";

let host: HTMLElement;

beforeEach(() => {
  window.localStorage.clear();
  host = document.createElement("div");
  document.body.append(host);
});

afterEach(() => {
  unmountCalculator();
  unmountNotepad();
  unmountMarkdown();
  unmountGradient();
  unmountFancyText();
  host.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const q = <T extends HTMLElement>(sel: string) => host.querySelector<T>(sel)!;
const type = (el: HTMLInputElement | HTMLTextAreaElement, v: string) => {
  el.value = v;
  el.dispatchEvent(new Event("input"));
};

describe("calculator ui", () => {
  it("shows a live result, keeps = results in history and carries on from Ans", () => {
    mountCalculator(host);
    const expr = q<HTMLInputElement>("[data-field=expr]");
    for (const k of ["7", "×", "6"]) q<HTMLButtonElement>(`[data-key='${k}']`).click();
    expect(expr.value).toBe("7×6");
    expect(q("[data-out=result]").textContent).toBe("42");
    q<HTMLButtonElement>("[data-key='@eq']").click();
    expect(q("[data-out=result]").textContent).toBe("= 42");
    expect(q("[data-out=history]").textContent).toContain("7×6= 42");
    // An operator after = continues from the answer; a digit starts again.
    q<HTMLButtonElement>("[data-key='+']").click();
    q<HTMLButtonElement>("[data-key='8']").click();
    expect(expr.value).toBe("Ans+8");
    expect(q("[data-out=result]").textContent).toBe("50");
    q<HTMLButtonElement>("[data-key='@eq']").click();
    q<HTMLButtonElement>("[data-key='3']").click();
    expect(expr.value).toBe("3");
    const saved = JSON.parse(window.localStorage.getItem("cvcm.calculator.v1")!);
    expect(saved).toHaveLength(2);
    // History keeps the number Ans stood for, so the line still gives its own result later.
    expect(saved[0]).toEqual({ expr: "42+8", result: "50", mode: "deg" });
  });
  it("switches angle mode, deletes function names whole and reports errors only after =", () => {
    mountCalculator(host);
    const expr = q<HTMLInputElement>("[data-field=expr]");
    q<HTMLButtonElement>("[data-key='sin(']").click();
    q<HTMLButtonElement>("[data-key='9']").click();
    q<HTMLButtonElement>("[data-key='0']").click();
    expect(q("[data-out=result]").textContent).toBe("1");
    q<HTMLButtonElement>("[data-action=mode]").click();
    expect(q("[data-out=result]").textContent).toBe("0.893996663600558");
    q<HTMLButtonElement>("[data-key='@back']").click();
    q<HTMLButtonElement>("[data-key='@back']").click();
    q<HTMLButtonElement>("[data-key='@back']").click();
    expect(expr.value).toBe("");
    type(expr, "1÷");
    expect(q("[data-out=result]").textContent).toBe("");
    type(expr, "1÷0");
    q<HTMLButtonElement>("[data-key='@eq']").click();
    expect(q("[data-out=result]").classList.contains("error")).toBe(true);
    expect(host.querySelectorAll(".calc-hist")).toHaveLength(0);
  });
});

describe("notepad ui", () => {
  it("saves as you type, restores the note and offers Undo after Clear", () => {
    vi.useFakeTimers();
    mountNotepad(host);
    const text = q<HTMLTextAreaElement>("[data-field=note]");
    type(text, "Shopping\nmilk eggs");
    vi.advanceTimersByTime(200);
    expect(q("[data-out=stats]").textContent).toContain("3");
    vi.advanceTimersByTime(500);
    expect(JSON.parse(window.localStorage.getItem("cvcm.notepad.v1")!).text).toBe("Shopping\nmilk eggs");
    unmountNotepad();
    host.replaceChildren();
    mountNotepad(host);
    const again = q<HTMLTextAreaElement>("[data-field=note]");
    expect(again.value).toBe("Shopping\nmilk eggs");
    q<HTMLButtonElement>("[data-action=clear]").click();
    expect(again.value).toBe("");
    expect(q<HTMLButtonElement>("[data-action=undo]").hidden).toBe(false);
    q<HTMLButtonElement>("[data-action=undo]").click();
    expect(again.value).toBe("Shopping\nmilk eggs");
  });
  it("saves pending typing when the tool closes", () => {
    vi.useFakeTimers();
    mountNotepad(host);
    type(q<HTMLTextAreaElement>("[data-field=note]"), "last words");
    unmountNotepad();
    expect(JSON.parse(window.localStorage.getItem("cvcm.notepad.v1")!).text).toBe("last words");
  });
  it("takes over a note saved in another tab", () => {
    mountNotepad(host);
    window.dispatchEvent(new StorageEvent("storage", { key: "cvcm.notepad.v1", newValue: JSON.stringify({ text: "from tab 2", savedAt: 1 }) }));
    expect(q<HTMLTextAreaElement>("[data-field=note]").value).toBe("from tab 2");
  });
});

describe("markdown ui", () => {
  it("renders the sample, builds DOM without running HTML and saves edits", () => {
    vi.useFakeTimers();
    mountMarkdown(host);
    const preview = q("[data-out=preview]");
    expect(preview.querySelector("h1")).toBeNull();
    expect(preview.querySelector("h2.md-h1")).not.toBeNull();
    expect(preview.querySelector("table")).not.toBeNull();
    expect(preview.querySelectorAll("input[type=checkbox]").length).toBe(3);
    type(q<HTMLTextAreaElement>("[data-field=markdown]"), "# Hi <img src=x onerror=alert(1)>\n\n[x](javascript:alert(1)) [ok](https://cv.cm)");
    vi.advanceTimersByTime(200);
    expect(preview.querySelector("img")).toBeNull();
    expect(preview.querySelector(".md-h1")!.textContent).toBe("Hi <img src=x onerror=alert(1)>");
    const links = preview.querySelectorAll("a");
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute("href")).toBe("https://cv.cm");
    expect(links[0].getAttribute("rel")).toContain("noopener");
    expect(window.localStorage.getItem("cvcm.markdown.v1")).toContain("# Hi");
  });
});

describe("gradient ui", () => {
  it("updates CSS from stops, presets, type and limits stop count", () => {
    mountGradient(host);
    const css = q<HTMLTextAreaElement>("[data-out=css]");
    expect(css.value).toBe("background: #ff9a9e;\nbackground: linear-gradient(135deg, #ff9a9e 0%, #fad0c4 100%);");
    const hex = host.querySelectorAll<HTMLInputElement>("[data-field=hex]")[1];
    type(hex, "#000");
    expect(css.value).toContain("#000000 100%");
    type(hex, "#zz");
    expect(css.value).toContain("#000000 100%");
    expect(hex.classList.contains("invalid")).toBe(true);
    const kind = q<HTMLSelectElement>("[data-field=kind]");
    kind.value = "radial";
    kind.dispatchEvent(new Event("change"));
    expect(css.value).toContain("radial-gradient(circle,");
    for (let i = 0; i < 10; i++) q<HTMLButtonElement>("[data-action=add-stop]").click();
    expect(host.querySelectorAll("[data-stop]")).toHaveLength(6);
    expect(q<HTMLButtonElement>("[data-action=add-stop]").disabled).toBe(true);
    q<HTMLButtonElement>("[data-preset='4']").click();
    expect(host.querySelectorAll("[data-stop]")).toHaveLength(3);
    expect(kind.value).toBe("linear");
    expect(css.value).toContain("linear-gradient(180deg,");
  });
});

describe("fancy-text ui", () => {
  it("lists every style and restyles typed text", () => {
    vi.useFakeTimers();
    mountFancyText(host);
    expect(host.querySelectorAll(".fancy-row")).toHaveLength(FANCY_STYLES.length);
    type(q<HTMLTextAreaElement>("[data-field=text]"), "Hi");
    vi.advanceTimersByTime(100);
    expect(q("[data-style=bold] .fancy-out").textContent).toBe("𝐇𝐢");
    expect(q("[data-style=upsideDown] .fancy-out").textContent).toBe("ᴉH");
  });
});

describe("review pass 4 ui", () => {
  const beforeinput = (el: HTMLElement, data: string) =>
    el.dispatchEvent(new InputEvent("beforeinput", { data, inputType: "insertText", bubbles: true, cancelable: true }));

  it("treats typing after = like the keypad", () => {
    mountCalculator(host);
    const expr = q<HTMLInputElement>("[data-field=expr]");
    type(expr, "2+3");
    expr.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    beforeinput(expr, "*");
    expect(expr.value).toBe("Ans*");
    type(expr, "2+3");
    expr.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    beforeinput(expr, "4");
    expect(expr.value).toBe("4");
  });

  it("an idle Markdown tab leaves another tab's document alone", () => {
    mountMarkdown(host);
    window.localStorage.setItem("cvcm.markdown.v1", "from tab 2");
    window.dispatchEvent(new Event("pagehide"));
    expect(window.localStorage.getItem("cvcm.markdown.v1")).toBe("from tab 2");
    window.dispatchEvent(new StorageEvent("storage", { key: "cvcm.markdown.v1", newValue: "from tab 2" }));
    expect(q<HTMLTextAreaElement>("[data-field=markdown]").value).toBe("from tab 2");
  });

  it("Tab indents a selection instead of deleting it", () => {
    mountMarkdown(host);
    const box = q<HTMLTextAreaElement>("[data-field=markdown]");
    box.value = "- a\n- b\nc";
    box.setSelectionRange(0, 7);
    box.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));
    expect(box.value).toBe("  - a\n  - b\nc");
    box.setSelectionRange(0, box.value.indexOf("\nc"));
    box.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true }));
    expect(box.value).toBe("- a\n- b\nc");
  });

  it("refuses a file that is not UTF-8 and keeps the note", async () => {
    mountNotepad(host);
    const box = q<HTMLTextAreaElement>("[data-field=note]") ?? host.querySelector("textarea")!;
    type(box, "keep me");
    const file = new File([new Uint8Array([0xc4, 0xe3, 0xba, 0xc3])], "gbk.txt");
    const input = host.querySelector<HTMLInputElement>("input[type=file]")!;
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    input.dispatchEvent(new Event("change"));
    await vi.waitFor(() => expect(q("[data-out=saved]").classList.contains("error")).toBe(true));
    expect(box.value).toBe("keep me");
  });
});

describe("review pass 5 ui", () => {
  const enter = (el: HTMLElement) => el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

  it("does not let Ans read its own result after =", () => {
    mountCalculator(host);
    const expr = q<HTMLInputElement>("[data-field=expr]");
    type(expr, "1+1");
    enter(expr);
    type(expr, "Ans+1");
    enter(expr);
    expect(q("[data-out=result]").textContent).toBe("= 3");
    q("[data-action=mode]").click();
    expect(q("[data-out=result]").textContent).toBe("3");
    enter(expr);
    expect(q("[data-out=result]").textContent).toBe("= 3");
  });

  it("offers Undo after Sample replaces a document", () => {
    mountMarkdown(host);
    const box = q<HTMLTextAreaElement>("[data-field=markdown]");
    type(box, "my long document");
    q("[data-action=sample]").click();
    expect(box.value).not.toBe("my long document");
    expect(q<HTMLButtonElement>("[data-action=undo]").hidden).toBe(false);
    q("[data-action=undo]").click();
    expect(box.value).toBe("my long document");
    expect(window.localStorage.getItem("cvcm.markdown.v1")).toBe("my long document");
    expect(q<HTMLButtonElement>("[data-action=undo]").hidden).toBe(true);
  });
});

describe("review pass 6 ui", () => {
  it("runs equals for a typed = and keeps it out of history", () => {
    mountCalculator(host);
    const expr = q<HTMLInputElement>("[data-field=expr]");
    type(expr, "2+2");
    expr.dispatchEvent(new InputEvent("beforeinput", { data: "=", inputType: "insertText", bubbles: true, cancelable: true }));
    expect(q("[data-out=result]").textContent).toBe("= 4");
    q("[data-action=clear-history]").click();
    type(expr, "3+3=");
    expr.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(JSON.parse(window.localStorage.getItem("cvcm.calculator.v1")!)[0].expr).toBe("3+3");
  });
});

describe("review pass 8 ui", () => {
  const enter = (el: HTMLElement) => el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  it("saves a spaced product with Ans so the line can be reused", () => {
    mountCalculator(host);
    const expr = q<HTMLInputElement>("[data-field=expr]");
    type(expr, "1+2");
    enter(expr);
    type(expr, "2 Ans");
    enter(expr);
    const saved = JSON.parse(window.localStorage.getItem("cvcm.calculator.v1")!)[0];
    expect(saved.expr).toBe("2 (3)");
    expect(saved.result).toBe("6");
  });
  it("draws every block of a long saved document", () => {
    window.localStorage.setItem("cvcm.markdown.v1", "#\n".repeat(2000));
    mountMarkdown(host);
    expect(q("[data-out=preview]").children.length).toBe(2000);
  });
});

describe("review pass 11 ui", () => {
  it("keeps Ans in full in history", () => {
    mountCalculator(host);
    const expr = q<HTMLInputElement>("[data-field=expr]");
    const enter = () => expr.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    type(expr, "1/3");
    enter();
    type(expr, "Ans*3");
    enter();
    const saved = JSON.parse(window.localStorage.getItem("cvcm.calculator.v1")!)[0];
    expect(saved.expr).toBe("0.333333333333333*3");
    host.querySelector<HTMLButtonElement>(".calc-hist")!.click();
    expect(expr.value).toBe(saved.full);
    enter();
    expect(q("[data-out=result]").textContent).toBe("= 1");
  });
});
