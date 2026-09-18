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

## Evidence notes

- Planner clusters many paraphrases onto one volume (`how to make a qr code` = `how to produce a qr code` = 33,100). Do not sum them.
- `adobe *` variants are large. Do not title a cv.cm lesson after Adobe.
- `pastebin` is 33,100 — a **tool** SEO job, not a tutorial.
- `circle crop image` 5,400 is real but narrower than 1:1 / 4:5 / iPhone crop.
- `convert` must actually decode HEIC in-page before the HEIC lesson ships.
