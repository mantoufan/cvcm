import { describe, expect, it } from "vitest";
import { GAME_COVER } from "../src/shared/covers";
import {
  GAME_CONSOLES,
  GAMES,
  gameById,
  gamesFor,
  isGameId,
} from "../src/shared/games";
import { gameCopy, gameFaqItems, gameGuideSteps } from "../src/shared/games-i18n";
import { LOCALES } from "../src/shared/locale";
import { gamesHref, parseAppPath } from "../src/shared/path";
import { applyHtmlSeo, pageCanonical, pageDescription, pageTitle } from "../src/shared/seo";
import { sitemapPages, type SitemapPage } from "../src/shared/sitemap";
import worker from "../src/worker";
import en from "../src/locales/games/en.json";
import zhCN from "../src/locales/games/zh-CN.json";
import zhTW from "../src/locales/games/zh-TW.json";
import ja from "../src/locales/games/ja.json";
import ko from "../src/locales/games/ko.json";
import vi from "../src/locales/games/vi.json";
import id from "../src/locales/games/id.json";
import es from "../src/locales/games/es.json";

function keys(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix];
  return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
    keys(v, prefix ? `${prefix}.${k}` : k),
  );
}

const assets = {
  fetch: async () =>
    new Response("<!doctype html><html><head><title>cv.cm</title><meta name=\"description\" content=\"old\" /><link rel=\"canonical\" href=\"https://cv.cm/\" /></head><body></body></html>", {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    }),
};

describe("games catalog", () => {
  it("covers every console and hosts only freeware ROMs", () => {
    for (const id of GAME_CONSOLES) {
      expect(gamesFor(id).length, id).toBeGreaterThan(0);
    }
    expect(GAMES.filter((game) => game.rom).map((game) => game.id).sort()).toEqual([
      "alter-ego",
      "lawn-mower",
    ]);
    expect(Object.keys(GAME_COVER).sort()).toEqual([...GAMES.map((game) => game.id)].sort());
  });

  it("keeps five FAQ items and five walkthrough steps on every game", () => {
    for (const game of GAMES) {
      expect(gameFaqItems("en", game.id).length, game.id).toBe(5);
      expect(gameGuideSteps("zh-CN", game.id).length, game.id).toBe(5);
      expect(gameCopy("zh-CN", game.id).title).toMatch(/cv\.cm/);
    }
  });
});

describe("games locale parity", () => {
  it("keeps the same keys in every games language file", () => {
    const tables = [en, zhCN, zhTW, ja, ko, vi, id, es].map((table) => keys(table).sort());
    for (const table of tables) expect(table).toEqual(tables[0]);
  });
});

describe("games routes", () => {
  it("parses hub, console, and game paths", () => {
    expect(parseAppPath("/zh-cn/games/")).toEqual({
      kind: "games",
      locale: "zh-CN",
      console: null,
      game: null,
    });
    expect(parseAppPath("/en/games/fc/")).toEqual({
      kind: "games",
      locale: "en",
      console: "fc",
      game: null,
    });
    expect(parseAppPath("/zh-cn/games/fc/contra/")).toEqual({
      kind: "games",
      locale: "zh-CN",
      console: "fc",
      game: "contra",
    });
    expect(parseAppPath("/games/contra")).toEqual({
      kind: "bare-games",
      console: "fc",
      game: "contra",
    });
    expect(isGameId("contra")).toBe(true);
    expect(gameById("contra")?.core).toBe("nes");
    expect(gamesHref("zh-CN", "fc", "contra")).toBe("/zh-cn/games/fc/contra/");
  });
});

describe("games seo", () => {
  it("uses cheat and walkthrough titles on Chinese game pages", () => {
    const seo = { games: true as const, console: "fc" as const, game: "contra" as const };
    expect(pageTitle("zh-CN", seo)).toMatch(/魂斗罗/);
    expect(pageTitle("zh-CN", seo)).toMatch(/金手指/);
    expect(pageDescription("zh-CN", seo)).toMatch(/攻略/);
    expect(pageCanonical("zh-CN", seo)).toBe("https://cv.cm/zh-cn/games/fc/contra/");
    const html = applyHtmlSeo(
      `<!doctype html><html><head><title>x</title><meta name="description" content="old" /><link rel="canonical" href="https://cv.cm/" /></head><body></body></html>`,
      "zh-CN",
      seo,
    );
    expect(html).toContain("faq-jsonld");
    expect(html).toContain("howto-jsonld");
    expect(html).toContain("game-jsonld");
    expect(html).toContain("VideoGame");
  });
});

describe("games worker", () => {
  it("301s mixed-case games URLs and 302s bare games onto the locale hub", async () => {
    const slash = await worker.fetch(new Request("https://cv.cm/en/games/fc/contra"), { ASSETS: assets });
    expect(slash.status).toBe(301);
    expect(slash.headers.get("Location")).toBe("https://cv.cm/en/games/fc/contra/");

    const bare = await worker.fetch(new Request("https://cv.cm/games/"), { ASSETS: assets });
    expect(bare.status).toBe(302);
    expect(bare.headers.get("Location")).toMatch(/\/games\/$/);

    const html = await worker.fetch(new Request("https://cv.cm/zh-cn/games/fc/contra/"), { ASSETS: assets });
    expect(html.status).toBe(200);
    const body = await html.text();
    expect(body).toContain("魂斗罗");
    expect(html.headers.get("Content-Security-Policy")).toContain("frame-src 'self'");
  });

  it("proxies emulator cores from S3", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = async (input) => {
      const url = String(input);
      expect(url).toBe("https://files.s3.cv.cm/games/emu/loader.js");
      return new Response("loader", { status: 200, headers: { "Content-Type": "application/javascript" } });
    };
    try {
      const response = await worker.fetch(new Request("https://cv.cm/emu/data/loader.js"), { ASSETS: assets });
      expect(response.status).toBe(200);
      expect(await response.text()).toBe("loader");
    } finally {
      globalThis.fetch = original;
    }
  });
});

describe("games sitemap", () => {
  it("lists the games hub, every console, and every game", () => {
    const pages = sitemapPages().filter(
      (page): page is Extract<SitemapPage, { kind: "games" }> =>
        page.kind === "games" && page.locale === "en",
    );
    expect(pages.some((page) => page.console === null && page.game === null)).toBe(true);
    expect(pages.filter((page) => page.console && !page.game)).toHaveLength(GAME_CONSOLES.length);
    expect(pages.filter((page) => page.game)).toHaveLength(GAMES.length);
    expect(LOCALES.length).toBeGreaterThan(1);
  });
});
