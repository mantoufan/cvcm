/**
 * MusicVAE trio_4bar through @magenta/music (TensorFlow.js, WebGL or CPU). Imported only by the music generator and
 * only on the first Generate, so the page itself loads no TensorFlow.
 */
import { MusicVAE } from "@magenta/music/esm/music_vae/model.js";
import { modelFileUrl } from "../../shared/ai-models";
import { samplesFor, toNotes, BARS_PER_SAMPLE, STEPS_PER_BAR, type ModelNote, type MusicBars, type Note } from "../../shared/music-gen";
import { MODEL_HOST } from "../ai/host";

export type Sequence = Awaited<ReturnType<MusicVAE["sample"]>>[number];

let vae: MusicVAE | null = null;
let ready: Promise<void> | null = null;
/** Bumped by disposeModel, so a load that finishes after it frees itself instead of becoming the model. */
let generation = 0;

/** Loads the checkpoint once (about 18 MB); TensorFlow.js picks WebGL, or the CPU without it. */
export function loadModel(): Promise<void> {
  if (ready) return ready;
  const mine = generation;
  const load = (async () => {
    // Magenta appends "/config.json" etc.: no trailing slash, or the Worker sees "//" and refuses the path.
    const base = modelFileUrl("trio", "", MODEL_HOST, location.origin).replace(/\/$/, "");
    const model = new MusicVAE(base);
    await model.initialize();
    if (mine !== generation) {
      model.dispose();
      throw new Error("cancelled");
    }
    vae = model;
  })();
  ready = load;
  // Only this load's own failure clears it: a newer load may already be in flight.
  load.catch(() => {
    if (ready === load) ready = null;
  });
  return load;
}

const STEPS_PER_SAMPLE = BARS_PER_SAMPLE * STEPS_PER_BAR;

/** 4 bars is one sample; 8 and 16 bars move through the model's latent space from one end to the other. */
async function assemble(model: MusicVAE, ends: Sequence[], bars: MusicBars, temperature: number): Promise<{ notes: Note[]; seeds: Sequence[] }> {
  const count = samplesFor(bars);
  const parts = count === 1 ? [ends[0]] : count === 2 ? ends : await model.interpolate(ends, count, temperature);
  return { notes: parts.flatMap((seq, i) => toNotes((seq.notes ?? []) as ModelNote[], i * STEPS_PER_SAMPLE)), seeds: ends };
}

/** A new piece of `bars` bars. */
export async function compose(bars: MusicBars, temperature: number): Promise<{ notes: Note[]; seeds: Sequence[] }> {
  if (!vae) throw new Error("model not loaded");
  return assemble(vae, await vae.sample(2, temperature), bars, temperature);
}

/** "More like this": keeps the feel of the last piece and changes the details. */
export async function vary(seeds: Sequence[], bars: MusicBars, temperature: number): Promise<{ notes: Note[]; seeds: Sequence[] }> {
  if (!vae) throw new Error("model not loaded");
  const model = vae;
  const near = async (seq: Sequence): Promise<Sequence> => (await model.similar(seq, 1, 0.8, temperature))[0];
  return assemble(model, [await near(seeds[0]), await near(seeds[seeds.length - 1])], bars, temperature);
}

export function disposeModel(): void {
  generation++;
  vae?.dispose();
  vae = null;
  ready = null;
}
