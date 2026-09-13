import { describe, expect, it } from "vitest";
import { encodeWav, resampleChannels } from "../src/shared/wav";
import { mediaBox, pdfFromJpegs } from "../src/shared/pdf";
import {
  applyHtmlSeo,
  faqItems,
  faqJsonLd,
  pageCanonical,
  pageDescription,
  pageTitle,
} from "../src/shared/seo";
import worker from "../src/worker";

const html = `<!doctype html>
<html lang="en">
  <head>
    <title>cv.cm</title>
    <meta name="description" content="old" />
    <link rel="canonical" href="https://cv.cm/" />
  </head>
  <body></body>
</html>`;

describe("seo helpers", () => {
  it("uses keyword-rich titles and descriptions", () => {
    expect(pageTitle("en", "convert")).toMatch(/HEIC to JPG/i);
    expect(pageTitle("en", "image-pdf")).toMatch(/JPG to PDF/i);
    expect(pageTitle("en", "audio")).toMatch(/MP3 to WAV/i);
    expect(pageTitle("en", "data")).toMatch(/JSON formatter/i);
    expect(pageDescription("en", "clip")).toMatch(/Pastebin/i);
    expect(pageCanonical("zh-CN", "watermark")).toBe("https://cv.cm/zh-CN/watermark/");
  });

  it("builds five FAQ items and FAQPage JSON-LD per tool", () => {
    const tools = [
      "clip", "qr", "watermark", "collage", "resize", "crop", "convert", "image-pdf", "audio", "data", "password", "word-count", "color",
    ] as const;
    for (const tool of tools) {
      const items = faqItems("en", tool);
      expect(items.length, tool).toBe(5);
      expect(items[0].q.length).toBeGreaterThan(8);
      expect(items[0].a.length).toBeGreaterThan(20);
      const ld = faqJsonLd("en", tool);
      expect(ld?.["@type"]).toBe("FAQPage");
      expect((ld?.mainEntity as unknown[]).length).toBe(5);
    }
  });

  it("rewrites HTML title, canonical, and JSON-LD", () => {
    const out = applyHtmlSeo(html, "en", "convert");
    expect(out).toContain("<title>HEIC to JPG, WebP to PNG, JPG to PNG — cv.cm</title>");
    expect(out).toContain('href="https://cv.cm/en/convert/"');
    expect(out).toContain('id="faq-jsonld"');
    expect(out).toContain("FAQPage");
    expect(out).toContain('lang="en"');
  });
});

describe("pdf page sizes", () => {
  const page = { jpeg: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), width: 1200, height: 800 };

  it("uses A4, Letter, or photo aspect", () => {
    expect(mediaBox(page, "a4")).toEqual({ w: 595.28, h: 841.89 });
    expect(mediaBox(page, "letter")).toEqual({ w: 612, h: 792 });
    const fit = mediaBox(page, "fit");
    expect(fit.w / fit.h).toBeCloseTo(1200 / 800, 5);
    expect(Math.max(fit.w, fit.h)).toBeCloseTo(841.89, 2);
  });

  it("embeds the chosen MediaBox", () => {
    const pdf = new TextDecoder().decode(pdfFromJpegs([page], "letter"));
    expect(pdf).toContain("612.00 792.00");
  });
});

describe("wav resample", () => {
  it("keeps length when rates match and stretches when they differ", () => {
    const src = [new Float32Array([0, 1, 0, -1])];
    expect(resampleChannels(src, 44100, 44100)[0]).toEqual(src[0]);
    const up = resampleChannels(src, 22050, 44100)[0];
    expect(up.length).toBe(8);
    const wav = encodeWav(src, 8000);
    expect(String.fromCharCode(...wav.slice(0, 4))).toBe("RIFF");
  });
});

describe("worker html seo", () => {
  it("injects convert FAQ into index.html for a tool URL", async () => {
    const response = await worker.fetch(new Request("https://cv.cm/en/convert/"), {
      ASSETS: {
        fetch: async () =>
          new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } }),
      },
    });
    const body = await response.text();
    expect(response.status).toBe(200);
    expect(body).toContain("HEIC to JPG");
    expect(body).toContain("FAQPage");
    expect(body).toContain("https://cv.cm/en/convert/");
  });
});
