import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "../src/worker";
import { AI_MODELS, formatMb, mirrorFiles, modelFileUrl, type AiModelId } from "../src/shared/ai-models";
import { AI_TOOLS, appHref, isAiToolPath, parseAppPath } from "../src/shared/path";
import { cleanSegments, shortClock, toSrt, toText, toVtt } from "../src/shared/subtitles";
import { isTrackedPath } from "../src/shared/analytics";
import { prepareDepth } from "../src/client/v/render";
import { promptLanguage } from "../src/shared/image-gen";
import { MUSIC_BARS, MUSIC_STYLES, STYLE_PRESETS, drumKind, pieceSeconds, samplesFor, stepSeconds, stepTime, toMidi, toNotes } from "../src/shared/music-gen";
import { MOTIONS, STRENGTHS, cameraAt, cropRect, frameCount, outputSize } from "../src/shared/parallax";

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
    expect([...AI_TOOLS]).toEqual(["v", "ai-image-generator", "ai-music-generator", "remove-background", "image-upscaler", "speech-to-text", "depth-map"]);
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

  it("allows the microphone on speech to text and the mic test only", async () => {
    const stt = await worker.fetch(new Request("https://cv.cm/ko/speech-to-text/"), { ASSETS: html });
    expect(stt.headers.get("Permissions-Policy")).toContain("microphone=(self)");
    const mic = await worker.fetch(new Request("https://cv.cm/zh-cn/mic-test/"), { ASSETS: html });
    expect(mic.headers.get("Permissions-Policy")).toContain("microphone=(self)");
    expect(mic.headers.get("Cross-Origin-Embedder-Policy")).toBeNull();
    const lesson = await worker.fetch(new Request("https://cv.cm/en/learn/test-microphone/"), { ASSETS: html });
    expect(lesson.headers.get("Permissions-Policy")).toContain("microphone=()");
    expect(mic.headers.get("Permissions-Policy")).toContain("camera=()");
    const cam = await worker.fetch(new Request("https://cv.cm/en/webcam-test/"), { ASSETS: html });
    expect(cam.headers.get("Permissions-Policy")).toContain("camera=(self)");
    expect(cam.headers.get("Permissions-Policy")).toContain("microphone=()");
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

describe("photo to video (/v/)", () => {
  it("keeps the old AI studio URLs: /v and its pages open the tool", async () => {
    expect(parseAppPath("/v")).toEqual({ kind: "bare", tool: "v" });
    expect(parseAppPath("/v/agent")).toEqual({ kind: "bare", tool: "v" });
    expect(parseAppPath("/en/v/canvas/")).toEqual({ kind: "app", locale: "en", tool: "v" });
    expect(parseAppPath("/zh-cn/v/director/xyz")).toEqual({ kind: "app", locale: "zh-CN", tool: "v" });
    expect(parseAppPath("/v/canvas/abc123")).toEqual({ kind: "bare", tool: "v" });
    expect(parseAppPath("/v/wp-login.php")).toEqual({ kind: "unknown" });
    expect(parseAppPath("/en/v/xyz")).toEqual({ kind: "unknown" });
    expect(parseAppPath("/en/v/canvas/a/b")).toEqual({ kind: "unknown" });
    const bare = await worker.fetch(new Request("https://cv.cm/v/director", { headers: { "Accept-Language": "ja" } }), { ASSETS: html });
    expect(bare.status).toBe(302);
    expect(new URL(bare.headers.get("Location")!).pathname).toBe("/ja/v/");
    const old = await worker.fetch(new Request("https://cv.cm/zh-cn/v/agent"), { ASSETS: html });
    expect(old.status).toBe(301);
    expect(new URL(old.headers.get("Location")!).pathname).toBe("/zh-cn/v/");
    const page = await worker.fetch(new Request("https://cv.cm/en/v/"), { ASSETS: html });
    expect(page.status).toBe(200);
    expect(page.headers.get("Cross-Origin-Embedder-Policy")).toBe("credentialless");
  });

  it("moves the camera on closed or eased paths", () => {
    for (const m of MOTIONS) {
      const a = cameraAt(m, 1, 0, true);
      const b = cameraAt(m, 1, 1, true);
      for (const k of ["ox", "oy", "zoom", "dolly"] as const) expect(b[k]).toBeCloseTo(a[k], 9);
      // Every depth layer (focus ± 0.5) still covers the frame: shift plus half the visible width stays inside the photo.
      for (const strength of Object.values(STRENGTHS)) {
        for (let t = 0; t <= 1; t += 0.05) {
          for (const loop of [false, true]) {
            const c = cameraAt(m, strength, t, loop);
            for (const d of [-0.5, 0.5]) {
              const half = 0.5 / (c.zoom * (1 + c.dolly * d));
              expect(Math.abs(c.ox * d) + half, `${m} ${strength} ${t}`).toBeLessThanOrEqual(0.5);
              expect(Math.abs(c.oy * d) + half, `${m} ${strength} ${t}`).toBeLessThanOrEqual(0.5);
            }
          }
        }
      }
    }
    expect(cameraAt("push", 1, 1, false).zoom).toBeGreaterThan(cameraAt("push", 1, 0, false).zoom);
    expect(cameraAt("pull", 1, 1, false).zoom).toBeLessThan(cameraAt("pull", 1, 0, false).zoom);
    expect(frameCount(5)).toBe(150);
  });

  it("sizes and crops the video in even pixels", () => {
    expect(outputSize(4000, 3000, "original", 1080)).toEqual({ width: 1440, height: 1080 });
    expect(outputSize(4000, 3000, "9:16", 1080)).toEqual({ width: 1080, height: 1920 });
    expect(outputSize(4000, 1000, "original", 1080)).toEqual({ width: 1920, height: 480 });
    expect(outputSize(640, 481, "1:1", 1080)).toEqual({ width: 480, height: 480 });
    // A crop never asks for more pixels than it has: 16:9 of a 1080 square is 1080 × 607.5 source pixels.
    expect(outputSize(1080, 1080, "16:9", 1080)).toEqual({ width: 1080, height: 606 });
    expect(outputSize(962, 962, "original", 1080)).toEqual({ width: 962, height: 962 });
    expect(cropRect(4000, 3000, "1:1")).toEqual({ x: 0.125, y: 0, w: 0.75, h: 1 });
    expect(cropRect(1000, 2000, "16:9").h).toBeCloseTo(9 / 32, 9);
  });

  it("grows near depth by two pixels, then softens it", () => {
    const row = new Uint8ClampedArray([0, 0, 0, 255, 0, 0, 0]);
    expect([...prepareDepth(row, 7, 1)]).toEqual([85, 170, 255, 255, 255, 170, 85]);
    const col = prepareDepth(new Uint8ClampedArray([0, 0, 0, 255, 0, 0, 0]), 1, 7);
    expect([...col]).toEqual([85, 170, 255, 255, 255, 170, 85]);
  });
});

describe("AI image generator", () => {
  it("picks the language a prompt is translated from", () => {
    expect(promptLanguage("雨中撑伞的女孩", "en")).toBe("zh");
    expect(promptLanguage("雨の中の少女", "ja")).toBe("ja");
    expect(promptLanguage("東京の夜", "ja")).toBe("ja");
    expect(promptLanguage("해 질 녘 등대가 있는 작은 섬", "en")).toBe("ko");
    expect(promptLanguage("Hòn đảo nhỏ có ngọn hải đăng", "en")).toBe("vi");
    expect(promptLanguage("a red fox in snow, watercolor", "zh-CN")).toBe("en");
    expect(promptLanguage("a red fox in the snow, watercolor", "es")).toBe("en");
    expect(promptLanguage("un gato con sueter rosa", "es")).toBe("es");
    expect(promptLanguage("kucing lucu di jendela, anime style", "id")).toBe("id");
    expect(promptLanguage("girl’s umbrella — café at night", "en")).toBe("en");
    expect(promptLanguage("crème brûlée on a plate", "en")).toBe("en");
    expect(promptLanguage("cute corgi astronaut floating in space", "es")).toBe("en");
    expect(promptLanguage("cat wearing a hat", "id")).toBe("en");
    expect(promptLanguage("co gai an kem", "vi")).toBe("vi");
  });

  it("lists every Janus file the page can load, for each backend", () => {
    const files = mirrorFiles("janus");
    for (const variant of Object.values(AI_MODELS.janus.variants)) {
      expect(variant.files).toHaveLength(6);
      for (const f of variant.files) expect(files).toContain(f);
    }
    expect(AI_MODELS.janus.variants.gpu16.bytes).toBe(1_545_919_444);
  });
});

describe("AI music generator", () => {
  it("turns trio samples into lead, bass and drum notes, offset per sample", () => {
    const notes = toNotes([
      { pitch: 72, quantizedStartStep: 0, quantizedEndStep: 4, instrument: 0, velocity: 100 },
      { pitch: 40, quantizedStartStep: 0, quantizedEndStep: 8, instrument: 1 },
      { pitch: 36, quantizedStartStep: 0, quantizedEndStep: 1, instrument: 2, isDrum: true },
      { quantizedStartStep: 3 },
    ], 64);
    expect(notes).toEqual([
      { part: "lead", pitch: 72, start: 64, end: 68, velocity: 100 },
      { part: "bass", pitch: 40, start: 64, end: 72, velocity: 80 },
      { part: "drums", pitch: 36, start: 64, end: 65, velocity: 80 },
    ]);
    expect(MUSIC_BARS.map(samplesFor)).toEqual([1, 2, 4]);
  });

  it("times steps with swing and maps drums", () => {
    expect(stepSeconds(120)).toBeCloseTo(0.125, 9);
    expect(stepTime(2, 120, 0.3)).toBeCloseTo(0.25, 9);
    expect(stepTime(3, 120, 0.3)).toBeCloseTo(0.375 + 0.01875, 9);
    expect(pieceSeconds(8, 80)).toBeCloseTo(24, 9);
    expect([36, 38, 42, 46, 45, 49].map(drumKind)).toEqual(["kick", "snare", "hat", "openhat", "tom", "cymbal"]);
    for (const style of MUSIC_STYLES) expect(STYLE_PRESETS[style].bpm).toBeGreaterThan(60);
  });

  it("writes a standard MIDI file: tempo track, then lead, bass and drums", () => {
    const midi = toMidi([
      { part: "lead", pitch: 60, start: 0, end: 4, velocity: 90 },
      { part: "drums", pitch: 36, start: 4, end: 5, velocity: 200 },
    ], 120);
    const text = (from: number, n: number) => String.fromCharCode(...midi.slice(from, from + n));
    expect(text(0, 4)).toBe("MThd");
    expect([midi[9], midi[11], (midi[12] << 8) | midi[13]]).toEqual([1, 4, 480]);
    // Tempo track: 500000 µs per quarter at 120 BPM.
    expect([...midi.slice(14 + 8, 14 + 8 + 7)]).toEqual([0, 0xff, 0x51, 3, 0x07, 0xa1, 0x20]);
    const bytes = [...midi];
    // Lead on channel 1 (program 80), note 60 for 4 steps = 480 ticks; drum velocity clamped to 127 on channel 10.
    expect(bytes.join(",")).toContain([0, 0xc0, 80, 0, 0x90, 60, 90, 0x83, 0x60, 0x80, 60, 0].join(","));
    expect(bytes.join(",")).toContain([0x99, 36, 127].join(","));
  });
});
