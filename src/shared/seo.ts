import en from "../locales/en.json";
import es from "../locales/es.json";
import id from "../locales/id.json";
import ja from "../locales/ja.json";
import ko from "../locales/ko.json";
import vi from "../locales/vi.json";
import zhCN from "../locales/zh-CN.json";
import zhTW from "../locales/zh-TW.json";
import { LEARN_COVER, TOOL_COVER, coverUrl } from "./covers";
import { TUTORIAL_META } from "./learn";
import { type Locale } from "./locale";
import { appHref, learnHref, type ToolId, type TutorialId } from "./path";

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

export type SeoInput = {
  tool?: ToolId | null;
  clipId?: string | null;
  tutorial?: TutorialId | null;
  learn?: boolean;
};

const TITLE: Record<ToolId, string> = {
  clip: "meta.titleClip",
  qr: "meta.titleQr",
  watermark: "meta.titleWatermark",
  collage: "meta.titleCollage",
  resize: "meta.titleResize",
  crop: "meta.titleCrop",
  convert: "meta.titleConvert",
  "image-pdf": "meta.titleImagePdf",
  "pdf-jpg": "meta.titlePdfJpg",
  "merge-pdf": "meta.titleMergePdf",
  "compress-pdf": "meta.titleCompressPdf",
  "split-pdf": "meta.titleSplitPdf",
  audio: "meta.titleAudio",
  data: "meta.titleData",
  password: "meta.titlePassword",
  "word-count": "meta.titleWordCount",
  color: "meta.titleColor",
  names: "meta.titleNames",
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
  "pdf-jpg": "meta.descPdfJpg",
  "merge-pdf": "meta.descMergePdf",
  "compress-pdf": "meta.descCompressPdf",
  "split-pdf": "meta.descSplitPdf",
  audio: "meta.descAudio",
  data: "meta.descData",
  password: "meta.descPassword",
  "word-count": "meta.descWordCount",
  color: "meta.descColor",
  names: "meta.descNames",
};

const LEARN_TITLE: Record<TutorialId, string> = {
  "phone-photos": "meta.titlePhonePhotos",
  "window-light": "meta.titleWindowLight",
  "crop-compose": "meta.titleCropCompose",
  "badminton-warmup": "meta.titleBadmintonWarmup",
  "badminton-rules": "meta.titleBadmintonRules",
  "pool-safety": "meta.titlePoolSafety",
  "one-page-site": "meta.titleOnePageSite",
};

const LEARN_DESC: Record<TutorialId, string> = {
  "phone-photos": "meta.descPhonePhotos",
  "window-light": "meta.descWindowLight",
  "crop-compose": "meta.descCropCompose",
  "badminton-warmup": "meta.descBadmintonWarmup",
  "badminton-rules": "meta.descBadmintonRules",
  "pool-safety": "meta.descPoolSafety",
  "one-page-site": "meta.descOnePageSite",
};

export function pageTitle(locale: Locale, input: SeoInput | ToolId | null = {}): string {
  const seo = normalizeSeo(input);
  if (seo.learn) {
    return lookup(locale, seo.tutorial ? LEARN_TITLE[seo.tutorial] : "meta.titleLearn");
  }
  return lookup(locale, seo.tool ? TITLE[seo.tool] : "meta.title");
}

export function pageDescription(locale: Locale, input: SeoInput | ToolId | null = {}): string {
  const seo = normalizeSeo(input);
  if (seo.learn) {
    return lookup(locale, seo.tutorial ? LEARN_DESC[seo.tutorial] : "meta.descLearn");
  }
  return lookup(locale, seo.tool ? DESC[seo.tool] : "meta.description");
}

export function pageCanonical(
  locale: Locale,
  input: SeoInput | ToolId | null = {},
  clipId?: string | null,
): string {
  const seo = normalizeSeo(input, clipId);
  if (seo.learn) return `https://cv.cm${learnHref(locale, seo.tutorial ?? null)}`;
  return `https://cv.cm${appHref(locale, seo.tool ?? null, seo.clipId)}`;
}

function normalizeSeo(input: SeoInput | ToolId | null, clipId?: string | null): SeoInput {
  if (typeof input === "string") return { tool: input, clipId };
  if (input == null) return { tool: null, clipId };
  return clipId !== undefined ? { ...input, clipId } : input;
}

function faqFrom(locale: Locale, base: string): FaqItem[] {
  const items: FaqItem[] = [];
  for (let i = 1; i <= 6; i++) {
    const qPath = `${base}.q${i}`;
    const q = lookup(locale, qPath);
    if (q === qPath) break;
    items.push({ q, a: lookup(locale, `${base}.a${i}`) });
  }
  return items;
}

export function faqItems(locale: Locale, tool: ToolId): FaqItem[] {
  return faqFrom(locale, `faq.${tool}`);
}

export function learnFaqItems(locale: Locale, tutorial: TutorialId): FaqItem[] {
  return faqFrom(locale, `faq.learn.${tutorial}`);
}

export function faqJsonLd(
  locale: Locale,
  tool: ToolId | null,
  tutorial?: TutorialId | null,
): Record<string, unknown> | null {
  const items = tutorial ? learnFaqItems(locale, tutorial) : tool ? faqItems(locale, tool) : [];
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

export function howToJsonLd(locale: Locale, tutorial: TutorialId): Record<string, unknown> {
  const steps = [];
  for (let i = 1; i <= 5; i++) {
    steps.push({
      "@type": "HowToStep",
      position: i,
      name: lookup(locale, `learn.${tutorial}.s${i}t`),
      text: lookup(locale, `learn.${tutorial}.s${i}b`),
      url: `${pageCanonical(locale, { learn: true, tutorial })}#step-${i}`,
    });
  }
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: lookup(locale, `learn.${tutorial}.title`),
    description: lookup(locale, `learn.${tutorial}.lead`),
    totalTime: `PT${TUTORIAL_META[tutorial].minutes}M`,
    image: coverUrl(LEARN_COVER[tutorial]),
    step: steps,
  };
}

function ogImage(seo: SeoInput): string | null {
  if (seo.learn && seo.tutorial) return coverUrl(LEARN_COVER[seo.tutorial]);
  if (seo.tool) return coverUrl(TOOL_COVER[seo.tool]);
  return null;
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
  toolOrSeo: SeoInput | ToolId | null,
  clipId?: string | null,
): string {
  const seo = normalizeSeo(toolOrSeo, clipId);
  const title = pageTitle(locale, seo);
  const description = pageDescription(locale, seo);
  const canonical = pageCanonical(locale, seo);
  const image = ogImage(seo);
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
  out = out.replace(/<meta property="og:(title|description|url|type|image)"[^>]*>\s*/gi, "");
  out = out.replace(/<script type="application\/ld\+json" id="faq-jsonld">[\s\S]*?<\/script>\s*/gi, "");
  out = out.replace(/<script type="application\/ld\+json" id="howto-jsonld">[\s\S]*?<\/script>\s*/gi, "");
  const tags = [
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:url" content="${escapeHtml(canonical)}" />`,
    `<meta property="og:type" content="${seo.learn && seo.tutorial ? "article" : "website"}" />`,
  ];
  if (image) tags.push(`<meta property="og:image" content="${escapeHtml(image)}" />`);
  const ld = faqJsonLd(locale, seo.tool ?? null, seo.learn ? seo.tutorial : null);
  if (ld) {
    tags.push(
      `<script type="application/ld+json" id="faq-jsonld">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>`,
    );
  }
  if (seo.learn && seo.tutorial) {
    tags.push(
      `<script type="application/ld+json" id="howto-jsonld">${JSON.stringify(howToJsonLd(locale, seo.tutorial)).replace(/</g, "\\u003c")}</script>`,
    );
  }
  return out.replace("</head>", `${tags.join("\n    ")}\n  </head>`);
}
