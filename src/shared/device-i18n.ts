import en from "../locales/device/en.json";
import es from "../locales/device/es.json";
import id from "../locales/device/id.json";
import ja from "../locales/device/ja.json";
import ko from "../locales/device/ko.json";
import vi from "../locales/device/vi.json";
import zhCN from "../locales/device/zh-CN.json";
import zhTW from "../locales/device/zh-TW.json";
import { DEVICE_CHILD_PAGES, type BrowserId, type DevicePageId, type PlatformId } from "./device";
import type { Locale } from "./locale";
import { appHref, deviceHref } from "./path";

export type DevicePageCopy = {
  name: string;
  blurb: string;
  title: string;
  description: string;
  h1: string;
  lede: string;
  readBody: string;
  leaveBody: string;
  q1: string;
  a1: string;
  q2: string;
  a2: string;
  q3: string;
  a3: string;
  q4: string;
  a4: string;
  q5: string;
  a5: string;
};

export type DeviceMessages = typeof en;

const MESSAGES: Record<Locale, DeviceMessages> = {
  en,
  "zh-CN": zhCN,
  "zh-TW": zhTW,
  ja,
  ko,
  vi,
  id,
  es,
};

export function deviceMessages(locale: Locale): DeviceMessages {
  return MESSAGES[locale];
}

export function devicePageCopy(locale: Locale, page: DevicePageId): DevicePageCopy {
  return MESSAGES[locale].pages[page];
}

export function deviceFaqItems(locale: Locale, page: DevicePageId): { q: string; a: string }[] {
  const copy = devicePageCopy(locale, page);
  return [1, 2, 3, 4, 5].map((i) => ({
    q: copy[`q${i}` as "q1"],
    a: copy[`a${i}` as "a1"],
  }));
}

export function deviceLabel(locale: Locale, kind: "browsers" | "platforms", id: BrowserId | PlatformId): string {
  const table = MESSAGES[locale][kind] as Record<string, string>;
  return table[id] ?? MESSAGES[locale].unknown;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function crumbHtml(locale: Locale, page: DevicePageId): string {
  const msg = deviceMessages(locale);
  const hub = devicePageCopy(locale, "hub");
  const home = `<a href="${escapeHtml(appHref(locale, null))}">${escapeHtml(msg.crumbHome)}</a>`;
  const hubLink = `<a href="${escapeHtml(deviceHref(locale, "hub"))}">${escapeHtml(hub.name)}</a>`;
  if (page === "hub") {
    return `<nav class="device-crumb" aria-label="${escapeHtml(hub.name)}">${home} <span aria-hidden="true">/</span> <span>${escapeHtml(hub.name)}</span></nav>`;
  }
  const current = devicePageCopy(locale, page);
  return `<nav class="device-crumb" aria-label="${escapeHtml(hub.name)}">${home} <span aria-hidden="true">/</span> ${hubLink} <span aria-hidden="true">/</span> <span>${escapeHtml(current.name)}</span></nav>`;
}

function relatedHtml(locale: Locale, page: DevicePageId): string {
  const msg = deviceMessages(locale);
  const links: string[] = [];
  for (const id of DEVICE_CHILD_PAGES) {
    if (id === page) continue;
    const copy = devicePageCopy(locale, id);
    links.push(`<a href="${escapeHtml(deviceHref(locale, id))}">${escapeHtml(copy.name)}</a>`);
  }
  if (page === "hub" || page === "zone") {
    links.push(`<a href="${escapeHtml(appHref(locale, "timezone"))}">${escapeHtml(msg.linkTimezone)}</a>`);
  }
  if (page === "screen") {
    links.push(`<a href="${escapeHtml(appHref(locale, "resize"))}">${escapeHtml(msg.linkResize)}</a>`);
    links.push(`<a href="${escapeHtml(appHref(locale, "aspect"))}">${escapeHtml(msg.linkAspect)}</a>`);
  }
  if (page !== "hub") {
    links.unshift(`<a href="${escapeHtml(deviceHref(locale, "hub"))}">${escapeHtml(devicePageCopy(locale, "hub").name)}</a>`);
  }
  return `<section class="device-related"><h2>${escapeHtml(msg.related)}</h2><p>${links.join(" ")}</p></section>`;
}

function showIpHtml(locale: Locale): string {
  const msg = deviceMessages(locale);
  return `<div class="device-reading" data-nosnippet><button type="button" class="btn device-show-ip">${escapeHtml(msg.showIp)}</button><p class="device-ip-value">${escapeHtml(msg.ipWaiting)}</p></div>`;
}

export function deviceStaticHtml(locale: Locale, page: DevicePageId): string {
  const msg = deviceMessages(locale);
  const copy = devicePageCopy(locale, page);
  const faqs = deviceFaqItems(locale, page).map((item, index) => (
    `<details${index === 0 ? " open" : ""}><summary>${escapeHtml(item.q)}</summary><p>${escapeHtml(item.a)}</p></details>`
  )).join("");
  const ask = page === "hub" || page === "ip" ? showIpHtml(locale) : "";
  return [
    crumbHtml(locale, page),
    `<h1>${escapeHtml(copy.h1)}</h1>`,
    `<p class="lede">${escapeHtml(copy.lede)}</p>`,
    ask,
    `<section class="device-explain"><h2>${escapeHtml(msg.howTitle)}</h2><p>${escapeHtml(copy.readBody)}</p></section>`,
    `<section class="device-explain"><h2>${escapeHtml(msg.leaveTitle)}</h2><p>${escapeHtml(copy.leaveBody)}</p></section>`,
    relatedHtml(locale, page),
    `<section class="faq" aria-labelledby="faq-title"><h2 id="faq-title">${escapeHtml(msg.faqTitle)}</h2>${faqs}</section>`,
  ].join("");
}

export function deviceBreadcrumbJsonLd(locale: Locale, page: DevicePageId): Record<string, unknown> {
  const msg = deviceMessages(locale);
  const hub = devicePageCopy(locale, "hub");
  const items = [
    { name: msg.crumbHome, href: `https://cv.cm${appHref(locale, null)}` },
    { name: hub.name, href: `https://cv.cm${deviceHref(locale, "hub")}` },
  ];
  if (page !== "hub") {
    const current = devicePageCopy(locale, page);
    items.push({ name: current.name, href: `https://cv.cm${deviceHref(locale, page)}` });
  }
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

export function deviceFaqJsonLd(locale: Locale, page: DevicePageId): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: deviceFaqItems(locale, page).map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}
