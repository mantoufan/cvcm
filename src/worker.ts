import { handleClipApi } from "./clip-api";
import { d1Store, type D1Database } from "./clip-store";
import { cookieValue, LOCALE_COOKIE, negotiateLocale } from "./shared/locale";
import { appHref, gamesHref, isPublishedTutorial, learnHref, parseAppPath, STATIC_FILE } from "./shared/path";
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

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data: https:",
  "font-src 'self'",
  "connect-src 'self' https://files.s3.cv.cm https://s3.cv.cm",
  "media-src blob: https:",
  "worker-src 'self' blob:",
  "frame-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const EMU_CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval' 'unsafe-eval'",
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

const EMU_PROXY = /^\/emu\/(data|roms)\/([A-Za-z0-9._/-]+)$/;

const ALLOWED = "GET, HEAD";

function s3Config(env: Env): S3Config | null {
  if (!env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) return null;
  return {
    accessKey: env.S3_ACCESS_KEY_ID,
    secret: env.S3_SECRET_ACCESS_KEY,
    host: env.S3_HOST || "files.s3.cv.cm",
    bucket: env.S3_BUCKET || "files",
    region: env.S3_REGION || "us-east-1",
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.hostname === "www.cv.cm") {
      url.hostname = "cv.cm";
      const status = request.method === "GET" || request.method === "HEAD" ? 301 : 307;
      return redirect(url.toString(), status);
    }

    const store = env.DB ? d1Store(env.DB) : null;
    const api = await handleClipApi(request, { store, s3: s3Config(env) });
    if (api) return api;

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: {
          Allow: ALLOWED,
          "Cache-Control": "no-store",
          "Content-Type": "text/plain; charset=utf-8",
        },
      });
    }

    const path = url.pathname;
    const emu = await proxyEmu(path, request.method);
    if (emu) return withHeaders(emu, path);

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
        return redirectTo(appHref(locale, parsed.tool, parsed.clipId), url, 302);
      }
      if (parsed.kind === "bare-learn") {
        return redirectTo(learnHref(locale, parsed.tutorial), url, 302);
      }
      if (parsed.kind === "bare-games") {
        return redirectTo(gamesHref(locale, parsed.console, parsed.game), url, 302);
      }
      if (parsed.kind === "unknown") {
        return redirectTo(appHref(locale, null), url, 302);
      }
      if (parsed.kind === "app") {
        const canonical = appHref(parsed.locale, parsed.tool, parsed.clipId);
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
    }

    let assetResponse = await env.ASSETS.fetch(request);
    if (assetResponse.status === 404 && !STATIC_FILE.test(path)) {
      assetResponse = await env.ASSETS.fetch(new URL("/index.html", url.origin).toString());
    }

    const type = assetResponse.headers.get("content-type") || "";
    const parsed = parseAppPath(path);
    if (
      type.includes("text/html")
      && (parsed.kind === "app" || parsed.kind === "learn" || parsed.kind === "games" || path === "/" || path === "/index.html")
    ) {
      const html = await assetResponse.text();
      const locale = parsed.kind === "app" || parsed.kind === "learn" || parsed.kind === "games"
        ? parsed.locale
        : negotiateLocale(
          request.headers.get("Accept-Language"),
          cookieValue(request.headers.get("Cookie"), LOCALE_COOKIE),
        );
      const seo = parsed.kind === "learn"
        ? { learn: true as const, tutorial: parsed.tutorial }
        : parsed.kind === "games"
          ? { games: true as const, console: parsed.console, game: parsed.game }
          : parsed.kind === "app"
            ? { tool: parsed.tool, clipId: parsed.clipId }
            : { tool: null };
      const headers = new Headers(assetResponse.headers);
      headers.set("Content-Type", "text/html; charset=utf-8");
      return withHeaders(
        new Response(applyHtmlSeo(html, locale, seo), {
          status: assetResponse.status,
          headers,
        }),
        path,
      );
    }
    return withHeaders(assetResponse, path);
  },
};

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
  const key = kind === "data" ? `games/emu/${rest}` : `games/roms/${rest}`;
  const upstream = await fetch(`https://files.s3.cv.cm/${key}`);
  if (!upstream.ok) {
    return new Response("Not Found", { status: 404 });
  }
  const headers = new Headers(upstream.headers);
  headers.delete("Access-Control-Allow-Origin");
  headers.set("Cache-Control", "public, max-age=86400");
  if (method === "HEAD") {
    return new Response(null, { status: 200, headers });
  }
  return new Response(upstream.body, { status: 200, headers });
}

function withHeaders(res: Response, pathname: string): Response {
  const headers = new Headers(res.headers);
  headers.delete("Access-Control-Allow-Origin");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "no-referrer");
  const player = pathname === "/emu/player.html";
  if (player) headers.delete("X-Frame-Options");
  else headers.set("X-Frame-Options", "DENY");
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  headers.set("Cross-Origin-Resource-Policy", "same-origin");
  headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=(), usb=()",
  );
  headers.set("Content-Security-Policy", player ? EMU_CSP : CSP);
  if (pathname.startsWith("/assets/")) {
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
  } else if (pathname === "/favicon.svg" || pathname.endsWith(".html") || !STATIC_FILE.test(pathname)) {
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
