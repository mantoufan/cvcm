import en from "../locales/en.json";
import es from "../locales/es.json";
import id from "../locales/id.json";
import ja from "../locales/ja.json";
import ko from "../locales/ko.json";
import vi from "../locales/vi.json";
import zhCN from "../locales/zh-CN.json";
import zhTW from "../locales/zh-TW.json";
import { GAME_COVER, LEARN_COVER, TOOL_COVER, coverUrl, localizedTutorialSrc } from "./covers";
import { gameById, type GameConsoleId, type GameId } from "./games";
import { gameCopy, gameFaqItems, gameGuideSteps } from "./games-i18n";
import { toolHowToJsonLd } from "./guide";
import { TUTORIAL_DIAGRAMS, tutorialSteps } from "./learn";
import { type Locale } from "./locale";
import { appHref, gamesHref, learnHref, type ToolId, type TutorialId } from "./path";

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
  games?: boolean;
  console?: GameConsoleId | null;
  game?: GameId | null;
};

const TITLE: Record<ToolId, string> = {
  clip: "meta.titleClip",
  qr: "meta.titleQr",
  barcode: "meta.titleBarcode",
  watermark: "meta.titleWatermark",
  collage: "meta.titleCollage",
  "portrait-sim": "meta.titlePortraitSim",
  resize: "meta.titleResize",
  crop: "meta.titleCrop",
  rotate: "meta.titleRotate",
  exif: "meta.titleExif",
  meme: "meta.titleMeme",
  signature: "meta.titleSignature",
  favicon: "meta.titleFavicon",
  screenshot: "meta.titleScreenshot",
  convert: "meta.titleConvert",
  "image-pdf": "meta.titleImagePdf",
  "pdf-jpg": "meta.titlePdfJpg",
  "merge-pdf": "meta.titleMergePdf",
  "compress-pdf": "meta.titleCompressPdf",
  "split-pdf": "meta.titleSplitPdf",
  invoice: "meta.titleInvoice",
  audio: "meta.titleAudio",
  "audio-cutter": "meta.titleAudioCutter",
  "audio-joiner": "meta.titleAudioJoiner",
  data: "meta.titleData",
  "xml-json": "meta.titleXmlJson",
  "yaml-json": "meta.titleYamlJson",
  password: "meta.titlePassword",
  "word-count": "meta.titleWordCount",
  color: "meta.titleColor",
  "hex-rgb": "meta.titleHexRgb",
  names: "meta.titleNames",
  timezone: "meta.titleTimezone",
  timestamp: "meta.titleTimestamp",
  lorem: "meta.titleLorem",
  units: "meta.titleUnits",
  "text-to-speech": "meta.titleTts",
  diff: "meta.titleDiff",
  uuid: "meta.titleUuid",
  hash: "meta.titleHash",
  regex: "meta.titleRegex",
  case: "meta.titleCase",
  jwt: "meta.titleJwt",
  percent: "meta.titlePercent",
  random: "meta.titleRandom",
  html: "meta.titleHtml",
  cron: "meta.titleCron",
  slug: "meta.titleSlug",
  age: "meta.titleAge",
  bmi: "meta.titleBmi",
  binary: "meta.titleBinary",
  tip: "meta.titleTip",
  morse: "meta.titleMorse",
  roman: "meta.titleRoman",
  discount: "meta.titleDiscount",
  countdown: "meta.titleCountdown",
  loan: "meta.titleLoan",
  stopwatch: "meta.titleStopwatch",
  compound: "meta.titleCompound",
  vat: "meta.titleVat",
  reverse: "meta.titleReverse",
  "url-encode": "meta.titleUrlEncode",
  "text-hex": "meta.titleTextHex",
};

const DESC: Record<ToolId, string> = {
  clip: "meta.descClip",
  qr: "meta.descQr",
  barcode: "meta.descBarcode",
  watermark: "meta.descWatermark",
  collage: "meta.descCollage",
  "portrait-sim": "meta.descPortraitSim",
  resize: "meta.descResize",
  crop: "meta.descCrop",
  rotate: "meta.descRotate",
  exif: "meta.descExif",
  meme: "meta.descMeme",
  signature: "meta.descSignature",
  favicon: "meta.descFavicon",
  screenshot: "meta.descScreenshot",
  convert: "meta.descConvert",
  "image-pdf": "meta.descImagePdf",
  "pdf-jpg": "meta.descPdfJpg",
  "merge-pdf": "meta.descMergePdf",
  "compress-pdf": "meta.descCompressPdf",
  "split-pdf": "meta.descSplitPdf",
  invoice: "meta.descInvoice",
  audio: "meta.descAudio",
  "audio-cutter": "meta.descAudioCutter",
  "audio-joiner": "meta.descAudioJoiner",
  data: "meta.descData",
  "xml-json": "meta.descXmlJson",
  "yaml-json": "meta.descYamlJson",
  password: "meta.descPassword",
  "word-count": "meta.descWordCount",
  color: "meta.descColor",
  "hex-rgb": "meta.descHexRgb",
  names: "meta.descNames",
  timezone: "meta.descTimezone",
  timestamp: "meta.descTimestamp",
  lorem: "meta.descLorem",
  units: "meta.descUnits",
  "text-to-speech": "meta.descTts",
  diff: "meta.descDiff",
  uuid: "meta.descUuid",
  hash: "meta.descHash",
  regex: "meta.descRegex",
  case: "meta.descCase",
  jwt: "meta.descJwt",
  percent: "meta.descPercent",
  random: "meta.descRandom",
  html: "meta.descHtml",
  cron: "meta.descCron",
  slug: "meta.descSlug",
  age: "meta.descAge",
  bmi: "meta.descBmi",
  binary: "meta.descBinary",
  tip: "meta.descTip",
  morse: "meta.descMorse",
  roman: "meta.descRoman",
  discount: "meta.descDiscount",
  countdown: "meta.descCountdown",
  loan: "meta.descLoan",
  stopwatch: "meta.descStopwatch",
  compound: "meta.descCompound",
  vat: "meta.descVat",
  reverse: "meta.descReverse",
  "url-encode": "meta.descUrlEncode",
  "text-hex": "meta.descTextHex",
};

const LEARN_TITLE: Record<TutorialId, string> = {
  "make-qr": "meta.titleMakeQr",
  "make-barcode": "meta.titleMakeBarcode",
  "merge-pdf": "meta.titleLearnMergePdf",
  "compress-pdf": "meta.titleLearnCompressPdf",
  "heic-to-jpg": "meta.titleHeicToJpg",
  "jpg-to-pdf": "meta.titleJpgToPdf",
  "pdf-to-jpg": "meta.titleLearnPdfToJpg",
  "crop-photo": "meta.titleCropPhoto",
  "webp-to-png": "meta.titleWebpToPng",
  "resize-image": "meta.titleResizeImage",
  "split-pdf": "meta.titleLearnSplitPdf",
  "add-watermark": "meta.titleAddWatermark",
  "remove-exif": "meta.titleRemoveExif",
  "make-collage": "meta.titleMakeCollage",
  "make-meme": "meta.titleMakeMeme",
  "count-words": "meta.titleCountWords",
  "trim-audio": "meta.titleTrimAudio",
  portrait: "meta.titlePortrait",
  algorithms: "meta.titleAlgorithms",
  "phone-photos": "meta.titlePhonePhotos",
  "window-light": "meta.titleWindowLight",
  "crop-compose": "meta.titleCropCompose",
  "badminton-warmup": "meta.titleBadmintonWarmup",
  "badminton-rules": "meta.titleBadmintonRules",
  "pool-safety": "meta.titlePoolSafety",
  "one-page-site": "meta.titleOnePageSite",
  "healthy-boundaries": "meta.titleHealthyBoundaries",
  "read-character": "meta.titleReadCharacter",
};

const LEARN_DESC: Record<TutorialId, string> = {
  "make-qr": "meta.descMakeQr",
  "make-barcode": "meta.descMakeBarcode",
  "merge-pdf": "meta.descLearnMergePdf",
  "compress-pdf": "meta.descLearnCompressPdf",
  "heic-to-jpg": "meta.descHeicToJpg",
  "jpg-to-pdf": "meta.descJpgToPdf",
  "pdf-to-jpg": "meta.descLearnPdfToJpg",
  "crop-photo": "meta.descCropPhoto",
  "webp-to-png": "meta.descWebpToPng",
  "resize-image": "meta.descResizeImage",
  "split-pdf": "meta.descLearnSplitPdf",
  "add-watermark": "meta.descAddWatermark",
  "remove-exif": "meta.descRemoveExif",
  "make-collage": "meta.descMakeCollage",
  "make-meme": "meta.descMakeMeme",
  "count-words": "meta.descCountWords",
  "trim-audio": "meta.descTrimAudio",
  portrait: "meta.descPortrait",
  algorithms: "meta.descAlgorithms",
  "phone-photos": "meta.descPhonePhotos",
  "window-light": "meta.descWindowLight",
  "crop-compose": "meta.descCropCompose",
  "badminton-warmup": "meta.descBadmintonWarmup",
  "badminton-rules": "meta.descBadmintonRules",
  "pool-safety": "meta.descPoolSafety",
  "one-page-site": "meta.descOnePageSite",
  "healthy-boundaries": "meta.descHealthyBoundaries",
  "read-character": "meta.descReadCharacter",
};

export function pageTitle(locale: Locale, input: SeoInput | ToolId | null = {}): string {
  const seo = normalizeSeo(input);
  if (seo.learn) {
    return lookup(locale, seo.tutorial ? LEARN_TITLE[seo.tutorial] : "meta.titleLearn");
  }
  if (seo.games) {
    if (seo.game) return gameCopy(locale, seo.game).title;
    if (seo.console) return lookup(locale, `meta.titleGames${consoleMeta(seo.console)}`);
    return lookup(locale, "meta.titleGames");
  }
  return lookup(locale, seo.tool ? TITLE[seo.tool] : "meta.title");
}

export function pageDescription(locale: Locale, input: SeoInput | ToolId | null = {}): string {
  const seo = normalizeSeo(input);
  if (seo.learn) {
    return lookup(locale, seo.tutorial ? LEARN_DESC[seo.tutorial] : "meta.descLearn");
  }
  if (seo.games) {
    if (seo.game) return gameCopy(locale, seo.game).description;
    if (seo.console) return lookup(locale, `meta.descGames${consoleMeta(seo.console)}`);
    return lookup(locale, "meta.descGames");
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
  if (seo.games) return `https://cv.cm${gamesHref(locale, seo.console ?? null, seo.game ?? null)}`;
  return `https://cv.cm${appHref(locale, seo.tool ?? null, seo.clipId)}`;
}

function consoleMeta(id: GameConsoleId): string {
  return id[0].toUpperCase() + id.slice(1);
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

export function gamesHubFaqItems(locale: Locale): FaqItem[] {
  return faqFrom(locale, "faq.games");
}

export function faqJsonLd(
  locale: Locale,
  tool: ToolId | null,
  tutorial?: TutorialId | null,
  game?: GameId | null,
  gamesHub?: boolean,
): Record<string, unknown> | null {
  const items = game
    ? gameFaqItems(locale, game)
    : gamesHub
      ? gamesHubFaqItems(locale)
      : tutorial
        ? learnFaqItems(locale, tutorial)
        : tool
          ? faqItems(locale, tool)
          : [];
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
  const count = tutorialSteps(tutorial);
  for (let i = 1; i <= count; i++) {
    steps.push({
      "@type": "HowToStep",
      position: i,
      ...(TUTORIAL_DIAGRAMS[tutorial]?.find((d) => d.step === i)
        ? { image: coverUrl(localizedTutorialSrc(TUTORIAL_DIAGRAMS[tutorial]!.find((d) => d.step === i)!.src, locale)) } : {}),
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
    image: coverUrl(LEARN_COVER[tutorial]),
    step: steps,
  };
}

export function gameHowToJsonLd(locale: Locale, id: GameId): Record<string, unknown> {
  const copy = gameCopy(locale, id);
  const game = gameById(id)!;
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: copy.title,
    description: copy.lead,
    image: coverUrl(GAME_COVER[id]),
    step: gameGuideSteps(locale, id).map((step, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: step.title,
      text: step.body,
      url: `${pageCanonical(locale, { games: true, console: game.console, game: id })}#guide-${i + 1}`,
    })),
  };
}

export function gameVideoGameJsonLd(locale: Locale, id: GameId): Record<string, unknown> {
  const copy = gameCopy(locale, id);
  const game = gameById(id)!;
  return {
    "@context": "https://schema.org",
    "@type": "VideoGame",
    name: copy.name,
    description: copy.description,
    image: coverUrl(GAME_COVER[id]),
    gamePlatform: lookup(locale, `games.consoles.${game.console}`),
    genre: lookup(locale, `games.genres.${game.genre}`),
    datePublished: String(game.year),
    url: pageCanonical(locale, { games: true, console: game.console, game: id }),
  };
}

function ogImage(seo: SeoInput): string | null {
  if (seo.learn && seo.tutorial) return coverUrl(LEARN_COVER[seo.tutorial]);
  if (seo.games && seo.game) return coverUrl(GAME_COVER[seo.game]);
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
  out = out.replace(/<script type="application\/ld\+json" id="game-jsonld">[\s\S]*?<\/script>\s*/gi, "");
  const tags = [
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:url" content="${escapeHtml(canonical)}" />`,
    `<meta property="og:type" content="${(seo.learn && seo.tutorial) || seo.game ? "article" : "website"}" />`,
  ];
  if (image) tags.push(`<meta property="og:image" content="${escapeHtml(image)}" />`);
  const ld = faqJsonLd(
    locale,
    seo.tool ?? null,
    seo.learn ? seo.tutorial : null,
    seo.game ?? null,
    Boolean(seo.games && !seo.game),
  );
  if (ld) {
    tags.push(
      `<script type="application/ld+json" id="faq-jsonld">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>`,
    );
  }
  if (seo.game) {
    tags.push(
      `<script type="application/ld+json" id="howto-jsonld">${JSON.stringify(gameHowToJsonLd(locale, seo.game)).replace(/</g, "\\u003c")}</script>`,
      `<script type="application/ld+json" id="game-jsonld">${JSON.stringify(gameVideoGameJsonLd(locale, seo.game)).replace(/</g, "\\u003c")}</script>`,
    );
  } else if (seo.learn && seo.tutorial) {
    tags.push(
      `<script type="application/ld+json" id="howto-jsonld">${JSON.stringify(howToJsonLd(locale, seo.tutorial)).replace(/</g, "\\u003c")}</script>`,
    );
  } else if (seo.tool) {
    tags.push(
      `<script type="application/ld+json" id="howto-jsonld">${JSON.stringify(toolHowToJsonLd(locale, seo.tool)).replace(/</g, "\\u003c")}</script>`,
    );
  }
  return out.replace("</head>", `${tags.join("\n    ")}\n  </head>`);
}
