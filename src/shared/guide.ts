import type { Locale } from "./locale";
import { messages } from "./messages";
import { appHref, TOOLS, type ToolId } from "./path";


export const GUIDE_STEP_COUNT: Record<ToolId, number> = {
  clip: 3,
  qr: 3,
  barcode: 3,
  watermark: 4,
  mosaic: 3,
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
  reverse: 3,
  "url-encode": 3,
  "text-hex": 3,
  json: 3,
  base64: 3,
  days: 3,
  sort: 3,
  replace: 3,
  words: 3,
  "add-days": 3,
  week: 3,
  aspect: 3,
  workdays: 3,
  fraction: 3,
  hourly: 3,
  margin: 3,
  radix: 3,
  duration: 3,
  tdee: 3,
  cidr: 3,
  chmod: 3,
  typing: 3,
  "image-colors": 3,
  dice: 3,
  gpa: 3,
  pomodoro: 3,
  sleep: 3,
  "body-fat": 3,
  contrast: 3,
  pace: 3,
  grade: 3,
  "due-date": 3,
  "ideal-weight": 3,
  "water-intake": 3,
  "fuel-cost": 3,
  "reading-time": 3,
  gold: 3,
  silver: 3,
  platinum: 3,
  palladium: 3,
  oil: 3,
  stocks: 3,
  "remove-background": 3,
  "image-upscaler": 3,
  "speech-to-text": 3,
  "depth-map": 3,
};

export function guideSteps(tool: ToolId): number {
  return GUIDE_STEP_COUNT[tool];
}

export function guideText(locale: Locale, path: string): string {
  const parts = path.split(".");
  let node: unknown = messages(locale).guides;
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
