# cv.cm

Browser toolkit on a Cloudflare Worker (Pages advanced mode `_worker.js`).

## Hard rules

1. Image and PDF tools (watermark, collage, convert, image-pdf, resize, crop, rotate, exif, meme, signature, favicon, pdf-jpg, merge-pdf, compress-pdf, split-pdf, invoice) process files in the page. Do not add upload APIs for those tools, analytics beacons, or extra third-party `connect-src` hosts.
2. Clipboard text lives in D1 (`cvcm` / binding `DB`, table `clips`). Non-text files go to s3.cv.cm bucket `files` via Worker-presigned PUT. No KV or R2.
3. The Worker serves static files, locale redirects, security headers, `/api/clip`, and `/api/clip/upload`. Reject other `POST` / `PUT` / `PATCH` / `DELETE` with 405.
4. Clipboard notes: no login; auto-delete after 10 views or 24 hours. Text max 64 KB, files max 32 MB. No listing endpoint.
5. New local tools process data with Web APIs in the page. Add a locale path, strings in `src/locales/*`, and an entry in `src/shared/path.ts` `TOOLS`.
6. Tutorials must be minimal, complete, and illustrated (owner correction, 2026-09-13). Explain the whole task from preparation through completion with concise steps and meaningful instructional diagrams. Use captions to explain each image. Present tutorials, not exercise cards, assignments, submission requirements, or grading criteria. Keep photography first. JK/Lolita/Hanfu fashion examples use adults.
7. Tool covers (`public/covers/*-sweet.jpg`, 1280×720 JPEG): generate with **Codex** using existing covers as style references (same pink twin-tail chibi, lace bonnet, cream-pink room). Do not use Grok `image_gen` for new tool covers. See `docs/tool-cover-prompts.md`.

## Layout

- `src/worker.ts` — edge Worker
- `src/clip-api.ts` / `src/clip-store.ts` — clipboard API + D1
- `migrations/` — D1 schema
- `src/client/` — SPA
- `src/client/clip/` — cloud clipboard
- `src/client/watermark/` — image watermark
- `src/client/collage/` — photo collage
- `src/client/convert/` — image formats (PNG / JPG / WebP / AVIF / GIF / BMP / ICO)
- `src/client/image-pdf/` — images to PDF
- `src/client/audio/` — audio to WAV
- `src/client/audio-cutter/` — trim audio to WAV
- `src/client/audio-joiner/` — join audio clips to WAV
- `src/client/data/` — JSON / CSV / Base64 / Markdown
- `src/client/qr/` — QR code generator
- `src/client/barcode/` — barcode generator (Code 128, Code 39, EAN-13)
- `src/client/password/` — password generator
- `src/client/word-count/` — word / character counter
- `src/client/color/` — color picker
- `src/client/hex-rgb/` — hex / RGB / HSL / CMYK converter
- `src/client/xml-json/` — XML ↔ JSON converter
- `src/client/hash/` — MD5 / SHA hash generator
- `src/client/resize/` — resize / compress images
- `src/client/crop/` — crop images
- `src/client/rotate/` — rotate / flip images
- `src/client/exif/` — strip photo EXIF / GPS metadata
- `src/client/meme/` — meme generator (top/bottom captions)
- `src/client/signature/` — signature pad (PNG, not a legal e-sign)
- `src/client/favicon/` — favicon ICO / PNG generator
- `src/client/pdf-jpg/` — PDF to JPG / PNG / WebP
- `src/client/merge-pdf/` — merge PDFs
- `src/client/compress-pdf/` — compress PDF by re-encoding pages
- `src/client/split-pdf/` — split PDF by page or range
- `src/client/invoice/` — invoice PDF generator
- `src/client/names/` — name and username generator
- `src/client/timezone/` — time zone converter
- `src/client/timestamp/` — Unix timestamp converter
- `src/client/lorem/` — lorem ipsum generator
- `src/client/units/` — unit converter
- `src/client/tts/` — text to speech (browser SpeechSynthesis)
- `src/client/diff/` — text diff checker
- `src/client/uuid/` — UUID v4 generator
- `src/client/regex/` — regex tester
- `src/client/learn/` — minimal, complete illustrated tutorials
- `src/shared/path.ts` — `CATEGORIES`, `TOOLS`, `TUTORIALS` (`/{locale}/learn/{id}/`; locale paths lowercase: `zh-cn` `zh-tw`)
- `src/shared/md.ts` — markdown/html render + highlight
- `src/s3-sign.ts` — SigV4 presign for s3.cv.cm
- `src/locales/` — `en` first, then `zh-CN` `zh-TW` `ja` `ko` `vi` `id` `es`
- `src/shared/` — locale, path, zip, filenames (used by Worker and tests)

## Deploy

The Cloudflare API token in use has **Pages + DNS + D1**. Ship with:

```
npm run build
npx wrangler d1 migrations apply cvcm --remote
npx wrangler pages deploy dist --project-name cvcm
```

`dist/_worker.js` is the Worker. Domain: `cv.cm`. D1 database id: `1a809cf5-bb42-4f8d-b2c6-6cd7430226c5`.
