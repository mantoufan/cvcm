import { isLocale, type Locale } from "./locale";

export const STATIC_FILE =
  /^\/(assets\/|favicon\.svg$|robots\.txt$|sitemap\.xml$|manifest\.webmanifest$)/;

export const CATEGORIES = [
  { id: "image", tools: ["watermark", "collage"] },
  { id: "convert", tools: ["convert", "image-pdf"] },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];

export const TOOLS = ["watermark", "collage", "convert", "image-pdf"] as const;
export type ToolId = (typeof TOOLS)[number];

export function categoryOf(tool: ToolId): CategoryId {
  for (const cat of CATEGORIES) {
    if ((cat.tools as readonly string[]).includes(tool)) return cat.id;
  }
  return "image";
}

export function isToolId(value: string): value is ToolId {
  return (TOOLS as readonly string[]).includes(value);
}

export type AppPath =
  | { kind: "static" }
  | { kind: "bare"; tool: ToolId | null }
  | { kind: "app"; locale: Locale; tool: ToolId | null }
  | { kind: "unknown" };

export function parseAppPath(pathname: string): AppPath {
  const raw = pathname.split("?")[0] || "/";
  if (STATIC_FILE.test(raw)) return { kind: "static" };

  const parts = raw.split("/").filter(Boolean);
  if (parts.length === 0) return { kind: "bare", tool: null };

  const [first, second, ...rest] = parts;
  if (isLocale(first)) {
    if (rest.length > 0) return { kind: "unknown" };
    if (!second) return { kind: "app", locale: first, tool: null };
    if (isToolId(second)) return { kind: "app", locale: first, tool: second };
    return { kind: "unknown" };
  }

  if (isToolId(first) && !second) return { kind: "bare", tool: first };
  return { kind: "unknown" };
}

export function appHref(locale: Locale, tool: ToolId | null): string {
  return tool ? `/${locale}/${tool}/` : `/${locale}/`;
}
