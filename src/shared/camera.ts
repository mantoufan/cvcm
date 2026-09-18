export type FilterId = "none" | "uv" | "nd3" | "nd6" | "cpl" | "soft" | "warm" | "cool";
export type FillId = "off" | "white" | "black" | "gold";
export type LightId = "sunny" | "shade" | "window" | "overcast" | "golden";
export type Mode = "P" | "Av" | "Tv" | "M";
export type HintId =
  | "underexposed"
  | "overexposed"
  | "handshake"
  | "wideClose"
  | "missFocus"
  | "uvNoop"
  | "ndTripod"
  | "lightMismatch";

export const SENSOR_WIDTH_MM = 36;
export const MAX_BLUR_PX = 48;
export const APERTURES = [
  1.4, 1.6, 1.8, 2, 2.2, 2.5, 2.8, 3.2, 3.5, 4, 4.5, 5, 5.6, 6.3, 7.1, 8, 9, 10, 11, 13, 14, 16,
] as const;
export const ISOS = [100, 200, 400, 800, 1600, 3200, 6400] as const;
export const SHUTTERS = [
  1 / 4000, 1 / 2000, 1 / 1000, 1 / 500, 1 / 250, 1 / 125, 1 / 60, 1 / 15, 1 / 30, 1 / 8, 1 / 4, 1 / 2, 1,
] as const;

export const SHUTTER_TABLE = [1 / 4000, 1 / 2000, 1 / 1000, 1 / 500, 1 / 250, 1 / 125, 1 / 60, 1 / 30, 1 / 15, 1 / 8, 1 / 4, 1 / 2, 1];

export type LensOptics = {
  maxAperture: number;
  minAperture: number;
  apertureLocked: boolean;
};

export type Grade = {
  matrix: readonly [number, number, number, number, number, number, number, number, number];
  gain: number;
  bloom: number;
  highlightCompress: number;
  contrast: number;
};

const IDENTITY: Grade["matrix"] = [1, 0, 0, 0, 1, 0, 0, 0, 1];

export const LIGHT_EV100: Record<LightId, number> = {
  sunny: 15,
  shade: 12,
  window: 11,
  overcast: 12,
  golden: 11,
};

export const FILTER_STOPS: Record<FilterId, number> = {
  none: 0,
  uv: 0,
  nd3: -3,
  nd6: -6,
  cpl: -1.3,
  soft: 0,
  warm: 0,
  cool: 0,
};

const LIGHT_KELVIN: Record<LightId, Grade["matrix"]> = {
  sunny: diag(1.08, 1, 0.92),
  shade: diag(0.92, 1, 1.1),
  window: diag(1.12, 1, 0.86),
  overcast: IDENTITY,
  golden: diag(1.28, 1, 0.64),
};

const LIGHT_CONTRAST: Record<LightId, number> = {
  sunny: 1.15,
  shade: 0.9,
  window: 1,
  overcast: 0.85,
  golden: 1.1,
};

function diag(r: number, g: number, b: number): Grade["matrix"] {
  return [r, 0, 0, 0, g, 0, 0, 0, b];
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

function nearest(value: number, table: readonly number[]): number {
  let best = table[0]!;
  let dist = Math.abs(value - best);
  for (const item of table) {
    const d = Math.abs(value - item);
    if (d < dist) {
      best = item;
      dist = d;
    }
  }
  return best;
}

export function exposureValue(aperture: number, shutterSec: number, iso: number): number {
  return Math.log2((aperture * aperture) / shutterSec) - Math.log2(iso / 100);
}

export function exposureDelta(cameraEV: number, sceneEV: number): number {
  return cameraEV - sceneEV;
}

export function formatDeltaEV(delta: number): string {
  const clamped = Math.max(-3, Math.min(3, delta));
  if (Math.abs(clamped) < 0.08) return "0.0 EV";
  const shown = Math.round(clamped * 10) / 10;
  if (shown === 0) return "0.0 EV";
  return `${shown > 0 ? "+" : ""}${shown.toFixed(1)} EV`;
}

export function exposureGain(deltaEV: number): number {
  return 2 ** -deltaEV;
}

export function sceneEV(light: LightId, filter: FilterId): number {
  return LIGHT_EV100[light] + FILTER_STOPS[filter];
}

export function horizontalFovRad(focalMm: number): number {
  return 2 * Math.atan(SENSOR_WIDTH_MM / (2 * focalMm));
}

export function plateCrop(plateFocalMm: number, focalMm: number): number {
  return Math.min(1, plateFocalMm / focalMm);
}

export function actualFocalMm(equivFocalMm: number, sensorWidthMm: number): number {
  return equivFocalMm * (sensorWidthMm / SENSOR_WIDTH_MM);
}

export function circleOfConfusionMm(opts: {
  focalMm: number;
  sensorWidthMm: number;
  aperture: number;
  focusM: number;
  planeM: number;
}): number {
  const f = actualFocalMm(opts.focalMm, opts.sensorWidthMm);
  const N = opts.aperture;
  const s = opts.focusM * 1000;
  const d = opts.planeM * 1000;
  if (s <= f || d <= 0 || N <= 0) return 0;
  return (Math.abs(s - d) / d) * (f * f) / (N * (s - f));
}

export function cocDiameterPx(
  cocMm: number,
  viewWidthPx: number,
  sensorWidthMm = SENSOR_WIDTH_MM,
): number {
  return Math.min(MAX_BLUR_PX, (cocMm / sensorWidthMm) * viewWidthPx);
}

export function gaussianSigmaPx(diameterPx: number): number {
  return diameterPx / 2;
}

export function handshakePx(opts: {
  tripod: boolean;
  focalMm: number;
  shutterSec: number;
  viewWidthPx: number;
}): number {
  if (opts.tripod) return 0;
  const safe = 1 / Math.max(opts.focalMm, 1);
  const ratio = opts.shutterSec / safe;
  if (ratio <= 1) return 0;
  return Math.min(24, (ratio - 1) * (opts.viewWidthPx / 1440) * 4);
}

export function apertureTable(lens: LensOptics): number[] {
  return APERTURES.filter((n) => n + 1e-9 >= lens.maxAperture && n - 1e-9 <= lens.minAperture);
}

export function nearestAperture(n: number, lens: LensOptics): number {
  if (lens.apertureLocked) return lens.maxAperture;
  const table = apertureTable(lens);
  return nearest(n, table.length ? table : [lens.maxAperture]);
}

export function nearestIso(iso: number): number {
  return nearest(iso, ISOS);
}

export function nearestShutter(t: number): number {
  return nearest(t, SHUTTER_TABLE);
}

export function formatShutter(t: number): string {
  if (t >= 0.95) return `${Math.round(t)}s`;
  if (t >= 0.3) return `${t.toFixed(1).replace(/0+$/, "").replace(/\.$/, "")}s`;
  return `1/${Math.max(1, Math.round(1 / t))}`;
}

export function formatAperture(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? `f/${rounded}` : `f/${rounded.toFixed(1)}`;
}

export type ExposureSolve = { aperture: number; iso: number; shutterSec: number };

export function solveP(
  sceneEV100: number,
  lens: LensOptics,
  tripod: boolean,
  autoIso: boolean,
  userIso: number,
  focalMm: number,
): ExposureSolve {
  let N: number;
  if (lens.apertureLocked) {
    N = lens.maxAperture;
  } else {
    const lo = Math.min(Math.max(lens.maxAperture, 2.8), lens.minAperture);
    const hi = Math.min(lens.minAperture, 5.6);
    N = nearestAperture(clamp(4, Math.min(lo, hi), Math.max(lo, hi)), lens);
  }
  let iso = autoIso ? 100 : nearestIso(userIso);
  const tFrom = (n: number, isoVal: number) => n * n / ((isoVal / 100) * 2 ** sceneEV100);
  let t = nearestShutter(tFrom(N, iso));
  if (!tripod && autoIso && t > 1 / focalMm) {
    while (iso < 6400 && t > 1 / focalMm) {
      iso *= 2;
      t = nearestShutter(tFrom(N, iso));
    }
  }
  t = clamp(t, 1 / 4000, 1);
  return { aperture: N, iso, shutterSec: t };
}

export function solveAv(sceneEV100: number, lens: LensOptics, userN: number, iso: number): ExposureSolve {
  const N = nearestAperture(userN, lens);
  const t = nearestShutter(N * N / ((iso / 100) * 2 ** sceneEV100));
  return { aperture: N, iso: nearestIso(iso), shutterSec: clamp(t, 1 / 4000, 1) };
}

export function solveTv(sceneEV100: number, lens: LensOptics, userT: number, iso: number): ExposureSolve {
  const t = nearestShutter(userT);
  const N = nearestAperture(Math.sqrt(t * (iso / 100) * 2 ** sceneEV100), lens);
  return { aperture: N, iso: nearestIso(iso), shutterSec: clamp(t, 1 / 4000, 1) };
}

export function solveM(
  lens: LensOptics,
  userN: number,
  userT: number,
  iso: number,
): ExposureSolve {
  return {
    aperture: nearestAperture(userN, lens),
    iso: nearestIso(iso),
    shutterSec: nearestShutter(clamp(userT, 1 / 4000, 1)),
  };
}

function emptyGrade(matrix: Grade["matrix"], extras: Partial<Grade> = {}): Grade {
  return {
    matrix,
    gain: 1,
    bloom: 0,
    highlightCompress: 0,
    contrast: 1,
    ...extras,
  };
}

export function filterGrade(id: FilterId): Grade {
  if (id === "warm") return emptyGrade(diag(1.2, 1, 0.72));
  if (id === "cool") return emptyGrade(diag(0.88, 0.98, 1.18));
  if (id === "soft") return emptyGrade(IDENTITY, { bloom: 0.55, contrast: 0.86 });
  if (id === "cpl") return emptyGrade(IDENTITY, { highlightCompress: 0.45 });
  return emptyGrade(IDENTITY);
}

export function fillGrade(id: FillId): Grade {
  if (id === "white") return emptyGrade(diag(1.04, 1.05, 1.08), { gain: 1.38, contrast: 0.88 });
  if (id === "black") return emptyGrade(diag(0.95, 0.42, 1.58), { gain: 1.55, contrast: 1.12, bloom: 0.3 });
  if (id === "gold") return emptyGrade(diag(1.42, 1.08, 0.48), { gain: 1.22, contrast: 1.06, bloom: 0.18 });
  return emptyGrade(IDENTITY);
}

export function fillSceneGain(id: FillId): number {
  if (id === "black") return 0.48;
  if (id === "white") return 1.04;
  if (id === "gold") return 1.03;
  return 1;
}

export function lightGrade(id: LightId): Grade {
  return emptyGrade(LIGHT_KELVIN[id], { contrast: LIGHT_CONTRAST[id] });
}

function mul3(a: Grade["matrix"], b: Grade["matrix"]): Grade["matrix"] {
  const out = [0, 0, 0, 0, 0, 0, 0, 0, 0] as number[];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      out[i * 3 + j] = a[i * 3]! * b[j]! + a[i * 3 + 1]! * b[3 + j]! + a[i * 3 + 2]! * b[6 + j]!;
    }
  }
  return out as unknown as Grade["matrix"];
}

export function composeGrade(light: LightId, filter: FilterId, gain: number): Grade {
  const L = lightGrade(light);
  const F = filterGrade(filter);
  return {
    matrix: mul3(F.matrix, L.matrix),
    gain: gain * L.gain * F.gain,
    bloom: F.bloom,
    highlightCompress: F.highlightCompress,
    contrast: L.contrast * F.contrast,
  };
}

export function teachingHints(opts: {
  deltaEV: number;
  handshake: number;
  focalMm: number;
  distanceM: number;
  cocDiameterPx: number;
  filter: FilterId;
  light: LightId;
  defaultLight: LightId;
}): HintId[] {
  const out: HintId[] = [];
  const push = (id: HintId) => {
    if (out.length < 2 && !out.includes(id)) out.push(id);
  };
  if (opts.deltaEV >= 1.5) push("underexposed");
  else if (opts.deltaEV <= -1.5) push("overexposed");
  if (opts.handshake > 2) push("handshake");
  if (opts.focalMm <= 28 && opts.distanceM < 1.5) push("wideClose");
  if (opts.cocDiameterPx > 2) push("missFocus");
  if (opts.filter === "uv") push("uvNoop");
  if ((opts.filter === "nd3" || opts.filter === "nd6") && opts.handshake > 0) push("ndTripod");
  if (opts.light !== opts.defaultLight) push("lightMismatch");
  return out;
}
