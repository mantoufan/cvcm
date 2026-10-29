// @vitest-environment happy-dom
import { expect, it } from "vitest";
import { TOOL_LOADERS } from "../src/client/tools";
import { TOOLS, type ToolId } from "../src/shared/path";

// The build prerenders every tool in happy-dom. A select whose value differs from its `selected` option makes the
// static HTML show a different default (and different results) than browsers do, as /tdee/, /hash/ and /compound/ did.
const SKIP: ToolId[] = ["collage"]; // needs a real canvas at mount; the prerender skips it too.

it("mounts every tool with each select on its intended default", async () => {
  // Some file tools open IndexedDB at mount; a request that never settles is enough here.
  (globalThis as { indexedDB?: unknown }).indexedDB = { open: () => ({}) };
  // No real sockets: a tool that fetches at mount gets a rejected request.
  globalThis.fetch = (() => Promise.reject(new TypeError("offline in test"))) as typeof fetch;
  const wrong: string[] = [];
  for (const id of TOOLS) {
    if (SKIP.includes(id)) continue;
    const host = document.createElement("div");
    document.body.append(host);
    let alive = true;
    const loading = TOOL_LOADERS[id](host, { alive: () => alive } as never);
    const unmount = await Promise.race([loading, new Promise<undefined>((r) => setTimeout(() => r(undefined), 1500))]);
    // A loader that finishes after the timeout is unmounted as soon as it settles.
    alive = false;
    void loading.then((late) => { if (late !== unmount && typeof late === "function") late(); }, () => undefined);
    await new Promise((r) => setTimeout(r, 0));
    host.querySelectorAll("select").forEach((sel, i) => {
      const marked = Array.from(sel.options).filter((o) => o.hasAttribute("selected"));
      if (marked.length === 1 && sel.value !== marked[0].value) wrong.push(`${id} select #${i}: ${sel.value} ≠ ${marked[0].value}`);
    });
    if (typeof unmount === "function") unmount();
    host.remove();
  }
  expect(wrong).toEqual([]);
}, 120000);
