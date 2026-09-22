# Device column (`/device/`)

| Field | Value |
|---|---|
| **Status** | Approved by Codex `gpt-6(xhigh)` on the second review, 2026-09-22. This change is the plan only. |
| **Date** | 2026-09-22 |
| **Repo** | `/Users/shon/Github/cvcm` (https://cv.cm) |
| **Committed base** | Review compared the plan with `c06068d`. `main` is now `44e342e` (`feat: add business days fraction and hourly pay tools on cv.cm`), which only registers those three tools. Neither commit changes Worker cache headers, `boot()`, `syncPageJsonLd`, or sitemap hreflang. `c06068d` is the parent that added four lessons (format JSON, decode Base64, Unix time, read a JWT). Implement from current `main`, not from a dirty checkout. |
| **Owner request** | 给 cv.cm 增加设备栏目，符合 SEO。先规划，让 Codex 审核，再开工。 |

This document is the plan. It is not an implementation.

## Review history

Codex `gpt-6(xhigh)` reviewed the first draft against committed `main` and returned **REQUEST CHANGES**. Uncommitted work in the checkout was out of scope. This revision adopts all five blocking items:

1. The IP address is fetched only after a click, and the live reading is `data-nosnippet`. `data-nosnippet` only keeps a value out of snippets. The click is what keeps it out of the indexed body.
2. The client head behavior is described the way committed `src/client/faq.ts` and `render()` actually work.
3. Tests drive the real `boot` / `render` path, including language switch and back/forward, and sitemap alternates are checked by target URL.
4. Screen size is the browser-reported CSS size. CSS pixels times `devicePixelRatio` is an estimate, because zoom changes the ratio.
5. A desktop-mode iPad is not something a User-Agent string can guarantee. The parser takes touch points and client hints, and it says when the platform is only what the browser reported.

Also adopted from the non-blocking notes: do not read hardware fields the pages do not show; request only the client hints the browser page shows; FAQPage stays as visible content and is not expected to earn a Google FAQ rich result (retired 2026-05-07).

Second review, same model and effort, **APPROVE**. No new blocking item. After that approval, the committed-base sentence above was corrected: `c06068d` is the four-lesson batch, not a title-only edit. The column design did not change.

## What “设备栏目” means

A new top-level section, sibling of Lessons and Games, that answers the questions a person asks about the browser they are holding:

- 我的设备 / my device
- 我的 IP 地址 / what is my IP address
- 我的浏览器 / what browser am I using
- 我的屏幕分辨率 / what is my screen resolution
- 我的 User-Agent / what is my user agent

Each question is one URL. The page explains the one distinction that makes the reading meaningful, and says what this site does not collect. Local readings (screen, browser, user agent) appear in the page. The IP address appears only after the visitor asks for it.

Rejected readings of the same request:

- A phone or PC catalog (specs, prices, affiliate pages). It is not this product, the facts go stale, and the pages would be a thin directory.
- One more tile inside `TOOLS`. A tool id is a single URL and it drags in `GUIDE_STEP_COUNT`, guide screenshots, and a how-to. These four queries need four titles. Games is the column pattern that already does that.
- A fingerprint, WebRTC-leak, or “IP 纯净度” score. Those pages exist to identify a browser. This column must not become a tracking demo.

## Evidence, and what this plan does not invent

`~/.grok/tmp/cvcm-keyword-ideas.json` (29,626 ideas, pulled for PDF / image / QR / how-to) does not contain these queries. `~/.config/gads/google-ads.yaml` is not on this machine, so this plan does not print monthly volumes.

SERP shape checked 2026-09-22:

- English results split the jobs across URLs: an IP page, a user-agent page, a screen-resolution page, a browser page.
- Chinese results lead with 我的 IP / IP 查询 / 公网 IP. Browser, screen, and User-Agent are usually blocks on that same IP page, or separate utility URLs.
- The padding on those pages is city, ISP, latitude, WebRTC, and a fingerprint hash.

We take the split URLs and the query-shaped titles. We do not take the padding. Ranking for 归属地, 纯净度, or “browser fingerprint” is out of scope, so those words do not go in titles.

## URLs

Eight locales, trailing slash, lowercase locale segment (`zh-cn`, `zh-tw`). Five pages. Forty indexable URLs. No query-string variants.

| Page id | Path under `/{locale}` | English title | 简体 title |
|---|---|---|---|
| `hub` | `/device/` | My device — cv.cm | 我的设备 — cv.cm |
| `ip` | `/device/ip/` | What is my IP address — cv.cm | 我的 IP 地址 — cv.cm |
| `browser` | `/device/browser/` | What browser am I using — cv.cm | 我的浏览器 — cv.cm |
| `screen` | `/device/screen-resolution/` | What is my screen resolution — cv.cm | 我的屏幕分辨率 — cv.cm |
| `ua` | `/device/user-agent/` | What is my user agent — cv.cm | 我的 User-Agent — cv.cm |

H1 equals the title without the ` — cv.cm` suffix. Anchors use the query, not “click here”.

| Locale | Hub | IP | Browser | Screen | User-Agent |
|---|---|---|---|---|---|
| zh-TW | 我的裝置 | 我的 IP 位址 | 我的瀏覽器 | 我的螢幕解析度 | 我的 User-Agent |
| ja | 自分の端末 | 自分の IP アドレス | 使用中のブラウザ | 画面解像度 | ユーザーエージェント |
| ko | 내 기기 | 내 IP 주소 | 내 브라우저 | 화면 해상도 | 사용자 에이전트 |
| es | Mi dispositivo | Cuál es mi dirección IP | Qué navegador uso | Resolución de mi pantalla | Cuál es mi user agent |
| vi | Thiết bị của tôi | Địa chỉ IP của tôi | Trình duyệt của tôi | Độ phân giải màn hình | User-Agent của tôi |
| id | Perangkat saya | Alamat IP saya | Peramban saya | Resolusi layar saya | User-Agent saya |

The other six locales translate the descriptions below. They do not reuse the English sentence.

| Page | English description | 简体 description |
|---|---|---|
| hub | Screen size, browser, and user agent reported by this tab, plus a button to show the IP address of this request. Nothing is saved. | 查看本标签页报告的屏幕、浏览器和 User-Agent。IP 地址要点一下才显示。不保存。 |
| ip | How to read the public IP address of this request. The address is shown only after you ask, it is not stored, and this page does not look up a city. | 说明如何查看这次访问的公网 IP。地址要点一下才显示，不保存，也不查询城市。 |
| browser | Browser name and version reported by this tab, and why client hints and the user-agent string can disagree. | 查看当前浏览器报告的名称和版本，并说明客户端提示和 User-Agent 为什么会不一样。 |
| screen | The screen size and window size this browser reports, in CSS pixels, and what device pixel ratio does and does not measure. | 查看浏览器报告的屏幕尺寸和窗口尺寸（CSS 像素），以及设备像素比量不到什么。 |
| ua | The user-agent string this browser sends. It is not your IP address, and it is not stored. | 查看并复制本浏览器发送的 User-Agent。它不是 IP，也不会被保存。 |

`公网 IP` appears in the 简体 IP description and in one FAQ. It does not get its own URL.

## Page content

Every page, in this order:

1. Visible breadcrumb: locale home, then 我的设备, then the page name on a child. The same links are the `BreadcrumbList` JSON-LD. No breadcrumb markup that is not on the page.
2. H1, the query.
3. One-sentence lede from the description table. The lede does not contain a live reading.
4. Reading panel, inside an element that has `data-nosnippet` when it is created, including while it is still empty. `data-nosnippet` keeps the reading out of snippets. It does not noindex the page, and it is not a substitute for the IP click rule below.
5. “How to read this”, one distinction only. See the screen and IP rules in the next sections.
6. “What leaves this tab”, specific to that page, two to four sentences.
7. Five visible FAQs. The visible question and answer are the FAQPage JSON-LD, same strings. Google retired FAQ rich results on 2026-05-07, so this markup is for readers and for the JSON-LD the rest of cv.cm already emits. The plan does not expect an FAQ rich result, and it does not add questions that are not on the page.

Hub readings are a summary. The essay for each job lives only on the child URL.

FAQ subjects (wording is localized, subjects stay):

- Hub: what the tab can see without a request; what we refuse to read; whether anything is saved; why the IP waits for a click; how the four pages differ.
- IP: is the value, once shown, the public address of this request; why there is no city; is it stored; IPv4 and IPv6; WebRTC.
- Browser: why the version can disagree with the raw string; whether other sites already receive a user-agent; coarse signal versus an identifier; phone or desktop; how this page differs from the user-agent page.
- Screen: screen versus window; what device pixel ratio means, including that zoom changes it; this size is not an HTTP header; OS scaling; orientation.
- User-Agent: what the string is; what it does not contain; Chrome’s reduced string; copying it for a bug report; changing the string is not a privacy tool. One FAQ states that an iPad in desktop mode can send a Mac user-agent, so a Mac label means the browser reported macOS.

No HowTo JSON-LD. Opening the page and reading a number is not a procedure.

No extra schema type beyond FAQPage and BreadcrumbList. Live readings never appear in either document, in the title, in the meta description, or in Open Graph.

## IP address

The IP is the one fact the edge already has, because the request arrived. It is not put in the HTML, and it is not fetched when the page loads.

On the hub and on `/device/ip/`, a button labeled with the localized “Show the address for this request” is the only control that calls `fetch("/api/device/ip", { cache: "no-store" })`. The static HTML includes that button and does not include an address. Script does not click it, does not fetch on load, and does not fetch on scroll. Crawlers and visitors follow the same rule. There is no bot exception.

The value, once returned, is written only into the `data-nosnippet` reading node. A test renders the page, asserts no request to `/api/device/ip` yet, clicks the button, and asserts the address is in that node and is absent from the title, description, canonical, Open Graph, FAQPage, and BreadcrumbList.

`GET` and `HEAD` `/api/device/ip`:

- Body is exactly `{"ip":"<address>"}` or `{"ip":""}`. No country, city, region, postal code, coordinates, ASN, ISP, or colo.
- Address source is only `CF-Connecting-IP`. No fallback to `X-Forwarded-For`, `True-Client-IP`, or `?ip=`. A query string is ignored.
- The address is returned only if it matches a strict IPv4 or IPv6 grammar. Anything else, including newlines and `<`, becomes `{"ip":""}` with status 200. The raw header is never copied into the body.
- `Cache-Control: private, no-store` and `CDN-Cache-Control: no-store`. `X-Robots-Tag: noindex`. `Content-Type: application/json`. No `Access-Control-Allow-Origin`.
- The response still goes through `withHeaders`. Committed `withHeaders` turns a 200 on a non-static path into `Cache-Control: no-cache`, which is allowed to be stored. That assignment must not win for this path. The special case is the branch that runs, not a line that runs earlier and is overwritten.
- No D1 write, no log line that contains the address, no analytics.
- `POST` / `PUT` / `PATCH` / `DELETE` stay on the existing 405 path. The handler is registered after that method gate.
- The route is not in the sitemap and is not linked as a document.

Two `worker.fetch` calls with different `CF-Connecting-IP` values prove the handler and the header branch. They do not prove Cloudflare’s shared cache. The production check is the response headers on `https://cv.cm/api/device/ip`: `private, no-store` and `CDN-Cache-Control: no-store`. Production curl cannot supply a forged `CF-Connecting-IP` (Cloudflare overwrites it), so production does not try to.

The HTML shell stays on the existing `no-cache` rule and is identical for every visitor. Worker test: `GET /en/device/ip/` with `CF-Connecting-IP: 203.0.113.50` does not contain that address. `GET /api/device/ip` with the same header does.

The IP “how to read this” section uses the documentation addresses `203.0.113.10` and `2001:db8::1`, labeled as examples. It distinguishes a public address from a private LAN address. It does not say the page has looked up a city.

Do not open `RTCPeerConnection`. Do not read canvas, audio, fonts, WebGL renderer, battery, `deviceMemory`, `hardwareConcurrency`, or color depth. Do not hash a fingerprint. Do not call `geolocation` or `getUserMedia`. Do not claim a MAC address, IMEI, or phone number. Do not add a `?ip=` lookup. Country stays out of v1.

`maxTouchPoints` is read only as an input to platform disambiguation. The page does not print the number.

## Screen size

The first number on the screen page is `screen.width` × `screen.height`, labeled as the browser-reported screen size in CSS pixels. The second is the viewport (`innerWidth` × `innerHeight`). The third is `devicePixelRatio`, labeled as the current ratio.

CSS pixels times that ratio is shown only as an estimate of device pixels, in the same paragraph that says zoom and OS scaling change the ratio, so the product is not a measurement of the panel. The worked example is `1920×1080` at ratio `2`, about `3840×2160`, with that caveat in the same sentence. The English and 简体 copy must contain the caveat and must not call the product a physical resolution.

The title stays “What is my screen resolution” because that is the query. The H1 does not say “physical resolution”.

A test builds the reading with ratio `2` and again with ratio `1` and checks that the estimate changes and the caveat remains. `estimatedDevicePixels(1920, 1080, 2)` may still return `3840×2160`. The test of that function is arithmetic. The page test is the one that locks the label.

## Browser and user agent

Local readings, shown immediately inside `data-nosnippet`. No network request.

Client hints, when `navigator.userAgentData` exists, are limited to the brands, full version list, platform, and mobile flag that the browser page displays. Do not request model, architecture, or platform version.

The string parser is the fallback. Safari has no client hints. Match order, because several tokens contain `Chrome/`:

1. Edge (`Edg/`) before Chrome.
2. Opera (`OPR/`) before Chrome.
3. iOS Chrome (`CriOS`) before Chrome.
4. Firefox, then Chrome, then Safari.
5. Otherwise the browser name is the localized “unknown”, not a guess.

Platform is a separate result, with an explicit source:

- Client-hint platform wins when the browser provides one. The UI says the browser reported that platform.
- Otherwise `parseUserAgent(ua, { maxTouchPoints })` may use touch points. A Macintosh user-agent with `maxTouchPoints > 1` is reported as iPad. The same user-agent with `maxTouchPoints` of `0` is reported as browser-reported macOS, not as “this device is a Mac”.
- A fixture whose string contains the token `iPad` does not satisfy the desktop-mode case. The desktop-mode fixture is a Macintosh Safari string plus `maxTouchPoints: 5`.

OS tokens the string parser may report besides that case: Windows, Android, iOS (iPhone), macOS. Unknown stays unknown.

## SEO wiring, matched to committed code

Implementation extends committed `main`. It does not invent a second head manager, and it does not start from the dirty checkout. That checkout has uncommitted `workdays` / `fraction` / `hourly` edits, learn-batch scripts, and an `hreflangAlternates` patch in `src/shared/seo.ts` and `src/client/main.ts`. If that patch lands before implementation, `pageCanonical` understanding `devicePage` is enough for those alternates to follow. Do not write a second alternate builder, and do not revert the other work.

Committed behavior this plan relies on:

- Unknown paths 302 to the locale home in the Worker.
- Bare `/games` 302s to the negotiated locale. `/en/games/fc/contra` 301s to the slashed canonical. Device routes do the same.
- `parseAppPath` lowercases segments. The canonical helper emits the trailing slash. The Worker compares the raw path to that canonical.
- `syncPageJsonLd` in `src/client/faq.ts` rebuilds FAQ, HowTo, and VideoGame JSON-LD from the arguments it is given. `writeJsonLd` updates a script when data is present and removes it when data is null. It does not keep the previous page’s JSON-LD on its own.
- `render()`’s final branch calls `applyTool(null, null)`, which clears tool, tutorial, and game state. A device URL that falls through that branch loses its structured data. The failure mode is a missing FAQ, not a restored FAQ from the page the visitor just left.
- Client `render()` updates `og:title`, `og:description`, and `og:url` only when those elements already exist. It updates `og:image` only when the element exists and the page has an image. It does not create missing Open Graph tags, and it does not change `og:type`. Extending the Worker’s `ogImage()` does not fix a client-side navigation.
- `boot()`’s final `else` rewrites the URL with `appHref`. A device path that falls through becomes `/en/` (or the other locale home).
- `hreflang` on committed main is the sitemap `xhtml:link` set, including `x-default` = English. `applyHtmlSeo` on committed main does not emit `<link rel="alternate" hreflang>`. Sitemap alternates are the required mechanism. Google treats sitemap hreflang as sufficient.

What implementation must add on top of that:

- `parseAppPath` gains `device` and `bare-device`. Extra segments and unknown slugs, including `/en/device/gpu/`, are `unknown` and 302 home. They must not render a soft 200.
- `pageTitle`, `pageDescription`, `pageCanonical`, and the Worker `ogImage` learn `devicePage`. Canonical is `https://cv.cm` plus `deviceHref`.
- `applyHtmlSeo` emits title, description, canonical, Open Graph, FAQPage, and BreadcrumbList (`id="breadcrumb-jsonld"`). For a device route only, it fills `#app` with the breadcrumb, H1, lede, both explanation sections, the five FAQs, and the IP button on the hub and IP page. No live reading and no IP.
- `boot`, `render`, and the language-switch URL choice live in one module, `src/client/app-shell.ts`. `src/client/main.ts` imports `start` from that module and does not keep a second copy of the route `else`. `start` registers `popstate` and runs `boot`.
- Device state is set on a device route and cleared on every other route, the same way tool and game state are cleared.
- `syncPageJsonLd` accepts the device page. On a device page it writes FAQPage and BreadcrumbList, and it passes null for HowTo and VideoGame so those scripts are removed. On a non-device page it removes `breadcrumb-jsonld`.
- Head sync creates, updates, and removes `og:title`, `og:description`, `og:url`, `og:image`, and `og:type`. A navigation from a game page (article, game image) to a device page, then to home, must not leave the game image or `og:type=article` behind. Device pages set `og:type` to `website`.
- `langSwitch` builds the next URL with `deviceHref` while a device page is showing.
- Sitemap: `pageUrl` and `pathFor` both gain a device branch. Today they fall through to the locale home, so a forgotten branch would publish eight hreflang links to the wrong URLs. The test locks the targets, not the count. See Tests.
- `tests/sitemap.test.ts` length formula grows by `DEVICE_PAGES.length` (5) per locale. Regenerate `public/sitemap.xml` with `node scripts/write-sitemap.mjs`. The XML must not contain `/api/device/ip`.
- `robots.txt` stays `Allow: /`.
- One shared cover, `public/covers/device-sweet.jpg` (1280×720), is the `og:image` for all five pages. Generate it with Codex from the existing sweet covers, per `AGENTS.md` rule 7. No readable letters or numbers. If the file is missing, omit `og:image`. Do not point Open Graph at a 404.
- Internal links: each child links to the hub and the other three children. The screen page also links to the existing resize and aspect-ratio tools. The hub links to the existing timezone tool for the time-zone sentence in the explanation (the column does not display a time-zone reading of its own, and it does not add a timezone device URL). No other cross-links.
- Home gains a device wall of the four child tiles after the tools wall. The header gains a Device menu after the Games menu. `nav.device` is added to all eight `src/locales/*.json` files so `tests/i18n-keys.test.ts` stays even.
- Page copy lives in `src/locales/device/{en,zh-CN,zh-TW,ja,ko,vi,id,es}.json`. The client and the Worker read it through `deviceCopy()`, the way games use `gameCopy()`.

### Crawlable body

`index.html` ships an empty `#app`. `render()` clears `#app` and mounts the client. For a device route, the first HTML already contains the H1 and the FAQ, from the same `deviceCopy()` strings the client renders. After script, the H1 and the FAQ text are the same sentences. The reading panel is the only addition. A test compares static H1 and FAQ questions and answers to the client strings and to the JSON-LD.

Tool, learn, and games HTML do not gain this article.

## Files

New:

- `src/shared/device.ts` — page ids, `isIpAddress`, `parseUserAgent`, `estimatedDevicePixels`
- `src/shared/device-i18n.ts` — copy, FAQ, static HTML builder
- `src/locales/device/*.json` — eight files, key parity tested
- `src/client/device/ui.ts` — hub and child pages
- `src/client/app-shell.ts` — `start`, `boot`, `render`, head sync
- `tests/device.test.ts`
- `tests/device-shell.test.ts` — happy-dom
- `public/covers/device-sweet.jpg` and one prompt in `docs/tool-cover-prompts.md`

Edit:

- `package.json` / lockfile — `happy-dom` as a devDependency, used only by `tests/device-shell.test.ts` (`@vitest-environment happy-dom`). This is the one new dependency. No `ua-parser-js` and no geo database.
- `src/shared/path.ts` — parse kind, `deviceHref`. These ids are not added to `TOOLS` or `CATEGORIES`.
- `src/shared/seo.ts` — title, description, canonical, FAQ, breadcrumb, static `#app` fill, og image
- `src/shared/sitemap.ts` — `pageUrl` and `pathFor` — and `public/sitemap.xml`
- `src/worker.ts` — redirects, SEO shell branch, `/api/device/ip`, `withHeaders` cache exception
- `src/client/main.ts` — becomes the call to `start()`, plus the listeners that are not the route `else`
- `src/client/faq.ts` — `syncPageJsonLd` accepts the device page and removes the breadcrumb script off device pages
- `src/client/home.ts` — wall
- `src/client/styles.css` — reading panel only
- `src/locales/*.json` — `nav.device` only
- `tests/sitemap.test.ts`
- `README.md` — short section, current product only
- `AGENTS.md` — one layout bullet

Do not edit `src/shared/guide.ts`, `scripts/capture-guides.mjs`, or learn files. These pages are not tools.

## Tests

`tests/device.test.ts` follows `tests/games.test.ts`: `worker.fetch` with a stub `ASSETS` that returns `index.html`. Assertions:

- Parse and canonical: each locale, bare `/device/ip`, missing slash, wrong case, extra segment, unknown slug.
- `pageTitle("en", { devicePage: "ip" })` matches `/what is my IP address/i`. `pageTitle("zh-CN", { devicePage: "ip" })` matches `/我的 IP 地址/`. The screen title matches `/screen resolution/i` and does not match `/physical resolution/i`.
- Five FAQ items per page per locale. JSON-LD question names and accepted answers equal the visible questions and answers. No HowTo document. JSON-LD does not contain `203.0.113.50`.
- Static HTML H1 equals the visible title. Static IP HTML contains the show-address button and does not contain a `CF-Connecting-IP` value supplied on the request.
- English and 简体 screen copy include the zoom / scaling caveat.
- `isIpAddress` accepts `203.0.113.10` and `2001:db8::1`. It rejects `203.0.113.10\n`, `1.2.3.4<script>`, `8.8.8.8, 1.2.3.4`, and empty.
- `parseUserAgent` fixtures for Edge, Opera, CriOS, Firefox, Chrome, Safari, and the Macintosh-plus-`maxTouchPoints: 5` iPad case. Macintosh-plus-`maxTouchPoints: 0` is browser-reported macOS.
- `estimatedDevicePixels(1920, 1080, 2)` is `3840×2160`. The page-level test is the caveat, not this equality.
- `GET /api/device/ip` echoes a valid `CF-Connecting-IP`, ignores `?ip=8.8.8.8` and `X-Forwarded-For`, and returns `Cache-Control: private, no-store` plus `CDN-Cache-Control: no-store`.
- Invalid header returns `{"ip":""}` and does not reflect the header text.
- `HEAD` returns those cache headers and an empty body. `POST` is 405.
- Response has no `Access-Control-Allow-Origin` and has `X-Robots-Tag: noindex`.
- Device locale JSON files have the same keys.
- The device UI source does not reference `RTCPeerConnection`, `getCurrentPosition`, `getUserMedia`, `deviceMemory`, or `getHighEntropyValues` with `model`.

Sitemap, for every device page id, parse the `<url>` block whose `<loc>` is the zh-CN URL and assert:

- `hreflang="zh-CN"` href is that same zh-CN device URL
- `hreflang="en"` href is the English URL for the same page id
- `hreflang="x-default"` href is the English URL for the same page id
- none of those hrefs is the bare locale home

A count of eight alternate links is not sufficient, because `pageUrl` / `pathFor` today fall through to the home URL.

`tests/device-shell.test.ts` imports `src/client/app-shell.ts`, the module `main.ts` starts. It does not reimplement `boot`. Under happy-dom:

- Loading `/en/device/ip/` leaves the URL on `/en/device/ip/`, not `/en/`.
- The first paint does not request `/api/device/ip`. Clicking the show-address button does. The address lands in `[data-nosnippet]` and not in the title, meta description, or JSON-LD.
- Navigate from a tool URL to a device URL to the locale home. After each step, assert the URL, `document.title`, canonical, visible FAQ questions and answers, and JSON-LD text. On the device step, HowTo and VideoGame scripts are absent and BreadcrumbList is present. On the home step, the breadcrumb script is absent and `og:type` is not `article`.
- Language switch from `/en/device/screen-resolution/` to zh-CN lands on `/zh-cn/device/screen-resolution/`.
- `popstate` back to the tool URL restores that tool’s title and canonical and removes the device breadcrumb script.
- Building the screen reading at ratio `2` and ratio `1` changes the estimate and keeps the caveat.

Production browser check after deploy, no login required:

- English and 简体 IP and screen URLs: title, canonical, H1 in the first HTML, five FAQ questions in JSON-LD, sitemap alternates pointing at the device URLs.
- The IP page does not show an address until the button is used. After the click, the address is on the page and not in the title.
- `curl -sI https://cv.cm/api/device/ip` shows `private, no-store` and `CDN-Cache-Control: no-store`.
- Language switch stays on the same device page. `/en/device/gpu/` leaves for the home page. No location prompt.

## Out of scope

Speed test. GPU or WebGL renderer page. City, ISP, or map. Lookup of an arbitrary IP. WebRTC leak test. Fingerprint hash. Battery, device memory, CPU-count, or color-depth readings. MAC, IMEI, phone number. A `device` tool id. Guide screenshots. `ua-parser-js` or a geo database. New CSP hosts. D1. Storing a reading. Removing FAQPage from existing tool and game pages.
