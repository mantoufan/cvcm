/// <reference lib="webworker" />
/**
 * The music generator's model, off the main thread: TensorFlow.js on its CPU backend can take seconds per piece,
 * which would freeze the page. The last piece's seeds stay here for "More like this".
 */
// Must stay the first import: it runs before Magenta's modules evaluate.
import "./worker-shim";
import type { MusicBars, Note } from "../../shared/music-gen";
import { compose, vary, type Sequence } from "./model";

/** `base`: the job whose piece "More like this" varies (the one the page is showing). */
export type MusicRequest = { id: number; type: "compose" | "vary"; base?: number; bars: MusicBars; temperature: number };
export type MusicResponse = { id: number; notes: Note[] } | { id: number; error: string };

declare const self: DedicatedWorkerGlobalScope;

/** Seeds of recent pieces by job id; the page may still be showing an older one if a newer render failed. */
const seedsByJob = new Map<number, Sequence[]>();
const KEEP = 8;

self.onmessage = async (e: MessageEvent<MusicRequest>) => {
  const { id, type, base, bars, temperature } = e.data;
  try {
    const from = base === undefined ? undefined : seedsByJob.get(base);
    const piece = type === "vary" && from ? await vary(from, bars, temperature) : await compose(bars, temperature);
    seedsByJob.set(id, piece.seeds);
    for (const old of [...seedsByJob.keys()].slice(0, -KEEP)) seedsByJob.delete(old);
    self.postMessage({ id, notes: piece.notes } satisfies MusicResponse);
  } catch (err) {
    self.postMessage({ id, error: err instanceof Error ? err.message : String(err) } satisfies MusicResponse);
  }
};
