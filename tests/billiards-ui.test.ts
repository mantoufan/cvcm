// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { mountBilliards, unmountBilliards } from "../src/client/billiards/ui";

describe("billiards page", () => {
  it("mounts both pages without WebGL or three.js, keeps settings, and Play falls back to the retry cover", async () => {
    window.localStorage.clear();
    for (const page of ["billiards", "snooker"] as const) {
      // Changing the game writes ?game= into the URL, which the page reads on mount.
      window.history.replaceState(null, "", "/");
      const host = document.createElement("div");
      document.body.append(host);
      mountBilliards(host, page);
      expect(host.querySelector("h1")!.textContent).toBe(page === "snooker" ? "Snooker" : "Billiards");
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
