/** How long a "Copied" / "Copy failed" label stays before the control reads its own label again. */
export const COPY_FLASH_MS = 1500;

const timers = new WeakMap<HTMLElement, number>();

/**
 * Copies text and briefly swaps `el`'s label for the done or failed text. The idle label is the text `el` had
 * the first time it was used, so a second click during the flash does not make "Copied" stick.
 * Returns whether the copy worked.
 */
export async function copyWithFlash(
  el: HTMLElement | null,
  text: string,
  labels: { done: string; failed: string },
): Promise<boolean> {
  if (!text) return false;
  if (el && el.dataset.idle == null) el.dataset.idle = el.textContent ?? "";
  let ok = true;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    ok = false;
  }
  if (!el) return ok;
  el.textContent = ok ? labels.done : labels.failed;
  el.classList.toggle("copy-failed", !ok);
  const prev = timers.get(el);
  if (prev !== undefined) window.clearTimeout(prev);
  timers.set(el, window.setTimeout(() => {
    el.textContent = el.dataset.idle ?? "";
    el.classList.remove("copy-failed");
    timers.delete(el);
  }, COPY_FLASH_MS));
  return ok;
}
