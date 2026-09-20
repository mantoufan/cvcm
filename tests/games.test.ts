import { describe, expect, it } from "vitest";
import playerHtml from "../public/emu/player.html?raw";
import playerJs from "../public/emu/player.js?raw";
import { GAME_COVER } from "../src/shared/covers";
import { CONSOLE_CONTROLS } from "../src/shared/game-controls";
import {
  GAME_CONSOLES,
  GAMES,
  gameById,
  gameRomFile,
  gamesFor,
  isGameId,
} from "../src/shared/games";
import { gameCopy, gameFaqItems } from "../src/shared/games-i18n";
import { gameGuideSteps, gameWalkthrough } from "../src/shared/game-walkthrough";
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
  it("lists keyboard controls for every console", () => {
    for (const id of GAME_CONSOLES) {
      expect(CONSOLE_CONTROLS[id].length, id).toBeGreaterThanOrEqual(4);
      expect(CONSOLE_CONTROLS[id].some((row) => row.action === "start"), id).toBe(true);
    }
  });

  it("covers every console and gives every game an S3 ROM filename", () => {
    for (const id of GAME_CONSOLES) {
      expect(gamesFor(id).length, id).toBeGreaterThan(0);
    }
    const files = GAMES.map((game) => gameRomFile(game));
    expect(new Set(files).size).toBe(files.length);
    expect(gameRomFile(gameById("contra")!)).toBe("contra.nes");
    expect(gameRomFile(gameById("alter-ego")!)).toBe("alter-ego.nes");
    expect(Object.keys(GAME_COVER).sort()).toEqual([...GAMES.map((game) => game.id)].sort());
  });

  it("keeps five FAQ items and a full walkthrough on every game", () => {
    for (const game of GAMES) {
      expect(gameFaqItems("en", game.id).length, game.id).toBe(5);
      const steps = gameGuideSteps("zh-CN", game.id);
      expect(steps.length, game.id).toBeGreaterThanOrEqual(3);
      expect(gameWalkthrough("zh-CN", game.id).intro.length, game.id).toBeGreaterThan(40);
      expect(gameCopy("zh-CN", game.id).title).toMatch(/cv\.cm/);
    }
    expect(gameGuideSteps("zh-CN", "super-mario-bros").length).toBeGreaterThanOrEqual(24);
    expect(gameGuideSteps("zh-CN", "contra").length).toBeGreaterThanOrEqual(8);
  });

  it("keeps the same walkthrough step ids in every locale", () => {
    for (const game of GAMES) {
      const ids = gameGuideSteps("en", game.id).map((step) => step.id);
      expect(gameGuideSteps("zh-CN", game.id).map((step) => step.id), game.id).toEqual(ids);
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

  it("boots the emulator from an external script so CSP can block inline JS", () => {
    expect(playerHtml).not.toMatch(/<script>/);
    expect(playerHtml).toContain('src="/emu/player.js?v=2"');
    expect(playerJs).toContain('EJS_pathtodata = "/emu/assets/"');
  });

  it("allows the emulator player to be framed with wasm eval", async () => {
    const html = "<!doctype html><title>cv.cm games</title>";
    const playerAssets = {
      fetch: async () => new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } }),
    };
    for (const path of ["/emu/player", "/emu/player/", "/emu/player.html"]) {
      const response = await worker.fetch(new Request(`https://cv.cm${path}`), { ASSETS: playerAssets });
      expect(response.status, path).toBe(200);
      expect(response.headers.get("Content-Security-Policy"), path).toContain("wasm-unsafe-eval");
      expect(response.headers.get("Content-Security-Policy"), path).toMatch(/script-src[^;]*blob:/);
      expect(response.headers.get("Content-Security-Policy"), path).toContain("frame-ancestors 'self'");
      expect(response.headers.get("X-Frame-Options"), path).toBeNull();
      expect(response.headers.get("Cache-Control"), path).toBe("no-store");
    }
  });

  it("proxies emulator cores from S3 under data and assets prefixes", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = async (input) => {
      expect(String(input)).toBe("https://s3.cv.cm/files/games/emu/loader.js");
      return new Response("loader", { status: 200, headers: { "Content-Type": "application/javascript" } });
    };
    try {
      for (const path of ["/emu/data/loader.js", "/emu/assets/loader.js"]) {
        const response = await worker.fetch(new Request(`https://cv.cm${path}`), { ASSETS: assets });
        expect(response.status, path).toBe(200);
        expect(await response.text(), path).toBe("loader");
      }
    } finally {
      globalThis.fetch = original;
    }
  });

  it("does not cache missing emulator cores", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = async () => new Response("missing", { status: 404 });
    try {
      const response = await worker.fetch(new Request("https://cv.cm/emu/assets/cores/fceumm-legacy-wasm.data"), {
        ASSETS: assets,
      });
      expect(response.status).toBe(404);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
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
