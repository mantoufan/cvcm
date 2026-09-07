import { isClipId } from "./clip";
import { isLocale, type Locale } from "./locale";

export const STATIC_FILE =
  /^\/(assets\/|covers\/|favicon\.svg$|robots\.txt$|sitemap\.xml$|manifest\.webmanifest$)/;

export const CATEGORIES = [
  { id: "share", tools: ["clip"] },
  { id: "image", tools: ["watermark", "collage"] },
  { id: "convert", tools: ["convert", "image-pdf", "audio", "data"] },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];

export const TOOLS = ["clip", "watermark", "collage", "convert", "image-pdf", "audio", "data"] as const;
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
  | { kind: "bare"; tool: ToolId | null; clipId?: string }
  | { kind: "app"; locale: Locale; tool: ToolId | null; clipId?: string }
  | { kind: "clip"; id: string }
  | { kind: "unknown" };

export function parseAppPath(pathname: string): AppPath {
  const raw = pathname.split("?")[0] || "/";
  if (STATIC_FILE.test(raw)) return { kind: "static" };

  const parts = raw.split("/").filter(Boolean);
  if (parts.length === 0) return { kind: "bare", tool: null };

  const [first, second, third, ...rest] = parts;
  if (first === "c" && second && !third && isClipId(second)) {
    return { kind: "clip", id: second };
  }

  if (isLocale(first)) {
    if (rest.length > 0) return { kind: "unknown" };
    if (!second) return { kind: "app", locale: first, tool: null };
    if (!isToolId(second)) return { kind: "unknown" };
    if (!third) return { kind: "app", locale: first, tool: second };
    if (second === "clip" && isClipId(third)) {
      return { kind: "app", locale: first, tool: "clip", clipId: third };
    }
    return { kind: "unknown" };
  }

  if (isToolId(first) && !second) return { kind: "bare", tool: first };
  if (first === "clip" && second && !third && isClipId(second)) {
    return { kind: "bare", tool: "clip", clipId: second };
  }
  return { kind: "unknown" };
}

export function appHref(locale: Locale, tool: ToolId | null, clipId?: string | null): string {
  if (tool === "clip" && clipId) return `/${locale}/clip/${clipId}/`;
  return tool ? `/${locale}/${tool}/` : `/${locale}/`;
}
