import { describe, expect, it } from "vitest";
import worker from "../src/worker";
import { AGENT_DOC_PATHS, agentTools, buildLlmsTxt, buildPoppyJson, buildToolsJson } from "../src/shared/agent-docs";
import { STATIC_FILE, TOOLS, appHref } from "../src/shared/path";

describe("agent discovery files", () => {
  it("lists every tool once, with its English page", () => {
    const tools = agentTools();
    expect(tools.map((t) => t.id).sort()).toEqual([...TOOLS].sort());
    const llms = buildLlmsTxt();
    expect(llms.startsWith("# cv.cm\n\n> ")).toBe(true);
    for (const tool of tools) {
      expect(tool.description).not.toBe("");
      expect(llms).toContain(`(https://cv.cm${appHref("en", tool.id)}): `);
    }
  });

  it("keeps tools.json in step with the registry", () => {
    const json = JSON.parse(buildToolsJson());
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
  });

  it("keeps other static files same-origin", async () => {
    const response = await worker.fetch(new Request("https://cv.cm/robots.txt"), {
      ASSETS: { fetch: async () => new Response("x", { headers: { "Content-Type": "text/plain" } }) },
    });
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(response.headers.get("Cross-Origin-Resource-Policy")).toBe("same-origin");
  });
});
