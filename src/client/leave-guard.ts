/**
 * A page with work that only lives in the tab (an undownloaded recording) registers a guard. While it says "stay",
 * the browser's leave prompt is armed (beforeunload), and links, Back and the language picker load a new document
 * instead of swapping in-app, so that prompt can ask first.
 */
let guard: (() => boolean) | null = null;

function onBeforeUnload(e: BeforeUnloadEvent): void {
  if (!mustStay()) return;
  e.preventDefault();
  e.returnValue = "";
}

export function setLeaveGuard(fn: (() => boolean) | null): void {
  if (fn && !guard) window.addEventListener("beforeunload", onBeforeUnload);
  if (!fn && guard) window.removeEventListener("beforeunload", onBeforeUnload);
  guard = fn;
}

export function mustStay(): boolean {
  try {
    return guard?.() ?? false;
  } catch {
    return false;
  }
}
