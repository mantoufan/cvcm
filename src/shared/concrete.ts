/**
 * Concrete calculator: volume of slabs, footings, walls, round columns, tubes and stairs, with a waste allowance,
 * in cubic metres, cubic yards and cubic feet, and the number of premix bags.
 */
import { METRES, type LengthUnit } from "./area";

export const CONCRETE_SHAPES = ["slab", "footing", "wall", "column", "tube", "stairs"] as const;
export type ConcreteShape = (typeof CONCRETE_SHAPES)[number];

/** Units a size can be typed in. */
export const CONCRETE_UNITS = ["m", "cm", "mm", "ft", "in", "yd"] as const satisfies readonly LengthUnit[];
export type ConcreteUnit = (typeof CONCRETE_UNITS)[number];

export type ConcreteField = { id: string; kind: "length" | "count"; /** First unit offered in metric and imperial pages. */ metric?: ConcreteUnit; imperial?: ConcreteUnit };

const L = (id: string, metric: ConcreteUnit, imperial: ConcreteUnit): ConcreteField => ({ id, kind: "length", metric, imperial });
const COUNT: ConcreteField = { id: "quantity", kind: "count" };

/** The sizes each shape needs. Slabs, footings and walls are boxes; their fields are named the way builders say them. */
export const CONCRETE_FIELDS: Record<ConcreteShape, readonly ConcreteField[]> = {
  slab: [L("length", "m", "ft"), L("width", "m", "ft"), L("thickness", "cm", "in"), COUNT],
  footing: [L("length", "m", "ft"), L("width", "cm", "in"), L("depth", "cm", "in"), COUNT],
  wall: [L("length", "m", "ft"), L("height", "m", "ft"), L("thickness", "cm", "in"), COUNT],
  column: [L("diameter", "cm", "in"), L("height", "m", "ft"), COUNT],
  tube: [L("outer", "cm", "in"), L("inner", "cm", "in"), L("height", "m", "ft"), COUNT],
  stairs: [L("width", "m", "ft"), L("rise", "cm", "in"), L("run", "cm", "in"), { id: "steps", kind: "count" }, L("platform", "cm", "in")],
};

/** Fields that may be left empty (they count as 0 or 1). */
export const OPTIONAL_FIELDS: ReadonlySet<string> = new Set(["quantity", "platform"]);

/**
 * Premix bags by weight. Bagged concrete yields about 0.60 ft³ per 80 lb (0.45 per 60 lb, 0.30 per 40 lb on the bag),
 * which is a mixed density of 133⅓ lb/ft³ (2,136 kg/m³); metric bags are worked out at the same density.
 */
export const BAG_DENSITY_KG_M3 = (80 * 0.45359237) / (0.6 * 0.3048 ** 3);
export const BAGS = [
  { id: "lb80", kg: 80 * 0.45359237, label: "80 lb" },
  { id: "lb60", kg: 60 * 0.45359237, label: "60 lb" },
  { id: "lb40", kg: 40 * 0.45359237, label: "40 lb" },
  { id: "kg40", kg: 40, label: "40 kg" },
  { id: "kg25", kg: 25, label: "25 kg" },
  { id: "kg20", kg: 20, label: "20 kg" },
] as const;

export const CUBIC_YARD = 0.9144 ** 3;
export const CUBIC_FOOT = 0.3048 ** 3;

export type ConcreteInput = {
  shape: ConcreteShape;
  /** Each size in metres (already converted), or a count. Undefined when empty, NaN when not a number. */
  values: Record<string, number | undefined>;
  /** Extra for spillage and uneven ground, in percent (0–100). */
  waste: number;
};

export type ConcreteError = "missing" | "invalid" | "inner" | "count" | "waste";

export type ConcreteResult =
  | { ok: true; /** One piece, m³. */ each: number; /** All pieces, m³. */ net: number; /** With waste, m³. */ total: number; bags: Array<{ id: string; label: string; count: number }> }
  | { ok: false; error: ConcreteError; field?: string };

/** Turns a typed size into metres. */
export function toMetres(value: number, unit: ConcreteUnit): number {
  return value * METRES[unit];
}

export function solveConcrete(input: ConcreteInput): ConcreteResult {
  const { shape, values } = input;
  if (!Number.isFinite(input.waste) || input.waste < 0 || input.waste > 100) return { ok: false, error: "waste" };
  const v: Record<string, number> = {};
  for (const field of CONCRETE_FIELDS[shape]) {
    const raw = values[field.id];
    if (raw === undefined) {
      if (OPTIONAL_FIELDS.has(field.id)) {
        v[field.id] = field.id === "quantity" ? 1 : 0;
        continue;
      }
      return { ok: false, error: "missing", field: field.id };
    }
    if (!Number.isFinite(raw) || raw < 0 || (raw === 0 && !OPTIONAL_FIELDS.has(field.id))) return { ok: false, error: "invalid", field: field.id };
    if (field.kind === "count" && (!Number.isInteger(raw) || raw < 1 || raw > 10_000)) return { ok: false, error: "count", field: field.id };
    v[field.id] = raw;
  }
  let each: number;
  let count = v.quantity ?? 1;
  switch (shape) {
    case "slab":
      each = v.length * v.width * v.thickness;
      break;
    case "footing":
      each = v.length * v.width * v.depth;
      break;
    case "wall":
      each = v.length * v.height * v.thickness;
      break;
    case "column":
      each = Math.PI * (v.diameter / 2) ** 2 * v.height;
      break;
    case "tube":
      if (v.inner >= v.outer) return { ok: false, error: "inner", field: "inner" };
      each = Math.PI * ((v.outer / 2) ** 2 - (v.inner / 2) ** 2) * v.height;
      break;
    case "stairs": {
      // Solid stairs on the ground: step k is a block k rises tall and one run deep; the platform is a top landing
      // as tall as the whole flight.
      const n = v.steps;
      each = v.width * v.run * v.rise * ((n * (n + 1)) / 2) + v.width * v.platform * v.rise * n;
      count = 1;
      break;
    }
  }
  const net = each * count;
  const total = net * (1 + input.waste / 100);
  const bags = BAGS.map((b) => ({ id: b.id, label: b.label, count: bagsFor(total, b.kg) }));
  return { ok: true, each, net, total, bags };
}

/** Whole bags of `kg` premix for `m3` of concrete, rounded up (with a hair of tolerance so 1.0000000001 bags is 1). */
export function bagsFor(m3: number, kg: number): number {
  const exact = (m3 * BAG_DENSITY_KG_M3) / kg;
  return Math.ceil(exact - 1e-9);
}
