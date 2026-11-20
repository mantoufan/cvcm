// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { mountBilliards, unmountBilliards } from "../src/client/billiards/ui";

describe("billiards page", () => {
  it("mounts both pages without WebGL or three.js, keeps settings, and Play falls back to the retry cover", async () => {
    window.localStorage.clear();
    for (const page of ["billiards", "snooker", "pool-game"] as const) {
      // Changing the game writes ?game= into the URL, which the page reads on mount.
      window.history.replaceState(null, "", "/");
      const host = document.createElement("div");
      document.body.append(host);
      mountBilliards(host, page);
      expect(host.querySelector("h1")!.textContent).toBe(page === "snooker" ? "Snooker" : page === "pool-game" ? "Pool game" : "Billiards");
      expect(host.querySelector("canvas")).toBeNull();
      const variant = host.querySelector<HTMLSelectElement>("[data-in=variant]")!;
      expect(variant.value).toBe(page === "snooker" ? "snooker" : "8-ball");
      // Every game has its rules panel filled in (no raw keys).
      for (const v of Array.from(variant.options).map((o) => o.value)) {
        variant.value = v;
        variant.dispatchEvent(new Event("change"));
        const items = Array.from(host.querySelectorAll(".bl-rules-list li")).map((li) => li.textContent ?? "");
        expect(items.length).toBeGreaterThan(2);
        for (const text of items) expect(text).not.toMatch(/^billiards\./);
      }
      const aim = host.querySelector<HTMLSelectElement>("[data-in=aim]")!;
      aim.value = "off";
      aim.dispatchEvent(new Event("change"));
      expect(JSON.parse(window.localStorage.getItem("cvcm.billiards.v1")!).aim).toBe("off");
      const play = host.querySelector<HTMLButtonElement>("[data-act=play]")!;
      play.click();
      for (let i = 0; i < 100 && play.textContent !== "Try again"; i++) await new Promise((r) => setTimeout(r, 50));
      expect(host.querySelector("canvas")).toBeNull();
      expect(host.querySelector(".g3d-cover")?.hasAttribute("hidden")).toBe(false);
      unmountBilliards();
      host.remove();
    }
  });
});

describe("pool game page on the billiards trainer", () => {
  it("keeps its title, carries over the old win/loss record and resumes a saved game", async () => {
    const { rack } = await import("../src/shared/billiards-tables");
    const { newMatch } = await import("../src/shared/billiards-rules");
    window.localStorage.clear();
    window.history.replaceState(null, "", "/");
    window.localStorage.setItem("cvcm.poolgame.v1", JSON.stringify({ wins: 3, losses: 1 }));
    const balls = rack("8-ball");
    balls.find((b) => b.id === 5)!.on = false;
    const match = { ...newMatch("8-ball", 2), breakShot: false, inHand: null, shots: 4 };
    window.localStorage.setItem("cvcm.billiards.game.pool-game", JSON.stringify({ variant: "8-ball", mode: "cpu", match, balls, breaker: 0 }));
    const host = document.createElement("div");
    document.body.append(host);
    mountBilliards(host, "pool-game");
    expect(host.querySelector("h1")!.textContent).toBe("Pool game");
    expect(host.querySelector<HTMLSelectElement>("[data-in=variant]")!.value).toBe("8-ball");
    expect(host.querySelector("[data-out=status]")!.textContent).toBe("Your game is back where you left it.");
    expect(host.querySelector("[data-out=score]")!.textContent).toContain("Wins 3 · Losses 1");
    expect(window.localStorage.getItem("cvcm.poolgame.v1")).toBeNull();
    expect(JSON.parse(window.localStorage.getItem("cvcm.billiards.v1")!).records["8-ball"]).toEqual({ wins: 3, losses: 1 });
    // The record now lives in the trainer's store; the saved game stays until a new rack.
    expect(JSON.parse(window.localStorage.getItem("cvcm.billiards.game.pool-game")!).match.shots).toBe(4);
    host.querySelector<HTMLButtonElement>("[data-act=new]")!.click();
    expect(window.localStorage.getItem("cvcm.billiards.game.pool-game")).toBeNull();
    unmountBilliards();
    host.remove();
  });
});

describe("saved games", () => {
  it("restore with their own opponent setting and survive a bad ?game= value", async () => {
    const { rack } = await import("../src/shared/billiards-tables");
    const { newMatch } = await import("../src/shared/billiards-rules");
    window.localStorage.clear();
    window.history.replaceState(null, "", "/?game=8ball");
    window.localStorage.setItem("cvcm.billiards.v1", JSON.stringify({ mode: "cpu" }));
    const match = { ...newMatch("10-ball", 2), breakShot: false, inHand: null, shots: 2 };
    window.localStorage.setItem("cvcm.billiards.game.billiards", JSON.stringify({ variant: "10-ball", mode: "two", match, balls: rack("10-ball"), breaker: 1 }));
    const host = document.createElement("div");
    document.body.append(host);
    mountBilliards(host, "billiards");
    expect(host.querySelector<HTMLSelectElement>("[data-in=mode]")!.value).toBe("two");
    expect(host.querySelector<HTMLSelectElement>("[data-in=variant]")!.value).toBe("10-ball");
    expect(host.querySelector("[data-out=status]")!.textContent).toBe("Your game is back where you left it.");
    unmountBilliards();
    host.remove();
    // A save that does not fit is left alone, not wiped.
    window.localStorage.setItem("cvcm.billiards.game.snooker", JSON.stringify({ variant: "snooker", mode: "cpu", match: { variant: "snooker" }, balls: [] }));
    const host2 = document.createElement("div");
    document.body.append(host2);
    mountBilliards(host2, "snooker");
    expect(window.localStorage.getItem("cvcm.billiards.game.snooker")).not.toBeNull();
    unmountBilliards();
    host2.remove();
    window.history.replaceState(null, "", "/");
  });
});

describe("a shot rolling when the page closed", () => {
  it("is played again on return instead of being rewound", async () => {
    const { rack } = await import("../src/shared/billiards-tables");
    const { newMatch } = await import("../src/shared/billiards-rules");
    window.localStorage.clear();
    window.history.replaceState(null, "", "/");
    const match = { ...newMatch("8-ball", 2), breakShot: false, inHand: null, shots: 3 };
    const pending = { angle: 0, speed: 3, side: 0, top: 0 };
    window.localStorage.setItem("cvcm.billiards.game.pool-game", JSON.stringify({ variant: "8-ball", mode: "cpu", match, balls: rack("8-ball"), breaker: 0, pending }));
    const host = document.createElement("div");
    document.body.append(host);
    mountBilliards(host, "pool-game");
    // The shot is under way again (rolling), so the player cannot shoot until it settles.
    expect(host.querySelector<HTMLButtonElement>("[data-act=shoot]")!.disabled).toBe(true);
    expect(JSON.parse(window.localStorage.getItem("cvcm.billiards.game.pool-game")!).pending).toMatchObject(pending);
    unmountBilliards();
    host.remove();
  });
});
