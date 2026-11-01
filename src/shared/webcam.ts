import { aspectOf } from "./aspect";

/** Resolutions the webcam test can ask for. "auto" lets the browser pick. */
export const WEBCAM_RESOLUTIONS = [
  { id: "auto", width: 0, height: 0 },
  { id: "480p", width: 640, height: 480 },
  { id: "720p", width: 1280, height: 720 },
  { id: "1080p", width: 1920, height: 1080 },
  { id: "4k", width: 3840, height: 2160 },
] as const;
export type WebcamResolutionId = (typeof WEBCAM_RESOLUTIONS)[number]["id"];

/** Video constraints for a resolution: `ideal` sizes, so a camera that cannot do it falls back to its nearest mode. */
export function videoConstraints(id: string, deviceId: string): MediaTrackConstraints {
  const res = WEBCAM_RESOLUTIONS.find((r) => r.id === id);
  const c: MediaTrackConstraints = {};
  if (deviceId) c.deviceId = { exact: deviceId };
  if (res && res.width) {
    c.width = { ideal: res.width };
    c.height = { ideal: res.height };
  }
  return c;
}

/** A common name for a frame size (by its shorter side), or "" when it has none. */
export function resolutionName(width: number, height: number): string {
  const short = Math.min(width, height);
  const names: Record<number, string> = { 2160: "4K", 1440: "1440p", 1080: "1080p", 720: "720p", 480: "480p", 360: "360p", 240: "240p" };
  return names[short] ?? "";
}

/** "1280 × 720 (720p)". */
export function sizeText(width: number, height: number): string {
  if (!(width > 0) || !(height > 0)) return "—";
  const name = resolutionName(width, height);
  return `${width} × ${height}${name ? ` (${name})` : ""}`;
}

/** Reduced aspect ratio, e.g. "16:9"; sizes a few pixels off a common ratio (1366 × 768) show that ratio. */
export function aspectText(width: number, height: number): string {
  const a = aspectOf(width, height);
  if (!a) return "—";
  for (const [w, h] of [[16, 9], [4, 3], [3, 2], [1, 1], [9, 16], [3, 4], [21, 9]] as const) {
    if (Math.abs(a.decimal - w / h) < 0.01) return `${w}:${h}`;
  }
  return a.ratio;
}

/** Frames per second from frame times (ms, ascending) over the last `windowMs`; 0 with fewer than two frames. */
export function framesPerSecond(times: readonly number[], windowMs = 1000): number {
  if (times.length < 2) return 0;
  const end = times[times.length - 1];
  let first = times.length - 1;
  while (first > 0 && end - times[first - 1] <= windowMs) first--;
  const span = end - times[first];
  const frames = times.length - 1 - first;
  if (!(span > 0) || frames < 1) return 0;
  return Math.round((frames * 1000) / span * 10) / 10;
}
