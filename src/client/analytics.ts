import { GA_ID, GA_SCRIPT_HOST, isTrackedPath } from "../shared/analytics";

type Gtag = (...args: unknown[]) => void;
type GaWindow = Window & { dataLayer?: unknown[]; gtag?: Gtag } & Record<string, unknown>;

// Campaign parameters GA and Google Ads need for attribution; every other query parameter is dropped.
const KEPT_PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "utm_id", "gclid", "gbraid", "wbraid", "dclid"];
// GA's enhanced measurement reads these from the real URL as a site-search term when gtag.js loads.
const SEARCH_PARAMS = ["q", "s", "search", "query", "keyword"];

let queued = false;
let injected = false;
// The Worker sends untracked pages a CSP without the GA hosts, and that CSP stays for the whole SPA
// session, so a visit that starts on one never loads gtag.
const bootTracked = typeof location !== "undefined" && isTrackedPath(location.pathname);

function enabled(): boolean {
  return import.meta.env.PROD && location.hostname === "cv.cm" && bootTracked;
}

/** Report one SPA page view. File tools and clip notes report nothing and switch an already loaded gtag off. */
export function trackPageView(): void {
  if (!enabled()) return;
  const w = window as unknown as GaWindow;
  const tracked = isTrackedPath(location.pathname);
  // Google's documented opt-out flag: while true, gtag sends no hits at all (including enhanced measurement).
  w[`ga-disable-${GA_ID}`] = !tracked;
  if (!tracked) return;
  if (!queued) {
    queued = true;
    w.dataLayer = w.dataLayer || [];
    w.gtag = function gtag() {
      // gtag.js reads the arguments object, not an array.
      // eslint-disable-next-line prefer-rest-params
      w.dataLayer!.push(arguments);
    };
    w.gtag("js", new Date());
    w.gtag("config", GA_ID, { send_page_view: false, page_location: pageLocation() });
  }
  w.gtag!("event", "page_view", {
    page_location: pageLocation(),
    page_title: document.title,
    language: document.documentElement.lang,
  });
  // Events wait in dataLayer until gtag.js loads on a URL without a search-like parameter.
  const params = new URLSearchParams(location.search);
  if (!injected && !SEARCH_PARAMS.some((key) => params.has(key))) {
    injected = true;
    const script = document.createElement("script");
    script.async = true;
    script.src = `${GA_SCRIPT_HOST}/gtag/js?id=${GA_ID}`;
    document.head.append(script);
  }
}

/** Path plus campaign parameters only: other queries and fragments can carry user data. */
function pageLocation(): string {
  const params = new URLSearchParams(location.search);
  const kept = new URLSearchParams();
  for (const key of KEPT_PARAMS) {
    const value = params.get(key);
    if (value !== null) kept.set(key, value);
  }
  const query = kept.toString();
  return `${location.origin}${location.pathname}${query ? `?${query}` : ""}`;
}
