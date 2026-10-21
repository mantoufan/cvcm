import type { GameId } from "./games";

/** How the listed product differs from the version on this page; omitted when it is the same game. */
export type OfficialEdition = "arcade" | "gba" | "genesis" | "pc" | "remake" | "rerelease";

export type OfficialWay = {
  kind: "sub" | "buy";
  platform: string;
  product: string;
  url: string;
  /** The game's own name inside the product, when the product name does not show it. */
  title?: string;
  edition?: OfficialEdition;
};

/** Date the store pages were last opened and checked (US Nintendo eShop, Nintendo Switch Online catalog, Steam). */
export const OFFICIAL_CHECKED = "2026-10-22";

const NSO = "https://www.nintendo.com/us/online/nintendo-switch-online/classic-games/";
const NSO_NES = { kind: "sub", platform: "Nintendo Switch", product: "Nintendo Switch Online · Nintendo Entertainment System – Nintendo Classics", url: NSO } as const;
const NSO_SNES = { kind: "sub", platform: "Nintendo Switch", product: "Nintendo Switch Online · Super Nintendo Entertainment System – Nintendo Classics", url: NSO } as const;
const NSO_GB = { kind: "sub", platform: "Nintendo Switch", product: "Nintendo Switch Online · Game Boy – Nintendo Classics", url: NSO } as const;
const NSO_GBA = { kind: "sub", platform: "Nintendo Switch", product: "Nintendo Switch Online + Expansion Pack · Game Boy Advance – Nintendo Classics", url: NSO } as const;
const NSO_MD = {
  kind: "sub",
  platform: "Nintendo Switch",
  product: "Nintendo Switch Online + Expansion Pack · SEGA Genesis – Nintendo Switch Online",
  url: "https://www.nintendo.com/us/store/products/sega-genesis-nintendo-switch-online-switch/",
} as const;
const eshop = (slug: string): string => `https://www.nintendo.com/us/store/products/${slug}/`;
const steam = (app: number): string => `https://store.steampowered.com/app/${app}/`;
const RETRO_BRAWLER: OfficialWay = {
  kind: "buy",
  platform: "Nintendo Switch",
  product: "Double Dragon & Kunio-kun: Retro Brawler Bundle",
  url: eshop("double-dragon-and-kunio-kun-retro-brawler-bundle-switch"),
};
// Remastered versions, not the Mega Drive originals.
const SONIC_ORIGINS: OfficialWay = { kind: "buy", platform: "Steam", product: "Sonic Origins", url: steam(1794960), edition: "rerelease" };

/**
 * Official ways to play each commercial game today (US stores). An empty list means none was found
 * (closed stores such as the Wii Shop and 3DS eShop do not count).
 */
export const GAME_OFFICIAL: Partial<Record<GameId, readonly OfficialWay[]>> = {
  "super-mario-bros": [
    NSO_NES,
    { kind: "buy", platform: "Nintendo Switch", product: "Arcade Archives VS. SUPER MARIO BROS.", url: eshop("arcade-archives-vs-super-mario-bros-switch"), edition: "arcade" },
  ],
  contra: [
    { kind: "buy", platform: "Steam", product: "Contra Anniversary Collection", url: steam(1018020) },
    { kind: "buy", platform: "Nintendo Switch", product: "Arcade Archives CONTRA", url: eshop("arcade-archives-contra-switch"), edition: "arcade" },
  ],
  "battle-city": [
    { kind: "buy", platform: "Steam", product: "NAMCO MUSEUM ARCHIVES Vol 2", url: steam(1254620) },
    { kind: "buy", platform: "Nintendo Switch", product: "Arcade Archives VS. BATTLE CITY", url: eshop("arcade-archives-vs-battle-city-switch"), edition: "arcade" },
  ],
  "adventure-island": [],
  "tetris-nes": [NSO_NES],
  "double-dragon": [
    NSO_NES,
    { kind: "buy", platform: "Nintendo Switch", product: "DOUBLE DRAGON", url: eshop("double-dragon-switch") },
    RETRO_BRAWLER,
  ],
  "snow-bros": [
    { kind: "buy", platform: "Steam", product: "Snow Bros Classic Collection", url: steam(3233400), edition: "rerelease" },
    { kind: "buy", platform: "Steam", product: "SNOW BROS. SPECIAL: ANNIVERSARY EDITION", url: steam(3107890), edition: "remake" },
  ],
  "bubble-bobble": [
    { kind: "buy", platform: "Nintendo Switch 2", product: "Console Archives BUBBLE BOBBLE", url: eshop("console-archives-bubble-bobble-switch-2") },
    { kind: "buy", platform: "Nintendo Switch", product: "Arcade Archives BUBBLE BOBBLE", url: eshop("arcade-archives-bubble-bobble-switch"), edition: "arcade" },
  ],
  jackal: [
    { kind: "buy", platform: "Nintendo Switch", product: "Arcade Archives JACKAL", url: eshop("arcade-archives-jackal-switch"), edition: "arcade" },
  ],
  "kunio-soccer": [RETRO_BRAWLER],
  "ninja-turtles": [
    { kind: "buy", platform: "Steam", product: "Teenage Mutant Ninja Turtles: The Cowabunga Collection", url: steam(1659600) },
    { kind: "buy", platform: "Nintendo Switch", product: "Teenage Mutant Ninja Turtles: The Cowabunga Collection", url: eshop("teenage-mutant-ninja-turtles-the-cowabunga-collection-switch") },
  ],
  "mega-man-2": [
    { kind: "buy", platform: "Steam", product: "Mega Man Legacy Collection", url: steam(363440) },
    { kind: "buy", platform: "Nintendo Switch", product: "Mega Man Legacy Collection", url: eshop("mega-man-legacy-collection-switch") },
  ],
  "zelda-nes": [NSO_NES],
  "kung-fu": [],
  "super-mario-world": [NSO_SNES, { ...NSO_GBA, title: "Super Mario World: Super Mario Advance 2", edition: "gba" }],
  "zelda-alttp": [NSO_SNES, { ...NSO_GBA, title: "The Legend of Zelda: A Link to the Past & Four Swords", edition: "gba" }],
  "street-fighter-ii": [
    { kind: "buy", platform: "Steam", product: "Street Fighter 30th Anniversary Collection", url: steam(586200), edition: "arcade" },
    {
      kind: "buy",
      platform: "Nintendo Switch",
      product: "Capcom Arcade Stadium: STREET FIGHTER II - The World Warrior -",
      url: eshop("capcom-arcade-stadiumstreet-fighter-ii-the-world-warrior-70050000025490-switch"),
      edition: "arcade",
    },
    { ...NSO_MD, title: "Street Fighter II': Special Champion Edition", edition: "genesis" },
  ],
  "chrono-trigger": [{ kind: "buy", platform: "Steam", product: "CHRONO TRIGGER", url: steam(613830), edition: "pc" }],
  "super-mario-kart": [NSO_SNES],
  "pokemon-red": [],
  "tetris-gb": [NSO_GB],
  "kirby-dream-land": [NSO_GB],
  "super-mario-land": [NSO_GB],
  "pokemon-gold": [],
  "pokemon-crystal": [],
  "pokemon-emerald": [],
  "mario-kart-super-circuit": [NSO_GBA],
  "minish-cap": [NSO_GBA],
  "pokemon-fire-red": [
    { kind: "buy", platform: "Nintendo Switch", product: "(English) Pokémon FireRed Version", url: eshop("english-pokemon-firered-version-switch") },
  ],
  sonic: [
    SONIC_ORIGINS,
    { kind: "buy", platform: "Nintendo Switch", product: "SEGA AGES Sonic The Hedgehog", url: eshop("sega-ages-sonic-the-hedgehog-switch") },
  ],
  "streets-of-rage-2": [NSO_MD],
  "sonic-2": [
    NSO_MD,
    SONIC_ORIGINS,
    { kind: "buy", platform: "Nintendo Switch", product: "SEGA AGES Sonic The Hedgehog 2", url: eshop("sega-ages-sonic-the-hedgehog-2-switch") },
  ],
};
