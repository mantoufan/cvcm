/**
 * Block helpers shared by the article-style page modules (kb, ref, slang, nostalgia, ideas): inline code spans, kb
 * blocks, link lists and dates. Kept apart from kb-page.ts so a channel's page chunk does not carry the kb renderer.
 */
import type { Locale } from "./locale";
import { escapeHtml } from "./device-i18n";
import { HREFLANG } from "./sitemap";
import type { KbBlock } from "./kb-i18n";

/** Plain text with `code` spans; everything else escaped. */
export function inline(text: string): string {
  return text.split("`").map((part, i) => (i % 2 ? `<code>${escapeHtml(part)}</code>` : escapeHtml(part))).join("");
}

export function blockHtml(block: KbBlock): string {
  if (typeof block === "string") return `<p>${inline(block)}</p>`;
  if ("ul" in block) return `<ul>${block.ul.map((li) => `<li>${inline(li)}</li>`).join("")}</ul>`;
  if ("ol" in block) return `<ol>${block.ol.map((li) => `<li>${inline(li)}</li>`).join("")}</ol>`;
  if ("table" in block) {
    const head = `<thead><tr>${block.table.head.map((c) => `<th scope="col">${inline(c)}</th>`).join("")}</tr></thead>`;
    const rows = block.table.rows.map((row) => `<tr>${row.map((c, i) => (i === 0 ? `<th scope="row">${inline(c)}</th>` : `<td>${inline(c)}</td>`)).join("")}</tr>`).join("");
    return `<div class="kb-table"><table>${head}<tbody>${rows}</tbody></table></div>`;
  }
  if ("code" in block) return `<pre class="kb-code"><code data-lang="${escapeHtml(block.lang)}">${escapeHtml(block.code)}</code></pre>`;
  return `<aside class="kb-note"><p>${inline(block.note)}</p></aside>`;
}

export function linkListHtml(items: { href: string; name: string; blurb?: string; meta?: string; nav?: string }[]): string {
  return `<ul class="links">${items.map((item) => (
    `<li><a href="${escapeHtml(item.href)}"${item.nav ? ` data-nav="${escapeHtml(item.nav)}"` : ""}>`
    + (item.meta ? `<small>${escapeHtml(item.meta)}</small>` : "")
    + `<strong>${escapeHtml(item.name)}</strong>`
    + (item.blurb ? `<span>${escapeHtml(item.blurb)}</span>` : "")
    + `</a></li>`
  )).join("")}</ul>`;
}

export function dateLabel(locale: Locale, iso: string): string {
  try {
    return new Intl.DateTimeFormat(HREFLANG[locale], { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
  } catch {
    return iso;
  }
}
