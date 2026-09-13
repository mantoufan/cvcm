import en from "../locales/en.json";
import es from "../locales/es.json";
import id from "../locales/id.json";
import ja from "../locales/ja.json";
import ko from "../locales/ko.json";
import vi from "../locales/vi.json";
import zhCN from "../locales/zh-CN.json";
import zhTW from "../locales/zh-TW.json";
import { type Locale } from "./locale";
import { appHref, type ToolId } from "./path";

const MESSAGES: Record<Locale, typeof en> = {
  en,
  "zh-CN": zhCN,
  "zh-TW": zhTW,
  ja,
  ko,
  vi,
  id,
  es,
};

export type FaqItem = { q: string; a: string };

function lookup(locale: Locale, path: string): string {
  const parts = path.split(".");
  let node: unknown = MESSAGES[locale];
  for (const part of parts) {
    if (typeof node !== "object" || node === null || !(part in node)) return path;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string" ? node : path;
}

const TITLE: Record<ToolId, string> = {
  clip: "meta.titleClip",
  qr: "meta.titleQr",
  watermark: "meta.titleWatermark",
  collage: "meta.titleCollage",
  resize: "meta.titleResize",
  crop: "meta.titleCrop",
  convert: "meta.titleConvert",
  "image-pdf": "meta.titleImagePdf",
  audio: "meta.titleAudio",
  data: "meta.titleData",
  password: "meta.titlePassword",
  "word-count": "meta.titleWordCount",
  color: "meta.titleColor",
};

const DESC: Record<ToolId, string> = {
  clip: "meta.descClip",
  qr: "meta.descQr",
  watermark: "meta.descWatermark",
  collage: "meta.descCollage",
  resize: "meta.descResize",
  crop: "meta.descCrop",
  convert: "meta.descConvert",
  "image-pdf": "meta.descImagePdf",
  audio: "meta.descAudio",
  data: "meta.descData",
  password: "meta.descPassword",
  "word-count": "meta.descWordCount",
  color: "meta.descColor",
};

export function pageTitle(locale: Locale, tool: ToolId | null): string {
  return lookup(locale, tool ? TITLE[tool] : "meta.title");
}

export function pageDescription(locale: Locale, tool: ToolId | null): string {
  return lookup(locale, tool ? DESC[tool] : "meta.description");
}

export function pageCanonical(locale: Locale, tool: ToolId | null, clipId?: string | null): string {
  return `https://cv.cm${appHref(locale, tool, clipId)}`;
}

export function faqItems(locale: Locale, tool: ToolId): FaqItem[] {
  const items: FaqItem[] = [];
  for (let i = 1; i <= 6; i++) {
    const qPath = `faq.${tool}.q${i}`;
    const q = lookup(locale, qPath);
    if (q === qPath) break;
    items.push({ q, a: lookup(locale, `faq.${tool}.a${i}`) });
  }
  return items;
}

export function faqJsonLd(locale: Locale, tool: ToolId): Record<string, unknown> | null {
  const items = faqItems(locale, tool);
  if (items.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function applyHtmlSeo(
  html: string,
  locale: Locale,
  tool: ToolId | null,
  clipId?: string | null,
): string {
  const title = pageTitle(locale, tool);
  const description = pageDescription(locale, tool);
  const canonical = pageCanonical(locale, tool, clipId);
  let out = html.replace(/<html\b[^>]*>/i, `<html lang="${escapeHtml(locale)}">`);
  out = out.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  out = out.replace(
    /(<meta\s+name="description"\s+content=")[^"]*(")/i,
    `$1${escapeHtml(description)}$2`,
  );
  if (/rel="canonical"/i.test(out)) {
    out = out.replace(
      /(<link\s+rel="canonical"\s+href=")[^"]*(")/i,
      `$1${escapeHtml(canonical)}$2`,
    );
  }
  out = out.replace(/<meta property="og:(title|description|url|type)"[^>]*>\s*/gi, "");
  out = out.replace(/<script type="application\/ld\+json" id="faq-jsonld">[\s\S]*?<\/script>\s*/i, "");
  const tags = [
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:url" content="${escapeHtml(canonical)}" />`,
    `<meta property="og:type" content="website" />`,
  ];
  if (tool) {
    const ld = faqJsonLd(locale, tool);
    if (ld) {
      tags.push(
        `<script type="application/ld+json" id="faq-jsonld">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>`,
      );
    }
  }
  return out.replace("</head>", `${tags.join("\n    ")}\n  </head>`);
}
