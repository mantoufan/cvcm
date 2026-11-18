/**
 * The exchange-rate channel under `/{locale}/currency/` (hub: a converter across every ECB currency and the pair list)
 * and `/{locale}/currency/{from}-{to}/` (one page per pair, lowercase ISO codes). Data: the ECB euro foreign exchange
 * reference rates (reuse with the source named), snapshotted by `node scripts/fetch-currency.mjs`; cross rates go
 * through the euro. Pages never call the ECB.
 *
 * This module is in the main bundle (path parsing needs the pairs): keep it to pair ids. Rates and copy travel in the
 * currency pack (`src/locales/packs/currency-<locale>.ts`).
 */
import PAIRS from "./currency-pairs.json";
import { CURRENCY_SNAPSHOT } from "./currency-asof";

export { CURRENCY_SNAPSHOT };

export const CURRENCY_SEGMENT = "currency";

/** A pair id: two lowercase ISO 4217 codes, "usd-cny". */
export type CurrencyPair = string;

/** A currency page: the hub, one pair, or none. */
export type CurrencyPage = CurrencyPair | "hub" | null;

export const CURRENCY_PAIRS: readonly CurrencyPair[] = PAIRS;

/** The day the channel went live (the hub's datePublished). */
export const CURRENCY_PUBLISHED = "2026-11-18";

const PAIR_SET: ReadonlySet<string> = new Set(PAIRS);

export function isCurrencyPair(value: string): value is CurrencyPair {
  return PAIR_SET.has(value);
}

/** "usd-cny" → ["USD", "CNY"]. */
export function pairCodes(pair: CurrencyPair): [string, string] {
  const [from, to] = pair.toUpperCase().split("-");
  return [from, to];
}

/** The pair the other way round when the channel has it ("usd-cny" → "cny-usd"), else null. */
export function reversePair(pair: CurrencyPair): CurrencyPair | null {
  const [from, to] = pair.split("-");
  const back = `${to}-${from}`;
  return PAIR_SET.has(back) ? back : null;
}

/** Pairs the site footer links directly (shown by their codes, so no copy is needed). */
export const CURRENCY_FOCUS = ["usd-cny", "usd-jpy", "eur-usd", "usd-krw", "usd-idr", "usd-mxn", "jpy-cny", "gbp-usd"] as const satisfies readonly CurrencyPair[];
