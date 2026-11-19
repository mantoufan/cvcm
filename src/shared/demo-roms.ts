import type { EmuConsoleId } from "./games";

/**
 * Open-source / freeware games the emulator tools can start with one click, so a visitor without a ROM can see them
 * work. Each file is served from `/emu/roms/<file>` (S3 `files/games/roms/`). Only titles whose own release allows
 * commercial redistribution; the credit line under the buttons names the author, license and source, as most of
 * these licenses require. Titles are proper names and are not translated.
 */
export type DemoRom = {
  id: string;
  console: EmuConsoleId;
  file: string;
  title: string;
  author: string;
  year: number;
  license: string;
  source: string;
};

export const DEMO_ROMS: readonly DemoRom[] = [
  { id: "alter-ego", console: "fc", file: "alter-ego.nes", title: "Alter Ego", author: "Shiru", year: 2011, license: "Freeware", source: "https://shiru.untergrund.net/software.shtml" },
  { id: "lunar-limit", console: "fc", file: "lunar-limit.nes", title: "Lunar Limit", author: "Pubby", year: 2017, license: "MIT", source: "https://github.com/pubby/lunarlimit" },
  { id: "double-action-blaster-guys", console: "fc", file: "double-action-blaster-guys.nes", title: "Double Action Blaster Guys", author: "NovaSquirrel", year: 2014, license: "zlib", source: "https://github.com/NovaSquirrel/DABG" },
  { id: "elevator-madness-dx", console: "sfc", file: "elevator-madness-dx.sfc", title: "Elevator Madness DX", author: "undisbeliever", year: 2015, license: "MIT", source: "https://github.com/undisbeliever/elevator-madness-dx" },
  { id: "castle-platformer", console: "sfc", file: "castle-platformer.sfc", title: "Castle Platformer", author: "undisbeliever", year: 2015, license: "MIT, art CC0", source: "https://github.com/undisbeliever/castle_platformer" },
  { id: "pipes-snes", console: "sfc", file: "pipes-snes.sfc", title: "Pipes", author: "undisbeliever", year: 2015, license: "MIT", source: "https://github.com/undisbeliever/pipes" },
  { id: "tobutobugirldeluxe", console: "gb", file: "tobutobugirldeluxe.gb", title: "Tobu Tobu Girl Deluxe", author: "Tangram Games", year: 2018, license: "MIT", source: "https://github.com/SimonLarsen/tobutobugirl-dx" },
  { id: "porklike-gb", console: "gb", file: "porklike-gb.gb", title: "Porklike GB", author: "binji", year: 2018, license: "MIT", source: "https://github.com/binji/porklike.gb" },
  { id: "shock-lobster", console: "gb", file: "shock-lobster.gb", title: "Shock Lobster", author: "tbsp", year: 2018, license: "zlib", source: "https://github.com/tbsp/shock-lobster" },
  { id: "ucity", console: "gbc", file: "ucity.gbc", title: "µCity", author: "AntonioND", year: 2017, license: "GPL-3.0-or-later, art CC BY-SA 4.0", source: "https://github.com/AntonioND/ucity" },
  { id: "aevilia", console: "gbc", file: "aevilia.gbc", title: "Aevilia", author: "ISSOtm and friends", year: 2018, license: "Apache-2.0", source: "https://github.com/ISSOtm/Aevilia-GB" },
  { id: "geometrix", console: "gbc", file: "geometrix.gbc", title: "Geometrix", author: "AntonioND", year: 2016, license: "GPL-3.0-or-later", source: "https://github.com/AntonioND/geometrix" },
  { id: "apotris", console: "gba", file: "apotris.gba", title: "Apotris", author: "akouzoukos", year: 2021, license: "AGPL-3.0", source: "https://gitea.com/akouzoukos/apotris" },
  { id: "skyland", console: "gba", file: "skyland.gba", title: "Skyland", author: "evanbowman", year: 2018, license: "MPL-2.0", source: "https://github.com/evanbowman/skyland" },
  { id: "dungeon-puzzlers-lament", console: "gba", file: "dungeon-puzzlers-lament.gba", title: "The Dungeon Puzzler's Lament", author: "Gwilym Inzani, Corwin Kuiper", year: 2023, license: "MPL-2.0, art CC BY 4.0, music CC BY 3.0 (VWolfdog)", source: "https://github.com/agbrs/agb/tree/f4214b5da8a4a2d08f6ed7bd56cbbd147586a493/examples/the-dungeon-puzzlers-lament" },
  { id: "miniplanets", console: "md", file: "miniplanets.md", title: "Miniplanets", author: "Sik", year: 2016, license: "zlib", source: "https://github.com/sikthehedgehog/miniplanets" },
  { id: "pixel-dungeon-md", console: "md", file: "pixel-dungeon-md.md", title: "Pixel Dungeon: Mega Drive Edition", author: "2 Drinks In Games, after Watabou", year: 2026, license: "GPL-3.0", source: "https://s3.cv.cm/files/games/src/pixel-dungeon-md-source.zip" },
  { id: "kleleatoms-md", console: "md", file: "kleleatoms-md.md", title: "KłełeAtoms MD", author: "Nightwolf-47", year: 2022, license: "MIT", source: "https://github.com/Nightwolf-47/KleleAtoms-MD" },
  { id: "detruit-les-ballons", console: "flash", file: "detruit-les-ballons.swf", title: "Detruit Les Ballons", author: "Antoine Boucher", year: 2010, license: "MIT", source: "https://github.com/antoinebou12/FlashGames" },
  { id: "ricochet-kill", console: "flash", file: "ricochet-kill.swf", title: "Ricochet Kill", author: "Antoine Boucher", year: 2010, license: "MIT", source: "https://github.com/antoinebou12/FlashGames" },
  { id: "ending", console: "flash", file: "ending.swf", title: "Ending", author: "Aaron Steed", year: 2013, license: "GPL-2.0", source: "https://github.com/st33d/Ending" },
];

/** The cartridge demos (the ROM emulator) and the SWF demos (the Flash player). */
export const ROM_DEMOS = DEMO_ROMS.filter((rom): rom is DemoRom & { console: Exclude<EmuConsoleId, "flash"> } => rom.console !== "flash");
export const FLASH_DEMOS = DEMO_ROMS.filter((rom) => rom.console === "flash");

/** A demo by id, for the `#demo-<id>` link a retired game page redirects to. */
export function demoById(id: string): DemoRom | undefined {
  return DEMO_ROMS.find((rom) => rom.id === id);
}

/** Every ROM file the site still serves; anything else under S3 `files/games/roms/` is no longer linked. */
export const DEMO_ROM_FILES: ReadonlySet<string> = new Set(DEMO_ROMS.map((rom) => rom.file));
