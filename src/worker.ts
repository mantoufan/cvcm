import { cookieValue, LOCALE_COOKIE, negotiateLocale } from "./shared/locale";
import { appHref, parseAppPath, STATIC_FILE } from "./shared/path";

export interface Env {
  ASSETS: { fetch: (request: Request | string) => Promise<Response> };
}

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  "connect-src 'none'",
  "media-src blob:",
  "worker-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const ALLOWED = "GET, HEAD";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
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

    const url = new URL(request.url);
    if (url.hostname === "www.cv.cm") {
      url.hostname = "cv.cm";
      return redirect(url.toString(), 301);
    }

    const path = url.pathname;
    if (!STATIC_FILE.test(path)) {
      const parsed = parseAppPath(path);
      const locale = negotiateLocale(
        request.headers.get("Accept-Language"),
        cookieValue(request.headers.get("Cookie"), LOCALE_COOKIE),
      );

      if (parsed.kind === "bare") {
        return redirect(new URL(appHref(locale, parsed.tool), url.origin).toString(), 302);
      }
      if (parsed.kind === "unknown") {
        return redirect(new URL(appHref(locale, null), url.origin).toString(), 302);
      }
      if (parsed.kind === "app") {
        const canonical = appHref(parsed.locale, parsed.tool);
        if (path !== canonical) {
          return redirect(new URL(canonical, url.origin).toString(), 301);
        }
      }
    }

    let assetResponse = await env.ASSETS.fetch(request);
    if (assetResponse.status === 404 && !STATIC_FILE.test(path)) {
      assetResponse = await env.ASSETS.fetch(new URL("/index.html", url.origin).toString());
    }
    return withHeaders(assetResponse, path);
  },
};

function redirect(location: string, status: 301 | 302): Response {
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
