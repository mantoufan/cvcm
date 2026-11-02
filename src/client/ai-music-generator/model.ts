/**
 * MusicVAE trio_4bar through @magenta/music (TensorFlow.js, WebGL or CPU). Imported only by the music generator and
 * only on the first Generate, so the page itself loads no TensorFlow.
 */
import * as tf from "@tensorflow/tfjs";
import { MusicVAE } from "@magenta/music/esm/music_vae/model.js";
import { modelFileUrl } from "../../shared/ai-models";
import { toNotes, BARS_PER_SAMPLE, STEPS_PER_BAR, type ModelNote, type MusicBars, type Note } from "../../shared/music-gen";
import { MODEL_HOST } from "../ai/host";

type Sequence = Awaited<ReturnType<MusicVAE["sample"]>>[number];

let vae: MusicVAE | null = null;
let ready: Promise<{ backend: string }> | null = null;

/** Loads the checkpoint once (about 18 MB); TensorFlow.js picks WebGL, or the CPU without it. */
export function loadModel(): Promise<{ backend: string }> {
  ready ??= (async () => {
    // Magenta appends "/config.json" etc.: no trailing slash, or the Worker sees "//" and refuses the path.
    const base = modelFileUrl("trio", "", MODEL_HOST, location.origin).replace(/\/$/, "");
    const model = new MusicVAE(base);
    await model.initialize();
    vae = model;
    return { backend: tf.getBackend() };
  })();
  ready.catch(() => {
    ready = null;
  });
  return ready;
}

const STEPS_PER_SAMPLE = BARS_PER_SAMPLE * STEPS_PER_BAR;

/**
 * A new piece of `bars` bars. 4 bars is one sample; 8 and 16 bars morph from one sample to another through the
 * model's latent space, so the music develops instead of looping the same 4 bars.
 */
export async function compose(bars: MusicBars, temperature: number): Promise<{ notes: Note[]; seeds: Sequence[] }> {
  if (!vae) throw new Error("model not loaded");
  const count = bars / BARS_PER_SAMPLE;
  const ends = await vae.sample(2, temperature);
  const parts = count === 1 ? [ends[0]] : count === 2 ? ends : await vae.interpolate(ends, count, temperature);
  return { notes: parts.flatMap((seq, i) => toNotes((seq.notes ?? []) as ModelNote[], i * STEPS_PER_SAMPLE)), seeds: ends };
}

/** "More like this": keeps the feel of the last piece and changes the details. */
export async function vary(seeds: Sequence[], bars: MusicBars, temperature: number): Promise<{ notes: Note[]; seeds: Sequence[] }> {
  if (!vae) throw new Error("model not loaded");
  const count = bars / BARS_PER_SAMPLE;
  const ends = [(await vae.similar(seeds[0], 1, 0.8, temperature))[0], (await vae.similar(seeds[seeds.length - 1], 1, 0.8, temperature))[0]];
  const parts = count === 1 ? [ends[0]] : count === 2 ? ends : await vae.interpolate(ends, count, temperature);
  return { notes: parts.flatMap((seq, i) => toNotes((seq.notes ?? []) as ModelNote[], i * STEPS_PER_SAMPLE)), seeds: ends };
}

export function disposeModel(): void {
  vae?.dispose();
  vae = null;
  ready = null;
}
