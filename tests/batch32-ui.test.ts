// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountHangman, unmountHangman } from "../src/client/hangman/ui";
import { josa, mountRps, unmountRps } from "../src/client/rock-paper-scissors/ui";
import { mountBac, unmountBac } from "../src/client/bac-calculator/ui";
import { mountSimpleInterest, unmountSimpleInterest } from "../src/client/simple-interest/ui";
import { letterKey, pool } from "../src/shared/hangman";

let host: HTMLElement;

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  window.localStorage.clear();
});

afterEach(() => {
  unmountHangman();
  unmountRps();
  unmountBac();
  unmountSimpleInterest();
  host.remove();
  vi.restoreAllMocks();
});

const q = <T extends HTMLElement>(sel: string) => host.querySelector<T>(sel)!;
const set = (sel: string, value: string, event = "input") => {
  const el = q<HTMLInputElement | HTMLSelectElement>(sel);
  el.value = value;
  el.dispatchEvent(new Event(event));
};
const keydown = (key: string) => document.body.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));

describe("hangman ui", () => {
  it("mounts the same first word on a first visit and plays it to a win by keyboard", () => {
    mountHangman(host);
    const words = pool("en", "all");
    const word = words[7]!.word;
    expect(host.querySelectorAll(".hm-letter")).toHaveLength([...word].filter((c) => letterKey(c)).length);
    expect(q("[data-out=category]").textContent).toBe(`Category: ${words[7]!.category[0]!.toUpperCase()}${words[7]!.category.slice(1)}`);
    for (const k of new Set([...word].map(letterKey).filter(Boolean))) keydown(k.toLowerCase());
    expect(q("[data-out=status]").textContent).toBe("You got it!");
    expect(q("[data-out=score]").textContent).toContain("Wins1");
    expect(JSON.parse(window.localStorage.getItem("cvcm.hangman.v1")!).won).toBe(1);
  });

  it("counts wrong letters, draws the figure and reveals the word when lost", () => {
    mountHangman(host);
    const word = pool("en", "all")[7]!.word;
    const wrong = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"].filter((c) => !word.includes(c)).slice(0, 6);
    for (const c of wrong) q<HTMLButtonElement>(`[data-key="${c}"]`).click();
    expect(host.querySelectorAll(".hm-part.on")).toHaveLength(6);
    expect(q("[data-out=status]").textContent).toBe(`Out of guesses. The word was ${word}.`);
    expect(host.querySelectorAll<HTMLButtonElement>(".hm-key:not(:disabled)")).toHaveLength(0);
  });

  it("plays a friend's word without counting it, and refuses digits", () => {
    mountHangman(host);
    set("[data-field=secret]", "abc1");
    q<HTMLButtonElement>("[data-action=secret]").click();
    expect(q("[data-out=secret-msg]").textContent).toContain("2–30 letters");
    set("[data-field=secret]", "ice cream");
    q<HTMLButtonElement>("[data-action=secret]").click();
    expect(q("[data-out=category]").textContent).toBe("A friend's word");
    expect(host.querySelectorAll(".hm-letter")).toHaveLength(8);
    expect(q<HTMLInputElement>("[data-field=secret]").value).toBe("");
    for (const c of "ICEARM") keydown(c);
    expect(q("[data-out=status]").textContent).toBe("You got it!");
    expect(q("[data-out=score]").textContent).toContain("Wins0");
  });

  it("adds an Ñ key for a friend's word in English, and reads the physical key on other layouts", () => {
    mountHangman(host);
    set("[data-field=secret]", "piña");
    q<HTMLButtonElement>("[data-action=secret]").click();
    expect(q("[data-key=Ñ]")).not.toBeNull();
    for (const c of "PIA") keydown(c);
    q<HTMLButtonElement>("[data-key=Ñ]").click();
    expect(q("[data-out=status]").textContent).toBe("You got it!");
    set("[data-field=secret]", "dog");
    q<HTMLButtonElement>("[data-action=secret]").click();
    expect(host.querySelector("[data-key=Ñ]")).toBeNull();
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "ㅇ", code: "KeyD", bubbles: true }));
    expect(q("[data-out=word]").textContent).toContain("D");
  });

  it("counts a started list game left for a new word as a loss", () => {
    mountHangman(host);
    const word = pool("en", "all")[7]!.word;
    keydown([..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"].find((c) => !word.includes(c))!);
    q<HTMLButtonElement>("[data-action=new]").click();
    expect(q("[data-action=new]").textContent).toBe("Give up this word? Tap again");
    expect(q("[data-out=score]").textContent).toContain("Losses0");
    q<HTMLButtonElement>("[data-action=new]").click();
    expect(q("[data-action=new]").textContent).toBe("New word");
    expect(q("[data-out=score]").textContent).toContain("Losses1");
    q<HTMLButtonElement>("[data-action=new]").click();
    expect(q("[data-out=score]").textContent).toContain("Losses1");
  });

  it("resumes a started game after a reload, and deals a random word to a returning visitor", () => {
    mountHangman(host);
    const word = pool("en", "all")[7]!.word;
    const miss = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"].find((c) => !word.includes(c))!;
    keydown(miss);
    unmountHangman();
    host.replaceChildren();
    mountHangman(host);
    expect(q("[data-out=misses]").textContent).toBe(`Wrong: ${miss} (1/6)`);
    expect(q<HTMLButtonElement>(`[data-key=${miss}]`).disabled).toBe(true);
    // Finished games are not resumed: a returning visitor gets a word from the random draw.
    window.localStorage.setItem("cvcm.hangman.v1", JSON.stringify({ lang: "en", category: "all", won: 0, lost: 0, streak: 0 }));
    vi.spyOn(crypto, "getRandomValues").mockImplementation(((buf: Uint32Array) => buf.fill(0)) as unknown as typeof crypto.getRandomValues);
    unmountHangman();
    host.replaceChildren();
    mountHangman(host);
    expect(q("[data-out=misses]").textContent).toBe("Wrong: — (0/6)");
    expect(host.querySelectorAll(".hm-letter")).toHaveLength([...pool("en", "all")[0]!.word].filter((c) => letterKey(c)).length);
  });

  it("writes nothing at mount (the prerender shares one window across pages) and takes letters typed on its menus", () => {
    mountHangman(host);
    expect(window.localStorage.getItem("cvcm.hangman.v1")).toBeNull();
    const word = pool("en", "all")[7]!.word;
    const sel = q<HTMLSelectElement>("[data-field=category]");
    sel.focus();
    sel.dispatchEvent(new KeyboardEvent("keydown", { key: word[0]!.toLowerCase(), bubbles: true }));
    expect(q("[data-out=word]").textContent).toContain(word[0]!);
    expect(sel.value).toBe("all");
  });

  it("ignores punctuation on letter codes, and waits for New word before a mid-game menu change", () => {
    mountHangman(host);
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: ",", code: "KeyM", bubbles: true }));
    expect(q("[data-out=misses]").textContent).toBe("Wrong: — (0/6)");
    const word = pool("en", "all")[7]!.word;
    keydown(word[0]!);
    set("[data-field=category]", "food", "change");
    expect(q("[data-out=pending]").hidden).toBe(false);
    keydown(word[1] === word[0] ? word[2]! : word[1]!);
    expect(q("[data-out=pending]").hidden).toBe(false);
    expect(q("[data-out=score]").textContent).toContain("Losses0");
    expect(q("[data-out=word]").textContent).toContain(word[0]!);
    q<HTMLButtonElement>("[data-action=new]").click();
    q<HTMLButtonElement>("[data-action=new]").click();
    expect(q("[data-out=category]").textContent).toBe("Category: Food");
    expect(q("[data-out=score]").textContent).toContain("Losses1");
    expect(q("[data-out=pending]").hidden).toBe(true);
  });

  it("sets a list game aside for a friend's word and brings it back with New word", () => {
    mountHangman(host);
    const word = pool("en", "all")[7]!.word;
    const miss = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"].find((c) => !word.includes(c))!;
    keydown(miss);
    set("[data-field=secret]", "dog");
    q<HTMLButtonElement>("[data-action=secret]").click();
    expect(q("[data-out=score]").textContent).toContain("Losses0");
    expect(JSON.parse(window.localStorage.getItem("cvcm.hangman.v1")!).game.word).toBe(word);
    q<HTMLButtonElement>("[data-action=new]").click();
    expect(q("[data-out=misses]").textContent).toBe(`Wrong: ${miss} (1/6)`);
    expect(q("[data-out=category]").textContent).toBe("Category: Animals");
  });

  it("marks a hint in the wrong-guess line", () => {
    mountHangman(host);
    q<HTMLButtonElement>("[data-action=hint]").click();
    expect(q("[data-out=misses]").textContent).toBe("Wrong: 💡 (1/6)");
  });

  it("switches to Spanish with an Ñ key", () => {
    mountHangman(host);
    set("[data-field=lang]", "es", "change");
    expect(q("[data-key=Ñ]")).not.toBeNull();
    expect(host.querySelectorAll(".hm-key")).toHaveLength(27);
  });
});

describe("rock paper scissors ui", () => {
  it("plays rounds against a random computer and explains the result", () => {
    mountRps(host);
    vi.spyOn(crypto, "getRandomValues").mockImplementation(((buf: Uint32Array) => buf.fill(2)) as unknown as typeof crypto.getRandomValues); // 2 = scissors
    q<HTMLButtonElement>("[data-move=rock]").click();
    expect(q("[data-out=result]").textContent).toBe("You win! Rock crushes Scissors.");
    keydown("p");
    expect(q("[data-out=result]").textContent).toBe("You lose. Scissors cuts Paper.");
    expect(q("[data-out=score]").textContent).toBe("Wins1Losses1Draws0");
    expect(host.querySelectorAll("[data-out=history] li")).toHaveLength(2);
  });

  it("ends a best-of-3 match and offers the next one", () => {
    mountRps(host);
    set("[data-field=target]", "2", "change");
    vi.spyOn(crypto, "getRandomValues").mockImplementation(((buf: Uint32Array) => buf.fill(2)) as unknown as typeof crypto.getRandomValues);
    keydown("r");
    keydown("r");
    expect(q("[data-out=match]").textContent).toBe("You won the match! Matches: you 1, computer 0.");
    expect(q<HTMLButtonElement>("[data-move=rock]").disabled).toBe(true);
    keydown("r");
    expect(q("[data-out=score]").textContent).toBe("Wins2Losses0Draws0");
    q<HTMLButtonElement>("[data-action=next-match]").click();
    expect(q("[data-out=score]").textContent).toBe("Wins0Losses0Draws0");
    expect(q<HTMLButtonElement>("[data-move=rock]").disabled).toBe(false);
  });

  it("takes the typed letter before the physical key (Dvorak P sits on KeyR)", () => {
    mountRps(host);
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "p", code: "KeyR", bubbles: true }));
    expect(q("[data-out=history] li").textContent).toMatch(/^✋ Paper/);
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "ㄱ", code: "KeyR", bubbles: true }));
    expect(q("[data-out=history] li").textContent).toMatch(/^✊ Rock/);
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Process", code: "KeyS", bubbles: true }));
    expect(q("[data-out=history] li").textContent).toMatch(/^✌️ Scissors/);
  });

  it("ignores other Latin letters on other layouts, and keeps the history across matches", () => {
    mountRps(host);
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "o", code: "KeyS", bubbles: true }));
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: ";", code: "KeyP", bubbles: true }));
    expect(host.querySelectorAll("[data-out=history] li")).toHaveLength(0);
    set("[data-field=target]", "2", "change");
    vi.spyOn(crypto, "getRandomValues").mockImplementation(((buf: Uint32Array) => buf.fill(2)) as unknown as typeof crypto.getRandomValues);
    keydown("r");
    keydown("r");
    q<HTMLButtonElement>("[data-action=next-match]").click();
    expect(host.querySelectorAll("[data-out=history] li")).toHaveLength(2);
    expect(q("[data-out=result]").textContent).toBe("Pick your throw.");
  });

  it("picks Korean particles by the final consonant", () => {
    expect(josa("바위이(가) 가위을(를) 부숩니다.")).toBe("바위가 가위를 부숩니다.");
    expect(josa("스팍이(가) 바위을(를) 증발시킵니다.")).toBe("스팍이 바위를 증발시킵니다.");
    expect(josa("도마뱀이(가) 보을(를) 먹습니다.")).toBe("도마뱀이 보를 먹습니다.");
    expect(josa("Rock crushes Scissors.")).toBe("Rock crushes Scissors.");
  });

  it("starts a new match on a rules or match change but keeps the history", () => {
    mountRps(host);
    keydown("r");
    keydown("p");
    set("[data-field=target]", "3", "change");
    expect(q("[data-out=score]").textContent).toBe("Wins0Losses0Draws0");
    expect(host.querySelectorAll("[data-out=history] li")).toHaveLength(2);
  });

  it("adds lizard and Spock", () => {
    mountRps(host);
    set("[data-field=variant]", "spock", "change");
    expect(host.querySelectorAll("[data-move]")).toHaveLength(5);
  });
});

describe("BAC ui", () => {
  it("estimates two beers for a 160 lb man after an hour", () => {
    mountBac(host);
    // 2 × 12.0 US fl oz (355 mL rounded to 12 oz = 354.9 mL) × 5 % × 0.789 = 28.0 g; 160 lb = 72.57 kg.
    const out = q("[data-out=result]").textContent!;
    expect(out).toContain("Pure alcohol28 g");
    expect(out).toMatch(/Blood alcohol \(BAC\)0\.04\d %/);
    expect(q("[data-out=times]").textContent).toContain("0.08 %: already there");
  });

  it("converts weight units and refuses impossible weights", () => {
    mountBac(host);
    set("[data-field=weight-unit]", "kg", "change");
    expect(q<HTMLInputElement>("[data-field=weight]").value).toBe("72.6");
    set("[data-field=weight]", "5");
    expect(q("[data-out=band]").textContent).toContain("Enter a body weight");
  });

  it("switches units back and forth without drifting", () => {
    mountBac(host);
    const before = q("[data-out=result]").textContent;
    for (let i = 0; i < 3; i++) {
      set("[data-field=weight-unit]", "kg", "change");
      set("[data-field=vol-unit]", "ml", "change");
      set("[data-field=weight-unit]", "lb", "change");
      set("[data-field=vol-unit]", "oz", "change");
    }
    expect(q<HTMLInputElement>("[data-field=weight]").value).toBe("160");
    expect(q<HTMLInputElement>("[data-field=size]").value).toBe("12");
    expect(q<HTMLSelectElement>("[data-field=kind]").value).toBe("beer");
    expect(q("[data-out=result]").textContent).toBe(before);
  });

  it("adds and removes drinks", () => {
    mountBac(host);
    q<HTMLButtonElement>("[data-action=add]").click();
    expect(host.querySelectorAll(".bac-row")).toHaveLength(2);
    host.querySelectorAll<HTMLButtonElement>("[data-action=remove]").forEach((b) => b.click());
    expect(q("[data-out=band]").textContent).toBe("About zero: the alcohol should be gone.");
  });
});

describe("simple interest ui", () => {
  it("computes interest and the yearly table", () => {
    mountSimpleInterest(host);
    expect(q("[data-out=result]").textContent).toContain("Interest1,500.00");
    expect(q("[data-out=result]").textContent).toContain("Total (principal + interest)11,500.00");
    expect(host.querySelectorAll("[data-out=table] tbody tr")).toHaveLength(3);
  });

  it("converts the typed time when the unit changes and labels the table in that unit", () => {
    mountSimpleInterest(host);
    set("[data-field=unit]", "months", "change");
    expect(q<HTMLInputElement>("[data-field=time]").value).toBe("36");
    expect(q("[data-out=result]").textContent).toContain("Interest1,500.00");
    expect(q("[data-out=table] tbody tr td").textContent).toBe("12 months");
    set("[data-field=time]", "48");
    expect(q("[data-out=result]").textContent).toContain("Interest2,000.00");
    set("[data-field=time]", "100");
    set("[data-field=unit]", "days", "change");
    set("[data-field=unit]", "years", "change");
    set("[data-field=unit]", "days", "change");
    expect(q<HTMLInputElement>("[data-field=time]").value).toBe("3041.6667");
    set("[data-field=unit]", "months", "change");
    expect(q<HTMLInputElement>("[data-field=time]").value).toBe("100");
  });

  it("keeps a converted term's length when the day basis changes", () => {
    mountSimpleInterest(host);
    set("[data-field=unit]", "days", "change");
    set("[data-field=basis]", "360", "change");
    expect(q<HTMLInputElement>("[data-field=time]").value).toBe("1080");
    expect(q("[data-out=result]").textContent).toContain("Interest1,500.00");
  });

  it("finds the rate and the time in days", () => {
    mountSimpleInterest(host);
    set("[data-field=find]", "rate", "change");
    expect(q("[data-field=rate]").closest("label")!.hidden).toBe(true);
    expect(q("[data-out=result]").textContent).toContain("Yearly rate (%)5 %");
    set("[data-field=find]", "time", "change");
    set("[data-field=rate]", "5");
    set("[data-field=unit]", "days", "change");
    expect(q("[data-out=result]").textContent).toContain("Time1,095 days");
  });
});
