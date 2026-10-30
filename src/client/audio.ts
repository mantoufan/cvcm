/**
 * Creates the AudioContext, or resumes a suspended one. Call it from a user gesture (Start), as iOS requires.
 * Returns null where Web Audio is missing or blocked.
 */
export function armAudio(current: AudioContext | null): AudioContext | null {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return current;
    const ctx = current ?? new Ctx();
    if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
    return ctx;
  } catch {
    return current;
  }
}
