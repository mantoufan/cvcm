/**
 * One MediaRecorder take, shared by the voice and screen recorders: it collects the chunks, keeps the recorded time
 * (pauses excluded), stops at the length limit and hands over the finished Blob once. Getting the stream and showing
 * the result stay with each tool.
 */
import { elapsedMs } from "../shared/recorder";

export type TakeResult = {
  /** null when the recorder produced no data. */
  blob: Blob | null;
  ms: number;
  /** Stopped by the length limit rather than by the user. */
  limited: boolean;
};

export type TakeOptions = {
  maxMinutes: number;
  /** MIME type for the Blob when neither the recorder nor the chunks name one. */
  fallbackType: string;
  /** Called every 250 ms while recording, and after every pause or resume. */
  onTick: (ms: number) => void;
  /** The limit was reached; the tool stops the take the same way its Stop button does. */
  onLimit: () => void;
  /** Called once, after MediaRecorder hands over the last chunk. Never called after cancel(). */
  onEnd: (result: TakeResult) => void;
};

export class RecordingTake {
  private chunks: Blob[] = [];
  private banked = 0;
  private startedAt: number | null = null;
  private timer = 0;
  private limited = false;
  private ended = false;

  constructor(private readonly rec: MediaRecorder, private readonly opts: TakeOptions) {}

  get state(): RecordingState {
    return this.rec.state;
  }

  get canPause(): boolean {
    return typeof this.rec.pause === "function";
  }

  /** Starts recording in one-second slices (so a long take is not one buffer). False if the recorder refused. */
  start(): boolean {
    this.chunks = [];
    this.rec.ondataavailable = (e) => {
      if (e.data.size) this.chunks.push(e.data);
    };
    this.rec.onstop = () => this.end();
    try {
      this.rec.start(1000);
    } catch {
      this.rec.ondataavailable = this.rec.onstop = null;
      return false;
    }
    this.banked = 0;
    this.startedAt = performance.now();
    window.clearInterval(this.timer);
    this.timer = window.setInterval(() => this.tick(), 250);
    this.tick();
    return true;
  }

  elapsed(): number {
    return elapsedMs(this.banked, this.startedAt, performance.now());
  }

  /** Pauses or resumes; returns the new state, or null if neither applied. MediaRecorder errors are thrown. */
  togglePause(): "paused" | "recording" | null {
    try {
      if (this.rec.state === "recording") {
        this.rec.pause();
        this.bank();
        return "paused";
      }
      if (this.rec.state === "paused") {
        this.rec.resume();
        this.startedAt = performance.now();
        return "recording";
      }
      return null;
    } finally {
      this.tick();
    }
  }

  /** Stops; onEnd follows once the last chunk arrives. A second call (already "inactive") waits for the same onstop. */
  stop(): void {
    this.bank();
    window.clearInterval(this.timer);
    if (this.rec.state !== "inactive") this.rec.stop();
  }

  /** Stops without delivering the take (the page is closing). */
  cancel(): void {
    this.ended = true;
    window.clearInterval(this.timer);
    this.rec.ondataavailable = this.rec.onstop = null;
    if (this.rec.state !== "inactive") this.rec.stop();
    this.chunks = [];
  }

  private bank(): void {
    this.banked = this.elapsed();
    this.startedAt = null;
  }

  private tick(): void {
    const ms = this.elapsed();
    this.opts.onTick(ms);
    if (!this.ended && !this.limited && ms >= this.opts.maxMinutes * 60_000) {
      this.limited = true;
      this.opts.onLimit();
    }
  }

  private end(): void {
    if (this.ended) return;
    this.ended = true;
    window.clearInterval(this.timer);
    // stop() banks the time; a recorder that stopped by itself (an error, a lost track) has not, so add it here.
    this.bank();
    const chunks = this.chunks;
    this.chunks = [];
    const blob = chunks.length ? new Blob(chunks, { type: this.rec.mimeType || chunks[0].type || this.opts.fallbackType }) : null;
    this.opts.onEnd({ blob, ms: this.banked, limited: this.limited });
  }
}

/** The DOMException name of a getUserMedia / getDisplayMedia failure ("NotAllowedError", …), or "". */
export function errorName(err: unknown): string {
  return (err as { name?: string } | null)?.name ?? "";
}
