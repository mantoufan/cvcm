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
    expect(pageTitle("en", "timezone")).toMatch(/Timezone converter/i);
    expect(pageTitle("en", "lorem")).toMatch(/Lorem ipsum/i);
    expect(pageTitle("en", "units")).toMatch(/Unit converter/i);
    expect(pageTitle("en", "barcode")).toMatch(/Barcode generator/i);
    expect(pageTitle("en", "meme")).toMatch(/Meme generator/i);
    expect(pageTitle("en", "text-to-speech")).toMatch(/Text to speech/i);
    expect(pageTitle("en", "invoice")).toMatch(/Invoice generator/i);
    expect(pageTitle("en", "signature")).toMatch(/Signature generator/i);
    expect(pageTitle("en", "diff")).toMatch(/Diff checker/i);
    expect(pageTitle("en", "uuid")).toMatch(/UUID generator/i);
    expect(pageTitle("en", "regex")).toMatch(/Regex tester/i);
    expect(pageTitle("en", "favicon")).toMatch(/Favicon generator/i);
    expect(pageTitle("en", "audio-cutter")).toMatch(/Audio cutter/i);
    expect(pageTitle("en", "timestamp")).toMatch(/Timestamp converter/i);
    expect(pageTitle("en", "rotate")).toMatch(/Rotate image/i);
    expect(pageTitle("en", "exif")).toMatch(/EXIF remover/i);
    expect(pageTitle("en", "audio-joiner")).toMatch(/Audio joiner/i);
    expect(pageTitle("en", "hex-rgb")).toMatch(/Hex to RGB/i);
    expect(pageTitle("en", "xml-json")).toMatch(/XML to JSON/i);
    expect(pageTitle("en", "hash")).toMatch(/Hash generator/i);
    expect(pageTitle("en", "yaml-json")).toMatch(/YAML to JSON/i);
    expect(pageTitle("en", "case")).toMatch(/Case converter/i);
    expect(pageTitle("en", "jwt")).toMatch(/JWT decoder/i);
    expect(pageTitle("en", "screenshot")).toMatch(/Screenshot editor/i);
    expect(pageTitle("en", "percent")).toMatch(/Percentage calculator/i);
    expect(pageTitle("en", "random")).toMatch(/Random number/i);
    expect(pageTitle("en", "html")).toMatch(/HTML encode/i);
    expect(pageTitle("en", "cron")).toMatch(/Cron/i);
    expect(pageTitle("en", "slug")).toMatch(/Slug/i);
    expect(pageTitle("en", "age")).toMatch(/Age calculator/i);
    expect(pageTitle("en", "bmi")).toMatch(/BMI/i);
    expect(pageTitle("en", "binary")).toMatch(/Binary/i);
    expect(pageTitle("en", "tip")).toMatch(/Tip calculator/i);
    expect(pageTitle("en", "morse")).toMatch(/Morse/i);
    expect(pageTitle("en", "roman")).toMatch(/Roman/i);
    expect(pageTitle("en", "discount")).toMatch(/Discount/i);
    expect(pageTitle("en", "countdown")).toMatch(/Countdown/i);
    expect(pageTitle("en", "loan")).toMatch(/Loan/i);
    expect(pageTitle("en", "stopwatch")).toMatch(/Stopwatch/i);
    expect(pageTitle("en", "compound")).toMatch(/Compound/i);
    expect(pageTitle("en", "vat")).toMatch(/VAT/i);
    expect(pageTitle("en", "portrait-sim")).toMatch(/Portrait camera simulator/i);
    expect(pageTitle("en", "watermark")).toMatch(/watermark/i);
    expect(pageTitle("en", "watermark")).toMatch(/ID copies/i);
    expect(pageTitle("zh-CN", "watermark")).toMatch(/证件/);
    expect(pageDescription("en", "watermark")).toMatch(/ID copies/i);
    expect(pageDescription("zh-CN", "watermark")).toMatch(/仅供/);
    expect(pageDescription("en", "clip")).toMatch(/Pastebin/i);
    expect(pageCanonical("zh-CN", "watermark")).toBe("https://cv.cm/zh-cn/watermark/");
  });

  it("lays out identity-privacy keywords on the watermark FAQ", () => {
    const zh = faqItems("zh-CN", "watermark");
    expect(zh).toHaveLength(5);
    expect(zh.some((item) => /证件|身份证|仅供/.test(`${item.q}${item.a}`))).toBe(true);
    const en = faqItems("en", "watermark");
    expect(en.some((item) => /ID|passport|for-use|for \[org\]/i.test(`${item.q}${item.a}`))).toBe(true);
  });

  it("builds five FAQ items and FAQPage JSON-LD per tool", () => {
    const tools = [
      "clip", "qr", "barcode", "watermark", "collage", "portrait-sim", "resize", "crop", "rotate", "exif", "meme", "signature", "favicon", "screenshot", "convert", "image-pdf", "pdf-jpg", "merge-pdf", "compress-pdf", "split-pdf", "invoice", "audio", "audio-cutter", "audio-joiner", "data", "xml-json", "yaml-json", "password", "word-count", "color", "hex-rgb", "names", "timezone", "timestamp", "lorem", "units", "text-to-speech", "diff", "uuid", "hash", "regex", "case", "jwt", "percent", "random", "html", "cron", "slug", "age", "bmi", "binary", "tip", "morse", "roman", "discount", "countdown", "loan", "stopwatch", "compound", "vat",
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
    expect(out).toContain('id="howto-jsonld"');
    expect(out).toContain("HowTo");
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
