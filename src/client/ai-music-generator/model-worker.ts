/// <reference lib="webworker" />
/**
 * The music generator's model, off the main thread: TensorFlow.js on its CPU backend can take seconds per piece,
 * which would freeze the page. The last piece's seeds stay here for "More like this".
 */
// Must stay the first import: it runs before Magenta's modules evaluate.
import "./worker-shim";
import type { MusicBars, Note } from "../../shared/music-gen";
import { compose, vary, type Sequence } from "./model";

export type MusicRequest = { id: number; type: "compose" | "vary"; bars: MusicBars; temperature: number };
export type MusicResponse = { id: number; notes: Note[] } | { id: number; error: string };

declare const self: DedicatedWorkerGlobalScope;

let seeds: Sequence[] | null = null;

self.onmessage = async (e: MessageEvent<MusicRequest>) => {
  const { id, type, bars, temperature } = e.data;
  try {
    const piece = type === "vary" && seeds ? await vary(seeds, bars, temperature) : await compose(bars, temperature);
    seeds = piece.seeds;
    self.postMessage({ id, notes: piece.notes } satisfies MusicResponse);
  } catch (err) {
    self.postMessage({ id, error: err instanceof Error ? err.message : String(err) } satisfies MusicResponse);
  }
};
