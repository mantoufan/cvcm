import {
  FILTER_STOPS,
  LIGHT_EV100,
  SENSOR_WIDTH_MM,
  filterGrade,
  nearestAperture,
  nearestIso,
  nearestShutter,
  plateCrop,
  type FilterId,
  type FillId,
  type LightId,
  type Mode,
} from "./camera";

export type { FilterId, FillId, LightId, Mode };

export type PersonId = "mira" | "ken" | "lin" | "yuki" | "ren";
export type PoseId = "stand34" | "sit45" | "prop" | "away";
export type SceneId = "window" | "shade" | "cafe" | "indoor";
export type LensId = "phone" | "24" | "35" | "50" | "85" | "135";
export type PlateKind = "wide" | "tele";
export type FrameId = "3-2" | "4-5" | "16-9";

export const MATCH = { focalMm: 50, distanceM: 2.2, k: 1, destHPx: 1080, eyeHeadroom: 0.12 } as const;
export const PLATE_VER = "3";

export const FRAME_LIVE: Record<FrameId, { w: number; h: number }> = {
  "3-2": { w: 1440, h: 960 },
  "4-5": { w: 1080, h: 1350 },
  "16-9": { w: 1280, h: 720 },
};

export const FRAME_EXPORT: Record<FrameId, { w: number; h: number }> = {
  "3-2": { w: 1920, h: 1280 },
  "4-5": { w: 1440, h: 1800 },
  "16-9": { w: 1920, h: 1080 },
};

export const EXPORT_LONG_EDGE_PX: Record<LensId, number> = {
  phone: 1920,
  "24": 1920,
  "35": 1920,
  "50": 1920,
  "85": 1920,
  "135": 1280,
};

export const FRAME_ASPECT: Record<FrameId, number> = {
  "3-2": 3 / 2,
  "4-5": 4 / 5,
  "16-9": 16 / 9,
};

export type Rect = { x: number; y: number; w: number; h: number };

export type PlateSpec = {
  kind: PlateKind;
  focalMm: number;
  widthPx: number;
  heightPx: number;
  src: string;
  fgSrc: string | null;
};

export type SceneSpec = {
  id: SceneId;
  plates: Record<PlateKind, PlateSpec>;
  bgDistanceM: number;
  fgDistanceM: number | null;
  distanceMinM: number;
  distanceMaxM: number;
  defaultLight: LightId;
  floorY: number;
  horizonY: number;
  thumb: string;
};

export type PoseSpec = {
  id: PoseId;
  thumb: string;
  subjectDistanceM: number;
};

export type CutoutSpec = {
  person: PersonId;
  pose: PoseId;
  src: string;
  widthPx: number;
  heightPx: number;
  feetY: number;
  eye: { x: number; y: number };
  subjectDistanceM: number;
};

export type PersonSpec = {
  id: PersonId;
  defaultPose: PoseId;
  poses: readonly PoseId[];
  thumb: string;
};

export type LensSpec = {
  id: LensId;
  focalMm: number;
  sensorWidthMm: number;
  maxAperture: number;
  minAperture: number;
  apertureLocked: boolean;
  plate: PlateKind;
};

export type Catalog = {
  match: typeof MATCH;
  people: Record<PersonId, PersonSpec>;
  poses: Record<PoseId, PoseSpec>;
  scenes: Record<SceneId, SceneSpec>;
  cutouts: readonly CutoutSpec[];
  lenses: Record<LensId, LensSpec>;
};

export type SimState = {
  person: PersonId;
  pose: PoseId;
  scene: SceneId;
  lens: LensId;
  frame: FrameId;
  mode: Mode;
  iso: number;
  autoIso: boolean;
  aperture: number;
  shutterSec: number;
  focusM: number;
  distanceM: number;
  tripod: boolean;
  filter: FilterId;
  fill: FillId;
  light: LightId;
};

const POSES: readonly PoseId[] = ["stand34", "sit45", "prop", "away"];
const PEOPLE: readonly PersonId[] = ["mira", "ken", "lin", "yuki", "ren"];

function plate(scene: SceneId, kind: PlateKind, fg: boolean): PlateSpec {
  const wide = kind === "wide";
  return {
    kind,
    focalMm: wide ? 24 : 85,
    widthPx: wide ? 3072 : 2048,
    heightPx: wide ? 2048 : 1365,
    src: `/covers/portrait-sim/scenes/${scene}-${kind}.webp?v=${PLATE_VER}`,
    fgSrc: fg ? `/covers/portrait-sim/scenes/${scene}-${kind}-fg.webp?v=${PLATE_VER}` : null,
  };
}

function scene(
  id: SceneId,
  bg: number,
  fg: number | null,
  light: LightId,
  floorY: number,
  withFg: boolean,
): SceneSpec {
  return {
    id,
    plates: { wide: plate(id, "wide", withFg), tele: plate(id, "tele", withFg) },
    bgDistanceM: bg,
    fgDistanceM: fg,
    distanceMinM: fg === null ? 0.8 : fg + 0.2,
    distanceMaxM: bg - 0.3,
    defaultLight: light,
    floorY,
    horizonY: floorY - 0.28,
    thumb: `/covers/portrait-sim/thumbs/scene-${id}.webp?v=${PLATE_VER}`,
  };
}

function cutout(person: PersonId, pose: PoseId, distanceM: number): CutoutSpec {
  const sit = pose === "sit45";
  return {
    person,
    pose,
    src: `/covers/portrait-sim/people/${person}/${pose}.webp?v=${PLATE_VER}`,
    widthPx: 900,
    heightPx: 1400,
    feetY: 0.985,
    eye: { x: sit ? 0.56 : 0.48, y: sit ? 0.12 : 0.1 },
    subjectDistanceM: distanceM,
  };
}

export const catalog: Catalog = {
  match: MATCH,
  people: {
    mira: {
      id: "mira",
      defaultPose: "stand34",
      poses: POSES,
      thumb: `/covers/portrait-sim/thumbs/mira.webp?v=${PLATE_VER}`,
    },
    ken: {
      id: "ken",
      defaultPose: "stand34",
      poses: POSES,
      thumb: `/covers/portrait-sim/thumbs/ken.webp?v=${PLATE_VER}`,
    },
    lin: {
      id: "lin",
      defaultPose: "stand34",
      poses: POSES,
      thumb: `/covers/portrait-sim/thumbs/lin.webp?v=${PLATE_VER}`,
    },
    yuki: {
      id: "yuki",
      defaultPose: "stand34",
      poses: POSES,
      thumb: `/covers/portrait-sim/thumbs/yuki.webp?v=${PLATE_VER}`,
    },
    ren: {
      id: "ren",
      defaultPose: "stand34",
      poses: POSES,
      thumb: `/covers/portrait-sim/thumbs/ren.webp?v=${PLATE_VER}`,
    },
  },
  poses: {
    stand34: { id: "stand34", thumb: `/covers/portrait-sim/thumbs/pose-stand34.webp?v=${PLATE_VER}`, subjectDistanceM: 2.2 },
    sit45: { id: "sit45", thumb: `/covers/portrait-sim/thumbs/pose-sit45.webp?v=${PLATE_VER}`, subjectDistanceM: 2 },
    prop: { id: "prop", thumb: `/covers/portrait-sim/thumbs/pose-prop.webp?v=${PLATE_VER}`, subjectDistanceM: 2 },
    away: { id: "away", thumb: `/covers/portrait-sim/thumbs/pose-away.webp?v=${PLATE_VER}`, subjectDistanceM: 2.2 },
  },
  scenes: {
    window: scene("window", 4.5, null, "window", 0.82, false),
    shade: scene("shade", 8, null, "shade", 0.78, false),
    cafe: scene("cafe", 5, 0.9, "window", 0.8, true),
    indoor: scene("indoor", 3.5, null, "overcast", 0.84, false),
  },
  cutouts: PEOPLE.flatMap((person) =>
    POSES.map((pose) => cutout(person, pose, pose === "sit45" || pose === "prop" ? 2 : 2.2)),
  ),
  lenses: {
    phone: { id: "phone", focalMm: 26, sensorWidthMm: 6.4, maxAperture: 1.8, minAperture: 1.8, apertureLocked: true, plate: "wide" },
    "24": { id: "24", focalMm: 24, sensorWidthMm: 36, maxAperture: 2.8, minAperture: 16, apertureLocked: false, plate: "wide" },
    "35": { id: "35", focalMm: 35, sensorWidthMm: 36, maxAperture: 1.8, minAperture: 16, apertureLocked: false, plate: "wide" },
    "50": { id: "50", focalMm: 50, sensorWidthMm: 36, maxAperture: 1.8, minAperture: 16, apertureLocked: false, plate: "wide" },
    "85": { id: "85", focalMm: 85, sensorWidthMm: 36, maxAperture: 1.8, minAperture: 16, apertureLocked: false, plate: "tele" },
    "135": { id: "135", focalMm: 135, sensorWidthMm: 36, maxAperture: 2, minAperture: 16, apertureLocked: false, plate: "tele" },
  },
};

export function defaultSimState(): SimState {
  return {
    person: "mira",
    pose: "stand34",
    scene: "window",
    lens: "50",
    frame: "3-2",
    mode: "Av",
    iso: 200,
    autoIso: false,
    aperture: 2.8,
    shutterSec: 1 / 125,
    focusM: MATCH.distanceM,
    distanceM: MATCH.distanceM,
    tripod: false,
    filter: "none",
    fill: "off",
    light: "window",
  };
}

export function cutoutFor(person: PersonId, pose: PoseId): CutoutSpec | undefined {
  return catalog.cutouts.find((item) => item.person === person && item.pose === pose);
}

export function subjectScale(focalMm: number, distanceM: number): number {
  return (focalMm / MATCH.focalMm) * (MATCH.distanceM / distanceM) * MATCH.k;
}

export function sensorSourceRect(plate: PlateSpec, focalMm: number): Rect {
  const frac = plateCrop(plate.focalMm, focalMm);
  const w = plate.widthPx * frac;
  const h = w * (24 / 36);
  return { x: (plate.widthPx - w) / 2, y: (plate.heightPx - h) / 2, w, h };
}

export function frameCropFrom32(frame: FrameId, sensor: { w: number; h: number }): Rect {
  const aspect = FRAME_ASPECT[frame];
  if (sensor.w / sensor.h > aspect) {
    const h = sensor.h;
    const w = h * aspect;
    return { x: (sensor.w - w) / 2, y: 0, w, h };
  }
  const w = sensor.w;
  const h = w / aspect;
  return { x: 0, y: (sensor.h - h) / 2, w, h };
}

export function sitterDest32(
  cutout: CutoutSpec,
  scale: number,
  sceneSpec: SceneSpec,
  src: Rect,
  plateHeightPx: number,
  sensor: { w: number; h: number },
  frame: FrameId,
): Rect {
  const destH = MATCH.destHPx * scale * (sensor.h / FRAME_LIVE["3-2"].h);
  const destW = destH * (cutout.widthPx / cutout.heightPx);
  const floorInSrc = (sceneSpec.floorY * plateHeightPx - src.y) / src.h;
  let floorPx = floorInSrc * sensor.h;
  if (floorPx < 0 || floorPx > sensor.h) floorPx = sensor.h;
  let destY = floorPx - destH * cutout.feetY;
  const destX = (sensor.w - destW) / 2;
  const minEye32 = MATCH.eyeHeadroom * sensor.h;
  const eyeY32 = destY + destH * cutout.eye.y;
  if (eyeY32 < minEye32) destY += minEye32 - eyeY32;
  const crop = frameCropFrom32(frame, sensor);
  const minEyeCrop = crop.y + MATCH.eyeHeadroom * crop.h;
  const eyeY = destY + destH * cutout.eye.y;
  if (eyeY < minEyeCrop) destY += minEyeCrop - eyeY;
  return { x: destX, y: destY, w: destW, h: destH };
}

export function scaleToLongEdge(frameSize: { w: number; h: number }, longEdge: number): { w: number; h: number } {
  const long = Math.max(frameSize.w, frameSize.h);
  const s = longEdge / long;
  return { w: Math.round(frameSize.w * s), h: Math.round(frameSize.h * s) };
}

export function exportGeometry(
  plate: PlateSpec,
  focalMm: number,
  frame: FrameId,
  lens: LensId,
): { nativeSrc: Rect; workingSensor: { w: number; h: number }; output: { w: number; h: number } } {
  const nativeSrc = sensorSourceRect(plate, focalMm);
  const desired = scaleToLongEdge(FRAME_EXPORT[frame], EXPORT_LONG_EDGE_PX[lens]);
  const srcFrame = frameCropFrom32(frame, { w: nativeSrc.w, h: nativeSrc.h });
  const s = Math.min(1, srcFrame.w / desired.w, srcFrame.h / desired.h);
  const output = {
    w: Math.max(1, Math.round(desired.w * s)),
    h: Math.max(1, Math.round(desired.h * s)),
  };
  return { nativeSrc, workingSensor: FRAME_EXPORT["3-2"], output };
}

export function eyeInPreview(
  dest: Rect,
  eye: { x: number; y: number },
  crop: Rect,
  preview: { w: number; h: number },
): { x: number; y: number } {
  const sx = dest.x + dest.w * eye.x;
  const sy = dest.y + dest.h * eye.y;
  return {
    x: ((sx - crop.x) / crop.w) * preview.w,
    y: ((sy - crop.y) / crop.h) * preview.h,
  };
}

const PERSONS = new Set<string>(PEOPLE);
const POSE_IDS = new Set<string>(POSES);
const SCENES = new Set<string>(["window", "shade", "cafe", "indoor"]);
const LENSES = new Set<string>(["phone", "24", "35", "50", "85", "135"]);
const FRAMES = new Set<string>(["3-2", "4-5", "16-9"]);
const MODES = new Set<string>(["P", "Av", "Tv", "M"]);
const FILTERS = new Set<string>(["none", "uv", "nd3", "nd6", "cpl", "soft", "warm", "cool"]);
const FILLS = new Set<string>(["off", "white", "black", "gold"]);
const LIGHTS = new Set<string>(["sunny", "shade", "window", "overcast", "golden"]);

function parseNum(raw: string | null): number | undefined {
  if (raw === null || raw === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

export function clampDistance(sceneId: SceneId, metres: number): number {
  const sceneSpec = catalog.scenes[sceneId];
  return Math.min(sceneSpec.distanceMaxM, Math.max(sceneSpec.distanceMinM, metres));
}

export function clampSimState(partial: Partial<SimState>, base = defaultSimState()): SimState {
  const sceneId = partial.scene && SCENES.has(partial.scene) ? partial.scene : base.scene;
  const pose = partial.pose && POSE_IDS.has(partial.pose) ? partial.pose : base.pose;
  const person = partial.person && PERSONS.has(partial.person) ? partial.person : base.person;
  const lensId = partial.lens && LENSES.has(partial.lens) ? partial.lens : base.lens;
  const lens = catalog.lenses[lensId];
  const mode = partial.mode && MODES.has(partial.mode) ? partial.mode : base.mode;
  const distanceM = clampDistance(sceneId, partial.distanceM ?? base.distanceM);
  const focusM = clampDistance(sceneId, partial.focusM ?? distanceM);
  return {
    person,
    pose,
    scene: sceneId,
    lens: lensId,
    frame: partial.frame && FRAMES.has(partial.frame) ? partial.frame : base.frame,
    mode,
    iso: nearestIso(partial.iso ?? base.iso),
    autoIso: mode === "P",
    aperture: nearestAperture(partial.aperture ?? base.aperture, lens),
    shutterSec: nearestShutter(partial.shutterSec ?? base.shutterSec),
    focusM,
    distanceM,
    tripod: Boolean(partial.tripod ?? base.tripod),
    filter: partial.filter && FILTERS.has(partial.filter) ? partial.filter : base.filter,
    fill: partial.fill && FILLS.has(partial.fill) ? partial.fill : base.fill,
    light: partial.light && LIGHTS.has(partial.light) ? partial.light : base.light,
  };
}

export function parseSimQuery(search: string): Partial<SimState> {
  const q = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const out: Partial<SimState> = {};
  const person = q.get("person");
  const pose = q.get("pose");
  const sceneId = q.get("scene");
  const lens = q.get("lens");
  const frame = q.get("frame");
  const mode = q.get("mode");
  const filter = q.get("filter");
  const fill = q.get("fill");
  const light = q.get("light");
  if (person && PERSONS.has(person)) out.person = person as PersonId;
  if (pose && POSE_IDS.has(pose)) out.pose = pose as PoseId;
  if (sceneId && SCENES.has(sceneId)) out.scene = sceneId as SceneId;
  if (lens && LENSES.has(lens)) out.lens = lens as LensId;
  if (frame && FRAMES.has(frame)) out.frame = frame as FrameId;
  if (mode && MODES.has(mode)) out.mode = mode as Mode;
  if (filter && FILTERS.has(filter)) out.filter = filter as FilterId;
  if (fill && FILLS.has(fill)) out.fill = fill as FillId;
  if (light && LIGHTS.has(light)) out.light = light as LightId;
  const iso = parseNum(q.get("iso"));
  const aperture = parseNum(q.get("aperture"));
  const shutter = parseNum(q.get("shutter"));
  const focus = parseNum(q.get("focus"));
  const distance = parseNum(q.get("distance"));
  if (iso !== undefined) out.iso = iso;
  if (aperture !== undefined) out.aperture = aperture;
  if (shutter !== undefined) out.shutterSec = shutter;
  if (focus !== undefined) out.focusM = focus;
  if (distance !== undefined) out.distanceM = distance;
  if (q.get("tripod") === "1" || q.get("tripod") === "true") out.tripod = true;
  if (q.get("tripod") === "0" || q.get("tripod") === "false") out.tripod = false;
  return out;
}

export function serializeSimQuery(state: SimState): string {
  const q = new URLSearchParams();
  q.set("person", state.person);
  q.set("pose", state.pose);
  q.set("scene", state.scene);
  q.set("lens", state.lens);
  q.set("frame", state.frame);
  q.set("mode", state.mode);
  q.set("iso", String(state.iso));
  q.set("aperture", String(state.aperture));
  q.set("shutter", String(state.shutterSec));
  q.set("focus", String(state.focusM));
  q.set("distance", String(state.distanceM));
  q.set("filter", state.filter);
  q.set("fill", state.fill);
  q.set("light", state.light);
  if (state.tripod) q.set("tripod", "1");
  const text = q.toString();
  return text ? `?${text}` : "";
}

export function nativeToDecoded(native: Rect, image: { nativeW: number; nativeH: number; decodedW: number; decodedH: number }): Rect {
  const sx = image.decodedW / image.nativeW;
  const sy = image.decodedH / image.nativeH;
  return { x: native.x * sx, y: native.y * sy, w: native.w * sx, h: native.h * sy };
}

export { FILTER_STOPS, LIGHT_EV100, SENSOR_WIDTH_MM, filterGrade };
