/** Solid test colours, in the order the full-screen test shows them. */
export const SCREEN_COLORS = [
  { id: "black", hex: "#000000" },
  { id: "white", hex: "#ffffff" },
  { id: "red", hex: "#ff0000" },
  { id: "green", hex: "#00ff00" },
  { id: "blue", hex: "#0000ff" },
  { id: "gray", hex: "#808080" },
] as const;
export type ScreenColorId = (typeof SCREEN_COLORS)[number]["id"];

/** Auto-advance choices in seconds; 0 is off. */
export const AUTO_ADVANCE = [0, 3, 5, 10] as const;

/** The colour index `by` steps from `i`, wrapping around both ends. */
export function stepColor(i: number, by: number, count: number = SCREEN_COLORS.length): number {
  if (!(count > 0)) return 0;
  const n = Math.trunc(i) + Math.trunc(by);
  return ((n % count) + count) % count;
}

/** Light colours get dark text on the overlay label, dark ones light text. */
export function labelInk(hex: string): "#000000" | "#ffffff" {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return "#000000";
  const [r, g, b] = m.slice(1).map((x) => parseInt(x, 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 140 ? "#000000" : "#ffffff";
}
