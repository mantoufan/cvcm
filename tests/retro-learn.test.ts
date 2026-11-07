import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { localizedTutorialSrc } from "../src/shared/covers";
import type { Locale } from "../src/shared/locale";
import { TUTORIAL_DIAGRAMS, lessonsForTool } from "../src/shared/learn";
import { CONSOLE_CONTROLS } from "../src/shared/game-controls";
import { MAX_ROM_BYTES, ROM_ACCEPT } from "../src/shared/rom-detect";
import gamesEn from "../src/locales/games/en.json";
import gamesEs from "../src/locales/games/es.json";
import gamesJa from "../src/locales/games/ja.json";
import gamesZhCN from "../src/locales/games/zh-CN.json";
import en from "../src/locales/en.json";
import es from "../src/locales/es.json";
import id from "../src/locales/id.json";
import ja from "../src/locales/ja.json";
import ko from "../src/locales/ko.json";
import vi from "../src/locales/vi.json";
import zhCN from "../src/locales/zh-CN.json";
import zhTW from "../src/locales/zh-TW.json";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const locales = { en, es, id, ja, ko, vi, "zh-CN": zhCN, "zh-TW": zhTW };
type Pack = typeof en;

/** Each fact the tutorials state, checked against the tools' own data. */
describe("retro tool tutorials", () => {
  it("links each tutorial from its tool", () => {
    expect(lessonsForTool("rom-emulator")).toEqual(["use-emulator"]);
    expect(lessonsForTool("flash-player")).toEqual(["open-swf-file"]);
  });

  const packs = Object.entries(locales) as [string, Pack][];
  const emulator = (pack: Pack) => pack.learn["use-emulator"];

  it("lists exactly the file types the tool accepts, in every language", () => {
    for (const [loc, pack] of packs) {
      expect(emulator(pack).s2b.match(/\.[a-z]+/g), loc).toEqual(ROM_ACCEPT.split(","));
    }
  });

  it("states the real size limit in every language", () => {
    expect(MAX_ROM_BYTES).toBe(64 * 1024 * 1024);
    for (const [loc, pack] of packs) expect(emulator(pack).s6b, loc).toMatch(/64 ?MB/);
  });

  it("prints the keys the console tables use, in the copy and the diagram", () => {
    const keys = (id: "fc" | "sfc") => Object.fromEntries(CONSOLE_CONTROLS[id].map((row) => [row.action, row.keys]));
    const fc = keys("fc");
    const sfc = keys("sfc");
    expect(fc).toMatchObject({ a: "Z", b: "X", select: "V", start: "Enter" });
    expect(sfc).toMatchObject({ y: "S", x: "A", l: "Q", r: "E" });
    for (const [loc, pack] of packs) {
      for (const key of [fc.a, fc.b, fc.select, fc.start]) expect(emulator(pack).s4b, `${loc} ${key}`).toContain(key);
    }
    const svg = readFileSync(join(root, "public/covers/tutorials/use-emulator-keys.svg"), "utf8");
    for (const key of [fc.a, fc.b, fc.select, fc.start, sfc.y, sfc.x, sfc.l, sfc.r]) expect(svg, key).toContain(`>${key}</text>`);
  });

  it("captions each diagram with the text drawn into it, in every language", () => {
    for (const [loc, pack] of packs) {
      for (const id of ["use-emulator", "open-swf-file"] as const) {
        TUTORIAL_DIAGRAMS[id]!.forEach((diagram, i) => {
          const svg = readFileSync(join(root, "public", localizedTutorialSrc(diagram.src, loc as Locale)), "utf8");
          const caption = pack.learn[id][`diagram${i + 1}` as "diagram1"];
          expect(svg, `${loc} ${diagram.src}`).toContain(`aria-label="${caption}"`);
        });
      }
    }
  });

  it("draws every accepted file type in the diagram, in every language", () => {
    for (const [loc] of packs) {
      const svg = readFileSync(join(root, "public", localizedTutorialSrc("/covers/tutorials/use-emulator-files.svg", loc as Locale)), "utf8");
      for (const ext of ROM_ACCEPT.split(",")) expect(svg, `${loc} ${ext}`).toContain(ext);
    }
  });

  it("describes save states as downloads on every game page, in every language", () => {
    for (const [loc, copy] of Object.entries({ en: gamesEn, "zh-CN": gamesZhCN, ja: gamesJa, es: gamesEs })) {
      const text = JSON.stringify(copy);
      expect(text, loc).not.toMatch(/save-?states? stays?|stays? in this browser|留在(这个|本机)|このブラウザ内|se queda en este navegador/i);
      expect(text, loc).toContain(".state");
    }
  });

  it("pairs each key with its button", () => {
    expect(en.learn["use-emulator"].s4b).toContain("Z is A, X is B, V is Select and Enter is Start");
    const svg = readFileSync(join(root, "public/covers/tutorials/use-emulator-keys.svg"), "utf8");
    const labels = [...svg.matchAll(/>([^<>]+)<\/text>/g)].map((m) => m[1]);
    for (const [key, button] of [["Z", "A"], ["X", "B"], ["V", "Select"], ["Enter", "Start"]] as const) {
      expect(labels[labels.indexOf(key) + 1], key).toBe(button);
    }
  });
});
