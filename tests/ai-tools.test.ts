import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "../src/worker";
import { AI_MODELS, formatMb, mirrorFiles, modelFileUrl, type AiModelId } from "../src/shared/ai-models";
import { AI_TOOLS, appHref, isAiToolPath, parseAppPath } from "../src/shared/path";
import { cleanSegments, shortClock, toSrt, toText, toVtt } from "../src/shared/subtitles";
import { isTrackedPath } from "../src/shared/analytics";

const html = {
  fetch: async () => new Response("<!doctype html><title>cv.cm</title>", { headers: { "Content-Type": "text/html; charset=utf-8" } }),
};

describe("AI tool routes", () => {
  it("serves each AI tool at /{locale}/{tool}/", () => {
    for (const tool of AI_TOOLS) {
      expect(parseAppPath(`/en/${tool}/`)).toEqual({ kind: "app", locale: "en", tool });
      expect(appHref("zh-CN", tool)).toBe(`/zh-cn/${tool}/`);
      expect(isAiToolPath(`/ja/${tool}/`)).toBe(true);
    }
    expect([...AI_TOOLS]).toEqual(["remove-background", "image-upscaler", "speech-to-text", "depth-map"]);
    expect(isAiToolPath("/en/json/")).toBe(false);
    expect(isAiToolPath("/en/")).toBe(false);
  });

  it("treats /ai/ files as static and keeps AI pages out of analytics", () => {
    expect(parseAppPath("/ai/models/x/y/config.json")).toEqual({ kind: "static" });
    for (const tool of AI_TOOLS) expect(isTrackedPath(`/en/${tool}/`)).toBe(false);
  });
});

describe("model catalog", () => {
  it("pins every model and mirrors every file a variant loads", () => {
    for (const id of Object.keys(AI_MODELS) as AiModelId[]) {
      const model = AI_MODELS[id];
      expect(model.revision).toMatch(/^([0-9a-f]{40}|v[\d.]+)$/);
      const files = mirrorFiles(id);
      for (const variant of Object.values(model.variants)) {
        expect(variant.bytes).toBeGreaterThan(1_000_000);
        for (const file of variant.files) expect(files).toContain(file);
      }
      for (const config of model.configs) expect(files).toContain(config);
    }
  });

  it("builds mirror and Hugging Face URLs", () => {
    expect(modelFileUrl("depth", "onnx/model_fp16.onnx", "/ai/models/", "https://cv.cm"))
      .toBe("https://cv.cm/ai/models/onnx-community/depth-anything-v2-small/4472b7362082ad9968fee890ca0f1e5aca36b93d/onnx/model_fp16.onnx");
    expect(modelFileUrl("depth", "config.json", undefined, "https://cv.cm"))
      .toBe("https://huggingface.co/onnx-community/depth-anything-v2-small/resolve/4472b7362082ad9968fee890ca0f1e5aca36b93d/config.json");
  });

  it("formats download sizes", () => {
    expect(formatMb(101_615_014)).toBe("102 MB");
    expect(formatMb(49_642_442)).toBe("50 MB");
    expect(formatMb(2_445_084)).toBe("2.4 MB");
  });
});

describe("subtitles", () => {
  const segs = [
    { start: 0, end: 2.5, text: " Hello there. " },
    { start: 2.5, end: 2.5, text: "" },
    { start: 2.4, end: 3661.25, text: "Long  one" },
  ];

  it("cleans empty, overlapping and zero-length cues", () => {
    expect(cleanSegments(segs)).toEqual([
      { start: 0, end: 2.5, text: "Hello there." },
      { start: 2.5, end: 3661.25, text: "Long one" },
    ]);
  });

  it("writes SRT, VTT and text", () => {
    expect(toSrt(segs)).toBe("1\n00:00:00,000 --> 00:00:02,500\nHello there.\n\n2\n00:00:02,500 --> 01:01:01,250\nLong one\n");
    expect(toVtt(segs)).toBe("WEBVTT\n\n00:00:00.000 --> 00:00:02.500\nHello there.\n\n00:00:02.500 --> 01:01:01.250\nLong one\n");
    expect(toText(segs)).toBe("Hello there.\nLong one");
    expect(shortClock(65)).toBe("1:05");
    expect(shortClock(3723)).toBe("1:02:03");
  });
});

describe("AI page headers", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("isolates AI pages and lets their workers compile WebAssembly", async () => {
    const page = await worker.fetch(new Request("https://cv.cm/en/remove-background/"), { ASSETS: html });
    expect(page.headers.get("Cross-Origin-Embedder-Policy")).toBe("credentialless");
    expect(page.headers.get("Cross-Origin-Opener-Policy")).toBe("same-origin");
    expect(page.headers.get("Content-Security-Policy")).toContain("'wasm-unsafe-eval'");
    expect(page.headers.get("Permissions-Policy")).toContain("microphone=()");

    const script = await worker.fetch(new Request("https://cv.cm/assets/worker-abc.js"), {
      ASSETS: { fetch: async () => new Response("x", { headers: { "Content-Type": "text/javascript" } }) },
    });
    expect(script.headers.get("Cross-Origin-Embedder-Policy")).toBe("credentialless");
    expect(script.headers.get("Content-Security-Policy")).toContain("script-src 'self' 'wasm-unsafe-eval' blob:");
  });

  it("allows the microphone on speech to text only", async () => {
    const stt = await worker.fetch(new Request("https://cv.cm/ko/speech-to-text/"), { ASSETS: html });
    expect(stt.headers.get("Permissions-Policy")).toContain("microphone=(self)");
    const other = await worker.fetch(new Request("https://cv.cm/en/json/"), { ASSETS: html });
    expect(other.headers.get("Permissions-Policy")).toContain("microphone=()");
    expect(other.headers.get("Cross-Origin-Embedder-Policy")).toBeNull();
    expect(other.headers.get("Content-Security-Policy")).not.toContain("wasm-unsafe-eval");
  });

  it("proxies model files from s3.cv.cm with long caching and real 404s", async () => {
    const seen: string[] = [];
    vi.stubGlobal("fetch", async (input: string) => {
      seen.push(input);
      return input.endsWith("missing.json")
        ? new Response("nope", { status: 404 })
        : new Response("onnx", { headers: { "Content-Type": "application/octet-stream", "Content-Length": "4", "Set-Cookie": "x=1" } });
    });
    const ok = await worker.fetch(new Request("https://cv.cm/ai/models/cvcm/birefnet-lite-1024/abc/onnx/model_fp16.onnx"), { ASSETS: html });
    expect(ok.status).toBe(200);
    expect(await ok.text()).toBe("onnx");
    expect(ok.headers.get("Cache-Control")).toBe("public, max-age=31536000, immutable");
    expect(ok.headers.get("Set-Cookie")).toBeNull();
    expect(seen[0]).toBe("https://s3.cv.cm/files/ai/models/cvcm/birefnet-lite-1024/abc/onnx/model_fp16.onnx");

    const missing = await worker.fetch(new Request("https://cv.cm/ai/models/x/y/missing.json"), { ASSETS: html });
    expect(missing.status).toBe(404);
    expect(missing.headers.get("Cache-Control")).toBe("no-store");

    const bad = await worker.fetch(new Request("https://cv.cm/ai/models/a//b.onnx"), { ASSETS: html });
    expect(bad.status).toBe(400);
    expect(seen).toHaveLength(2);
  });
});
