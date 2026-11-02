/** Plays the model's notes with plain Web Audio synths, rendered offline: playback and the WAV are the same render. */
import { drumKind, midiToHz, pieceSeconds, stepSeconds, stepTime, type Note, type StylePreset } from "../../shared/music-gen";

const SAMPLE_RATE = 44_100;

/** Renders the piece (plus a short tail for releases and echo) to stereo audio. */
export async function renderPiece(notes: readonly Note[], bars: number, preset: StylePreset): Promise<AudioBuffer> {
  const loop = pieceSeconds(bars, preset.bpm);
  const tail = 1.5 + preset.lead.echo * 3;
  const ctx = new OfflineAudioContext(2, Math.ceil((loop + tail) * SAMPLE_RATE), SAMPLE_RATE);
  const master = ctx.createGain();
  master.gain.value = 0.9;
  // A gentle limiter so dense drum hits never clip the WAV.
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -10;
  comp.ratio.value = 6;
  master.connect(comp).connect(ctx.destination);

  const leadBus = ctx.createGain();
  leadBus.connect(master);
  if (preset.lead.echo > 0) {
    const delay = ctx.createDelay(2);
    delay.delayTime.value = stepSeconds(preset.bpm) * 3;
    const feedback = ctx.createGain();
    feedback.gain.value = preset.lead.echo;
    const wet = ctx.createGain();
    wet.gain.value = 0.5;
    leadBus.connect(delay);
    delay.connect(feedback).connect(delay);
    delay.connect(wet).connect(master);
  }
  const noise = noiseBuffer(ctx);
  const step = stepSeconds(preset.bpm);
  for (const n of notes) {
    const t = stepTime(n.start, preset.bpm, preset.swing);
    const dur = Math.max(step * 0.9, (n.end - n.start) * step);
    const vel = n.velocity / 127;
    if (n.part === "drums") drum(ctx, master, noise, drumKind(n.pitch), t, vel * preset.drums);
    else if (n.part === "bass") tone(ctx, master, n.pitch, t, dur, vel * preset.bass.gain, preset.bass.wave, preset.bass.cutoff, 0.005, 0.08);
    else tone(ctx, leadBus, n.pitch, t, dur, vel * preset.lead.gain, preset.lead.wave, preset.lead.cutoff, preset.lead.attack, preset.lead.release);
  }
  return ctx.startRendering();
}

function tone(
  ctx: BaseAudioContext,
  out: AudioNode,
  pitch: number,
  t: number,
  dur: number,
  gain: number,
  wave: OscillatorType,
  cutoff: number,
  attack: number,
  release: number,
): void {
  const osc = ctx.createOscillator();
  osc.type = wave;
  osc.frequency.value = midiToHz(pitch);
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = cutoff;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(gain, t + attack);
  env.gain.setValueAtTime(gain, t + Math.max(attack, dur));
  env.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(attack, dur) + release);
  osc.connect(filter).connect(env).connect(out);
  osc.start(t);
  osc.stop(t + Math.max(attack, dur) + release + 0.05);
}

function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = buf.getChannelData(0);
  // A fixed pseudo-random sequence: the same piece always renders to the same WAV.
  let seed = 22_222;
  for (let i = 0; i < data.length; i++) {
    seed = (seed * 16_807) % 2_147_483_647;
    data[i] = (seed / 2_147_483_647) * 2 - 1;
  }
  return buf;
}

function noiseHit(ctx: BaseAudioContext, out: AudioNode, noise: AudioBuffer, t: number, gain: number, decay: number, type: BiquadFilterType, freq: number): void {
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  const env = ctx.createGain();
  env.gain.setValueAtTime(gain, t);
  env.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  src.connect(filter).connect(env).connect(out);
  src.start(t);
  src.stop(t + decay + 0.02);
}

function sweep(ctx: BaseAudioContext, out: AudioNode, t: number, gain: number, from: number, to: number, decay: number): void {
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.exponentialRampToValueAtTime(to, t + decay * 0.6);
  const env = ctx.createGain();
  env.gain.setValueAtTime(gain, t);
  env.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  osc.connect(env).connect(out);
  osc.start(t);
  osc.stop(t + decay + 0.02);
}

function drum(ctx: BaseAudioContext, out: AudioNode, noise: AudioBuffer, kind: ReturnType<typeof drumKind>, t: number, vel: number): void {
  if (vel <= 0) return;
  switch (kind) {
    case "kick":
      sweep(ctx, out, t, 0.9 * vel, 150, 45, 0.35);
      return;
    case "snare":
      sweep(ctx, out, t, 0.25 * vel, 220, 160, 0.1);
      noiseHit(ctx, out, noise, t, 0.45 * vel, 0.18, "highpass", 1500);
      return;
    case "hat":
      noiseHit(ctx, out, noise, t, 0.18 * vel, 0.05, "highpass", 7000);
      return;
    case "openhat":
      noiseHit(ctx, out, noise, t, 0.16 * vel, 0.3, "highpass", 6500);
      return;
    case "tom":
      sweep(ctx, out, t, 0.5 * vel, 200, 110, 0.25);
      return;
    case "cymbal":
      noiseHit(ctx, out, noise, t, 0.12 * vel, 0.9, "highpass", 5000);
  }
}

/**
 * The loop for playback: the piece cut at the last bar line with its tail (releases, echo) added back onto the
 * start, as it would ring over the next repeat. The WAV keeps the tail at the end instead.
 */
export function loopBuffer(audio: AudioBuffer, loopSeconds: number): AudioBuffer {
  const length = Math.min(audio.length, Math.round(loopSeconds * audio.sampleRate));
  const loop = new AudioBuffer({ length, numberOfChannels: audio.numberOfChannels, sampleRate: audio.sampleRate });
  for (let c = 0; c < audio.numberOfChannels; c++) {
    const src = audio.getChannelData(c);
    const out = loop.getChannelData(c);
    out.set(src.subarray(0, length));
    for (let i = length; i < src.length; i++) out[(i - length) % length] += src[i];
  }
  return loop;
}
