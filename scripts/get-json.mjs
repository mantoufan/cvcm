// JSON GET with retries and the pageviews date key, shared by the meme scripts (fetch-meme.mjs, meme-candidates.mjs).
// 404 → null. Network errors, 429 and 5xx are retried twice with backoff; any other client error (bad id, bad key) will
// not fix itself, so it throws at once with the start of the response body.
/** A UTC date as Wikimedia pageviews' YYYYMMDD. */
export const pageviewsDay = (d) => d.toISOString().slice(0, 10).replaceAll("-", "");

export function jsonGetter(userAgent) {
  return async function getJson(url, headers = {}) {
    for (let attempt = 1; ; attempt += 1) {
      const res = await fetch(url, { headers: { "User-Agent": userAgent, ...headers }, signal: AbortSignal.timeout(60_000) }).catch((error) => ({ ok: false, status: 0, error }));
      if (res.ok) return res.json();
      if (res.status === 404) return null;
      const final = attempt >= 3 || (res.status >= 400 && res.status < 500 && res.status !== 429);
      if (final) throw new Error(`${res.status || res.error?.message} ${url}${res.text ? `: ${(await res.text()).slice(0, 300)}` : ""}`);
      // Release the failed response before waiting, so a rate-limit burst does not hold connections open.
      await res.body?.cancel?.().catch(() => {});
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  };
}
