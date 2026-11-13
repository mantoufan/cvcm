// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountRomEmulator, unmountRomEmulator } from "../src/client/rom-emulator/ui";
import { mountFlashPlayer } from "../src/client/flash-player/ui";
import { CATEGORIES, TOOLS, parseAppPath } from "../src/shared/path";
import { isTrackedPath } from "../src/shared/analytics";
import { dataHandling } from "../src/shared/agent-docs";
import { GAMES } from "../src/shared/games";
import { MAX_ROM_BYTES, ROM_ACCEPT, ROM_CONSOLES, ROM_CORE, detectRomConsole, zipEntries } from "../src/shared/rom-detect";

function rom(size: number, at: number, bytes: readonly number[]): Uint8Array {
  const out = new Uint8Array(size);
  out.set(bytes, at);
  return out;
}

const ascii = (text: string): number[] => [...text].map((c) => c.charCodeAt(0));

/** A stored zip with these entry names and no file data, as far as the reader needs. */
function zip(names: string[], comment = "", sizes: Record<string, number> = {}): Uint8Array {
  const central: number[] = [];
  for (const name of names) {
    const record = new Uint8Array(46);
    const view = new DataView(record.buffer);
    view.setUint32(0, 0x02014b50, true);
    view.setUint32(24, sizes[name] ?? 0, true);
    view.setUint16(28, name.length, true);
    central.push(...record, ...ascii(name));
  }
  const end = new Uint8Array(22);
  const view = new DataView(end.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(10, names.length, true);
  view.setUint32(16, 4, true);
  view.setUint16(20, comment.length, true);
  return new Uint8Array([0x50, 0x4b, 0x03, 0x04, ...central, ...end, ...ascii(comment)]);
}

describe("detectRomConsole", () => {
  it("reads each console's fixed header, whatever the file is called", () => {
    expect(detectRomConsole("a.bin", rom(64, 0, [0x4e, 0x45, 0x53, 0x1a]))).toBe("fc");
    expect(detectRomConsole("a.bin", rom(512, 4, [0x24, 0xff, 0xae, 0x51]))).toBe("gba");
    expect(detectRomConsole("a.bin", rom(0x200, 0x100, ascii("SEGA MEGA DRIVE")))).toBe("md");
    const gb = rom(0x200, 0x104, [0xce, 0xed, 0x66, 0x66]);
    expect(detectRomConsole("a.bin", gb)).toBe("gb");
    gb[0x143] = 0xc0;
    expect(detectRomConsole("a.bin", gb)).toBe("gbc");
    gb[0x143] = 0x80;
    expect(detectRomConsole("a.gb", gb)).toBe("gbc");
  });

  it("names header-less files by extension, ignoring case", () => {
    expect(detectRomConsole("Game.SFC", new Uint8Array(64))).toBe("sfc");
    expect(detectRomConsole("game.smc", new Uint8Array(64))).toBe("sfc");
    expect(detectRomConsole("game.smd", new Uint8Array(64))).toBe("md");
    expect(detectRomConsole("game.nes", new Uint8Array(0))).toBe("fc");
  });

  it("does not guess a raw .bin or an unrelated file", () => {
    expect(detectRomConsole("game.bin", new Uint8Array(1024))).toBeNull();
    expect(detectRomConsole("notes.txt", new Uint8Array(16))).toBeNull();
    expect(detectRomConsole("noextension", new Uint8Array(0))).toBeNull();
    expect(detectRomConsole("x.constructor", new Uint8Array(16))).toBeNull();
  });

  it("looks inside a zip, past files that are not ROMs and past a comment", () => {
    expect(zipEntries(zip(["a.txt", "dir/b.gba"])).map((e) => e.name)).toEqual(["a.txt", "dir/b.gba"]);
    expect(detectRomConsole("x.zip", zip(["readme.txt", "dir/game.GBA"]))).toBe("gba");
    expect(detectRomConsole("x.zip", zip(["game.sfc"], `PK\u0005\u0006${"x".repeat(40)}`))).toBe("sfc");
    expect(detectRomConsole("x.zip", zip(["game.bin"]))).toBeNull();
    expect(detectRomConsole("x.zip", zip(["readme.txt"]))).toBeNull();
  });

  it("does not read Markdown in a zip as a Mega Drive ROM", () => {
    expect(detectRomConsole("x.zip", zip(["README.md", "game.gba"], "", { "README.md": 4000 }))).toBe("gba");
    expect(detectRomConsole("x.zip", zip(["README.md", "game.bin"], "", { "README.md": 4000 }))).toBeNull();
    expect(detectRomConsole("x.zip", zip(["game.md"], "", { "game.md": 512 * 1024 }))).toBe("md");
    expect(detectRomConsole("x.zip", zip(["game.gen"]))).toBe("md");
  });

  it("prefers other entries to a large Markdown file, and reads a bare one as text", () => {
    expect(detectRomConsole("x.zip", zip(["README.md", "game.gba"], "", { "README.md": 100_000 }))).toBe("gba");
    expect(detectRomConsole("notes.md", new Uint8Array(4000))).toBeNull();
    expect(detectRomConsole("game.md", new Uint8Array(128 * 1024))).toBe("md");
  });

  it("falls back to the file name when bytes only look like a zip", () => {
    expect(detectRomConsole("game.sfc", new Uint8Array([0x50, 0x4b, 0x10, 0x20]))).toBe("sfc");
    expect(detectRomConsole("game.sfc", new Uint8Array([0x50, 0x4b, 0x03, 0x04]))).toBe("sfc");
  });

  it("accepts the leading-space Mega Drive header", () => {
    expect(detectRomConsole("a.bin", rom(0x200, 0x100, ascii(" SEGA GENESIS")))).toBe("md");
  });

  it("survives a damaged zip", () => {
    expect(detectRomConsole("x.zip", new Uint8Array([0x50, 0x4b, 0x03, 0x04]))).toBeNull();
    const cut = zip(["game.nes"]);
    new DataView(cut.buffer).setUint16(4 + 28, 0xffff, true);
    expect(() => detectRomConsole("x.zip", cut)).not.toThrow();
    const hostile = zip(["game.nes"]);
    new DataView(hostile.buffer).setUint32(hostile.length - 6, 0xffffffff, true);
    expect(detectRomConsole("x.zip", hostile)).toBeNull();
  });

  it("uses the same cores and file types as the game catalog", () => {
    for (const id of ROM_CONSOLES) {
      const game = GAMES.find((g) => g.console === id)!;
      expect(game.core, id).toBe(ROM_CORE[id]);
      for (const ext of game.accept.split(",")) expect(ROM_ACCEPT.split(","), ext).toContain(ext);
    }
  });
});

describe("registration", () => {
  it("lists both tools under the games group and keeps them out of analytics", () => {
    expect(CATEGORIES.find((c) => c.id === "games")?.tools).toEqual(["rom-emulator", "flash-player", "sudoku", "tic-tac-toe", "2048", "dinosaur-game", "mahjong", "chess", "chinese-chess"]);
    for (const id of ["rom-emulator", "flash-player"] as const) {
      expect(TOOLS).toContain(id);
      expect(parseAppPath(`/en/${id}/`)).toMatchObject({ kind: "app", tool: id });
      expect(isTrackedPath(`/en/${id}/`), id).toBe(false);
      expect(dataHandling(id)).toBe("Processes files in the page. Files are not uploaded.");
    }
  });
});

describe("tool pages", () => {
  let host: HTMLElement;
  let frameSrc: string[] = [];

  const q = <T extends HTMLElement>(sel: string): T => host.querySelector<T>(sel)!;
  const flush = async (): Promise<void> => {
    for (let i = 0; i < 5; i += 1) await Promise.resolve();
    await new Promise((resolve) => { setTimeout(resolve, 0); });
  };
  const pick = async (file: File): Promise<void> => {
    const input = q<HTMLInputElement>("input[type=file]");
    Object.defineProperty(input, "files", { configurable: true, get: () => [file] });
    input.dispatchEvent(new Event("change"));
    await flush();
  };

  beforeEach(() => {
    frameSrc = [];
    host = document.createElement("div");
    document.body.append(host);
    vi.spyOn(HTMLIFrameElement.prototype, "src", "set").mockImplementation((value: string) => { frameSrc.push(value); });
    vi.spyOn(HTMLIFrameElement.prototype, "src", "get").mockImplementation(() => frameSrc[frameSrc.length - 1] ?? "about:blank");
  });

  afterEach(() => {
    unmountRomEmulator();
    host.remove();
    vi.restoreAllMocks();
  });

  it("starts empty, with no emulator loaded at mount", () => {
    mountRomEmulator(host);
    expect(q(".game-empty").hidden).toBe(false);
    expect(q("[data-out=controls]").children).toHaveLength(0);
    expect(frameSrc.filter((src) => src !== "about:blank")).toEqual([]);
  });

  it("boots the detected core and shows that console's keys", async () => {
    mountRomEmulator(host);
    await pick(new File([rom(64, 0, [0x4e, 0x45, 0x53, 0x1a]) as BlobPart], "game.bin"));
    expect(q(".game-empty").hidden).toBe(true);
    expect(frameSrc.at(-1)).toContain("/emu/player");
    expect(frameSrc.at(-1)).toContain("core=nes");
    // A local file name must never reach the server in a URL.
    expect(frameSrc.at(-1)).not.toContain("game.bin");
    expect(q("[data-out=controls] .game-controls")).toBeTruthy();
  });

  it("asks for a console when the file does not say, then boots the choice", async () => {
    mountRomEmulator(host);
    await pick(new File([new Uint8Array(32)], "game.bin"));
    expect(frameSrc.filter((src) => src !== "about:blank")).toEqual([]);
    expect(q("[data-out=status]").textContent).toBeTruthy();
    const select = q<HTMLSelectElement>("[data-field=console]");
    select.value = "md";
    select.dispatchEvent(new Event("change"));
    expect(frameSrc.at(-1)).toContain("core=segaMD");
  });

  it("reloads the frame with the new core when the choice changes", async () => {
    mountRomEmulator(host);
    await pick(new File([rom(64, 0, [0x4e, 0x45, 0x53, 0x1a]) as BlobPart], "game.nes"));
    const before = frameSrc.length;
    const select = q<HTMLSelectElement>("[data-field=console]");
    select.value = "sfc";
    select.dispatchEvent(new Event("change"));
    expect(frameSrc.length).toBe(before + 1);
    expect(frameSrc.at(-1)).toContain("core=snes");
  });

  it("detects a new file even after a manual choice", async () => {
    mountRomEmulator(host);
    await pick(new File([new Uint8Array(32)], "a.bin"));
    const select = q<HTMLSelectElement>("[data-field=console]");
    select.value = "md";
    select.dispatchEvent(new Event("change"));
    await pick(new File([rom(64, 0, [0x4e, 0x45, 0x53, 0x1a]) as BlobPart], "b.nes"));
    expect(select.value).toBe("auto");
    expect(host.querySelector<HTMLIFrameElement>("iframe")?.isConnected).toBe(true);
    expect(frameSrc.at(-1)).toContain("core=nes");
  });

  it("swaps the iframe instead of navigating it again, so Back leaves the page", async () => {
    mountRomEmulator(host);
    await pick(new File([rom(64, 0, [0x4e, 0x45, 0x53, 0x1a]) as BlobPart], "a.nes"));
    const first = q("iframe");
    await pick(new File([rom(64, 0, [0x4e, 0x45, 0x53, 0x1a]) as BlobPart], "b.nes"));
    expect(q("iframe")).not.toBe(first);
    expect(host.querySelectorAll("iframe")).toHaveLength(1);
  });

  it("keeps the last game when the next file is refused", async () => {
    mountRomEmulator(host);
    await pick(new File([rom(64, 0, [0x4e, 0x45, 0x53, 0x1a]) as BlobPart], "a.nes"));
    const before = frameSrc.length;
    const big = new File([new Uint8Array(1)], "disc.bin");
    Object.defineProperty(big, "size", { value: MAX_ROM_BYTES + 1 });
    await pick(big);
    expect(frameSrc.length).toBe(before);
    expect(q("[data-out=controls] .game-controls")).toBeTruthy();
  });

  it("leaves focus on the select for keyboard choices", async () => {
    mountRomEmulator(host);
    await pick(new File([new Uint8Array(32)], "a.bin"));
    const select = q<HTMLSelectElement>("[data-field=console]");
    select.focus();
    select.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
    select.value = "fc";
    select.dispatchEvent(new Event("change"));
    expect(document.activeElement).toBe(select);
  });

  it("refuses a file too big to be a cartridge without reading it", async () => {
    mountRomEmulator(host);
    const big = new File([new Uint8Array(1)], "disc.bin");
    Object.defineProperty(big, "size", { value: MAX_ROM_BYTES + 1 });
    const read = vi.spyOn(big, "arrayBuffer");
    await pick(big);
    expect(read).not.toHaveBeenCalled();
    expect(q("[data-out=status]").textContent).toContain("64");
  });

  it("does not restart the game when the choice needs the core already running", async () => {
    mountRomEmulator(host);
    await pick(new File([rom(64, 0, [0x4e, 0x45, 0x53, 0x1a]) as BlobPart], "a.nes"));
    const before = frameSrc.length;
    const select = q<HTMLSelectElement>("[data-field=console]");
    select.value = "fc";
    select.dispatchEvent(new Event("change"));
    select.value = "auto";
    select.dispatchEvent(new Event("change"));
    expect(frameSrc.length).toBe(before);
  });

  it("stops the last game when a new file does not name its console", async () => {
    mountRomEmulator(host);
    await pick(new File([rom(64, 0, [0x4e, 0x45, 0x53, 0x1a]) as BlobPart], "a.nes"));
    await pick(new File([new Uint8Array(32)], "b.bin"));
    expect(frameSrc.at(-1)).toBe("about:blank");
    expect(q("[data-out=controls]").children).toHaveLength(0);
  });

  it("keeps a console chosen before any file, and takes keys away from the select", async () => {
    mountRomEmulator(host);
    const select = q<HTMLSelectElement>("[data-field=console]");
    select.value = "md";
    await pick(new File([new Uint8Array(32)], "a.bin"));
    expect(frameSrc.at(-1)).toContain("core=segaMD");
    expect(document.activeElement).toBe(q("iframe"));
  });

  it("drops a read that finished after the page left", async () => {
    mountRomEmulator(host);
    const input = q<HTMLInputElement>("input[type=file]");
    Object.defineProperty(input, "files", { configurable: true, get: () => [new File([rom(64, 0, [0x4e, 0x45, 0x53, 0x1a]) as BlobPart], "a.nes")] });
    input.dispatchEvent(new Event("change"));
    unmountRomEmulator();
    await flush();
    expect(frameSrc.filter((src) => src !== "about:blank")).toEqual([]);
  });

  it("opens a SWF in the Ruffle shell, and only takes .swf", async () => {
    mountFlashPlayer(host);
    expect(q<HTMLInputElement>("input[type=file]").accept).toBe(".swf");
    await pick(new File([new Uint8Array([0x46, 0x57, 0x53])], "movie.swf"));
    expect(frameSrc.at(-1)).toContain("/emu/flash");
    expect(q(".game-empty").hidden).toBe(true);
  });
});
