/**
 * MusicVAE trio_4bar through @magenta/music (TensorFlow.js, WebGL or CPU). Runs inside model-worker.ts, so a CPU
 * fallback never freezes the page; the page itself loads no TensorFlow.
 */
import { MusicVAE } from "@magenta/music/esm/music_vae/model.js";
import { modelFileUrl } from "../../shared/ai-models";
import { samplesFor, toNotes, BARS_PER_SAMPLE, STEPS_PER_BAR, type ModelNote, type MusicBars, type Note } from "../../shared/music-gen";
import { MODEL_HOST } from "../ai/host";

export type Sequence = Awaited<ReturnType<MusicVAE["sample"]>>[number];

let ready: Promise<MusicVAE> | null = null;

/** Loads the checkpoint once (about 18 MB). */
function loadModel(): Promise<MusicVAE> {
  if (ready) return ready;
  const load = (async () => {
    // Magenta appends "/config.json" etc.: no trailing slash, or the Worker sees "//" and refuses the path.
    const base = modelFileUrl("trio", "", MODEL_HOST, self.location.origin).replace(/\/$/, "");
    const model = new MusicVAE(base);
    await model.initialize();
    return model;
  })();
  ready = load;
  load.catch(() => {
    if (ready === load) ready = null;
  });
  return load;
}

const STEPS_PER_SAMPLE = BARS_PER_SAMPLE * STEPS_PER_BAR;

/**
 * The 4-bar samples of a piece, arranged to loop smoothly: 4 bars = A; 8 bars = A and a close variation of it;
 * 16 bars = A → halfway → B → halfway, so the wrap back to A is a step, not a jump.
 */
async function arrange(model: MusicVAE, a: Sequence, b: () => Promise<Sequence>, bars: MusicBars, temperature: number): Promise<Sequence[]> {
  const count = samplesFor(bars);
  if (count === 1) return [a];
  if (count === 2) return [a, (await model.similar(a, 1, 0.85, temperature))[0]];
  const [start, middle, end] = await model.interpolate([a, await b()], 3, temperature);
  return [start, middle, end, middle];
}

function notesOf(parts: Sequence[]): Note[] {
  return parts.flatMap((seq, i) => toNotes((seq.notes ?? []) as ModelNote[], i * STEPS_PER_SAMPLE));
}

/** A new piece; `seeds` are kept by the worker for "More like this". */
export async function compose(bars: MusicBars, temperature: number): Promise<{ notes: Note[]; seeds: Sequence[] }> {
  const model = await loadModel();
  const count = samplesFor(bars);
  const samples = await model.sample(count === 4 ? 2 : 1, temperature);
  const parts = await arrange(model, samples[0], async () => samples[1], bars, temperature);
  return { notes: notesOf(parts), seeds: samples };
}

/** "More like this": keeps the feel of the last piece and changes the details. */
export async function vary(seeds: Sequence[], bars: MusicBars, temperature: number): Promise<{ notes: Note[]; seeds: Sequence[] }> {
  const model = await loadModel();
  const near = async (seq: Sequence): Promise<Sequence> => (await model.similar(seq, 1, 0.8, temperature))[0];
  const a = await near(seeds[0]);
  let b: Sequence | null = null;
  // With a single seed (a 4- or 8-bar piece), a looser variation of it stands in for the far end.
  const second = async (): Promise<Sequence> =>
    (b = seeds.length > 1 ? await near(seeds[1]) : (await model.similar(seeds[0], 1, 0.6, temperature))[0]);
  const parts = await arrange(model, a, second, bars, temperature);
  // Keep a second idea for a later 16-bar "More like this", even when this piece did not need one.
  const far = b ?? seeds[1];
  return { notes: notesOf(parts), seeds: far ? [a, far] : [a] };
}
