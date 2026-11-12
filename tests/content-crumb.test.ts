// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { start, whenRendered } from "../src/client/app-shell";
import { GAMES } from "../src/shared/games";
import { gamesHref } from "../src/shared/path";

function reset(url: string): void {
  document.head.innerHTML = `<title></title><meta name="description" content="old"><link rel="canonical" href="https://cv.cm/">`;
  document.body.innerHTML = `<div id="app"></div>`;
  window.history.pushState(null, "", url);
}

async function open(url: string): Promise<{ trail: string[]; links: string[]; ld: string[] }> {
  reset(url);
  start();
  await whenRendered();
  const nav = document.querySelector("main nav.device-crumb");
  expect(nav, url).not.toBeNull();
  // The trail sits above the heading, like the column pages, and replaces the old "All tools" link.
  expect(nav?.nextElementSibling?.matches("header.tool-head"), url).toBe(true);
  expect(document.querySelector("main a.back"), url).toBeNull();
  expect(nav?.lastElementChild?.getAttribute("aria-current"), url).toBe("page");
  expect(nav?.getAttribute("aria-label"), url).toBe("Breadcrumb");
  const ld = JSON.parse(document.getElementById("breadcrumb-jsonld")?.textContent || "{}") as {
    itemListElement?: { name: string }[];
  };
  return {
    trail: [...nav!.children].filter((el) => el.getAttribute("aria-hidden") !== "true").map((el) => el.textContent ?? ""),
    links: [...nav!.querySelectorAll("a")].map((a) => a.getAttribute("href") ?? ""),
    ld: (ld.itemListElement ?? []).map((item) => item.name),
  };
}

describe("content page breadcrumbs", () => {
  it("puts Home / Tools / tool above a tool", async () => {
    const page = await open("/en/bmi/");
    expect(page.trail).toEqual(["Home", "Tools", "BMI calculator"]);
    expect(page.links).toEqual(["/en/", "/en/#tools"]);
    // "Tools" is an anchor on the home page, not a page, so the structured data skips it.
    expect(page.ld).toEqual(["Home", "BMI calculator"]);
  });

  it("puts Home / Lessons / tutorial above a tutorial and in its JSON-LD", async () => {
    const page = await open("/en/learn/add-watermark/");
    expect(page.trail.slice(0, 2)).toEqual(["Home", "Lessons"]);
    expect(page.trail).toHaveLength(3);
    expect(page.links).toEqual(["/en/", "/en/learn/"]);
    expect(page.ld).toEqual(page.trail);
  });

  it("puts Home / Games / console / game above a game and in its JSON-LD", async () => {
    const game = GAMES.find((item) => item.console !== "flash")!;
    const page = await open(gamesHref("en", game.console, game.id));
    expect(page.trail.slice(0, 2)).toEqual(["Home", "Games"]);
    expect(page.trail).toHaveLength(4);
    expect(page.trail[3]).toBe(document.querySelector("main h1")?.textContent);
    expect(page.links).toEqual(["/en/", "/en/games/", gamesHref("en", game.console)]);
    expect(page.ld).toEqual(page.trail);
  });

  it("puts Home / Games / Flash above the Flash player hub", async () => {
    const page = await open("/en/games/flash/");
    expect(page.trail).toHaveLength(3);
    expect(page.links).toEqual(["/en/", "/en/games/"]);
    expect(page.ld).toEqual(page.trail);
  });

  it("puts a trail on the hubs those links lead to", async () => {
    const learn = await open("/en/learn/");
    expect(learn.trail).toEqual(["Home", "Lessons"]);
    expect(learn.ld).toEqual(learn.trail);
    const games = await open("/en/games/");
    expect(games.trail).toEqual(["Home", "Games"]);
    expect(games.ld).toEqual(games.trail);
    const game = GAMES.find((item) => item.console !== "flash")!;
    const consoleHub = await open(gamesHref("en", game.console));
    expect(consoleHub.trail).toHaveLength(3);
    expect(consoleHub.links).toEqual(["/en/", "/en/games/"]);
    expect(consoleHub.ld).toEqual(consoleHub.trail);
  });
});
