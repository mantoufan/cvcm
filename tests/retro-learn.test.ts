import { describe, expect, it } from "vitest";
import { lessonsForTool } from "../src/shared/learn";
import { CONSOLE_CONTROLS } from "../src/shared/game-controls";
import { MAX_ROM_BYTES, ROM_ACCEPT } from "../src/shared/rom-detect";
import en from "../src/locales/en.json";

/** Each fact the tutorials state, checked against the tools' own data. */
describe("retro tool tutorials", () => {
  it("links each tutorial from its tool", () => {
    expect(lessonsForTool("rom-emulator")).toEqual(["use-emulator"]);
    expect(lessonsForTool("flash-player")).toEqual(["open-swf-file"]);
  });

  it("lists exactly the file types the tool accepts", () => {
    const listed = en.learn["use-emulator"].s2b.match(/\.[a-z]+/g);
    expect(listed).toEqual(ROM_ACCEPT.split(","));
  });

  it("states the real size limit", () => {
    expect(MAX_ROM_BYTES).toBe(64 * 1024 * 1024);
    expect(en.learn["use-emulator"].s6b).toContain("64 MB");
  });

  it("prints the keys the NES and SNES tables use", () => {
    const keys = (id: "fc" | "sfc") => Object.fromEntries(CONSOLE_CONTROLS[id].map((row) => [row.action, row.keys]));
    expect(keys("fc")).toMatchObject({ a: "Z", b: "X", select: "V", start: "Enter" });
    expect(keys("sfc")).toMatchObject({ y: "S", x: "A", l: "Q", r: "E" });
  });
});
