import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GAME_HUBS, GAME_KINDS, gameHubNs, gamesFaqBase } from "../src/shared/games";
import { LOCALES } from "../src/shared/locale";
import { CATEGORIES, GAME_KIND_TOOLS, GAMES_3D, gameHubOf, hubGames } from "../src/shared/path";
import { pageDescription, pageTitle } from "../src/shared/seo";
import worker from "../src/worker";

const pack = (loc: string) => JSON.parse(readFileSync(join(__dirname, `../src/locales/${loc}.json`), "utf8"));
const lookup = (obj: Record<string, unknown>, key: string): unknown => key.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], obj);

describe("games by kind", () => {
  it("puts every game tool in exactly one kind", () => {
    const games = CATEGORIES.filter((c) => ["games", "wordgames", "games3d"].includes(c.id))
      .flatMap((c) => c.tools)
      .filter((id) => id !== "rom-emulator" && id !== "flash-player");
    const listed = Object.values(GAME_KIND_TOOLS).flat();
    expect(new Set(listed).size, "a game listed twice").toBe(listed.length);
    // A new game must go in the kind players would search it under (see GAME_KIND_TOOLS).
    expect([...listed].sort()).toEqual([...games].sort());
    for (const id of games) expect(gameHubOf(id), id).not.toBeNull();
    expect(gameHubOf("rom-emulator")).toBeNull();
  });

  it("lists the 3D games on the 3D tag hub, each also under its kind", () => {
    expect(hubGames("3d")).toEqual(GAMES_3D);
    for (const id of GAMES_3D) expect(GAME_KINDS, id).toContain(gameHubOf(id));
  });

  it("has a label, title, lead, meta and FAQ for every hub in every locale", () => {
    for (const loc of LOCALES) {
      const p = pack(loc);
      for (const hub of GAME_HUBS) {
        expect(p.games.consoles[hub], `${loc} games.consoles.${hub}`).toBeTruthy();
        expect(lookup(p, `${gameHubNs(hub)}.title`), `${loc} ${hub} title`).toBeTruthy();
        expect(lookup(p, `${gameHubNs(hub)}.lead`), `${loc} ${hub} lead`).toBeTruthy();
        expect(lookup(p, `${gamesFaqBase(hub)}.q1`), `${loc} ${hub} faq`).toBeTruthy();
        expect(pageTitle(loc, { games: true, gamesHub: hub }), `${loc} ${hub} meta title`).not.toContain("meta.");
        expect(pageDescription(loc, { games: true, gamesHub: hub }), `${loc} ${hub} meta description`).not.toContain("meta.");
      }
      expect(p.games.mini, loc).toBeUndefined();
    }
  });

  it("301s the old all-games hub to /games/", async () => {
    const assets = { fetch: async () => new Response("<!doctype html><html><head><title>x</title></head><body></body></html>", { headers: { "Content-Type": "text/html" } }) };
    const res = await worker.fetch(new Request("https://cv.cm/ja/games/mini/"), { ASSETS: assets });
    expect(res.status).toBe(301);
    expect(res.headers.get("Location")).toBe("https://cv.cm/ja/games/");
  });
});
