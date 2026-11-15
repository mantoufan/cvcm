# Search demand: from "no result" to a new page

The header search records queries that found nothing (`search_misses` in D1) and, when a visitor asks, an email to tell once the page exists (`search_requests`). This is the loop for turning those queries into content.

## 1. Pull the list (weekly, or when the table has ~50 queries)

```
npm run search:demand -- --days 30 --min 1 --json tmp-verify/search-demand.json
```

Sorted by pending emails, then distinct visitors (one visitor counts once a day). The `answered now` column shows queries that the current checkout already answers: a page was added or renamed since, so they need no work (run `search:notify` for them).

## 2. Group, then score each group

Merge spellings and languages first (去水印 / remove watermark / 浮水印去除 → one topic). Then score each topic:

| Signal | How to check | Weight |
|---|---|---|
| On-site demand | distinct visitors + emails from step 1 (an email ≈ 3 visitors) | high: it is our own audience |
| Search volume | Google Ads Keyword Planner (MCC 7007031245, ≤20 seeds per call) for the locales that asked; Bing/ChatGPT matter more than Google for cv.cm (GA4: China 47.6 %, Google 1.3 %), so KP is a floor, not the verdict | high |
| Intent fits a page we can build | tool that runs in the page, tutorial, knowledge article, test, data table, ranking, reference or meme entry | must pass |
| Allowed by AGENTS.md | no uploads for file tools, no inference APIs, no unlicensed data (PassMark, DXOMARK, Artificial Analysis, Forbes …), no copyrighted ROMs or art, no politics/explicit content | must pass |
| Competition | SERP for the main keyword: can a fast, ad-free, 8-language page compete? Forum/aggregator results = room; ten polished tools = only with a clear angle | medium |
| Cluster value | the page links into existing tools/tutorials, or opens a group (e.g. one PDF tool → a PDF series) | medium |

Verdict per topic: **build** (passes both musts, real demand on either side), **map** (we already have it under another name: add the term to the page title/description or an FAQ so search and Google both find it), **skip** (fails a must, e.g. "remove watermark" from others' photos), or **wait** (one visitor, no volume: keep it in the list).

## 3. Plan

For each **build** topic write: channel and URL slug, the primary keyword per locale (from KP), what the page does or answers, data source and licence if any, related pages to link, and the batch it joins. Small tools go into the next tool batch; articles into their shelf (`kb:sync`, `ref:sync`, `slang:sync`).

**map** fixes are copy edits only: the index is rebuilt from page titles and descriptions on every build, so a term in the title or description becomes searchable.

## 4. Build, ship, notify

Normal PR flow (branch → PR → review → squash → deploy → verify). After the deploy, from the merged main checkout:

```
npm run search:notify            # dry run: which pending requests now have results, and which page
SMTP_PASS=… npm run search:notify -- --send
```

Check the dry run: the first result must really answer the query (a word in some blurb is not enough). `--send` mails each address once from m@cv.cm and deletes the row, as the privacy policy says.
