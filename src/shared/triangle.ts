/**
 * Triangle solver. Sides a, b, c sit opposite angles A, B, C (degrees). Give three values with at least one side
 * (SSS, SAS, SSA, ASA, AAS), or two values for a right triangle (C = 90°). SSA can have two triangles.
 */

export type TriangleInput = { a?: number; b?: number; c?: number; A?: number; B?: number; C?: number };

export type Solved = { a: number; b: number; c: number; A: number; B: number; C: number };

export type TriangleDetails = Solved & {
  area: number;
  perimeter: number;
  ha: number;
  hb: number;
  hc: number;
  inradius: number;
  circumradius: number;
  bySides: "equilateral" | "isosceles" | "scalene";
  byAngles: "acute" | "right" | "obtuse";
};

export type SolveCase = "sss" | "sas" | "ssa" | "asa" | "aas" | "right";

export type TriangleResult =
  | { ok: true; case: SolveCase; method: Method; solutions: TriangleDetails[] }
  | { ok: false; error: TriangleError };

/** Which laws produced the answer, for the working shown under the result. */
export type Method = "pythagoras" | "cosines" | "sines" | "anglesSum";

export type TriangleError =
  | "needThree"
  | "needSide"
  | "tooMany"
  | "positive"
  | "angleRange"
  | "angleSum"
  | "inequality"
  | "noTriangle"
  | "hypotenuse"
  | "rightTooMany";

const DEG = Math.PI / 180;
/** Relative tolerance for "equal" sides, a right angle, or an SSA height that just touches. */
const EPS = 1e-9;

const SIDES = ["a", "b", "c"] as const;
const ANGLES = ["A", "B", "C"] as const;
type Side = (typeof SIDES)[number];
type Angle = (typeof ANGLES)[number];
const OPP: Record<Side, Angle> = { a: "A", b: "B", c: "C" };

const sinD = (x: number) => Math.sin(x * DEG);
const cosD = (x: number) => Math.cos(x * DEG);
/** acos in degrees, clamped so rounding just past ±1 still works. */
const acosD = (x: number) => Math.acos(Math.max(-1, Math.min(1, x))) / DEG;
const asinD = (x: number) => Math.asin(Math.max(-1, Math.min(1, x))) / DEG;

export function solveTriangle(input: TriangleInput, right = false): TriangleResult {
  const given: TriangleInput = {};
  for (const k of [...SIDES, ...ANGLES]) {
    const v = input[k];
    if (v === undefined || v === null || Number.isNaN(v)) continue;
    if (!Number.isFinite(v) || v <= 0) return { ok: false, error: "positive" };
    given[k] = v;
  }
  if (right) {
    if (given.C !== undefined && Math.abs(given.C - 90) > EPS * 90) return { ok: false, error: "rightTooMany" };
    delete given.C;
    const count = Object.keys(given).length;
    if (count > 2) return { ok: false, error: "rightTooMany" };
    if (count < 2) return { ok: false, error: "needThree" };
    return solveRight(given);
  }
  const sides = SIDES.filter((k) => given[k] !== undefined);
  const angles = ANGLES.filter((k) => given[k] !== undefined);
  if (sides.length + angles.length > 3) return { ok: false, error: "tooMany" };
  if (sides.length + angles.length < 3) return { ok: false, error: "needThree" };
  if (!sides.length) return { ok: false, error: "needSide" };
  for (const k of angles) if (given[k]! >= 180) return { ok: false, error: "angleRange" };

  if (sides.length === 3) {
    const { a, b, c } = given as Required<Pick<TriangleInput, Side>>;
    const [x, y, z] = [a, b, c].sort((p, q) => p - q);
    if (x + y <= z * (1 + EPS)) return { ok: false, error: "inequality" };
    const A = acosD((b * b + c * c - a * a) / (2 * b * c));
    const B = acosD((a * a + c * c - b * b) / (2 * a * c));
    return done("sss", "cosines", [{ a, b, c, A, B, C: 180 - A - B }]);
  }

  if (angles.length >= 2) {
    const sum = angles.reduce((s, k) => s + given[k]!, 0);
    if (sum >= 180 * (1 - EPS)) return { ok: false, error: "angleSum" };
    const t: Partial<Solved> = { ...given };
    const missing = ANGLES.find((k) => given[k] === undefined)!;
    t[missing] = 180 - sum;
    const side = sides[0];
    const ratio = given[side]! / sinD(t[OPP[side]]!);
    for (const s of SIDES) if (t[s] === undefined) t[s] = ratio * sinD(t[OPP[s]]!);
    // ASA when the known side lies between the two known angles (it is opposite the computed one).
    return done(OPP[side] === missing ? "asa" : "aas", "sines", [t as Solved]);
  }

  // Two sides and one angle.
  const angle = angles[0];
  const [s1, s2] = sides;
  const third = SIDES.find((s) => !sides.includes(s))!;
  if (OPP[third] === angle) {
    // SAS: the angle sits between the two sides.
    const x = given[s1]!;
    const y = given[s2]!;
    const g = given[angle]!;
    const z = Math.sqrt(Math.max(0, x * x + y * y - 2 * x * y * cosD(g)));
    // A sliver angle between equal sides can round the third side to 0: no triangle to show.
    if (!(z > EPS * Math.max(x, y))) return { ok: false, error: "noTriangle" };
    const t: Partial<Solved> = { ...given, [third]: z };
    // The arccosine covers 0–180°, so unlike the law of sines it never picks the wrong branch.
    const angX = acosD((y * y + z * z - x * x) / (2 * y * z));
    t[OPP[s1]] = angX;
    t[OPP[s2]] = 180 - g - angX;
    return done("sas", "cosines", [t as Solved]);
  }
  // SSA: the angle is opposite one known side.
  const known = SIDES.find((s) => OPP[s] === angle)!; // side opposite the angle
  const other = sides.find((s) => s !== known)!;
  const g = given[angle]!;
  const p = given[known]!;
  const q = given[other]!;
  const sinOther = (q * sinD(g)) / p;
  if (sinOther > 1 + EPS) return { ok: false, error: "noTriangle" };
  // asin is steep near 1, so a height that just touches (sin = 1 up to rounding) is taken as exactly 90°.
  const touches = sinOther > 1 - 1e-12;
  const first = touches ? 90 : asinD(sinOther);
  const options = [first];
  // The obtuse alternative works when it leaves room for the third angle and is not the same angle.
  if (!touches && 180 - first + g < 180 * (1 - EPS)) options.push(180 - first);
  const solutions: Solved[] = [];
  for (const angOther of options) {
    const angThird = 180 - g - angOther;
    if (!(angThird > EPS)) continue;
    const t: Partial<Solved> = { ...given };
    t[OPP[other]] = angOther;
    t[OPP[third]] = angThird;
    t[third] = (p / sinD(g)) * sinD(angThird);
    solutions.push(t as Solved);
  }
  if (!solutions.length) return { ok: false, error: "noTriangle" };
  return done("ssa", "sines", solutions);
}

function solveRight(g: TriangleInput): TriangleResult {
  const { a, b, c, A, B } = g;
  if (A !== undefined && B !== undefined) return { ok: false, error: "needSide" };
  if (A !== undefined && A >= 90) return { ok: false, error: "angleRange" };
  if (B !== undefined && B >= 90) return { ok: false, error: "angleRange" };
  let t: Solved;
  let method: Method = "pythagoras";
  if (a !== undefined && b !== undefined) {
    const hyp = Math.hypot(a, b);
    t = { a, b, c: hyp, A: asinD(a / hyp), B: 0, C: 90 };
  } else if (c !== undefined && (a !== undefined || b !== undefined)) {
    const leg = (a ?? b)!;
    if (leg >= c * (1 - EPS)) return { ok: false, error: "hypotenuse" };
    const otherLeg = Math.sqrt(c * c - leg * leg);
    t = a !== undefined ? { a, b: otherLeg, c, A: asinD(a / c), B: 0, C: 90 } : { a: otherLeg, b: b!, c, A: acosD(b! / c), B: 0, C: 90 };
  } else {
    method = "sines";
    const ang = A ?? 90 - B!;
    const side = (a ?? b ?? c)!;
    // With A known: a = c·sin A, b = c·cos A.
    const hyp = a !== undefined ? side / sinD(ang) : b !== undefined ? side / cosD(ang) : side;
    t = { a: hyp * sinD(ang), b: hyp * cosD(ang), c: hyp, A: ang, B: 0, C: 90 };
    if (a !== undefined) t.a = a;
    if (b !== undefined) t.b = b;
    if (c !== undefined) t.c = c;
  }
  t.B = 90 - t.A;
  return done("right", method, [t]);
}

function done(kind: SolveCase, method: Method, list: Solved[]): TriangleResult {
  return { ok: true, case: kind, method, solutions: list.map(details) };
}

export function details(t: Solved): TriangleDetails {
  const { a, b, c, A, B, C } = t;
  const perimeter = a + b + c;
  const area = 0.5 * b * c * sinD(A);
  const near = (x: number, y: number) => Math.abs(x - y) <= 1e-9 * Math.max(x, y);
  const eq = [near(a, b), near(b, c), near(a, c)].filter(Boolean).length;
  const maxAngle = Math.max(A, B, C);
  return {
    ...t,
    area,
    perimeter,
    ha: (2 * area) / a,
    hb: (2 * area) / b,
    hc: (2 * area) / c,
    inradius: (2 * area) / perimeter,
    circumradius: a / (2 * sinD(A)),
    bySides: eq === 3 ? "equilateral" : eq ? "isosceles" : "scalene",
    byAngles: Math.abs(maxAngle - 90) < 1e-7 ? "right" : maxAngle > 90 ? "obtuse" : "acute",
  };
}

/** Number for display: up to `digits` decimals, no trailing zeros, −0 as 0 (dot decimal, like the inputs). */
export function fmt(n: number, digits = 4): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs !== 0 && (abs >= 1e12 || abs < 1e-4)) return n.toExponential(5).replace(/\.?0+e/, "e").replace("e+", "e");
  const s = n.toFixed(digits).replace(/\.?0+$/, "");
  return s === "-0" ? "0" : s;
}

/**
 * Vertex coordinates for drawing: C at the origin, side b along the x axis to A, B above.
 * Returns points scaled into a `w`×`h` box with `pad`, y pointing down (SVG).
 */
export function layout(t: Solved, w: number, h: number, pad: number): { A: [number, number]; B: [number, number]; C: [number, number] } {
  const C0: [number, number] = [0, 0];
  const A0: [number, number] = [t.b, 0];
  const B0: [number, number] = [t.a * cosD(t.C), t.a * sinD(t.C)];
  const xs = [C0[0], A0[0], B0[0]];
  const ys = [C0[1], A0[1], B0[1]];
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  const scale = Math.min((w - 2 * pad) / (maxX - minX || 1), (h - 2 * pad) / (maxY || 1));
  const offX = (w - (maxX - minX) * scale) / 2;
  const offY = (h + maxY * scale) / 2;
  const map = ([x, y]: [number, number]): [number, number] => [offX + (x - minX) * scale, offY - y * scale];
  return { A: map(A0), B: map(B0), C: map(C0) };
}
