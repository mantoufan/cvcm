import type { Locale } from "../../shared/locale";
import type { NostalgiaId } from "../../shared/nostalgia";
import { nostalgiaPageHtml } from "../../shared/nostalgia-i18n";

/** The nostalgia hub (null) or one entry. Static text, so the page is the same HTML the Worker serves. */
export function mountNostalgia(host: HTMLElement, locale: Locale, id: NostalgiaId | null): void {
  host.innerHTML = nostalgiaPageHtml(locale, id);
}
