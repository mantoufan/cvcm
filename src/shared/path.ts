import { isClipId } from "./clip";
import { isLocale, type Locale } from "./locale";

export const STATIC_FILE =
  /^\/(assets\/|covers\/|favicon\.svg$|robots\.txt$|sitemap\.xml$|manifest\.webmanifest$)/;

export const CATEGORIES = [
  { id: "share", tools: ["clip", "qr"] },
  { id: "image", tools: ["watermark", "collage", "resize", "crop"] },
  { id: "convert", tools: ["convert", "image-pdf", "pdf-jpg", "merge-pdf", "compress-pdf", "audio", "data"] },
  { id: "text", tools: ["password", "word-count", "color"] },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];

export const TOOLS = [
  "clip",
  "qr",
  "watermark",
  "collage",
  "resize",
  "crop",
  "convert",
  "image-pdf",
  "pdf-jpg",
  "merge-pdf",
  "compress-pdf",
  "audio",
  "data",
  "password",
  "word-count",
  "color",
] as const;
export type ToolId = (typeof TOOLS)[number];

export const TUTORIALS = [
  "phone-photos",
  "window-light",
  "crop-compose",
  "badminton-warmup",
  "badminton-rules",
  "pool-safety",
  "one-page-site",
] as const;
export type TutorialId = (typeof TUTORIALS)[number];

export const TUTORIAL_GROUPS = [
  { id: "photo", tutorials: ["phone-photos", "window-light", "crop-compose"] },
  { id: "court", tutorials: ["badminton-warmup", "badminton-rules"] },
  { id: "water", tutorials: ["pool-safety"] },
  { id: "code", tutorials: ["one-page-site"] },
] as const;
export type TutorialGroupId = (typeof TUTORIAL_GROUPS)[number]["id"];

export function categoryOf(tool: ToolId): CategoryId {
  for (const cat of CATEGORIES) {
    if ((cat.tools as readonly string[]).includes(tool)) return cat.id;
  }
  return "image";
}

export function isToolId(value: string): value is ToolId {
  return (TOOLS as readonly string[]).includes(value);
}

export function isTutorialId(value: string): value is TutorialId {
  return (TUTORIALS as readonly string[]).includes(value);
}

export type AppPath =
  | { kind: "static" }
  | { kind: "bare"; tool: ToolId | null; clipId?: string }
  | { kind: "bare-learn"; tutorial: TutorialId | null }
  | { kind: "app"; locale: Locale; tool: ToolId | null; clipId?: string }
  | { kind: "learn"; locale: Locale; tutorial: TutorialId | null }
  | { kind: "clip"; id: string }
  | { kind: "unknown" };

export function parseAppPath(pathname: string): AppPath {
  const raw = pathname.split("?")[0] || "/";
  if (STATIC_FILE.test(raw)) return { kind: "static" };

  const parts = raw.split("/").filter(Boolean);
  if (parts.length === 0) return { kind: "bare", tool: null };

  const [first, second, third, ...rest] = parts;
  if (first === "c" && second && !third && isClipId(second)) {
    return { kind: "clip", id: second.toLowerCase() };
  }

  if (isLocale(first)) {
    if (!second) {
      if (rest.length > 0) return { kind: "unknown" };
      return { kind: "app", locale: first, tool: null };
    }
    if (second === "learn") {
      if (rest.length > 0) return { kind: "unknown" };
      if (!third) return { kind: "learn", locale: first, tutorial: null };
      if (isTutorialId(third)) return { kind: "learn", locale: first, tutorial: third };
      return { kind: "unknown" };
    }
    if (rest.length > 0) return { kind: "unknown" };
    if (!isToolId(second)) return { kind: "unknown" };
    if (!third) return { kind: "app", locale: first, tool: second };
    if (second === "clip" && isClipId(third)) {
      return { kind: "app", locale: first, tool: "clip", clipId: third.toLowerCase() };
    }
    return { kind: "unknown" };
  }

  if (first === "learn") {
    if (!second) return { kind: "bare-learn", tutorial: null };
    if (isTutorialId(second) && !third) return { kind: "bare-learn", tutorial: second };
    return { kind: "unknown" };
  }
  if (isToolId(first) && !second) return { kind: "bare", tool: first };
  if (first === "clip" && second && !third && isClipId(second)) {
    return { kind: "bare", tool: "clip", clipId: second.toLowerCase() };
  }
  return { kind: "unknown" };
}

export function appHref(locale: Locale, tool: ToolId | null, clipId?: string | null): string {
  if (tool === "clip" && clipId) return `/${locale}/clip/${clipId}/`;
  return tool ? `/${locale}/${tool}/` : `/${locale}/`;
}

export function learnHref(locale: Locale, tutorial: TutorialId | null = null): string {
  return tutorial ? `/${locale}/learn/${tutorial}/` : `/${locale}/learn/`;
}
