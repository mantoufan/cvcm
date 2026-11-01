/** Frames from a canvas → MP4 with WebCodecs, in this tab. */
import { ArrayBufferTarget, Muxer } from "mp4-muxer";

type MuxCodec = "avc" | "vp9" | "av1";

/** Tried in order: H.264 plays everywhere (phones, WeChat, editors); VP9 / AV1 only if the browser lacks it. */
const CODECS: { codec: string; mux: MuxCodec }[] = [
  { codec: "avc1.640028", mux: "avc" },
  { codec: "avc1.4d0028", mux: "avc" },
  { codec: "avc1.42002a", mux: "avc" },
  { codec: "vp09.00.40.08", mux: "vp9" },
  { codec: "av01.0.08M.08", mux: "av1" },
];

export function canEncode(): boolean {
  return typeof VideoEncoder !== "undefined" && typeof VideoFrame !== "undefined";
}

async function pickCodec(width: number, height: number, bitrate: number, fps: number): Promise<{ config: VideoEncoderConfig; mux: MuxCodec }> {
  for (const { codec, mux } of CODECS) {
    const config: VideoEncoderConfig = { codec, width, height, bitrate, framerate: fps };
    if (mux === "avc") config.avc = { format: "avc" };
    try {
      const support = await VideoEncoder.isConfigSupported(config);
      if (support.supported) return { config, mux };
    } catch {
      /* try the next one */
    }
  }
  throw new Error("codec");
}

export async function encodeMp4(opts: {
  canvas: HTMLCanvasElement;
  frames: number;
  fps: number;
  /** Draw frame `i` onto the canvas. */
  draw: (i: number) => void;
  onProgress: (fraction: number) => void;
  cancelled: () => boolean;
}): Promise<Blob> {
  const { canvas, frames, fps } = opts;
  const { width, height } = canvas;
  const bitrate = Math.round(width * height * fps * 0.15);
  const { config, mux } = await pickCodec(width, height, bitrate, fps);
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: mux, width, height, frameRate: fps },
    fastStart: "in-memory",
    firstTimestampBehavior: "offset",
  });
  let failure: Error | null = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => {
      try {
        muxer.addVideoChunk(chunk, meta);
      } catch (e) {
        failure ??= e instanceof Error ? e : new Error(String(e));
      }
    },
    error: (e) => {
      failure = e instanceof Error ? e : new Error(String(e));
    },
  });
  encoder.configure(config);
  const usPerFrame = 1_000_000 / fps;
  try {
    for (let i = 0; i < frames; i++) {
      if (opts.cancelled()) throw new Error("cancelled");
      if (failure) throw failure;
      // Keep the queue short so memory stays flat on long or large clips.
      while (encoder.encodeQueueSize > 6) await new Promise((r) => setTimeout(r, 4));
      opts.draw(i);
      const frame = new VideoFrame(canvas, { timestamp: Math.round(i * usPerFrame), duration: Math.round(usPerFrame) });
      try {
        encoder.encode(frame, { keyFrame: i % (fps * 2) === 0 });
      } finally {
        frame.close();
      }
      opts.onProgress((i + 1) / frames);
      // Let the page paint the progress bar.
      if (i % 5 === 4) await new Promise((r) => setTimeout(r, 0));
    }
    await encoder.flush();
    if (failure) throw failure;
  } finally {
    if (encoder.state !== "closed") encoder.close();
  }
  muxer.finalize();
  return new Blob([muxer.target.buffer], { type: "video/mp4" });
}
