import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { formatClock } from "../src/shared/game-clock";
import { GAME_HUBS, isGameHubId } from "../src/shared/games";
import { LOCALES } from "../src/shared/locale";
import { CATEGORIES, GAMES_3D } from "../src/shared/path";

const pack = (loc: string) => JSON.parse(readFileSync(join(__dirname, `../src/locales/${loc}.json`), "utf8"));

describe("3D games hub", () => {
  it("lists exactly the games3d group", () => {
    expect([...GAMES_3D]).toEqual([...CATEGORIES.find((c) => c.id === "games3d")!.tools]);
  });

  it("is a tag hub after the six kinds", () => {
    expect([...GAME_HUBS]).toEqual(["board", "card", "puzzle", "word", "arcade", "sports", "3d"]);
    expect(isGameHubId("3d")).toBe(true);
    expect(isGameHubId("fc")).toBe(false);
  });

  it("has hub, nav and shell copy in every locale", () => {
    for (const loc of LOCALES) {
      const p = pack(loc);
      expect(p.nav.games3d, loc).toBeTruthy();
      expect(p.games.consoles["3d"], loc).toBeTruthy();
      expect(p.games.g3d.title, loc).toBeTruthy();
      expect(p.meta.titleGames3d, loc).toBeTruthy();
      expect(p.faq.games3d.q4, loc).toBeTruthy();
      for (const key of ["play", "loading", "noWebgl", "retry", "lost", "restart", "fullscreen", "exitFullscreen", "pad", "credit"]) {
        expect(p.game3d[key], `${loc} game3d.${key}`).toBeTruthy();
      }
      expect(p.game3d.credit, loc).toContain("{name}");
    }
  });

  it("never loads three.js at mount: game modules only import types from three at the top level", () => {
    // /snooker/ and /pool-game/ are the billiards trainer with another default game, so they share src/client/billiards/.
    const dirs = [...new Set([...GAMES_3D.map((id) => (id === "snooker" || id === "pool-game" ? "billiards" : id)), "three-stage"])];
    for (const dir of dirs) {
      const base = join(__dirname, "../src/client");
      const files = dir === "three-stage" ? ["three-stage.ts"] : readdirSync(join(base, dir)).filter((f) => f.endsWith(".ts")).map((f) => join(dir, f));
      for (const file of files) {
        const src = readFileSync(join(base, file), "utf8");
        const statics = src.match(/^import\s+(?!type\b)[^;]*from\s+["']three(\/[^"']*)?["']/gm) ?? [];
        expect(statics, file).toEqual([]);
      }
    }
  });

  it("does not use a trademarked cube name outside the generic vi/id noun", () => {
    for (const loc of LOCALES) {
      if (loc === "vi" || loc === "id") continue;
      const text = JSON.stringify(pack(loc)["tools"]["magic-cube"] ?? {}) + JSON.stringify(pack(loc)["faq"]["magic-cube"] ?? {}) + JSON.stringify(pack(loc).meta.titleMagicCube ?? "");
      expect(text, loc).not.toMatch(/rubik|ルービック|루빅/i);
    }
  });

  it("formats game clocks rounding down, never showing 60 seconds", () => {
    expect(formatClock(59_996)).toBe("0:59.99");
    expect(formatClock(119_999)).toBe("1:59.99");
    expect(formatClock(65_320)).toBe("1:05.32");
    expect(formatClock(83_456, 1)).toBe("1:23.4");
    expect(formatClock(-5)).toBe("0:00.00");
  });
});
