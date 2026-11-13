/**
 * Talks UCI to Stockfish.js 19 lite, single-threaded (https://github.com/nmrugg/stockfish.js, GPL-3.0; based on
 * Stockfish, https://github.com/official-stockfish/Stockfish). The engine runs unmodified in its own Web Worker from
 * /assets/engines/ (same origin; it finds its .wasm next to the .js). It is created on the computer's first move,
 * never at mount, so the page loads nothing extra until someone plays.
 */

export const ENGINE_URL = "/assets/engines/stockfish-19-lite-single.js";

/** Strength per level: Stockfish's Skill Level (0–20) plus a think-time cap and, for the easy levels, a depth cap. */
export const LEVELS = [
  { skill: 0, movetime: 250, depth: 1 },
  { skill: 4, movetime: 400, depth: 4 },
  { skill: 9, movetime: 700, depth: 8 },
  { skill: 14, movetime: 1000, depth: 12 },
  { skill: 20, movetime: 1500, depth: 0 },
] as const;
export type LevelIndex = 0 | 1 | 2 | 3 | 4;

export function goCommand(level: LevelIndex): string {
  const l = LEVELS[level];
  return l.depth ? `go depth ${l.depth} movetime ${l.movetime}` : `go movetime ${l.movetime}`;
}

/** "bestmove e7e8q ponder …" → "e7e8q"; "(none)" or anything else → null. */
export function parseBestMove(line: string): string | null {
  const m = /^bestmove ([a-h][1-8][a-h][1-8][qrbn]?)/.exec(line);
  return m ? m[1]! : null;
}

export class Engine {
  private worker: Worker | null = null;
  private ready: Promise<void> | null = null;
  private waiting: ((move: string | null) => void) | null = null;
  private level: LevelIndex | null = null;
  /**
   * After cancel(): "stop" then "isready"; every bestmove before the matching readyok belongs to the stopped search
   * (or to one that had already finished), so it is dropped. Counting stops instead goes wrong when a search had
   * already answered before the stop arrived.
   */
  private drain: Promise<void> | null = null;
  private drained: (() => void) | null = null;
  failed = false;

  private start(): Promise<void> {
    if (this.ready) return this.ready;
    this.ready = new Promise<void>((resolve, reject) => {
      let worker: Worker;
      try {
        worker = new Worker(ENGINE_URL);
      } catch (err) {
        reject(err);
        return;
      }
      this.worker = worker;
      worker.onmessage = (e: MessageEvent) => {
        const line = typeof e.data === "string" ? e.data : "";
        if (line === "readyok") {
          if (this.drained) {
            const done = this.drained;
            this.drained = null;
            this.drain = null;
            done();
          } else resolve();
        }
        if (line.startsWith("bestmove")) {
          if (this.drain) return;
          const done = this.waiting;
          this.waiting = null;
          done?.(parseBestMove(line));
        }
      };
      worker.onerror = () => {
        this.failed = true;
        reject(new Error("engine failed"));
        const done = this.waiting;
        this.waiting = null;
        done?.(null);
      };
      worker.postMessage("uci");
      worker.postMessage("isready");
    });
    return this.ready;
  }

  /** Best move in UCI form for a FEN, or null (no move, the engine failed, or the search was cancelled). */
  async bestMove(fen: string, level: LevelIndex): Promise<string | null> {
    try {
      await this.start();
    } catch {
      this.failed = true;
      return null;
    }
    const w = this.worker!;
    this.cancel();
    while (this.drain) await this.drain;
    if (!this.worker) return null;
    if (this.level !== level) {
      w.postMessage(`setoption name Skill Level value ${LEVELS[level].skill}`);
      this.level = level;
    }
    w.postMessage("ucinewgame");
    w.postMessage(`position fen ${fen}`);
    return new Promise((resolve) => {
      this.waiting = resolve;
      w.postMessage(goCommand(level));
    });
  }

  /** Stops a search; its answer is dropped. */
  cancel(): void {
    if (!this.waiting) return;
    const done = this.waiting;
    this.waiting = null;
    if (this.worker) {
      const w = this.worker;
      if (!this.drain) this.drain = new Promise<void>((r) => { this.drained = r; });
      w.postMessage("stop");
      w.postMessage("isready");
    }
    done(null);
  }

  dispose(): void {
    this.cancel();
    this.worker?.terminate();
    this.worker = null;
    this.ready = null;
    this.level = null;
    this.drained?.();
    this.drained = null;
    this.drain = null;
  }
}
