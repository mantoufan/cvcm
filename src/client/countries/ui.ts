import type { Locale } from "../../shared/locale";
import { countriesPageHtml } from "../../shared/countries-page";

/** The countries hub (null) or one profile. Static HTML, the same the Worker serves. */
export function mountCountries(host: HTMLElement, locale: Locale, slug: string | null): void {
  host.innerHTML = countriesPageHtml(locale, slug);
}
