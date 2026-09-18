import { isClipId } from "./clip";
import {
  gameById,
  isGameConsoleId,
  isGameId,
  type GameConsoleId,
  type GameId,
} from "./games";
import { localePath, parseLocale, type Locale } from "./locale";

export const STATIC_FILE =
  /^\/(assets\/|covers\/|emu\/|favicon(\.svg|-\d+\.png)$|robots\.txt$|sitemap\.xml$|manifest\.webmanifest$)/;

export const CATEGORIES = [
  { id: "share", tools: ["clip", "qr", "barcode"] },
  { id: "image", tools: ["watermark", "collage", "portrait-sim", "resize", "crop", "rotate", "exif", "meme", "signature", "favicon", "screenshot"] },
  { id: "convert", tools: ["convert", "image-pdf", "pdf-jpg", "merge-pdf", "compress-pdf", "split-pdf", "invoice", "audio", "audio-cutter", "audio-joiner", "data", "xml-json", "yaml-json", "json", "base64"] },
  { id: "text", tools: ["password", "word-count", "color", "hex-rgb", "names", "timezone", "timestamp", "lorem", "units", "text-to-speech", "diff", "uuid", "hash", "regex", "case", "jwt", "percent", "random", "html", "cron", "slug", "age", "bmi", "binary", "tip", "morse", "roman", "discount", "countdown", "loan", "stopwatch", "compound", "vat", "reverse", "url-encode", "text-hex", "days", "sort", "replace", "words"] },
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
  "stopwatch",
  "compound",
  "vat",
  "reverse",
  "url-encode",
  "text-hex",
  "json",
  "base64",
  "days",
  "sort",
  "replace",
  "words",
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
  "make-collage",
  "make-meme",
  "count-words",
  "trim-audio",
  "png-to-jpg",
  "jpg-to-png",
  "avif-to-jpg",
  "rotate-photo",
  "png-to-webp",
  "mp3-to-wav",
  "join-audio",
  "make-favicon",
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

export type TutorialGroupId = "codes" | "files" | "photo" | "audio" | "text" | "court" | "water" | "code" | "mind" | "course";

// New how-tos are published. Legacy ids still parse so old URLs 301 to the hub.
export const TUTORIAL_GROUPS: readonly {
  id: TutorialGroupId;
  tutorials: readonly TutorialId[];
}[] = [
  { id: "codes", tutorials: ["make-qr", "make-barcode"] },
  { id: "files", tutorials: ["merge-pdf", "compress-pdf", "split-pdf", "heic-to-jpg", "jpg-to-pdf", "pdf-to-jpg", "webp-to-png", "png-to-jpg", "jpg-to-png", "avif-to-jpg", "png-to-webp"] },
  { id: "photo", tutorials: ["crop-photo", "rotate-photo", "resize-image", "add-watermark", "remove-exif", "make-collage", "make-meme", "make-favicon"] },
  { id: "audio", tutorials: ["trim-audio", "mp3-to-wav", "join-audio"] },
  { id: "text", tutorials: ["count-words"] },
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

export type GamesPath = {
  console: GameConsoleId | null;
  game: GameId | null;
};

export type AppPath =
  | { kind: "static" }
  | { kind: "bare"; tool: ToolId | null; clipId?: string }
  | { kind: "bare-learn"; tutorial: TutorialId | null }
  | ({ kind: "bare-games" } & GamesPath)
  | { kind: "app"; locale: Locale; tool: ToolId | null; clipId?: string }
  | { kind: "learn"; locale: Locale; tutorial: TutorialId | null }
  | ({ kind: "games"; locale: Locale } & GamesPath)
  | { kind: "clip"; id: string }
  | { kind: "unknown" };

function parseGamesTail(consoleOrGame?: string, gamePart?: string, extra?: string[]): GamesPath | "unknown" {
  if (extra && extra.length > 0) return "unknown";
  if (!consoleOrGame) return { console: null, game: null };
  if (isGameConsoleId(consoleOrGame)) {
    if (!gamePart) return { console: consoleOrGame, game: null };
    const game = gameById(gamePart);
    if (game && game.console === consoleOrGame) return { console: consoleOrGame, game: game.id };
    return "unknown";
  }
  if (isGameId(consoleOrGame) && !gamePart) {
    const game = gameById(consoleOrGame)!;
    return { console: game.console, game: game.id };
  }
  return "unknown";
}

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
    if (second === "games") {
      const games = parseGamesTail(third, rest[0], rest.slice(1));
      if (games === "unknown") return { kind: "unknown" };
      return { kind: "games", locale, ...games };
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
  if (first === "games") {
    const games = parseGamesTail(second, third, rest);
    if (games === "unknown") return { kind: "unknown" };
    return { kind: "bare-games", ...games };
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

export function gamesHref(
  locale: Locale,
  consoleId: GameConsoleId | null = null,
  game: GameId | null = null,
): string {
  const base = `/${localePath(locale)}/games`;
  if (game) {
    const resolved = consoleId ?? gameById(game)?.console;
    return resolved ? `${base}/${resolved}/${game}/` : `${base}/`;
  }
  return consoleId ? `${base}/${consoleId}/` : `${base}/`;
}

/** Keep `location.search` / `url.search` on canonical redirects. */
export function withSearch(path: string, search: string): string {
  return search && search !== "?" ? `${path}${search}` : path;
}
