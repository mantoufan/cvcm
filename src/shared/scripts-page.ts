/**
 * The scripts page HTML (hub, scripts, idea lists and the generator), shared by the client page and the Worker's
 * crawler copy. Kept out of scripts-i18n so the main bundle, which needs only titles, descriptions and JSON-LD, does
 * not carry it. Copy buttons and the generator are wired by src/client/scripts/ui.ts; without script the page still
 * shows everything (the generator shows five worked examples).
 */
import type { Locale } from "./locale";
import { escapeHtml } from "./device-i18n";
import { fill } from "./fill";
import { blockHtml, dateLabel, inline, linkListHtml } from "./article-html";
import { messages, scriptsMessages } from "./messages";
import { appHref, scriptsHref } from "./path";
import { SCRIPT_GROUPS, isScriptId, scriptGroupOf, scriptUpdated, type ScriptId } from "./scripts";
import { HREFLANG } from "./sitemap";
import {
  SCRIPTS_LICENSE_URL,
  isGenerator,
  isIdeasList,
  scriptCopy,
  scriptMeta,
  scriptName,
  scriptsFaqItems,
  scriptsHub,
  scriptsUi,
  type GeneratorCopy,
  type GeneratorPools,
  type IdeasListCopy,
  type ScriptLine,
  type ScriptPlayCopy,
} from "./scripts-i18n";

function crumbHtml(locale: Locale, id: ScriptId | null): string {
  const m = scriptsMessages(locale);
  const sep = ` <span aria-hidden="true">/</span> `;
  const parts = [
    `<a href="${escapeHtml(appHref(locale, null))}" data-nav="home">${escapeHtml(m.crumbHome)}</a>`,
    id
      ? `<a href="${escapeHtml(scriptsHref(locale))}" data-nav="scripts">${escapeHtml(m.hub.h1)}</a>`
      : `<span>${escapeHtml(m.hub.h1)}</span>`,
  ];
  if (id) parts.push(`<span>${escapeHtml(scriptName(locale, id).name)}</span>`);
  return `<nav class="device-crumb" aria-label="${escapeHtml(messages(locale).ui.nav.breadcrumb)}">${parts.join(sep)}</nav>`;
}

function faqHtml(locale: Locale, id: ScriptId | null): string {
  const items = scriptsFaqItems(locale, id).map((item, index) => (
    `<details${index === 0 ? " open" : ""}><summary>${inline(item.q)}</summary><p>${inline(item.a)}</p></details>`
  )).join("");
  return `<section class="faq" aria-labelledby="faq-title"><h2 id="faq-title">${escapeHtml(scriptsUi(locale).faq)}</h2>${items}</section>`;
}

const numberFormats = new Map<Locale, Intl.NumberFormat>();

/** "45 s", "3 min", "2.5 min" in the locale's digits and decimal mark. */
export function runtimeLabel(locale: Locale, seconds: number): string {
  const ui = scriptsUi(locale);
  if (!numberFormats.has(locale)) numberFormats.set(locale, new Intl.NumberFormat(HREFLANG[locale], { maximumFractionDigits: 1 }));
  const nf = numberFormats.get(locale)!;
  if (seconds < 120) return fill(ui.seconds, { n: nf.format(seconds) });
  return fill(ui.minutes, { n: nf.format(Math.round(seconds / 30) / 2) });
}

/** "2 roles · 45 s · Comedy" for a script; "48 ideas" for a list; the format name for the generator. */
export function scriptFacts(locale: Locale, id: ScriptId): string {
  const ui = scriptsUi(locale);
  const meta = scriptMeta(locale, id);
  const genres = ui.genres as Record<string, string>;
  if (meta.format === "tool") return (ui.formats as Record<string, string>).tool;
  if (meta.format === "list") {
    const copy = scriptsMessages(locale).list[id] as { name: string; blurb: string; ideas?: number };
    return copy.ideas ? fill(ui.ideasCount, { n: copy.ideas }) : (ui.formats as Record<string, string>).list;
  }
  const cast = meta.cast === 1 ? ui.castOne : fill(ui.castMany, { n: meta.cast });
  return [cast, runtimeLabel(locale, meta.seconds), ...meta.genres.map((g) => genres[g] ?? g)].join(" · ");
}

export function scriptLinkItems(locale: Locale, ids: readonly ScriptId[]): { href: string; name: string; blurb: string; meta: string; nav: string }[] {
  return ids.map((id) => {
    const { name, blurb } = scriptName(locale, id);
    return { href: scriptsHref(locale, id), name, blurb, meta: scriptFacts(locale, id), nav: `scripts-${id}` };
  });
}

function hubHtml(locale: Locale): string {
  const ui = scriptsUi(locale);
  const hub = scriptsHub(locale);
  const labels = hub.groups as Record<string, string>;
  const jump = SCRIPT_GROUPS.map((group) => `<a href="#${group.id}">${escapeHtml(labels[group.id])}</a>`).join(" · ");
  const groups = SCRIPT_GROUPS.map((group) => (
    `<section class="wall" id="${group.id}"><h2>${escapeHtml(labels[group.id])} <span class="pill">${escapeHtml(fill(ui.count, { n: group.entries.length }))}</span></h2>`
    + `${linkListHtml(scriptLinkItems(locale, group.entries))}</section>`
  )).join("");
  return [
    crumbHtml(locale, null),
    `<header class="tool-head"><h1>${escapeHtml(hub.h1)}</h1><p class="lede">${escapeHtml(hub.lede)}</p></header>`,
    `<p class="slang-jump">${jump}</p>`,
    groups,
    `<section class="kb-about">${hub.about.map((p) => `<p>${inline(p)}</p>`).join("")}</section>`,
    faqHtml(locale, null),
  ].join("");
}

function lineHtml(locale: Locale, line: ScriptLine): string {
  if ("scene" in line) return `<p class="sc-scene">${inline(line.scene)}</p>`;
  if ("action" in line) return `<p class="sc-action">${inline(line.action)}</p>`;
  if ("text" in line) return `<p class="sc-text">${inline(line.text)}</p>`;
  if ("sfx" in line) return `<p class="sc-sfx"><span>${escapeHtml(scriptsUi(locale).sfx)}:</span> ${inline(line.sfx)}</p>`;
  return `<p class="sc-line"><span class="sc-who">${escapeHtml(line.who)}</span>`
    + (line.how ? ` <span class="sc-how">(${escapeHtml(line.how)})</span>` : "")
    + `<span class="sc-say">${inline(line.say)}</span></p>`;
}

function copyButton(locale: Locale, target: string, label: string): string {
  const ui = scriptsUi(locale);
  return `<button type="button" class="chip" data-copy="${escapeHtml(target)}" data-copied="${escapeHtml(ui.copied)}" hidden>${escapeHtml(label)}</button>`;
}

function promptsHtml(locale: Locale, copy: ScriptPlayCopy): string {
  const ui = scriptsUi(locale);
  const image = `${appHref(locale, "ai-image-generator")}?prompt=${encodeURIComponent(copy.prompts.keyframe)}`;
  const items = [
    `<li><p><strong>${escapeHtml(ui.keyframe)}</strong></p><p class="script-prompt" id="script-prompt-0">${inline(copy.prompts.keyframe)}</p>${copyButton(locale, "script-prompt-0", ui.copy)}</li>`,
    ...copy.prompts.shots.map((shot, i) => (
      `<li><p><strong>${escapeHtml(fill(ui.shot, { n: i + 1 }))}</strong></p><p class="script-prompt" id="script-prompt-${i + 1}">${inline(shot)}</p>${copyButton(locale, `script-prompt-${i + 1}`, ui.copy)}</li>`
    )),
  ].join("");
  return `<section class="kb-section script-prompts" id="script-prompts"><h2>${escapeHtml(ui.prompts)}</h2><p>${escapeHtml(ui.promptsLede)}</p>`
    + `<ol class="script-prompt-list">${items}</ol>`
    + `<p class="stage-actions"><a class="btn" href="${escapeHtml(image)}" data-nav="tool-ai-image-generator">${escapeHtml(ui.drawFrame)}</a> `
    + `<a class="btn ghost" href="${escapeHtml(appHref(locale, "v"))}" data-nav="tool-v">${escapeHtml(ui.animate)}</a></p></section>`;
}

function licenseHtml(locale: Locale): string {
  const ui = scriptsUi(locale);
  return `<aside class="kb-note script-license"><p>${escapeHtml(ui.license)} <a href="${SCRIPTS_LICENSE_URL}" target="_blank" rel="license noopener">${escapeHtml(ui.licenseLink)}</a></p></aside>`;
}

function headHtml(locale: Locale, id: ScriptId, h1: string): string {
  const ui = scriptsUi(locale);
  const labels = scriptsHub(locale).groups as Record<string, string>;
  const meta = scriptMeta(locale, id);
  const formats = ui.formats as Record<string, string>;
  const uses = ui.uses as Record<string, string>;
  const facts = [
    escapeHtml(scriptFacts(locale, id)),
    ...(meta.format === "list" || meta.format === "tool" ? [] : [escapeHtml([formats[meta.format], ...meta.uses.map((u) => uses[u] ?? u)].join(", "))]),
    `<time datetime="${scriptUpdated(id)}">${escapeHtml(fill(ui.updated, { date: dateLabel(locale, scriptUpdated(id)) }))}</time>`,
  ].map((f) => `<span>${f}</span>`).join(" · ");
  return `<header class="tool-head"><p class="kicker">${[ui.kicker, labels[scriptGroupOf(id)]].map(escapeHtml).join(" · ")}</p>`
    + `<h1>${escapeHtml(h1)}</h1><p class="kb-meta">${facts}</p></header>`;
}

function sectionsHtml(sections: { h: string; body: Parameters<typeof blockHtml>[0][] }[], offset: number): string {
  return sections.map((s, i) => `<section class="kb-section" id="script-${offset + i}"><h2>${inline(s.h)}</h2>${s.body.map(blockHtml).join("")}</section>`).join("");
}

function tocHtml(locale: Locale, items: { href: string; h: string }[]): string {
  const ui = scriptsUi(locale);
  return `<nav class="kb-toc" aria-label="${escapeHtml(ui.toc)}"><h2>${escapeHtml(ui.toc)}</h2><ol>${items.map((i) => `<li><a href="#${i.href}">${inline(i.h)}</a></li>`).join("")}</ol></nav>`;
}

function relatedHtml(locale: Locale, id: ScriptId): string {
  const related = scriptMeta(locale, id).related;
  const ui = scriptsUi(locale);
  return related.length ? `<section class="learn-related"><h2>${escapeHtml(ui.related)}</h2>${linkListHtml(scriptLinkItems(locale, related))}</section>` : "";
}

function playHtml(locale: Locale, copy: ScriptPlayCopy): string {
  const ui = scriptsUi(locale);
  const roles = copy.roles.map((r) => `<tr><th scope="row">${escapeHtml(r.name)}</th><td>${inline(r.note)}</td></tr>`).join("");
  const toc = tocHtml(locale, [
    { href: "script-roles", h: ui.roles },
    { href: "script-text", h: ui.script },
    ...copy.sections.map((s, i) => ({ href: `script-${i + 1}`, h: s.h })),
    { href: "script-prompts", h: ui.prompts },
  ]);
  return [
    `<section class="kb-answer" aria-label="${escapeHtml(ui.logline)}"><h2>${escapeHtml(ui.logline)}</h2><p>${inline(copy.logline)}</p>`
      + `<p class="muted"><strong>${escapeHtml(ui.setting)}:</strong> ${inline(copy.setting)}</p></section>`,
    toc,
    `<section class="kb-section" id="script-roles"><h2>${escapeHtml(ui.roles)}</h2><div class="kb-table"><table><tbody>${roles}</tbody></table></div></section>`,
    `<section class="kb-section" id="script-text"><h2>${escapeHtml(ui.script)} ${copyButton(locale, "script-body", ui.copyScript)}</h2>`
      + `<div class="script-body" id="script-body" lang="${HREFLANG[locale]}">${copy.script.map((l) => lineHtml(locale, l)).join("")}</div></section>`,
    licenseHtml(locale),
    sectionsHtml(copy.sections, 1),
    promptsHtml(locale, copy),
  ].join("");
}

function ideasHtml(locale: Locale, copy: IdeasListCopy): string {
  const ui = scriptsUi(locale);
  let n = 0;
  const groups = copy.groups.map((g, gi) => (
    `<section class="kb-section" id="ideas-${gi + 1}"><h2>${inline(g.h)}</h2><ol class="idea-list" start="${n + 1}">`
    + g.items.map((item) => {
      n++;
      const link = item.script && isScriptId(item.script)
        ? ` <a href="${escapeHtml(scriptsHref(locale, item.script))}" data-nav="scripts-${item.script}">${escapeHtml(fill(ui.seeScript, { name: scriptName(locale, item.script).name }))}</a>`
        : "";
      return `<li><strong>${inline(item.t)}</strong> ${inline(item.d)}${link}</li>`;
    }).join("")
    + `</ol></section>`
  )).join("");
  const toc = tocHtml(locale, [
    ...copy.groups.map((g, i) => ({ href: `ideas-${i + 1}`, h: g.h })),
    ...copy.sections.map((s, i) => ({ href: `script-${i + 1}`, h: s.h })),
  ]);
  return [
    `<section class="kb-answer"><p>${inline(copy.answer)}</p></section>`,
    toc,
    groups,
    sectionsHtml(copy.sections, 1),
  ].join("");
}

/** A premise from the template: each part picked by index (wrapping), so the crawler copy is stable. */
export function premise(template: string, pools: GeneratorPools, pick: Record<"hero" | "want" | "obstacle" | "twist" | "setting", number>): string {
  return (["hero", "want", "obstacle", "twist", "setting"] as const).reduce(
    (text, part) => text.replace(`{${part}}`, pools[part][pick[part] % pools[part].length]),
    template,
  ).replace(/^(\p{Ll})/u, (c) => c.toUpperCase());
}

function generatorHtml(locale: Locale, copy: GeneratorCopy): string {
  const ui = scriptsUi(locale);
  const gen = ui.gen;
  // Five fixed examples, spread over the pools with co-prime strides so no two share a part.
  const examples = [0, 1, 2, 3, 4].map((i) => {
    const text = premise(copy.template, copy.pools, { hero: i * 7, want: i * 11 + 3, obstacle: i * 13 + 5, twist: i * 17 + 2, setting: i * 19 + 4 });
    return `<li><p>${escapeHtml(text)}</p><p class="muted">${escapeHtml(copy.pools.format[(i * 3) % copy.pools.format.length])}</p></li>`;
  }).join("");
  const parts = gen.parts as Record<string, string>;
  const rerolls = (["hero", "want", "obstacle", "twist", "setting", "format"] as const)
    .map((part) => `<button type="button" class="chip" data-gen-part="${part}">${escapeHtml(fill(gen.reroll, { part: parts[part] }))}</button>`).join("");
  return [
    `<section class="kb-answer"><p>${inline(copy.answer)}</p></section>`,
    `<section class="script-gen" data-scripts-gen aria-live="polite"><h2>${escapeHtml(gen.title)}</h2>`
      + `<p class="script-gen-out" data-gen-out>${escapeHtml(premise(copy.template, copy.pools, { hero: 0, want: 3, obstacle: 5, twist: 2, setting: 4 }))}</p>`
      + `<p class="muted"><strong>${escapeHtml(gen.formatLabel)}:</strong> <span data-gen-format>${escapeHtml(copy.pools.format[0])}</span></p>`
      + `<p class="stage-actions" data-gen-controls hidden><button type="button" class="btn" data-gen-roll>${escapeHtml(gen.roll)}</button> `
      + `<button type="button" class="btn ghost" data-gen-copy data-copied="${escapeHtml(ui.copied)}">${escapeHtml(gen.copy)}</button></p>`
      + `<p class="convert-chips" data-gen-controls hidden>${rerolls}</p>`
      + `<noscript><p class="muted">${escapeHtml(gen.noScript)}</p></noscript></section>`,
    `<section class="kb-section"><h2>${escapeHtml(gen.examples)}</h2><ol class="idea-list">${examples}</ol></section>`,
    sectionsHtml(copy.sections, 1),
  ].join("");
}

/** The scripts hub or one entry as HTML: the client mounts it as is, and the Worker serves it to crawlers. */
export function scriptsPageHtml(locale: Locale, id: ScriptId | null): string {
  if (!id) return hubHtml(locale);
  const ui = scriptsUi(locale);
  const copy = scriptCopy(locale, id);
  const body = isGenerator(copy) ? generatorHtml(locale, copy) : isIdeasList(copy) ? ideasHtml(locale, copy) : playHtml(locale, copy as ScriptPlayCopy);
  return [
    crumbHtml(locale, id),
    `<article class="kb script">`,
    headHtml(locale, id, copy.h1),
    body,
    faqHtml(locale, id),
    relatedHtml(locale, id),
    `<p class="more"><a href="${escapeHtml(scriptsHref(locale))}" data-nav="scripts">${escapeHtml(ui.all)}</a></p>`,
    `</article>`,
  ].join("");
}
