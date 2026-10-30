import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import worker from "../src/worker";
import { BLURB_PRIVACY_NOTE, DATA_HANDLING_GROUPS, agentTools, buildLlmsTxt, buildPoppyJson, buildToolsJson, dataHandling } from "../src/shared/agent-docs";
import { UNTRACKED_TOOLS } from "../src/shared/analytics";
import { AGENT_DOC_PATHS, AI_TOOLS, STATIC_FILE, TOOLS, appHref } from "../src/shared/path";

const root = resolve(__dirname, "..");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sourceFiles(path) : /\.(ts|js)$/.test(name) ? [path] : [];
  });
}

describe("agent discovery files", () => {
  it("lists every tool once, with its English page and data handling", () => {
    const tools = agentTools();
    expect(tools.map((t) => t.id).sort()).toEqual([...TOOLS].sort());
    const llms = buildLlmsTxt();
    expect(llms.startsWith("# cv.cm\n\n> ")).toBe(true);
    for (const tool of tools) {
      expect(tool.description).not.toBe("");
      const blurb = tool.description.replace(BLURB_PRIVACY_NOTE, "");
      // The blurb's own privacy sentence is dropped, so each line states data handling once.
      expect(blurb).not.toMatch(/upload|on-device|in (the|your) browser/i);
      expect(llms).toContain(`- [${tool.name}](https://cv.cm${appHref("en", tool.id)}): ${blurb} ${tool.data_handling}`);
    }
    expect(llms).toContain("Not a legal e-sign. Runs in the page.");
    expect(llms).toMatch(/model once on first use \(\d+(\.\d)? MB to \d+ MB,/);
  });

  it("declares data handling per tool", () => {
    const declared = Object.values(DATA_HANDLING_GROUPS).flat();
    expect(new Set(declared).size).toBe(declared.length);
    expect(declared.every((tool) => TOOLS.includes(tool))).toBe(true);
    // File and AI tools are the ones AGENTS.md rule 1 keeps out of analytics.
    for (const tool of [...DATA_HANDLING_GROUPS.FILES, ...DATA_HANDLING_GROUPS.AI]) expect(UNTRACKED_TOOLS.has(tool)).toBe(true);
    expect([...DATA_HANDLING_GROUPS.AI].sort()).toEqual([...AI_TOOLS].sort());
    expect(dataHandling("clip")).toContain("Stores the note");
    expect(dataHandling("text-to-speech")).toContain("online voices");
    expect(dataHandling("signature")).toBe("Runs in the page. Inputs are not uploaded.");
    expect(dataHandling("crop")).toBe("Processes files in the page. Files are not uploaded.");
    for (const tool of TOOLS.filter((t) => t !== "clip" && t !== "text-to-speech")) {
      expect(dataHandling(tool)).toMatch(/not uploaded\.$/);
    }
  });

  it("backs the 'not uploaded' claims: only reviewed client files make requests, and none sends data", () => {
    const network = /\bfetch\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource|\.submit\(|window\.open\(|new Image\(|importScripts|navigator\.share/;
    // Each file here was read by hand. Add a file only after checking that it sends none of the user's input.
    const reviewed: Record<string, string> = {
      "src/client/clip/ui.ts": "the clipboard, which stores notes by design",
      "src/client/ai/worker.ts": "downloads model files",
      "src/client/portrait-sim/assets.ts": "downloads sample photos",
      "src/client/games/ui.ts": "HEAD request for a ROM file",
      "src/client/device/ui.ts": "reads the visitor's own IP address",
      "src/client/decode.ts": "decodes a local image with new Image()",
    };
    const files = [...sourceFiles(join(root, "src/client")), ...sourceFiles(join(root, "src/shared"))]
      .map((file) => file.slice(root.length + 1).split("\\").join("/"))
      .filter((file) => network.test(readFileSync(join(root, file), "utf8")));
    expect(files.sort()).toEqual(Object.keys(reviewed).sort());
    for (const file of files.filter((f) => f !== "src/client/clip/ui.ts")) {
      const code = readFileSync(join(root, file), "utf8");
      expect(code, file).not.toMatch(/method:(?!\s*["'`](get|head)["'`])|fetch\([^)]*\$\{/i);
    }
  });

  it("publishes URL path locale codes and no live-price claim", () => {
    const json = JSON.parse(buildToolsJson());
    expect(json.locales).toContain("zh-cn");
    expect(json.locales).not.toContain("zh-CN");
    expect(buildLlmsTxt()).toContain("`zh-cn`");
    expect(buildLlmsTxt()).toContain("no live quotes");
    expect(json.tools).toHaveLength(TOOLS.length);
    expect(json.account_required).toBe(false);
    expect(json.docs).toBe("https://cv.cm/llms.txt");
  });

  it("publishes a website-only Personal Agent Protocol 0.3 document", () => {
    const poppy = JSON.parse(buildPoppyJson());
    expect(poppy.protocol_version).toBe("0.3");
    expect(poppy.organization).toEqual({ name: "cv.cm", domain: "cv.cm" });
    // The spec requires at least one of agent, apis or web.
    expect(poppy.web).toEqual({});
    expect(poppy.agent).toBeUndefined();
    expect(poppy.apis).toBeUndefined();
  });

  it("keeps the committed copies in step with the builders (run `node scripts/write-sitemap.mjs`)", () => {
    expect(readFileSync(join(root, "public/llms.txt"), "utf8")).toBe(buildLlmsTxt());
    expect(readFileSync(join(root, "public/tools.json"), "utf8")).toBe(buildToolsJson());
    expect(readFileSync(join(root, "public/.well-known/poppy.json"), "utf8")).toBe(buildPoppyJson());
  });

  it("serves the files as static files that any origin can read", async () => {
    for (const path of AGENT_DOC_PATHS) {
      expect(STATIC_FILE.test(path)).toBe(true);
      const type = path.endsWith(".txt") ? "text/plain; charset=utf-8" : "application/json";
      const response = await worker.fetch(new Request(`https://cv.cm${path}`), {
        ASSETS: { fetch: async () => new Response("x", { headers: { "Content-Type": type } }) },
      });
      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe(type);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
      expect(response.headers.get("Cross-Origin-Resource-Policy")).toBe("cross-origin");
    }
    expect(STATIC_FILE.test("/llms.txtx")).toBe(false);
    expect(STATIC_FILE.test("/.well-known/other.json")).toBe(false);
  });

  it("answers CORS preflight for the agent files only", async () => {
    const preflight = await worker.fetch(new Request("https://cv.cm/tools.json", { method: "OPTIONS" }), { ASSETS: { fetch: async () => new Response("x") } });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(preflight.headers.get("Access-Control-Allow-Methods")).toContain("GET");
    const other = await worker.fetch(new Request("https://cv.cm/robots.txt", { method: "OPTIONS" }), { ASSETS: { fetch: async () => new Response("x") } });
    expect(other.status).toBe(405);
  });

  it("keeps other static files same-origin", async () => {
    const response = await worker.fetch(new Request("https://cv.cm/robots.txt"), {
      ASSETS: { fetch: async () => new Response("x", { headers: { "Content-Type": "text/plain" } }) },
    });
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(response.headers.get("Cross-Origin-Resource-Policy")).toBe("same-origin");
  });
});
