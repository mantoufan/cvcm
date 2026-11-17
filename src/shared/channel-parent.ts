/**
 * Where the reference channels sit in the site's tree, for their breadcrumb trails (HTML and BreadcrumbList JSON-LD):
 * country profiles, food calories and the periodic table belong to Data (`/datasets/`, whose hub links them); the
 * calendar belongs to Tools (the home page's tool wall lists it under Time). The URLs stay short and top-level.
 */
import type { Locale } from "./locale";
import { escapeHtml } from "./device-i18n";
import { messages } from "./messages";
import { appHref, datasetHref } from "./path";

const ORIGIN = "https://cv.cm";

/** "Data" as a breadcrumb link (HTML). */
export function dataCrumbHtml(locale: Locale): string {
  return `<a href="${escapeHtml(datasetHref(locale))}" data-nav="datasets">${escapeHtml(messages(locale).ui.nav.data)}</a>`;
}

/** "Data" as a BreadcrumbList item. */
export function dataCrumbItem(locale: Locale): { name: string; item: string } {
  return { name: messages(locale).ui.nav.data, item: `${ORIGIN}${datasetHref(locale)}` };
}

/**
 * "Tools" as a breadcrumb link (HTML): the home page's tool wall. Tool pages leave this step out of their JSON-LD
 * (it is an anchor on the home page, not a page of its own), and so does the calendar.
 */
export function toolsCrumbHtml(locale: Locale): string {
  return `<a href="${escapeHtml(`${appHref(locale, null)}#tools`)}" data-nav="tools">${escapeHtml(messages(locale).ui.nav.tools)}</a>`;
}
