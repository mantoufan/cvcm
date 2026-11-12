import { h } from "./dom";
import { t } from "./i18n";
import { appHref } from "../shared/path";
import type { Locale } from "../shared/locale";

export type Crumb = { label: string; href?: string; nav?: string };

/** The first item of every trail. */
export function homeCrumb(loc: Locale): Crumb {
  return { label: t("nav.home"), href: appHref(loc, null), nav: "home" };
}

/**
 * The trail above a page's heading: the same `nav.device-crumb` markup the column pages (kb, ref, slang, tests, data)
 * build as HTML strings. Items link up the tree; the last one is the current page and is plain text.
 */
export function crumbNav(items: Crumb[]): HTMLElement {
  const kids: Array<Node | string> = [];
  items.forEach((item, i) => {
    if (i > 0) kids.push(" ", h("span", { "aria-hidden": "true" }, "/"), " ");
    kids.push(item.href
      ? h("a", { href: item.href, "data-nav": item.nav }, item.label)
      : h("span", { "aria-current": i === items.length - 1 ? "page" : null }, item.label));
  });
  return h("nav", { class: "device-crumb", "aria-label": t("nav.breadcrumb") }, ...kids);
}
