/**
 * Hubs under /games/: cv.cm's own browser games by kind of play (GAME_KIND_TOOLS in path.ts), plus /games/3d/, a tag hub
 * listing the 3D ones (GAMES_3D). Players search by kind ("card games" 301k, "board games" 368k, "puzzle games" 110k a
 * month in the US) far more than by "3d games" (14.8k): docs/games-keyword-plan.md. /games/mini/ (all games in one
 * list until 2026-11-19) 301s to /games/.
 * The emulator catalogue (one page per FC / SFC / GB / GBC / GBA / MD / Flash title) was retired on 2026-11-19: its
 * pages had no search impressions, and a fifth of them could not be played without the visitor's own ROM. The ROM
 * emulator and Flash player tools stay, with a few hosted open-source demo games (src/shared/demo-roms.ts).
 */
export const GAME_KINDS = ["board", "card", "puzzle", "word", "arcade", "sports"] as const;
export type GameKindId = (typeof GAME_KINDS)[number];
export const GAME_HUBS = [...GAME_KINDS, "3d"] as const;
export type GameHubId = (typeof GAME_HUBS)[number];

/** Copy namespace of a hub's title and lead (a key cannot start with a digit in the copy tools, hence g3d). */
export function gameHubNs(hub: GameHubId): string {
  return hub === "3d" ? "games.g3d" : `games.kinds.${hub}`;
}

export function isGameHubId(value: string): value is GameHubId {
  return (GAME_HUBS as readonly string[]).includes(value);
}

/** The systems the emulator tools play. Labels are `games.consoles.<id>`. */
export const EMU_CONSOLES = ["fc", "sfc", "gb", "gbc", "gba", "md", "flash"] as const;
export type EmuConsoleId = (typeof EMU_CONSOLES)[number];

export function isEmuConsoleId(value: string): value is EmuConsoleId {
  return (EMU_CONSOLES as readonly string[]).includes(value);
}

/** A hub id as a copy-key suffix: `meta.titleGames<Suffix>`, `faq.games<Suffix>` ("board" → "Board", "3d" → "3d"). */
export function gameHubKey(hub: GameHubId): string {
  return hub[0].toUpperCase() + hub.slice(1);
}

/** The FAQ copy namespace of a games hub page (shared by the page and its FAQPage JSON-LD). */
export function gamesFaqBase(hub: GameHubId | null | undefined): string {
  if (!hub) return "faq.games";
  return `faq.games${gameHubKey(hub)}`;
}

/**
 * Retired catalogue pages, by system. Their URLs (`/games/<system>/<id>/`, `/games/<id>/`) and the system hubs
 * (`/games/<system>/`) answer 301 with the matching emulator tool. Keep the ids: search engines and old links still
 * ask for them.
 */
const LEGACY_GAMES: Readonly<Record<EmuConsoleId, readonly string[]>> = {
  fc: [
    "super-mario-bros", "contra", "battle-city", "adventure-island", "tetris-nes", "double-dragon", "snow-bros",
    "bubble-bobble", "jackal", "kunio-soccer", "ninja-turtles", "mega-man-2", "zelda-nes", "kung-fu",
    "zooming-secretary", "lan-master", "alter-ego", "lawn-mower", "thwaite", "rhde", "croom", "zap-ruder",
    "air-hockey-nes", "falling-nes", "linear-collision", "nes-runner", "roborun", "sliding-blaster",
    "squirrel-domino", "mega-mountain", "robotfindskitten", "coco-battle-royale-2", "double-action-blaster-guys",
    "lunar-limit", "ralph-4", "neslife",
  ],
  sfc: [
    "super-mario-world", "zelda-alttp", "street-fighter-ii", "chrono-trigger", "super-mario-kart",
    "elevator-madness-dx", "bat-cave", "pipes-snes", "castle-platformer",
  ],
  gb: [
    "pokemon-red", "tetris-gb", "kirby-dream-land", "super-mario-land", "rex-runner-gb", "canight-slime-trials",
    "rex-run-v1-0", "tobutobugirldeluxe", "staticlinkage-skeleton-crew", "sleepingpandagames-moki-the-monster-kid",
    "nikku4211-7heaven", "bit-bang", "wyrmhole", "rhythm-land", "airplanz", "square-fall", "flooder", "maxpirate",
    "mateusdigital-el-jamon-volador", "shock-lobster", "tobutobugirl", "porklike-gb", "grimmrobegames-abducted",
    "carazu", "squishy-the-turtle", "zypher", "escape-obliterizer-dx", "brekstascat", "game-boy-of-life", "airaki",
    "djarky-keychan", "big2small", "adjustris", "alien-invasion", "zone-booth-pizza-palace", "dusky-dungeon",
    "quinevere-gigant-golf", "sushi-nights", "maxpirateeb", "renegade-rush", "demekala-toko", "2048gb", "gb-corp",
    "5-mazes", "jp", "5-mazes-master-levels", "el-dueloroso", "postbot", "libbet", "unstoppable-knight",
    "patmorita-hermano-game-boy", "5-more-mazes", "dawn-will-come", "gb-snake", "domination", "conways-life",
    "space-gb", "keep-up", "gb-wordyl", "dashy-no-witch", "bunkerboy",
  ],
  gbc: [
    "pokemon-gold", "pokemon-crystal", "tyro-shaman", "plyr0-qulqy", "gbstadium", "gbhack",
    "joestrong-monster-within", "crossconnect", "trabant", "rebound", "aevilia", "postie", "geometrix", "ucity",
    "labirinth", "europa-rescue", "potion-panic", "k32-super-rocket", "pelmanism",
  ],
  gba: [
    "pokemon-emerald", "mario-kart-super-circuit", "minish-cap", "pokemon-fire-red", "attack-on-voxelburg", "xniq",
    "breadmakesyoufull-gbadev-containers", "basil-termini-2048-advance", "afska-beat-beast", "butano-fighter",
    "origamiscienceguy-galactic-quest", "hexes", "the-purple-night", "bugtris", "varooom3d", "solar-guard", "feline",
    "collie-defence", "bloxorz-gba", "gbamicrojam23", "glaciadungeon", "coquiman", "the-hat-chooses-the-wizard",
    "meteorain-gba-jam-2021", "skyland", "apotris", "lander-advance", "cascade7", "dungeon-puzzlers-lament",
  ],
  md: [
    "sonic", "streets-of-rage-2", "sonic-2", "miniplanets", "kleleatoms-md", "pixel-dungeon-md",
  ],
  flash: [
    "detruit-les-ballons", "tag-chase", "ricochet-kill", "ending",
  ],
};

const LEGACY_BY_ID = new Map<string, EmuConsoleId>(
  (Object.entries(LEGACY_GAMES) as [EmuConsoleId, readonly string[]][]).flatMap(([c, ids]) => ids.map((id) => [id, c] as const)),
);

/** The system of a retired catalogue game, or undefined. */
export function legacyGameConsole(id: string): EmuConsoleId | undefined {
  return LEGACY_BY_ID.get(id);
}

export const GAME_ROM_BASE = "/emu/roms/";
