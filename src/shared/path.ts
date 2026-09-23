import { isClipId } from "./clip";
import { DEVICE_SLUG, devicePageFromSlug, type DeviceChildId, type DevicePageId } from "./device";
import {
  gameById,
  isGameConsoleId,
  isGameId,
  type GameConsoleId,
  type GameId,
} from "./games";
import { isMarketId, type MarketId } from "./markets";
import { localePath, parseLocale, type Locale } from "./locale";

export const STATIC_FILE =
  /^\/(assets\/|covers\/|emu\/|favicon(\.svg|-\d+\.png)$|robots\.txt$|sitemap\.xml$|manifest\.webmanifest$)/;

export const CATEGORIES = [
  { id: "share", tools: ["clip", "qr", "barcode"] },
  { id: "image", tools: ["watermark", "collage", "portrait-sim", "resize", "crop", "rotate", "exif", "meme", "signature", "favicon", "screenshot"] },
  { id: "convert", tools: ["convert", "image-pdf", "pdf-jpg", "merge-pdf", "compress-pdf", "split-pdf", "invoice", "audio", "audio-cutter", "audio-joiner", "data", "xml-json", "yaml-json", "json", "base64"] },
  { id: "text", tools: ["password", "word-count", "color", "hex-rgb", "names", "timezone", "timestamp", "lorem", "units", "text-to-speech", "diff", "uuid", "hash", "regex", "case", "jwt", "percent", "random", "html", "cron", "slug", "age", "bmi", "binary", "tip", "morse", "roman", "discount", "countdown", "loan", "stopwatch", "compound", "vat", "reverse", "url-encode", "text-hex", "days", "sort", "replace", "words", "add-days", "week", "aspect", "workdays", "fraction", "hourly", "margin", "radix", "duration"] },
  { id: "assets", tools: ["gold", "silver", "platinum", "palladium", "oil", "stocks"] },
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
  "add-days",
  "week",
  "aspect",
  "workdays",
  "fraction",
  "hourly",
  "margin",
  "radix",
  "duration",
  "gold",
  "silver",
  "platinum",
  "palladium",
  "oil",
  "stocks",
] as const;
export type ToolId = (typeof TOOLS)[number];

/** Exact-match converter URLs. Same engine as `/convert/`, unique title and FAQ. */
export const CONVERT_JOBS = [
  "heic-to-jpg",
  "webp-to-png",
  "png-to-jpg",
  "jpg-to-png",
  "avif-to-jpg",
  "png-to-webp",
] as const;
export type ConvertJobId = (typeof CONVERT_JOBS)[number];

export function isConvertJobId(value: string): value is ConvertJobId {
  return (CONVERT_JOBS as readonly string[]).includes(value);
}

export const CONVERT_JOB_FORMAT: Record<ConvertJobId, "jpeg" | "png" | "webp"> = {
  "heic-to-jpg": "jpeg",
  "webp-to-png": "png",
  "png-to-jpg": "jpeg",
  "jpg-to-png": "png",
  "avif-to-jpg": "jpeg",
  "png-to-webp": "webp",
};

/** File-size page for the resizer. Same engine, exact query. */
export const RESIZE_JOBS = ["compress-image"] as const;
export type ResizeJobId = (typeof RESIZE_JOBS)[number];

export function isResizeJobId(value: string): value is ResizeJobId {
  return (RESIZE_JOBS as readonly string[]).includes(value);
}

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
  "make-signature",
  "annotate-screenshot",
  "make-invoice",
  "make-password",
  "format-json",
  "decode-base64",
  "unix-time",
  "read-jwt",
  "count-workdays",
  "simplify-fraction",
  "hourly-pay",
  "convert-timezone",
  "profit-margin",
  "convert-base",
  "add-duration",
  "calculate-percent",
  "days-between",
  "shift-date",
  "iso-week",
  "vat-price",
  "percent-off",
  "encode-url",
  "calculate-age",
  "aspect-ratio",
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
  { id: "files", tutorials: ["merge-pdf", "compress-pdf", "split-pdf", "heic-to-jpg", "jpg-to-pdf", "pdf-to-jpg", "webp-to-png", "png-to-jpg", "jpg-to-png", "avif-to-jpg", "png-to-webp", "make-invoice"] },
  { id: "photo", tutorials: ["crop-photo", "rotate-photo", "resize-image", "add-watermark", "remove-exif", "make-collage", "make-meme", "make-favicon", "make-signature", "annotate-screenshot"] },
  { id: "audio", tutorials: ["trim-audio", "mp3-to-wav", "join-audio"] },
  { id: "text", tutorials: ["count-words", "make-password", "format-json", "decode-base64", "unix-time", "read-jwt", "count-workdays", "simplify-fraction", "hourly-pay", "convert-timezone", "profit-margin", "convert-base", "add-duration", "calculate-percent", "days-between", "shift-date", "iso-week", "vat-price", "percent-off", "encode-url", "calculate-age", "aspect-ratio"] },
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
  | { kind: "bare"; tool: ToolId | null; clipId?: string; convertJob?: ConvertJobId; resizeJob?: ResizeJobId }
  | { kind: "bare-learn"; tutorial: TutorialId | null }
  | ({ kind: "bare-games" } & GamesPath)
  | { kind: "bare-markets"; market: MarketId | null }
  | { kind: "bare-device"; page: DevicePageId }
  | { kind: "app"; locale: Locale; tool: ToolId | null; clipId?: string; convertJob?: ConvertJobId; resizeJob?: ResizeJobId }
  | { kind: "learn"; locale: Locale; tutorial: TutorialId | null }
  | ({ kind: "games"; locale: Locale } & GamesPath)
  | { kind: "markets"; locale: Locale; market: MarketId | null }
  | { kind: "device"; locale: Locale; page: DevicePageId }
  | { kind: "clip"; id: string }
  | { kind: "unknown" };

function parseDevicePage(slug: string | undefined, extra: string[]): DevicePageId | "unknown" {
  if (extra.length > 0) return "unknown";
  if (!slug) return "hub";
  return devicePageFromSlug(slug) ?? "unknown";
}

function parseMarketsTail(page?: string, extra?: string[]): MarketId | null | "unknown" {
  if (extra && extra.length > 0) return "unknown";
  if (!page) return null;
  return isMarketId(page) ? page : "unknown";
}

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
    if (second === "markets") {
      const market = parseMarketsTail(third, rest);
      if (market === "unknown") return { kind: "unknown" };
      return { kind: "markets", locale, market };
    }
    if (second === "device") {
      const page = parseDevicePage(third, rest);
      if (page === "unknown") return { kind: "unknown" };
      return { kind: "device", locale, page };
    }
    if (rest.length > 0) return { kind: "unknown" };
    if (!isToolId(second)) return { kind: "unknown" };
    if (!third) return { kind: "app", locale, tool: second };
    if (second === "clip" && isClipId(third)) {
      return { kind: "app", locale, tool: "clip", clipId: third };
    }
    if (second === "convert" && isConvertJobId(third)) {
      return { kind: "app", locale, tool: "convert", convertJob: third };
    }
    if (second === "resize" && isResizeJobId(third)) {
      return { kind: "app", locale, tool: "resize", resizeJob: third };
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
  if (first === "device") {
    const page = parseDevicePage(second, third ? [third, ...rest] : []);
    if (page === "unknown") return { kind: "unknown" };
    return { kind: "bare-device", page };
  }
  if (first === "markets") {
    const extra = [third, ...rest].filter((part): part is string => Boolean(part));
    const market = parseMarketsTail(second, extra);
    if (market === "unknown") return { kind: "unknown" };
    return { kind: "bare-markets", market };
  }
  if (isToolId(first) && !second) return { kind: "bare", tool: first };
  if (first === "convert" && second && !third && isConvertJobId(second)) {
    return { kind: "bare", tool: "convert", convertJob: second };
  }
  if (first === "resize" && second && !third && isResizeJobId(second)) {
    return { kind: "bare", tool: "resize", resizeJob: second };
  }
  if (first === "clip" && second && !third && isClipId(second)) {
    return { kind: "bare", tool: "clip", clipId: second };
  }
  return { kind: "unknown" };
}

export function appHref(
  locale: Locale,
  tool: ToolId | null,
  clipId?: string | null,
  job?: ConvertJobId | ResizeJobId | null,
): string {
  const base = `/${localePath(locale)}`;
  if (tool === "clip" && clipId) return `${base}/clip/${clipId.toLowerCase()}/`;
  if (tool === "convert" && job && isConvertJobId(job)) return `${base}/convert/${job}/`;
  if (tool === "resize" && job && isResizeJobId(job)) return `${base}/resize/${job}/`;
  return tool ? `${base}/${tool}/` : `${base}/`;
}

export function toolJob(parsed: AppPath): ConvertJobId | ResizeJobId | null {
  if (parsed.kind === "app" || parsed.kind === "bare") return parsed.convertJob ?? parsed.resizeJob ?? null;
  return null;
}

export function deviceHref(locale: Locale, page: DevicePageId = "hub"): string {
  const base = `/${localePath(locale)}/device`;
  if (page === "hub") return `${base}/`;
  const slug: DeviceChildId = page;
  return `${base}/${DEVICE_SLUG[slug]}/`;
}

export function learnHref(locale: Locale, tutorial: TutorialId | null = null): string {
  const base = `/${localePath(locale)}/learn`;
  return tutorial ? `${base}/${tutorial}/` : `${base}/`;
}

export function marketsHref(locale: Locale, market: MarketId | null = null): string {
  const base = `/${localePath(locale)}/markets`;
  return market ? `${base}/${market}/` : `${base}/`;
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
