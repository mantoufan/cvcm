import type { Locale } from "../../shared/locale";
import type { SlangId } from "../../shared/slang";
import { slangPageHtml } from "../../shared/slang-i18n";

/** The slang hub (null) or one entry. Static text, so the page is the same HTML the Worker serves. */
export function mountSlang(host: HTMLElement, locale: Locale, id: SlangId | null): void {
  host.innerHTML = slangPageHtml(locale, id);
}
