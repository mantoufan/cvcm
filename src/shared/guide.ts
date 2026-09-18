import en from "../locales/guides/en.json";
import es from "../locales/guides/es.json";
import id from "../locales/guides/id.json";
import ja from "../locales/guides/ja.json";
import ko from "../locales/guides/ko.json";
import vi from "../locales/guides/vi.json";
import zhCN from "../locales/guides/zh-CN.json";
import zhTW from "../locales/guides/zh-TW.json";
import { coverUrl } from "./covers";
import type { Locale } from "./locale";
import { appHref, TOOLS, type ToolId } from "./path";

export const GUIDE_MESSAGES: Record<Locale, typeof en> = {
  en,
  "zh-CN": zhCN,
  "zh-TW": zhTW,
  ja,
  ko,
  vi,
  id,
  es,
};

export const GUIDE_STEP_COUNT: Record<ToolId, number> = {
  clip: 3,
  qr: 3,
  barcode: 3,
  watermark: 4,
  collage: 4,
  "portrait-sim": 4,
  resize: 3,
  crop: 3,
  rotate: 3,
  exif: 3,
  meme: 4,
  signature: 3,
  favicon: 3,
  screenshot: 3,
  convert: 3,
  "image-pdf": 3,
  "pdf-jpg": 3,
  "merge-pdf": 3,
  "compress-pdf": 3,
  "split-pdf": 3,
  invoice: 4,
  audio: 3,
  "audio-cutter": 3,
  "audio-joiner": 3,
  data: 3,
  "xml-json": 3,
  "yaml-json": 3,
  password: 3,
  "word-count": 3,
  color: 3,
  "hex-rgb": 3,
  names: 3,
  timezone: 3,
  timestamp: 3,
  lorem: 3,
  units: 3,
  "text-to-speech": 3,
  diff: 3,
  uuid: 3,
  hash: 3,
  regex: 4,
  case: 3,
  jwt: 3,
  percent: 3,
  random: 3,
  html: 3,
  cron: 3,
  slug: 3,
  age: 3,
  bmi: 3,
  binary: 3,
  tip: 3,
  morse: 3,
  roman: 3,
  discount: 3,
  countdown: 3,
  loan: 3,
  stopwatch: 3,
  compound: 3,
  vat: 3,
};

export function guideSteps(tool: ToolId): number {
  return GUIDE_STEP_COUNT[tool];
}

const GUIDE_VER: Partial<Record<ToolId, string>> = {
  "portrait-sim": "3",
};

export function guideImage(tool: ToolId, step: number): string {
  const src = `/covers/guides/${tool}/${String(step).padStart(2, "0")}.jpg`;
  const ver = GUIDE_VER[tool];
  return ver ? `${src}?v=${ver}` : src;
}

export function guideText(locale: Locale, path: string): string {
  const parts = path.split(".");
  let node: unknown = GUIDE_MESSAGES[locale];
  for (const part of parts) {
    if (typeof node !== "object" || node === null || !(part in node)) return path;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string" ? node : path;
}

export function toolHowToJsonLd(locale: Locale, tool: ToolId): Record<string, unknown> {
  const count = guideSteps(tool);
  const steps = [];
  for (let i = 1; i <= count; i++) {
    steps.push({
      "@type": "HowToStep",
      position: i,
      name: guideText(locale, `tools.${tool}.s${i}t`),
      text: guideText(locale, `tools.${tool}.s${i}b`),
      image: coverUrl(guideImage(tool, i)),
      url: `https://cv.cm${appHref(locale, tool)}#guide-step-${i}`,
    });
  }
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: guideText(locale, "title"),
    description: guideText(locale, `tools.${tool}.lead`),
    step: steps,
  };
}

export function guideToolIds(): ToolId[] {
  return [...TOOLS];
}
