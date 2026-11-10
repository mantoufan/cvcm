/**
 * Chrome's MediaRecorder WebM files carry no duration, so a player shows ∞ and cannot seek until it has looked at the
 * end once. Seek far past the end on load, then back to the start once the seek lands (whether or not a real duration
 * arrived), so playback never starts from the end.
 */
export function fixInfiniteDuration(el: HTMLMediaElement): void {
  el.addEventListener("loadedmetadata", () => {
    if (el.duration !== Infinity) return;
    const back = () => {
      el.removeEventListener("durationchange", back);
      el.removeEventListener("seeked", back);
      if (el.currentTime !== 0) el.currentTime = 0;
    };
    el.addEventListener("durationchange", back);
    el.addEventListener("seeked", back);
    el.currentTime = 1e7;
  }, { once: true });
}

/**
 * The real length of a loaded media element, in seconds: for a WebM without a duration, seeks far past the end so the
 * browser works it out, then back to the start. 0 when it still is not known after `timeoutMs`.
 */
export async function finiteDuration(el: HTMLMediaElement, timeoutMs = 10000): Promise<number> {
  if (Number.isFinite(el.duration)) return el.duration;
  const waitFor = (events: string[]) => new Promise<void>((resolve) => {
    const done = () => {
      window.clearTimeout(timer);
      for (const e of events) el.removeEventListener(e, done);
      resolve();
    };
    const timer = window.setTimeout(done, timeoutMs);
    for (const e of events) el.addEventListener(e, done);
  });
  const found = waitFor(["durationchange", "seeked"]);
  el.currentTime = 1e7;
  await found;
  const length = Number.isFinite(el.duration) ? el.duration : 0;
  const back = waitFor(["seeked"]);
  el.currentTime = 0;
  await back;
  return length;
}
