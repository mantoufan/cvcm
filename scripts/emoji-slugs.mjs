// Slug assignment for scripts/fetch-emoji.mjs, kept apart so tests can check it. Slugs never change once published:
// src/shared/emoji-slug-table.json maps every emoji that ever had a page to its slug, and a refresh reuses it.

/** The CLDR English short name as a URL slug: "loudly crying face" → loudly-crying-face, "OK hand" → ok-hand. */
export function slugify(name) {
  return name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/**
 * Slugs for `items` ({ emoji, name } with the CLDR English short name) given the committed `table` (emoji → slug).
 * An emoji already in the table keeps its slug even when CLDR renames it; a new emoji gets slugify(name), which may not
 * reuse a slug any emoji has ever had. Returns the slugs in item order and the updated table (old entries kept).
 */
export function assignSlugs(table, items) {
  const next = { ...table };
  const taken = new Map(Object.entries(table).map(([emoji, slug]) => [slug, emoji]));
  const slugs = items.map(({ emoji, name }) => {
    if (next[emoji]) return next[emoji];
    const slug = slugify(name);
    if (!slug) throw new Error(`${emoji}: empty slug from "${name}"`);
    if (taken.has(slug)) throw new Error(`${emoji}: slug ${slug} already belongs to ${taken.get(slug)}`);
    taken.set(slug, emoji);
    next[emoji] = slug;
    return slug;
  });
  return { slugs, table: next };
}
