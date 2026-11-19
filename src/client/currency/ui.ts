import type { Locale } from "../../shared/locale";
import { parseMoneyInput } from "../../shared/decimal-input";
import { HREFLANG } from "../../shared/sitemap";
import { currencyHref } from "../../shared/path";
import { isCurrencyPair, type CurrencyPair } from "../../shared/currency";
import { crossRate, currencyMessages, formatMoney, pairData } from "../../shared/currency-i18n";
import { HUB_DEFAULT, currencyPageHtml, resultText, unitText } from "../../shared/currency-page";

/** A typed amount, or null when the field is empty or not a number (negative amounts are not converted). */
function amountOf(locale: Locale, input: HTMLInputElement): number | null {
  const value = parseMoneyInput(input.value, HREFLANG[locale]);
  return value === undefined || !Number.isFinite(value) || value < 0 ? null : value;
}

/** Hub: amount, from, to and swap over every ECB currency, with a link to the pair page when the channel has one. */
function wireHub(host: HTMLElement, locale: Locale): void {
  const amount = host.querySelector<HTMLInputElement>(".fx-amount");
  const from = host.querySelector<HTMLSelectElement>(".fx-from");
  const to = host.querySelector<HTMLSelectElement>(".fx-to");
  const out = host.querySelector<HTMLElement>(".fx-out");
  const unit = host.querySelector<HTMLElement>(".fx-unit");
  const link = host.querySelector<HTMLElement>(".fx-pairlink");
  const swap = host.querySelector<HTMLButtonElement>(".fx-swap");
  if (!amount || !from || !to || !out || !unit || !link || !swap) return;
  const m = currencyMessages(locale);
  // Set the defaults as values, not only `selected` attributes, so every DOM (and the prerender) starts on the same pair.
  [from.value, to.value] = HUB_DEFAULT[locale];
  const paint = (): void => {
    const a = from.value;
    const b = to.value;
    const rate = crossRate(locale, a, b);
    const value = amountOf(locale, amount);
    out.textContent = value === null ? m.hub.invalid : resultText(locale, value, a, b, rate);
    unit.textContent = unitText(locale, a, b, rate);
    const pair = `${a}-${b}`.toLowerCase();
    link.hidden = !isCurrencyPair(pair);
    link.replaceChildren();
    if (isCurrencyPair(pair)) {
      const anchor = document.createElement("a");
      anchor.href = currencyHref(locale, pair);
      anchor.dataset.nav = `currency-${pair}`;
      anchor.textContent = `${a}/${b} →`;
      link.append(anchor);
    }
  };
  amount.addEventListener("input", paint);
  from.addEventListener("change", paint);
  to.addEventListener("change", paint);
  swap.addEventListener("click", () => {
    const a = from.value;
    from.value = to.value;
    to.value = a;
    paint();
  });
  paint();
}

/** Pair: typing in either amount fills the other at the snapshot rate. */
function wirePair(host: HTMLElement, locale: Locale, pair: CurrencyPair): void {
  const a = host.querySelector<HTMLInputElement>(".fx-a");
  const b = host.querySelector<HTMLInputElement>(".fx-b");
  const out = host.querySelector<HTMLElement>(".fx-out");
  if (!a || !b || !out) return;
  const m = currencyMessages(locale);
  const rate = pairData(locale, pair).rate;
  const [fromCode, toCode] = pair.toUpperCase().split("-");
  a.addEventListener("input", () => {
    const value = amountOf(locale, a);
    b.value = value === null ? "" : formatMoney(locale, value * rate);
    out.textContent = value === null ? m.hub.invalid : resultText(locale, value, fromCode, toCode, rate);
  });
  b.addEventListener("input", () => {
    const value = amountOf(locale, b);
    a.value = value === null ? "" : formatMoney(locale, value / rate);
    out.textContent = value === null ? m.hub.invalid : resultText(locale, value, toCode, fromCode, 1 / rate);
  });
}

/** The exchange-rate hub (null) or one pair: the same HTML the Worker serves, then the converter is wired. */
export function mountCurrency(host: HTMLElement, locale: Locale, pair: CurrencyPair | null): void {
  host.innerHTML = currencyPageHtml(locale, pair);
  if (pair) wirePair(host, locale, pair);
  else wireHub(host, locale);
}
