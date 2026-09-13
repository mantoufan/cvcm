export const LOCALES = ["en", "zh-CN", "zh-TW", "ja", "ko", "vi", "id", "es"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "cvcm_locale";

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/** Map a URL/cookie/storage value onto a locale. Paths are lowercase (`zh-cn`). */
export function parseLocale(value: string | null | undefined): Locale | null {
  if (!value) return null;
  const lower = value.trim().toLowerCase();
  for (const locale of LOCALES) {
    if (locale.toLowerCase() === lower) return locale;
  }
  return null;
}

export function localePath(locale: Locale): string {
  return locale.toLowerCase();
}

export function mapLanguageTag(tag: string): Locale | null {
  const lower = tag.trim().toLowerCase();
  if (!lower) return null;
  if (
    lower.startsWith("zh-tw") ||
    lower.startsWith("zh-hk") ||
    lower.startsWith("zh-mo") ||
    lower.includes("hant")
  ) {
    return "zh-TW";
  }
  if (lower.startsWith("zh")) return "zh-CN";
  if (lower.startsWith("ja")) return "ja";
  if (lower.startsWith("ko")) return "ko";
  if (lower.startsWith("vi")) return "vi";
  if (lower.startsWith("id") || lower === "in") return "id";
  if (lower.startsWith("es")) return "es";
  if (lower.startsWith("en")) return "en";
  return null;
}

export function negotiateLocale(
  acceptLanguage: string | null | undefined,
  cookie: string | null | undefined,
): Locale {
  const fromCookie = parseLocale(cookie);
  if (fromCookie) return fromCookie;
  if (!acceptLanguage) return DEFAULT_LOCALE;

  const tags = acceptLanguage
    .split(",")
    .map((part) => {
      const [rawTag, ...params] = part.trim().split(";");
      let q = 1;
      for (const param of params) {
        const match = param.trim().match(/^q=(.+)$/i);
        if (match) q = Number(match[1]) || 0;
      }
      return { tag: rawTag.trim(), q };
    })
    .sort((a, b) => b.q - a.q);

  for (const { tag } of tags) {
    const mapped = mapLanguageTag(tag);
    if (mapped) return mapped;
  }
  return DEFAULT_LOCALE;
}

export function cookieValue(
  header: string | null | undefined,
  name: string,
): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [rawKey, ...rest] = part.split("=");
    if (rawKey.trim() === name) return rest.join("=").trim() || null;
  }
  return null;
}
