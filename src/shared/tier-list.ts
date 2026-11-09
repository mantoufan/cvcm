// Tier list board: pure state and layout, shared by the page and tests. Images stay object URLs in the page.

export const MAX_ITEMS = 200;
export const MAX_TIERS = 12;
export const MIN_TIERS = 1;
export const MAX_LABEL = 24;
export const MAX_ITEM_TEXT = 60;
export const PRESET_IDS = ["hang", "sabcd", "feeling"] as const;
export type PresetId = (typeof PRESET_IDS)[number];

/** Red to white, the usual look of both S-to-D charts and the 夯-to-拉 meme. Rows past these repeat the last. */
export const TIER_COLORS = ["#f26d6d", "#f6a55c", "#f8d66d", "#fbf0a8", "#ffffff"] as const;
export const PICK_COLORS = [...TIER_COLORS, "#8ed081", "#8ec9f0", "#c9a7ee"] as const;

export type Item = { id: string; text: string; image?: string };
export type Tier = { id: string; label: string; color: string; items: string[] };
export type Board = { title: string; tiers: Tier[]; pool: string[]; items: Record<string, Item> };
export type Place = { tier: string | null; index: number };

let counter = 0;
export function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}${counter}`;
}

export function colorFor(index: number): string {
  return TIER_COLORS[Math.min(index, TIER_COLORS.length - 1)];
}

export function tierFrom(label: string, index: number): Tier {
  return { id: nextId("t"), label: label.slice(0, MAX_LABEL), color: colorFor(index), items: [] };
}

/** One entry per line or comma-free paste; blank lines go, repeats stay out. */
export function parseItems(text: string, existing: readonly string[] = []): string[] {
  const seen = new Set(existing);
  const out: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const value = line.trim().slice(0, MAX_ITEM_TEXT);
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

export function emptyBoard(labels: readonly string[]): Board {
  return { title: "", tiers: labels.map(tierFrom), pool: [], items: {} };
}

export function itemCount(board: Board): number {
  return Object.keys(board.items).length;
}

/** Adds items to the pool up to MAX_ITEMS; returns how many fitted. */
export function addItems(board: Board, entries: ReadonlyArray<{ text: string; image?: string }>): number {
  let added = 0;
  for (const entry of entries) {
    if (itemCount(board) >= MAX_ITEMS) break;
    const id = nextId("i");
    board.items[id] = { id, text: entry.text.slice(0, MAX_ITEM_TEXT), ...(entry.image ? { image: entry.image } : {}) };
    board.pool.push(id);
    added += 1;
  }
  return added;
}

export function placeOf(board: Board, itemId: string): Place | null {
  const inPool = board.pool.indexOf(itemId);
  if (inPool >= 0) return { tier: null, index: inPool };
  for (const tier of board.tiers) {
    const index = tier.items.indexOf(itemId);
    if (index >= 0) return { tier: tier.id, index };
  }
  return null;
}

function listOf(board: Board, tierId: string | null): string[] | null {
  if (tierId === null) return board.pool;
  return board.tiers.find((tier) => tier.id === tierId)?.items ?? null;
}

/**
 * Moves an item to `index` in the target list, where `index` counts the list as it looks while the item is still in
 * it (what a pointer sees), or to the end when omitted.
 */
export function moveItem(board: Board, itemId: string, tierId: string | null, index?: number): boolean {
  const from = placeOf(board, itemId);
  const target = listOf(board, tierId);
  if (!from || !target) return false;
  const source = listOf(board, from.tier)!;
  let at = index ?? target.length;
  if (source === target && from.index < at) at -= 1;
  source.splice(from.index, 1);
  target.splice(Math.max(0, Math.min(at, target.length)), 0, itemId);
  return true;
}

export function removeItem(board: Board, itemId: string): Item | null {
  const item = board.items[itemId];
  const from = placeOf(board, itemId);
  if (!item || !from) return null;
  listOf(board, from.tier)!.splice(from.index, 1);
  delete board.items[itemId];
  return item;
}

export function addTier(board: Board, label: string): Tier | null {
  if (board.tiers.length >= MAX_TIERS) return null;
  const tier = tierFrom(label, board.tiers.length);
  board.tiers.push(tier);
  return tier;
}

/** A removed row's items go back to the pool, never lost. */
export function removeTier(board: Board, tierId: string): boolean {
  if (board.tiers.length <= MIN_TIERS) return false;
  const index = board.tiers.findIndex((tier) => tier.id === tierId);
  if (index < 0) return false;
  board.pool.push(...board.tiers[index].items);
  board.tiers.splice(index, 1);
  return true;
}

export function moveTier(board: Board, tierId: string, delta: -1 | 1): boolean {
  const index = board.tiers.findIndex((tier) => tier.id === tierId);
  const to = index + delta;
  if (index < 0 || to < 0 || to >= board.tiers.length) return false;
  const [tier] = board.tiers.splice(index, 1);
  board.tiers.splice(to, 0, tier);
  return true;
}

/** Puts new labels on the rows from the top, adding or dropping rows; items from dropped rows go back to the pool. */
export function applyLabels(board: Board, labels: readonly string[]): void {
  while (board.tiers.length > labels.length) {
    const tier = board.tiers.pop()!;
    board.pool.push(...tier.items);
  }
  board.tiers.forEach((tier, index) => {
    tier.label = labels[index].slice(0, MAX_LABEL);
    tier.color = colorFor(index);
  });
  for (let i = board.tiers.length; i < labels.length; i += 1) board.tiers.push(tierFrom(labels[i], i));
}

export function clearPlacements(board: Board): void {
  for (const tier of board.tiers) {
    board.pool.push(...tier.items);
    tier.items = [];
  }
}

/** Plain text for pasting: one row per line; pictures without a name show as `imageLabel`. */
export function boardText(board: Board, imageLabel: string, separator = ", "): string {
  const name = (id: string) => board.items[id].text || imageLabel;
  const rows = board.tiers.map((tier) => `${tier.label}: ${tier.items.map(name).join(separator)}`.trimEnd());
  return [board.title.trim(), ...rows].filter(Boolean).join("\n");
}

const STORE_VERSION = 1;

/** The text part only: pictures are object URLs that die with the page, and they are never written anywhere. */
export function serializeBoard(board: Board): string {
  const textOnly = (ids: string[]) => ids.filter((id) => !board.items[id].image).map((id) => board.items[id].text);
  return JSON.stringify({
    v: STORE_VERSION,
    title: board.title,
    tiers: board.tiers.map((tier) => ({ label: tier.label, color: tier.color, items: textOnly(tier.items) })),
    pool: textOnly(board.pool),
  });
}

const HEX = /^#[0-9a-f]{6}$/i;

export function parseBoard(raw: string | null): Board | null {
  if (!raw) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  const d = data as { v?: unknown; title?: unknown; tiers?: unknown; pool?: unknown };
  if (d?.v !== STORE_VERSION || !Array.isArray(d.tiers) || !Array.isArray(d.pool)) return null;
  if (d.tiers.length < MIN_TIERS || d.tiers.length > MAX_TIERS) return null;
  const board = emptyBoard([]);
  board.title = typeof d.title === "string" ? d.title.slice(0, MAX_ITEM_TEXT) : "";
  const take = (values: unknown): string[] => {
    const ids: string[] = [];
    for (const value of Array.isArray(values) ? values : []) {
      if (typeof value !== "string" || !value.trim() || itemCount(board) >= MAX_ITEMS) continue;
      const id = nextId("i");
      board.items[id] = { id, text: value.slice(0, MAX_ITEM_TEXT) };
      ids.push(id);
    }
    return ids;
  };
  d.tiers.forEach((row: { label?: unknown; color?: unknown; items?: unknown }, index: number) => {
    const tier = tierFrom(typeof row?.label === "string" ? row.label : "", index);
    if (typeof row?.color === "string" && HEX.test(row.color)) tier.color = row.color;
    tier.items = take(row?.items);
    board.tiers.push(tier);
  });
  board.pool = take(d.pool);
  return board;
}

/** Row and cell positions of the exported picture, in CSS pixels. */
export type PngLayout = {
  width: number;
  height: number;
  titleHeight: number;
  rows: Array<{ tierId: string; y: number; height: number; cells: Array<{ id: string; x: number; y: number }> }>;
};

export const PNG_WIDTH = 1000;
export const PNG_LABEL = 130;
export const PNG_CELL = 96;
export const PNG_GAP = 4;
const PNG_TITLE = 64;

export function pngLayout(board: Board): PngLayout {
  const titleHeight = board.title.trim() ? PNG_TITLE : 0;
  const perRow = Math.max(1, Math.floor((PNG_WIDTH - PNG_LABEL - PNG_GAP) / (PNG_CELL + PNG_GAP)));
  let y = titleHeight;
  const rows = board.tiers.map((tier) => {
    const lines = Math.max(1, Math.ceil(tier.items.length / perRow));
    const height = lines * (PNG_CELL + PNG_GAP) + PNG_GAP;
    const cells = tier.items.map((id, i) => ({
      id,
      x: PNG_LABEL + PNG_GAP + (i % perRow) * (PNG_CELL + PNG_GAP),
      y: y + PNG_GAP + Math.floor(i / perRow) * (PNG_CELL + PNG_GAP),
    }));
    const row = { tierId: tier.id, y, height, cells };
    y += height + 2;
    return row;
  });
  return { width: PNG_WIDTH, height: Math.max(y - 2, titleHeight + 1), titleHeight, rows };
}

/** Breaks text into lines that fit: at spaces where there are any, between characters otherwise (CJK has no spaces). */
export function wrapText(text: string, fits: (line: string) => boolean, maxLines: number): string[] {
  const tokens = text.split(/(\s+)/).flatMap((part) => (fits(part) ? [part] : Array.from(part)));
  const lines: string[] = [];
  let line = "";
  for (const token of tokens) {
    const next = line + token;
    if (fits(next)) {
      line = next;
      continue;
    }
    if (line.trim()) lines.push(line.trim());
    line = token.trim() ? token : "";
  }
  if (line.trim()) lines.push(line.trim());
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  let last = kept[maxLines - 1];
  while (last && !fits(`${last}…`)) last = Array.from(last).slice(0, -1).join("");
  kept[maxLines - 1] = `${last}…`;
  return kept;
}

/** Black or white text, whichever reads better on a row colour. */
export function textOn(hex: string): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const luminance = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return luminance > 0.55 ? "#1a1a1a" : "#ffffff";
}
