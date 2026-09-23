# Tutorial keyword plan

Pulled 2026-09-16 from Google Ads Keyword Planner API (`customers:generateKeywordIdeas` v23) on MCC **馒头饭 `7007031245`** (ENABLED). Delivery account `9132676642` is CANCELED and cannot be queried.

The old UI URL `ads.google.com/aw/keywordplanner` 404s. The API still works. Seven seed batches (US English, Taiwan zh-TW, HK+SG zh) returned **29,626** unique ideas. Near-duplicate Planner clusters share a volume; numbers below are cluster volumes, not summed variants.

**Codex(High) reviewed this plan (2026-09-16).** Adopted: keep legacy lesson IDs for 301s; reorder by how-to evidence; treat how-to vs tool SERP as a hypothesis to check; open the tool when the reader starts doing the job; label Planner competition as **ad** competition. Research backlog added for collage / meme / word-count / audio-cutter.

Tutorials are **not** a second tools directory. Tool pages already target job queries (`qr code generator`, `merge pdf`, `heic to jpg`). Lessons should try to win **how-to** queries, then send the reader into the matching tool **as soon as the file work starts**. Whether “how to merge pdf” is a separate SERP from the merger tool is a hypothesis: spot-check the SERP before writing, and give the lesson preparation, choices, failure modes, and a verified export — not a restatement of the tool UI.

## Do not write

- Remove-watermark / 去水印 (high volume, wrong product, often piracy).
- Adobe / Photoshop / Canva / Acrobat branded titles.
- Competitor brands as the lesson (iLovePDF, Smallpdf, 草料).
- Old unpublished topics as new content: badminton, pool safety, healthy boundaries, read-character, 90-minute algorithm course.
- A second QR-generator **tool** page. The tool exists. Write the how-to if the SERP is instructional; link the tool.

## URL rules (legacy vs new)

`parseAppPath()` only treats `/{locale}/learn/{id}/` as a lesson when `{id}` stays in `TUTORIALS`. Do **not** delete unpublished IDs.

| Old id | After rewrite |
|---|---|
| `phone-photos`, `window-light`, `crop-compose`, `portrait` | Stay in `TUTORIALS`. 301 to hub until a real successor ships. `crop-photo` is a **new** slug, not a rename of `crop-compose`. |
| `algorithms`, `one-page-site` | Stay in `TUTORIALS`. 301 to hub. No HEIC/PDF successor. |
| `badminton-warmup`, `badminton-rules`, `pool-safety`, `healthy-boundaries`, `read-character` | Stay in `TUTORIALS`. 301 to **hub only**. Do not map them onto unrelated new lessons. |

New slugs are **additive**. Hub `TUTORIAL_GROUPS` lists only published new ids.

## First batch (ship)

Each row is one lesson. Title is the query to rank. Volume is US/EN unless noted. **Ad comp** is Planner advertiser competition, not organic difficulty.

How-to volume is the primary sort. Job volume is supporting demand for the same task. Four rows still lack a dedicated how-to cluster from this pull; they stay only where the job is huge and the tool already exists — and they need a SERP check before writing.

| # | Lesson query | How-to vol | Job vol | Ad comp | Tool | Notes |
|---|---|---:|---:|---|---|---|
| 1 | How to make a QR code | 33,100–60,500 | 823,000 (`qr code generator`) | MED | `qr` | SERP-check vs the generator page. |
| 2 | How to make a barcode | 9,900 | 450,000 (`barcode generator`) | LOW | `barcode` | Promoted: how-to vol beats crop. After QR. |
| 3 | How to merge PDF files | 27,100 | 165,000 / 135,000 (`merge pdf` / `combine pdf`) | LOW–MED | `merge-pdf` | Highest how-to that maps 1:1 besides codes. |
| 4 | How to compress a PDF / reduce PDF size | 27,100 | 135,000 (`compress pdf`) | MED | `compress-pdf` | Same sitting as merge; email/upload limits. |
| 5 | How to convert HEIC to JPG | 12,100 | 246,000 (`heic to jpg`) | LOW | `convert` | iPhone default format. Confirm HEIC decode in the tool before publishing. |
| 6 | How to convert JPG (or images) to PDF | — | 201,000 (`jpg to pdf`) / 18,100 (`image to pdf`) | LOW–MED | `image-pdf` | Needs how-to SERP check. |
| 7 | How to convert PDF to JPG | — | 165,000 (`pdf to jpg` cluster) | MED | `pdf-jpg` | Inverse of #6; same sitting pair. |
| 8 | How to crop a photo (iPhone / 1:1 / 4:5) | 4,400–6,600 | 33,100 (`crop image`) | LOW | `crop` | Skip Photoshop / circle-crop as the title. |

Chinese copies of 1–8 ship in the same PR. Google zh volume is **10–390** (mainland is not on Google). That is not a veto. Distill 小红书 / 抖音 / 知乎 / 百度 for the same jobs. If CN research confirms 店主加水印, insert **how to add a watermark** into the Chinese first wave even while EN watermark stays batch two.

## Second batch

| Lesson query | Vol | Tool | Note |
|---|---:|---|---|
| How to convert WebP to PNG | 165,000 job | `convert` | Demoted: no how-to cluster in this pull; same tool as HEIC. |
| How to resize or compress an image | 60,500 / 27,100 job | `resize` | Distinct from PDF compress. |
| How to split a PDF | 40,500 job | `split-pdf` | After merge/compress. |
| How to add a watermark to a photo | 2,900 how-to; 1,000–5,400 job | `watermark` | Google is small; CN shop-owner job may ship earlier in zh. |
| How to remove EXIF / location from a photo | 1,300 | `exif` | Privacy how-to, not a volume play. |

## Research backlog (not yet pulled)

Measure how-to volume and SERP intent before ranking. Tools exist; this pull did not seed them:

- Photo collage → `collage`
- Make a meme → `meme`
- Count words / characters → `word-count`
- Trim audio → `audio-cutter`

## Writing rules

1. One search job per lesson. Title ≈ the query.
2. As many steps as the task needs. Do not pad to five. One action + one check per step.
3. Distill: 知乎 for why it fails; 小红书 / 抖音 for the tap sequence. Do not paste a transcript.
4. Codex draws covers (existing chibi style) and one diagram per decision (HEIC vs JPG, merge order, QR contents, 1:1 vs 4:5). Caption what the picture is for.
5. Open the cv.cm tool when execution starts, not only at the end. End with download **and** verification (open the file, check size / pages / scan).
6. FAQ on the lesson answers Planner variants (`free`, `online`, `iPhone`, `without Adobe`).
7. Before drafting, open the how-to query and the job query. If the SERP is already 80% tools, strengthen the lesson’s unique steps or drop it.

## New slugs (additive)

- `make-qr`
- `make-barcode`
- `merge-pdf`
- `compress-pdf`
- `heic-to-jpg`
- `jpg-to-pdf`
- `pdf-to-jpg`
- `crop-photo`
- `webp-to-png`
- `resize-image`
- `split-pdf`
- `add-watermark`
- `remove-exif`
- `make-collage`
- `make-meme`
- `count-words`
- `trim-audio`
- `png-to-jpg`
- `jpg-to-png`
- `avif-to-jpg`
- `rotate-photo`
- `png-to-webp`
- `mp3-to-wav`
- `join-audio`
- `make-favicon`
- `make-signature`
- `annotate-screenshot`
- `make-invoice`
- `make-password`
- `format-json`
- `decode-base64`
- `unix-time`
- `read-jwt`
- `count-workdays`
- `simplify-fraction`
- `hourly-pay`
- `convert-timezone`
- `profit-margin`
- `convert-base`
- `add-duration`
- `calculate-percent`
- `days-between`
- `shift-date`
- `iso-week`
- `vat-price`

## Fourth batch (ship)

Same dump as the first pull (`~/.grok/tmp/cvcm-keyword-ideas.json`, convert seed). How-to clusters were thin; job volume is the ranking signal. Rotate was not in that seed — it ships as the missing photo-edit sibling of crop/resize.

| Lesson query | Job vol | Tool | Notes |
|---|---:|---|---|
| How to convert PNG to JPG | 60,500 (`png to jpg`) | `convert` | Distinct from HEIC/WebP: size vs alpha. JPG fills a clear PNG, often black. |
| How to convert JPG to PNG | 49,500 (`jpg to png`) | `convert` | Myth: PNG will not invent transparency. File usually grows. |
| How to convert AVIF to JPG | 33,100 (`avif to jpg`) | `convert` | Chrome/new sites save AVIF; older Windows/print/chat want JPG. |
| How to rotate or flip a photo | — (not seeded) | `rotate` | 90° vs mirror flip; export bakes pixels so EXIF-only sideways photos stand up. |

## Fifth batch (ship)

PNG→WebP is the last convert cluster with job volume in this dump. Audio convert/join and favicon were not seeded; they ship as companions to trim-audio and the photo tools.

| Lesson query | Job vol | Tool | Notes |
|---|---:|---|---|
| How to convert PNG to WebP | 14,800 (`png to webp`) | `convert` | Smaller than PNG; can keep alpha (JPG cannot). Old forms may still want PNG. |
| How to convert MP3 to WAV | — (not seeded) | `audio` | Tool money page is MP3 to WAV. WAV does not restore MP3 losses. 44.1 vs 48. |
| How to join audio files / merge MP3s | — (not seeded) | `audio-joiner` | Two or more clips; list order; later clips resample to the first clip's rate; WAV out. |
| How to make a favicon | — (not seeded) | `favicon` | Cover vs Contain; ICO 16/32/48; PNG zip 180/192/512; check the 16px file. |

## Sixth batch (ship)

Signature, screenshot, invoice, and password were not in the convert seed. They ship as photo / files / text jobs with failure modes the tool pages do not teach.

| Lesson query | Job vol | Tool | Notes |
|---|---:|---|---|
| How to draw a signature PNG | 110 how-to (photo); skip e-sign PDF as the title | `signature` | Picture of a name, not a legal e-sign, not a PDF stamp. Export crops to ink with a clear background. |
| How to annotate a screenshot | — (not seeded) | `screenshot` | Rect / arrow / two-word label. PNG out. Original stays unmarked. Check at chat size. |
| How to make an invoice PDF | — (not seeded) | `invoice` | Line amount is qty × price. Tax is a percent of the subtotal. Not a VAT return. |
| How to generate a strong password | — (not seeded) | `password` | Length 16+. Exclude 0 O I l 1. Copy once into one account. Do not email. Close the tab. |

## Seventh batch (ship)

These four were not in the convert-seed dump. They ship because each tool has a failure mode the tool page states in one line and the lesson walks through.

| Lesson query | Tool | Notes |
|---|---|---|
| How to format JSON | `json` | Pretty is two-space indent. Minify is one line. Comments, trailing commas, and single quotes fail `JSON.parse`. Integers longer than 15 digits belong in quotes. |
| How to decode Base64 | `base64` | Standard alphabet `+` `/` and `=` padding. URL-safe `-` `_` is refused. Decode is fatal UTF-8, so a PNG or PDF fails on purpose. |
| How to convert a Unix timestamp | `timestamp` | 10 digits are seconds, 13 are milliseconds, 16 are microseconds divided by 1,000 once. A wild year means the digits were wrong. ISO dates and Now also work. |
| How to read a JWT | `jwt` | Header and payload only. `alg` is a label. Expired compares `exp` (seconds) with the clock. The signature stays unchecked. |

## Eighth batch (ship)

Workdays, fraction, and hourly shipped as tools on `44e342e`. Time zone was already live. These lessons teach the traps the tool pages state in one FAQ line.

| Lesson query | Tool | Notes |
|---|---|---|
| How to count business days | `workdays` | Inclusive Monday–Friday. Holidays stay in the count. End before start makes the business-day number negative; weekend days stay zero or positive. |
| How to simplify a fraction | `fraction` | 4/6 becomes 2/3. Sign stays on the numerator. Decimals use a continued fraction capped at denominator 10,000. Results stay improper, not mixed numbers. |
| How to convert hourly pay to a yearly salary | `hourly` | One rate. Default 40 × 52 = 2,080 hours. 20/hour is 41,600.00 gross. Tax and a second overtime rate stay outside. |
| How to convert a time zone | `timezone` | Source is the zone that owns the given clock. IANA offset follows the date. Copy is the UTC instant. Do not add the offset twice. |

## Ninth batch (ship)

Margin, radix, and duration shipped as tools on `6d78aec`. Percentage was already live. These lessons separate the numbers people mix up.

| Lesson query | Tool | Notes |
|---|---|---|
| How to calculate a profit margin | `margin` | Margin is profit / price. Markup is profit / cost. Cost 50 and price 80 is 37.50% and 60.00%. A zero price drops margin; a zero cost drops markup. |
| How to convert a number between bases | `radix` | Bases 2–36. 255 decimal is FF hex, uppercase. No 0x, 0b, or decimal point. A digit must exist in the source base. |
| How to add hours and minutes | `duration` | H:MM:SS. 1:30:00 + 0:45:00 = 2:15:00. Minutes and seconds must be 0–59. A longer second length gives a minus. This is a length, not a clock or a time zone. |
| How to calculate a percentage | `percent` | The same two numbers produce four lines. 25% of 200 is 50. 25 is 12.5% of 200. 200 + 25% is 250. 200 → 25 is −87.5%. |

## Tenth batch (ship)

Day difference, date shift, and ISO week were already live next to business days. VAT was already live next to percent and margin. The lessons separate counts people mix.

| Lesson query | Tool | Notes |
|---|---|---|
| How to count days between two dates | `days` | Signed gap, not both ends. Mon 5 Jan 2026 to Fri 9 Jan is 4. Same span is 5 inclusive business days. 28 Feb 2024 to 1 Mar 2024 is 2. Whole weeks drop the leftover. |
| How to add days to a date | `add-days` | Whole days only. 28 Feb 2024 + 1 is 29 Feb 2024. Friday + 1 is Saturday. |
| How to find the ISO week number | `week` | Monday is 1, Sunday is 7. Week 1 holds the first Thursday. 1 Jan 2021 is 2020-W53. 30 Dec 2024 is 2025-W01. |
| How to add VAT to a price | `vat` | Exclusive 100 at 20% is tax 20.00 and gross 120.00. Inclusive 120 at 20% is tax 20.00, not 24.00. The rate is typed, not looked up. |

## Evidence notes

- Planner clusters many paraphrases onto one volume (`how to make a qr code` = `how to produce a qr code` = 33,100). Do not sum them.
- `adobe *` variants are large. Do not title a cv.cm lesson after Adobe.
- `pastebin` is 33,100 — a **tool** SEO job, not a tutorial.
- `circle crop image` 5,400 is real but narrower than 1:1 / 4:5 / iPhone crop.
- `convert` must actually decode HEIC in-page before the HEIC lesson ships.
