import { expect, it } from "vitest";
import { gameMessages, hasMessages, messages } from "../src/shared/messages";
import { LOCALES } from "../src/shared/locale";
import { preloadLocalePack } from "../src/shared/locale-preload";
import { GAMES } from "../src/shared/games";

it("registers every locale for the Worker", () => {
  for (const locale of LOCALES) {
    expect(hasMessages(locale)).toBe(true);
    expect(messages(locale).ui.brand).toBeTruthy();
  }
});

it("leaves HTML alone when no pack map was built in", () => {
  expect(preloadLocalePack("<head></head>", "ja")).toBe("<head></head>");
});

it("preloads the page locale's pack and its imports", () => {
  const packs = { "zh-CN": ["/assets/zh-CN-abc.js", "/assets/shared-def.js"], en: ["/assets/en-xyz.js"] };
  const html = preloadLocalePack("<html><head><title>cv.cm</title></head></html>", "zh-CN", false, packs);
  expect(html).toContain('<link rel="modulepreload" crossorigin href="/assets/zh-CN-abc.js">');
  expect(html).toContain('<link rel="modulepreload" crossorigin href="/assets/shared-def.js">');
  expect(html).not.toContain("en-xyz");
  expect(html.indexOf("modulepreload")).toBeLessThan(html.indexOf("</head>"));
});

it("adds the game pack on game pages", () => {
  const packs = { ja: ["/assets/ja-1.js"], "games-ja": ["/assets/games-ja-2.js"] };
  const page = preloadLocalePack("<head></head>", "ja", false, packs);
  const game = preloadLocalePack("<head></head>", "ja", true, packs);
  expect(page).not.toContain("games-ja");
  expect(game).toContain('href="/assets/ja-1.js"');
  expect(game).toContain('href="/assets/games-ja-2.js"');
});

// The browser loads only the active pack, so a game missing from it has no English copy to fall back to.
it("every locale pack has copy and a walkthrough for every game", () => {
  for (const locale of LOCALES) {
    const names = messages(locale).gameNames;
    const pack = gameMessages(locale);
    for (const game of GAMES) {
      expect(names[game.id]?.name, `${locale} gameNames.${game.id}`).toBeTruthy();
      expect(names[game.id]?.blurb, `${locale} gameNames.${game.id}.blurb`).toBeTruthy();
      expect(pack.games[game.id], `${locale} games.${game.id}`).toBeTruthy();
      expect(pack.walkthroughs[game.id], `${locale} walkthroughs.${game.id}`).toBeTruthy();
    }
  }
});
