import { fill } from "../../shared/fill";
import type { Locale } from "../../shared/locale";
import { foldText } from "../../shared/search";
import { EMOJI_SLUGS, type EmojiSlug } from "../../shared/emoji";
import { emojiMessages, emojiRow, type EmojiMessages } from "../../shared/emoji-i18n";
import { emojiPageHtml } from "../../shared/emoji-page";
import { copyWithFlash } from "../copy";

/** An emoji without VS16, skin-tone modifiers or a ♀/♂ suffix: 👍🏽 → 👍, 🤦‍♀️ → 🤦, ❤️ → ❤. */
export function baseEmoji(text: string): string {
  return text.replace(/\u200D[\u2640\u2642]\uFE0F?/gu, "").replace(/[\u{1F3FB}-\u{1F3FF}]/gu, "").replace(/\uFE0F/g, "");
}

type SearchEntry = { text: string; glyphs: Set<string> };

/** Folded searchable text and the emoji forms of every covered emoji, built once per pack. */
const INDEX = new WeakMap<EmojiMessages, Map<string, SearchEntry>>();

function searchIndex(locale: Locale): Map<string, SearchEntry> {
  const m = emojiMessages(locale);
  let index = INDEX.get(m);
  if (!index) {
    index = new Map(EMOJI_SLUGS.map((slug) => {
      const row = emojiRow(locale, slug);
      const text = [m.names[slug], m.english[slug], ...(m.keywords[slug] ?? []), slug.replace(/-/g, " ")].map(foldText).join("\n");
      return [slug, { text, glyphs: new Set([row.emoji, ...row.variants].map(baseEmoji)) }];
    }));
    INDEX.set(m, index);
  }
  return index;
}

type Query = { glyph: string; words: string[] };

function prepare(query: string): Query {
  const raw = query.trim();
  return { glyph: baseEmoji(raw), words: foldText(raw).split(" ").filter(Boolean) };
}

function matches(entry: SearchEntry, q: Query): boolean {
  if (!q.words.length) return true;
  if (entry.glyphs.has(q.glyph)) return true;
  return q.words.every((word) => entry.text.includes(word));
}

/** Whether an emoji answers a hub search: the emoji or one of its forms, its local or English name, keywords or slug. */
export function emojiMatches(locale: Locale, slug: EmojiSlug, query: string): boolean {
  return matches(searchIndex(locale).get(slug)!, prepare(query));
}

function wireHub(host: HTMLElement, locale: Locale): void {
  const m = emojiMessages(locale);
  const search = host.querySelector<HTMLInputElement>(".emoji-search");
  const count = host.querySelector<HTMLElement>(".emoji-count");
  const none = host.querySelector<HTMLElement>(".emoji-none");
  if (!search || !count || !none) return;
  const index = searchIndex(locale);
  const items = [...host.querySelectorAll<HTMLLIElement>(".emoji-group li[data-slug]")].map((li) => ({ li, entry: index.get(li.dataset.slug ?? "") }));
  const groups = [...host.querySelectorAll<HTMLElement>(".emoji-group")];
  search.addEventListener("input", () => {
    const q = prepare(search.value);
    let shown = 0;
    for (const { li, entry } of items) {
      const hit = Boolean(entry && matches(entry, q));
      li.hidden = !hit;
      if (hit) shown += 1;
    }
    for (const group of groups) group.hidden = !group.querySelector("li[data-slug]:not([hidden])");
    count.textContent = fill(m.hub.shown, { n: shown, total: EMOJI_SLUGS.length });
    none.hidden = shown > 0;
  });
}

/** The emoji hub (null) or one emoji. Static text plus Copy buttons, so the page is the same HTML the Worker serves. */
export function mountEmoji(host: HTMLElement, locale: Locale, slug: EmojiSlug | null): () => void {
  host.innerHTML = emojiPageHtml(locale, slug);
  const m = emojiMessages(locale);
  const status = host.querySelector<HTMLElement>(".emoji-status");
  const onClick = (e: Event): void => {
    const button = (e.target as Element | null)?.closest?.<HTMLButtonElement>("button.emoji-copy");
    if (!button || !host.contains(button)) return;
    const emoji = button.dataset.copy ?? "";
    void copyWithFlash(button, emoji, { done: m.copied, failed: m.copyFailed }).then((ok) => {
      // The button's own label flashes; screen readers hear the result here.
      if (status) status.textContent = ok ? `${m.copied} ${emoji}` : m.copyFailed;
    });
  };
  host.addEventListener("click", onClick);
  if (!slug) wireHub(host, locale);
  return () => host.removeEventListener("click", onClick);
}
