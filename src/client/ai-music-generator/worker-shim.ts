/**
 * Magenta's core/compat/global.js reads window.fetch / window.performance / window.navigator when it loads. A
 * worker has all of those on self, and no window: point window at self. Imported first by model-worker.ts.
 */
const scope = globalThis as unknown as { window?: unknown };
scope.window ??= globalThis;
