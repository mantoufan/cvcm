import {
  MAX_BLUR_PX,
  circleOfConfusionMm,
  cocDiameterPx,
  composeGrade,
  exposureDelta,
  exposureGain,
  exposureValue,
  fillGrade,
  fillSceneGain,
  gaussianSigmaPx,
  handshakePx,
  sceneEV,
  solveAv,
  solveM,
  solveP,
  solveTv,
  teachingHints,
  type Grade,
  type HintId,
} from "../../shared/camera";
import {
  FRAME_EXPORT,
  FRAME_LIVE,
  catalog,
  cutoutFor,
  exportGeometry,
  eyeInPreview,
  frameCropFrom32,
  nativeToDecoded,
  sensorSourceRect,
  sitterDest32,
  subjectScale,
  type FrameId,
  type Rect,
  type SimState,
} from "../../shared/portrait-sim";
import type { DecodedImage } from "./assets";

export type ComposeResult = {
  eye: { x: number; y: number };
  hints: HintId[];
  aperture: number;
  iso: number;
  shutterSec: number;
  deltaEV: number;
  limitedBlur: boolean;
};

function supportsBlur(ctx: CanvasRenderingContext2D): boolean {
  const prev = ctx.filter;
  ctx.filter = "blur(2px)";
  const ok = ctx.filter.includes("blur");
  ctx.filter = prev || "none";
  return ok;
}

function intersect(a: Rect, b: Rect): Rect {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const r = Math.min(a.x + a.w, b.x + b.w);
  const btm = Math.min(a.y + a.h, b.y + b.h);
  return { x, y, w: Math.max(0, r - x), h: Math.max(0, btm - y) };
}

function expand(r: Rect, pad: number): Rect {
  return { x: r.x - pad, y: r.y - pad, w: r.w + pad * 2, h: r.h + pad * 2 };
}

function clampByte(n: number): number {
  return n < 0 ? 0 : n > 255 ? 255 : n;
}

function applyGrade(ctx: CanvasRenderingContext2D, grade: Grade, highlightOnly = false): void {
  const { width, height } = ctx.canvas;
  const img = ctx.getImageData(0, 0, width, height);
  const d = img.data;
  const m = grade.matrix;
  const g = grade.gain;
  const c = grade.contrast;
  const compress = grade.highlightCompress;
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i]! / 255;
    let gc = d[i + 1]! / 255;
    let b = d[i + 2]! / 255;
    if (highlightOnly) {
      const mx = Math.max(r, gc, b);
      if (mx > 0.85 && compress > 0) {
        const t = (mx - 0.85) * compress;
        r -= t;
        gc -= t;
        b -= t;
      }
      d[i] = clampByte(r * 255);
      d[i + 1] = clampByte(gc * 255);
      d[i + 2] = clampByte(b * 255);
      continue;
    }
    let R = m[0]! * r + m[1]! * gc + m[2]! * b;
    let G = m[3]! * r + m[4]! * gc + m[5]! * b;
    let B = m[6]! * r + m[7]! * gc + m[8]! * b;
    R *= g;
    G *= g;
    B *= g;
    R = (R - 0.5) * c + 0.5;
    G = (G - 0.5) * c + 0.5;
    B = (B - 0.5) * c + 0.5;
    d[i] = clampByte(R * 255);
    d[i + 1] = clampByte(G * 255);
    d[i + 2] = clampByte(B * 255);
  }
  ctx.putImageData(img, 0, 0);
}

function paintFillWash(ctx: CanvasRenderingContext2D, fill: "white" | "black" | "gold"): void {
  const { width: w, height: h } = ctx.canvas;
  const g = ctx.createRadialGradient(w * 0.28, h * 0.18, 6, w * 0.48, h * 0.42, Math.max(w, h) * 0.8);
  if (fill === "white") {
    g.addColorStop(0, "rgba(255,255,255,0.42)");
    g.addColorStop(1, "rgba(220,230,255,0)");
  } else if (fill === "gold") {
    g.addColorStop(0, "rgba(255,200,90,0.48)");
    g.addColorStop(1, "rgba(255,140,40,0)");
  } else {
    g.addColorStop(0, "rgba(190,90,255,0.46)");
    g.addColorStop(1, "rgba(40,0,90,0)");
  }
  ctx.save();
  ctx.globalCompositeOperation = "source-atop";
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function stampSubject(
  ctx: CanvasRenderingContext2D,
  subject: DecodedImage,
  dest: Rect,
  fill: SimState["fill"],
): void {
  if (fill === "off") {
    ctx.drawImage(subject.bitmap, dest.x, dest.y, dest.w, dest.h);
    return;
  }
  const layer = document.createElement("canvas");
  layer.width = Math.max(1, Math.round(dest.w));
  layer.height = Math.max(1, Math.round(dest.h));
  const lctx = layer.getContext("2d", { willReadFrequently: true });
  if (!lctx) {
    ctx.drawImage(subject.bitmap, dest.x, dest.y, dest.w, dest.h);
    return;
  }
  lctx.drawImage(subject.bitmap, 0, 0, layer.width, layer.height);
  const fg = fillGrade(fill);
  applyGrade(lctx, fg);
  paintFillWash(lctx, fill);
  if (fg.bloom > 0) bloom(lctx, fg.bloom, true);
  ctx.drawImage(layer, dest.x, dest.y, dest.w, dest.h);
}

function bloom(ctx: CanvasRenderingContext2D, amount: number, cheap: boolean): void {
  if (amount <= 0) return;
  const src = ctx.canvas;
  const small = document.createElement("canvas");
  const scale = cheap ? 0.25 : 0.4;
  small.width = Math.max(1, Math.round(src.width * scale));
  small.height = Math.max(1, Math.round(src.height * scale));
  const sctx = small.getContext("2d");
  if (!sctx) return;
  sctx.filter = "blur(8px)";
  sctx.drawImage(src, 0, 0, small.width, small.height);
  ctx.save();
  ctx.globalAlpha = amount;
  ctx.globalCompositeOperation = "screen";
  ctx.drawImage(small, 0, 0, src.width, src.height);
  ctx.restore();
}

function drawMapped(
  ctx: CanvasRenderingContext2D,
  image: DecodedImage,
  nativeSrc: Rect,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
): void {
  const src = nativeToDecoded(nativeSrc, image);
  ctx.drawImage(image.bitmap, src.x, src.y, src.w, src.h, dx, dy, dw, dh);
}

function blurLayer(
  dest: CanvasRenderingContext2D,
  draw: (ctx: CanvasRenderingContext2D, ox: number, oy: number) => void,
  box: Rect,
  sigma: number,
  sensor: { w: number; h: number },
): void {
  const pad = Math.ceil(3 * Math.min(sigma, MAX_BLUR_PX));
  const aabb = intersect(expand(box, pad), expand({ x: 0, y: 0, w: sensor.w, h: sensor.h }, pad));
  if (aabb.w < 1 || aabb.h < 1) return;
  const src = document.createElement("canvas");
  src.width = Math.max(1, Math.ceil(aabb.w));
  src.height = Math.max(1, Math.ceil(aabb.h));
  const sctx = src.getContext("2d");
  if (!sctx) return;
  draw(sctx, aabb.x, aabb.y);
  const blurred = document.createElement("canvas");
  blurred.width = src.width;
  blurred.height = src.height;
  const bctx = blurred.getContext("2d");
  if (!bctx) return;
  bctx.filter = `blur(${sigma}px)`;
  bctx.drawImage(src, 0, 0);
  dest.drawImage(blurred, aabb.x, aabb.y);
}

function solve(state: SimState) {
  const lens = catalog.lenses[state.lens];
  const evScene = sceneEV(state.light, state.filter);
  if (state.mode === "P") return solveP(evScene, lens, state.tripod, true, state.iso, lens.focalMm);
  if (state.mode === "Av") return solveAv(evScene, lens, state.aperture, state.iso);
  if (state.mode === "Tv") return solveTv(evScene, lens, state.shutterSec, state.iso);
  return solveM(lens, state.aperture, state.shutterSec, state.iso);
}

export function composePortrait(
  preview: HTMLCanvasElement,
  state: SimState,
  plate: DecodedImage,
  subject: DecodedImage,
  fg: DecodedImage | null,
  snap: boolean,
): ComposeResult {
  const lens = catalog.lenses[state.lens];
  const scene = catalog.scenes[state.scene];
  const cutout = cutoutFor(state.person, state.pose);
  if (!cutout) throw new Error("cutout");
  const plateSpec = scene.plates[lens.plate];
  const frame: FrameId = state.frame;
  const liveSize = FRAME_LIVE[frame];
  const geo = exportGeometry(plateSpec, lens.focalMm, frame, lens.id);
  const sensor = snap
    ? { w: FRAME_EXPORT["3-2"].w, h: FRAME_EXPORT["3-2"].h }
    : FRAME_LIVE["3-2"];
  const viewW = sensor.w;
  const nativeSrc = sensorSourceRect(plateSpec, lens.focalMm);
  const scale = subjectScale(lens.focalMm, state.distanceM);
  const dest = sitterDest32(cutout, scale, scene, nativeSrc, plateSpec.heightPx, sensor, frame);
  const crop = frameCropFrom32(frame, sensor);
  const solved = solve(state);
  const evScene = sceneEV(state.light, state.filter);
  const camEV = exposureValue(solved.aperture, solved.shutterSec, solved.iso);
  const deltaEV = exposureDelta(camEV, evScene);
  const gain = exposureGain(deltaEV);
  const fill = state.fill;
  const grade = composeGrade(state.light, state.filter, gain * fillSceneGain(fill));

  const bgCoc = circleOfConfusionMm({
    focalMm: lens.focalMm,
    sensorWidthMm: lens.sensorWidthMm,
    aperture: solved.aperture,
    focusM: state.focusM,
    planeM: scene.bgDistanceM,
  });
  const subCoc = circleOfConfusionMm({
    focalMm: lens.focalMm,
    sensorWidthMm: lens.sensorWidthMm,
    aperture: solved.aperture,
    focusM: state.focusM,
    planeM: state.distanceM,
  });
  const fgCoc = scene.fgDistanceM
    ? circleOfConfusionMm({
      focalMm: lens.focalMm,
      sensorWidthMm: lens.sensorWidthMm,
      aperture: solved.aperture,
      focusM: state.focusM,
      planeM: scene.fgDistanceM,
    })
    : 0;
  const bgSigma = gaussianSigmaPx(cocDiameterPx(bgCoc, viewW, lens.sensorWidthMm));
  const subSigma = gaussianSigmaPx(cocDiameterPx(subCoc, viewW, lens.sensorWidthMm));
  const fgSigma = gaussianSigmaPx(cocDiameterPx(fgCoc, viewW, lens.sensorWidthMm));
  const shake = handshakePx({
    tripod: state.tripod,
    focalMm: lens.focalMm,
    shutterSec: solved.shutterSec,
    viewWidthPx: viewW,
  });

  const sensorCanvas = document.createElement("canvas");
  sensorCanvas.width = sensor.w;
  sensorCanvas.height = sensor.h;
  const ctx = sensorCanvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("2d");
  const canBlur = supportsBlur(ctx);
  ctx.fillStyle = "#1b1216";
  ctx.fillRect(0, 0, sensor.w, sensor.h);

  const drawBg = (into: CanvasRenderingContext2D) => {
    drawMapped(into, plate, nativeSrc, 0, 0, sensor.w, sensor.h);
  };
  if (canBlur && bgSigma > 0.4) {
    blurLayer(ctx, (off, ox, oy) => {
      off.translate(-ox, -oy);
      drawBg(off);
    }, { x: 0, y: 0, w: sensor.w, h: sensor.h }, bgSigma, sensor);
  } else {
    drawBg(ctx);
  }
  if (grade.highlightCompress > 0) applyGrade(ctx, grade, true);

  const drawSubject = (into: CanvasRenderingContext2D, ox: number, oy: number) => {
    stampSubject(into, subject, { ...dest, x: dest.x - ox, y: dest.y - oy }, fill);
  };
  if (canBlur && subSigma > 0.4) {
    blurLayer(ctx, drawSubject, dest, subSigma, sensor);
  } else {
    stampSubject(ctx, subject, dest, fill);
  }

  if (fg && plateSpec.fgSrc) {
    const drawFg = (into: CanvasRenderingContext2D, ox: number, oy: number) => {
      into.translate(-ox, -oy);
      drawMapped(into, fg, nativeSrc, 0, 0, sensor.w, sensor.h);
    };
    if (canBlur && fgSigma > 0.4) {
      blurLayer(ctx, drawFg, { x: 0, y: 0, w: sensor.w, h: sensor.h }, fgSigma, sensor);
    } else {
      drawMapped(ctx, fg, nativeSrc, 0, 0, sensor.w, sensor.h);
    }
  }

  if (canBlur && shake > 0.4) {
    blurLayer(ctx, (off, ox, oy) => {
      off.drawImage(sensorCanvas, -ox, -oy);
    }, { x: 0, y: 0, w: sensor.w, h: sensor.h }, shake, sensor);
  }

  applyGrade(ctx, grade, false);
  if (grade.bloom > 0) bloom(ctx, grade.bloom, !snap);

  const outSize = snap ? geo.output : liveSize;
  preview.width = outSize.w;
  preview.height = outSize.h;
  const pctx = preview.getContext("2d");
  if (!pctx) throw new Error("2d");
  pctx.imageSmoothingEnabled = true;
  pctx.imageSmoothingQuality = "high";
  pctx.drawImage(
    sensorCanvas,
    crop.x, crop.y, crop.w, crop.h,
    0, 0, outSize.w, outSize.h,
  );

  const eye = eyeInPreview(dest, cutout.eye, crop, outSize);
  const hints = teachingHints({
    deltaEV,
    handshake: shake,
    focalMm: lens.focalMm,
    distanceM: state.distanceM,
    cocDiameterPx: cocDiameterPx(subCoc, viewW, lens.sensorWidthMm),
    filter: state.filter,
    light: state.light,
    defaultLight: scene.defaultLight,
  });
  return {
    eye,
    hints,
    aperture: solved.aperture,
    iso: solved.iso,
    shutterSec: solved.shutterSec,
    deltaEV,
    limitedBlur: !canBlur,
  };
}
