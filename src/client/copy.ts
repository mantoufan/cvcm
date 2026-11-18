/** How long a "Copied" / "Copy failed" label stays before the control reads its own label again. */
export const COPY_FLASH_MS = 1500;

const timers = new WeakMap<HTMLElement, number>();

/** Shows "Copied" / "Copy failed" on `el` for COPY_FLASH_MS, then its own label again (shared by both copy helpers). */
function flash(el: HTMLElement | null, ok: boolean, labels: { done: string; failed: string }): void {
  if (!el) return;
  if (el.dataset.idle == null) el.dataset.idle = el.textContent ?? "";
  el.textContent = ok ? labels.done : labels.failed;
  el.classList.toggle("copy-failed", !ok);
  const prev = timers.get(el);
  if (prev !== undefined) window.clearTimeout(prev);
  timers.set(el, window.setTimeout(() => {
    el.textContent = el.dataset.idle ?? "";
    el.classList.remove("copy-failed");
    timers.delete(el);
  }, COPY_FLASH_MS));
}

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
  let ok = true;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    ok = false;
  }
  flash(el, ok, labels);
  return ok;
}

/**
 * Copies formatted text (HTML, so a word processor keeps italics) with a plain-text twin, falling back to plain text
 * where ClipboardItem is missing. Flashes the button like copyWithFlash.
 */
export async function copyRich(
  el: HTMLElement | null,
  htmlText: string,
  plain: string,
  labels: { done: string; failed: string },
): Promise<boolean> {
  if (!plain) return false;
  if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) return copyWithFlash(el, plain, labels);
  try {
    await navigator.clipboard.write([new ClipboardItem({
      "text/html": new Blob([htmlText], { type: "text/html" }),
      "text/plain": new Blob([plain], { type: "text/plain" }),
    })]);
  } catch {
    return copyWithFlash(el, plain, labels);
  }
  flash(el, true, labels);
  return true;
}
