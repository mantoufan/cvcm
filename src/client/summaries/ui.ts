import type { Locale } from "../../shared/locale";
import type { SummaryId } from "../../shared/summaries";
import { summariesPageHtml } from "../../shared/summaries-page";

/** The summaries hub (null) or one work. Static text, so the page is the same HTML the Worker serves. */
export function mountSummaries(host: HTMLElement, locale: Locale, id: SummaryId | null): void {
  host.innerHTML = summariesPageHtml(locale, id);
}
