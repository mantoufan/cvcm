import type { Locale } from "../../shared/locale";
import type { RefId } from "../../shared/ref";
import { refPageHtml } from "../../shared/ref-i18n";

/** The reference hub (null) or one entry. Static text, so the page is the same HTML the Worker serves. */
export function mountRef(host: HTMLElement, locale: Locale, id: RefId | null): void {
  host.innerHTML = refPageHtml(locale, id);
}
