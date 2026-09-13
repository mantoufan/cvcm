export const UNIT_KINDS = ["length", "mass", "temperature", "volume", "area", "speed"] as const;
export type UnitKind = (typeof UNIT_KINDS)[number];

type LinearTable = Record<string, number>;

const LENGTH: LinearTable = {
  mm: 0.001,
  cm: 0.01,
  m: 1,
  km: 1000,
  in: 0.0254,
  ft: 0.3048,
  yd: 0.9144,
  mi: 1609.344,
};

const MASS: LinearTable = {
  mg: 1e-6,
  g: 0.001,
  kg: 1,
  t: 1000,
  oz: 0.028349523125,
  lb: 0.45359237,
  st: 6.35029318,
};

const VOLUME: LinearTable = {
  ml: 0.001,
  l: 1,
  tsp: 0.00492892159375,
  tbsp: 0.01478676478125,
  cup: 0.2365882365,
  floz: 0.0295735295625,
  pt: 0.473176473,
  qt: 0.946352946,
  gal: 3.785411784,
};

const AREA: LinearTable = {
  cm2: 1e-4,
  m2: 1,
  km2: 1e6,
  in2: 0.00064516,
  ft2: 0.09290304,
  yd2: 0.83612736,
  acre: 4046.8564224,
  ha: 1e4,
};

const SPEED: LinearTable = {
  mps: 1,
  kph: 1000 / 3600,
  mph: 1609.344 / 3600,
  kn: 1852 / 3600,
  fps: 0.3048,
};

const LINEAR: Record<Exclude<UnitKind, "temperature">, LinearTable> = {
  length: LENGTH,
  mass: MASS,
  volume: VOLUME,
  area: AREA,
  speed: SPEED,
};

export const UNIT_IDS: Record<UnitKind, readonly string[]> = {
  length: Object.keys(LENGTH),
  mass: Object.keys(MASS),
  temperature: ["C", "F", "K"],
  volume: Object.keys(VOLUME),
  area: Object.keys(AREA),
  speed: Object.keys(SPEED),
};

export const UNIT_LABEL: Record<string, string> = {
  mm: "mm",
  cm: "cm",
  m: "m",
  km: "km",
  in: "in",
  ft: "ft",
  yd: "yd",
  mi: "mi",
  mg: "mg",
  g: "g",
  kg: "kg",
  t: "t",
  oz: "oz",
  lb: "lb",
  st: "st",
  C: "°C",
  F: "°F",
  K: "K",
  ml: "ml",
  l: "L",
  tsp: "tsp",
  tbsp: "tbsp",
  cup: "cup",
  floz: "fl oz",
  pt: "pt",
  qt: "qt",
  gal: "gal",
  cm2: "cm²",
  m2: "m²",
  km2: "km²",
  in2: "in²",
  ft2: "ft²",
  yd2: "yd²",
  acre: "acre",
  ha: "ha",
  mps: "m/s",
  kph: "km/h",
  mph: "mph",
  kn: "kn",
  fps: "ft/s",
};

export const DEFAULT_PAIR: Record<UnitKind, readonly [string, string]> = {
  length: ["in", "cm"],
  mass: ["lb", "kg"],
  temperature: ["C", "F"],
  volume: ["gal", "l"],
  area: ["ft2", "m2"],
  speed: ["mph", "kph"],
};

function toCelsius(value: number, from: string): number {
  if (from === "C") return value;
  if (from === "F") return (value - 32) * (5 / 9);
  if (from === "K") return value - 273.15;
  return NaN;
}

function fromCelsius(celsius: number, to: string): number {
  if (to === "C") return celsius;
  if (to === "F") return celsius * (9 / 5) + 32;
  if (to === "K") return celsius + 273.15;
  return NaN;
}

export function convertAmount(kind: UnitKind, value: number, from: string, to: string): number {
  if (!Number.isFinite(value)) return NaN;
  if (from === to) return value;
  if (kind === "temperature") return fromCelsius(toCelsius(value, from), to);
  const table = LINEAR[kind];
  const a = table[from];
  const b = table[to];
  if (a == null || b == null) return NaN;
  return (value * a) / b;
}

export function formatAmount(n: number): string {
  if (!Number.isFinite(n)) return "";
  if (n === 0) return "0";
  const abs = Math.abs(n);
  if (abs >= 1e9 || abs < 1e-7) {
    return n.toExponential(6).replace(/(\.\d*?)0+e/i, "$1e").replace(/\.e/i, "e");
  }
  return String(Number(n.toPrecision(12)));
}

export function unitLabel(id: string): string {
  return UNIT_LABEL[id] ?? id;
}

export type ConvertedUnit = {
  value: number;
  formatted: string;
  label: string;
  formula: string;
};

export function convertUnits(
  kind: UnitKind,
  value: number,
  from: string,
  to: string,
): ConvertedUnit {
  const out = convertAmount(kind, value, from, to);
  const one = convertAmount(kind, 1, from, to);
  const fromL = unitLabel(from);
  const toL = unitLabel(to);
  const formula = kind === "temperature"
    ? `${formatAmount(value)} ${fromL} = ${formatAmount(out)} ${toL}`
    : `1 ${fromL} = ${formatAmount(one)} ${toL}`;
  return {
    value: out,
    formatted: formatAmount(out),
    label: toL,
    formula,
  };
}

export function isUnitKind(value: string): value is UnitKind {
  return (UNIT_KINDS as readonly string[]).includes(value);
}
