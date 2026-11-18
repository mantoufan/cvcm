/// <reference lib="webworker" />
/**
 * Solves a checked 3×3 facelet string with cubejs (MIT, https://github.com/ldez/cubejs), an implementation of
 * Herbert Kociemba's two-phase algorithm, off the page's thread. The move tables are built once, on the first
 * request (a few seconds). In: { id, facelets }. Out: { id, solution } or { id, error }; { ready: true } once the
 * tables exist.
 */
import Cube from "cubejs";

let ready = false;

self.onmessage = (e: MessageEvent<{ id: number; facelets: string }>) => {
  const { id, facelets } = e.data;
  const post = (msg: unknown) => (self as unknown as Worker).postMessage(msg);
  try {
    if (!ready) {
      Cube.initSolver();
      ready = true;
      post({ ready: true });
    }
    post({ id, solution: Cube.fromString(facelets).solve() });
  } catch (err) {
    post({ id, error: String(err) });
  }
};
