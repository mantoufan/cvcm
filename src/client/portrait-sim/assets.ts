import { catalog } from "../../shared/portrait-sim";

export type DecodedImage = {
  src: string;
  bitmap: ImageBitmap;
  nativeW: number;
  nativeH: number;
  decodedW: number;
  decodedH: number;
};

const LIVE_MAX_EDGE = 1536;
const BUDGET = 64 * 1024 * 1024;
const HERO_CAP = 8;

type Entry = DecodedImage & { bytes: number };
const cache = new Map<string, Entry>();
const order: string[] = [];

function estimate(w: number, h: number): number {
  return w * h * 4;
}

function touch(key: string): void {
  const i = order.indexOf(key);
  if (i >= 0) order.splice(i, 1);
  order.push(key);
}

function used(): number {
  let n = 0;
  for (const item of cache.values()) n += item.bytes;
  return n;
}

function evict(needed: number): void {
  while (cache.size && used() + needed > BUDGET) {
    const key = order.shift();
    if (!key) break;
    const item = cache.get(key);
    cache.delete(key);
    item?.bitmap.close();
  }
  while (cache.size > HERO_CAP) {
    const key = order.shift();
    if (!key) break;
    const item = cache.get(key);
    cache.delete(key);
    item?.bitmap.close();
  }
}

async function decode(src: string, signal: AbortSignal, maxEdge: number): Promise<Entry> {
  const res = await fetch(src, { signal });
  if (!res.ok) throw new Error("plate");
  const blob = await res.blob();
  const full = await createImageBitmap(blob);
  const nativeW = full.width;
  const nativeH = full.height;
  const long = Math.max(nativeW, nativeH);
  let bitmap = full;
  let decodedW = nativeW;
  let decodedH = nativeH;
  if (long > maxEdge) {
    const s = maxEdge / long;
    decodedW = Math.max(1, Math.round(nativeW * s));
    decodedH = Math.max(1, Math.round(nativeH * s));
    bitmap = await createImageBitmap(full, {
      resizeWidth: decodedW,
      resizeHeight: decodedH,
      resizeQuality: "high",
    });
    full.close();
  }
  return { src, bitmap, nativeW, nativeH, decodedW, decodedH, bytes: estimate(decodedW, decodedH) };
}

export async function loadHero(src: string, signal: AbortSignal, native = false): Promise<DecodedImage> {
  const key = `${native ? "n" : "l"}:${src}`;
  const hit = cache.get(key);
  if (hit) {
    touch(key);
    return hit;
  }
  const maxEdge = native ? 4096 : LIVE_MAX_EDGE;
  const probe = native ? 3072 * 2048 * 4 : LIVE_MAX_EDGE * LIVE_MAX_EDGE * 4;
  evict(probe);
  const entry = await decode(src, signal, maxEdge);
  if (signal.aborted) {
    entry.bitmap.close();
    throw new DOMException("aborted", "AbortError");
  }
  evict(entry.bytes);
  cache.set(key, entry);
  touch(key);
  return entry;
}

export function dropHero(src: string): void {
  for (const prefix of ["n:", "l:"]) {
    const key = prefix + src;
    const item = cache.get(key);
    if (!item) continue;
    cache.delete(key);
    const i = order.indexOf(key);
    if (i >= 0) order.splice(i, 1);
    item.bitmap.close();
  }
}

export function clearHeroes(): void {
  for (const item of cache.values()) item.bitmap.close();
  cache.clear();
  order.length = 0;
}

export function plateSrc(sceneId: keyof typeof catalog.scenes, lensId: keyof typeof catalog.lenses): string {
  const kind = catalog.lenses[lensId].plate;
  return catalog.scenes[sceneId].plates[kind].src;
}

export function fgSrc(sceneId: keyof typeof catalog.scenes, lensId: keyof typeof catalog.lenses): string | null {
  const kind = catalog.lenses[lensId].plate;
  return catalog.scenes[sceneId].plates[kind].fgSrc;
}
