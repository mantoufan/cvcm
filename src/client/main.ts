import { h } from "./dom";
import { faqSection, syncPageJsonLd } from "./faq";
import { guideSection } from "./guide";
import { COVER, DEVICE_COVER, GAME_COVER, LEARN_COVER, MARKET_COVER } from "./covers";
import { LOCALES, hasPageMessages, loadPageMessages, locale, readStoredLocale, setLocale, t, type Locale } from "./i18n";
import { negotiateLocale } from "../shared/locale";
import {
  CATEGORIES,
  appHref,
  gamesHref,
  isPublishedTutorial,
  kbHref,
  learnHref,
  legalHref,
  deviceHref,
  marketsHref,
  parseAppPath,
  quizHref,
  toolJob,
  withSearch,
  type ConvertJobId,
  type LegalPageId,
  type ResizeJobId,
  type ToolId,
  type TutorialId,
} from "../shared/path";
import type { GameConsoleId, GameId } from "../shared/games";
import type { DevicePageId } from "../shared/device";
import { legalStaticHtml } from "../shared/legal";
import type { MarketId } from "../shared/markets";
import { QUIZZES, type QuizId } from "../shared/quiz";
import { KB_ARTICLES, type KbId } from "../shared/kb";
import { BRANDED_TOOLS, hreflangAlternates, pageCanonical, pageDescription, pageTitle } from "../shared/seo";
import { toolLessonsSection } from "./tool-lessons";
import { TOOL_LOADERS } from "./tools";
import { analyticsActive, gateAnalytics, trackPageView } from "./analytics";
import { isTrackedPath } from "../shared/analytics";
import "./styles.css";

function requireApp(): HTMLElement {
  const el = document.getElementById("app");
  if (!el) throw new Error("#app");
  return el;
}
function appEl(): HTMLElement {
  return requireApp();
}

let tool: ToolId | null = null;
let clipId: string | null = null;
let convertJob: ConvertJobId | null = null;
let resizeJob: ResizeJobId | null = null;
let tutorial: TutorialId | null = null;
let learnHub = false;
let gamesHub = false;
let gameConsole: GameConsoleId | null = null;
let gameId: GameId | null = null;
let marketsHub = false;
let marketId: MarketId | null = null;
let devicePage: DevicePageId | null = null;
let legalPage: LegalPageId | null = null;
/** A test page: "hub" for /tests/, else the test id. */
let quizPage: QuizId | "hub" | null = null;
/** A knowledge page: "hub" for /learn/knowledge/, else the article id. */
let kbPage: KbId | "hub" | null = null;
const noop = (): void => {};
let unmountCurrent: () => void = noop;
/** Settles once the page from the latest render() has mounted and is on screen. */
let rendered: Promise<void> = Promise.resolve();
/** Settles when the latest page's mount finishes (no timeout, unlike `rendered`). */
let mountedPage: Promise<void> = Promise.resolve();
/** Scroll to the top when the next page swaps in (a link click, not Back/Forward or the first load). */
let scrollOnSwap = false;
let pageGen = 0;
let localeReq = 0;
let renderedHref: string | null = null;

let started = false;

export function start(): void {
  if (!started) {
    started = true;
    // Registered before gtag loads, so this runs before gtag's own history listener.
    window.addEventListener("popstate", () => {
      // Following an in-page #anchor (a table of contents, #tools) also fires popstate: the page itself is unchanged.
      if (renderedHref && renderedHref.split("#")[0] === location.pathname + location.search) {
        renderedHref = location.pathname + location.search + location.hash;
        return;
      }
      gateAnalytics(location.pathname);
      render();
    });
    document.addEventListener("click", onClick);
    document.addEventListener("pointerover", prefetchGamePack, { passive: true });
    document.addEventListener("touchstart", prefetchGamePack, { passive: true });
    document.addEventListener("focusin", prefetchGamePack);
  }
  boot();
}

if (!import.meta.env.VITEST) start();

export function boot(): void {
  const parsed = parseAppPath(location.pathname);
  const stored = readStoredLocale();
  if (parsed.kind === "app") {
    setLocale(parsed.locale);
    applyTool(parsed.tool, parsed.clipId ?? null);
    const canonical = appHref(parsed.locale, parsed.tool, parsed.clipId, toolJob(parsed));
    if (location.pathname !== canonical) {
      history.replaceState(null, "", withSearch(canonical, location.search));
    }
  } else if (parsed.kind === "learn") {
    setLocale(parsed.locale);
    applyLearn(parsed.tutorial);
    const canonical = learnHref(parsed.locale, parsed.tutorial);
    if (location.pathname !== canonical) {
      history.replaceState(null, "", withSearch(canonical, location.search));
    }
  } else if (parsed.kind === "games") {
    setLocale(parsed.locale);
    applyGames(parsed.console, parsed.game);
    const canonical = gamesHref(parsed.locale, parsed.console, parsed.game);
    if (location.pathname !== canonical) {
      history.replaceState(null, "", withSearch(canonical, location.search));
    }
  } else if (parsed.kind === "markets") {
    setLocale(parsed.locale);
    applyTool(parsed.market, null);
    history.replaceState(null, "", withSearch(appHref(parsed.locale, parsed.market), location.search));
  } else if (parsed.kind === "device") {
    setLocale(parsed.locale);
    applyDevice(parsed.page);
    const canonical = deviceHref(parsed.locale, parsed.page);
    if (location.pathname !== canonical) {
      history.replaceState(null, "", withSearch(canonical, location.search));
    }
  } else if (parsed.kind === "legal") {
    setLocale(parsed.locale);
    applyLegal(parsed.page);
    const canonical = legalHref(parsed.locale, parsed.page);
    if (location.pathname !== canonical) {
      history.replaceState(null, "", withSearch(canonical, location.search));
    }
  } else if (parsed.kind === "quiz") {
    setLocale(parsed.locale);
    applyQuiz(parsed.quiz);
    const canonical = quizHref(parsed.locale, parsed.quiz);
    if (location.pathname !== canonical) {
      history.replaceState(null, "", withSearch(canonical, location.search));
    }
  } else if (parsed.kind === "bare-quiz") {
    const loc = stored ?? negotiateLocale(navigator.languages?.join(",") || navigator.language, null);
    setLocale(loc);
    applyQuiz(parsed.quiz);
    history.replaceState(null, "", withSearch(quizHref(loc, parsed.quiz), location.search));
  } else if (parsed.kind === "kb") {
    setLocale(parsed.locale);
    applyKb(parsed.article);
    const canonical = kbHref(parsed.locale, parsed.article);
    if (location.pathname !== canonical) {
      history.replaceState(null, "", withSearch(canonical, location.search));
    }
  } else if (parsed.kind === "bare-kb") {
    const loc = stored ?? negotiateLocale(navigator.languages?.join(",") || navigator.language, null);
    setLocale(loc);
    applyKb(parsed.article);
    history.replaceState(null, "", withSearch(kbHref(loc, parsed.article), location.search));
  } else if (parsed.kind === "clip") {
    const loc = stored ?? negotiateLocale(navigator.languages?.join(",") || navigator.language, null);
    setLocale(loc);
    applyTool("clip", parsed.id);
    history.replaceState(null, "", withSearch(appHref(loc, "clip", parsed.id), location.search));
  } else if (parsed.kind === "bare-learn") {
    const loc = stored ?? negotiateLocale(navigator.languages?.join(",") || navigator.language, null);
    setLocale(loc);
    applyLearn(parsed.tutorial);
    history.replaceState(null, "", withSearch(learnHref(loc, parsed.tutorial), location.search));
  } else if (parsed.kind === "bare-games") {
    const loc = stored ?? negotiateLocale(navigator.languages?.join(",") || navigator.language, null);
    setLocale(loc);
    applyGames(parsed.console, parsed.game);
    history.replaceState(null, "", withSearch(gamesHref(loc, parsed.console, parsed.game), location.search));
  } else if (parsed.kind === "bare-markets") {
    const loc = stored ?? negotiateLocale(navigator.languages?.join(",") || navigator.language, null);
    setLocale(loc);
    applyTool(parsed.market, null);
    history.replaceState(null, "", withSearch(appHref(loc, parsed.market), location.search));
  } else if (parsed.kind === "bare-device") {
    const loc = stored ?? negotiateLocale(navigator.languages?.join(",") || navigator.language, null);
    setLocale(loc);
    applyDevice(parsed.page);
    history.replaceState(null, "", withSearch(deviceHref(loc, parsed.page), location.search));
  } else if (parsed.kind === "bare-legal") {
    const loc = stored ?? negotiateLocale(navigator.languages?.join(",") || navigator.language, null);
    setLocale(loc);
    applyLegal(parsed.page);
    history.replaceState(null, "", withSearch(legalHref(loc, parsed.page), location.search));
  } else {
    const loc = stored ?? negotiateLocale(navigator.languages?.join(",") || navigator.language, null);
    const nextTool = parsed.kind === "bare" ? parsed.tool : null;
    const nextClip = parsed.kind === "bare" ? parsed.clipId ?? null : null;
    const nextJob = parsed.kind === "bare" ? toolJob(parsed) : null;
    setLocale(loc);
    applyTool(nextTool, nextClip);
    history.replaceState(null, "", withSearch(appHref(loc, nextTool, nextClip, nextJob), location.search));
  }
  render();
}

/** Start the game or knowledge pack download when such a link is about to be followed, so the page opens without a wait. */
function prefetchGamePack(e: Event): void {
  const target = e.target as Element | null;
  const loc = locale();
  if (target?.closest?.('a[data-nav^="game-"]')) {
    if (!hasPageMessages(loc, true)) loadPageMessages(loc, true).catch(() => {});
  } else if (target?.closest?.('a[data-nav^="kb-"], a[data-nav="knowledge"]')) {
    if (!hasPageMessages(loc, false, false, false, true)) loadPageMessages(loc, false, false, false, true).catch(() => {});
  }
}

function onClick(e: MouseEvent): void {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const target = e.target as HTMLElement | null;
  const a = target?.closest("a");
  if (!a || a.target === "_blank" || a.hasAttribute("download") || a.origin !== location.origin) return;
  // An in-page anchor (#tools) is the browser's job.
  if (a.hash && a.pathname === location.pathname && a.search === location.search) return;
  // With gtag running, open file tools and clip notes as a fresh page: their CSP has no GA hosts,
  // and gtag's automatic history tracking never sees the URL.
  if (analyticsActive() && !isTrackedPath(a.pathname)) return;
  if (parseAppPath(a.pathname).kind === "static") return;
  e.preventDefault();
  history.pushState(null, "", a.href);
  scrollOnSwap = true;
  render();
}

function applyTool(next: ToolId | null, nextClip: string | null): void {
  tool = next;
  clipId = nextClip;
  tutorial = null;
  learnHub = false;
  gamesHub = false;
  gameConsole = null;
  gameId = null;
  marketsHub = false;
  marketId = null;
  devicePage = null;
  legalPage = null;
  quizPage = null;
  kbPage = null;
}

function applyLearn(next: TutorialId | null): void {
  tool = null;
  clipId = null;
  tutorial = next;
  learnHub = next === null;
  gamesHub = false;
  gameConsole = null;
  gameId = null;
  marketsHub = false;
  marketId = null;
  devicePage = null;
  legalPage = null;
  quizPage = null;
  kbPage = null;
}

function applyGames(consoleId: GameConsoleId | null, nextGame: GameId | null): void {
  tool = null;
  clipId = null;
  tutorial = null;
  learnHub = false;
  gamesHub = nextGame === null;
  gameConsole = consoleId;
  gameId = nextGame;
  marketsHub = false;
  marketId = null;
  devicePage = null;
  legalPage = null;
  quizPage = null;
  kbPage = null;
}

function applyDevice(page: DevicePageId): void {
  tool = null;
  clipId = null;
  tutorial = null;
  learnHub = false;
  gamesHub = false;
  gameConsole = null;
  gameId = null;
  marketsHub = false;
  marketId = null;
  devicePage = page;
  legalPage = null;
  quizPage = null;
  kbPage = null;
}

function applyLegal(page: LegalPageId): void {
  tool = null;
  clipId = null;
  tutorial = null;
  learnHub = false;
  gamesHub = false;
  gameConsole = null;
  gameId = null;
  marketsHub = false;
  marketId = null;
  devicePage = null;
  legalPage = page;
  quizPage = null;
  kbPage = null;
}

function applyQuiz(id: QuizId | null): void {
  tool = null;
  clipId = null;
  tutorial = null;
  learnHub = false;
  gamesHub = false;
  gameConsole = null;
  gameId = null;
  marketsHub = false;
  marketId = null;
  devicePage = null;
  legalPage = null;
  quizPage = id ?? "hub";
  kbPage = null;
}

function applyKb(id: KbId | null): void {
  applyTool(null, null);
  kbPage = id ?? "hub";
}

function unmountTools(): void {
  const unmount = unmountCurrent;
  unmountCurrent = noop;
  unmount();
}

export function render(): void {
  const parsed = parseAppPath(location.pathname);
  const loc: Locale = parsed.kind === "app" || parsed.kind === "learn" || parsed.kind === "games" || parsed.kind === "markets" || parsed.kind === "device" || parsed.kind === "legal" || parsed.kind === "quiz" || parsed.kind === "kb"
    ? parsed.locale
    : locale();
  const req = ++localeReq;
  const gamePage = (parsed.kind === "games" || parsed.kind === "bare-games") && Boolean(parsed.game);
  const legal = parsed.kind === "legal" || parsed.kind === "bare-legal";
  const quiz = parsed.kind === "quiz" || parsed.kind === "bare-quiz";
  const kb = parsed.kind === "kb" || parsed.kind === "bare-kb";
  if (!hasPageMessages(loc, gamePage, legal, quiz, kb)) {
    // Keep the current (or server-rendered) page until this page's strings arrive.
    loadPageMessages(loc, gamePage, legal, quiz, kb).then(
      () => {
        try {
          sessionStorage.removeItem(RELOAD_KEY);
        } catch {
          /* private mode */
        }
        if (req === localeReq) render();
      },
      () => {
        if (req !== localeReq) return;
        // Online, a full load picks up current chunk names (a tab left open across a deploy).
        if ((!renderedHref || navigator.onLine) && reloadOnce()) return;
        restoreRendered();
      },
    );
    return;
  }
  pageGen += 1;
  unmountTools();
  convertJob = parsed.kind === "app" || parsed.kind === "bare" ? parsed.convertJob ?? null : null;
  resizeJob = parsed.kind === "app" || parsed.kind === "bare" ? parsed.resizeJob ?? null : null;
  if (parsed.kind === "app") {
    setLocale(parsed.locale);
    applyTool(parsed.tool, parsed.clipId ?? null);
  } else if (parsed.kind === "learn") {
    setLocale(parsed.locale);
    const published = parsed.tutorial && isPublishedTutorial(parsed.tutorial);
    if (parsed.tutorial && !published) {
      history.replaceState(null, "", withSearch(learnHref(parsed.locale, null), location.search));
    }
    applyLearn(published ? parsed.tutorial : null);
  } else if (parsed.kind === "games") {
    setLocale(parsed.locale);
    applyGames(parsed.console, parsed.game);
  } else if (parsed.kind === "markets") {
    setLocale(parsed.locale);
    applyTool(parsed.market, null);
    history.replaceState(null, "", withSearch(appHref(parsed.locale, parsed.market), location.search));
  } else if (parsed.kind === "clip") {
    applyTool("clip", parsed.id);
  } else if (parsed.kind === "bare-learn") {
    const published = parsed.tutorial && isPublishedTutorial(parsed.tutorial);
    applyLearn(published ? parsed.tutorial : null);
  } else if (parsed.kind === "bare-games") {
    applyGames(parsed.console, parsed.game);
  } else if (parsed.kind === "bare-markets") {
    applyTool(parsed.market, null);
  } else if (parsed.kind === "device") {
    setLocale(parsed.locale);
    applyDevice(parsed.page);
  } else if (parsed.kind === "bare-device") {
    applyDevice(parsed.page);
  } else if (parsed.kind === "legal") {
    setLocale(parsed.locale);
    applyLegal(parsed.page);
  } else if (parsed.kind === "bare-legal") {
    applyLegal(parsed.page);
  } else if (parsed.kind === "quiz") {
    setLocale(parsed.locale);
    applyQuiz(parsed.quiz);
  } else if (parsed.kind === "bare-quiz") {
    applyQuiz(parsed.quiz);
  } else if (parsed.kind === "kb") {
    setLocale(parsed.locale);
    applyKb(parsed.article);
  } else if (parsed.kind === "bare-kb") {
    applyKb(parsed.article);
  } else if (parsed.kind === "bare") {
    applyTool(parsed.tool, parsed.clipId ?? null);
  } else {
    applyTool(null, null);
  }

  const seo = kbPage
    ? { kb: true as const, kbId: kbPage === "hub" ? null : kbPage }
    : learnHub || tutorial
    ? { learn: true as const, tutorial }
    : gamesHub || gameId
      ? { games: true as const, console: gameConsole, game: gameId }
      : devicePage
        ? { devicePage }
        : quizPage
        ? { quiz: true as const, quizId: quizPage === "hub" ? null : quizPage }
        : legalPage
        ? { legalPage }
        : marketsHub || marketId
          ? { markets: true as const, market: marketId }
          : { tool, clipId, convertJob, resizeJob };
  document.title = pageTitle(loc, seo);
  upsertMeta("name", "description", pageDescription(loc, seo));
  let canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.setAttribute("rel", "canonical");
    document.head.append(canonical);
  }
  canonical.setAttribute("href", pageCanonical(loc, seo));
  upsertMeta("property", "og:title", pageTitle(loc, seo));
  upsertMeta("property", "og:description", pageDescription(loc, seo));
  upsertMeta("property", "og:url", pageCanonical(loc, seo));
  upsertMeta("property", "og:type", (tutorial || gameId || (kbPage && kbPage !== "hub")) ? "article" : "website");
  syncHreflang(seo);
  const image = devicePage
    ? DEVICE_COVER
    : tutorial
    ? LEARN_COVER[tutorial]
    : gameId
      ? GAME_COVER[gameId]
      : marketId
        ? MARKET_COVER[marketId]
        : tool
          ? COVER[tool]
          : null;
  upsertMeta("property", "og:image", image ? `https://cv.cm${image.split("?")[0]}` : null);
  upsertMeta("name", "twitter:title", pageTitle(loc, seo));
  upsertMeta("name", "twitter:description", pageDescription(loc, seo));
  upsertMeta("name", "twitter:image", image ? `https://cv.cm${image.split("?")[0]}` : null);
  syncBrandIcon(Boolean(tool && !tutorial && !gameId && !devicePage && !marketId && BRANDED_TOOLS.has(tool)));
  syncPageJsonLd(loc, tool, tutorial, gameId, gamesHub, convertJob, resizeJob, marketId, marketsHub, devicePage, gameConsole, legalPage, quizPage, kbPage);

  const root = appEl();
  const gen = pageGen;
  const { page, ready } = shell(loc);
  mountedPage = ready;
  const old = Array.from(root.children);
  if (old.length === 0) {
    root.append(page);
    rendered = ready;
  } else {
    // Keep what is on screen (the server HTML or the last page) until the new page has mounted, then swap in one
    // step, so nothing flashes empty while a tool chunk loads. The new page goes first in the DOM and the old one
    // loses its ids, so a tool that looks itself up by id or class while mounting finds its own elements.
    // First load: the old page is the server HTML (no handlers, plain links), kept usable until the swap.
    // Later: the old page's tool is already unmounted, so its controls go inert.
    const hydrating = renderedHref === null;
    for (const el of old) {
      el.removeAttribute("id");
      el.querySelectorAll("[id]").forEach((node) => node.removeAttribute("id"));
      if (!hydrating && el instanceof HTMLElement) el.inert = true;
    }
    page.classList.add("pending");
    root.prepend(page);
    const scroll = scrollOnSwap;
    scrollOnSwap = false;
    // The server HTML is complete, so on first load wait for the real mount; later pages swap in after a short cap.
    rendered = (hydrating ? ready : Promise.race([ready, wait(SWAP_WAIT_MS)])).then(() => {
      if (gen !== pageGen) return;
      const focus = hydrating ? carryInput(old, page) : null;
      for (const el of old) el.remove();
      page.classList.remove("pending");
      focus?.();
      const anchor = location.hash ? document.getElementById(hashId(location.hash)) : null;
      if (anchor) anchor.scrollIntoView();
      else if (scroll) window.scrollTo(0, 0);
    });
  }
  trackPageView();
  renderedHref = location.pathname + location.search + location.hash;
}

// Text fields only: their value is what the visitor typed. Other controls hold defaults the browser may normalize.
const CARRIED = 'textarea, input:not([type]), input[type="text"], input[type="search"], input[type="email"], input[type="url"]';
type TextField = HTMLInputElement | HTMLTextAreaElement;

/**
 * Text typed into the server HTML before the app took over: copy it into the same field of the mounted page.
 * Returns a callback that moves focus and caret there, to run once the page is visible (hidden fields cannot focus).
 */
function carryInput(old: Element[], page: HTMLElement): (() => void) | null {
  const before = old.flatMap((el) => Array.from(el.querySelectorAll<TextField>(CARRIED)));
  const after = Array.from(page.querySelectorAll<TextField>(CARRIED));
  // Fields pair up by position; give up if the two pages do not have the same fields.
  if (before.length !== after.length || before.some((field, i) => field.tagName !== after[i].tagName)) return null;
  let focus: (() => void) | null = null;
  // The clipboard's rich editor: carry what was typed as plain text (never markup from the old DOM).
  const oldEditors = old.flatMap((el) => Array.from(el.querySelectorAll<HTMLElement>('[contenteditable="true"]')));
  const newEditors = Array.from(page.querySelectorAll<HTMLElement>('[contenteditable="true"]'));
  oldEditors.forEach((editor, i) => {
    const next = newEditors[i];
    const text = editor.innerText.trim();
    // Only into an editor that is showing (not hidden behind Markdown mode) and empty (no restored draft to clobber).
    const showing = next ? next.getClientRects().length > 0 : false;
    const empty = next ? !next.innerText.trim() && !next.querySelector("img, video, audio, [data-up]") : false;
    if (!next || !text || !showing || !empty) return;
    next.innerText = editor.innerText;
    next.dispatchEvent(new Event("input", { bubbles: true }));
    if (editor === document.activeElement) focus = () => next.focus();
  });
  before.forEach((field, i) => {
    const next = after[i];
    if (field === document.activeElement) {
      const { selectionStart, selectionEnd } = field;
      focus = () => {
        next.focus();
        if (selectionStart !== null && selectionEnd !== null) next.setSelectionRange(selectionStart, selectionEnd);
      };
    }
    if (field.readOnly || field.value === field.defaultValue) return;
    next.value = field.value;
    next.dispatchEvent(new Event("input", { bubbles: true }));
  });
  return focus;
}

function hashId(hash: string): string {
  try {
    return decodeURIComponent(hash.slice(1));
  } catch {
    return hash.slice(1);
  }
}

/** A tool that takes longer than this to mount (a clip note still loading) is swapped in as it is. */
const SWAP_WAIT_MS = 1200;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

/** Settles when the page from the latest render() is mounted and on screen. Used by the build's prerender. */
export function whenRendered(): Promise<void> {
  return rendered;
}

const RELOAD_KEY = "cvcm-locale-reload";

/** A locale pack failed to load (offline, or a tab still on an older deploy's chunk names). Try one full page load per path. */
function reloadOnce(): boolean {
  try {
    if (sessionStorage.getItem(RELOAD_KEY) === location.pathname) return false;
    sessionStorage.setItem(RELOAD_KEY, location.pathname);
  } catch {
    return false;
  }
  location.reload();
  return true;
}

/** Point the URL and language picker back at the page still on screen. Before the first render that is the server HTML. */
function restoreRendered(): void {
  if (!renderedHref) return;
  history.replaceState(null, "", renderedHref);
  const select = document.querySelector<HTMLSelectElement>("select.lang");
  if (select) select.value = locale();
}

function shell(loc: Locale): { page: HTMLElement; ready: Promise<void> } {
  const main = h("main", { id: "main" });
  const ready = mountPage(main, loc).catch((err: unknown) => {
    console.error(err);
  });
  const home = !(tool || tutorial || learnHub || gamesHub || gameId || marketsHub || marketId || devicePage || legalPage || quizPage || kbPage);
  const toolsOn = Boolean(tool) || Boolean(devicePage) || Boolean(marketsHub || marketId);
  const gamesOn = gamesHub || Boolean(gameId);
  const learnOn = learnHub || Boolean(tutorial) || Boolean(kbPage);
  const testsOn = Boolean(quizPage);
  const page = h("div", { class: "page" + (home ? " is-home" : "") + (gameId || gameConsole === "flash" ? " is-game" : "") },
    h("header", { class: "top" },
      h("a", { class: "brand", href: appHref(loc, null), "data-nav": "home", "aria-label": t("brand") }, "cv.cm"),
      h("nav", { class: "nav", "aria-label": t("nav.tools") },
        navLink(`${appHref(loc, null)}#tools`, t("nav.tools"), toolsOn, "tools"),
        navLink(quizHref(loc), t("nav.tests"), testsOn, "tests"),
        navLink(gamesHref(loc, null), t("nav.games"), gamesOn, "games"),
        navLink(learnHref(loc, null), t("nav.learn"), learnOn, "learn"),
      ),
      langSwitch(loc),
    ),
    main,
    h("footer", { class: "foot" },
      home ? null : toolDirectory(loc),
      h("p", null, t("footer.privacy")),
      h("nav", { class: "foot-links", "aria-label": t("footer.legal") },
        h("a", { href: legalHref(loc, "privacy"), "data-nav": "privacy" }, t("footer.privacyLink")),
        h("a", { href: legalHref(loc, "terms"), "data-nav": "terms" }, t("footer.termsLink")),
      ),
    ),
  );
  return { page, ready };
}

function navLink(href: string, label: string, on: boolean, nav: string): HTMLElement {
  return h("a", { class: on ? "on" : null, href, "data-nav": nav, "aria-current": on ? "page" : undefined }, label);
}

/** Every tool as a plain link, grouped like the home page, so any page is one click from any tool. */
function toolDirectory(loc: Locale): HTMLElement {
  return h("nav", { class: "dir", "aria-label": t("nav.tools") },
    ...CATEGORIES.map((cat) =>
      h("div", { class: "dir-group" },
        h("h2", null, t(`nav.${cat.id}`)),
        h("p", null,
          ...cat.tools.map((id) =>
            h("a", { href: appHref(loc, id), "data-nav": id, "aria-current": tool === id ? "page" : undefined }, t(`tools.${id}.name`)),
          ),
        ),
      ),
    ),
    h("div", { class: "dir-group" },
      h("h2", null, h("a", { href: quizHref(loc), "data-nav": "tests" }, t("nav.tests"))),
      h("p", null,
        ...QUIZZES.map((id) =>
          h("a", { href: quizHref(loc, id), "data-nav": `test-${id}`, "aria-current": quizPage === id ? "page" : undefined }, t(`quiz.${id}.name`)),
        ),
      ),
    ),
    h("div", { class: "dir-group" },
      h("h2", null, h("a", { href: kbHref(loc), "data-nav": "knowledge" }, t("kb.label"))),
      h("p", null,
        ...KB_ARTICLES.map((id) =>
          h("a", { href: kbHref(loc, id), "data-nav": `kb-${id}`, "aria-current": kbPage === id ? "page" : undefined }, t(`kb.${id}.name`)),
        ),
      ),
    ),
  );
}

async function mountPage(main: HTMLElement, loc: Locale): Promise<void> {
  const gen = pageGen;
  const alive = (): boolean => gen === pageGen;
  if (tool) {
    const mounted = tool;
    const unmount = await TOOL_LOADERS[mounted](main, { clipId, alive });
    if (!alive()) {
      // The user left while this tool was mounting: release its window listeners once the newer page has mounted,
      // unless that page uses the same module (watermark/mosaic, the asset tools), whose state this would clear.
      if (unmount) void mountedPage.then(() => {
        if (unmountCurrent !== unmount) unmount();
      });
      return;
    }
    unmountCurrent = unmount ?? noop;
    if (!(tool === "clip" && clipId)) {
      const lessons = toolLessonsSection(loc, tool);
      main.append(guideSection(tool), ...(lessons ? [lessons] : []), faqSection(loc, tool, convertJob, resizeJob));
    }
  } else if (learnHub || tutorial) {
    const m = await import("./learn/ui");
    if (!alive()) return;
    if (tutorial) m.mountLearn(main, tutorial);
    else m.mountLearnHub(main);
  } else if (gameId || gamesHub) {
    const m = await import("./games/ui");
    if (!alive()) return;
    if (gameId) m.mountGame(main, gameId);
    else m.mountGamesHub(main, gameConsole);
  } else if (devicePage) {
    const m = await import("./device/ui");
    if (!alive()) return;
    m.mountDevice(main, loc, devicePage);
  } else if (quizPage) {
    const m = await import("./quiz/ui");
    if (!alive()) return;
    if (quizPage === "hub") m.mountQuizHub(main, loc);
    else m.mountQuiz(main, loc, quizPage);
  } else if (kbPage) {
    const m = await import("./kb/ui");
    if (!alive()) return;
    m.mountKb(main, loc, kbPage === "hub" ? null : kbPage);
  } else if (legalPage) {
    main.innerHTML = legalStaticHtml(loc, legalPage);
  } else if (marketId || marketsHub) {
    const m = await import("./markets/ui");
    if (!alive()) return;
    if (marketId) m.mountMarket(main, marketId);
    else m.mountMarketsHub(main);
    unmountCurrent = m.unmountMarket;
  } else {
    const m = await import("./home");
    if (!alive()) return;
    unmountCurrent = m.mountHome(main, loc);
  }
}

function upsertMeta(attr: "name" | "property", key: string, content: string | null): void {
  const sel = `meta[${attr}="${key}"]`;
  let el = document.querySelector(sel);
  if (!content) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.append(el);
  }
  el.setAttribute("content", content);
}

function syncHreflang(seo: Parameters<typeof hreflangAlternates>[0]): void {
  document.querySelectorAll('link[rel="alternate"][hreflang]').forEach((el) => el.remove());
  for (const alt of hreflangAlternates(seo)) {
    const link = document.createElement("link");
    link.rel = "alternate";
    link.hreflang = alt.hreflang;
    link.href = alt.href;
    document.head.append(link);
  }
}

function langSwitch(current: Locale): HTMLElement {
  const sel = h("select", {
    class: "lang",
    "aria-label": t("lang.label"),
    onChange: (e: Event) => {
      const next = (e.target as HTMLSelectElement).value as Locale;
      // render() sets the locale once its pack is loaded, like any navigation.
      history.pushState(null, "", localeHref(next));
      render();
    },
  });
  for (const code of LOCALES) {
    sel.append(
      h("option", {
        value: code,
        selected: code === current,
      }, t(`lang.${code}`)),
    );
  }
  return sel;
}

function localeHref(next: Locale): string {
  return devicePage
    ? withSearch(deviceHref(next, devicePage), location.search)
    : quizPage
    ? withSearch(quizHref(next, quizPage === "hub" ? null : quizPage), location.search)
    : kbPage
    ? withSearch(kbHref(next, kbPage === "hub" ? null : kbPage), location.search)
    : legalPage
    ? withSearch(legalHref(next, legalPage), location.search)
    : learnHub || tutorial
      ? withSearch(learnHref(next, tutorial), location.search)
      : gamesHub || gameId
        ? withSearch(gamesHref(next, gameConsole, gameId), location.search)
        : marketsHub || marketId
          ? withSearch(marketsHref(next, marketId), location.search)
          : withSearch(appHref(next, tool, clipId, convertJob ?? resizeJob), location.search);
}

/** ID Watermark & Redact pages (watermark + mosaic) wear their own tab icon; every other page keeps cv.cm's. */
function syncBrandIcon(branded: boolean): void {
  const icon = document.querySelector('link[rel="icon"][type="image/svg+xml"]');
  icon?.setAttribute("href", branded ? "/brand/safemark.svg" : "/favicon.svg?v=2");
  const touch = document.querySelector('link[rel="apple-touch-icon"]');
  touch?.setAttribute("href", branded ? "/brand/safemark-180.png" : "/favicon.svg?v=2");
}
