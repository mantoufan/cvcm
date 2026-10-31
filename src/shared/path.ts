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
import { isQuizId, type QuizId } from "./quiz";
import { DATASET_SEGMENT, isDatasetId, type DatasetId } from "./datasets";
import { CODE_SEGMENT, KB_SEGMENT, isKbId, kbArticleOf, kbShelfOf, kbShelfOfPage, type KbId, type KbPage, type KbShelf } from "./kb";
import { REF_SEGMENT, isRefId, type RefId } from "./ref";
import { localePath, parseLocale, type Locale } from "./locale";

/** Child sitemaps listed by `/sitemap.xml` (`/sitemaps/<section>.xml`), so Search Console reports indexing per section. */
export const SITEMAP_SECTIONS = ["pages", "learn", "games", "tests", "datasets", "reference"] as const;

/** Agent discovery files (`src/shared/agent-docs.ts`): static, and readable from any origin (the Worker adds CORS). */
export const AGENT_DOC_PATHS = ["/llms.txt", "/tools.json", "/.well-known/poppy.json"] as const;

const AGENT_DOC_SET: ReadonlySet<string> = new Set(AGENT_DOC_PATHS);

export function isAgentDocPath(pathname: string): boolean {
  return AGENT_DOC_SET.has(pathname);
}

const AGENT_DOC_PATTERN = AGENT_DOC_PATHS.map((p) => `${p.slice(1).replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}$`).join("|");

export const STATIC_FILE = new RegExp(
  String.raw`^\/(assets\/|brand\/|covers\/|thumbs\/|emu\/|ai\/|favicon(\.svg|-\d+\.png)$|robots\.txt$|${AGENT_DOC_PATTERN}|sitemap\.xml$|sitemaps\/(${SITEMAP_SECTIONS.join("|")})\.xml$|4972981e4cdf3fdd13b674ad85304c11\.txt$|manifest\.webmanifest$|datasets\/[a-z0-9-]+\.csv$)`,
);

/** Personality tests live under `/{locale}/tests/` (the code calls them quizzes to keep them apart from unit tests). */
export const QUIZ_SEGMENT = "tests";

export const CATEGORIES = [
  { id: "share", tools: ["clip", "qr", "barcode"] },
  // In-browser AI (Transformers.js / ONNX Runtime): models download once from /ai/models/ and run on the GPU or CPU.
  { id: "ai", tools: ["remove-background", "image-upscaler", "speech-to-text", "depth-map"] },
  { id: "image", tools: ["watermark", "mosaic", "collage", "portrait-sim", "resize", "crop", "rotate", "exif", "meme", "signature", "favicon", "screenshot", "image-colors"] },
  { id: "convert", tools: ["convert", "image-pdf", "pdf-jpg", "merge-pdf", "compress-pdf", "split-pdf", "invoice", "audio", "audio-cutter", "audio-joiner", "data", "xml-json", "yaml-json", "json", "base64"] },
  { id: "text", tools: ["password", "word-count", "color", "hex-rgb", "names", "timezone", "timestamp", "lorem", "units", "text-to-speech", "diff", "uuid", "hash", "regex", "case", "jwt", "percent", "random", "html", "cron", "slug", "age", "bmi", "binary", "tip", "morse", "roman", "discount", "countdown", "loan", "stopwatch", "compound", "vat", "reverse", "url-encode", "text-hex", "days", "sort", "replace", "words", "add-days", "week", "aspect", "workdays", "fraction", "hourly", "margin", "radix", "duration", "tdee", "cidr", "chmod", "typing", "dice", "gpa", "pomodoro", "sleep", "body-fat", "contrast", "pace", "grade", "due-date", "ideal-weight", "water-intake", "fuel-cost", "reading-time", "time-card", "electricity", "ovulation", "macro", "calories-burned", "wheel", "average", "metronome", "keyboard-test", "zodiac"] },
  { id: "assets", tools: ["gold", "silver", "platinum", "palladium", "oil", "stocks"] },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];

export const TOOLS = [
  "clip",
  "qr",
  "barcode",
  "watermark",
  "mosaic",
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
  "tdee",
  "cidr",
  "chmod",
  "typing",
  "image-colors",
  "dice",
  "gpa",
  "pomodoro",
  "sleep",
  "body-fat",
  "contrast",
  "pace",
  "grade",
  "due-date",
  "ideal-weight",
  "water-intake",
  "fuel-cost",
  "reading-time",
  "time-card",
  "electricity",
  "ovulation",
  "macro",
  "calories-burned",
  "wheel",
  "average",
  "metronome",
  "keyboard-test",
  "zodiac",
  "gold",
  "silver",
  "platinum",
  "palladium",
  "oil",
  "stocks",
  "remove-background",
  "image-upscaler",
  "speech-to-text",
  "depth-map",
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
  "watermark-id-copy",
  "mosaic-photo",
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
  "calculate-bmi",
  "split-tip",
  "loan-payment",
  "read-cron",
  "find-bedtime",
  "measure-body-fat",
  "check-contrast",
  "calculate-pace",
  "calculate-final-grade",
  "calculate-tdee",
  "calculate-gpa",
  "use-pomodoro",
  "find-due-date",
  "find-ideal-weight",
  "daily-water",
  "trip-fuel-cost",
  "estimate-reading-time",
  "compare-text",
  "hash-text",
  "generate-uuid",
  "calculate-work-hours",
  "electricity-cost",
  "find-fertile-window",
  "calculate-macros",
  "calories-burned-exercise",
  "compound-interest",
  "remove-photo-background",
  "test-regex",
  "pick-random-name",
  "calculate-average",
  "use-metronome",
  "test-keyboard",
  "find-zodiac-sign",
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

export type TutorialGroupId = "codes" | "files" | "photo" | "audio" | "text" | "dev" | "time" | "money" | "health" | "math" | "court" | "water" | "code" | "mind" | "course";

// New how-tos are published. Legacy ids still parse so old URLs 301 to the hub.
export const TUTORIAL_GROUPS: readonly {
  id: TutorialGroupId;
  tutorials: readonly TutorialId[];
}[] = [
  { id: "codes", tutorials: ["make-qr", "make-barcode"] },
  { id: "files", tutorials: ["merge-pdf", "compress-pdf", "split-pdf", "heic-to-jpg", "jpg-to-pdf", "pdf-to-jpg", "webp-to-png", "png-to-jpg", "jpg-to-png", "avif-to-jpg", "png-to-webp", "make-invoice"] },
  { id: "photo", tutorials: ["crop-photo", "rotate-photo", "resize-image", "add-watermark", "watermark-id-copy", "mosaic-photo", "remove-exif", "make-collage", "make-meme", "make-favicon", "make-signature", "annotate-screenshot", "remove-photo-background"] },
  { id: "audio", tutorials: ["trim-audio", "mp3-to-wav", "join-audio", "use-metronome"] },
  { id: "dev", tutorials: ["format-json", "decode-base64", "encode-url", "read-jwt", "unix-time", "convert-base", "read-cron", "hash-text", "generate-uuid", "test-regex", "make-password", "check-contrast", "test-keyboard"] },
  { id: "text", tutorials: ["count-words", "compare-text", "estimate-reading-time"] },
  { id: "time", tutorials: ["days-between", "shift-date", "count-workdays", "add-duration", "calculate-age", "iso-week", "convert-timezone", "calculate-work-hours", "use-pomodoro", "find-zodiac-sign"] },
  { id: "money", tutorials: ["calculate-percent", "percent-off", "vat-price", "split-tip", "profit-margin", "hourly-pay", "loan-payment", "compound-interest", "trip-fuel-cost", "electricity-cost"] },
  { id: "health", tutorials: ["calculate-bmi", "measure-body-fat", "find-ideal-weight", "calculate-tdee", "calculate-macros", "calories-burned-exercise", "daily-water", "calculate-pace", "find-bedtime", "find-due-date", "find-fertile-window"] },
  { id: "math", tutorials: ["simplify-fraction", "aspect-ratio", "calculate-final-grade", "calculate-gpa", "calculate-average", "pick-random-name"] },
];
export const FEATURED_TUTORIALS: readonly TutorialId[] = TUTORIAL_GROUPS.flatMap(
  (group) => [...group.tutorials],
);

export function isPublishedTutorial(id: TutorialId): boolean {
  return FEATURED_TUTORIALS.includes(id);
}

/** AI tools: their pages are cross-origin isolated (threaded WebAssembly), so links into or out of them load a fresh document. */
export const AI_TOOLS: ReadonlySet<ToolId> = new Set<ToolId>(CATEGORIES.find((c) => c.id === "ai")!.tools);

export function isAiToolPath(pathname: string): boolean {
  const parsed = parseAppPath(pathname);
  return (parsed.kind === "app" || parsed.kind === "bare") && parsed.tool !== null && AI_TOOLS.has(parsed.tool);
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

export const LEGAL_PAGES = ["privacy", "terms"] as const;
export type LegalPageId = (typeof LEGAL_PAGES)[number];

export function isLegalPageId(value: string): value is LegalPageId {
  return (LEGAL_PAGES as readonly string[]).includes(value);
}

export type GamesPath = {
  console: GameConsoleId | null;
  game: GameId | null;
};

/** A kb route: an article, null for the knowledge hub, or "code" for the coding hub. */
export type KbArticlePath = KbId | "code" | null;

function kbShelfOfSegment(segment: string | undefined): KbShelf | null {
  return segment === KB_SEGMENT ? "knowledge" : segment === CODE_SEGMENT ? "code" : null;
}

/** The article under a shelf segment: its hub when empty, undefined when the id is not on that shelf. */
function parseKbArticle(shelf: KbShelf, slug: string | undefined): KbArticlePath | undefined {
  if (!slug) return shelf === "code" ? "code" : null;
  return isKbId(slug) && kbShelfOf(slug) === shelf ? slug : undefined;
}

export type AppPath =
  | { kind: "static" }
  | { kind: "bare"; tool: ToolId | null; clipId?: string; convertJob?: ConvertJobId; resizeJob?: ResizeJobId }
  | { kind: "bare-learn"; tutorial: TutorialId | null }
  | ({ kind: "bare-games" } & GamesPath)
  | { kind: "bare-markets"; market: MarketId | null }
  | { kind: "bare-device"; page: DevicePageId }
  | { kind: "bare-legal"; page: LegalPageId }
  | { kind: "bare-quiz"; quiz: QuizId | null }
  | { kind: "bare-dataset"; dataset: DatasetId | null }
  | { kind: "bare-kb"; article: KbArticlePath }
  | { kind: "bare-ref"; entry: RefId | null }
  | { kind: "app"; locale: Locale; tool: ToolId | null; clipId?: string; convertJob?: ConvertJobId; resizeJob?: ResizeJobId }
  | { kind: "learn"; locale: Locale; tutorial: TutorialId | null }
  | ({ kind: "games"; locale: Locale } & GamesPath)
  | { kind: "markets"; locale: Locale; market: MarketId | null }
  | { kind: "device"; locale: Locale; page: DevicePageId }
  | { kind: "legal"; locale: Locale; page: LegalPageId }
  | { kind: "quiz"; locale: Locale; quiz: QuizId | null }
  | { kind: "dataset"; locale: Locale; dataset: DatasetId | null }
  | { kind: "kb"; locale: Locale; article: KbArticlePath }
  | { kind: "ref"; locale: Locale; entry: RefId | null }
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

/**
 * Locale prefixes from the old site that Google still crawls (`/zh/terms`). They parse as the current locale,
 * so the Worker's canonical check sends one 301 to the real page (`/zh-cn/terms/`).
 */
const LEGACY_LOCALES = new Map<string, Locale>([
  ["zh", "zh-CN"],
  ["zh-hans", "zh-CN"],
  ["zh-hant", "zh-TW"],
]);

export function parseAppPath(pathname: string): AppPath {
  const raw = pathname.split("?")[0] || "/";
  if (STATIC_FILE.test(raw)) return { kind: "static" };

  const parts = raw.split("/").filter(Boolean).map((part) => part.toLowerCase());
  if (parts.length === 0) return { kind: "bare", tool: null };

  const [first, second, third, ...rest] = parts;
  if (first === "c" && second && !third && isClipId(second)) {
    return { kind: "clip", id: second };
  }

  const locale = parseLocale(first) ?? LEGACY_LOCALES.get(first) ?? null;
  if (locale) {
    if (!second) {
      if (rest.length > 0) return { kind: "unknown" };
      return { kind: "app", locale, tool: null };
    }
    if (second === "learn") {
      const shelf = kbShelfOfSegment(third);
      if (shelf) {
        if (rest.length > 1) return { kind: "unknown" };
        const article = parseKbArticle(shelf, rest[0]);
        return article === undefined ? { kind: "unknown" } : { kind: "kb", locale, article };
      }
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
    if (second === QUIZ_SEGMENT) {
      if (rest.length > 0) return { kind: "unknown" };
      if (!third) return { kind: "quiz", locale, quiz: null };
      if (isQuizId(third)) return { kind: "quiz", locale, quiz: third };
      return { kind: "unknown" };
    }
    if (second === DATASET_SEGMENT) {
      if (rest.length > 0) return { kind: "unknown" };
      if (!third) return { kind: "dataset", locale, dataset: null };
      if (isDatasetId(third)) return { kind: "dataset", locale, dataset: third };
      return { kind: "unknown" };
    }
    if (second === REF_SEGMENT) {
      if (rest.length > 0) return { kind: "unknown" };
      if (!third) return { kind: "ref", locale, entry: null };
      if (isRefId(third)) return { kind: "ref", locale, entry: third };
      return { kind: "unknown" };
    }
    if (isLegalPageId(second)) {
      if (third || rest.length > 0) return { kind: "unknown" };
      return { kind: "legal", locale, page: second };
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
    const shelf = kbShelfOfSegment(second);
    if (shelf) {
      if (rest.length > 0) return { kind: "unknown" };
      const article = parseKbArticle(shelf, third);
      return article === undefined ? { kind: "unknown" } : { kind: "bare-kb", article };
    }
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
  if (first === QUIZ_SEGMENT) {
    if (!second) return { kind: "bare-quiz", quiz: null };
    if (isQuizId(second) && !third) return { kind: "bare-quiz", quiz: second };
    return { kind: "unknown" };
  }
  if (first === DATASET_SEGMENT) {
    if (!second) return { kind: "bare-dataset", dataset: null };
    if (isDatasetId(second) && !third) return { kind: "bare-dataset", dataset: second };
    return { kind: "unknown" };
  }
  if (first === REF_SEGMENT) {
    if (!second) return { kind: "bare-ref", entry: null };
    if (isRefId(second) && !third) return { kind: "bare-ref", entry: second };
    return { kind: "unknown" };
  }
  if (isLegalPageId(first) && !second) return { kind: "bare-legal", page: first };
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

export function quizHref(locale: Locale, quiz: QuizId | null = null): string {
  const base = `/${localePath(locale)}/${QUIZ_SEGMENT}`;
  return quiz ? `${base}/${quiz}/` : `${base}/`;
}

export function datasetHref(locale: Locale, dataset: DatasetId | null = null): string {
  const base = `/${localePath(locale)}/${DATASET_SEGMENT}`;
  return dataset ? `${base}/${dataset}/` : `${base}/`;
}

/** The pose and style reference: `/{locale}/reference/` (hub) and `/{locale}/reference/{id}/`. */
export function refHref(locale: Locale, entry: RefId | null = null): string {
  const base = `/${localePath(locale)}/${REF_SEGMENT}`;
  return entry ? `${base}/${entry}/` : `${base}/`;
}

export function legalHref(locale: Locale, page: LegalPageId): string {
  return `/${localePath(locale)}/${page}/`;
}

export function learnHref(locale: Locale, tutorial: TutorialId | null = null): string {
  const base = `/${localePath(locale)}/learn`;
  return tutorial ? `${base}/${tutorial}/` : `${base}/`;
}

/** Kb articles sit under the tutorials: `/{locale}/learn/knowledge/{id}/` and `/{locale}/learn/code/{id}/`; null or "hub" is the knowledge hub, "code" the coding hub. */
export function kbHref(locale: Locale, page: KbPage = null): string {
  const base = `/${localePath(locale)}/learn/${kbShelfOfPage(page) === "code" ? CODE_SEGMENT : KB_SEGMENT}`;
  const article = kbArticleOf(page);
  return article ? `${base}/${article}/` : `${base}/`;
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
