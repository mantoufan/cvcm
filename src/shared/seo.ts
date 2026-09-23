import en from "../locales/en.json";
import es from "../locales/es.json";
import id from "../locales/id.json";
import ja from "../locales/ja.json";
import ko from "../locales/ko.json";
import vi from "../locales/vi.json";
import zhCN from "../locales/zh-CN.json";
import zhTW from "../locales/zh-TW.json";
import { DEVICE_COVER, GAME_COVER, LEARN_COVER, MARKET_COVER, TOOL_COVER, coverUrl, localizedTutorialSrc } from "./covers";
import { deviceBreadcrumbJsonLd, deviceFaqJsonLd, devicePageCopy, deviceStaticHtml } from "./device-i18n";
import type { DevicePageId } from "./device";
import { gameById, type GameConsoleId, type GameId } from "./games";
import { gameCopy, gameFaqItems } from "./games-i18n";
import { gameGuideSteps, walkthroughImage } from "./game-walkthrough";
import { toolHowToJsonLd } from "./guide";
import { TUTORIAL_DIAGRAMS, tutorialSteps } from "./learn";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "./locale";
import { HREFLANG } from "./sitemap";
import { marketCopy, marketFaqItems, marketHub, marketHubFaqItems } from "./markets-i18n";
import type { MarketId } from "./markets";
import { appHref, deviceHref, gamesHref, learnHref, marketsHref, type ConvertJobId, type ResizeJobId, type ToolId, type TutorialId } from "./path";

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
  convertJob?: ConvertJobId | null;
  resizeJob?: ResizeJobId | null;
  tutorial?: TutorialId | null;
  learn?: boolean;
  games?: boolean;
  console?: GameConsoleId | null;
  game?: GameId | null;
  markets?: boolean;
  market?: MarketId | null;
  devicePage?: DevicePageId | null;
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
  json: "meta.titleJson",
  base64: "meta.titleBase64",
  days: "meta.titleDays",
  sort: "meta.titleSort",
  replace: "meta.titleReplace",
  words: "meta.titleWords",
  "add-days": "meta.titleAddDays",
  week: "meta.titleWeek",
  aspect: "meta.titleAspect",
  workdays: "meta.titleWorkdays",
  fraction: "meta.titleFraction",
  hourly: "meta.titleHourly",
  margin: "meta.titleMargin",
  radix: "meta.titleRadix",
  duration: "meta.titleDuration",
  gold: "meta.titleGold",
  silver: "meta.titleSilver",
  platinum: "meta.titlePlatinum",
  palladium: "meta.titlePalladium",
  oil: "meta.titleOil",
  stocks: "meta.titleStocks",
};

const CONVERT_JOB_TITLE: Record<ConvertJobId, string> = {
  "heic-to-jpg": "meta.titleJobHeicToJpg",
  "webp-to-png": "meta.titleJobWebpToPng",
  "png-to-jpg": "meta.titleJobPngToJpg",
  "jpg-to-png": "meta.titleJobJpgToPng",
  "avif-to-jpg": "meta.titleJobAvifToJpg",
  "png-to-webp": "meta.titleJobPngToWebp",
};

const CONVERT_JOB_DESC: Record<ConvertJobId, string> = {
  "heic-to-jpg": "meta.descJobHeicToJpg",
  "webp-to-png": "meta.descJobWebpToPng",
  "png-to-jpg": "meta.descJobPngToJpg",
  "jpg-to-png": "meta.descJobJpgToPng",
  "avif-to-jpg": "meta.descJobAvifToJpg",
  "png-to-webp": "meta.descJobPngToWebp",
};

const RESIZE_JOB_TITLE: Record<ResizeJobId, string> = {
  "compress-image": "meta.titleJobCompressImage",
};
const RESIZE_JOB_DESC: Record<ResizeJobId, string> = {
  "compress-image": "meta.descJobCompressImage",
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
  json: "meta.descJson",
  base64: "meta.descBase64",
  days: "meta.descDays",
  sort: "meta.descSort",
  replace: "meta.descReplace",
  words: "meta.descWords",
  "add-days": "meta.descAddDays",
  week: "meta.descWeek",
  aspect: "meta.descAspect",
  workdays: "meta.descWorkdays",
  fraction: "meta.descFraction",
  hourly: "meta.descHourly",
  margin: "meta.descMargin",
  radix: "meta.descRadix",
  duration: "meta.descDuration",
  gold: "meta.descGold",
  silver: "meta.descSilver",
  platinum: "meta.descPlatinum",
  palladium: "meta.descPalladium",
  oil: "meta.descOil",
  stocks: "meta.descStocks",
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
  "png-to-jpg": "meta.titlePngToJpg",
  "jpg-to-png": "meta.titleJpgToPng",
  "avif-to-jpg": "meta.titleAvifToJpg",
  "rotate-photo": "meta.titleRotatePhoto",
  "png-to-webp": "meta.titlePngToWebp",
  "mp3-to-wav": "meta.titleMp3ToWav",
  "join-audio": "meta.titleJoinAudio",
  "make-favicon": "meta.titleMakeFavicon",
  "make-signature": "meta.titleMakeSignature",
  "annotate-screenshot": "meta.titleAnnotateScreenshot",
  "make-invoice": "meta.titleMakeInvoice",
  "make-password": "meta.titleMakePassword",
  "format-json": "meta.titleFormatJson",
  "decode-base64": "meta.titleDecodeBase64",
  "unix-time": "meta.titleUnixTime",
  "read-jwt": "meta.titleReadJwt",
  "count-workdays": "meta.titleCountWorkdays",
  "simplify-fraction": "meta.titleSimplifyFraction",
  "hourly-pay": "meta.titleHourlyPay",
  "convert-timezone": "meta.titleConvertTimezone",
  "profit-margin": "meta.titleProfitMargin",
  "convert-base": "meta.titleConvertBase",
  "add-duration": "meta.titleAddDuration",
  "calculate-percent": "meta.titleCalculatePercent",
  "days-between": "meta.titleDaysBetween",
  "shift-date": "meta.titleShiftDate",
  "iso-week": "meta.titleIsoWeek",
  "vat-price": "meta.titleVatPrice",
  "percent-off": "meta.titlePercentOff",
  "encode-url": "meta.titleEncodeUrl",
  "calculate-age": "meta.titleCalculateAge",
  "aspect-ratio": "meta.titleAspectRatio",
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
  "png-to-jpg": "meta.descPngToJpg",
  "jpg-to-png": "meta.descJpgToPng",
  "avif-to-jpg": "meta.descAvifToJpg",
  "rotate-photo": "meta.descRotatePhoto",
  "png-to-webp": "meta.descPngToWebp",
  "mp3-to-wav": "meta.descMp3ToWav",
  "join-audio": "meta.descJoinAudio",
  "make-favicon": "meta.descMakeFavicon",
  "make-signature": "meta.descMakeSignature",
  "annotate-screenshot": "meta.descAnnotateScreenshot",
  "make-invoice": "meta.descMakeInvoice",
  "make-password": "meta.descMakePassword",
  "format-json": "meta.descFormatJson",
  "decode-base64": "meta.descDecodeBase64",
  "unix-time": "meta.descUnixTime",
  "read-jwt": "meta.descReadJwt",
  "count-workdays": "meta.descCountWorkdays",
  "simplify-fraction": "meta.descSimplifyFraction",
  "hourly-pay": "meta.descHourlyPay",
  "convert-timezone": "meta.descConvertTimezone",
  "profit-margin": "meta.descProfitMargin",
  "convert-base": "meta.descConvertBase",
  "add-duration": "meta.descAddDuration",
  "calculate-percent": "meta.descCalculatePercent",
  "days-between": "meta.descDaysBetween",
  "shift-date": "meta.descShiftDate",
  "iso-week": "meta.descIsoWeek",
  "vat-price": "meta.descVatPrice",
  "percent-off": "meta.descPercentOff",
  "encode-url": "meta.descEncodeUrl",
  "calculate-age": "meta.descCalculateAge",
  "aspect-ratio": "meta.descAspectRatio",
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
  if (seo.markets) return seo.market ? marketCopy(locale, seo.market).title : marketHub(locale).title;
  if (seo.devicePage) return devicePageCopy(locale, seo.devicePage).title;
  if (seo.tool === "convert" && seo.convertJob) return lookup(locale, CONVERT_JOB_TITLE[seo.convertJob]);
  if (seo.tool === "resize" && seo.resizeJob) return lookup(locale, RESIZE_JOB_TITLE[seo.resizeJob]);
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
  if (seo.markets) return seo.market ? marketCopy(locale, seo.market).description : marketHub(locale).description;
  if (seo.devicePage) return devicePageCopy(locale, seo.devicePage).description;
  if (seo.tool === "convert" && seo.convertJob) return lookup(locale, CONVERT_JOB_DESC[seo.convertJob]);
  if (seo.tool === "resize" && seo.resizeJob) return lookup(locale, RESIZE_JOB_DESC[seo.resizeJob]);
  return lookup(locale, seo.tool ? DESC[seo.tool] : "meta.description");
}

export function hreflangAlternates(
  input: SeoInput | ToolId | null = {},
  clipId?: string | null,
): { hreflang: string; href: string }[] {
  const seo = normalizeSeo(input, clipId);
  const links = LOCALES.map((locale) => ({
    hreflang: HREFLANG[locale],
    href: pageCanonical(locale, seo),
  }));
  links.push({ hreflang: "x-default", href: pageCanonical(DEFAULT_LOCALE, seo) });
  return links;
}

export function pageCanonical(
  locale: Locale,
  input: SeoInput | ToolId | null = {},
  clipId?: string | null,
): string {
  const seo = normalizeSeo(input, clipId);
  if (seo.learn) return `https://cv.cm${learnHref(locale, seo.tutorial ?? null)}`;
  if (seo.games) return `https://cv.cm${gamesHref(locale, seo.console ?? null, seo.game ?? null)}`;
  if (seo.markets) return `https://cv.cm${marketsHref(locale, seo.market ?? null)}`;
  if (seo.devicePage) return `https://cv.cm${deviceHref(locale, seo.devicePage)}`;
  return `https://cv.cm${appHref(locale, seo.tool ?? null, seo.clipId, seo.convertJob ?? seo.resizeJob)}`;
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

export function convertJobFaqItems(locale: Locale, job: ConvertJobId): FaqItem[] {
  return faqFrom(locale, `faq.convertJobs.${job}`);
}

export function resizeJobFaqItems(locale: Locale, job: ResizeJobId): FaqItem[] {
  return faqFrom(locale, `faq.resizeJobs.${job}`);
}

export function learnFaqItems(locale: Locale, tutorial: TutorialId): FaqItem[] {
  return faqFrom(locale, `faq.learn.${tutorial}`);
}

export function gamesHubFaqItems(locale: Locale): FaqItem[] {
  return faqFrom(locale, "faq.games");
}

export function marketBreadcrumbJsonLd(locale: Locale, id: MarketId | null): Record<string, unknown> {
  const hub = marketHub(locale);
  const items = [
    { name: "cv.cm", url: pageCanonical(locale, { tool: null }) },
    { name: hub.name, url: pageCanonical(locale, { markets: true }) },
  ];
  if (id) {
    items.push({ name: marketCopy(locale, id).name, url: pageCanonical(locale, { markets: true, market: id }) });
  }
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function faqJsonLd(
  locale: Locale,
  tool: ToolId | null,
  tutorial?: TutorialId | null,
  game?: GameId | null,
  gamesHub?: boolean,
  convertJob?: ConvertJobId | null,
  resizeJob?: ResizeJobId | null,
  market?: MarketId | null,
  marketsHub?: boolean,
): Record<string, unknown> | null {
  const items = market
    ? marketFaqItems(locale, market)
    : marketsHub
      ? marketHubFaqItems(locale)
      : game
        ? gameFaqItems(locale, game)
        : gamesHub
          ? gamesHubFaqItems(locale)
          : tutorial
        ? learnFaqItems(locale, tutorial)
        : tool === "convert" && convertJob
          ? convertJobFaqItems(locale, convertJob)
          : tool === "resize" && resizeJob
            ? resizeJobFaqItems(locale, resizeJob)
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
      url: `${pageCanonical(locale, { games: true, console: game.console, game: id })}#guide-${step.id}`,
      ...(step.image ? { image: coverUrl(walkthroughImage(id, step.image)) } : {}),
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
  if (seo.markets && seo.market) return coverUrl(MARKET_COVER[seo.market]);
  if (seo.devicePage) return coverUrl(DEVICE_COVER);
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
  out = out.replace(/<link\s+rel="alternate"\s+hreflang="[^"]*"\s+href="[^"]*"\s*\/?>\s*/gi, "");
  out = out.replace(/<meta property="og:(title|description|url|type|image)"[^>]*>\s*/gi, "");
  out = out.replace(/<script type="application\/ld\+json" id="faq-jsonld">[\s\S]*?<\/script>\s*/gi, "");
  out = out.replace(/<script type="application\/ld\+json" id="howto-jsonld">[\s\S]*?<\/script>\s*/gi, "");
  out = out.replace(/<script type="application\/ld\+json" id="game-jsonld">[\s\S]*?<\/script>\s*/gi, "");
  out = out.replace(/<script type="application\/ld\+json" id="breadcrumb-jsonld">[\s\S]*?<\/script>\s*/gi, "");
  const tags = [
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:url" content="${escapeHtml(canonical)}" />`,
    `<meta property="og:type" content="${(seo.learn && seo.tutorial) || seo.game ? "article" : "website"}" />`,
  ];
  if (image) tags.push(`<meta property="og:image" content="${escapeHtml(image)}" />`);
  for (const alt of hreflangAlternates(seo)) {
    tags.push(`<link rel="alternate" hreflang="${escapeHtml(alt.hreflang)}" href="${escapeHtml(alt.href)}" />`);
  }
  const ld = faqJsonLd(
    locale,
    seo.tool ?? null,
    seo.learn ? seo.tutorial : null,
    seo.game ?? null,
    Boolean(seo.games && !seo.game),
    seo.convertJob,
    seo.resizeJob,
    seo.market ?? null,
    Boolean(seo.markets && !seo.market),
  );
  if (seo.devicePage) {
    tags.push(
      `<script type="application/ld+json" id="breadcrumb-jsonld">${JSON.stringify(deviceBreadcrumbJsonLd(locale, seo.devicePage)).replace(/</g, "\\u003c")}</script>`,
      `<script type="application/ld+json" id="faq-jsonld">${JSON.stringify(deviceFaqJsonLd(locale, seo.devicePage)).replace(/</g, "\\u003c")}</script>`,
    );
  } else if (seo.markets) {
    tags.push(
      `<script type="application/ld+json" id="breadcrumb-jsonld">${JSON.stringify(marketBreadcrumbJsonLd(locale, seo.market ?? null)).replace(/</g, "\\u003c")}</script>`,
    );
  }
  if (ld && !seo.devicePage) {
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
  out = out.replace("</head>", `${tags.join("\n    ")}\n  </head>`);
  if (seo.devicePage) {
    const inner = deviceStaticHtml(locale, seo.devicePage);
    out = out.replace(/<div id="app">[\s\S]*?<\/div>/, `<div id="app">${inner}</div>`);
  }
  return out;
}
