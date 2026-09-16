# cv.cm tool test and guide progress

Updated: `2026-09-16T06:36:00.000Z`

Each tool was exercised in Chrome (bb-browser CDP). Passing tools got step screenshots at `public/covers/guides/{id}/` and an illustrated how-to above the FAQ.

**41 pass / 0 fail / 41 tools**

## Production verify (2026-09-16, deploy `71c9bfc`)

All 38 English tool URLs return 200, include HowTo JSON-LD, and reference `/covers/guides/{id}/01.jpg`. Every step JPEG is 200 `image/jpeg`.

Browser (logged-in Chrome CDP) on `zh-cn` unless noted: `clip`, `convert`, `invoice`, `regex`, `hash`, `password`, `watermark`, plus `en/xml-json`. Each page shows **使用步骤 / How to use this tool** above **常见问题 / FAQ**, with the expected step count. Guide images decode (1080×726) once they enter the viewport (`loading=lazy`).

`yaml-json`, `case`, and `jwt` shipped with the wrong neighbouring-tool screenshots. Recaptured from production 2026-09-16; 8-locale how-to copy filled in (they had been English in every file).

| Tool | Status | Steps | Screenshots | Notes |
|---|---|---:|---|---|
| `clip` | pass | 3 | `covers/guides/clip/01.jpg`, `covers/guides/clip/02.jpg`, `covers/guides/clip/03.jpg` | Created a real expiring note during the test. |
| `qr` | pass | 3 | `covers/guides/qr/01.jpg`, `covers/guides/qr/02.jpg`, `covers/guides/qr/03.jpg` | On-device happy path; screenshot per step. |
| `barcode` | pass | 3 | `covers/guides/barcode/01.jpg`, `covers/guides/barcode/02.jpg`, `covers/guides/barcode/03.jpg` | On-device happy path; screenshot per step. |
| `watermark` | pass | 4 | `covers/guides/watermark/01.jpg`, `covers/guides/watermark/02.jpg`, `covers/guides/watermark/03.jpg`, `covers/guides/watermark/04.jpg` | On-device happy path; screenshot per step. |
| `collage` | pass | 4 | `covers/guides/collage/01.jpg`, `covers/guides/collage/02.jpg`, `covers/guides/collage/03.jpg`, `covers/guides/collage/04.jpg` | On-device happy path; screenshot per step. |
| `resize` | pass | 3 | `covers/guides/resize/01.jpg`, `covers/guides/resize/02.jpg`, `covers/guides/resize/03.jpg` | On-device happy path; screenshot per step. |
| `crop` | pass | 3 | `covers/guides/crop/01.jpg`, `covers/guides/crop/02.jpg`, `covers/guides/crop/03.jpg` | On-device happy path; screenshot per step. |
| `rotate` | pass | 3 | `covers/guides/rotate/01.jpg`, `covers/guides/rotate/02.jpg`, `covers/guides/rotate/03.jpg` | On-device happy path; screenshot per step. |
| `exif` | pass | 3 | `covers/guides/exif/01.jpg`, `covers/guides/exif/02.jpg`, `covers/guides/exif/03.jpg` | On-device happy path; screenshot per step. |
| `meme` | pass | 4 | `covers/guides/meme/01.jpg`, `covers/guides/meme/02.jpg`, `covers/guides/meme/03.jpg`, `covers/guides/meme/04.jpg` | On-device happy path; screenshot per step. |
| `signature` | pass | 3 | `covers/guides/signature/01.jpg`, `covers/guides/signature/02.jpg`, `covers/guides/signature/03.jpg` | On-device happy path; screenshot per step. |
| `favicon` | pass | 3 | `covers/guides/favicon/01.jpg`, `covers/guides/favicon/02.jpg`, `covers/guides/favicon/03.jpg` | On-device happy path; screenshot per step. |
| `convert` | pass | 3 | `covers/guides/convert/01.jpg`, `covers/guides/convert/02.jpg`, `covers/guides/convert/03.jpg` | On-device happy path; screenshot per step. |
| `image-pdf` | pass | 3 | `covers/guides/image-pdf/01.jpg`, `covers/guides/image-pdf/02.jpg`, `covers/guides/image-pdf/03.jpg` | On-device happy path; screenshot per step. |
| `pdf-jpg` | pass | 3 | `covers/guides/pdf-jpg/01.jpg`, `covers/guides/pdf-jpg/02.jpg`, `covers/guides/pdf-jpg/03.jpg` | On-device happy path; screenshot per step. |
| `merge-pdf` | pass | 3 | `covers/guides/merge-pdf/01.jpg`, `covers/guides/merge-pdf/02.jpg`, `covers/guides/merge-pdf/03.jpg` | On-device happy path; screenshot per step. |
| `compress-pdf` | pass | 3 | `covers/guides/compress-pdf/01.jpg`, `covers/guides/compress-pdf/02.jpg`, `covers/guides/compress-pdf/03.jpg` | On-device happy path; screenshot per step. |
| `split-pdf` | pass | 3 | `covers/guides/split-pdf/01.jpg`, `covers/guides/split-pdf/02.jpg`, `covers/guides/split-pdf/03.jpg` | On-device happy path; screenshot per step. |
| `invoice` | pass | 4 | `covers/guides/invoice/01.jpg`, `covers/guides/invoice/02.jpg`, `covers/guides/invoice/03.jpg`, `covers/guides/invoice/04.jpg` | Filled issuer, customer, and a line item; A4 preview updated. |
| `audio` | pass | 3 | `covers/guides/audio/01.jpg`, `covers/guides/audio/02.jpg`, `covers/guides/audio/03.jpg` | On-device happy path; screenshot per step. |
| `audio-cutter` | pass | 3 | `covers/guides/audio-cutter/01.jpg`, `covers/guides/audio-cutter/02.jpg`, `covers/guides/audio-cutter/03.jpg` | On-device happy path; screenshot per step. |
| `audio-joiner` | pass | 3 | `covers/guides/audio-joiner/01.jpg`, `covers/guides/audio-joiner/02.jpg`, `covers/guides/audio-joiner/03.jpg` | On-device happy path; screenshot per step. |
| `data` | pass | 3 | `covers/guides/data/01.jpg`, `covers/guides/data/02.jpg`, `covers/guides/data/03.jpg` | On-device happy path; screenshot per step. |
| `xml-json` | pass | 3 | `covers/guides/xml-json/01.jpg`, `covers/guides/xml-json/02.jpg`, `covers/guides/xml-json/03.jpg` | Not on production yet (302). Recaptured from local Vite after the first homepage false pass. |
| `password` | pass | 3 | `covers/guides/password/01.jpg`, `covers/guides/password/02.jpg`, `covers/guides/password/03.jpg` | On-device happy path; screenshot per step. |
| `word-count` | pass | 3 | `covers/guides/word-count/01.jpg`, `covers/guides/word-count/02.jpg`, `covers/guides/word-count/03.jpg` | On-device happy path; screenshot per step. |
| `color` | pass | 3 | `covers/guides/color/01.jpg`, `covers/guides/color/02.jpg`, `covers/guides/color/03.jpg` | On-device happy path; screenshot per step. |
| `hex-rgb` | pass | 3 | `covers/guides/hex-rgb/01.jpg`, `covers/guides/hex-rgb/02.jpg`, `covers/guides/hex-rgb/03.jpg` | Not on production yet (302). Captured from local Vite. |
| `names` | pass | 3 | `covers/guides/names/01.jpg`, `covers/guides/names/02.jpg`, `covers/guides/names/03.jpg` | On-device happy path; screenshot per step. |
| `timezone` | pass | 3 | `covers/guides/timezone/01.jpg`, `covers/guides/timezone/02.jpg`, `covers/guides/timezone/03.jpg` | On-device happy path; screenshot per step. |
| `timestamp` | pass | 3 | `covers/guides/timestamp/01.jpg`, `covers/guides/timestamp/02.jpg`, `covers/guides/timestamp/03.jpg` | On-device happy path; screenshot per step. |
| `lorem` | pass | 3 | `covers/guides/lorem/01.jpg`, `covers/guides/lorem/02.jpg`, `covers/guides/lorem/03.jpg` | On-device happy path; screenshot per step. |
| `units` | pass | 3 | `covers/guides/units/01.jpg`, `covers/guides/units/02.jpg`, `covers/guides/units/03.jpg` | On-device happy path; screenshot per step. |
| `text-to-speech` | pass | 3 | `covers/guides/text-to-speech/01.jpg`, `covers/guides/text-to-speech/02.jpg`, `covers/guides/text-to-speech/03.jpg` | On-device happy path; screenshot per step. |
| `diff` | pass | 3 | `covers/guides/diff/01.jpg`, `covers/guides/diff/02.jpg`, `covers/guides/diff/03.jpg` | On-device happy path; screenshot per step. |
| `uuid` | pass | 3 | `covers/guides/uuid/01.jpg`, `covers/guides/uuid/02.jpg`, `covers/guides/uuid/03.jpg` | On-device happy path; screenshot per step. |
| `hash` | pass | 3 | `covers/guides/hash/01.jpg`, `covers/guides/hash/02.jpg`, `covers/guides/hash/03.jpg` | Not on production yet (302). Captured from local Vite. |
| `regex` | pass | 4 | `covers/guides/regex/01.jpg`, `covers/guides/regex/02.jpg`, `covers/guides/regex/03.jpg`, `covers/guides/regex/04.jpg` | On-device happy path; screenshot per step. |
| `yaml-json` | pass | 3 | `covers/guides/yaml-json/01.jpg`, `covers/guides/yaml-json/02.jpg`, `covers/guides/yaml-json/03.jpg` | Recaptured 2026-09-16. First ship used XML-to-JSON screenshots by mistake. YAML→JSON sample, richer YAML, then JSON→YAML. |
| `case` | pass | 3 | `covers/guides/case/01.jpg`, `covers/guides/case/02.jpg`, `covers/guides/case/03.jpg` | Recaptured. Title Case sample, camelCase, snake_case. |
| `jwt` | pass | 3 | `covers/guides/jwt/01.jpg`, `covers/guides/jwt/02.jpg`, `covers/guides/jwt/03.jpg` | Recaptured. Empty pad, pasted HS256 token, decoded header/payload (signature not verified). |

## GitHub layout

- Screenshots: `public/covers/guides/{tool}/01.jpg` …
- Copy: `src/locales/guides/{en,zh-CN,zh-TW,ja,ko,vi,id,es}.json`
- UI: `src/client/guide.ts` (mounted above FAQ)
- Capture harness: `scripts/capture-guides.mjs`
