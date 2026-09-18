import type { GameId } from "./games";
import { localePath, type Locale } from "./locale";
import type { ToolId, TutorialId } from "./path";

export const TOOL_COVER: Record<ToolId, string> = {
  clip: "/covers/clip-sweet.jpg?v=2",
  qr: "/covers/qr-sweet.jpg?v=1",
  barcode: "/covers/barcode-sweet.jpg?v=2",
  watermark: "/covers/watermark-sweet.jpg?v=1",
  collage: "/covers/collage-sweet.jpg?v=1",
  "portrait-sim": "/covers/portrait-sim-sweet.jpg?v=1",
  resize: "/covers/resize-sweet.jpg?v=1",
  crop: "/covers/crop-sweet.jpg?v=1",
  rotate: "/covers/rotate-sweet.jpg?v=1",
  exif: "/covers/exif-sweet.jpg?v=1",
  meme: "/covers/meme-sweet.jpg?v=2",
  signature: "/covers/signature-sweet.jpg?v=2",
  favicon: "/covers/favicon-sweet.jpg?v=1",
  screenshot: "/covers/screenshot-sweet.jpg?v=1",
  convert: "/covers/convert-sweet.jpg?v=1",
  "image-pdf": "/covers/image-pdf-sweet.jpg?v=1",
  "pdf-jpg": "/covers/pdf-jpg-sweet.jpg?v=1",
  "merge-pdf": "/covers/merge-pdf-sweet.jpg?v=1",
  "compress-pdf": "/covers/compress-pdf-sweet.jpg?v=1",
  "split-pdf": "/covers/split-pdf-sweet.jpg?v=1",
  invoice: "/covers/invoice-sweet.jpg?v=2",
  audio: "/covers/audio-sweet.jpg?v=2",
  "audio-cutter": "/covers/audio-cutter-sweet.jpg?v=1",
  "audio-joiner": "/covers/audio-joiner-sweet.jpg?v=1",
  data: "/covers/data-sweet.jpg?v=2",
  "xml-json": "/covers/xml-json-sweet.jpg?v=1",
  "yaml-json": "/covers/yaml-json-sweet.jpg?v=1",
  password: "/covers/password-sweet.jpg?v=1",
  "word-count": "/covers/word-count-sweet.jpg?v=1",
  color: "/covers/color-sweet.jpg?v=1",
  "hex-rgb": "/covers/hex-rgb-sweet.jpg?v=1",
  names: "/covers/names-sweet.jpg?v=1",
  timezone: "/covers/timezone-sweet.jpg?v=2",
  timestamp: "/covers/timestamp-sweet.jpg?v=1",
  lorem: "/covers/lorem-sweet.jpg?v=2",
  units: "/covers/units-sweet.jpg?v=2",
  "text-to-speech": "/covers/text-to-speech-sweet.jpg?v=2",
  diff: "/covers/diff-sweet.jpg?v=1",
  uuid: "/covers/uuid-sweet.jpg?v=1",
  hash: "/covers/hash-sweet.jpg?v=1",
  regex: "/covers/regex-sweet.jpg?v=1",
  case: "/covers/case-sweet.jpg?v=1",
  jwt: "/covers/jwt-sweet.jpg?v=1",
  percent: "/covers/percent-sweet.jpg?v=1",
  random: "/covers/random-sweet.jpg?v=1",
  html: "/covers/html-sweet.jpg?v=1",
  cron: "/covers/cron-sweet.jpg?v=1",
  slug: "/covers/slug-sweet.jpg?v=1",
  age: "/covers/age-sweet.jpg?v=1",
  bmi: "/covers/bmi-sweet.jpg?v=1",
  binary: "/covers/binary-sweet.jpg?v=1",
  tip: "/covers/tip-sweet.jpg?v=1",
  morse: "/covers/morse-sweet.jpg?v=1",
  roman: "/covers/roman-sweet.jpg?v=1",
  discount: "/covers/discount-sweet.jpg?v=1",
  countdown: "/covers/countdown-sweet.jpg?v=1",
  loan: "/covers/loan-sweet.jpg?v=1",
  stopwatch: "/covers/stopwatch-sweet.jpg?v=1",
  compound: "/covers/compound-sweet.jpg?v=1",
  vat: "/covers/vat-sweet.jpg?v=1",
};

export const GAME_COVER: Record<GameId, string> = {
  "super-mario-bros": "/covers/games/super-mario-bros.jpg?v=1",
  contra: "/covers/games/contra.jpg?v=1",
  "battle-city": "/covers/games/battle-city.jpg?v=1",
  "adventure-island": "/covers/games/adventure-island.jpg?v=1",
  "tetris-nes": "/covers/games/tetris-nes.jpg?v=1",
  "double-dragon": "/covers/games/double-dragon.jpg?v=1",
  "super-mario-world": "/covers/games/super-mario-world.jpg?v=1",
  "zelda-alttp": "/covers/games/zelda-alttp.jpg?v=1",
  "street-fighter-ii": "/covers/games/street-fighter-ii.jpg?v=1",
  "pokemon-red": "/covers/games/pokemon-red.jpg?v=1",
  "tetris-gb": "/covers/games/tetris-gb.jpg?v=1",
  "kirby-dream-land": "/covers/games/kirby-dream-land.jpg?v=1",
  "pokemon-gold": "/covers/games/pokemon-gold.jpg?v=1",
  "pokemon-emerald": "/covers/games/pokemon-emerald.jpg?v=1",
  "mario-kart-super-circuit": "/covers/games/mario-kart-super-circuit.jpg?v=1",
  "minish-cap": "/covers/games/minish-cap.jpg?v=1",
  sonic: "/covers/games/sonic.jpg?v=1",
  "streets-of-rage-2": "/covers/games/streets-of-rage-2.jpg?v=1",
  "alter-ego": "/covers/games/alter-ego.jpg?v=1",
  "lawn-mower": "/covers/games/lawn-mower.jpg?v=1",
};

export const LEARN_COVER: Record<TutorialId, string> = {
  "make-qr": "/covers/qr-sweet.jpg?v=1",
  "make-barcode": "/covers/barcode-sweet.jpg?v=2",
  "merge-pdf": "/covers/merge-pdf-sweet.jpg?v=1",
  "compress-pdf": "/covers/compress-pdf-sweet.jpg?v=1",
  "heic-to-jpg": "/covers/convert-sweet.jpg?v=1",
  "jpg-to-pdf": "/covers/image-pdf-sweet.jpg?v=1",
  "pdf-to-jpg": "/covers/pdf-jpg-sweet.jpg?v=1",
  "crop-photo": "/covers/crop-sweet.jpg?v=1",
  "webp-to-png": "/covers/convert-sweet.jpg?v=1",
  "resize-image": "/covers/resize-sweet.jpg?v=1",
  "split-pdf": "/covers/split-pdf-sweet.jpg?v=1",
  "add-watermark": "/covers/watermark-sweet.jpg?v=1",
  "remove-exif": "/covers/exif-sweet.jpg?v=1",
  "make-collage": "/covers/collage-sweet.jpg?v=1",
  "make-meme": "/covers/meme-sweet.jpg?v=2",
  "count-words": "/covers/word-count-sweet.jpg?v=1",
  "trim-audio": "/covers/audio-cutter-sweet.jpg?v=1",
  portrait: "/covers/tutorials/portrait-frames.svg",
  algorithms: "/covers/tutorials/algorithm-map.svg",
  "phone-photos": "/covers/tutorials/phone-focus.svg",
  "window-light": "/covers/tutorials/window-setup.svg",
  "crop-compose": "/covers/tutorials/crop-ratios.svg",
  "badminton-warmup": "/covers/learn-badminton-warmup-sweet.jpg?v=1",
  "badminton-rules": "/covers/learn-badminton-rules-sweet.jpg?v=1",
  "pool-safety": "/covers/learn-pool-safety-sweet.jpg?v=1",
  "one-page-site": "/covers/tutorials/site-structure.svg",
  "healthy-boundaries": "/covers/learn-healthy-boundaries-sweet.jpg?v=1",
  "read-character": "/covers/learn-read-character-sweet.jpg?v=1",
};

export const LEARN_FIG: Partial<Record<TutorialId, string>> = {
  "phone-photos": "/covers/learn-fig-phone-photos.jpg?v=1",
  "window-light": "/covers/learn-fig-window-light.jpg?v=1",
  "crop-compose": "/covers/learn-fig-crop-compose.jpg?v=1",
};

/** Instructional overview SVG shown at the top of a published lesson. */
export const LEARN_HERO: Partial<Record<TutorialId, string>> = {
  "make-qr": "/covers/tutorials/make-qr.svg",
  "make-barcode": "/covers/tutorials/make-barcode.svg",
  "merge-pdf": "/covers/tutorials/merge-pdf.svg",
  "compress-pdf": "/covers/tutorials/compress-pdf.svg",
  "heic-to-jpg": "/covers/tutorials/heic-to-jpg.svg",
  "jpg-to-pdf": "/covers/tutorials/jpg-to-pdf.svg",
  "pdf-to-jpg": "/covers/tutorials/pdf-to-jpg.svg",
  "crop-photo": "/covers/tutorials/crop-photo.svg",
  "webp-to-png": "/covers/tutorials/webp-to-png.svg",
  "resize-image": "/covers/tutorials/resize-image.svg",
  "split-pdf": "/covers/tutorials/split-pdf.svg",
  "add-watermark": "/covers/tutorials/add-watermark.svg",
  "remove-exif": "/covers/tutorials/remove-exif.svg",
  "make-collage": "/covers/tutorials/make-collage.svg",
  "make-meme": "/covers/tutorials/make-meme.svg",
  "count-words": "/covers/tutorials/count-words.svg",
  "trim-audio": "/covers/tutorials/trim-audio.svg",
};

export function coverUrl(path: string): string {
  return `https://cv.cm${path.split("?")[0]}`;
}

/** English diagrams live in /covers/tutorials/. Other locales use /covers/tutorials/{locale}/. */
export function localizedTutorialSrc(src: string, locale: Locale): string {
  if (locale === "en" || !src.startsWith("/covers/tutorials/")) return src;
  const rest = src.slice("/covers/tutorials/".length);
  if (rest.includes("/")) return src;
  return `/covers/tutorials/${localePath(locale)}/${rest}`;
}
