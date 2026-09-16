import { isClipId } from "./clip";
import { localePath, parseLocale, type Locale } from "./locale";

export const STATIC_FILE =
  /^\/(assets\/|covers\/|favicon\.svg$|robots\.txt$|sitemap\.xml$|manifest\.webmanifest$)/;

export const CATEGORIES = [
  { id: "share", tools: ["clip", "qr", "barcode"] },
  { id: "image", tools: ["watermark", "collage", "resize", "crop", "rotate", "exif", "meme", "signature", "favicon"] },
  { id: "convert", tools: ["convert", "image-pdf", "pdf-jpg", "merge-pdf", "compress-pdf", "split-pdf", "invoice", "audio", "audio-cutter", "audio-joiner", "data"] },
  { id: "text", tools: ["password", "word-count", "color", "names", "timezone", "timestamp", "lorem", "units", "text-to-speech", "diff", "uuid", "regex"] },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];

export const TOOLS = [
  "clip",
  "qr",
  "barcode",
  "watermark",
  "collage",
  "resize",
  "crop",
  "rotate",
  "exif",
  "meme",
  "signature",
  "favicon",
  "convert",
  "image-pdf",
  "pdf-jpg",
  "merge-pdf",
  "compress-pdf",
  "split-pdf",
  "invoice",
  "audio",
  "audio-cutter",
  "audio-joiner",
  "data",
  "password",
  "word-count",
  "color",
  "names",
  "timezone",
  "timestamp",
  "lorem",
  "units",
  "text-to-speech",
  "diff",
  "uuid",
  "regex",
] as const;
export type ToolId = (typeof TOOLS)[number];

export const TUTORIALS = [
  "portrait",
  "algorithms",
  "phone-photos",
  "window-light",
  "crop-compose",
  "badminton-warmup",
  "badminton-rules",
  "pool-safety",
  "one-page-site",
  "healthy-boundaries",
  "read-character",
] as const;
export type TutorialId = (typeof TUTORIALS)[number];

// Older lesson URLs remain available; only the edited collection is promoted.
export const TUTORIAL_GROUPS = [
  { id: "photo", tutorials: ["phone-photos", "window-light", "crop-compose"] },
  { id: "course", tutorials: ["portrait"] },
  { id: "code", tutorials: ["algorithms", "one-page-site"] },
] as const;
export const FEATURED_TUTORIALS: readonly TutorialId[] = TUTORIAL_GROUPS.flatMap(
  (group) => [...group.tutorials] as TutorialId[],
);
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

  const parts = raw.split("/").filter(Boolean).map((part) => part.toLowerCase());
  if (parts.length === 0) return { kind: "bare", tool: null };

  const [first, second, third, ...rest] = parts;
  if (first === "c" && second && !third && isClipId(second)) {
    return { kind: "clip", id: second };
  }

  const locale = parseLocale(first);
  if (locale) {
    if (!second) {
      if (rest.length > 0) return { kind: "unknown" };
      return { kind: "app", locale, tool: null };
    }
    if (second === "learn") {
      if (rest.length > 0) return { kind: "unknown" };
      if (!third) return { kind: "learn", locale, tutorial: null };
      if (isTutorialId(third)) return { kind: "learn", locale, tutorial: third };
      return { kind: "unknown" };
    }
    if (rest.length > 0) return { kind: "unknown" };
    if (!isToolId(second)) return { kind: "unknown" };
    if (!third) return { kind: "app", locale, tool: second };
    if (second === "clip" && isClipId(third)) {
      return { kind: "app", locale, tool: "clip", clipId: third };
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
    return { kind: "bare", tool: "clip", clipId: second };
  }
  return { kind: "unknown" };
}

export function appHref(locale: Locale, tool: ToolId | null, clipId?: string | null): string {
  const base = `/${localePath(locale)}`;
  if (tool === "clip" && clipId) return `${base}/clip/${clipId.toLowerCase()}/`;
  return tool ? `${base}/${tool}/` : `${base}/`;
}

export function learnHref(locale: Locale, tutorial: TutorialId | null = null): string {
  const base = `/${localePath(locale)}/learn`;
  return tutorial ? `${base}/${tutorial}/` : `${base}/`;
}
