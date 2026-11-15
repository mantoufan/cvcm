/**
 * The Nostalgia channel under `/{locale}/nostalgia/{id}/`: things people grew up with in the 1980s–2000s (snacks,
 * game consoles, gadgets, playground games, early internet, everyday life) — what each was, when it was around, what
 * it cost, why it went away and whether you can still get it. Written for "what is X / X 是什么 / does X still exist"
 * searches. Entries were chosen with Google Ads Keyword Planner (2026-11-14): Chinese childhood items (唐僧肉, 复读机,
 * 高乐高…) plus objects remembered worldwide (Famicom, Walkman, pagers, Tamagotchi, Y2K).
 */
import type { GameConsoleId } from "./games";
import type { ToolId } from "./path";

export const NOSTALGIA_SEGMENT = "nostalgia";

export const NOSTALGIA_GROUPS = [
  { id: "snacks", entries: ["tangseng-rou", "gaolegao", "white-rabbit", "pop-rocks", "jianlibao", "beibingyang", "xiaohuanxiong", "latiao", "mailisu", "guodanpi", "dunkaroos", "crystal-pepsi", "surge"] },
  { id: "games", entries: ["famicom", "subor", "contra", "game-boy", "tamagotchi", "arcade"] },
  { id: "gadgets", entries: ["walkman", "cassette", "fuduji", "pager", "xiaolingtong", "nokia-3310", "wenquxing", "vcd", "mp3-player", "floppy-disk", "vhs", "discman"] },
  { id: "toys", entries: ["yo-yo", "mini-4wd", "marbles", "yanghua", "tiaopijin", "fanhuasheng", "pogs", "beanie-babies", "furby", "slap-bracelet"] },
  { id: "internet", entries: ["qq-show", "feizhuliu", "jinwutuan", "qianqian-jingting", "y2k", "myspace", "aim", "napster", "dial-up"] },
  { id: "life", entries: ["liangpiao", "datoutie", "xiaomaibu", "blockbuster", "lisa-frank"] },
] as const;

export type NostalgiaGroupId = (typeof NOSTALGIA_GROUPS)[number]["id"];
export type NostalgiaId = (typeof NOSTALGIA_GROUPS)[number]["entries"][number];

export const NOSTALGIA_ENTRIES: readonly NostalgiaId[] = NOSTALGIA_GROUPS.flatMap((group) => group.entries);

/** A nostalgia page: the hub, one entry, or none. */
export type NostalgiaPage = NostalgiaId | "hub" | null;

export function isNostalgiaId(value: string): value is NostalgiaId {
  return (NOSTALGIA_ENTRIES as readonly string[]).includes(value);
}

export function nostalgiaGroupOf(id: NostalgiaId): NostalgiaGroupId {
  return NOSTALGIA_GROUPS.find((group) => (group.entries as readonly string[]).includes(id))!.id;
}

export const NOSTALGIA_PUBLISHED = "2026-11-15";

/** Entries added after the first batch, by id, with the day each went live (set by hand when adding entries). */
/** The second batch (American and Western 1990s things), all live on one day. */
const BATCH2_DATE = "2026-11-16";
const BATCH2: readonly NostalgiaId[] = [
  "dunkaroos", "crystal-pepsi", "surge", "pogs", "beanie-babies", "furby", "slap-bracelet", "vhs", "discman",
  "myspace", "aim", "napster", "dial-up", "blockbuster", "lisa-frank",
];

/** Entries added after the first batch, by id, with the day each went live (set by hand when adding entries). */
export const NOSTALGIA_ADDED: Partial<Record<NostalgiaId, string>> = Object.fromEntries(BATCH2.map((id) => [id, BATCH2_DATE]));

/** When an entry went live. */
export function nostalgiaPublished(id: NostalgiaId): string {
  return NOSTALGIA_ADDED[id] ?? NOSTALGIA_PUBLISHED;
}

/** Entries edited after they were published, for dateModified and the sitemap. */
export const NOSTALGIA_UPDATED: Partial<Record<NostalgiaId, string>> = {};

/** The hub's own copy (lede, about, FAQ, group labels in src/locales/nostalgia/<locale>.json) last edited; set by hand. */
export const NOSTALGIA_HUB_UPDATED: string | null = BATCH2_DATE;

/** When an entry last changed: its edit date, else the day it went live (the page's dateModified and its sitemap lastmod). */
export function nostalgiaUpdated(id: NostalgiaId): string {
  return NOSTALGIA_UPDATED[id] ?? nostalgiaPublished(id);
}

/** Entries the site footer links directly (Keyword Planner volume plus the channel's namesakes); names are core-pack `nostalgiaFocus.*`. */
export const NOSTALGIA_FOCUS = [
  "famicom",
  "tamagotchi",
  "y2k",
  "white-rabbit",
  "pop-rocks",
  "walkman",
  "pager",
  "datoutie",
  "tangseng-rou",
  "fuduji",
] as const satisfies readonly NostalgiaId[];

/** cv.cm pages an entry links to: tools you can use today and game consoles you can still play in the page. */
export const NOSTALGIA_LINKS: Partial<Record<NostalgiaId, { tools?: readonly ToolId[]; consoles?: readonly GameConsoleId[] }>> = {
  famicom: { consoles: ["fc"], tools: ["rom-emulator"] },
  subor: { consoles: ["fc"], tools: ["rom-emulator"] },
  contra: { consoles: ["fc"], tools: ["rom-emulator"] },
  "game-boy": { consoles: ["gb", "gbc"], tools: ["rom-emulator"] },
  "nokia-3310": { tools: ["snake-game"] },
  fuduji: { tools: ["voice-recorder"] },
  cassette: { tools: ["voice-recorder"] },
};
