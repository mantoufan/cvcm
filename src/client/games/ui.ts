import { GAME_COVER } from "../covers";
import { h } from "../dom";
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
import { gameCheatLabels, gameCopy, gameFaqItems } from "../../shared/games-i18n";
import { gameWalkthrough, walkthroughImage } from "../../shared/game-walkthrough";
import { gamesHref } from "../../shared/path";

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
    ? h("div", { class: "tiles" }, ...list.map((game) => gameTile(loc, game)))
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
        h("div", { class: "wall-h" },
          h("h2", null, t("games.consoles.flash")),
        ),
        catalog,
      ),
      flashGuide(),
      gamesFaq(loc, consoleId),
    );
    return;
  }
  host.append(
    h("section", { class: "hero-band" },
      h("span", { class: "hero-ornament", "aria-hidden": "true" }, "✦"),
      h("p", { class: "kicker" }, t("games.hub.kicker")),
      h("h1", null, consoleId ? t(`games.consoles.${consoleId}`) : t("games.hub.title")),
      h("p", { class: "lede" }, t("games.hub.lead")),
    ),
    filters(loc, consoleId, genre),
    h("section", { class: "wall" },
      h("div", { class: "wall-h" },
        h("h2", null, consoleId ? t(`games.consoles.${consoleId}`) : t("nav.games")),
      ),
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

export function gameTile(loc: ReturnType<typeof locale>, game: Game): HTMLElement {
  const copy = gameCopy(loc, game.id);
  return h("a", {
    class: "tile",
    href: gamesHref(loc, game.console, game.id),
    "data-nav": `game-${game.id}`,
  },
    h("div", { class: "tile-cover" },
      h("img", {
        src: GAME_COVER[game.id],
        alt: copy.name,
        width: "640",
        height: "360",
        loading: "lazy",
      }),
    ),
    h("div", { class: "tile-body" },
      h("p", { class: "game-meta" },
        t(`games.consoles.${game.console}`),
        " · ",
        t(`games.genres.${game.genre}`),
      ),
      h("h3", null, copy.name),
      h("p", null, copy.blurb),
    ),
  );
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
      console: game.console,
      core: game.core,
      accept: game.accept,
      name: copy.name,
      romUrl: `${GAME_ROM_BASE}${gameRomFile(game)}`,
      cheats: emulatorCheats(game),
    }),
    h("p", { class: "lede game-lead" }, copy.lead),
    h("figure", { class: "game-hero" },
      h("img", {
        src: GAME_COVER[id],
        alt: copy.name,
        width: "1280",
        height: "720",
        loading: "lazy",
      }),
    ),
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
        h("div", { class: "tiles" }, ...related.map((item) => gameTile(loc, item))),
      )]
      : []),
    h("p", { class: "game-legal" }, t("games.legal")),
  );
}

function player(spec: {
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
  const status = h("p", { class: "game-note" }, t(flash ? "games.flash.needFileBody" : "games.byoNote"));
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
  const boot = (payload: Record<string, unknown>): void => {
    hideEmpty();
    const message = { type: "boot", core: spec.core, name: spec.name, ...payload };
    let ready = false;
    try {
      const path = new URL(frame.src, location.origin).pathname.replace(/\/$/, "");
      ready = path === shellPath && !!frame.contentWindow;
    } catch {
      ready = false;
    }
    if (ready) {
      frame.contentWindow?.postMessage(message, location.origin);
      return;
    }
    const lang = locale() === "zh-CN" ? "zh-CN" : "en-US";
    const qs = new URLSearchParams({ core: spec.core, name: spec.name, lang });
    if (typeof payload.rom === "string") qs.set("rom", payload.rom);
    frame.src = `${shellPath}?v=${flash ? "1" : "5"}&${qs.toString()}`;
    frame.addEventListener("load", () => {
      frame.contentWindow?.postMessage(message, location.origin);
    }, { once: true });
  };

  const picker = h("input", {
    type: "file",
    accept: spec.accept,
    class: "game-rom-input",
    "aria-label": t(flash ? "games.flash.load" : "games.loadRom"),
  }) as HTMLInputElement;
  const openPicker = (): void => { picker.click(); };
  empty.querySelector("button")?.addEventListener("click", openPicker);
  picker.addEventListener("change", async () => {
    const file = picker.files?.[0];
    if (!file) return;
    status.textContent = t(flash ? "games.flash.needFileBody" : "games.loadRomHint");
    const buffer = await file.arrayBuffer();
    boot({ buffer, filename: file.name, cheats: spec.cheats });
  });

  box.append(
    h("div", { class: "game-stage" }, frame, empty),
    h("div", { class: "game-playbar" },
      h("label", { class: "btn" }, t(flash ? "games.flash.load" : "games.loadRom"), picker),
      status,
    ),
    h("p", { class: "game-note muted" }, t(flash ? "games.flash.emulator" : "games.emulator"), " · ", t(flash ? "games.flash.mobile" : "games.mobile")),
    controls(spec.console),
  );

  if (spec.romUrl) {
    const romUrl = spec.romUrl;
    queueMicrotask(() => {
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
    });
  }
  return box;
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
