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
