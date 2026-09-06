# cv.cm

Browser-local toolkit. Cloudflare Worker (deployed as Pages advanced mode `_worker.js`). No database.

## Hard rules

1. User files never leave the browser. Do not add upload APIs, analytics beacons, or third-party `connect-src` hosts.
2. The Worker must reject `POST` / `PUT` / `PATCH` / `DELETE` with 405. It only serves static files, locale redirects, and security headers.
3. No D1, KV, R2, or other storage for user content.
4. New tools process data with Web APIs in the page (canvas, WebCodecs, etc.). Add a locale path, strings in `src/locales/*`, and an entry in `src/shared/path.ts` `TOOLS`.

## Layout

- `src/worker.ts` — edge Worker
- `src/client/` — SPA
- `src/client/watermark/` — image watermark
- `src/client/collage/` — photo collage
- `src/locales/` — `en` first, then `zh-CN` `zh-TW` `ja` `ko`. UI language still follows the browser / cookie.
- `src/shared/` — locale, path, zip, filenames (used by Worker and tests)

## Deploy

The Cloudflare API token in use has **Pages + DNS**, not Workers Scripts. Ship with:

```
npm run build
npx wrangler pages deploy dist --project-name cvcm
```

`dist/_worker.js` is the Worker. Domain: `cv.cm`.
