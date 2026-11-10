/** Volume calculator: volume and surface area of common solids, and volume / capacity unit conversion. */
import { METRES, type Formatter, type LengthUnit, type ShapeField } from "./area";
import { convertAmount } from "./units";

export const VOLUME_UNITS = ["mm3", "cm3", "ml", "l", "m3", "in3", "ft3", "yd3", "usFlOz", "usCup", "usGal", "ukGal"] as const;
export type VolumeUnit = (typeof VOLUME_UNITS)[number];

const litres = (unit: string) => convertAmount("volume", 1, unit, "l") / 1000;

/** Cubic metres per unit: cubes of the length units, US measures from the unit converter, and the imperial gallon (4.54609 L exactly). */
export const CUBIC_METRES: Record<VolumeUnit, number> = {
  mm3: METRES.mm ** 3,
  cm3: METRES.cm ** 3,
  ml: litres("ml"),
  l: litres("l"),
  m3: 1,
  in3: METRES.in ** 3,
  ft3: METRES.ft ** 3,
  yd3: METRES.yd ** 3,
  usFlOz: litres("floz"),
  usCup: litres("cup"),
  usGal: litres("gal"),
  ukGal: 0.00454609,
};

export const VOLUME_SHAPES = [
  "box",
  "cube",
  "cylinder",
  "sphere",
  "cone",
  "pyramid",
  "triangular-prism",
  "hemisphere",
  "capsule",
  "frustum",
  "ellipsoid",
  "tube",
] as const;
export type VolumeShape = (typeof VOLUME_SHAPES)[number];

const len = (id: string, symbol: string): ShapeField => ({ id, kind: "length", symbol });

export const VOLUME_FIELDS: Record<VolumeShape, readonly ShapeField[]> = {
  box: [len("length", "l"), len("width", "w"), len("height", "h")],
  cube: [len("side", "s")],
  cylinder: [len("radius", "r"), len("height", "h")],
  sphere: [len("radius", "r")],
  cone: [len("radius", "r"), len("height", "h")],
  pyramid: [len("length", "l"), len("width", "w"), len("height", "h")],
  "triangular-prism": [len("a", "a"), len("b", "b"), len("c", "c"), len("length", "l")],
  hemisphere: [len("radius", "r")],
  capsule: [len("radius", "r"), len("length", "a")],
  frustum: [len("radius1", "R"), len("radius2", "r"), len("height", "h")],
  ellipsoid: [len("axisA", "a"), len("axisB", "b"), len("axisC", "c")],
  tube: [len("outer", "R"), len("inner", "r"), len("height", "h")],
};

export const VOLUME_FORMULA: Record<VolumeShape, string> = {
  box: "V = l × w × h",
  cube: "V = s³",
  cylinder: "V = π × r² × h",
  sphere: "V = 4/3 × π × r³",
  cone: "V = 1/3 × π × r² × h",
  pyramid: "V = 1/3 × l × w × h",
  "triangular-prism": "V = √(p(p − a)(p − b)(p − c)) × l",
  hemisphere: "V = 2/3 × π × r³",
  capsule: "V = π × r² × a + 4/3 × π × r³",
  frustum: "V = 1/3 × π × h × (R² + R × r + r²)",
  ellipsoid: "V = 4/3 × π × a × b × c",
  tube: "V = π × (R² − r²) × h",
};

export type VolumeError = "missing" | "positive" | "triangle" | "tube";

export type VolumeResult =
  | { ok: true; volume: number; surface: number; surfaceApprox: boolean; working: string[] }
  | { ok: false; error: VolumeError };

/** Volume (input unit cubed) and total surface area (input unit squared). */
export function solveVolume(shape: VolumeShape, values: Readonly<Record<string, number | undefined>>, f: Formatter = String): VolumeResult {
  for (const field of VOLUME_FIELDS[shape]) {
    const x = values[field.id];
    if (x === undefined) return { ok: false, error: "missing" };
    if (!Number.isFinite(x) || x <= 0) return { ok: false, error: "positive" };
  }
  const v = (id: string) => values[id]!;
  const pi = Math.PI;
  const out = (volume: number, surface: number, working: string[], surfaceApprox = false): VolumeResult => ({ ok: true, volume, surface, surfaceApprox, working });
  switch (shape) {
    case "box": {
      const [l, w, h] = [v("length"), v("width"), v("height")];
      const volume = l * w * h;
      const surface = 2 * (l * w + l * h + w * h);
      return out(volume, surface, [`V = ${f(l)} × ${f(w)} × ${f(h)} = ${f(volume)}`, `S = 2 × (${f(l)} × ${f(w)} + ${f(l)} × ${f(h)} + ${f(w)} × ${f(h)}) = ${f(surface)}`]);
    }
    case "cube": {
      const s = v("side");
      return out(s ** 3, 6 * s * s, [`V = ${f(s)}³ = ${f(s ** 3)}`, `S = 6 × ${f(s)}² = ${f(6 * s * s)}`]);
    }
    case "cylinder": {
      const [r, h] = [v("radius"), v("height")];
      const volume = pi * r * r * h;
      const surface = 2 * pi * r * (r + h);
      return out(volume, surface, [`V = π × ${f(r)}² × ${f(h)} = ${f(volume)}`, `S = 2 × π × ${f(r)} × (${f(r)} + ${f(h)}) = ${f(surface)}`]);
    }
    case "sphere": {
      const r = v("radius");
      const volume = (4 / 3) * pi * r ** 3;
      return out(volume, 4 * pi * r * r, [`V = 4/3 × π × ${f(r)}³ = ${f(volume)}`, `S = 4 × π × ${f(r)}² = ${f(4 * pi * r * r)}`]);
    }
    case "cone": {
      const [r, h] = [v("radius"), v("height")];
      const slant = Math.hypot(r, h);
      const volume = (pi * r * r * h) / 3;
      const surface = pi * r * (r + slant);
      return out(volume, surface, [
        `V = 1/3 × π × ${f(r)}² × ${f(h)} = ${f(volume)}`,
        `s = √(${f(r)}² + ${f(h)}²) = ${f(slant)}`,
        `S = π × ${f(r)} × (${f(r)} + ${f(slant)}) = ${f(surface)}`,
      ]);
    }
    case "pyramid": {
      // A right pyramid over an l × w rectangle: two pairs of triangular faces with their own slant heights.
      const [l, w, h] = [v("length"), v("width"), v("height")];
      const volume = (l * w * h) / 3;
      const sl = Math.hypot(h, w / 2);
      const sw = Math.hypot(h, l / 2);
      const surface = l * w + l * sl + w * sw;
      return out(volume, surface, [`V = 1/3 × ${f(l)} × ${f(w)} × ${f(h)} = ${f(volume)}`, `S = ${f(l)} × ${f(w)} + ${f(l)} × ${f(sl)} + ${f(w)} × ${f(sw)} = ${f(surface)}`]);
    }
    case "triangular-prism": {
      const [a, b, c, l] = [v("a"), v("b"), v("c"), v("length")];
      const [x, y, z] = [a, b, c].sort((m, n) => m - n);
      if (x + y <= z * (1 + 1e-12)) return { ok: false, error: "triangle" };
      const base = Math.sqrt((z + (y + x)) * (x - (z - y)) * (x + (z - y)) * (z + (y - x))) / 4;
      const volume = base * l;
      const surface = 2 * base + (a + b + c) * l;
      return out(volume, surface, [
        `B = √(p(p − a)(p − b)(p − c)) = ${f(base)}`,
        `V = ${f(base)} × ${f(l)} = ${f(volume)}`,
        `S = 2 × ${f(base)} + (${f(a)} + ${f(b)} + ${f(c)}) × ${f(l)} = ${f(surface)}`,
      ]);
    }
    case "hemisphere": {
      const r = v("radius");
      const volume = (2 / 3) * pi * r ** 3;
      // Curved half (2πr²) plus the flat circle (πr²).
      return out(volume, 3 * pi * r * r, [`V = 2/3 × π × ${f(r)}³ = ${f(volume)}`, `S = 3 × π × ${f(r)}² = ${f(3 * pi * r * r)}`]);
    }
    case "capsule": {
      const [r, a] = [v("radius"), v("length")];
      const volume = pi * r * r * a + (4 / 3) * pi * r ** 3;
      const surface = 2 * pi * r * a + 4 * pi * r * r;
      return out(volume, surface, [`V = π × ${f(r)}² × ${f(a)} + 4/3 × π × ${f(r)}³ = ${f(volume)}`, `S = 2 × π × ${f(r)} × ${f(a)} + 4 × π × ${f(r)}² = ${f(surface)}`]);
    }
    case "frustum": {
      const [R, r, h] = [v("radius1"), v("radius2"), v("height")];
      const volume = (pi * h * (R * R + R * r + r * r)) / 3;
      const slant = Math.hypot(R - r, h);
      const surface = pi * (R * R + r * r + (R + r) * slant);
      return out(volume, surface, [
        `V = 1/3 × π × ${f(h)} × (${f(R)}² + ${f(R)} × ${f(r)} + ${f(r)}²) = ${f(volume)}`,
        `s = √((${f(R)} − ${f(r)})² + ${f(h)}²) = ${f(slant)}`,
        `S = π × (${f(R)}² + ${f(r)}² + (${f(R)} + ${f(r)}) × ${f(slant)}) = ${f(surface)}`,
      ]);
    }
    case "ellipsoid": {
      const [a, b, c] = [v("axisA"), v("axisB"), v("axisC")];
      const volume = (4 / 3) * pi * a * b * c;
      // Knud Thomsen's formula (p = 1.6075): within about 1.1% of the exact surface; exact for a sphere.
      const p = 1.6075;
      const surface = 4 * pi * (((a * b) ** p + (a * c) ** p + (b * c) ** p) / 3) ** (1 / p);
      const sphere = a === b && b === c;
      return out(volume, sphere ? 4 * pi * a * a : surface, [`V = 4/3 × π × ${f(a)} × ${f(b)} × ${f(c)} = ${f(volume)}`, `S ${sphere ? "=" : "≈"} ${f(sphere ? 4 * pi * a * a : surface)}`], !sphere);
    }
    case "tube": {
      const [R, r, h] = [v("outer"), v("inner"), v("height")];
      if (r >= R) return { ok: false, error: "tube" };
      const volume = pi * (R * R - r * r) * h;
      // Outside and inside walls plus the two ring-shaped ends.
      const surface = 2 * pi * (R + r) * h + 2 * pi * (R * R - r * r);
      return out(volume, surface, [`V = π × (${f(R)}² − ${f(r)}²) × ${f(h)} = ${f(volume)}`, `S = 2 × π × (${f(R)} + ${f(r)}) × ${f(h)} + 2 × π × (${f(R)}² − ${f(r)}²) = ${f(surface)}`]);
    }
  }
}

/** A volume given in `from`³ converted to every volume unit. */
export function convertVolume(volume: number, from: LengthUnit): Record<VolumeUnit, number> {
  const m3 = volume * METRES[from] ** 3;
  return Object.fromEntries(VOLUME_UNITS.map((u) => [u, m3 / CUBIC_METRES[u]])) as Record<VolumeUnit, number>;
}
