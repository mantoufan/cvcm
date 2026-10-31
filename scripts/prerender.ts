// Renders every sitemap page with the real client in happy-dom and writes the #app markup to
// dist/_ssr/<path>/index.html. The Worker serves it inside the page HTML, so the first paint needs
// no JavaScript and crawlers see what visitors see. The client then mounts the same page and swaps it in.
// Run after `vite build` through `node scripts/prerender.mjs`, which bundles this file first.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { Window } from "happy-dom";
import { populateGlobal } from "vitest/environments";

declare const __PRERENDER_ROOT__: string;
const root = __PRERENDER_ROOT__;
const outDir = resolve(root, "dist/_ssr");

const win = new Window({
  url: "https://cv.cm/en/",
  width: 1280,
  height: 900,
  settings: {
    disableJavaScriptFileLoading: true,
    disableJavaScriptEvaluation: true,
    disableCSSFileLoading: true,
    disableIframePageLoading: true,
    navigator: { userAgent: "cv.cm prerender" },
  },
});
populateGlobal(globalThis, win as unknown as Window & typeof globalThis, { bindFunctions: true });
// Nothing may leave the build machine: no clip, IP, ROM or quote lookups. A request never settles, so a tool stays
// in its loading state instead of baking an error message ("No ROM", "Retry") into the page.
const offline = (): Promise<Response> => new Promise<Response>(() => {});
(globalThis as { fetch: unknown }).fetch = offline;
(win as unknown as { fetch: unknown }).fetch = offline;
// No IndexedDB here: draft saves and restores fail the way they do in a private window.
(globalThis as { indexedDB: unknown }).indexedDB = {
  open() {
    const req: { error: Error; onerror?: () => void } = { error: new Error("no IndexedDB in prerender") };
    setTimeout(() => req.onerror?.(), 0);
    return req;
  },
};
// A tool's background draft save can reject after its page is done; that is not a render failure.
process.on("unhandledRejection", () => {});
document.write('<!doctype html><html><head></head><body><div id="app"></div></body></html>');

await import("../src/shared/messages-all");
const { sitemapPages, pageUrl } = await import("../src/shared/sitemap");
const { render, whenRendered } = await import("../src/client/main");

const MARKER = "<!--ssr-->";
const errors: string[] = [];
let pageErrors = 0;
const consoleError = console.error;
console.error = (...args: unknown[]) => {
  pageErrors += 1;
  errors.push(args.map(String).join(" ").slice(0, 300));
};

const app = document.getElementById("app")!;
let written = 0;
const failed: string[] = [];
const started = Date.now();
await whenRendered();
for (const page of sitemapPages()) {
  const path = new URL(pageUrl(page)).pathname;
  pageErrors = 0;
  history.replaceState(null, "", path);
  app.replaceChildren();
  render();
  // A mount that waits on the network never finishes here: skip that page.
  const done = await Promise.race([whenRendered().then(() => true), new Promise<boolean>((r) => setTimeout(() => r(false), 3000))]);
  if (!done) {
    failed.push(path);
    errors.push(`${path}: mount did not finish`);
    continue;
  }
  // Let microtask-driven mounts settle (a tool that awaits a resolved promise before painting).
  await new Promise((r) => setTimeout(r, 0));
  if (pageErrors > 0 || !app.querySelector("main#main")?.childElementCount) {
    failed.push(path);
    continue;
  }
  // Per-visitor output (passwords, UUIDs, the clock, this browser's details) must not be baked into public HTML.
  // Text keeps a placeholder so the line keeps its height until the app fills it in.
  app.querySelectorAll<HTMLElement>("[data-volatile]").forEach((el) => {
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) el.value = "";
    else if (el instanceof HTMLOListElement || el instanceof HTMLUListElement || el instanceof HTMLSelectElement) el.replaceChildren();
    else el.textContent = "…";
  });
  // Frames (the game player) start loading from the server HTML; leave them empty so only the mounted page loads one.
  app.querySelectorAll("iframe").forEach((el) => el.removeAttribute("src"));
  // Date and time fields default to "now": leave them empty rather than showing the build date.
  // A field with a fixed sample date (data-fixed-date) keeps it, so it matches the results shown under it.
  app.querySelectorAll<HTMLInputElement>('input[type="date"], input[type="datetime-local"], input[type="time"]').forEach((el) => {
    if (!el.hasAttribute("data-fixed-date")) el.value = "";
  });
  // Form state lives in DOM properties; copy it to attributes so the markup shows what the tool shows.
  app.querySelectorAll("textarea").forEach((el) => { el.textContent = el.value; });
  app.querySelectorAll("input").forEach((el) => {
    if (el.type === "checkbox" || el.type === "radio") el.toggleAttribute("checked", el.checked);
    else if (el.type !== "file" && el.type !== "password") el.setAttribute("value", el.value);
  });
  app.querySelectorAll("select").forEach((sel) => {
    for (const opt of Array.from(sel.options)) opt.toggleAttribute("selected", opt.selected);
  });
  // Controls without a handler yet: CSS keeps buttons and file pickers from taking clicks until the app swaps in.
  app.querySelector(".page")?.classList.add("ssr");
  const html = MARKER + app.innerHTML;
  const file = resolve(outDir, `.${path}`, "index.html");
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html);
  written += 1;
}
app.replaceChildren();
render();
console.error = consoleError;
console.log(`prerender: ${written} pages in ${((Date.now() - started) / 1000).toFixed(1)}s, ${failed.length} skipped`);
if (failed.length) {
  console.log(`prerender: skipped (the Worker serves its text copy): ${failed.slice(0, 20).join(" ")}${failed.length > 20 ? " …" : ""}`);
  console.log(`prerender: first errors:\n  ${[...new Set(errors)].slice(0, 8).join("\n  ")}`);
}
await win.happyDOM.abort();
process.exit(0);
