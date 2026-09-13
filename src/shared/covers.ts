import type { ToolId, TutorialId } from "./path";

export const TOOL_COVER: Record<ToolId, string> = {
  clip: "/covers/clip-sweet.jpg?v=2",
  qr: "/covers/qr-sweet.jpg?v=1",
  watermark: "/covers/watermark-sweet.jpg?v=1",
  collage: "/covers/collage-sweet.jpg?v=1",
  resize: "/covers/resize-sweet.jpg?v=1",
  crop: "/covers/crop-sweet.jpg?v=1",
  convert: "/covers/convert-sweet.jpg?v=1",
  "image-pdf": "/covers/image-pdf-sweet.jpg?v=1",
  "pdf-jpg": "/covers/pdf-jpg-sweet.jpg?v=1",
  "merge-pdf": "/covers/merge-pdf-sweet.jpg?v=1",
  "compress-pdf": "/covers/compress-pdf-sweet.jpg?v=1",
  "split-pdf": "/covers/split-pdf-sweet.jpg?v=1",
  audio: "/covers/audio-sweet.jpg?v=2",
  data: "/covers/data-sweet.jpg?v=2",
  password: "/covers/password-sweet.jpg?v=1",
  "word-count": "/covers/word-count-sweet.jpg?v=1",
  color: "/covers/color-sweet.jpg?v=1",
  names: "/covers/names-sweet.jpg?v=1",
};

export const LEARN_COVER: Record<TutorialId, string> = {
  "phone-photos": "/covers/learn-phone-photos-sweet.jpg?v=1",
  "window-light": "/covers/learn-window-light-sweet.jpg?v=1",
  "crop-compose": "/covers/learn-crop-compose-sweet.jpg?v=1",
  "badminton-warmup": "/covers/learn-badminton-warmup-sweet.jpg?v=1",
  "badminton-rules": "/covers/learn-badminton-rules-sweet.jpg?v=1",
  "pool-safety": "/covers/learn-pool-safety-sweet.jpg?v=1",
  "one-page-site": "/covers/learn-one-page-site-sweet.jpg?v=1",
  "healthy-boundaries": "/covers/learn-healthy-boundaries-sweet.jpg?v=1",
};

export const LEARN_FIG: Partial<Record<TutorialId, string>> = {
  "phone-photos": "/covers/learn-fig-phone-photos.jpg?v=1",
  "window-light": "/covers/learn-fig-window-light.jpg?v=1",
  "crop-compose": "/covers/learn-fig-crop-compose.jpg?v=1",
};

export function coverUrl(path: string): string {
  return `https://cv.cm${path.split("?")[0]}`;
}
