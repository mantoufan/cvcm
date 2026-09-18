import { GAME_COVER } from "../covers";
import { h } from "../dom";
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
import { gameCheatLabels, gameCopy, gameFaqItems, gameGuideSteps } from "../../shared/games-i18n";
import { gamesHref } from "../../shared/path";

function currentGenre(): GameGenreId | null {
  const raw = new URLSearchParams(location.search).get("genre") || "";
  return isGameGenreId(raw) ? raw : null;
}

export function mountGamesHub(host: HTMLElement, consoleId: GameConsoleId | null): void {
  const loc = locale();
  const genre = currentGenre();
  const list = gamesFor(consoleId, genre);
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
      list.length
        ? h("div", { class: "tiles" }, ...list.map((game) => gameTile(loc, game)))
        : h("p", { class: "learn-empty" }, t("games.empty")),
    ),
    gamesFaq(loc),
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
  const steps = gameGuideSteps(loc, id);
  const faqs = gameFaqItems(loc, id);
  const related = GAMES.filter((item) => item.id !== id && (item.console === game.console || item.genre === game.genre)).slice(0, 4);

  host.append(
    h("header", { class: "tool-head game-head" },
      h("a", { class: "back", href: gamesHref(loc, game.console), "data-nav": `games-${game.console}` }, t("games.back")),
      h("p", { class: "kicker" }, `${t(`games.consoles.${game.console}`)} · ${t(`games.genres.${game.genre}`)}`),
      h("h1", null, copy.name),
    ),
    player(game, copy.name),
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
    h("section", { class: "game-section", "aria-labelledby": "guide-title" },
      h("h2", { id: "guide-title" }, t("games.guide")),
      h("ol", { class: "learn-steps" },
        ...steps.map((step, i) =>
          h("li", { id: `guide-${i + 1}`, class: "learn-step" },
            h("h3", null, step.title),
            h("p", null, step.body),
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

function player(game: Game, name: string): HTMLElement {
  const box = h("section", { class: "game-play", "aria-label": t("games.play") });
  const frame = h("iframe", {
    class: "game-frame",
    title: name,
    allow: "autoplay; gamepad",
    src: "about:blank",
  }) as HTMLIFrameElement;
  const status = h("p", { class: "game-note" }, t("games.byoNote"));
  const romUrl = `${GAME_ROM_BASE}${gameRomFile(game)}`;

  const boot = (payload: Record<string, unknown>): void => {
    const lang = locale() === "zh-CN" ? "zh-CN" : "en-US";
    const qs = new URLSearchParams({ core: game.core, name, lang });
    if (typeof payload.rom === "string") qs.set("rom", payload.rom);
    frame.src = `/emu/player?${qs.toString()}`;
    const send = (): void => {
      frame.contentWindow?.postMessage({ type: "boot", core: game.core, name, ...payload }, location.origin);
    };
    frame.addEventListener("load", send, { once: true });
  };

  const picker = h("input", {
    type: "file",
    accept: game.accept,
    class: "game-rom-input",
    "aria-label": t("games.loadRom"),
  }) as HTMLInputElement;
  picker.addEventListener("change", async () => {
    const file = picker.files?.[0];
    if (!file) return;
    status.textContent = t("games.loadRomHint");
    const buffer = await file.arrayBuffer();
    boot({ buffer, cheats: emulatorCheats(game) });
  });

  box.append(
    frame,
    h("div", { class: "game-playbar" },
      h("label", { class: "btn" }, t("games.loadRom"), picker),
      status,
    ),
    h("p", { class: "game-note muted" }, t("games.emulator"), " · ", t("games.mobile")),
  );

  queueMicrotask(() => {
    void fetch(romUrl, { method: "HEAD" }).then((res) => {
      if (!res.ok || picker.files?.length) return;
      status.textContent = t("games.hostedNote");
      boot({ rom: romUrl, cheats: emulatorCheats(game) });
    }).catch(() => {
      /* keep the file picker; a missing hosted ROM is expected */
    });
  });
  return box;
}

function emulatorCheats(game: Game): { name: string; code: string }[] {
  const labels = gameCheatLabels(locale(), game.id);
  return game.cheats
    .map((cheat, i) => ({ name: labels[i] || cheat.id, code: cheat.code }))
    .filter((row) => !/[a-z]{3,}/.test(row.code));
}

function gamesFaq(loc: ReturnType<typeof locale>): HTMLElement {
  void loc;
  const items = [];
  for (let i = 1; i <= 5; i++) {
    const q = t(`faq.games.q${i}`);
    if (q === `faq.games.q${i}`) break;
    items.push({ q, a: t(`faq.games.a${i}`) });
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
