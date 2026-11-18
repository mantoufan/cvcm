/**
 * Where the reference channels sit in the site's tree, for their breadcrumb trails (HTML and BreadcrumbList JSON-LD):
 * country profiles, food calories, the periodic table, emoji meanings, exchange rates and dog and cat breeds belong to Data (`/datasets/`, whose hub links them); the
 * calendar belongs to Tools (the home page's tool wall lists it under Time). The URLs stay short and top-level.
 */
import type { Locale } from "./locale";
import { escapeHtml } from "./device-i18n";
import { messages } from "./messages";
import { appHref, breedsHref, caloriesHref, countriesHref, datasetHref, elementsHref, emojiHref, currencyHref } from "./path";

const ORIGIN = "https://cv.cm";

/** The reference channels the Data hub lists under "Reference", in order; `copy` names their hub copy in the datasets pack. */
export const DATA_REFERENCE = [
  { copy: "countries", nav: "countries", href: (locale: Locale): string => countriesHref(locale) },
  { copy: "calories", nav: "calories", href: (locale: Locale): string => caloriesHref(locale) },
  { copy: "elements", nav: "elements", href: (locale: Locale): string => elementsHref(locale) },
  { copy: "emoji", nav: "emoji", href: (locale: Locale): string => emojiHref(locale) },
  { copy: "currency", nav: "currency", href: (locale: Locale): string => currencyHref(locale) },
  { copy: "breeds", nav: "breeds", href: (locale: Locale): string => breedsHref(locale) },
] as const;

/** The Tools step of a trail: the home page's tool wall. Shared by tool pages (main.ts) and the calendar. */
export function toolsCrumb(locale: Locale): { label: string; href: string; nav: "tools" } {
  return { label: messages(locale).ui.nav.tools, href: `${appHref(locale, null)}#tools`, nav: "tools" };
}

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
  const crumb = toolsCrumb(locale);
  return `<a href="${escapeHtml(crumb.href)}" data-nav="${crumb.nav}">${escapeHtml(crumb.label)}</a>`;
}
