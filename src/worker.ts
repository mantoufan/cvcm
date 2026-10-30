import "./shared/messages-all";
import { handleClipApi } from "./clip-api";
import { d1Store, type D1Database } from "./clip-store";
import { cookieValue, DEFAULT_LOCALE, LOCALE_COOKIE, negotiateLocale, type Locale } from "./shared/locale";
import { isIpAddress } from "./shared/device";
import { appHref, datasetHref, deviceHref, gamesHref, isAgentDocPath, isAiToolPath, isPublishedTutorial, kbHref, learnHref, legalHref, parseAppPath, quizHref, STATIC_FILE, toolJob } from "./shared/path";
import { GA_CONNECT_HOSTS, GA_SCRIPT_HOST, isTrackedPath } from "./shared/analytics";
import { thumbOriginal } from "./shared/covers";
import { preloadLocalePack, preloadPageChunk } from "./shared/locale-preload";
import { DATASET_FILES } from "./shared/datasets";
import { applyHtmlSeo } from "./shared/seo";
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

function siteCsp(analytics: boolean, wasm = false): string {
  return [
    "default-src 'self'",
    analytics
      ? `script-src 'self' ${GA_SCRIPT_HOST}`
      // AI tools: ONNX Runtime compiles WebAssembly and imports its loader from a blob: URL (in the worker).
      : wasm ? "script-src 'self' 'wasm-unsafe-eval' blob:" : "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data: https:",
    "font-src 'self'",
    analytics ? `connect-src 'self' https://s3.cv.cm ${GA_CONNECT_HOSTS.join(" ")}` : "connect-src 'self' https://s3.cv.cm",
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

// File tools and clip notes get a CSP without the analytics hosts (AGENTS.md rule 1).
const CSP = siteCsp(false);
const CSP_ANALYTICS = siteCsp(true);
// AI tool pages, and scripts (a worker takes its CSP from its own script's response, not the page's).
const CSP_AI = siteCsp(false, true);

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
const COVER_PROXY = /^\/covers\/([A-Za-z0-9._/-]+)$/;

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
    if (path === "/api/device/ip") return withHeaders(deviceIpResponse(request), path);
    const emu = await proxyEmu(path, request.method);
    if (emu) return withHeaders(emu, path);
    const cover = await proxyCovers(path, request.method);
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
        return redirectTo(gamesHref(locale, parsed.console, parsed.game), url, 302);
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
      if (parsed.kind === "bare-kb") {
        return redirectTo(kbHref(locale, parsed.article), url, 302);
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
        const canonical = gamesHref(parsed.locale, parsed.console, parsed.game);
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
      if (parsed.kind === "kb") {
        const canonical = kbHref(parsed.locale, parsed.article);
        if (path !== canonical) {
          return redirectTo(canonical, url, 301);
        }
      }
    }

    // Fetch the page's prerendered body alongside the page itself.
    const ssr = request.method === "GET" ? prerendered(env, url.origin, ssrPath(parseAppPath(path), path)) : Promise.resolve(null);
    // Page HTML is rebuilt per request (locale, prerendered body), so index.html's ETag must not answer for it:
    // drop the conditional headers on page routes and the validators from the page response below.
    let assetResponse = await env.ASSETS.fetch(STATIC_FILE.test(path) ? request : unconditional(request));
    if (COVER_PROXY.test(path)) {
      const type = assetResponse.headers.get("content-type") || "";
      const image = type.startsWith("image/") || type.includes("octet-stream");
      if (!image) {
        return new Response(request.method === "HEAD" ? null : "Not Found", {
          status: 404,
          headers: {
            "Cache-Control": "no-store",
            "CDN-Cache-Control": "no-store",
            "Content-Type": "text/plain; charset=utf-8",
          },
        });
      }
    }
    const thumbFallback = thumbOriginal(path);
    // Missing files come back as the SPA's index.html (or a 404); a 304 revalidation is passed through.
    const thumbMissing = assetResponse.status === 404 || (assetResponse.headers.get("content-type") || "").includes("text/html");
    if (thumbFallback && thumbMissing) {
      // No thumbnail was built (the cover has no local copy): send the original.
      // Not redirectTo(): that copies the request's (empty) query over the cover's ?v=.
      return redirect(new URL(thumbFallback, url.origin).toString(), 302);
    }
    if (assetResponse.status === 404 && !STATIC_FILE.test(path)) {
      assetResponse = await env.ASSETS.fetch(new URL("/index.html", url.origin).toString());
    }

    const type = assetResponse.headers.get("content-type") || "";
    const parsed = parseAppPath(path);
    if (
      type.includes("text/html")
      && (parsed.kind === "app" || parsed.kind === "learn" || parsed.kind === "games" || parsed.kind === "markets" || parsed.kind === "device" || parsed.kind === "legal" || parsed.kind === "quiz" || parsed.kind === "dataset" || parsed.kind === "kb" || path === "/" || path === "/index.html")
    ) {
      const html = await assetResponse.text();
      const locale = parsed.kind === "app" || parsed.kind === "learn" || parsed.kind === "games" || parsed.kind === "markets" || parsed.kind === "device" || parsed.kind === "legal" || parsed.kind === "quiz" || parsed.kind === "dataset" || parsed.kind === "kb"
        ? parsed.locale
        : negotiateLocale(
          request.headers.get("Accept-Language"),
          cookieValue(request.headers.get("Cookie"), LOCALE_COOKIE),
        );
      const seo = parsed.kind === "learn"
        ? { learn: true as const, tutorial: parsed.tutorial }
        : parsed.kind === "games"
          ? { games: true as const, console: parsed.console, game: parsed.game }
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
            : parsed.kind === "kb"
              ? { kb: true as const, kbId: parsed.article }
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
        : parsed.kind === "kb" ? "kb"
        : parsed.kind === "legal" ? null
        : "home";
      let out = applyHtmlSeo(html, locale, seo, undefined, body);
      out = preloadLocalePack(out, locale, parsed.kind === "games" && Boolean(parsed.game), undefined, parsed.kind === "quiz", parsed.kind === "dataset", parsed.kind === "kb" ? parsed.article ?? "hub" : null);
      out = preloadPageChunk(out, chunk);
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
  if (parsed.kind === "learn" || parsed.kind === "games" || parsed.kind === "device" || parsed.kind === "legal" || parsed.kind === "quiz" || parsed.kind === "dataset" || parsed.kind === "kb") return path;
  return null;
}

/** The page body scripts/prerender.ts rendered for this path, or null (clip notes, a page the prerender skipped). */
async function prerendered(env: Env, origin: string, pagePath: string | null): Promise<string | null> {
  if (!pagePath || !pagePath.startsWith("/") || !pagePath.endsWith("/") || pagePath.includes("..")) return null;
  try {
    const res = await env.ASSETS.fetch(`${origin}${SSR_PREFIX.slice(0, -1)}${pagePath}`);
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
  // Every URL names a pinned revision, so the edge keeps it for a year and s3.cv.cm serves each file about once per PoP.
  const upstream = await fetch(`https://s3.cv.cm/files/ai/${match[1]}/${rest}`, {
    // Only successes are kept: a 404 cached before an upload finished would break the tool at that PoP for a year.
    cf: { cacheEverything: true, cacheTtlByStatus: { "200-299": 31_536_000, "300-599": 0 } },
  } as RequestInit);
  if (!upstream.ok) {
    // A real 404: Transformers.js probes optional files and must not get the SPA's index.html.
    return new Response(method === "HEAD" ? null : "Not Found", {
      status: 404,
      headers: { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  const headers = new Headers();
  for (const name of ["Content-Type", "Content-Length", "ETag", "Last-Modified"]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new Response(method === "HEAD" ? null : upstream.body, { status: 200, headers });
}

async function proxyCovers(pathname: string, method: string): Promise<Response | null> {
  const match = COVER_PROXY.exec(pathname);
  if (!match) return null;
  if (method !== "GET" && method !== "HEAD") {
    return new Response("Method Not Allowed", { status: 405, headers: { Allow: ALLOWED } });
  }
  const rest = match[1];
  if (!rest || rest.includes("..") || rest.includes("//")) {
    return new Response("Bad Request", { status: 400 });
  }
  try {
    const upstream = await fetch(`https://s3.cv.cm/files/covers/${rest}`);
    if (!upstream.ok) return null;
    const headers = new Headers(upstream.headers);
    headers.delete("Access-Control-Allow-Origin");
    headers.set("Cache-Control", "public, max-age=86400");
    if (method === "HEAD") {
      return new Response(null, { status: 200, headers });
    }
    return new Response(upstream.body, { status: 200, headers });
  } catch {
    return null;
  }
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
  headers.set(
    "Permissions-Policy",
    // Speech to text can record from the microphone; every other page keeps it off.
    `camera=(), microphone=(${aiPage && pathname.split("/").includes("speech-to-text") ? "self" : ""}), geolocation=(), interest-cohort=(), usb=()`,
  );
  headers.set("Content-Security-Policy", player ? EMU_CSP : aiPage || script ? CSP_AI : isTrackedPath(pathname) ? CSP_ANALYTICS : CSP);
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
