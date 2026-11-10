/** Area calculator: area and perimeter of common plane shapes, and area unit conversion. */
import { convertAmount } from "./units";

export const LENGTH_UNITS = ["mm", "cm", "m", "km", "in", "ft", "yd", "mi"] as const;
export type LengthUnit = (typeof LENGTH_UNITS)[number];

/** Metres per unit (international inch, foot, yard and mile), from the unit converter's table. */
export const METRES = Object.fromEntries(LENGTH_UNITS.map((u) => [u, convertAmount("length", 1, u, "m")])) as Record<LengthUnit, number>;

export const AREA_UNITS = ["mm2", "cm2", "m2", "ha", "km2", "in2", "ft2", "yd2", "acre", "mi2"] as const;
export type AreaUnit = (typeof AREA_UNITS)[number];

/** Square metres per unit: squares of the length units, plus the hectare and acre from the unit converter. */
export const SQUARE_METRES: Record<AreaUnit, number> = {
  mm2: METRES.mm ** 2,
  cm2: METRES.cm ** 2,
  m2: 1,
  ha: convertAmount("area", 1, "ha", "m2"),
  km2: METRES.km ** 2,
  in2: METRES.in ** 2,
  ft2: METRES.ft ** 2,
  yd2: METRES.yd ** 2,
  acre: convertAmount("area", 1, "acre", "m2"),
  mi2: METRES.mi ** 2,
};

export const AREA_SHAPES = [
  "rectangle",
  "square",
  "triangle",
  "triangle-sides",
  "circle",
  "ellipse",
  "trapezoid",
  "parallelogram",
  "rhombus",
  "sector",
  "polygon",
  "annulus",
] as const;
export type AreaShape = (typeof AREA_SHAPES)[number];

/** What a field holds: a length in the chosen unit, an angle in degrees, or a whole count. */
export type FieldKind = "length" | "angle" | "count";
export type ShapeField = { id: string; kind: FieldKind; symbol: string };

export const len = (id: string, symbol: string): ShapeField => ({ id, kind: "length", symbol });

export const AREA_FIELDS: Record<AreaShape, readonly ShapeField[]> = {
  rectangle: [len("length", "l"), len("width", "w")],
  square: [len("side", "s")],
  triangle: [len("base", "b"), len("height", "h")],
  "triangle-sides": [len("a", "a"), len("b", "b"), len("c", "c")],
  circle: [len("radius", "r")],
  ellipse: [len("semiMajor", "a"), len("semiMinor", "b")],
  trapezoid: [len("base1", "a"), len("base2", "b"), len("height", "h")],
  parallelogram: [len("base", "b"), len("height", "h")],
  rhombus: [len("d1", "p"), len("d2", "q")],
  sector: [len("radius", "r"), { id: "angle", kind: "angle", symbol: "θ" }],
  polygon: [{ id: "count", kind: "count", symbol: "n" }, len("side", "s")],
  annulus: [len("outer", "R"), len("inner", "r")],
};

/** The area formula as printed (symbols from AREA_FIELDS; the same in every language). */
export const AREA_FORMULA: Record<AreaShape, string> = {
  rectangle: "A = l × w",
  square: "A = s²",
  triangle: "A = ½ × b × h",
  "triangle-sides": "A = √(p(p − a)(p − b)(p − c)), p = (a + b + c) / 2",
  circle: "A = π × r²",
  ellipse: "A = π × a × b",
  trapezoid: "A = (a + b) / 2 × h",
  parallelogram: "A = b × h",
  rhombus: "A = p × q / 2",
  sector: "A = θ / 360° × π × r²",
  polygon: "A = n × s² / (4 × tan(180° / n))",
  annulus: "A = π × (R² − r²)",
};

export type AreaError = "missing" | "positive" | "count" | "angle" | "triangle" | "annulus";

export type AreaResult =
  | { ok: true; area: number; perimeter: number | null; perimeterApprox: boolean; working: string[] }
  | { ok: false; error: AreaError };

export type Formatter = (n: number) => string;

/**
 * Area of a triangle from its three sides (Heron's formula in Kahan's form, accurate for needle-thin triangles), or
 * null when the sides do not make one. The small margin keeps rounding (0.1 + 0.2 vs 0.3) from passing a flat triangle.
 */
export function heron(a: number, b: number, c: number): number | null {
  const [x, y, z] = [a, b, c].sort((m, n) => m - n) as [number, number, number];
  if (x + y <= z * (1 + 1e-12)) return null;
  return Math.sqrt((z + (y + x)) * (x - (z - y)) * (x + (z - y)) * (z + (y - x))) / 4;
}

/**
 * Area (in the input unit squared) and perimeter (in the input unit, null when the inputs do not fix it).
 * `values` holds the fields of `shape` by id; `f` formats the numbers in the working.
 */
export function solveArea(shape: AreaShape, values: Readonly<Record<string, number | undefined>>, f: Formatter = String): AreaResult {
  const fields = AREA_FIELDS[shape];
  for (const field of fields) {
    const v = values[field.id];
    if (v === undefined) return { ok: false, error: "missing" };
    if (!Number.isFinite(v) || v <= 0) return { ok: false, error: "positive" };
    if (field.kind === "count" && (!Number.isInteger(v) || v < 3 || v > 1000)) return { ok: false, error: "count" };
    if (field.kind === "angle" && v > 360) return { ok: false, error: "angle" };
  }
  const v = (id: string) => values[id]!;
  const pi = Math.PI;
  switch (shape) {
    case "rectangle": {
      const area = v("length") * v("width");
      return done(area, 2 * (v("length") + v("width")), [`A = ${f(v("length"))} × ${f(v("width"))} = ${f(area)}`, `P = 2 × (${f(v("length"))} + ${f(v("width"))}) = ${f(2 * (v("length") + v("width")))}`]);
    }
    case "square": {
      const area = v("side") ** 2;
      return done(area, 4 * v("side"), [`A = ${f(v("side"))}² = ${f(area)}`, `P = 4 × ${f(v("side"))} = ${f(4 * v("side"))}`]);
    }
    case "triangle": {
      const area = (v("base") * v("height")) / 2;
      return done(area, null, [`A = ½ × ${f(v("base"))} × ${f(v("height"))} = ${f(area)}`]);
    }
    case "triangle-sides": {
      const [a, b, c] = [v("a"), v("b"), v("c")];
      const area = heron(a, b, c);
      if (area === null) return { ok: false, error: "triangle" };
      const p = (a + b + c) / 2;
      return done(area, a + b + c, [
        `p = (${f(a)} + ${f(b)} + ${f(c)}) / 2 = ${f(p)}`,
        `A = √(${f(p)} × ${f(p - a)} × ${f(p - b)} × ${f(p - c)}) = ${f(area)}`,
        `P = ${f(a)} + ${f(b)} + ${f(c)} = ${f(a + b + c)}`,
      ]);
    }
    case "circle": {
      const area = pi * v("radius") ** 2;
      return done(area, 2 * pi * v("radius"), [`A = π × ${f(v("radius"))}² = ${f(area)}`, `C = 2 × π × ${f(v("radius"))} = ${f(2 * pi * v("radius"))}`]);
    }
    case "ellipse": {
      const [a, b] = [v("semiMajor"), v("semiMinor")];
      const area = pi * a * b;
      // Ramanujan's second approximation: within about 0.04% even for a 10:1 ellipse.
      const hh = ((a - b) / (a + b)) ** 2;
      const perimeter = pi * (a + b) * (1 + (3 * hh) / (10 + Math.sqrt(4 - 3 * hh)));
      return { ok: true, area, perimeter, perimeterApprox: a !== b, working: [`A = π × ${f(a)} × ${f(b)} = ${f(area)}`, `P ${a === b ? "=" : "≈"} ${f(perimeter)}`] };
    }
    case "trapezoid": {
      const area = ((v("base1") + v("base2")) / 2) * v("height");
      return done(area, null, [`A = (${f(v("base1"))} + ${f(v("base2"))}) / 2 × ${f(v("height"))} = ${f(area)}`]);
    }
    case "parallelogram": {
      const area = v("base") * v("height");
      return done(area, null, [`A = ${f(v("base"))} × ${f(v("height"))} = ${f(area)}`]);
    }
    case "rhombus": {
      const [p, q] = [v("d1"), v("d2")];
      const area = (p * q) / 2;
      // The diagonals bisect each other at right angles, so each side is half the hypotenuse of p and q.
      const side = Math.hypot(p, q) / 2;
      return done(area, 4 * side, [`A = ${f(p)} × ${f(q)} / 2 = ${f(area)}`, `s = √((${f(p)} / 2)² + (${f(q)} / 2)²) = ${f(side)}`, `P = 4 × ${f(side)} = ${f(4 * side)}`]);
    }
    case "sector": {
      const [r, deg] = [v("radius"), v("angle")];
      const area = (deg / 360) * pi * r * r;
      const arc = (deg / 360) * 2 * pi * r;
      // A full circle has no straight edges.
      const perimeter = deg === 360 ? arc : arc + 2 * r;
      return done(area, perimeter, [
        `A = ${f(deg)} / 360 × π × ${f(r)}² = ${f(area)}`,
        `L = ${f(deg)} / 360 × 2 × π × ${f(r)} = ${f(arc)}`,
        deg === 360 ? `P = L = ${f(perimeter)}` : `P = L + 2 × ${f(r)} = ${f(perimeter)}`,
      ]);
    }
    case "polygon": {
      const [n, s] = [v("count"), v("side")];
      const area = (n * s * s) / (4 * Math.tan(pi / n));
      return done(area, n * s, [`A = ${f(n)} × ${f(s)}² / (4 × tan(180° / ${f(n)})) = ${f(area)}`, `P = ${f(n)} × ${f(s)} = ${f(n * s)}`]);
    }
    case "annulus": {
      const [R, r] = [v("outer"), v("inner")];
      if (r >= R) return { ok: false, error: "annulus" };
      const area = pi * (R * R - r * r);
      return done(area, 2 * pi * (R + r), [`A = π × (${f(R)}² − ${f(r)}²) = ${f(area)}`, `P = 2 × π × (${f(R)} + ${f(r)}) = ${f(2 * pi * (R + r))}`]);
    }
  }
}

function done(area: number, perimeter: number | null, working: string[]): AreaResult {
  return { ok: true, area, perimeter, perimeterApprox: false, working };
}

/** An area given in `from`² converted to every area unit. */
export function convertArea(area: number, from: LengthUnit): Record<AreaUnit, number> {
  const m2 = area * METRES[from] ** 2;
  return Object.fromEntries(AREA_UNITS.map((u) => [u, m2 / SQUARE_METRES[u]])) as Record<AreaUnit, number>;
}
