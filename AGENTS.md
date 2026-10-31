# cv.cm

Browser toolkit on a Cloudflare Worker (Pages advanced mode `_worker.js`).

## Hard rules

1. Image and PDF tools (watermark, mosaic, collage, portrait-sim, convert, image-pdf, resize, crop, rotate, exif, meme, signature, favicon, screenshot, image-colors, pdf-jpg, merge-pdf, compress-pdf, split-pdf, invoice) process files in the page. Do not add upload APIs for those tools, analytics beacons, or extra third-party `connect-src` hosts. Site analytics (GA4 `G-5X2J6QT5KK`, `src/shared/analytics.ts`) skips them, the audio tools (audio, audio-cutter, audio-joiner) and clip notes: those pages get a CSP without the GA hosts and send no hits. Add new file tools to `UNTRACKED_TOOLS`.
2. Clipboard text lives in D1 (`cvcm` / binding `DB`, table `clips`). Non-text files go to s3.cv.cm bucket `files` via Worker-presigned PUT. No KV or R2.
3. The Worker serves static files, locale redirects, security headers, `/api/clip`, and `/api/clip/upload`. Reject other `POST` / `PUT` / `PATCH` / `DELETE` with 405.
4. Clipboard notes: no login; auto-delete after 10 views or 24 hours. Text max 64 KB, files max 32 MB. No listing endpoint.
5. New local tools process data with Web APIs in the page. Add a locale path, strings in `src/locales/*`, an entry in `src/shared/path.ts` `TOOLS`, and a lazy loader in `src/client/tools.ts` `TOOL_LOADERS` (never a static import in `main.ts`: each tool is its own chunk).
6. Tutorials must be minimal, complete, and illustrated (owner correction, 2026-09-13). Explain the whole task from preparation through completion with concise steps and meaningful instructional diagrams. Use captions to explain each image. Present tutorials, not exercise cards, assignments, submission requirements, or grading criteria. Keep photography first. JK/Lolita/Hanfu fashion examples use adults.
7. Design is plain pink and white, built for speed and search (owner, 2026-10-13): no decorative images, gradients, shadows or ornaments; lists are text links (`src/client/links.ts`). Covers appear only as `og:image`, never in the page. Tool-page how-tos are text (the live tool sits right above them); tutorial step diagrams and game walkthrough shots stay, lazy-loaded.
8. Every sitemap page is prerendered at build (`scripts/prerender.mjs` runs the real client in happy-dom → `dist/_ssr/<path>/index.html`). The Worker puts that markup in `#app`, so the first paint needs no JS; the client then mounts the same page off-screen and swaps it in (`render()` in `main.ts`). Keep mounts deterministic and free of network calls at mount, or the page falls back to the Worker's text copy (the prerender logs skipped pages).
9. AI tools (`ai` group in `CATEGORIES`: `remove-background`, `image-upscaler`, `speech-to-text`, `depth-map`) run models in the page with Transformers.js + ONNX Runtime Web, in one module worker (`src/client/ai/worker.ts`), WebGPU first (fp16 when the adapter has `shader-f16`), threaded WASM otherwise. Never call an inference API and never load models from a third-party host: weights are mirrored at pinned revisions to s3.cv.cm `files/ai/` (`scripts/ai/mirror.mjs`) and served same-origin at `/ai/models/` and `/ai/ort/` by the Worker (edge-cached a year; a missing file is a real 404). Add models to `src/shared/ai-models.ts` with exact byte sizes. AI pages are cross-origin isolated (COEP `credentialless`; links into or out of them load a new document) and get a CSP with `'wasm-unsafe-eval'`; only `speech-to-text` may use the microphone. Mounts must not download anything: models load on first file (small or cached ones may warm on hover).
10. Tool covers for `og:image` (`public/covers/*-sweet.jpg`, 1280×720 JPEG): generate with **Codex** using existing covers as style references (same pink twin-tail chibi, lace bonnet, cream-pink room). Do not use Grok `image_gen` for new tool covers. See `docs/tool-cover-prompts.md`.

## Layout

- `src/worker.ts` — edge Worker
- `src/clip-api.ts` / `src/clip-store.ts` — clipboard API + D1
- `migrations/` — D1 schema
- `src/client/` — SPA (`main.ts` shell + router, `tools.ts` lazy tool loaders, `links.ts` text link lists)
- `scripts/prerender.mjs` / `scripts/prerender.ts` — build-time page bodies for the Worker
- `src/client/clip/` — cloud clipboard
- `src/client/watermark/` — ID Watermark & Redact (身份证水印打码): image watermark + drag-to-redact (mosaic / black box). `/mosaic/` mounts the same UI in redact mode. Brand icon `public/brand/safemark.svg`; Zhihu kit `docs/zhihu-ai-works/id-watermark/`
- `src/client/collage/` — photo collage
- `src/client/portrait-sim/` — portrait camera simulator
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
- `src/client/yaml-json/` — YAML ↔ JSON converter
- `src/client/hash/` — MD5 / SHA hash generator
- `src/client/case/` — case converter
- `src/client/jwt/` — JWT decoder (no signature verify)
- `src/client/screenshot/` — annotate a screenshot
- `src/client/percent/` — percentage calculator
- `src/client/random/` — random number generator
- `src/client/html/` — HTML encode / decode
- `src/client/cron/` — cron expression explainer
- `src/client/slug/` — URL slug generator
- `src/client/age/` — age calculator
- `src/client/bmi/` — BMI calculator
- `src/client/binary/` — text to binary
- `src/client/tip/` — tip calculator
- `src/client/morse/` — Morse code
- `src/client/roman/` — Roman numerals
- `src/client/discount/` — discount calculator
- `src/client/countdown/` — countdown timer
- `src/client/loan/` — loan payment calculator
- `src/client/stopwatch/` — elapsed stopwatch
- `src/client/compound/` — compound interest
- `src/client/vat/` — VAT / sales tax
- `src/client/reverse/` — reverse text / palindrome
- `src/client/url-encode/` — URL encode / decode
- `src/client/text-hex/` — text ↔ hex
- `src/client/json/` — JSON pretty / minify
- `src/client/base64/` — Base64 encode / decode
- `src/client/days/` — days between dates
- `src/client/sort/` — sort lines / unique
- `src/client/replace/` — find and replace
- `src/client/words/` — number to English words
- `src/client/add-days/` — add / subtract days from a date
- `src/client/week/` — ISO week number
- `src/client/aspect/` — aspect ratio from width and height
- `src/client/workdays/` — Monday–Friday count between two dates (weekends only, not holidays)
- `src/client/fraction/` — simplify a fraction or convert a decimal
- `src/client/hourly/` — hourly wage ↔ yearly gross pay (no tax)
- `src/client/margin/` — profit margin and markup from cost and price
- `src/client/radix/` — integer base converter, bases 2–36
- `src/client/duration/` — add or subtract H:MM:SS durations
- `src/client/tdee/` — BMR (Mifflin–St Jeor) and TDEE, metric / imperial, maintain / cut / bulk (not medical advice)
- `src/client/cidr/` — IPv4 subnet calculator and IP range → CIDR list
- `src/client/chmod/` — Unix permissions: checkboxes ↔ octal ↔ rwx, special bits, chmod command
- `src/client/typing/` — typing speed test (net WPM; CJK locales count correct characters per minute). Passages in `src/shared/typing-passages.ts`; results stay in the page
- `src/client/dice/` — dice roller (d4–d100) and coin flip
- `src/client/gpa/` — GPA calculator, 4.0 scale weighted by credits
- `src/client/pomodoro/` — Pomodoro timer with breaks and a chime
- `src/client/sleep/` — sleep calculator: bedtimes or wake-up times by 90-minute cycles plus 14 minutes to fall asleep
- `src/client/body-fat/` — body fat calculator, U.S. Navy circumference method, ACE categories, metric / imperial (not medical advice)
- `src/client/contrast/` — WCAG 2 color contrast checker (AA / AAA, normal / large text, non-text) with a passing text-color suggestion
- `src/client/pace/` — running pace calculator: pace, time or distance, km / mi, 5K–marathon predictions
- `src/client/grade/` — final grade calculator: score needed on the final, table per letter
- `src/client/due-date/` — pregnancy due date (Naegele's rule, cycle-length shift) from LMP, conception or due date; weeks along is `data-volatile` (not medical advice)
- `src/client/ideal-weight/` — ideal weight: Devine / Robinson / Miller / Hamwi + BMI 18.5–24.9 range, metric / imperial
- `src/client/water-intake/` — daily water estimate: 35 ml/kg + exercise + hot climate, in litres and 250 ml glasses
- `src/client/fuel-cost/` — trip fuel cost: L/100km, km/L or US mpg, price per litre or gallon, round trip, split by people
- `src/client/reading-time/` — reading and speaking time for a text; CJK counted in characters
- `src/client/time-card/` — weekly time card: shifts with breaks and overnight ends, overtime above a weekly threshold, optional pay; results are `data-volatile` (time inputs are blank in prerender)
- `src/client/electricity/` — appliance electricity cost: watts × hours × days × price per kWh, presets, per day / year
- `src/client/ovulation/` — ovulation and fertile window for the next three cycles (luteal phase 14 days); dates are `data-volatile` (not medical advice)
- `src/client/macro/` — macronutrient grams from a calorie target, goal and split (links to TDEE)
- `src/client/calories-burned/` — calories burned by activity from MET values (2011 Compendium) × kg × hours, with a comparison list
- `src/client/wheel/` — spin the wheel: one entry per line, Web Crypto draw before the SVG wheel spins, remove winner, shuffle/sort, history
- `src/client/average/` — mean, median, mode, sum, range, sample/population SD and variance, geometric mean of a pasted list
- `src/client/metronome/` — Web Audio lookahead metronome 20–300 BPM, beats per bar, subdivisions, accent, tap tempo
- `src/client/keyboard-test/` — keyboard map by event.code (104 keys), key/code/keyCode/location, rollover count
- `src/client/zodiac/` — star sign + Chinese zodiac by birthday; Lunar New Year from Intl `ca-chinese`, sign and animal-year tables
- `src/client/resize/` — resize / compress images
- `src/client/crop/` — crop images
- `src/client/rotate/` — rotate / flip images
- `src/client/exif/` — strip photo EXIF / GPS metadata
- `src/client/image-colors/` — dominant color palette from a local image (median cut + k-means), copy HEX
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
- `src/client/ai/` — shared AI runtime: `worker.ts` (all inference), `client.ts` (job RPC, backend guess, cache check), `kit.ts` (model line, progress, GPU→CPU retry, drop zone), `zh.ts` (Traditional ↔ Simplified for transcripts)
- `src/client/remove-background/` — AI background remover (BiRefNet lite, batch, ZIP)
- `src/client/image-upscaler/` — AI image upscaler (Real-ESRGAN compact, 2× / 4×, photo / anime)
- `src/client/speech-to-text/` — speech to text (Whisper base / small, auto language, mic, TXT / SRT / VTT)
- `src/client/depth-map/` — depth map generator (Depth Anything V2 small)
- `scripts/ai/` — model pipeline: `export-birefnet.py` (native DeformConv re-export + fp16), `export-realesrgan.py`, `mirror.mjs` (stage + upload to `files/ai/`), `gen-zh-chars.py`
- `src/client/guide.ts` — text how-to above FAQ
- `src/locales/guides/` — 8-locale how-to copy
- `public/covers/` — tool/game/learn images (`og:image`, tutorial diagrams); `/thumbs/` URLs from older builds redirect to the originals; production serves them from S3 (`s3.cv.cm/files/covers/`) via Worker `/covers/`. Keep copies in git for local Vite. Favicons stay on Pages (`/favicon.svg`, `/favicon-*.png`)
- `src/client/learn/` — minimal, complete illustrated tutorials
- `src/client/kb/` + `src/shared/kb.ts` / `kb-i18n.ts` — knowledge articles, a sub-column of tutorials (`/{locale}/learn/knowledge/{id}/`): answer-first explanations of formats, encodings, time and money math. `kb.ts` holds ids, groups, dates, related tools/tutorials and primary sources (standards, official docs; check every URL). Hub copy is in `src/locales/kb/<locale>.json`; each article is `src/locales/kb/<locale>/<id>.json` and loads as its own chunk (blocks are paragraphs, `ul`/`ol`, `table`, `note`; backticks are the only inline markup); names/blurbs in the core packs under `kb.*`. One HTML builder (`kbPageHtml`) serves both the client and the Worker. JSON-LD: TechArticle + BreadcrumbList + FAQPage. **After editing any article copy or its sources, run `npm run kb:sync`**: per locale it moves the "Updated" date (dateModified) to today only where the copy changed (a source change dates every locale), recomputes reading times, and regenerates `src/locales/kb/meta.json` (fingerprints), `meta.ts` (dates/minutes the pages read), `all.ts` (Worker/tests) and `loaders.ts` (client chunks). After re-checking facts with no edit: `npm run kb:sync -- --touch <id>`. `tests/kb.test.ts` fails if copy or sources changed without the sync. No thin or unsourced filler.
- Coding shelf of the same kb system (`/{locale}/learn/code/{id}/`, hub `/learn/code/`): programming languages, design patterns, data structures, algorithms. Ids, groups and meta are in `src/shared/kb-code.ts` (`tools` may be empty); hub copy is `codeHub` in `src/locales/kb/<locale>.json`; core packs hold `kb.code.*` labels and `kb.<id>` names (language names stay English in every locale). Articles add a `{ code, lang }` block: a multi-line sample, escaped whole, never translated (tests require identical code in every locale). A kb page is `KbPage` = article id, `"hub"` (knowledge hub) or `"code"` (coding hub); `kbHref(locale, page)` picks the shelf segment.
- `src/client/device/` — device column (`/{locale}/device/`, IP via `GET /api/device/ip`, not stored)
- `src/client/quiz/` + `src/shared/quiz.ts` — tests column (`/{locale}/tests/{id}/`: MBTI-style, Big Five, introvert/extrovert (IPIP), Enneagram, love language, attachment, marriage, conflict style, career, work style, money, chronotype, pet match, anime, face shape, Rosenberg, GAD-7, PHQ-9, and unofficial game/anime fan quizzes: Pokémon type, Genshin Vision, Sonic, D&D class, Naruto, Demon Slayer breathing, Jujutsu Kaisen, Avatar element). Scoring is in the page; answers are never sent or stored. `quiz.ts` holds item keys and result rules; copy is in `src/locales/quiz/<locale>.json` (items in the same order, loaded only on test pages); names/blurbs in the core packs under `quiz.*`. PHQ-9 item 9 above zero always shows the help box. Fan quizzes are text only (no franchise art or logos), say they are unofficial in `about`, give every result the same best score and use `tie: "spread"` (ties settled by a hash of the answers, not list order). Code says quiz, URLs say tests.
- `src/client/games/` — retro emulator games (`/{locale}/games/{console}/{id}/`)
- Asset tools are the `assets` group in `CATEGORIES`: `gold`, `silver`, `platinum`, `palladium`, `oil`, `stocks` (`/{locale}/{id}/`). No live quotes. Old `/markets/{gold|silver|stocks}/` URLs 301 to those tools. Covers live on S3 at `files/covers/{id}-sweet.jpg`.
- `src/client/datasets/` — public data column (`/{locale}/datasets/{id}/`; `/data/` is the JSON/CSV tool). Rows are snapshots in `src/data/*.json` plus CSVs in `public/datasets/`, both written by `node scripts/fetch-datasets.mjs` (World Bank WDI CC BY 4.0, datahub ISO lists, IANA tz). Refresh by rerunning it and committing; pages never call source APIs. Catalog in `src/shared/datasets.ts`, copy in `src/locales/datasets/`, table/JSON-LD (Dataset, FAQ, breadcrumb) in `src/shared/datasets-i18n.ts`. Country, currency and zone names come from `Intl`, so data files stay language-neutral.
- `src/shared/games.ts` — console + genre catalog, including `flash`. Commercial ROMs and commercial SWFs are not hosted. Redistributable homebrew (Shiru freeware and open-source NES/SFC/MD/GB/GBC/GBA ROMs) is on S3 (`files/games/roms`); a GPL game's source zip goes next to it under `files/games/src` and is linked on its page. EmulatorJS cores on S3 (`files/games/emu`), proxied at `/emu/assets/`. Flash uses Ruffle (`/emu/flash`, runtime at `/emu/assets/ruffle/`). A missing ROM or SWF shows an in-player prompt to upload a local file.
- `src/locales/games/` — per-game SEO copy (cheats, walkthrough, FAQ)
- `src/shared/path.ts` — `CATEGORIES`, `TOOLS`, `TUTORIALS`, games (`/{locale}/learn/{id}/`, `/{locale}/games/`; locale paths lowercase: `zh-cn` `zh-tw`)
- `src/shared/md.ts` — markdown/html render + highlight
- `src/s3-sign.ts` — SigV4 presign for s3.cv.cm
- `src/locales/` — `en` first, then `zh-CN` `zh-TW` `ja` `ko` `vi` `id` `es` (tool how-tos in `guides/`)
- `src/shared/` — locale, path, zip, filenames (used by Worker and tests)
- `public/sitemap.xml` — index of `public/sitemaps/{pages,learn,games,tests,datasets}.xml` (from `src/shared/sitemap.ts`; `npm run build` regenerates them). `<lastmod>` only where a real edit date exists (knowledge pages, data tables). Sections are `SITEMAP_SECTIONS` in `path.ts`

## Deploy

The Cloudflare API token in use has **Pages + DNS + D1**. Ship with:

```
npm run build
npx wrangler d1 migrations apply cvcm --remote
npx wrangler pages deploy dist --project-name cvcm
```

`dist/_worker.js` is the Worker. Domain: `cv.cm`. D1 database id: `1a809cf5-bb42-4f8d-b2c6-6cd7430226c5`.
