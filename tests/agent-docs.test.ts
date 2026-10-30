import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import worker from "../src/worker";
import { DATA_HANDLING_GROUPS, agentTools, buildLlmsTxt, buildPoppyJson, buildToolsJson, dataHandling } from "../src/shared/agent-docs";
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
      const blurb = tool.description.replace(/\s*Nothing is uploaded\.$/, "");
      expect(llms).toContain(`- [${tool.name}](https://cv.cm${appHref("en", tool.id)}): ${blurb} ${tool.data_handling}`);
      expect(llms).not.toContain("Nothing is uploaded. Inputs are not uploaded.");
    }
  });

  it("declares every tool in exactly one data-handling group", () => {
    const declared = Object.values(DATA_HANDLING_GROUPS).flat();
    expect([...declared].sort()).toEqual([...TOOLS].sort());
    expect(new Set(declared).size).toBe(declared.length);
    // Consistent with what the code enforces elsewhere: file and AI tools are the ones kept out of analytics.
    const fileish = [...DATA_HANDLING_GROUPS.FILES, ...DATA_HANDLING_GROUPS.AI].sort();
    expect([...UNTRACKED_TOOLS].sort()).toEqual(fileish);
    expect([...AI_TOOLS].sort()).toEqual([...DATA_HANDLING_GROUPS.AI].sort());
    expect(dataHandling("clip")).toContain("Stores the note");
    expect(dataHandling("text-to-speech")).toContain("online voices");
    for (const tool of [...DATA_HANDLING_GROUPS.FILES, ...DATA_HANDLING_GROUPS.AI, ...DATA_HANDLING_GROUPS.LOCAL]) {
      expect(dataHandling(tool)).toMatch(/not uploaded\.$/);
    }
  });

  it("backs the 'not uploaded' claims: no client code but the clipboard sends data out", () => {
    // Downloads (AI models, sample photos, page data) are fine; uploads, beacons, sockets and streams are not.
    const upload = /method:\s*["'`](post|put|patch|delete)["'`]|XMLHttpRequest|sendBeacon|new WebSocket|new EventSource/i;
    const offenders = sourceFiles(join(root, "src/client"))
      .filter((file) => !file.includes(`${join("src", "client", "clip")}/`))
      .filter((file) => upload.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
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
