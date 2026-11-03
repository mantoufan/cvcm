/** CSS gradient generator: the gradient as data, its CSS, and the geometry to paint the same gradient on a canvas. */

export type GradientKind = "linear" | "radial" | "conic";
export type RadialShape = "circle" | "ellipse";
export type Stop = { color: string; pos: number };
export type Gradient = { kind: GradientKind; angle: number; shape: RadialShape; stops: Stop[] };

export const MIN_STOPS = 2;
export const MAX_STOPS = 6;

/** Ready-made gradients; the first is the one the page opens with. */
export const PRESETS: readonly Gradient[] = [
  { kind: "linear", angle: 135, shape: "circle", stops: [{ color: "#ff9a9e", pos: 0 }, { color: "#fad0c4", pos: 100 }] },
  { kind: "linear", angle: 90, shape: "circle", stops: [{ color: "#a18cd1", pos: 0 }, { color: "#fbc2eb", pos: 100 }] },
  { kind: "linear", angle: 120, shape: "circle", stops: [{ color: "#84fab0", pos: 0 }, { color: "#8fd3f4", pos: 100 }] },
  { kind: "linear", angle: 45, shape: "circle", stops: [{ color: "#f6d365", pos: 0 }, { color: "#fda085", pos: 100 }] },
  { kind: "linear", angle: 180, shape: "circle", stops: [{ color: "#0f2027", pos: 0 }, { color: "#203a43", pos: 50 }, { color: "#2c5364", pos: 100 }] },
  { kind: "linear", angle: 90, shape: "circle", stops: [{ color: "#ff0080", pos: 0 }, { color: "#ff8c00", pos: 33 }, { color: "#40e0d0", pos: 66 }, { color: "#7928ca", pos: 100 }] },
  { kind: "radial", angle: 0, shape: "circle", stops: [{ color: "#fdfcfb", pos: 0 }, { color: "#e2d1c3", pos: 100 }] },
  { kind: "conic", angle: 0, shape: "circle", stops: [{ color: "#ff6b6b", pos: 0 }, { color: "#feca57", pos: 33 }, { color: "#48dbfb", pos: 66 }, { color: "#ff6b6b", pos: 100 }] },
];

export function cloneGradient(g: Gradient): Gradient {
  return { ...g, stops: g.stops.map((s) => ({ ...s })) };
}

/** A colour typed as #rgb or #rrggbb (with or without #), as lower-case #rrggbb; null when it is not one. */
export function normalizeHex(raw: string): string | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(raw.trim());
  if (!m) return null;
  const hex = m[1].length === 3 ? m[1].replace(/./g, "$&$&") : m[1];
  return `#${hex.toLowerCase()}`;
}

export function clampPos(n: number): number {
  return Number.isFinite(n) ? Math.min(100, Math.max(0, Math.round(n))) : 0;
}

/** Angles go round: −90 is 270, 450 is 90. */
export function clampAngle(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return ((Math.round(n) % 360) + 360) % 360;
}

/** Stops in the order they appear along the gradient (CSS needs them ascending). */
export function sortedStops(stops: readonly Stop[]): Stop[] {
  return stops.map((s, i) => ({ s, i })).sort((a, b) => a.s.pos - b.s.pos || a.i - b.i).map((x) => x.s);
}

/** The gradient as a CSS image, e.g. `linear-gradient(135deg, #ff9a9e 0%, #fad0c4 100%)`. */
export function gradientCss(g: Gradient): string {
  const stops = sortedStops(g.stops).map((s) => `${s.color} ${s.pos}%`).join(", ");
  if (g.kind === "radial") return `radial-gradient(${g.shape}, ${stops})`;
  if (g.kind === "conic") return `conic-gradient(from ${g.angle}deg, ${stops})`;
  return `linear-gradient(${g.angle}deg, ${stops})`;
}

/** The full rule to paste: a solid fallback colour first (the stops' first colour), then the gradient. */
export function cssRule(g: Gradient): string {
  const first = sortedStops(g.stops)[0]?.color ?? "#ffffff";
  return `background: ${first};\nbackground: ${gradientCss(g)};`;
}

/**
 * Start and end points of a CSS linear gradient's line in a w × h box (CSS Images 3): 0deg points up, 90deg right,
 * and the line is long enough that the corners get the first and last colours.
 */
export function linearLine(angleDeg: number, w: number, h: number): { x0: number; y0: number; x1: number; y1: number } {
  const a = (angleDeg * Math.PI) / 180;
  const len = Math.abs(w * Math.sin(a)) + Math.abs(h * Math.cos(a));
  const dx = (Math.sin(a) * len) / 2;
  const dy = (-Math.cos(a) * len) / 2;
  return { x0: w / 2 - dx, y0: h / 2 - dy, x1: w / 2 + dx, y1: h / 2 + dy };
}

/**
 * Radii of a centred radial gradient's ending shape at its default size (farthest-corner) in a w × h box.
 * A circle reaches the corners; an ellipse keeps the box's aspect ratio and passes through them (radii × √2).
 */
export function radialRadii(shape: RadialShape, w: number, h: number): { rx: number; ry: number } {
  if (shape === "circle") {
    const r = Math.hypot(w / 2, h / 2);
    return { rx: r, ry: r };
  }
  return { rx: (w / 2) * Math.SQRT2, ry: (h / 2) * Math.SQRT2 };
}

/** Picks a random two- or three-stop gradient (for the Random button); `rand` returns numbers in [0, 1). */
export function randomGradient(rand: () => number = Math.random): Gradient {
  const hex = () => `#${Math.floor(rand() * 0x1000000).toString(16).padStart(6, "0")}`;
  const n = rand() < 0.7 ? 2 : 3;
  const stops = Array.from({ length: n }, (_, i) => ({ color: hex(), pos: Math.round((i * 100) / (n - 1)) }));
  return { kind: "linear", angle: clampAngle(Math.floor(rand() * 8) * 45), shape: "circle", stops };
}

/** Where a new stop goes: halfway across the widest gap, coloured as the gradient is there. */
export function newStop(stops: readonly Stop[]): Stop {
  const s = sortedStops(stops);
  let best = 0;
  for (let i = 1; i < s.length - 1; i++) if (s[i + 1].pos - s[i].pos > s[best + 1].pos - s[best].pos) best = i;
  const a = s[best];
  const b = s[best + 1] ?? a;
  return { color: mixHex(a.color, b.color, 0.5), pos: Math.round((a.pos + b.pos) / 2) };
}

export function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (shift: number) => Math.round(((pa >> shift) & 255) * (1 - t) + ((pb >> shift) & 255) * t);
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, "0")}`;
}
