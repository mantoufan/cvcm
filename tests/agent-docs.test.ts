import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import worker from "../src/worker";
import { agentTools, buildLlmsTxt, buildPoppyJson, buildToolsJson, dataHandling } from "../src/shared/agent-docs";
import { AGENT_DOC_PATHS, AI_TOOLS, CATEGORIES, STATIC_FILE, TOOLS, appHref } from "../src/shared/path";

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
      const line = llms.split("\n").find((l) => l.startsWith(`- [${tool.name}](https://cv.cm${appHref("en", tool.id)}): ${tool.description}`));
      expect(line, tool.id).toBeDefined();
      // Every line tells the reader what happens to the input: in the blurb, or in the added data-handling sentence.
      if (!/upload/i.test(tool.description)) expect(line).toContain(tool.data_handling);
    }
  });

  it("only the clipboard claims to store input", () => {
    for (const tool of TOOLS) {
      if (tool === "clip") expect(dataHandling(tool)).toContain("Stores the note");
      else expect(dataHandling(tool)).toMatch(/not uploaded\.$/);
    }
    for (const tool of AI_TOOLS) expect(dataHandling(tool)).toContain("AI model");
  });

  it("backs the 'not uploaded' claims: no tool but the clipboard sends data out", () => {
    // Downloads (models, sample photos) are fine; uploads, beacons and sockets are not.
    const upload = /method:\s*["'](POST|PUT|PATCH)["']|XMLHttpRequest|sendBeacon|new WebSocket/;
    const folders = CATEGORIES.flatMap((c) => [...c.tools, c.id]).filter((name) => name !== "clip");
    for (const name of new Set(folders)) {
      const dir = join(root, "src/client", name);
      if (!existsSync(dir)) continue;
      for (const file of sourceFiles(dir)) expect(readFileSync(file, "utf8"), file).not.toMatch(upload);
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

  it("keeps other static files same-origin", async () => {
    const response = await worker.fetch(new Request("https://cv.cm/robots.txt"), {
      ASSETS: { fetch: async () => new Response("x", { headers: { "Content-Type": "text/plain" } }) },
    });
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(response.headers.get("Cross-Origin-Resource-Policy")).toBe("same-origin");
  });
});
