// Pressure points map: the points (WHO 2008 standard locations), the foot reflexology zones and where each sits on
// the line drawings in src/client/pressure-points-map/art.ts. Copy (names, locations, uses) is per locale in
// src/locales/pressure-points/<locale>.json; this module holds only what every language shares.
import { foldText } from "./search";

export const PP_VIEWS = ["face", "back", "hand", "arm", "leg", "foot", "sole"] as const;
export type PpView = (typeof PP_VIEWS)[number];

export type PpPoint = {
  id: string;
  /** WHO 2008 code (extra points keep their EX-HN number). */
  code: string;
  /** An older code the point is still listed under (Yintang was EX-HN3 before WHO 2008 made it GV29). */
  altCode?: string;
  pinyin: string;
  /** The English name, searchable on every language's page (equal to the en copy's name; tests check). */
  english: string;
  view: PpView;
  x: number;
  y: number;
  /** The same point on the other side of the body, drawn too (a pointer target, not a second tab stop). */
  mirrorX?: number;
  /** Firm pressure is traditionally avoided in pregnancy. */
  pregnancy?: boolean;
  /** Face and eye-area points: light pressure only. */
  light?: boolean;
};

export const PP_POINTS: readonly PpPoint[] = [
  { id: "yintang", code: "GV29", altCode: "EX-HN3", pinyin: "Yìntáng", english: "Hall of Impression", view: "face", x: 160, y: 148, light: true },
  { id: "bl2", code: "BL2", pinyin: "Cuánzhú", english: "Bamboo Gathering", view: "face", x: 184, y: 148, mirrorX: 136, light: true },
  { id: "yuyao", code: "EX-HN4", pinyin: "Yúyāo", english: "Fish Waist", view: "face", x: 211, y: 141, mirrorX: 109, light: true },
  { id: "te23", code: "TE23", pinyin: "Sīzhúkōng", english: "Silk Bamboo Hollow", view: "face", x: 238, y: 146, mirrorX: 82, light: true },
  { id: "taiyang", code: "EX-HN5", pinyin: "Tàiyáng", english: "Supreme Yang (temple)", view: "face", x: 253, y: 158, mirrorX: 67, light: true },
  { id: "gb1", code: "GB1", pinyin: "Tóngzǐliáo", english: "Pupil Bone-Hole", view: "face", x: 240, y: 174, mirrorX: 80, light: true },
  { id: "st2", code: "ST2", pinyin: "Sìbái", english: "Four Whites", view: "face", x: 205, y: 198, mirrorX: 115, light: true },
  { id: "gb20", code: "GB20", pinyin: "Fēngchí", english: "Wind Pool", view: "back", x: 187, y: 194, mirrorX: 133 },
  { id: "gb21", code: "GB21", pinyin: "Jiānjǐng", english: "Shoulder Well", view: "back", x: 220, y: 262, mirrorX: 100, pregnancy: true },
  { id: "li4", code: "LI4", pinyin: "Hégǔ", english: "Union Valley", view: "hand", x: 118, y: 212, pregnancy: true },
  { id: "pc6", code: "PC6", pinyin: "Nèiguān", english: "Inner Pass", view: "arm", x: 158, y: 302 },
  { id: "ht7", code: "HT7", pinyin: "Shénmén", english: "Spirit Gate", view: "arm", x: 124, y: 242 },
  { id: "st36", code: "ST36", pinyin: "Zúsānlǐ", english: "Leg Three Miles", view: "leg", x: 148, y: 152 },
  { id: "sp6", code: "SP6", pinyin: "Sānyīnjiāo", english: "Three Yin Intersection", view: "leg", x: 186, y: 298, pregnancy: true },
  { id: "lr3", code: "LR3", pinyin: "Tàichōng", english: "Great Surge", view: "foot", x: 138, y: 170 },
  { id: "ki1", code: "KI1", pinyin: "Yǒngquán", english: "Gushing Spring", view: "sole", x: 259, y: 170, mirrorX: 81 },
];

export const PP_ZONES = ["toes", "ball", "arch", "heel", "spine", "heart", "spleen", "liver"] as const;
export type PpZone = (typeof PP_ZONES)[number];
export type PpFoot = "left" | "right";

/** Which sole carries a zone in the common (Ingham-style) chart: heart and spleen on the left, liver on the right. */
export const PP_ZONE_FEET: Record<PpZone, readonly PpFoot[]> = {
  toes: ["left", "right"],
  ball: ["left", "right"],
  arch: ["left", "right"],
  heel: ["left", "right"],
  spine: ["left", "right"],
  heart: ["left"],
  spleen: ["left"],
  liver: ["right"],
};

/** The selected thing on the map: a point, or a reflexology zone on one sole. */
export type PpSelection = { kind: "point"; id: string } | { kind: "zone"; id: PpZone; foot: PpFoot };

export const PP_HOLD_SECONDS = [30, 60, 90] as const;
export const PP_DEFAULT_HOLD = 60;

export function ppPoint(id: string): PpPoint | undefined {
  return PP_POINTS.find((p) => p.id === id);
}

export function ppPointsIn(view: PpView): PpPoint[] {
  return PP_POINTS.filter((p) => p.view === view);
}

/** "LI4", or "GV29 (EX-HN3)" for a point with an older code too. */
export function ppCodeLabel(p: PpPoint): string {
  return p.altCode ? `${p.code} (${p.altCode})` : p.code;
}

/** Folded (case, tone marks, đ) without spaces or punctuation, so "hegu", "Hégǔ" and "EX HN5" match. */
const squash = (s: string) => foldText(s).replace(/[\s\p{P}]+/gu, "");

/** Whether a search query matches any of a point's or zone's names (local name, pinyin, code, English name). */
export function ppMatches(query: string, names: readonly string[]): boolean {
  // Every word of the query must appear in one of the names: "right foot liver", "ex hn5", "合谷".
  const words = foldText(query).split(" ").map(squash).filter(Boolean);
  const hay = names.map(squash);
  return words.every((w) => hay.some((n) => n.includes(w)));
}

/** "1:05" for 65 seconds. */
export function ppClock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
