export function slugify(text: string, max = 80): string {
  const cap = Math.max(1, Math.min(200, Math.round(max) || 80));
  const folded = text.normalize("NFKD").replace(/\p{M}+/gu, "");
  const slug = folded
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, cap)
    .replace(/-+$/g, "");
  return slug;
}
