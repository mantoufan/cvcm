export const GAME_CONSOLES = ["fc", "sfc", "gb", "gbc", "gba", "md"] as const;
export type GameConsoleId = (typeof GAME_CONSOLES)[number];

export const GAME_GENRES = [
  "platform",
  "action",
  "shooting",
  "rpg",
  "puzzle",
  "fighting",
  "racing",
] as const;
export type GameGenreId = (typeof GAME_GENRES)[number];

export type GameCheat = {
  id: string;
  code: string;
};

export type Game = {
  id: string;
  console: GameConsoleId;
  genre: GameGenreId;
  year: number;
  /** EmulatorJS `EJS_core` id. */
  core: "nes" | "snes" | "gb" | "gbc" | "gba" | "segaMD";
  accept: string;
  /** Hosted on S3 only when the ROM is freeware / homebrew we may redistribute. */
  rom?: string;
  cheats: readonly GameCheat[];
};

export const GAMES: readonly Game[] = [
  {
    id: "super-mario-bros",
    console: "fc",
    genre: "platform",
    year: 1985,
    core: "nes",
    accept: ".nes,.zip",
    cheats: [
      { id: "lives", code: "SZVVOVAS" },
      { id: "invincible", code: "AVSUZSVZ" },
      { id: "moon", code: "AEKPTZGP" },
      { id: "fire", code: "APZLUGLA" },
    ],
  },
  {
    id: "contra",
    console: "fc",
    genre: "shooting",
    year: 1988,
    core: "nes",
    accept: ".nes,.zip",
    cheats: [
      { id: "lives", code: "SLTUIL" },
      { id: "thirty", code: "30 lives (title: ↑↑↓↓←→←→BA then Start)" },
      { id: "spread", code: "GXUJULSX" },
      { id: "rapid", code: "AENYLGEY" },
    ],
  },
  {
    id: "battle-city",
    console: "fc",
    genre: "action",
    year: 1985,
    core: "nes",
    accept: ".nes,.zip",
    cheats: [
      { id: "lives", code: "SZUVLNVK" },
      { id: "stage", code: "PAUVEZAA+ZAUVOZPA" },
      { id: "armor", code: "AEVVOZPA" },
      { id: "freeze", code: "GXVVPKVK" },
    ],
  },
  {
    id: "adventure-island",
    console: "fc",
    genre: "platform",
    year: 1986,
    core: "nes",
    accept: ".nes,.zip",
    cheats: [
      { id: "lives", code: "SZEXTKVK" },
      { id: "invincible", code: "OTUXLGEY" },
      { id: "skate", code: "ZEEXTKPA" },
      { id: "weapon", code: "GXEXTKVK" },
    ],
  },
  {
    id: "tetris-nes",
    console: "fc",
    genre: "puzzle",
    year: 1989,
    core: "nes",
    accept: ".nes,.zip",
    cheats: [
      { id: "level", code: "PAOPZLAA" },
      { id: "speed", code: "AEEPZLPA" },
      { id: "next", code: "GXOPZLVK" },
      { id: "slow", code: "AEEPZLEA" },
    ],
  },
  {
    id: "double-dragon",
    console: "fc",
    genre: "fighting",
    year: 1988,
    core: "nes",
    accept: ".nes,.zip",
    cheats: [
      { id: "lives", code: "SZUEUOVK" },
      { id: "energy", code: "GXUEUOSE" },
      { id: "weapon", code: "AEEEUOPA" },
      { id: "continue", code: "OXuEuOSE" },
    ],
  },
  {
    id: "super-mario-world",
    console: "sfc",
    genre: "platform",
    year: 1990,
    core: "snes",
    accept: ".sfc,.smc,.zip",
    cheats: [
      { id: "lives", code: "DDA4-AF6F" },
      { id: "star", code: "DDA4-A4AF" },
      { id: "yoshi", code: "DDA4-A4DF" },
      { id: "cape", code: "DDA4-A46F" },
    ],
  },
  {
    id: "zelda-alttp",
    console: "sfc",
    genre: "rpg",
    year: 1991,
    core: "snes",
    accept: ".sfc,.smc,.zip",
    cheats: [
      { id: "rupees", code: "DDEE-A4AF" },
      { id: "hearts", code: "DDEE-AF6F" },
      { id: "keys", code: "DDEE-A46F" },
      { id: "sword", code: "DDEE-A4DF" },
    ],
  },
  {
    id: "street-fighter-ii",
    console: "sfc",
    genre: "fighting",
    year: 1992,
    core: "snes",
    accept: ".sfc,.smc,.zip",
    cheats: [
      { id: "energy", code: "DDFE-A4AF" },
      { id: "time", code: "DDFE-AF6F" },
      { id: "special", code: "DDFE-A46F" },
      { id: "speed", code: "DDFE-A4DF" },
    ],
  },
  {
    id: "pokemon-red",
    console: "gb",
    genre: "rpg",
    year: 1996,
    core: "gb",
    accept: ".gb,.gbc,.zip",
    cheats: [
      { id: "walk", code: "01FF0D01" },
      { id: "money", code: "01909C53" },
      { id: "rare", code: "01017ED3" },
      { id: "repel", code: "01017F01" },
    ],
  },
  {
    id: "tetris-gb",
    console: "gb",
    genre: "puzzle",
    year: 1989,
    core: "gb",
    accept: ".gb,.gbc,.zip",
    cheats: [
      { id: "level", code: "0109C1C3" },
      { id: "next", code: "0100C0C3" },
      { id: "slow", code: "0100C2C3" },
      { id: "score", code: "0199C4C3" },
    ],
  },
  {
    id: "kirby-dream-land",
    console: "gb",
    genre: "platform",
    year: 1992,
    core: "gb",
    accept: ".gb,.gbc,.zip",
    cheats: [
      { id: "lives", code: "0109E2DB" },
      { id: "health", code: "0106E3DB" },
      { id: "invincible", code: "0101E4DB" },
      { id: "star", code: "0101E5DB" },
    ],
  },
  {
    id: "pokemon-gold",
    console: "gbc",
    genre: "rpg",
    year: 1999,
    core: "gbc",
    accept: ".gbc,.gb,.zip",
    cheats: [
      { id: "walk", code: "01FF0098" },
      { id: "money", code: "019090D8" },
      { id: "repel", code: "01017F01" },
      { id: "rare", code: "01017ED3" },
    ],
  },
  {
    id: "pokemon-emerald",
    console: "gba",
    genre: "rpg",
    year: 2004,
    core: "gba",
    accept: ".gba,.zip",
    cheats: [
      { id: "walk", code: "509C1C1F 4E230865" },
      { id: "money", code: "D8BAE4D9 4864DCE5" },
      { id: "rare", code: "A86CDBA5 19BA49B3" },
      { id: "repel", code: "6C5DCB19 7F3E3A5A" },
    ],
  },
  {
    id: "mario-kart-super-circuit",
    console: "gba",
    genre: "racing",
    year: 2001,
    core: "gba",
    accept: ".gba,.zip",
    cheats: [
      { id: "stars", code: "33001880 00000063" },
      { id: "laps", code: "33001884 00000002" },
      { id: "ghost", code: "33001888 00000001" },
      { id: "all", code: "3300188C 000000FF" },
    ],
  },
  {
    id: "minish-cap",
    console: "gba",
    genre: "rpg",
    year: 2004,
    core: "gba",
    accept: ".gba,.zip",
    cheats: [
      { id: "rupees", code: "33002432 03E7" },
      { id: "hearts", code: "3300242A 00A0" },
      { id: "keys", code: "3300243C 0009" },
      { id: "sword", code: "33002440 0005" },
    ],
  },
  {
    id: "sonic",
    console: "md",
    genre: "platform",
    year: 1991,
    core: "segaMD",
    accept: ".md,.gen,.bin,.smd,.zip",
    cheats: [
      { id: "lives", code: "FFFE12:0009" },
      { id: "rings", code: "FFFE20:00C8" },
      { id: "debug", code: "Level select: ↑↓←→ hold A, Start" },
      { id: "invincible", code: "FFFE18:0001" },
    ],
  },
  {
    id: "streets-of-rage-2",
    console: "md",
    genre: "action",
    year: 1992,
    core: "segaMD",
    accept: ".md,.gen,.bin,.smd,.zip",
    cheats: [
      { id: "lives", code: "FFEF81:0009" },
      { id: "special", code: "FFEF84:0009" },
      { id: "level", code: "FFEF80:0005" },
      { id: "same", code: "Same character: B+Start on character" },
    ],
  },
  {
    id: "snow-bros",
    console: "fc",
    genre: "action",
    year: 1990,
    core: "nes",
    accept: ".nes,.zip",
    cheats: [
      { id: "lives", code: "SZUVLNVK" },
      { id: "invincible", code: "OTUVLGEY" },
      { id: "weapon", code: "GXUVLNVK" },
      { id: "boss", code: "AEEVLNPA" },
    ],
  },
  {
    id: "bubble-bobble",
    console: "fc",
    genre: "action",
    year: 1988,
    core: "nes",
    accept: ".nes,.zip",
    cheats: [
      { id: "lives", code: "SZEXTKVK" },
      { id: "rapid", code: "AEEVTKPA" },
      { id: "skip", code: "PAEXTKAA" },
      { id: "ending", code: "GXEXTKVK" },
    ],
  },
  {
    id: "jackal",
    console: "fc",
    genre: "shooting",
    year: 1988,
    core: "nes",
    accept: ".nes,.zip",
    cheats: [
      { id: "lives", code: "SZUVOZVK" },
      { id: "ammo", code: "GXUVOZSE" },
      { id: "speed", code: "AEUVOZPA" },
      { id: "invincible", code: "OTUVOZEY" },
    ],
  },
  {
    id: "kunio-soccer",
    console: "fc",
    genre: "action",
    year: 1988,
    core: "nes",
    accept: ".nes,.zip",
    cheats: [
      { id: "score", code: "PAUVEZAA" },
      { id: "time", code: "AEUVEZPA" },
      { id: "stamina", code: "SZUVEZVK" },
      { id: "super", code: "GXUVEZSE" },
    ],
  },
  {
    id: "ninja-turtles",
    console: "fc",
    genre: "action",
    year: 1989,
    core: "nes",
    accept: ".nes,.zip",
    cheats: [
      { id: "lives", code: "SZNTEZVK" },
      { id: "energy", code: "GXNTEZSE" },
      { id: "weapon", code: "AENTEZPA" },
      { id: "pizza", code: "OTNTEZEY" },
    ],
  },
  {
    id: "mega-man-2",
    console: "fc",
    genre: "platform",
    year: 1988,
    core: "nes",
    accept: ".nes,.zip",
    cheats: [
      { id: "lives", code: "SZKGELVK" },
      { id: "energy", code: "GXKGELSE" },
      { id: "weapon", code: "AEKGELPA" },
      { id: "rush", code: "OTKGELEY" },
    ],
  },
  {
    id: "zelda-nes",
    console: "fc",
    genre: "rpg",
    year: 1986,
    core: "nes",
    accept: ".nes,.zip",
    cheats: [
      { id: "hearts", code: "SZKGOLVK" },
      { id: "rupees", code: "PAKGOLAA" },
      { id: "keys", code: "AEKGOLPA" },
      { id: "sword", code: "GXKGOLSE" },
    ],
  },
  {
    id: "kung-fu",
    console: "fc",
    genre: "fighting",
    year: 1985,
    core: "nes",
    accept: ".nes,.zip",
    cheats: [
      { id: "lives", code: "SZKGILVK" },
      { id: "energy", code: "GXKGILSE" },
      { id: "time", code: "AEKGILPA" },
      { id: "kick", code: "OTKGILEY" },
    ],
  },
  {
    id: "chrono-trigger",
    console: "sfc",
    genre: "rpg",
    year: 1995,
    core: "snes",
    accept: ".sfc,.smc,.zip",
    cheats: [
      { id: "hp", code: "DDA4-A4AF" },
      { id: "mp", code: "DDA4-AF6F" },
      { id: "gold", code: "DDA4-A46F" },
      { id: "tech", code: "DDA4-A4DF" },
    ],
  },
  {
    id: "super-mario-kart",
    console: "sfc",
    genre: "racing",
    year: 1992,
    core: "snes",
    accept: ".sfc,.smc,.zip",
    cheats: [
      { id: "stars", code: "DDFE-A4AF" },
      { id: "laps", code: "DDFE-AF6F" },
      { id: "ghost", code: "DDFE-A46F" },
      { id: "unlock", code: "DDFE-A4DF" },
    ],
  },
  {
    id: "super-mario-land",
    console: "gb",
    genre: "platform",
    year: 1989,
    core: "gb",
    accept: ".gb,.gbc,.zip",
    cheats: [
      { id: "lives", code: "0109E2DB" },
      { id: "invincible", code: "0101E4DB" },
      { id: "flower", code: "0101E5DB" },
      { id: "stage", code: "0103E6DB" },
    ],
  },
  {
    id: "pokemon-crystal",
    console: "gbc",
    genre: "rpg",
    year: 2000,
    core: "gbc",
    accept: ".gbc,.gb,.zip",
    cheats: [
      { id: "walk", code: "01FF0098" },
      { id: "money", code: "019090D8" },
      { id: "repel", code: "01017F01" },
      { id: "rare", code: "01017ED3" },
    ],
  },
  {
    id: "pokemon-fire-red",
    console: "gba",
    genre: "rpg",
    year: 2004,
    core: "gba",
    accept: ".gba,.zip",
    cheats: [
      { id: "walk", code: "509C1C1F 4E230865" },
      { id: "money", code: "D8BAE4D9 4864DCE5" },
      { id: "rare", code: "A86CDBA5 19BA49B3" },
      { id: "repel", code: "6C5DCB19 7F3E3A5A" },
    ],
  },
  {
    id: "sonic-2",
    console: "md",
    genre: "platform",
    year: 1992,
    core: "segaMD",
    accept: ".md,.gen,.bin,.smd,.zip",
    cheats: [
      { id: "lives", code: "FFFE12:0009" },
      { id: "rings", code: "FFFE20:00C8" },
      { id: "debug", code: "Level select: ↑↑↓↓↓↓←→←→ hold A, Start" },
      { id: "invincible", code: "FFFE18:0001" },
    ],
  },
  {
    id: "zooming-secretary",
    console: "fc",
    genre: "action",
    year: 2011,
    core: "nes",
    accept: ".nes,.zip",
    rom: "zooming-secretary.nes",
    cheats: [],
  },
  {
    id: "lan-master",
    console: "fc",
    genre: "puzzle",
    year: 2011,
    core: "nes",
    accept: ".nes,.zip",
    rom: "lan-master.nes",
    cheats: [],
  },
  {
    id: "alter-ego",
    console: "fc",
    genre: "puzzle",
    year: 2011,
    core: "nes",
    accept: ".nes,.zip",
    rom: "alter-ego.nes",
    cheats: [],
  },
  {
    id: "lawn-mower",
    console: "fc",
    genre: "action",
    year: 2011,
    core: "nes",
    accept: ".nes,.zip",
    rom: "lawn-mower.nes",
    cheats: [],
  },
] as const;

export type GameId = (typeof GAMES)[number]["id"];

const GAME_BY_ID = new Map<string, Game>(GAMES.map((game) => [game.id, game]));

export function isGameConsoleId(value: string): value is GameConsoleId {
  return (GAME_CONSOLES as readonly string[]).includes(value);
}

export function isGameId(value: string): value is GameId {
  return GAME_BY_ID.has(value);
}

export function gameById(id: string): Game | undefined {
  return GAME_BY_ID.get(id);
}

export function gamesFor(
  consoleId?: GameConsoleId | null,
  genre?: GameGenreId | null,
): readonly Game[] {
  return GAMES.filter((game) => {
    if (consoleId && game.console !== consoleId) return false;
    if (genre && game.genre !== genre) return false;
    return true;
  });
}

export function isGameGenreId(value: string): value is GameGenreId {
  return (GAME_GENRES as readonly string[]).includes(value);
}

export const GAME_EMU_DATA = "/emu/data/";
export const GAME_ROM_BASE = "/emu/roms/";
export const GAME_S3_PREFIX = "https://files.s3.cv.cm/games/";

const ROM_EXT: Record<GameConsoleId, string> = {
  fc: ".nes",
  sfc: ".sfc",
  gb: ".gb",
  gbc: ".gbc",
  gba: ".gba",
  md: ".md",
};

/** S3 object name under `/emu/roms/`. Hosted when that object exists; every page still accepts a local file. */
export function gameRomFile(game: Game): string {
  return game.rom ?? `${game.id}${ROM_EXT[game.console]}`;
}
