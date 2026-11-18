/**
 * The citation generator's only network requests: when the visitor presses Find, the DOI is sent to Crossref (and to
 * DataCite when Crossref does not know it: arXiv, Zenodo, datasets) or the ISBN to Open Library (GET, no cookies, no
 * Referer). Nothing else typed on the page leaves the browser. The hosts are allowed only in the citation pages' CSP
 * (LOOKUP_TOOLS and LOOKUP_HOSTS in path.ts).
 */
import { classifyLookup, dataciteUrl, fromCrossref, fromDataCite, fromOpenLibrary, lookupUrl, type Work } from "../../shared/citation";

export type LookupResult = { ok: true; work: Work } | { ok: false; reason: "invalid" | "notFound" | "network" };

export async function lookup(raw: string, timeoutMs = 12_000): Promise<LookupResult> {
  const q = classifyLookup(raw);
  if (!q) return { ok: false, reason: "invalid" };
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const init: RequestInit = { method: "GET", credentials: "omit", referrerPolicy: "no-referrer", signal: ctrl.signal };
    const url = lookupUrl(q);
    let res = await fetch(url, init);
    let fromDc = false;
    // A DOI Crossref does not hold may be a DataCite one (arXiv 10.48550/…, Zenodo 10.5281/…).
    if (res.status === 404 && q.kind === "doi") {
      const dcUrl = dataciteUrl(q.value);
      res = await fetch(dcUrl, init);
      fromDc = true;
    }
    if (res.status === 404) return { ok: false, reason: "notFound" };
    if (!res.ok) return { ok: false, reason: "network" };
    const json: unknown = await res.json();
    const work = q.kind === "isbn" ? fromOpenLibrary(json, q.value) : fromDc ? fromDataCite(json) : fromCrossref(json);
    if (!work) return { ok: false, reason: "notFound" };
    return { ok: true, work };
  } catch {
    return { ok: false, reason: "network" };
  } finally {
    window.clearTimeout(timer);
  }
}
