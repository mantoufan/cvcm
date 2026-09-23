import { FEATURED_TUTORIALS, type ToolId, type TutorialId } from "./path";

export type TutorialMeta = {
  minutes: number;
  related: ToolId[];
  steps?: number;
  kind?: "card" | "course";
  openAt?: number;
  figure?: "thirds" | "window" | "crop" | "court" | "pool" | "site" | "mind";
  figByStep?: Partial<Record<number, string>>;
  codeByStep?: Partial<Record<number, "twoSum" | "binarySearch" | "countdown">>;
};

export function tutorialSteps(id: TutorialId): number {
  return TUTORIAL_META[id].steps ?? 5;
}

/** Published lessons whose first related tool is this one, in hub order. */
export function lessonsForTool(tool: ToolId): TutorialId[] {
  return FEATURED_TUTORIALS.filter((id) => TUTORIAL_META[id].related[0] === tool);
}

export const TUTORIAL_META: Record<TutorialId, TutorialMeta> = {
  "make-qr": {
    minutes: 6,
    steps: 6,
    openAt: 2,
    related: ["qr", "barcode", "clip"],
  },
  "make-barcode": {
    minutes: 6,
    steps: 6,
    openAt: 2,
    related: ["barcode", "qr"],
  },
  "merge-pdf": {
    minutes: 6,
    steps: 6,
    openAt: 2,
    related: ["merge-pdf", "compress-pdf", "split-pdf"],
  },
  "compress-pdf": {
    minutes: 6,
    steps: 6,
    openAt: 2,
    related: ["compress-pdf", "merge-pdf", "split-pdf"],
  },
  "heic-to-jpg": {
    minutes: 8,
    steps: 7,
    openAt: 3,
    related: ["convert", "image-pdf", "crop"],
  },
  "jpg-to-pdf": {
    minutes: 6,
    steps: 6,
    openAt: 2,
    related: ["image-pdf", "merge-pdf", "convert"],
  },
  "pdf-to-jpg": {
    minutes: 6,
    steps: 6,
    openAt: 2,
    related: ["pdf-jpg", "image-pdf", "compress-pdf"],
  },
  "crop-photo": {
    minutes: 6,
    steps: 6,
    openAt: 2,
    related: ["crop", "resize", "convert"],
  },
  "webp-to-png": {
    minutes: 6,
    steps: 6,
    openAt: 2,
    related: ["convert", "resize", "image-pdf"],
  },
  "resize-image": {
    minutes: 6,
    steps: 6,
    openAt: 2,
    related: ["resize", "crop", "convert"],
  },
  "split-pdf": {
    minutes: 6,
    steps: 6,
    openAt: 2,
    related: ["split-pdf", "merge-pdf", "compress-pdf"],
  },
  "add-watermark": {
    minutes: 7,
    steps: 6,
    openAt: 2,
    related: ["watermark", "exif", "resize"],
  },
  "remove-exif": {
    minutes: 6,
    steps: 6,
    openAt: 2,
    related: ["exif", "watermark", "resize"],
  },
  "make-collage": {
    minutes: 7,
    steps: 6,
    openAt: 2,
    related: ["collage", "crop", "watermark"],
  },
  "make-meme": {
    minutes: 6,
    steps: 6,
    openAt: 2,
    related: ["meme", "crop", "resize"],
  },
  "count-words": {
    minutes: 5,
    steps: 6,
    openAt: 2,
    related: ["word-count", "case", "diff"],
  },
  "trim-audio": {
    minutes: 6,
    steps: 6,
    openAt: 2,
    related: ["audio-cutter", "audio-joiner", "audio"],
  },
  "png-to-jpg": {
    minutes: 6,
    steps: 6,
    openAt: 2,
    related: ["convert", "resize", "crop"],
  },
  "jpg-to-png": {
    minutes: 6,
    steps: 6,
    openAt: 2,
    related: ["convert", "resize", "image-pdf"],
  },
  "avif-to-jpg": {
    minutes: 6,
    steps: 6,
    openAt: 2,
    related: ["convert", "resize", "image-pdf"],
  },
  "rotate-photo": {
    minutes: 6,
    steps: 6,
    openAt: 2,
    related: ["rotate", "crop", "resize"],
  },
  "png-to-webp": {
    minutes: 6,
    steps: 6,
    openAt: 2,
    related: ["convert", "resize", "image-pdf"],
  },
  "mp3-to-wav": {
    minutes: 6,
    steps: 6,
    openAt: 2,
    related: ["audio", "audio-cutter", "audio-joiner"],
  },
  "join-audio": {
    minutes: 6,
    steps: 6,
    openAt: 2,
    related: ["audio-joiner", "audio-cutter", "audio"],
  },
  "make-favicon": {
    minutes: 7,
    steps: 6,
    openAt: 2,
    related: ["favicon", "convert", "crop"],
  },
  "make-signature": {
    minutes: 6,
    steps: 6,
    openAt: 2,
    related: ["signature", "screenshot", "watermark"],
  },
  "annotate-screenshot": {
    minutes: 6,
    steps: 6,
    openAt: 2,
    related: ["screenshot", "crop", "resize"],
  },
  "make-invoice": {
    minutes: 8,
    steps: 6,
    openAt: 2,
    related: ["invoice", "image-pdf", "merge-pdf"],
  },
  "make-password": {
    minutes: 5,
    steps: 6,
    openAt: 2,
    related: ["password", "hash", "uuid"],
  },
  "format-json": {
    minutes: 6,
    steps: 6,
    openAt: 2,
    related: ["json", "yaml-json", "data"],
  },
  "decode-base64": {
    minutes: 6,
    steps: 6,
    openAt: 2,
    related: ["base64", "jwt", "url-encode"],
  },
  "unix-time": {
    minutes: 6,
    steps: 6,
    openAt: 2,
    related: ["timestamp", "timezone", "days"],
  },
  "read-jwt": {
    minutes: 6,
    steps: 6,
    openAt: 2,
    related: ["jwt", "base64", "hash"],
  },
  "count-workdays": {
    minutes: 6,
    steps: 6,
    openAt: 2,
    related: ["workdays", "days", "add-days"],
  },
  "simplify-fraction": {
    minutes: 5,
    steps: 6,
    openAt: 2,
    related: ["fraction", "percent", "aspect"],
  },
  "hourly-pay": {
    minutes: 6,
    steps: 6,
    openAt: 2,
    related: ["hourly", "vat", "percent"],
  },
  "convert-timezone": {
    minutes: 6,
    steps: 6,
    openAt: 2,
    related: ["timezone", "timestamp", "days"],
  },
  "profit-margin": {
    minutes: 6,
    steps: 6,
    openAt: 2,
    related: ["margin", "percent", "discount"],
  },
  "convert-base": {
    minutes: 6,
    steps: 6,
    openAt: 2,
    related: ["radix", "binary", "text-hex"],
  },
  "add-duration": {
    minutes: 5,
    steps: 6,
    openAt: 2,
    related: ["duration", "timezone", "timestamp"],
  },
  "calculate-percent": {
    minutes: 6,
    steps: 6,
    openAt: 2,
    related: ["percent", "margin", "discount"],
  },
  "days-between": {
    minutes: 6,
    steps: 6,
    openAt: 2,
    related: ["days", "workdays", "add-days"],
  },
  "shift-date": {
    minutes: 5,
    steps: 6,
    openAt: 2,
    related: ["add-days", "days", "week"],
  },
  "iso-week": {
    minutes: 6,
    steps: 6,
    openAt: 2,
    related: ["week", "days", "add-days"],
  },
  "vat-price": {
    minutes: 6,
    steps: 6,
    openAt: 2,
    related: ["vat", "discount", "percent"],
  },
  "percent-off": {
    minutes: 6,
    steps: 6,
    openAt: 2,
    related: ["discount", "margin", "percent"],
  },
  "encode-url": {
    minutes: 6,
    steps: 6,
    openAt: 2,
    related: ["url-encode", "text-hex", "reverse"],
  },
  "calculate-age": {
    minutes: 6,
    steps: 6,
    openAt: 2,
    related: ["age", "days", "add-days"],
  },
  "aspect-ratio": {
    minutes: 6,
    steps: 6,
    openAt: 2,
    related: ["aspect", "crop", "resize"],
  },
  "calculate-bmi": {
    minutes: 6,
    steps: 6,
    openAt: 2,
    related: ["bmi", "age", "units"],
  },
  "split-tip": {
    minutes: 6,
    steps: 6,
    openAt: 2,
    related: ["tip", "percent", "discount"],
  },
  "loan-payment": {
    minutes: 6,
    steps: 6,
    openAt: 2,
    related: ["loan", "compound", "percent"],
  },
  "read-cron": {
    minutes: 6,
    steps: 6,
    openAt: 2,
    related: ["cron", "timestamp", "slug"],
  },
  portrait: {
    minutes: 75,
    steps: 10,
    kind: "course",
    related: ["crop", "collage", "color"],
  },
  algorithms: {
    minutes: 90,
    steps: 10,
    kind: "course",
    related: [],
    codeByStep: { 7: "twoSum", 8: "binarySearch", 10: "countdown" },
  },
  "phone-photos": {
    minutes: 20,
    related: ["crop", "collage", "watermark"],
    figure: "thirds",
  },
  "window-light": {
    minutes: 15,
    related: ["crop", "color"],
    figure: "window",
  },
  "crop-compose": {
    minutes: 10,
    related: ["crop", "resize", "collage"],
    figure: "crop",
  },
  "badminton-warmup": {
    minutes: 10,
    related: ["clip"],
    figure: "court",
  },
  "badminton-rules": {
    minutes: 15,
    related: ["clip"],
    figure: "court",
  },
  "pool-safety": {
    minutes: 12,
    related: ["clip"],
    figure: "pool",
  },
  "one-page-site": {
    minutes: 60,
    related: ["data", "clip", "qr"],
    figure: "site",
  },
  "healthy-boundaries": {
    minutes: 15,
    related: ["clip"],
    figure: "mind",
  },
  "read-character": {
    minutes: 15,
    related: ["clip"],
    figure: "mind",
  },
};

export const ALGO_SNIPPETS = {
  twoSum: `function twoSum(nums, target) {
  const seen = new Map();
  for (let i = 0; i < nums.length; i++) {
    const need = target - nums[i];
    if (seen.has(need)) return [seen.get(need), i];
    seen.set(nums[i], i);
  }
  return null;
}

twoSum([2, 7, 11, 15], 9); // [0, 1]`,
  binarySearch: `function binarySearch(sorted, target) {
  let lo = 0;
  let hi = sorted.length - 1;
  while (lo <= hi) {
    const mid = lo + Math.floor((hi - lo) / 2);
    if (sorted[mid] === target) return mid;
    if (sorted[mid] < target) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}

binarySearch([1, 3, 4, 8, 12], 8); // 3`,
  countdown: `function countdown(n, result = []) {
  if (n === 0) return result;
  result.push(n);
  return countdown(n - 1, result);
}

countdown(3); // [3, 2, 1]`,
} as const;

export const ONE_PAGE_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Your name</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 36rem; margin: 12vh auto; padding: 1.25rem; line-height: 1.55; color: #3a2030; }
    a.pay { display: inline-block; margin-top: 0.6rem; background: #c83f79; color: #fff; padding: 0.75rem 1.15rem; border-radius: 999px; text-decoration: none; }
  </style>
</head>
<body>
  <h1>Your name</h1>
  <p>One sentence: what you make or do.</p>
  <p><a class="pay" href="mailto:hello@example.com">Contact</a></p>
</body>
</html>
`;

export const TUTORIAL_SOURCES: Partial<Record<TutorialId, { title: string; href: string }[]>> = {
  algorithms: [{ title: "JavaScript Map — MDN", href: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map" }],
  "one-page-site": [
    { title: "Cloudflare Pages — Direct Upload", href: "https://developers.cloudflare.com/pages/get-started/direct-upload/" },
    { title: "GitHub Pages — Create a site", href: "https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site" },
  ],
};

// Each diagram is placed beside the step it explains. Assets use scalable vectors.
export const TUTORIAL_DIAGRAMS: Partial<Record<TutorialId, { step: number; src: string }[]>> = {
  "make-qr": [
    { step: 1, src: "/covers/tutorials/make-qr-contents.svg" },
    { step: 5, src: "/covers/tutorials/make-qr-scan.svg" },
  ],
  "make-barcode": [
    { step: 1, src: "/covers/tutorials/make-barcode-types.svg" },
    { step: 3, src: "/covers/tutorials/make-barcode-digits.svg" },
  ],
  "merge-pdf": [
    { step: 3, src: "/covers/tutorials/merge-pdf-order.svg" },
    { step: 6, src: "/covers/tutorials/merge-pdf-check.svg" },
  ],
  "compress-pdf": [
    { step: 1, src: "/covers/tutorials/compress-pdf-limit.svg" },
    { step: 4, src: "/covers/tutorials/compress-pdf-quality.svg" },
  ],
  "heic-to-jpg": [
    { step: 1, src: "/covers/tutorials/heic-to-jpg-why.svg" },
    { step: 4, src: "/covers/tutorials/heic-to-jpg-convert.svg" },
  ],
  "jpg-to-pdf": [
    { step: 4, src: "/covers/tutorials/jpg-to-pdf-page.svg" },
    { step: 6, src: "/covers/tutorials/jpg-to-pdf-pages.svg" },
  ],
  "pdf-to-jpg": [
    { step: 4, src: "/covers/tutorials/pdf-to-jpg-scale.svg" },
    { step: 6, src: "/covers/tutorials/pdf-to-jpg-check.svg" },
  ],
  "crop-photo": [
    { step: 1, src: "/covers/tutorials/crop-photo-ratios.svg" },
    { step: 4, src: "/covers/tutorials/crop-photo-edges.svg" },
  ],
  "webp-to-png": [
    { step: 1, src: "/covers/tutorials/webp-to-png-why.svg" },
    { step: 4, src: "/covers/tutorials/webp-to-png-alpha.svg" },
  ],
  "resize-image": [
    { step: 1, src: "/covers/tutorials/resize-image-limit.svg" },
    { step: 4, src: "/covers/tutorials/resize-image-lock.svg" },
  ],
  "split-pdf": [
    { step: 1, src: "/covers/tutorials/split-pdf-each.svg" },
    { step: 4, src: "/covers/tutorials/split-pdf-range.svg" },
  ],
  "add-watermark": [
    { step: 1, src: "/covers/tutorials/add-watermark-place.svg" },
    { step: 4, src: "/covers/tutorials/add-watermark-opacity.svg" },
  ],
  "remove-exif": [
    { step: 1, src: "/covers/tutorials/remove-exif-gps.svg" },
    { step: 6, src: "/covers/tutorials/remove-exif-check.svg" },
  ],
  "make-collage": [
    { step: 1, src: "/covers/tutorials/make-collage-layout.svg" },
    { step: 4, src: "/covers/tutorials/make-collage-fit.svg" },
  ],
  "make-meme": [
    { step: 1, src: "/covers/tutorials/make-meme-text.svg" },
    { step: 5, src: "/covers/tutorials/make-meme-stroke.svg" },
  ],
  "count-words": [
    { step: 1, src: "/covers/tutorials/count-words-which.svg" },
    { step: 4, src: "/covers/tutorials/count-words-cjk.svg" },
  ],
  "trim-audio": [
    { step: 1, src: "/covers/tutorials/trim-audio-range.svg" },
    { step: 6, src: "/covers/tutorials/trim-audio-listen.svg" },
  ],
  "png-to-jpg": [
    { step: 1, src: "/covers/tutorials/png-to-jpg-why.svg" },
    { step: 4, src: "/covers/tutorials/png-to-jpg-matte.svg" },
  ],
  "jpg-to-png": [
    { step: 1, src: "/covers/tutorials/jpg-to-png-why.svg" },
    { step: 4, src: "/covers/tutorials/jpg-to-png-myth.svg" },
  ],
  "avif-to-jpg": [
    { step: 1, src: "/covers/tutorials/avif-to-jpg-why.svg" },
    { step: 4, src: "/covers/tutorials/avif-to-jpg-do.svg" },
  ],
  "rotate-photo": [
    { step: 1, src: "/covers/tutorials/rotate-photo-turn.svg" },
    { step: 6, src: "/covers/tutorials/rotate-photo-bake.svg" },
  ],
  "png-to-webp": [
    { step: 1, src: "/covers/tutorials/png-to-webp-why.svg" },
    { step: 4, src: "/covers/tutorials/png-to-webp-alpha.svg" },
  ],
  "mp3-to-wav": [
    { step: 1, src: "/covers/tutorials/mp3-to-wav-why.svg" },
    { step: 4, src: "/covers/tutorials/mp3-to-wav-rate.svg" },
  ],
  "join-audio": [
    { step: 1, src: "/covers/tutorials/join-audio-order.svg" },
    { step: 4, src: "/covers/tutorials/join-audio-rate.svg" },
  ],
  "make-favicon": [
    { step: 1, src: "/covers/tutorials/make-favicon-fit.svg" },
    { step: 5, src: "/covers/tutorials/make-favicon-sizes.svg" },
  ],
  "make-signature": [
    { step: 1, src: "/covers/tutorials/make-signature-legal.svg" },
    { step: 4, src: "/covers/tutorials/make-signature-crop.svg" },
  ],
  "annotate-screenshot": [
    { step: 1, src: "/covers/tutorials/annotate-screenshot-marks.svg" },
    { step: 6, src: "/covers/tutorials/annotate-screenshot-png.svg" },
  ],
  "make-invoice": [
    { step: 1, src: "/covers/tutorials/make-invoice-lines.svg" },
    { step: 5, src: "/covers/tutorials/make-invoice-tax.svg" },
  ],
  "make-password": [
    { step: 1, src: "/covers/tutorials/make-password-rule.svg" },
    { step: 5, src: "/covers/tutorials/make-password-copy.svg" },
  ],
  "format-json": [
    { step: 1, src: "/covers/tutorials/format-json-parse.svg" },
    { step: 4, src: "/covers/tutorials/format-json-quotes.svg" },
  ],
  "decode-base64": [
    { step: 1, src: "/covers/tutorials/decode-base64-alpha.svg" },
    { step: 5, src: "/covers/tutorials/decode-base64-text.svg" },
  ],
  "unix-time": [
    { step: 1, src: "/covers/tutorials/unix-time-digits.svg" },
    { step: 5, src: "/covers/tutorials/unix-time-year.svg" },
  ],
  "read-jwt": [
    { step: 1, src: "/covers/tutorials/read-jwt-trust.svg" },
    { step: 5, src: "/covers/tutorials/read-jwt-exp.svg" },
  ],
  "count-workdays": [
    { step: 1, src: "/covers/tutorials/count-workdays-ends.svg" },
    { step: 5, src: "/covers/tutorials/count-workdays-holiday.svg" },
  ],
  "simplify-fraction": [
    { step: 1, src: "/covers/tutorials/simplify-fraction-reduce.svg" },
    { step: 5, src: "/covers/tutorials/simplify-fraction-decimal.svg" },
  ],
  "hourly-pay": [
    { step: 1, src: "/covers/tutorials/hourly-pay-gross.svg" },
    { step: 6, src: "/covers/tutorials/hourly-pay-tax.svg" },
  ],
  "convert-timezone": [
    { step: 1, src: "/covers/tutorials/convert-timezone-source.svg" },
    { step: 4, src: "/covers/tutorials/convert-timezone-offset.svg" },
  ],
  "profit-margin": [
    { step: 1, src: "/covers/tutorials/profit-margin-split.svg" },
    { step: 5, src: "/covers/tutorials/profit-margin-zero.svg" },
  ],
  "convert-base": [
    { step: 1, src: "/covers/tutorials/convert-base-ff.svg" },
    { step: 6, src: "/covers/tutorials/convert-base-prefix.svg" },
  ],
  "add-duration": [
    { step: 1, src: "/covers/tutorials/add-duration-sum.svg" },
    { step: 5, src: "/covers/tutorials/add-duration-minus.svg" },
  ],
  "calculate-percent": [
    { step: 1, src: "/covers/tutorials/calculate-percent-lines.svg" },
    { step: 5, src: "/covers/tutorials/calculate-percent-zero.svg" },
  ],
  "days-between": [
    { step: 1, src: "/covers/tutorials/days-between-gap.svg" },
    { step: 5, src: "/covers/tutorials/days-between-leap.svg" },
  ],
  "shift-date": [
    { step: 1, src: "/covers/tutorials/shift-date-leap.svg" },
    { step: 6, src: "/covers/tutorials/shift-date-weekend.svg" },
  ],
  "iso-week": [
    { step: 1, src: "/covers/tutorials/iso-week-monday.svg" },
    { step: 4, src: "/covers/tutorials/iso-week-year.svg" },
  ],
  "vat-price": [
    { step: 1, src: "/covers/tutorials/vat-price-add.svg" },
    { step: 5, src: "/covers/tutorials/vat-price-split.svg" },
  ],
  "percent-off": [
    { step: 1, src: "/covers/tutorials/percent-off-sale.svg" },
    { step: 5, src: "/covers/tutorials/percent-off-over.svg" },
  ],
  "encode-url": [
    { step: 1, src: "/covers/tutorials/encode-url-slash.svg" },
    { step: 4, src: "/covers/tutorials/encode-url-space.svg" },
  ],
  "calculate-age": [
    { step: 1, src: "/covers/tutorials/calculate-age-before.svg" },
    { step: 5, src: "/covers/tutorials/calculate-age-day.svg" },
  ],
  "aspect-ratio": [
    { step: 1, src: "/covers/tutorials/aspect-ratio-order.svg" },
    { step: 5, src: "/covers/tutorials/aspect-ratio-round.svg" },
  ],
  "calculate-bmi": [
    { step: 1, src: "/covers/tutorials/calculate-bmi-units.svg" },
    { step: 5, src: "/covers/tutorials/calculate-bmi-band.svg" },
  ],
  "split-tip": [
    { step: 1, src: "/covers/tutorials/split-tip-total.svg" },
    { step: 5, src: "/covers/tutorials/split-tip-people.svg" },
  ],
  "loan-payment": [
    { step: 1, src: "/covers/tutorials/loan-payment-simple.svg" },
    { step: 5, src: "/covers/tutorials/loan-payment-zero.svg" },
  ],
  "read-cron": [
    { step: 1, src: "/covers/tutorials/read-cron-fields.svg" },
    { step: 4, src: "/covers/tutorials/read-cron-sunday.svg" },
  ],
};
