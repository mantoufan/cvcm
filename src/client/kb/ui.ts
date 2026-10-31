import type { Locale } from "../../shared/locale";
import type { KbPage } from "../../shared/kb";
import { kbPageHtml } from "../../shared/kb-i18n";

/** A kb hub or one article. Static text, so the page is the same HTML the Worker serves. */
export function mountKb(host: HTMLElement, locale: Locale, page: KbPage): void {
  host.innerHTML = kbPageHtml(locale, page);
}
