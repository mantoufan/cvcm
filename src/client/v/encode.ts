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

/** The encoder or muxer failed (not the drawing, not a cancel): the next codec may still work. */
class CodecError extends Error {}

export function canEncode(): boolean {
  return typeof VideoEncoder !== "undefined" && typeof VideoFrame !== "undefined";
}

/** Every codec the browser says it can encode at this size, best first. */
async function supportedCodecs(width: number, height: number, bitrate: number, fps: number): Promise<{ config: VideoEncoderConfig; mux: MuxCodec }[]> {
  const out: { config: VideoEncoderConfig; mux: MuxCodec }[] = [];
  for (const { codec, mux } of CODECS) {
    const config: VideoEncoderConfig = { codec, width, height, bitrate, framerate: fps };
    if (mux === "avc") config.avc = { format: "avc" };
    try {
      if ((await VideoEncoder.isConfigSupported(config)).supported) out.push({ config, mux });
    } catch {
      /* try the next one */
    }
  }
  return out;
}

type Job = {
  canvas: HTMLCanvasElement;
  frames: number;
  fps: number;
  /** Draw frame `i` onto the canvas. */
  draw: (i: number) => void;
  onProgress: (fraction: number) => void;
  cancelled: () => boolean;
};

/**
 * Encode with the best codec; if its encoder fails anyway (some hardware H.264 encoders pass the support check
 * and then error on the first frame), start over with the next one.
 */
export async function encodeMp4(job: Job): Promise<Blob> {
  const { width, height } = job.canvas;
  const bitrate = Math.round(width * height * job.fps * 0.15);
  const codecs = await supportedCodecs(width, height, bitrate, job.fps);
  let last: Error = new Error("codec");
  for (const codec of codecs) {
    try {
      return await encodeWith(job, codec.config, codec.mux);
    } catch (err) {
      if (!(err instanceof CodecError)) throw err;
      console.warn(`${codec.config.codec} failed, trying the next codec:`, err.message);
      last = err;
    }
  }
  throw last;
}

async function encodeWith(job: Job, config: VideoEncoderConfig, mux: MuxCodec): Promise<Blob> {
  const { canvas, frames, fps } = job;
  const { width, height } = canvas;
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: mux, width, height, frameRate: fps },
    fastStart: "in-memory",
    firstTimestampBehavior: "offset",
  });
  let failure: CodecError | null = null;
  const fail = (e: unknown): void => {
    failure ??= new CodecError(e instanceof Error ? e.message : String(e));
  };
  const encoder = new VideoEncoder({
    output: (chunk, meta) => {
      try {
        muxer.addVideoChunk(chunk, meta);
      } catch (e) {
        fail(e);
      }
    },
    error: fail,
  });
  const usPerFrame = 1_000_000 / fps;
  try {
    try {
      encoder.configure(config);
    } catch (e) {
      fail(e);
    }
    for (let i = 0; i < frames; i++) {
      if (job.cancelled()) throw new Error("cancelled");
      if (failure) throw failure;
      // Keep the queue short so memory stays flat on long or large clips.
      while (encoder.encodeQueueSize > 6) await new Promise((r) => setTimeout(r, 4));
      job.draw(i);
      const frame = new VideoFrame(canvas, { timestamp: Math.round(i * usPerFrame), duration: Math.round(usPerFrame) });
      try {
        encoder.encode(frame, { keyFrame: i % (fps * 2) === 0 });
      } catch (e) {
        fail(e);
      } finally {
        frame.close();
      }
      job.onProgress((i + 1) / frames);
      // Let the page paint the progress bar.
      if (i % 5 === 4) await new Promise((r) => setTimeout(r, 0));
    }
    try {
      await encoder.flush();
    } catch (e) {
      fail(e);
    }
    if (failure) throw failure;
  } finally {
    if (encoder.state !== "closed") encoder.close();
  }
  try {
    muxer.finalize();
  } catch (e) {
    throw new CodecError(e instanceof Error ? e.message : String(e));
  }
  return new Blob([muxer.target.buffer], { type: "video/mp4" });
}
