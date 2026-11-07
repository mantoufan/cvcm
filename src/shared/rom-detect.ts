import type { GameConsoleId } from "./games";

export type RomConsoleId = Exclude<GameConsoleId, "flash">;

export const ROM_CONSOLES: readonly RomConsoleId[] = ["fc", "sfc", "gb", "gbc", "gba", "md"];

/** EmulatorJS `EJS_core` for each console (gambatte plays GB and GBC). */
export const ROM_CORE: Record<RomConsoleId, string> = {
  fc: "nes",
  sfc: "snes",
  gb: "gb",
  gbc: "gb",
  gba: "gba",
  md: "segaMD",
};

export const ROM_ACCEPT = ".nes,.sfc,.smc,.gb,.gbc,.gba,.md,.gen,.smd,.bin,.zip";

// `.bin` is left out: it is a raw dump of anything, so only a Mega Drive header can name it.
const BY_EXTENSION: Readonly<Record<string, RomConsoleId>> = {
  nes: "fc",
  sfc: "sfc",
  smc: "sfc",
  gb: "gb",
  gbc: "gbc",
  gba: "gba",
  md: "md",
  gen: "md",
  smd: "md",
};

function matches(bytes: Uint8Array, offset: number, expected: readonly number[]): boolean {
  if (bytes.length < offset + expected.length) return false;
  return expected.every((value, i) => bytes[offset + i] === value);
}

function fromExtension(name: string): RomConsoleId | null {
  const ext = name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  return (ext && BY_EXTENSION[ext]) || null;
}

/** Fixed bytes the console's boot code or header requires. SNES has none, so it is named by its extension. */
function fromHeader(bytes: Uint8Array): RomConsoleId | null {
  if (matches(bytes, 0, [0x4e, 0x45, 0x53, 0x1a])) return "fc"; // "NES" + EOF, iNES
  if (matches(bytes, 4, [0x24, 0xff, 0xae, 0x51])) return "gba"; // Nintendo logo in the GBA header
  if (matches(bytes, 0x104, [0xce, 0xed, 0x66, 0x66])) return bytes[0x143]! & 0x80 ? "gbc" : "gb"; // logo; CGB flag
  if (matches(bytes, 0x100, [0x53, 0x45, 0x47, 0x41])) return "md"; // "SEGA"
  return null;
}

/** Names in a zip's central directory, which is stored uncompressed at the end of the file. */
export function zipEntryNames(bytes: Uint8Array): string[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // The end record is 22 bytes plus a comment of at most 65535.
  const floor = Math.max(0, bytes.length - 22 - 0xffff);
  let end = -1;
  for (let i = bytes.length - 22; i >= floor; i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0) return [];
  const names: string[] = [];
  const decoder = new TextDecoder();
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  for (let i = 0; i < count && at + 46 <= bytes.length; i += 1) {
    if (view.getUint32(at, true) !== 0x02014b50) break;
    const nameLength = view.getUint16(at + 28, true);
    const extraLength = view.getUint16(at + 30, true);
    const commentLength = view.getUint16(at + 32, true);
    if (at + 46 + nameLength > bytes.length) break;
    names.push(decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength)));
    at += 46 + nameLength + extraLength + commentLength;
  }
  return names;
}

/** Which console a ROM belongs to, or null when the file does not say (the page then asks). */
export function detectRomConsole(name: string, bytes: Uint8Array): RomConsoleId | null {
  if (matches(bytes, 0, [0x50, 0x4b])) {
    for (const entry of zipEntryNames(bytes)) {
      const found = fromExtension(entry);
      if (found) return found;
    }
    return null;
  }
  return fromHeader(bytes) ?? fromExtension(name);
}
