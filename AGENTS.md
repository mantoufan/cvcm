# cv.cm

Browser toolkit on a Cloudflare Worker (Pages advanced mode `_worker.js`).

## Hard rules

1. Image tools (watermark, collage, convert, image-pdf) process files in the page. Do not add upload APIs for those tools, analytics beacons, or extra third-party `connect-src` hosts.
2. Clipboard text lives in D1 (`cvcm` / binding `DB`, table `clips`). Non-text files go to s3.cv.cm bucket `files` via Worker-presigned PUT. No KV or R2.
3. The Worker serves static files, locale redirects, security headers, `/api/clip`, and `/api/clip/upload`. Reject other `POST` / `PUT` / `PATCH` / `DELETE` with 405.
4. Clipboard notes: no login; auto-delete after 10 views or 24 hours. Text max 64 KB, files max 32 MB. No listing endpoint.
5. New local tools process data with Web APIs in the page. Add a locale path, strings in `src/locales/*`, and an entry in `src/shared/path.ts` `TOOLS`.

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
- `src/client/data/` — JSON / CSV / Base64 / Markdown
- `src/client/qr/` — QR code generator
- `src/client/password/` — password generator
- `src/client/word-count/` — word / character counter
- `src/shared/path.ts` — `CATEGORIES` (share, image, convert, text) and `TOOLS`
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
