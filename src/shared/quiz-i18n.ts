import type { Locale } from "./locale";
import { escapeHtml } from "./device-i18n";
import { messages, quizMessages, type QuizMessages } from "./messages";
import { appHref, quizHref } from "./path";
import { QUIZ_DEFS, QUIZ_GROUPS, questionCount, type QuizId } from "./quiz";

export type QuizChoice = { q: string; options: string[] };
export type QuizResultCopy = { name: string; body: string };

/** One test's copy. The tests differ in which optional parts they have (see `QUIZ_DEFS[id].result`). */
export type QuizCopy = {
  title: string;
  description: string;
  h1: string;
  lede: string;
  about: string[];
  faq: { q: string; a: string }[];
  items: (string | QuizChoice)[];
  dims?: Record<string, string>;
  letters?: Record<string, string>;
  levels?: Record<string, { low: string; mid: string; high: string }>;
  results?: Record<string, QuizResultCopy>;
  tips?: Record<string, string>;
  codeTitle?: string;
};

export type QuizUi = QuizMessages["ui"];
export type QuizHubCopy = QuizMessages["hub"];

export function quizUi(locale: Locale): QuizUi {
  return quizMessages(locale).ui;
}

export function quizHub(locale: Locale): QuizHubCopy {
  return quizMessages(locale).hub;
}

export function quizCopy(locale: Locale, id: QuizId): QuizCopy {
  return quizMessages(locale).tests[id] as unknown as QuizCopy;
}

/** Name and one-line blurb, from the core pack: home and footer links need them without the quiz pack. */
export function quizName(locale: Locale, id: QuizId): { name: string; blurb: string } {
  return messages(locale).ui.quiz[id];
}

export function quizItemText(item: string | QuizChoice): string {
  return typeof item === "string" ? item : item.q;
}

export function fill(text: string, vars: Record<string, string | number>): string {
  let out = text;
  for (const [key, value] of Object.entries(vars)) out = out.replaceAll(`{${key}}`, String(value));
  return out;
}

export function quizFaqItems(locale: Locale, id: QuizId | null): { q: string; a: string }[] {
  return id ? quizCopy(locale, id).faq : quizHub(locale).faq;
}

export function quizTitle(locale: Locale, id: QuizId | null): string {
  return id ? quizCopy(locale, id).title : quizHub(locale).title;
}

export function quizDescription(locale: Locale, id: QuizId | null): string {
  return id ? quizCopy(locale, id).description : quizHub(locale).description;
}

export function quizBreadcrumbJsonLd(locale: Locale, id: QuizId | null): Record<string, unknown> {
  const items = [
    { name: quizMessages(locale).crumbHome, href: `https://cv.cm${appHref(locale, null)}` },
    { name: quizHub(locale).h1, href: `https://cv.cm${quizHref(locale)}` },
  ];
  if (id) items.push({ name: quizName(locale, id).name, href: `https://cv.cm${quizHref(locale, id)}` });
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

export function quizFaqJsonLd(locale: Locale, id: QuizId | null): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: quizFaqItems(locale, id).map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}

function faqHtml(locale: Locale, id: QuizId | null): string {
  const items = quizFaqItems(locale, id).map((item, index) => (
    `<details${index === 0 ? " open" : ""}><summary>${escapeHtml(item.q)}</summary><p>${escapeHtml(item.a)}</p></details>`
  )).join("");
  return `<section class="faq" aria-labelledby="faq-title"><h2 id="faq-title">${escapeHtml(quizUi(locale).faq)}</h2>${items}</section>`;
}

/** Text copy of a test page for crawlers when the prerendered body is missing: questions, about, FAQ and links. */
export function quizStaticHtml(locale: Locale, id: QuizId | null): string {
  const ui = quizUi(locale);
  const hub = quizHub(locale);
  const home = `<a href="${escapeHtml(appHref(locale, null))}">${escapeHtml(quizMessages(locale).crumbHome)}</a>`;
  if (!id) {
    const groups = QUIZ_GROUPS.map((group) => {
      const links = group.quizzes.map((q) => {
        const name = quizName(locale, q);
        return `<li><a href="${escapeHtml(quizHref(locale, q))}">${escapeHtml(name.name)}</a> ${escapeHtml(name.blurb)}</li>`;
      }).join("");
      return `<h2>${escapeHtml(hub.groups[group.id])}</h2><ul>${links}</ul>`;
    }).join("");
    return [
      `<nav class="device-crumb">${home} <span aria-hidden="true">/</span> <span>${escapeHtml(hub.h1)}</span></nav>`,
      `<h1>${escapeHtml(hub.h1)}</h1>`,
      `<p class="lede">${escapeHtml(hub.lede)}</p>`,
      groups,
      hub.about.map((p) => `<p>${escapeHtml(p)}</p>`).join(""),
      faqHtml(locale, null),
    ].join("");
  }
  const copy = quizCopy(locale, id);
  const def = QUIZ_DEFS[id];
  const questions = copy.items.map((item) => {
    if (typeof item === "string") return `<li>${escapeHtml(item)}</li>`;
    return `<li>${escapeHtml(item.q)}<ul>${item.options.map((o) => `<li>${escapeHtml(o)}</li>`).join("")}</ul></li>`;
  }).join("");
  const hint = def.type === "likert" ? ui.scaleHint[def.scale] : ui.choiceHint;
  return [
    `<nav class="device-crumb">${home} <span aria-hidden="true">/</span> <a href="${escapeHtml(quizHref(locale))}">${escapeHtml(hub.h1)}</a> <span aria-hidden="true">/</span> <span>${escapeHtml(quizName(locale, id).name)}</span></nav>`,
    `<h1>${escapeHtml(copy.h1)}</h1>`,
    `<p class="lede">${escapeHtml(copy.lede)}</p>`,
    `<p>${escapeHtml(hint)}</p>`,
    `<ol>${questions}</ol>`,
    `<section><h2>${escapeHtml(ui.about)}</h2>${copy.about.map((p) => `<p>${escapeHtml(p)}</p>`).join("")}</section>`,
    faqHtml(locale, id),
    `<p><a href="${escapeHtml(quizHref(locale))}">${escapeHtml(ui.all)}</a> · ${escapeHtml(fill(messages(locale).ui.quiz.questions, { n: questionCount(id) }))}</p>`,
  ].join("");
}
