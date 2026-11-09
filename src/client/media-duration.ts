/**
 * Chrome's MediaRecorder WebM files carry no duration, so a player shows ∞ and cannot seek until it has looked at the
 * end once. Seek far past the end on load, then back to the start when the real duration arrives.
 */
export function fixInfiniteDuration(el: HTMLMediaElement): void {
  el.addEventListener("loadedmetadata", () => {
    if (el.duration !== Infinity) return;
    const back = () => {
      el.removeEventListener("durationchange", back);
      el.currentTime = 0;
    };
    el.addEventListener("durationchange", back);
    el.currentTime = 1e7;
  }, { once: true });
}
