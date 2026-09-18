import { isClipId } from "./clip";
import { localePath, parseLocale, type Locale } from "./locale";

export const STATIC_FILE =
  /^\/(assets\/|covers\/|favicon\.svg$|robots\.txt$|sitemap\.xml$|manifest\.webmanifest$)/;

export const CATEGORIES = [
  { id: "share", tools: ["clip", "qr", "barcode"] },
  { id: "image", tools: ["watermark", "collage", "portrait-sim", "resize", "crop", "rotate", "exif", "meme", "signature", "favicon", "screenshot"] },
  { id: "convert", tools: ["convert", "image-pdf", "pdf-jpg", "merge-pdf", "compress-pdf", "split-pdf", "invoice", "audio", "audio-cutter", "audio-joiner", "data", "xml-json", "yaml-json"] },
  { id: "text", tools: ["password", "word-count", "color", "hex-rgb", "names", "timezone", "timestamp", "lorem", "units", "text-to-speech", "diff", "uuid", "hash", "regex", "case", "jwt", "percent", "random", "html", "cron", "slug", "age", "bmi", "binary", "tip", "morse", "roman", "discount", "countdown", "loan"] },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];

export const TOOLS = [
  "clip",
  "qr",
  "barcode",
  "watermark",
  "collage",
  "portrait-sim",
  "resize",
  "crop",
  "rotate",
  "exif",
  "meme",
  "signature",
  "favicon",
  "screenshot",
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
  "xml-json",
  "yaml-json",
  "password",
  "word-count",
  "color",
  "hex-rgb",
  "names",
  "timezone",
  "timestamp",
  "lorem",
  "units",
  "text-to-speech",
  "diff",
  "uuid",
  "hash",
  "regex",
  "case",
  "jwt",
  "percent",
  "random",
  "html",
  "cron",
  "slug",
  "age",
  "bmi",
  "binary",
  "tip",
  "morse",
  "roman",
  "discount",
  "countdown",
  "loan",
] as const;
export type ToolId = (typeof TOOLS)[number];

export const TUTORIALS = [
  "make-qr",
  "make-barcode",
  "merge-pdf",
  "compress-pdf",
  "heic-to-jpg",
  "jpg-to-pdf",
  "pdf-to-jpg",
  "crop-photo",
  "webp-to-png",
  "resize-image",
  "split-pdf",
  "add-watermark",
  "remove-exif",
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

export type TutorialGroupId = "codes" | "files" | "photo" | "court" | "water" | "code" | "mind" | "course";

// New how-tos are published. Legacy ids still parse so old URLs 301 to the hub.
export const TUTORIAL_GROUPS: readonly {
  id: TutorialGroupId;
  tutorials: readonly TutorialId[];
}[] = [
  { id: "codes", tutorials: ["make-qr", "make-barcode"] },
  { id: "files", tutorials: ["merge-pdf", "compress-pdf", "split-pdf", "heic-to-jpg", "jpg-to-pdf", "pdf-to-jpg", "webp-to-png"] },
  { id: "photo", tutorials: ["crop-photo", "resize-image", "add-watermark", "remove-exif"] },
];
export const FEATURED_TUTORIALS: readonly TutorialId[] = TUTORIAL_GROUPS.flatMap(
  (group) => [...group.tutorials],
);

export function isPublishedTutorial(id: TutorialId): boolean {
  return FEATURED_TUTORIALS.includes(id);
}

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

/** Keep `location.search` / `url.search` on canonical redirects. */
export function withSearch(path: string, search: string): string {
  return search && search !== "?" ? `${path}${search}` : path;
}
