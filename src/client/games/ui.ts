import { crumbNav, homeCrumb, type Crumb } from "../crumb";
import { h } from "../dom";
import { linkList } from "../links";
import { locale, t } from "../i18n";
import { GAME_HUBS, GAME_KINDS, gameHubNs, gamesFaqBase, type GameHubId } from "../../shared/games";
import { appHref, gamesHref, hubGames, type ToolId } from "../../shared/path";

type Loc = ReturnType<typeof locale>;

/** The trail on the games hub (Home / Games) or a sub-hub (Home / Games / hub). */
function hubCrumb(loc: Loc, hub: GameHubId | null): HTMLElement {
  const games: Crumb = { label: t("nav.games"), href: gamesHref(loc, null), nav: "games" };
  return crumbNav(hub
    ? [homeCrumb(loc), games, { label: t(`games.consoles.${hub}`) }]
    : [homeCrumb(loc), { label: t("nav.games") }]);
}

function toolLinks(loc: Loc, list: readonly ToolId[]): HTMLElement {
  return linkList(list.map((id) => ({ href: appHref(loc, id), name: t(`tools.${id}.name`), blurb: t(`tools.${id}.blurb`), nav: id })));
}

/** /games/ lists every cv.cm game by kind; /games/<kind>/ and the /games/3d/ tag hub list one. */
export function mountGamesHub(host: HTMLElement, hub: GameHubId | null): void {
  const loc = locale();
  host.append(
    hubCrumb(loc, hub),
    h("header", { class: "tool-head" },
      h("h1", null, hub ? t(`${gameHubNs(hub)}.title`) : t("games.hub.title")),
      h("p", { class: "lede" }, hub ? t(`${gameHubNs(hub)}.lead`) : t("games.hub.lead")),
    ),
    h("nav", { class: "game-filters", "aria-label": t("nav.games") },
      h("div", { class: "game-filter-row" },
        chip(gamesHref(loc, null), !hub, t("games.filterAll"), "games"),
        ...GAME_HUBS.map((id) => chip(gamesHref(loc, id), id === hub, t(`games.consoles.${id}`), `games-${id}`)),
      ),
    ),
    ...(hub
      ? [h("section", { class: "wall" },
        h("h2", { class: "sr-only" }, t(`${gameHubNs(hub)}.title`)),
        toolLinks(loc, hubGames(hub)),
      )]
      // Each kind once; 3D is a tag, so its games already appear under their kind (the chip above links its hub).
      : GAME_KINDS.map((id) => h("section", { class: "wall", "aria-labelledby": `games-${id}-title` },
        h("h2", { id: `games-${id}-title` }, h("a", { href: gamesHref(loc, id), "data-nav": `games-${id}` }, t(`${gameHubNs(id)}.title`))),
        toolLinks(loc, hubGames(id)),
      ))),
    h("section", { class: "wall", "aria-labelledby": "games-emu-title" },
      h("h2", { id: "games-emu-title" }, t("games.emu.title")),
      h("p", { class: "lede" }, t("games.emu.lead")),
      toolLinks(loc, ["rom-emulator", "flash-player"]),
    ),
    gamesFaq(hub),
  );
}

function chip(href: string, on: boolean, label: string, nav: string): HTMLElement {
  return h("a", {
    class: "game-chip" + (on ? " on" : ""),
    href,
    "data-nav": nav,
    "aria-current": on ? "page" : undefined,
  }, label);
}

function gamesFaq(hub: GameHubId | null): HTMLElement {
  const base = gamesFaqBase(hub);
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
