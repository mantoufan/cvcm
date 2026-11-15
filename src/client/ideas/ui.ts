import type { Locale } from "../../shared/locale";
import type { IdeaId } from "../../shared/ideas";
import { ideasPageHtml } from "../../shared/ideas-i18n";

/** The ideas hub (null) or one idea. Static text and an SVG chart, so the page is the same HTML the Worker serves. */
export function mountIdeas(host: HTMLElement, locale: Locale, id: IdeaId | null): void {
  host.innerHTML = ideasPageHtml(locale, id);
}
