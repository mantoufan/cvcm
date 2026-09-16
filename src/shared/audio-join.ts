import { resampleChannels } from "./wav";

export type AudioClip = { channels: Float32Array[]; sampleRate: number };

export function concatClips(clips: AudioClip[]): AudioClip {
  const ready = clips.filter((c) => c.channels.length && (c.channels[0]?.length ?? 0) > 0);
  if (!ready.length) return { channels: [], sampleRate: 44100 };
  const sampleRate = Math.max(1, ready[0]!.sampleRate);
  const aligned = ready.map((clip) => ({
    channels: resampleChannels(clip.channels, clip.sampleRate, sampleRate),
  }));
  const chCount = Math.max(...aligned.map((c) => c.channels.length), 1);
  const total = aligned.reduce((n, c) => n + (c.channels[0]?.length ?? 0), 0);
  const channels = Array.from({ length: chCount }, () => new Float32Array(total));
  let offset = 0;
  for (const clip of aligned) {
    const len = clip.channels[0]?.length ?? 0;
    for (let ch = 0; ch < chCount; ch++) {
      const src = clip.channels[ch] ?? clip.channels[0];
      if (src) channels[ch]!.set(src.subarray(0, len), offset);
    }
    offset += len;
  }
  return { channels, sampleRate };
}
