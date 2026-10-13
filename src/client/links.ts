import { h } from "./dom";

export type LinkItem = {
  href: string;
  name: string;
  blurb?: string;
  /** Small line above the name (console · genre, minutes). */
  meta?: string;
  nav?: string;
};

/** A plain list of text links: the site's only "card". No covers, so lists cost no image requests. */
export function linkList(items: LinkItem[], cls = ""): HTMLElement {
  return h("ul", { class: "links" + (cls ? ` ${cls}` : "") }, ...items.map(linkItem));
}

export function linkItem(item: LinkItem): HTMLElement {
  return h("li", null,
    h("a", { href: item.href, "data-nav": item.nav },
      item.meta ? h("small", null, item.meta) : null,
      h("strong", null, item.name),
      item.blurb ? h("span", null, item.blurb) : null,
    ),
  );
}
