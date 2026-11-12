import { crumbNav, homeCrumb, type Crumb } from "../crumb";
import { h } from "../dom";
import { linkList, type LinkItem } from "../links";
import { locale, t } from "../i18n";
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
import { appHref, gamesHref } from "../../shared/path";
import { GAME_OFFICIAL, OFFICIAL_CHECKED, type OfficialWay } from "../../shared/game-official";
import { player } from "./player";

function currentGenre(): GameGenreId | null {
  const raw = new URLSearchParams(location.search).get("genre") || "";
  return isGameGenreId(raw) ? raw : null;
}

/** Home / Games, the start of every games trail. */
function gamesCrumbs(loc: ReturnType<typeof locale>): Crumb[] {
  return [homeCrumb(loc), { label: t("nav.games"), href: gamesHref(loc, null), nav: "games" }];
}

/** The trail on the games hub (Home / Games) or a console hub (Home / Games / console). */
function hubCrumb(loc: ReturnType<typeof locale>, consoleId: GameConsoleId | null): HTMLElement {
  return crumbNav(consoleId
    ? [...gamesCrumbs(loc), { label: t(`games.consoles.${consoleId}`) }]
    : [homeCrumb(loc), { label: t("nav.games") }]);
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
      hubCrumb(loc, consoleId),
      h("header", { class: "tool-head game-head" },
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
    hubCrumb(loc, consoleId),
    h("header", { class: "tool-head" },
      h("h1", null, consoleId ? t(`games.consoles.${consoleId}`) : t("games.hub.title")),
      h("p", { class: "lede" }, t("games.hub.lead")),
    ),
    filters(loc, consoleId, genre),
    h("section", { class: "wall" },
      h("h2", { class: "sr-only" }, consoleId ? t(`games.consoles.${consoleId}`) : t("nav.games")),
      catalog,
    ),
    h("p", { class: "more" }, h("a", { href: appHref(loc, "rom-emulator"), "data-nav": "rom-emulator" }, t("romEmulator.openTool"))),
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
    crumbNav([
      ...gamesCrumbs(loc),
      { label: t(`games.consoles.${game.console}`), href: gamesHref(loc, game.console), nav: `games-${game.console}` },
      { label: copy.name },
    ]),
    h("header", { class: "tool-head game-head" },
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
