/**
 * A page with work that only lives in the tab (an undownloaded recording) registers a guard. While it says "stay",
 * links, Back and the language picker load a new document instead of swapping in-app, and the browser's leave prompt
 * (beforeunload) is armed so it can ask first. The listener is attached only while there is something to lose:
 * a beforeunload listener keeps some browsers from putting the page in the back/forward cache.
 */
let guard: (() => boolean) | null = null;
let armed = false;

function onBeforeUnload(e: BeforeUnloadEvent): void {
  if (!mustStay()) return;
  e.preventDefault();
  e.returnValue = "";
}

export function setLeaveGuard(fn: (() => boolean) | null): void {
  guard = fn;
  syncLeaveGuard();
}

/** Call after anything that changes the guard's answer (recording started or saved, a take downloaded or deleted). */
export function syncLeaveGuard(): void {
  const want = mustStay();
  if (want && !armed) window.addEventListener("beforeunload", onBeforeUnload);
  if (!want && armed) window.removeEventListener("beforeunload", onBeforeUnload);
  armed = want;
}

export function mustStay(): boolean {
  try {
    return guard?.() ?? false;
  } catch {
    return false;
  }
}
