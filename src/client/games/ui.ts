import { h } from "../dom";
import { linkList, type LinkItem } from "../links";
import { locale, t } from "../i18n";
import { CONSOLE_CONTROLS } from "../../shared/game-controls";
import {
  GAME_CONSOLES,
  GAME_GENRES,
  GAME_ROM_BASE,
  GAMES,
  gameById,
  gameRomFile,
  gamesFor,
  isGameGenreId,
  type Game,
  type GameConsoleId,
  type GameGenreId,
  type GameId,
} from "../../shared/games";
import { gameCheatLabels, gameCopy, gameFaqItems, gameName } from "../../shared/games-i18n";
import { gameWalkthrough, walkthroughImage } from "../../shared/game-walkthrough";
import { gamesHref } from "../../shared/path";
import { GAME_OFFICIAL, OFFICIAL_CHECKED, type OfficialWay } from "../../shared/game-official";
import { clearDraft, loadDraft, saveDraft } from "../session";

const GAME_SCROLL_KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "]);

if (typeof window !== "undefined") {
  window.addEventListener("keydown", (event) => {
    if (!GAME_SCROLL_KEYS.has(event.key)) return;
    const active = document.activeElement;
    if (active instanceof HTMLIFrameElement && active.classList.contains("game-frame")) {
      event.preventDefault();
    }
  });
}

function currentGenre(): GameGenreId | null {
  const raw = new URLSearchParams(location.search).get("genre") || "";
  return isGameGenreId(raw) ? raw : null;
}

export function mountGamesHub(host: HTMLElement, consoleId: GameConsoleId | null): void {
  const loc = locale();
  const genre = currentGenre();
  const list = gamesFor(consoleId, genre);
  const flash = consoleId === "flash";
  const catalog = list.length
    ? linkList(list.map((game) => gameLink(loc, game)))
    : h("p", { class: "learn-empty" }, flash && !genre ? t("games.flash.catalog") : t("games.empty"));
  if (flash) {
    host.append(
      h("header", { class: "tool-head game-head" },
        h("a", { class: "back", href: gamesHref(loc, null), "data-nav": "games" }, t("games.back")),
        h("p", { class: "kicker" }, t("games.flash.kicker")),
        h("h1", null, t("games.flash.title")),
      ),
      player({
        console: "flash",
        core: "ruffle",
        accept: ".swf",
        name: t("games.flash.title"),
        romUrl: null,
        cheats: [],
      }),
      h("p", { class: "lede game-lead" }, t("games.flash.lead")),
      filters(loc, consoleId, genre),
      h("section", { class: "wall" },
        h("h2", null, t("games.consoles.flash")),
        catalog,
      ),
      flashGuide(),
      gamesFaq(loc, consoleId),
    );
    return;
  }
  host.append(
    h("header", { class: "tool-head" },
      h("h1", null, consoleId ? t(`games.consoles.${consoleId}`) : t("games.hub.title")),
      h("p", { class: "lede" }, t("games.hub.lead")),
    ),
    filters(loc, consoleId, genre),
    h("section", { class: "wall" },
      h("h2", { class: "sr-only" }, consoleId ? t(`games.consoles.${consoleId}`) : t("nav.games")),
      catalog,
    ),
    gamesFaq(loc, consoleId),
  );
}

function flashGuide(): HTMLElement {
  const steps = [1, 2, 3, 4, 5].map((i) =>
    h("li", { id: `flash-s${i}`, class: "guide-step" },
      h("h3", null, t(`games.flash.s${i}t`)),
      h("p", null, t(`games.flash.s${i}b`)),
    ),
  );
  return h("section", { class: "game-section game-guide-section", "aria-labelledby": "flash-guide-title" },
    h("h2", { id: "flash-guide-title" }, t("games.flash.guide")),
    h("ol", { class: "game-guide" }, ...steps),
  );
}

function filters(loc: ReturnType<typeof locale>, consoleId: GameConsoleId | null, genre: GameGenreId | null): HTMLElement {
  return h("nav", { class: "game-filters", "aria-label": t("nav.games") },
    h("div", { class: "game-filter-row" },
      chip(gamesHref(loc, null), !consoleId, t("games.filterAll"), "games"),
      ...GAME_CONSOLES.map((id) =>
        chip(gamesHref(loc, id), consoleId === id, t(`games.consoles.${id}`), `games-${id}`),
      ),
    ),
    h("div", { class: "game-filter-row" },
      chip(withGenre(gamesHref(loc, consoleId), null), !genre, t("games.filterAll"), "games-genre-all"),
      ...GAME_GENRES.map((id) =>
        chip(withGenre(gamesHref(loc, consoleId), id), genre === id, t(`games.genres.${id}`), `games-genre-${id}`),
      ),
    ),
  );
}

function withGenre(href: string, genre: GameGenreId | null): string {
  if (!genre) return href;
  const join = href.includes("?") ? "&" : "?";
  return `${href}${join}genre=${genre}`;
}

function chip(href: string, on: boolean, label: string, nav: string): HTMLElement {
  return h("a", {
    class: "game-chip" + (on ? " on" : ""),
    href,
    "data-nav": nav,
    "aria-current": on ? "page" : undefined,
  }, label);
}

export function gameLink(loc: ReturnType<typeof locale>, game: Game): LinkItem {
  const copy = gameName(loc, game.id);
  return {
    href: gamesHref(loc, game.console, game.id),
    name: copy.name,
    blurb: copy.blurb,
    meta: `${t(`games.consoles.${game.console}`)} · ${t(`games.genres.${game.genre}`)}`,
    nav: `game-${game.id}`,
  };
}

export function mountGame(host: HTMLElement, id: GameId): void {
  const loc = locale();
  const game = gameById(id);
  if (!game) return;
  const copy = gameCopy(loc, id);
  const cheats = game.cheats;
  const labels = gameCheatLabels(loc, id);
  const walkthrough = gameWalkthrough(loc, id);
  const steps = walkthrough.steps;
  const faqs = gameFaqItems(loc, id);
  const related = GAMES.filter((item) => item.id !== id && (item.console === game.console || item.genre === game.genre)).slice(0, 4);

  host.append(
    h("header", { class: "tool-head game-head" },
      h("a", { class: "back", href: gamesHref(loc, game.console), "data-nav": `games-${game.console}` }, t("games.back")),
      h("p", { class: "kicker" }, `${t(`games.consoles.${game.console}`)} · ${t(`games.genres.${game.genre}`)}`),
      h("h1", null, copy.name),
    ),
    player({
      id: game.id,
      // Commercial games are never hosted; the player may keep its own dump in this browser.
      remember: !game.rom,
      console: game.console,
      core: game.core,
      accept: game.accept,
      name: copy.name,
      romUrl: `${GAME_ROM_BASE}${gameRomFile(game)}`,
      cheats: emulatorCheats(game),
    }),
    h("p", { class: "lede game-lead" }, copy.lead),
    ...officialSection(game.id),
    ...(cheats.length
      ? [h("section", { class: "game-section", "aria-labelledby": "cheats-title" },
        h("h2", { id: "cheats-title" }, t("games.cheats")),
        h("p", null, copy.cheatsLead),
        h("div", { class: "cheat-table" },
          ...cheats.map((cheat, i) =>
            h("div", { class: "cheat-row" },
              h("strong", null, labels[i] || cheat.id),
              h("code", null, cheat.code),
            ),
          ),
        ),
      )]
      : []),
    h("section", { class: "game-section game-guide-section", "aria-labelledby": "guide-title" },
      h("h2", { id: "guide-title" }, t("games.guide")),
      h("p", { class: "guide-intro" }, walkthrough.intro),
      h("nav", { class: "guide-toc", "aria-label": t("games.guide") },
        ...steps.map((step) => h("a", { href: `#guide-${step.id}` }, step.title)),
      ),
      h("ol", { class: "game-guide" },
        ...steps.map((step) =>
          h("li", { id: `guide-${step.id}`, class: "guide-step" },
            h("h3", null, step.title),
            ...(step.image
              ? [h("figure", { class: "guide-figure" },
                h("img", {
                  src: walkthroughImage(id, step.image),
                  alt: step.title,
                  width: "1280",
                  height: "720",
                  loading: "lazy",
                }),
              )]
              : []),
            ...step.body.split("\n\n").map((para) => h("p", null, para)),
          ),
        ),
      ),
    ),
    ...(faqs.length
      ? [h("section", { class: "faq", "aria-labelledby": "faq-title" },
        h("h2", { id: "faq-title" }, t("faq.title")),
        ...faqs.map((item, i) =>
          h("details", i === 0 ? { open: true } : null,
            h("summary", null, item.q),
            h("p", null, item.a),
          ),
        ),
      )]
      : []),
    ...(related.length
      ? [h("section", { class: "learn-related" },
        h("h2", null, t("games.related")),
        linkList(related.map((item) => gameLink(loc, item))),
      )]
      : []),
    h("p", { class: "game-legal" }, t("games.legal")),
  );
}

type SavedRom = { blob: Blob; name: string };

function player(spec: {
  id?: GameId;
  remember?: boolean;
  console: GameConsoleId;
  core: string;
  accept: string;
  name: string;
  romUrl: string | null;
  cheats: { name: string; code: string }[];
}): HTMLElement {
  const flash = spec.console === "flash";
  const box = h("section", { class: "game-play", "aria-label": t("games.play") });
  const frame = h("iframe", {
    class: "game-frame",
    title: spec.name,
    allow: "autoplay; fullscreen; gamepad",
    src: "about:blank",
  }) as HTMLIFrameElement;
  const status = h("p", { class: "game-note", role: "status" }, t(flash ? "games.flash.needFileBody" : "games.byoNote"));
  const empty = h("div", {
    class: "game-empty",
    role: "status",
    hidden: spec.romUrl ? true : false,
  },
    h("p", { class: "game-empty-title" }, t(flash ? "games.flash.needFile" : "games.needFile")),
    h("p", null, t(flash ? "games.flash.needFileBody" : "games.needFileBody")),
    h("button", { class: "btn", type: "button" }, t(flash ? "games.flash.load" : "games.loadRom")),
  );
  const showEmpty = (): void => { empty.hidden = false; };
  const hideEmpty = (): void => { empty.hidden = true; };

  const shellPath = flash ? "/emu/flash" : "/emu/player";
  // The shell boots once (player.js ignores a second boot), so every later ROM reloads the frame.
  let started = false;
  let loads = 0;
  let onLoad: (() => void) | null = null;
  const boot = (payload: Record<string, unknown>): void => {
    hideEmpty();
    const message = { type: "boot", core: spec.core, name: spec.name, ...payload };
    let ready = false;
    try {
      const path = new URL(frame.src, location.origin).pathname.replace(/\/$/, "");
      ready = !started && path === shellPath && !!frame.contentWindow;
    } catch {
      ready = false;
    }
    started = true;
    if (ready) {
      frame.contentWindow?.postMessage(message, location.origin);
      return;
    }
    const lang = locale() === "zh-CN" ? "zh-CN" : "en-US";
    const qs = new URLSearchParams({ core: spec.core, name: spec.name, lang });
    if (typeof payload.rom === "string") qs.set("rom", payload.rom);
    loads += 1;
    frame.src = `${shellPath}?v=${flash ? "1" : "5"}&${qs.toString()}${loads > 1 ? `&n=${loads}` : ""}`;
    // An aborted navigation never fires load, so drop its listener or the stale ROM boots first.
    if (onLoad) frame.removeEventListener("load", onLoad);
    const listener = (): void => {
      if (onLoad === listener) onLoad = null;
      frame.contentWindow?.postMessage(message, location.origin);
    };
    onLoad = listener;
    frame.addEventListener("load", listener, { once: true });
  };

  const picker = h("input", {
    type: "file",
    accept: spec.accept,
    class: "game-rom-input",
    "aria-label": t(flash ? "games.flash.load" : "games.loadRom"),
  }) as HTMLInputElement;
  const openPicker = (): void => { picker.click(); };
  empty.querySelector("button")?.addEventListener("click", openPicker);

  // Opt-in only: page copy promises a picked file stays in the tab unless the player saves it here.
  const remember = !!(spec.remember && spec.id);
  const savedKey = `rom:${spec.id ?? ""}`;
  let current: SavedRom | null = null; // local file now playing
  let stored = false; // a ROM for this game is in IndexedDB
  let currentStored = false; // ...and it is the one now playing
  let busy = false;
  const rememberBtn = h("button", { class: "btn ghost", type: "button", hidden: true }, t("games.rememberRom")) as HTMLButtonElement;
  const forgetBtn = h("button", { class: "btn ghost", type: "button", hidden: true }, t("games.forgetRom")) as HTMLButtonElement;
  // Move focus only if the user has not gone elsewhere during a slow save.
  const refocus = (target: HTMLButtonElement): void => {
    const active = document.activeElement;
    if (!target.hidden && (active === document.body || active === rememberBtn || active === forgetBtn)) target.focus();
  };
  const sync = (): void => {
    rememberBtn.hidden = !(remember && current && !currentStored);
    forgetBtn.hidden = !(remember && stored);
    rememberBtn.disabled = busy;
    forgetBtn.disabled = busy;
  };
  rememberBtn.addEventListener("click", () => {
    const rom = current;
    if (!rom || busy) return;
    busy = true;
    sync();
    void navigator.storage?.persist?.().catch(() => false);
    saveDraft(savedKey, rom).then(() => {
      stored = true;
      if (current === rom) {
        currentStored = true;
        status.textContent = t("games.rememberedRom");
      }
    }).catch(() => {
      if (current === rom) status.textContent = t("games.rememberFailed");
    }).finally(() => {
      busy = false;
      sync();
      refocus(forgetBtn.hidden ? rememberBtn : forgetBtn);
    });
  });
  forgetBtn.addEventListener("click", () => {
    if (busy) return;
    busy = true;
    sync();
    clearDraft(savedKey).then(() => {
      stored = false;
      currentStored = false;
      status.textContent = t("games.forgotRom");
    }).catch(() => {
      /* still stored: Forget stays available to retry */
    }).finally(() => {
      busy = false;
      sync();
      refocus(rememberBtn.hidden ? forgetBtn : rememberBtn);
    });
  });

  picker.addEventListener("change", async () => {
    const file = picker.files?.[0];
    if (!file) return;
    status.textContent = t(flash ? "games.flash.needFileBody" : "games.loadRomHint");
    if (remember) {
      // Keep the File (a Blob) rather than a second ArrayBuffer copy.
      current = { blob: file, name: file.name };
      currentStored = false;
      sync();
    }
    const buffer = await file.arrayBuffer();
    boot({ buffer, filename: file.name, cheats: spec.cheats });
  });

  box.append(
    h("div", { class: "game-stage" }, frame, empty),
    h("div", { class: "game-playbar" },
      h("label", { class: "btn" }, t(flash ? "games.flash.load" : "games.loadRom"), picker),
      rememberBtn,
      forgetBtn,
      status,
    ),
    h("p", { class: "game-note muted" }, t(flash ? "games.flash.emulator" : "games.emulator"), " · ", t(flash ? "games.flash.mobile" : "games.mobile")),
    controls(spec.console),
  );

  const tryHosted = (romUrl: string): void => {
    void fetch(romUrl, { method: "HEAD" }).then((res) => {
      if (picker.files?.length) return;
      if (!res.ok) {
        showEmpty();
        return;
      }
      status.textContent = t("games.hostedNote");
      boot({ rom: romUrl, cheats: spec.cheats });
    }).catch(() => {
      if (!picker.files?.length) showEmpty();
    });
  };

  if (spec.romUrl) {
    const romUrl = spec.romUrl;
    queueMicrotask(() => {
      if (!remember || typeof indexedDB === "undefined") {
        tryHosted(romUrl);
        return;
      }
      loadDraft<SavedRom>(savedKey).then(async (saved) => {
        if (picker.files?.length) return;
        if (!saved || !(saved.blob instanceof Blob)) {
          tryHosted(romUrl);
          return;
        }
        // Mark it stored first so an unreadable entry can still be forgotten.
        stored = true;
        sync();
        const buffer = await saved.blob.arrayBuffer();
        if (picker.files?.length) return;
        current = saved;
        // Forget may have finished while the blob was being read.
        currentStored = stored;
        sync();
        status.textContent = t("games.savedRomLoaded");
        boot({ buffer, filename: saved.name, cheats: spec.cheats });
      }).catch(() => tryHosted(romUrl));
    });
  }
  return box;
}

/** Commercial games are never hosted: point players at stores that sell or stream them today. */
function officialSection(id: GameId): HTMLElement[] {
  const ways = GAME_OFFICIAL[id];
  if (!ways) return [];
  const item = (way: OfficialWay): HTMLElement =>
    h("li", null,
      h("a", { href: way.url, target: "_blank", rel: "noopener noreferrer" }, way.product),
      ...(way.title ? [` (${way.title})`] : []),
      ` · ${way.platform} · ${t(`games.official.${way.kind}`)}`,
      ...(way.edition ? [` · ${t(`games.official.edition.${way.edition}`)}`] : []),
    );
  return [h("section", { class: "game-section", "aria-labelledby": "official-title" },
    h("h2", { id: "official-title" }, t("games.official.title")),
    ways.length
      ? h("ul", { class: "game-official" }, ...ways.map(item))
      : h("p", null, t("games.official.none")),
    h("p", { class: "game-note muted" }, t("games.official.note", { date: OFFICIAL_CHECKED })),
  )];
}

function controls(consoleId: Game["console"]): HTMLElement {
  const rows = CONSOLE_CONTROLS[consoleId];
  return h("section", { class: "game-controls", "aria-labelledby": "controls-title" },
    h("h2", { id: "controls-title" }, t("games.controls.title")),
    h("p", { class: "game-note" }, t(consoleId === "flash" ? "games.flash.mobile" : "games.controls.touch")),
    h("div", { class: "control-table" },
      ...rows.map((row) =>
        h("div", { class: "control-row" },
          h("span", { class: "control-action" }, t(`games.controls.${row.action}`)),
          h("kbd", null, row.keys),
        ),
      ),
    ),
  );
}

function emulatorCheats(game: Game): { name: string; code: string }[] {
  const labels = gameCheatLabels(locale(), game.id);
  return game.cheats
    .map((cheat, i) => ({ name: labels[i] || cheat.id, code: cheat.code }))
    .filter((row) => !/[a-z]{3,}/.test(row.code));
}

function gamesFaq(loc: ReturnType<typeof locale>, consoleId: GameConsoleId | null = null): HTMLElement {
  void loc;
  const base = consoleId === "flash" ? "faq.gamesFlash" : "faq.games";
  const items = [];
  for (let i = 1; i <= 5; i++) {
    const q = t(`${base}.q${i}`);
    if (q === `${base}.q${i}`) break;
    items.push({ q, a: t(`${base}.a${i}`) });
  }
  if (!items.length) return h("section", { class: "faq", hidden: true });
  return h("section", { class: "faq", "aria-labelledby": "faq-title" },
    h("h2", { id: "faq-title" }, t("faq.title")),
    ...items.map((item, i) =>
      h("details", i === 0 ? { open: true } : null,
        h("summary", null, item.q),
        h("p", null, item.a),
      ),
    ),
  );
}
