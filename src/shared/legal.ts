import type { Locale } from "./locale";
import { legalMessages, type LegalMessages } from "./messages";
import { appHref, legalHref, type LegalPageId } from "./path";

/** Shown at the top of both pages. Bump it whenever the policy or terms text changes. */
export const LEGAL_UPDATED = "2026-10-09";

export const LEGAL_EMAIL = "m@cv.cm";

export type LegalPageCopy = LegalMessages["pages"][LegalPageId];

export function legalPageCopy(locale: Locale, page: LegalPageId): LegalPageCopy {
  return legalMessages(locale).pages[page];
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Escape copy, then link the contact email and the source repo. */
function inline(text: string): string {
  return escapeHtml(text)
    .replaceAll(LEGAL_EMAIL, `<a href="mailto:${LEGAL_EMAIL}">${LEGAL_EMAIL}</a>`)
    .replaceAll(
      "github.com/mantoufan/cvcm",
      '<a href="https://github.com/mantoufan/cvcm" rel="noopener">github.com/mantoufan/cvcm</a>',
    );
}

/** Whole page body. The Worker serves it in the HTML; the client mounts the same markup. */
export function legalStaticHtml(locale: Locale, page: LegalPageId): string {
  const msg = legalMessages(locale);
  const copy = msg.pages[page];
  const other: LegalPageId = page === "privacy" ? "terms" : "privacy";
  const sections = copy.sections.map((section) => {
    const items = "li" in section && section.li
      ? `<ul>${section.li.map((item) => `<li>${inline(item)}</li>`).join("")}</ul>`
      : "";
    const paras = section.p.map((p) => `<p>${inline(p)}</p>`).join("");
    return `<section><h2>${escapeHtml(section.h)}</h2>${paras}${items}</section>`;
  }).join("");
  return [
    `<article class="legal">`,
    `<nav class="device-crumb" aria-label="${escapeHtml(copy.name)}"><a href="${escapeHtml(appHref(locale, null))}" data-nav="home">${escapeHtml(msg.crumbHome)}</a> <span aria-hidden="true">/</span> <span>${escapeHtml(copy.name)}</span></nav>`,
    `<h1>${escapeHtml(copy.h1)}</h1>`,
    `<p class="legal-date">${escapeHtml(msg.updated)}: <time datetime="${LEGAL_UPDATED}">${LEGAL_UPDATED}</time></p>`,
    `<p class="lede">${inline(copy.lede)}</p>`,
    sections,
    `<p class="legal-other"><a href="${escapeHtml(legalHref(locale, other))}" data-nav="${other}">${escapeHtml(msg[other])}</a></p>`,
    `</article>`,
  ].join("");
}

export function legalBreadcrumbJsonLd(locale: Locale, page: LegalPageId): Record<string, unknown> {
  const msg = legalMessages(locale);
  const items = [
    { name: msg.crumbHome, href: `https://cv.cm${appHref(locale, null)}` },
    { name: msg.pages[page].name, href: `https://cv.cm${legalHref(locale, page)}` },
  ];
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.href,
    })),
  };
}
