import type { Locale } from "../../shared/locale";
import type { KbId } from "../../shared/kb";
import { kbPageHtml } from "../../shared/kb-i18n";

/** The knowledge hub (id null) or one article. Static text, so the page is the same HTML the Worker serves. */
export function mountKb(host: HTMLElement, locale: Locale, id: KbId | null): void {
  host.innerHTML = kbPageHtml(locale, id);
}
