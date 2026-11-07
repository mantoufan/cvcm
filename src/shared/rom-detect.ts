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

/** Twice the biggest cartridge here (32 MiB GBA). Stops a disc image being read and cloned for nothing. */
export const MAX_ROM_BYTES = 64 * 1024 * 1024;

/** A `.md` smaller than this is Markdown. Mega Drive cartridges start at 128 KiB in practice. */
const MIN_MD_BYTES = 64 * 1024;

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
  return ext && Object.hasOwn(BY_EXTENSION, ext) ? BY_EXTENSION[ext]! : null;
}

/** Fixed bytes the console's boot code or header requires. SNES has none, so it is named by its extension. */
function fromHeader(bytes: Uint8Array): RomConsoleId | null {
  if (matches(bytes, 0, [0x4e, 0x45, 0x53, 0x1a])) return "fc"; // "NES" + EOF, iNES
  if (matches(bytes, 4, [0x24, 0xff, 0xae, 0x51])) return "gba"; // Nintendo logo in the GBA header
  if (matches(bytes, 0x104, [0xce, 0xed, 0x66, 0x66])) return bytes[0x143]! & 0x80 ? "gbc" : "gb"; // logo; CGB flag
  if (matches(bytes, 0x100, [0x53, 0x45, 0x47, 0x41]) || matches(bytes, 0x101, [0x53, 0x45, 0x47, 0x41])) return "md"; // "SEGA" or " SEGA"
  return null;
}

type ZipEntry = { name: string; size: number };

/** Entries in a zip's central directory, which is stored uncompressed at the end of the file. */
export function zipEntries(bytes: Uint8Array): ZipEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // The end record is 22 bytes plus a comment of at most 65535.
  const floor = Math.max(0, bytes.length - 22 - 0xffff);
  let end = -1;
  for (let i = bytes.length - 22; i >= floor; i -= 1) {
    // The comment must run exactly to the end of the file, or these bytes are comment text that looks like the record.
    if (view.getUint32(i, true) === 0x06054b50 && i + 22 + view.getUint16(i + 20, true) === bytes.length) {
      end = i;
      break;
    }
  }
  if (end < 0) return [];
  const entries: ZipEntry[] = [];
  const decoder = new TextDecoder();
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  for (let i = 0; i < count && at + 46 <= bytes.length; i += 1) {
    if (view.getUint32(at, true) !== 0x02014b50) break;
    const nameLength = view.getUint16(at + 28, true);
    const extraLength = view.getUint16(at + 30, true);
    const commentLength = view.getUint16(at + 32, true);
    if (at + 46 + nameLength > bytes.length) break;
    entries.push({ name: decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength)), size: view.getUint32(at + 24, true) });
    at += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function fromEntry(name: string, size: number): RomConsoleId | null {
  const found = fromExtension(name);
  if (found === "md" && /\.md$/i.test(name) && size < MIN_MD_BYTES) return null;
  return found;
}

/** Which console a ROM belongs to, or null when the file does not say (the page then asks). */
export function detectRomConsole(name: string, bytes: Uint8Array): RomConsoleId | null {
  if (matches(bytes, 0, [0x50, 0x4b, 0x03, 0x04]) || matches(bytes, 0, [0x50, 0x4b, 0x05, 0x06])) {
    const entries = zipEntries(bytes);
    if (entries.length) {
      // `.md` last: it is also Markdown, and a release's README can sit before the ROM.
      const ordered = [...entries.filter((e) => !/\.md$/i.test(e.name)), ...entries.filter((e) => /\.md$/i.test(e.name))];
      for (const entry of ordered) {
        const found = fromEntry(entry.name, entry.size);
        if (found) return found;
      }
      return null;
    }
  }
  return fromHeader(bytes) ?? fromEntry(name, bytes.length);
}
