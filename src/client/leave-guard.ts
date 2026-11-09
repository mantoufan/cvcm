/**
 * A page with work that only lives in the tab (an undownloaded recording) registers a guard. While it says "stay",
 * links and Back load a new document instead of swapping in-app, so the browser's beforeunload prompt can ask first.
 */
let guard: (() => boolean) | null = null;

export function setLeaveGuard(fn: (() => boolean) | null): void {
  guard = fn;
}

export function mustStay(): boolean {
  try {
    return guard?.() ?? false;
  } catch {
    return false;
  }
}
