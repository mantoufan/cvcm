import type { ToolId, TutorialId } from "./path";

export const TOOL_COVER: Record<ToolId, string> = {
  clip: "/covers/clip-sweet.jpg?v=2",
  qr: "/covers/qr-sweet.jpg?v=1",
  barcode: "/covers/barcode-sweet.jpg?v=2",
  watermark: "/covers/watermark-sweet.jpg?v=1",
  collage: "/covers/collage-sweet.jpg?v=1",
  resize: "/covers/resize-sweet.jpg?v=1",
  crop: "/covers/crop-sweet.jpg?v=1",
  rotate: "/covers/rotate-sweet.jpg?v=1",
  exif: "/covers/exif-sweet.jpg?v=1",
  meme: "/covers/meme-sweet.jpg?v=2",
  signature: "/covers/signature-sweet.jpg?v=2",
  favicon: "/covers/favicon-sweet.jpg?v=1",
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
  password: "/covers/password-sweet.jpg?v=1",
  "word-count": "/covers/word-count-sweet.jpg?v=1",
  color: "/covers/color-sweet.jpg?v=1",
  names: "/covers/names-sweet.jpg?v=1",
  timezone: "/covers/timezone-sweet.jpg?v=2",
  timestamp: "/covers/timestamp-sweet.jpg?v=1",
  lorem: "/covers/lorem-sweet.jpg?v=2",
  units: "/covers/units-sweet.jpg?v=2",
  "text-to-speech": "/covers/text-to-speech-sweet.jpg?v=2",
  diff: "/covers/diff-sweet.jpg?v=1",
  uuid: "/covers/uuid-sweet.jpg?v=1",
  regex: "/covers/regex-sweet.jpg?v=1",
};

export const LEARN_COVER: Record<TutorialId, string> = {
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

export function coverUrl(path: string): string {
  return `https://cv.cm${path.split("?")[0]}`;
}
