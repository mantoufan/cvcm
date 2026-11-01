type FsElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };
type FsDocument = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> | void };

/** The element in full screen, standard or WebKit-prefixed. */
export function fullscreenElement(): Element | null {
  const d = document as FsDocument;
  return d.fullscreenElement ?? d.webkitFullscreenElement ?? null;
}

export function canFullscreen(el: HTMLElement): boolean {
  const e = el as FsElement;
  return typeof e.requestFullscreen === "function" || typeof e.webkitRequestFullscreen === "function";
}

/**
 * Puts `el` in full screen; true when it got there. The prefixed WebKit call returns nothing and fails silently,
 * so success is read from the document (after fullscreenchange, or a short wait) rather than from the call.
 */
export async function enterFullscreen(el: HTMLElement): Promise<boolean> {
  const e = el as FsElement;
  const request = e.requestFullscreen ?? e.webkitRequestFullscreen;
  if (!request) return false;
  try {
    await request.call(e);
  } catch {
    return false;
  }
  if (fullscreenElement() === el) return true;
  await new Promise<void>((resolve) => {
    const done = () => {
      document.removeEventListener("fullscreenchange", done);
      document.removeEventListener("webkitfullscreenchange", done);
      window.clearTimeout(timer);
      resolve();
    };
    const timer = window.setTimeout(done, 500);
    document.addEventListener("fullscreenchange", done);
    document.addEventListener("webkitfullscreenchange", done);
  });
  return fullscreenElement() === el;
}

export function exitFullscreen(): void {
  const d = document as FsDocument;
  const exit = d.exitFullscreen ?? d.webkitExitFullscreen;
  if (fullscreenElement()) void Promise.resolve(exit?.call(d)).catch(() => undefined);
}
