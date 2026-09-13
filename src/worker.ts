import { handleClipApi } from "./clip-api";
import { d1Store, type D1Database } from "./clip-store";
import { cookieValue, LOCALE_COOKIE, negotiateLocale } from "./shared/locale";
import { appHref, learnHref, parseAppPath, STATIC_FILE } from "./shared/path";
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
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

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
    if (!STATIC_FILE.test(path)) {
      const parsed = parseAppPath(path);
      const locale = negotiateLocale(
        request.headers.get("Accept-Language"),
        cookieValue(request.headers.get("Cookie"), LOCALE_COOKIE),
      );

      if (parsed.kind === "clip") {
        return redirect(new URL(appHref(locale, "clip", parsed.id), url.origin).toString(), 302);
      }
      if (parsed.kind === "bare") {
        return redirect(new URL(appHref(locale, parsed.tool, parsed.clipId), url.origin).toString(), 302);
      }
      if (parsed.kind === "bare-learn") {
        return redirect(new URL(learnHref(locale, parsed.tutorial), url.origin).toString(), 302);
      }
      if (parsed.kind === "unknown") {
        return redirect(new URL(appHref(locale, null), url.origin).toString(), 302);
      }
      if (parsed.kind === "app") {
        const canonical = appHref(parsed.locale, parsed.tool, parsed.clipId);
        if (path !== canonical) {
          return redirect(new URL(canonical, url.origin).toString(), 301);
        }
      }
      if (parsed.kind === "learn") {
        const canonical = learnHref(parsed.locale, parsed.tutorial);
        if (path !== canonical) {
          return redirect(new URL(canonical, url.origin).toString(), 301);
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
      && (parsed.kind === "app" || parsed.kind === "learn" || path === "/" || path === "/index.html")
    ) {
      const html = await assetResponse.text();
      const locale = parsed.kind === "app" || parsed.kind === "learn"
        ? parsed.locale
        : negotiateLocale(
          request.headers.get("Accept-Language"),
          cookieValue(request.headers.get("Cookie"), LOCALE_COOKIE),
        );
      const seo = parsed.kind === "learn"
        ? { learn: true as const, tutorial: parsed.tutorial }
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

function redirect(location: string, status: 301 | 302 | 307): Response {
  return new Response(null, {
    status,
    headers: {
      Location: location,
      "Cache-Control": "no-store",
    },
  });
}

function withHeaders(res: Response, pathname: string): Response {
  const headers = new Headers(res.headers);
  headers.delete("Access-Control-Allow-Origin");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  headers.set("Cross-Origin-Resource-Policy", "same-origin");
  headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=(), usb=()",
  );
  headers.set("Content-Security-Policy", CSP);
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
