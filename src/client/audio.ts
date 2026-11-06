/**
 * Creates the AudioContext, or resumes a suspended one. Call it from a user gesture (Start), as iOS requires.
 * Returns null where Web Audio is missing or blocked.
 */
export function armAudio(current: AudioContext | null): AudioContext | null {
  if (!current) return newAudioContext() ?? current;
  resumeIfPaused(current);
  return current;
}

/** A new AudioContext with options (such as the microphone's sample rate), with the webkit fallback; null when missing. */
export function newAudioContext(options?: AudioContextOptions): AudioContext | null {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    const ctx = new Ctx(options);
    resumeIfPaused(ctx);
    return ctx;
  } catch {
    return null;
  }
}

/** Resumes a context that is not running: suspended, or "interrupted", where iOS leaves it after a call or app switch. */
export function resumeIfPaused(ctx: AudioContext): void {
  if (ctx.state === "suspended" || ctx.state === "interrupted") void ctx.resume().catch(() => undefined);
}
