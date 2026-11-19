import { describe, expect, it } from "vitest";
import flashHtml from "../public/emu/flash.html?raw";
import flashJs from "../public/emu/flash.js?raw";
import playerHtml from "../public/emu/player.html?raw";
import playerJs from "../public/emu/player.js?raw";
import gamesUi from "../src/client/games/player.ts?raw";
import { DEMO_ROMS } from "../src/shared/demo-roms";
import { CONSOLE_CONTROLS } from "../src/shared/game-controls";
import { EMU_CONSOLES, GAME_HUBS, legacyGameConsole } from "../src/shared/games";
import { LOCALES } from "../src/shared/locale";
import { gamesHref, parseAppPath } from "../src/shared/path";
import { ROM_ACCEPT, ROM_CORE } from "../src/shared/rom-detect";
import { sitemapPages, type SitemapPage } from "../src/shared/sitemap";
import worker from "../src/worker";

const assets = {
  fetch: async () =>
    new Response("<!doctype html><html><head><title>cv.cm</title><meta name=\"description\" content=\"old\" /><link rel=\"canonical\" href=\"https://cv.cm/\" /></head><body></body></html>", {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    }),
};

describe("emulator consoles", () => {
  it("lists keyboard controls for every console", () => {
    for (const id of EMU_CONSOLES) {
      expect(CONSOLE_CONTROLS[id].length, id).toBeGreaterThanOrEqual(4);
      expect(CONSOLE_CONTROLS[id].some((row) => row.action === "start"), id).toBe(true);
    }
  });
});

describe("demo games", () => {
  it("has three open-source games for every console, with credits", () => {
    for (const id of EMU_CONSOLES) expect(DEMO_ROMS.filter((rom) => rom.console === id), id).toHaveLength(3);
    expect(new Set(DEMO_ROMS.map((rom) => rom.id)).size).toBe(DEMO_ROMS.length);
    for (const rom of DEMO_ROMS) {
      expect(rom.file, rom.id).toMatch(/^[A-Za-z0-9._-]+$/);
      expect(rom.source.startsWith("https://"), rom.id).toBe(true);
      expect(rom.license.length, rom.id).toBeGreaterThan(0);
      expect(rom.author.length, rom.id).toBeGreaterThan(0);
    }
  });

  it("only offers files the players open, from the retired catalogue", () => {
    const romExt = ROM_ACCEPT.split(",");
    for (const rom of DEMO_ROMS) {
      const ext = rom.file.slice(rom.file.lastIndexOf("."));
      if (rom.console === "flash") expect(ext, rom.id).toBe(".swf");
      else expect(romExt, rom.id).toContain(ext);
      expect(legacyGameConsole(rom.id), rom.id).toBe(rom.console);
    }
  });
});

describe("games routes", () => {
  it("parses the hub and the two sub-hubs", () => {
    expect(parseAppPath("/zh-cn/games/")).toEqual({ kind: "games", locale: "zh-CN", hub: null });
    expect(parseAppPath("/en/games/mini/")).toEqual({ kind: "games", locale: "en", hub: "mini" });
    expect(parseAppPath("/en/games/3d/")).toEqual({ kind: "games", locale: "en", hub: "3d" });
    expect(parseAppPath("/games/")).toEqual({ kind: "bare-games", hub: null });
    expect(gamesHref("zh-CN", "3d")).toBe("/zh-cn/games/3d/");
    expect(gamesHref("en")).toBe("/en/games/");
  });

  it("sends retired catalogue pages to the emulator that plays them", () => {
    expect(parseAppPath("/zh-cn/games/fc/contra/")).toEqual({ kind: "games-retired", locale: "zh-CN", tool: "rom-emulator" });
    expect(parseAppPath("/en/games/gba/")).toEqual({ kind: "games-retired", locale: "en", tool: "rom-emulator" });
    expect(parseAppPath("/en/games/flash/")).toEqual({ kind: "games-retired", locale: "en", tool: "flash-player" });
    expect(parseAppPath("/en/games/flash/ending/")).toEqual({ kind: "games-retired", locale: "en", tool: "flash-player" });
    expect(parseAppPath("/games/contra")).toEqual({ kind: "games-retired", locale: null, tool: "rom-emulator" });
    // A game under another console's hub, a made-up id or a nested hub path was never a page.
    expect(parseAppPath("/en/games/gb/contra/")).toEqual({ kind: "unknown" });
    expect(parseAppPath("/en/games/fc/not-a-game/")).toEqual({ kind: "unknown" });
    expect(parseAppPath("/en/games/mini/chess/")).toEqual({ kind: "unknown" });
  });
});

describe("games worker", () => {
  it("301s retired pages to the emulator tools, without the old query", async () => {
    for (const [path, location] of [
      ["/zh-cn/games/fc/contra/", "https://cv.cm/zh-cn/rom-emulator/"],
      ["/en/games/fc/contra", "https://cv.cm/en/rom-emulator/"],
      ["/en/games/sfc/?genre=rpg", "https://cv.cm/en/rom-emulator/"],
      ["/en/games/gba/apotris/?genre=puzzle&utm_source=x", "https://cv.cm/en/rom-emulator/?utm_source=x"],
      ["/ja/games/flash/", "https://cv.cm/ja/flash-player/"],
      ["/es/games/flash/tag-chase/", "https://cv.cm/es/flash-player/"],
    ]) {
      const response = await worker.fetch(new Request(`https://cv.cm${path}`), { ASSETS: assets });
      expect(response.status, path).toBe(301);
      expect(response.headers.get("Location"), path).toBe(location);
    }
    const bare = await worker.fetch(new Request("https://cv.cm/games/contra", { headers: { "Accept-Language": "ja" } }), { ASSETS: assets });
    expect(bare.status).toBe(302);
    expect(bare.headers.get("Location")).toBe("https://cv.cm/ja/rom-emulator/");
  });

  it("serves only the demo ROMs", async () => {
    const original = globalThis.fetch;
    const asked: string[] = [];
    globalThis.fetch = async (input) => {
      asked.push(String(input));
      return new Response("rom", { status: 200 });
    };
    try {
      const demo = await worker.fetch(new Request(`https://cv.cm/emu/roms/${DEMO_ROMS[0].file}`), { ASSETS: assets });
      expect(demo.status).toBe(200);
      const retired = await worker.fetch(new Request("https://cv.cm/emu/roms/thwaite.nes"), { ASSETS: assets });
      expect(retired.status).toBe(404);
      expect(asked).toEqual([`https://s3.cv.cm/files/games/roms/${DEMO_ROMS[0].file}`]);
    } finally {
      globalThis.fetch = original;
    }
  });

  it("serves the hubs and 302s bare /games/ onto the locale hub", async () => {
    const bare = await worker.fetch(new Request("https://cv.cm/games/"), { ASSETS: assets });
    expect(bare.status).toBe(302);
    expect(bare.headers.get("Location")).toMatch(/\/games\/$/);
    for (const path of ["/zh-cn/games/", "/en/games/mini/", "/en/games/3d/"]) {
      const html = await worker.fetch(new Request(`https://cv.cm${path}`), { ASSETS: assets });
      expect(html.status, path).toBe(200);
    }
  });

  it("uses EmulatorJS system ids that map to hosted cores", () => {
    // Unknown ids (e.g. "gbc") make EmulatorJS fetch a missing {id}-legacy-wasm.data.
    const systems = new Set(["nes", "snes", "gb", "gba", "segaMD"]);
    for (const core of Object.values(ROM_CORE)) expect(systems.has(core), core).toBe(true);
  });

  it("boots the emulator from an external script so CSP can block inline JS", () => {
    expect(playerHtml).not.toMatch(/<script>/);
    expect(playerHtml).toContain('src="/emu/player.js?v=3"');
    expect(playerJs).toContain("event.preventDefault()");
    expect(playerJs).toContain("ArrowLeft");
    expect(playerJs).toContain('EJS_pathtodata = "/emu/assets/"');
    expect(flashHtml).not.toMatch(/<script>/);
    expect(flashHtml).toContain('src="/emu/flash.js?v=1"');
    expect(flashJs).toContain("event.preventDefault()");
    expect(flashJs).toContain('publicPath: "/emu/assets/ruffle/"');
    expect(flashJs).toContain('allowNetworking: "none"');
    expect(gamesUi).toContain("game-empty");
    expect(gamesUi).toContain("games.needFile");
    expect(gamesUi).toContain("games.flash.needFile");
    expect(gamesUi).toContain("games.demos.title");
  });

  it("allows the emulator player to be framed with wasm eval", async () => {
    const html = "<!doctype html><title>cv.cm games</title>";
    const playerAssets = {
      fetch: async () => new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } }),
    };
    for (const path of ["/emu/player", "/emu/player/", "/emu/player.html", "/emu/flash", "/emu/flash/", "/emu/flash.html"]) {
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
  it("lists the games hub and its sub-hubs only", () => {
    const pages = sitemapPages().filter(
      (page): page is Extract<SitemapPage, { kind: "games" }> =>
        page.kind === "games" && page.locale === "en",
    );
    expect(pages.map((page) => page.hub)).toEqual([null, ...GAME_HUBS]);
    expect(LOCALES.length).toBeGreaterThan(1);
  });
});
