import "./shared/messages-all";
import { DEMO_ROM_FILES } from "./shared/demo-roms";
import { handleClipApi } from "./clip-api";
import { d1Store, type D1Database } from "./clip-store";
import { d1SearchStore, handleSearchApi } from "./search-api";
import { d1NostalgiaStore, handleNostalgiaApi } from "./nostalgia-api";
import { countryBucket, countryCode } from "./shared/countries";
import { cookieValue, DEFAULT_LOCALE, LOCALE_COOKIE, negotiateLocale, parseLocale, type Locale } from "./shared/locale";
import { isIpAddress } from "./shared/device";
import { appHref, rankingHref, datasetHref, deviceHref, gamesHref, isAgentDocPath, devicePolicyOf, isAiToolPath, isLookupToolPath, LOOKUP_HOSTS, isPublishedTutorial, kbHref, learnHref, legalHref, parseAppPath, quizHref, refHref, slangHref, ideasHref, ideasPackOf, nostalgiaHref, countriesHref, caloriesHref, elementsHref, calendarHref, emojiHref, breedsHref, STATIC_FILE, toolJob } from "./shared/path";
import { currencyHref } from "./shared/path";
import { rankingRowsChunk } from "./shared/rankings";
import { GA_CONNECT_HOSTS, GA_SCRIPT_HOST, isTrackedPath } from "./shared/analytics";
import { COVER_ORIGIN, thumbOriginal } from "./shared/covers";
import { aiContentType, upstreamUrl } from "./shared/ai-models";
import { preloadLocalePack, preloadPageChunk } from "./shared/locale-preload";
import { copyChunkKey, pageCopyOf } from "./shared/page-copy";
import { DATASET_FILES } from "./shared/datasets";
import { applyHtmlSeo } from "./shared/seo-html";
import type { S3Config } from "./s3-sign";


export interface Env {
  ASSETS: { fetch: (request: Request | string) => Promise<Response> };
  DB?: D1Database;
  S3_ACCESS_KEY_ID?: string;
  S3_SECRET_ACCESS_KEY?: string;
  S3_HOST?: string;
  S3_BUCKET?: string;
  S3_REGION?: string;
}

/** A page CSP: GA hosts on tracked pages, WebAssembly on AI pages, and any extra hosts the page may fetch from. */
function siteCsp({ analytics = false, wasm = false, connect = [] as readonly string[] } = {}): string {
  return [
    "default-src 'self'",
    analytics
      ? `script-src 'self' ${GA_SCRIPT_HOST}`
      // AI tools: ONNX Runtime compiles WebAssembly and imports its loader from a blob: URL (in the worker).
      : wasm ? "script-src 'self' 'wasm-unsafe-eval' blob:" : "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data: https:",
    "font-src 'self'",
    ["connect-src 'self' https://s3.cv.cm", ...(analytics ? GA_CONNECT_HOSTS : []), ...connect].join(" "),
    "media-src blob: https:",
    "worker-src 'self' blob:",
    "frame-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

/**
 * The CSP for a page's flags, built once per combination: file tools and clip notes have no analytics hosts (AGENTS.md
 * rule 1), AI pages WebAssembly, citation pages the lookup hosts.
 */
const cspCache = new Map<string, string>();
function cspFor(flags: { analytics: boolean; wasm: boolean; lookup: boolean }): string {
  const key = `${+flags.analytics}${+flags.wasm}${+flags.lookup}`;
  let csp = cspCache.get(key);
  if (!csp) cspCache.set(key, (csp = siteCsp({ analytics: flags.analytics, wasm: flags.wasm, connect: flags.lookup ? LOOKUP_HOSTS : [] })));
  return csp;
}


const EMU_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval' blob:",
  "script-src-elem 'self' 'unsafe-eval' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  "connect-src 'self' blob:",
  "media-src blob:",
  "worker-src 'self' blob:",
  "child-src blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
  "frame-ancestors 'self'",
  "upgrade-insecure-requests",
].join("; ");

const EMU_PROXY = /^\/emu\/(data|assets|roms)\/([A-Za-z0-9._/-]+)$/;
/** AI model weights and ONNX Runtime's WebAssembly, mirrored on s3.cv.cm (scripts/ai/mirror.mjs). Paths are versioned. */
const AI_PROXY = /^\/ai\/(models|ort)\/([A-Za-z0-9._/-]+)$/;
const COVER_PATH = /^\/covers\/([A-Za-z0-9._/-]+)$/;

const ALLOWED = "GET, HEAD";

function s3Config(env: Env): S3Config | null {
  if (!env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) return null;
  return {
    accessKey: env.S3_ACCESS_KEY_ID,
    secret: env.S3_SECRET_ACCESS_KEY,
    host: env.S3_HOST || "s3.cv.cm",
    bucket: env.S3_BUCKET || "files",
    region: env.S3_REGION || "us-east-1",
  };
}

export default {
  /** Hourly cron (wrangler.jsonc): sweep search hashes, salts and rate rows past their two days even when nobody searches. */
  async scheduled(_event: unknown, env: Env): Promise<void> {
    if (!env.DB) return;
    // Independent sweeps: one failing must not keep the other's IP-derived rows past their two days.
    const now = Date.now();
    const sweeps = await Promise.allSettled([d1SearchStore(env.DB).cleanup(now), d1NostalgiaStore(env.DB).cleanup(now)]);
    const failed = sweeps.flatMap((sweep) => (sweep.status === "rejected" ? [sweep.reason] : []));
    // Both ran; a failure still fails the cron run so it shows up in Cloudflare.
    if (failed.length) throw new AggregateError(failed, "scheduled cleanup");
  },
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    // CORS preflight for the agent discovery files, before the www redirect: browsers reject redirected preflights.
    if (request.method === "OPTIONS" && isAgentDocPath(url.pathname)) {
      const preflight = new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
          // `*` does not cover Authorization, so name it for agent frameworks that always send one.
          "Access-Control-Allow-Headers": "*, Authorization",
          "Access-Control-Max-Age": "86400",
        },
      });
      return withHeaders(preflight, url.pathname);
    }
    if (url.hostname === "www.cv.cm") {
      url.hostname = "cv.cm";
      const status = request.method === "GET" || request.method === "HEAD" ? 301 : 307;
      const moved = redirect(url.toString(), status);
      // A cross-origin fetch follows a redirect only if the redirect itself passes the CORS check.
      if (isAgentDocPath(url.pathname)) moved.headers.set("Access-Control-Allow-Origin", "*");
      return moved;
    }

    const store = env.DB ? d1Store(env.DB) : null;
    const api = await handleClipApi(request, { store, s3: s3Config(env) });
    if (api) return api;
    if (url.pathname.startsWith("/api/search/")) {
      const search = await handleSearchApi(request, { store: env.DB ? d1SearchStore(env.DB) : null });
      if (search) return search;
    }
    if (url.pathname.startsWith("/api/nostalgia/")) {
      const vote = await handleNostalgiaApi(request, { store: env.DB ? d1NostalgiaStore(env.DB) : null });
      if (vote) return vote;
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      const notAllowed = new Response("Method Not Allowed", {
        status: 405,
        headers: {
          Allow: isAgentDocPath(url.pathname) ? `${ALLOWED}, OPTIONS` : ALLOWED,
          "Cache-Control": "no-store",
          "Content-Type": "text/plain; charset=utf-8",
        },
      });
      return isAgentDocPath(url.pathname) ? withHeaders(notAllowed, url.pathname) : notAllowed;
    }

    const path = url.pathname;
    // Prerendered page bodies are read through ASSETS below, never served on their own.
    if (path.startsWith(SSR_PREFIX)) return withHeaders(notFound(DEFAULT_LOCALE, request.method), path);
    // The Summaries channel was removed (2026-11-19): its URLs answer 410 so search engines drop them.
    const removed = removedChannelLocale(path, request);
    if (removed) return withHeaders(gone(removed, request.method), path);
    if (path === "/api/device/ip") return withHeaders(deviceIpResponse(request), path);
    const emu = await proxyEmu(path, request.method);
    if (emu) return withHeaders(emu, path);
    const cover = coverRedirect(url, request.method);
    if (cover) return withHeaders(cover, path);
    const ai = await proxyAi(path, request.method);
    if (ai) return withHeaders(ai, path);

    if (!STATIC_FILE.test(path)) {
      const parsed = parseAppPath(path);
      const locale = negotiateLocale(
        request.headers.get("Accept-Language"),
        cookieValue(request.headers.get("Cookie"), LOCALE_COOKIE),
      );

      if (parsed.kind === "clip") {
        return redirectTo(appHref(locale, "clip", parsed.id), url, 302);
      }
      if (parsed.kind === "bare") {
        return redirectTo(appHref(locale, parsed.tool, parsed.clipId, toolJob(parsed)), url, 302);
      }
      if (parsed.kind === "bare-learn") {
        return redirectTo(learnHref(locale, parsed.tutorial), url, 302);
      }
      if (parsed.kind === "bare-games") {
        return redirectTo(gamesHref(locale, parsed.hub), url, 302);
      }
      // Retired emulator catalogue pages and system hubs: the emulator tool that plays them. The old genre filter means
      // nothing there; other parameters (campaign tags) are kept.
      if (parsed.kind === "games-retired") {
        const next = new URL(appHref(parsed.locale ?? locale, parsed.tool), url.origin);
        next.search = url.search;
        next.searchParams.delete("genre");
        return redirect(next.toString(), parsed.locale ? 301 : 302);
      }
      if (parsed.kind === "bare-markets") {
        return redirectTo(appHref(locale, parsed.market), url, 301);
      }
      if (parsed.kind === "bare-device") {
        return redirectTo(deviceHref(locale, parsed.page), url, 302);
      }
      if (parsed.kind === "bare-legal") {
        return redirectTo(legalHref(locale, parsed.page), url, 302);
      }
      if (parsed.kind === "bare-quiz") {
        return redirectTo(quizHref(locale, parsed.quiz), url, 302);
      }
      if (parsed.kind === "bare-dataset") {
        return redirectTo(datasetHref(locale, parsed.dataset), url, 302);
      }
      if (parsed.kind === "bare-ranking") {
        return redirectTo(rankingHref(locale, parsed.ranking), url, 302);
      }
      if (parsed.kind === "bare-kb") {
        return redirectTo(kbHref(locale, parsed.article), url, 302);
      }
      if (parsed.kind === "bare-ref") {
        return redirectTo(refHref(locale, parsed.entry), url, 302);
      }
      if (parsed.kind === "bare-slang") {
        return redirectTo(slangHref(locale, parsed.entry), url, 302);
      }
      if (parsed.kind === "bare-ideas") {
        return redirectTo(ideasHref(locale, parsed.entry), url, 302);
      }
      if (parsed.kind === "bare-nostalgia") {
        return redirectTo(nostalgiaHref(locale, parsed.entry), url, 302);
      }
      if (parsed.kind === "bare-countries") {
        return redirectTo(countriesHref(locale, parsed.entry), url, 302);
      }
      if (parsed.kind === "bare-calories") {
        return redirectTo(caloriesHref(locale, parsed.food), url, 302);
      }
      if (parsed.kind === "bare-elements") {
        return redirectTo(elementsHref(locale, parsed.entry), url, 302);
      }
      if (parsed.kind === "bare-calendar") {
        return redirectTo(calendarHref(locale, parsed.page), url, 302);
      }
      if (parsed.kind === "bare-emoji") {
        return redirectTo(emojiHref(locale, parsed.entry), url, 302);
      }
      if (parsed.kind === "bare-currency") {
        return redirectTo(currencyHref(locale, parsed.pair), url, 302);
      }
      if (parsed.kind === "bare-breeds") {
        return redirectTo(breedsHref(locale, parsed.entry), url, 302);
      }
      if (parsed.kind === "unknown") {
        return withHeaders(notFound(locale, request.method), path);
      }
      if (parsed.kind === "app") {
        const canonical = appHref(parsed.locale, parsed.tool, parsed.clipId, toolJob(parsed));
        if (path !== canonical) {
          return redirectTo(canonical, url, 301);
        }
      }
      if (parsed.kind === "learn") {
        if (parsed.tutorial && !isPublishedTutorial(parsed.tutorial)) {
          return redirectTo(learnHref(parsed.locale, null), url, 301);
        }
        const canonical = learnHref(parsed.locale, parsed.tutorial);
        if (path !== canonical) {
          return redirectTo(canonical, url, 301);
        }
      }
      if (parsed.kind === "games") {
        const canonical = gamesHref(parsed.locale, parsed.hub);
        if (path !== canonical) {
          return redirectTo(canonical, url, 301);
        }
      }
      if (parsed.kind === "markets") {
        return redirectTo(appHref(parsed.locale, parsed.market), url, 301);
      }
      if (parsed.kind === "device") {
        const canonical = deviceHref(parsed.locale, parsed.page);
        if (path !== canonical) {
          return redirectTo(canonical, url, 301);
        }
      }
      if (parsed.kind === "legal") {
        const canonical = legalHref(parsed.locale, parsed.page);
        if (path !== canonical) {
          return redirectTo(canonical, url, 301);
        }
      }
      if (parsed.kind === "quiz") {
        const canonical = quizHref(parsed.locale, parsed.quiz);
        if (path !== canonical) {
          return redirectTo(canonical, url, 301);
        }
      }
      if (parsed.kind === "dataset") {
        const canonical = datasetHref(parsed.locale, parsed.dataset);
        if (path !== canonical) {
          return redirectTo(canonical, url, 301);
        }
      }
      if (parsed.kind === "ranking") {
        const canonical = rankingHref(parsed.locale, parsed.ranking);
        if (path !== canonical) {
          return redirectTo(canonical, url, 301);
        }
      }
      if (parsed.kind === "kb") {
        const canonical = kbHref(parsed.locale, parsed.article);
        if (path !== canonical) {
          return redirectTo(canonical, url, 301);
        }
      }
      if (parsed.kind === "ref") {
        const canonical = refHref(parsed.locale, parsed.entry);
        if (path !== canonical) {
          return redirectTo(canonical, url, 301);
        }
      }
      if (parsed.kind === "slang") {
        const canonical = slangHref(parsed.locale, parsed.entry);
        if (path !== canonical) {
          return redirectTo(canonical, url, 301);
        }
      }
      if (parsed.kind === "ideas") {
        const canonical = ideasHref(parsed.locale, parsed.entry);
        if (path !== canonical) {
          return redirectTo(canonical, url, 301);
        }
      }
      if (parsed.kind === "nostalgia") {
        const canonical = nostalgiaHref(parsed.locale, parsed.entry);
        if (path !== canonical) {
          return redirectTo(canonical, url, 301);
        }
      }
      if (parsed.kind === "countries") {
        const canonical = countriesHref(parsed.locale, parsed.entry);
        if (path !== canonical) {
          return redirectTo(canonical, url, 301);
        }
      }
      if (parsed.kind === "calories") {
        const canonical = caloriesHref(parsed.locale, parsed.food);
        if (path !== canonical) {
          return redirectTo(canonical, url, 301);
        }
      }
      if (parsed.kind === "elements") {
        const canonical = elementsHref(parsed.locale, parsed.entry);
        if (path !== canonical) {
          return redirectTo(canonical, url, 301);
        }
      }
      if (parsed.kind === "emoji") {
        const canonical = emojiHref(parsed.locale, parsed.entry);
        if (path !== canonical) {
          return redirectTo(canonical, url, 301);
        }
      }
      if (parsed.kind === "calendar") {
        const canonical = calendarHref(parsed.locale, parsed.page);
        if (path !== canonical) {
          return redirectTo(canonical, url, 301);
        }
      }
      if (parsed.kind === "currency") {
        const canonical = currencyHref(parsed.locale, parsed.pair);
        if (path !== canonical) {
          return redirectTo(canonical, url, 301);
        }
      }
      if (parsed.kind === "breeds") {
        const canonical = breedsHref(parsed.locale, parsed.entry);
        if (path !== canonical) {
          return redirectTo(canonical, url, 301);
        }
      }
    }

    // Fetch the page's prerendered body alongside the page itself.
    const ssr = request.method === "GET" ? prerendered(env, url.origin, ssrPath(parseAppPath(path), path)) : Promise.resolve(null);
    // Page HTML is rebuilt per request (locale, prerendered body), so index.html's ETag must not answer for it:
    // drop the conditional headers on page routes and the validators from the page response below.
    let assetResponse = await assetsFetch(env, STATIC_FILE.test(path) ? request : unconditional(request));
    const thumbFallback = thumbOriginal(path);
    // Missing files come back as the SPA's index.html (or a 404); a 304 revalidation is passed through.
    const thumbMissing = assetResponse.status === 404 || (assetResponse.headers.get("content-type") || "").includes("text/html");
    if (thumbFallback && thumbMissing) {
      // No thumbnail was built (the cover has no local copy): send the original.
      // Not redirectTo(): that copies the request's (empty) query over the cover's ?v=.
      return redirect(new URL(thumbFallback, url.origin).toString(), 302);
    }
    if (assetResponse.status === 404 && !STATIC_FILE.test(path)) {
      // "/", not "/index.html": Workers Static Assets redirects the latter to the former.
      assetResponse = await assetsFetch(env, new URL("/", url.origin).toString());
    }

    const type = assetResponse.headers.get("content-type") || "";
    const parsed = parseAppPath(path);
    if (
      type.includes("text/html")
      && (parsed.kind === "app" || parsed.kind === "learn" || parsed.kind === "games" || parsed.kind === "markets" || parsed.kind === "device" || parsed.kind === "legal" || parsed.kind === "quiz" || parsed.kind === "dataset" || parsed.kind === "ranking" || parsed.kind === "kb" || parsed.kind === "ref" || parsed.kind === "slang" || parsed.kind === "ideas" || parsed.kind === "nostalgia" || parsed.kind === "countries" || parsed.kind === "calories" || parsed.kind === "elements" || parsed.kind === "calendar" || parsed.kind === "breeds" || path === "/" || path === "/index.html" || parsed.kind === "emoji" || parsed.kind === "currency" || path === "/index.html")
    ) {
      const html = await assetResponse.text();
      const locale = parsed.kind === "app" || parsed.kind === "learn" || parsed.kind === "games" || parsed.kind === "markets" || parsed.kind === "device" || parsed.kind === "legal" || parsed.kind === "quiz" || parsed.kind === "dataset" || parsed.kind === "ranking" || parsed.kind === "kb" || parsed.kind === "ref" || parsed.kind === "slang" || parsed.kind === "ideas" || parsed.kind === "nostalgia" || parsed.kind === "countries" || parsed.kind === "calories" || parsed.kind === "elements" || parsed.kind === "calendar" || parsed.kind === "emoji" || parsed.kind === "currency" || parsed.kind === "breeds"
        ? parsed.locale
        : negotiateLocale(
          request.headers.get("Accept-Language"),
          cookieValue(request.headers.get("Cookie"), LOCALE_COOKIE),
        );
      const seo = parsed.kind === "learn"
        ? { learn: true as const, tutorial: parsed.tutorial }
        : parsed.kind === "games"
          ? { games: true as const, gamesHub: parsed.hub }
          : parsed.kind === "markets"
            ? { markets: true as const, market: parsed.market }
            : parsed.kind === "device"
              ? { devicePage: parsed.page }
            : parsed.kind === "legal"
              ? { legalPage: parsed.page }
            : parsed.kind === "quiz"
              ? { quiz: true as const, quizId: parsed.quiz }
            : parsed.kind === "dataset"
              ? { dataset: true as const, datasetId: parsed.dataset }
            : parsed.kind === "ranking"
              ? { ranking: true as const, rankingId: parsed.ranking }
            : parsed.kind === "kb"
              ? { kb: true as const, kbId: parsed.article }
            : parsed.kind === "ref"
              ? { ref: true as const, refId: parsed.entry }
            : parsed.kind === "slang"
              ? { slang: true as const, slangId: parsed.entry }
            : parsed.kind === "ideas"
              ? { ideas: true as const, ideaId: parsed.entry }
            : parsed.kind === "nostalgia"
              ? { nostalgia: true as const, nostalgiaId: parsed.entry }
            : parsed.kind === "countries"
              ? { countries: true as const, countryId: parsed.entry }
            : parsed.kind === "calories"
              ? { calories: true as const, foodId: parsed.food }
            : parsed.kind === "elements"
              ? { elements: true as const, elementSlug: parsed.entry }
            : parsed.kind === "calendar"
              ? { calendar: true as const, calendarPage: parsed.page }
            : parsed.kind === "emoji"
              ? { emoji: true as const, emojiSlug: parsed.entry }
            : parsed.kind === "currency"
              ? { currency: true as const, currencyPair: parsed.pair }
            : parsed.kind === "breeds"
              ? { breeds: true as const, breedId: parsed.entry }
            : parsed.kind === "app"
            ? { tool: parsed.tool, clipId: parsed.clipId, convertJob: parsed.convertJob, resizeJob: parsed.resizeJob }
            : { tool: null };
      const headers = new Headers(assetResponse.headers);
      headers.set("Content-Type", "text/html; charset=utf-8");
      headers.delete("ETag");
      headers.delete("Last-Modified");
      const body = await ssr;
      const chunk = parsed.kind === "app" ? parsed.tool ?? "home"
        : parsed.kind === "learn" || parsed.kind === "games" || parsed.kind === "device" || parsed.kind === "markets" ? parsed.kind
        : parsed.kind === "quiz" ? "quiz"
        : parsed.kind === "dataset" ? "dataset"
        : parsed.kind === "ranking" ? "ranking"
        : parsed.kind === "kb" ? "kb"
        : parsed.kind === "ref" ? "ref"
        : parsed.kind === "slang" ? "slang"
        : parsed.kind === "ideas" ? "ideas"
        : parsed.kind === "nostalgia" ? "nostalgia"
        : parsed.kind === "countries" ? "countries"
        : parsed.kind === "calories" ? "calories"
        : parsed.kind === "elements" ? "elements"
        : parsed.kind === "calendar" ? "calendar"
        : parsed.kind === "emoji" ? "emoji"
        : parsed.kind === "currency" ? "currency"
        : parsed.kind === "breeds" ? "breeds"
        : parsed.kind === "legal" ? null
        : "home";
      // The browser's core pack leaves out the copy only this page shows; preload the bucket that holds it.
      const copy = copyChunkKey(locale, pageCopyOf(parsed));
      let out = applyHtmlSeo(html, locale, seo, undefined, body);
      out = preloadLocalePack(out, locale, undefined, parsed.kind === "quiz" && (parsed.quiz ?? "hub"), parsed.kind === "dataset" || parsed.kind === "ranking", parsed.kind === "kb" ? parsed.article ?? "hub" : null, parsed.kind === "ref" ? parsed.entry ?? "hub" : null, parsed.kind === "slang" ? parsed.entry ?? "hub" : null, copy, ideasPackOf(parsed), parsed.kind === "nostalgia" ? parsed.entry ?? "hub" : null, parsed.kind === "countries" ? (parsed.entry ? String(countryBucket(countryCode(parsed.entry))) : "hub") : null, parsed.kind === "calories", parsed.kind === "elements", parsed.kind === "calendar" || (parsed.kind === "app" && parsed.tool === "lunar-converter"), parsed.kind === "emoji", parsed.kind === "currency", parsed.kind === "breeds" ? parsed.entry ?? "hub" : null);
      out = preloadPageChunk(out, chunk);
      if (parsed.kind === "ranking" && parsed.ranking) out = preloadPageChunk(out, rankingRowsChunk(parsed.ranking));
      if (parsed.kind === "dataset" && parsed.dataset) {
        for (const file of DATASET_FILES[parsed.dataset]) out = preloadPageChunk(out, `rows-${file}`);
      }
      return withHeaders(
        new Response(out, {
          status: assetResponse.status,
          headers,
        }),
        path,
      );
    }
    return withHeaders(assetResponse, path);
  },
};

const SSR_PREFIX = "/_ssr/";
const SSR_MARKER = "<!--ssr-->";

function unconditional(request: Request): Request {
  const headers = new Headers(request.headers);
  headers.delete("If-None-Match");
  headers.delete("If-Modified-Since");
  return new Request(request.url, { method: request.method, headers });
}

/** Which prerendered page a request shows: its own path; none for clip notes and files ("/" redirects earlier). */
function ssrPath(parsed: ReturnType<typeof parseAppPath>, path: string): string | null {
  if (STATIC_FILE.test(path)) return null;
  if (parsed.kind === "app") return parsed.clipId ? null : path;
  if (parsed.kind === "learn" || parsed.kind === "games" || parsed.kind === "device" || parsed.kind === "legal" || parsed.kind === "quiz" || parsed.kind === "dataset" || parsed.kind === "ranking" || parsed.kind === "kb" || parsed.kind === "ref" || parsed.kind === "slang" || parsed.kind === "ideas" || parsed.kind === "nostalgia" || parsed.kind === "countries" || parsed.kind === "calories" || parsed.kind === "elements" || parsed.kind === "calendar" || parsed.kind === "emoji" || parsed.kind === "currency" || parsed.kind === "breeds") return path;
  return null;
}

/**
 * env.ASSETS.fetch with Pages' answers, which the site was built and indexed on. Workers Static Assets differs twice:
 * it redirects `.html` and trailing-slash URLs with 307 (Pages: 308, so search engines move the URL), and it sends
 * text/html, text/css, text/plain and text/csv without a charset (Pages: utf-8). Every built file is UTF-8; JS
 * (text/javascript) keeps no charset as on Pages. Upstream proxies (emu, AI, covers) do not pass through here.
 */
async function assetsFetch(env: Pick<Env, "ASSETS">, input: Request | string): Promise<Response> {
  const res = await env.ASSETS.fetch(input);
  const type = res.headers.get("Content-Type");
  const charset = !!type && !/charset=/i.test(type) && /^text\/(?!javascript)/i.test(type);
  if (res.status !== 307 && !charset) return res;
  const headers = new Headers(res.headers);
  if (charset) headers.set("Content-Type", `${type}; charset=utf-8`);
  if (res.status === 307) return new Response(null, { status: 308, headers });
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

/** The page body scripts/prerender.ts rendered for this path, or null (clip notes, a page the prerender skipped). */
async function prerendered(env: Env, origin: string, pagePath: string | null): Promise<string | null> {
  if (!pagePath || !pagePath.startsWith("/") || !pagePath.endsWith("/") || pagePath.includes("..")) return null;
  try {
    const res = await assetsFetch(env, `${origin}${SSR_PREFIX.slice(0, -1)}${pagePath}`);
    if (!res.ok) return null;
    const text = await res.text();
    // A missing file comes back as the SPA's index.html, which has no marker.
    return text.startsWith(SSR_MARKER) ? text.slice(SSR_MARKER.length) : null;
  } catch {
    return null;
  }
}

function deviceIpResponse(request: Request): Response {
  const raw = request.headers.get("CF-Connecting-IP") ?? "";
  const ip = isIpAddress(raw) ? raw : "";
  return new Response(request.method === "HEAD" ? null : JSON.stringify({ ip }), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "private, no-store",
      "CDN-Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}

/**
 * `/summaries`, `/summaries/…`, `/{locale}/summaries` and `/{locale}/summaries/…` (any case, with or without the slash):
 * pages of the removed Summaries channel. Returns the locale to link home in (the path's own, else negotiated), or null.
 */
function removedChannelLocale(path: string, request: Request): Locale | null {
  const negotiated = (): Locale => negotiateLocale(request.headers.get("Accept-Language"), cookieValue(request.headers.get("Cookie"), LOCALE_COOKIE));
  // The bare form first, so /summaries/summaries/ is not read as a locale named "summaries"; the old section sitemap too.
  if (/^\/summaries(?:\/.*)?$/i.test(path) || /^\/sitemaps\/summaries\.xml$/i.test(path)) return negotiated();
  const m = /^\/([^/]+)\/summaries(?:\/.*)?$/i.exec(path);
  return m ? parseLocale(m[1]) : null;
}

function gone(locale: Locale, method: string): Response {
  const home = appHref(locale, null);
  const body = `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>410 — cv.cm</title></head><body style="font-family: system-ui, sans-serif; max-width: 40rem; margin: 4rem auto; padding: 0 1rem"><h1>410</h1><p>This page has been removed. <a href="${home}">cv.cm</a></p></body></html>`;
  return new Response(method === "HEAD" ? null : body, {
    status: 410,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/html; charset=utf-8",
      "X-Robots-Tag": "noindex",
    },
  });
}

function notFound(locale: Locale, method: string): Response {
  const home = appHref(locale, null);
  const body = `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>404 — cv.cm</title></head><body style="font-family: system-ui, sans-serif; max-width: 40rem; margin: 4rem auto; padding: 0 1rem"><h1>404</h1><p><a href="${home}">cv.cm</a></p></body></html>`;
  return new Response(method === "HEAD" ? null : body, {
    status: 404,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}

function redirectTo(path: string, url: URL, status: 301 | 302): Response {
  const next = new URL(path, url.origin);
  next.search = url.search;
  return redirect(next.toString(), status);
}

function redirect(location: string, status: 301 | 302 | 307): Response {
  return new Response(null, {
    status,
    headers: {
      Location: location,
      "Cache-Control": "no-store",
    },
  });
}

async function proxyEmu(pathname: string, method: string): Promise<Response | null> {
  const match = EMU_PROXY.exec(pathname);
  if (!match) return null;
  if (method !== "GET" && method !== "HEAD") {
    return new Response("Method Not Allowed", { status: 405, headers: { Allow: ALLOWED } });
  }
  const kind = match[1];
  const rest = match[2];
  if (!rest || rest.includes("..") || rest.includes("//")) {
    return new Response("Bad Request", { status: 400 });
  }
  // Only the demo games are still offered (src/shared/demo-roms.ts); the retired catalogue's ROMs are not served.
  if (kind === "roms" && !DEMO_ROM_FILES.has(rest)) {
    return new Response("Not Found", { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  const key = kind === "roms" ? `games/roms/${rest}` : `games/emu/${rest}`;
  const upstream = await fetch(`https://s3.cv.cm/files/${key}`);
  if (!upstream.ok) {
    return new Response("Not Found", {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }
  const headers = new Headers(upstream.headers);
  headers.delete("Access-Control-Allow-Origin");
  headers.set("Cache-Control", "public, max-age=86400");
  if (method === "HEAD") {
    return new Response(null, { status: 200, headers });
  }
  return new Response(upstream.body, { status: 200, headers });
}

async function proxyAi(pathname: string, method: string): Promise<Response | null> {
  const match = AI_PROXY.exec(pathname);
  if (!match) return null;
  if (method !== "GET" && method !== "HEAD") {
    return new Response("Method Not Allowed", { status: 405, headers: { Allow: ALLOWED } });
  }
  const rest = match[2];
  if (!rest || rest.includes("..") || rest.includes("//")) {
    return new Response("Bad Request", { status: 400 });
  }
  // Only catalog files: our own exports from s3.cv.cm, the rest straight from their publisher (Hugging Face, the npm
  // CDN), so nothing has to be uploaded. Visitors (mainland China included) only ever talk to cv.cm.
  const source = upstreamUrl(match[1] as "models" | "ort", rest);
  if (!source) return aiNotFound(method);
  // Cached under our own stable URL: Hugging Face redirects every download to a freshly signed CDN URL, which the
  // fetch cache would never hit again. Every path names a pinned revision, so a year is safe.
  const key = new Request(`https://cv.cm${pathname}`);
  const cache = typeof caches === "undefined" ? null : (caches as unknown as { default: Cache }).default;
  const hit = await cache?.match(key);
  if (hit) return aiResponse(hit, rest, method);
  const upstream = await fetch(source, { method });
  // Hugging Face answers 401 for a missing or gated repo: all three mean the file is not there.
  if (upstream.status === 401 || upstream.status === 403 || upstream.status === 404) return aiNotFound(method);
  // Rate limits and outages are not "missing file": a retry may work, so never a cached 404.
  if (!upstream.ok) return new Response(null, { status: 502, headers: { "Cache-Control": "no-store" } });
  const size = Number(upstream.headers.get("Content-Length"));
  if (method === "GET" && cache && size > 0 && size <= CACHE_MAX_BYTES) {
    // Stored whole, then served from the cache: no tee, so a slow visitor never makes the isolate buffer the file.
    try {
      await cache.put(key, new Response(upstream.body, {
        headers: { "Content-Type": aiContentType(rest), "Content-Length": String(size), "Cache-Control": "public, max-age=31536000, immutable" },
      }));
      const stored = await cache.match(key);
      if (stored) return aiResponse(stored, rest, method);
    } catch (err) {
      console.warn("ai cache put failed", pathname, err);
    }
    // The body went to the failed put: fetch it again for the visitor.
    return aiResponse(await fetch(source), rest, method);
  }
  // Larger files (Whisper, Janus) stream through each time.
  return aiResponse(upstream, rest, method);
}

/** Files up to this size are cached whole at the edge; bigger ones stream from the publisher. */
const CACHE_MAX_BYTES = 100_000_000;

function aiNotFound(method: string): Response {
  // A real 404: Transformers.js probes optional files and must not get the SPA's index.html.
  return new Response(method === "HEAD" ? null : "Not Found", {
    status: 404,
    headers: { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" },
  });
}

function aiResponse(upstream: Response, path: string, method: string): Response {
  const headers = new Headers({ "Content-Type": aiContentType(path) });
  for (const name of ["ETag", "Last-Modified"]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  // A compressed upstream body arrives decoded, so its Content-Length would be wrong: pass it only when unencoded.
  const length = upstream.headers.get("Content-Length");
  if (length && !upstream.headers.get("Content-Encoding")) headers.set("Content-Length", length);
  return new Response(method === "HEAD" ? null : upstream.body, { status: 200, headers });
}

/**
 * Covers live on s3.cv.cm only (not as Worker assets): built pages link there directly (scripts/cover-origin.mjs).
 * Older /covers/ URLs (cached pages, image search, shared og:image links) are sent on, keeping the ?v=.
 */
function coverRedirect(url: URL, method: string): Response | null {
  const match = COVER_PATH.exec(url.pathname);
  if (!match) return null;
  if (method !== "GET" && method !== "HEAD") {
    return new Response("Method Not Allowed", { status: 405, headers: { Allow: ALLOWED } });
  }
  const rest = match[1];
  if (!rest || rest.includes("..") || rest.includes("//")) {
    return new Response("Bad Request", { status: 400 });
  }
  return new Response(null, {
    status: 301,
    headers: { Location: `${COVER_ORIGIN}/covers/${rest}${url.search}` },
  });
}

function withHeaders(res: Response, pathname: string): Response {
  const headers = new Headers(res.headers);
  headers.delete("Access-Control-Allow-Origin");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "no-referrer");
  const player =
    pathname === "/emu/player.html" ||
    pathname === "/emu/player" ||
    pathname === "/emu/player/" ||
    pathname === "/emu/flash.html" ||
    pathname === "/emu/flash" ||
    pathname === "/emu/flash/";
  const emuShell = player || pathname === "/emu/player.js" || pathname === "/emu/flash.js";
  if (player) headers.delete("X-Frame-Options");
  else headers.set("X-Frame-Options", "DENY");
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  headers.set("Cross-Origin-Resource-Policy", "same-origin");
  // Agent discovery files are public documentation: let agents running in any page read them.
  if (isAgentDocPath(pathname)) {
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("Cross-Origin-Resource-Policy", "cross-origin");
  }
  // AI tool pages (and the scripts their workers run) are cross-origin isolated: ONNX Runtime needs
  // SharedArrayBuffer for threaded WebAssembly. `credentialless` still lets images from other sites load.
  const aiPage = isAiToolPath(pathname);
  const script = pathname.startsWith("/assets/") && /\.m?js$/.test(pathname);
  if (aiPage || script || pathname.startsWith("/ai/")) headers.set("Cross-Origin-Embedder-Policy", "credentialless");
  // Same list the client compares before navigating, so headers and in-app links agree.
  const devices = devicePolicyOf(pathname).split(" ");
  headers.set(
    "Permissions-Policy",
    // Mic pages (MIC_TOOLS) may record from the microphone, the webcam test may use the camera and the screen recorder may
    // capture the screen; every other page keeps them off.
    `camera=(${devices.includes("camera") ? "self" : ""}), microphone=(${devices.includes("microphone") ? "self" : ""}), display-capture=(${devices.includes("display-capture") ? "self" : ""}), geolocation=(), interest-cohort=(), usb=()`,
  );
  // AI pages and scripts get WebAssembly and no GA hosts (as before); citation pages add the lookup hosts.
  const wasm = aiPage || script;
  headers.set("Content-Security-Policy", player ? EMU_CSP : cspFor({ analytics: !wasm && isTrackedPath(pathname), wasm, lookup: !wasm && isLookupToolPath(pathname) }));
  if (pathname === "/api/device/ip") {
    headers.set("Cache-Control", "private, no-store");
    headers.set("CDN-Cache-Control", "no-store");
    headers.set("X-Robots-Tag", "noindex");
  } else if (res.status !== 200 || emuShell) {
    headers.set("Cache-Control", "no-store");
  } else if (pathname.startsWith("/assets/") || pathname.startsWith("/ai/")) {
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
  } else if (pathname === "/favicon.svg" || pathname.endsWith(".html") || isAgentDocPath(pathname) || !STATIC_FILE.test(pathname)) {
    headers.set("Cache-Control", "no-cache");
  } else {
    headers.set("Cache-Control", "public, max-age=86400");
  }
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}
