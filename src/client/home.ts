import { h } from "./dom";
import { t } from "./i18n";
import { gameTile } from "./games/ui";
import { learnTile } from "./learn/ui";
import type { Locale } from "../shared/locale";
import { GAMES } from "../shared/games";
import { TOOLS, FEATURED_TUTORIALS, appHref, deviceHref, gamesHref, learnHref, type ToolId } from "../shared/path";
import { DEVICE_CHILD_PAGES } from "../shared/device";
import { deviceMessages, devicePageCopy } from "../shared/device-i18n";
import { COVER, DEVICE_COVER } from "./covers";

export function mountHome(host: HTMLElement, locale: Locale): void {
  const learnWall = FEATURED_TUTORIALS.length
    ? h("section", { class: "wall" },
      h("div", { class: "wall-h" },
        h("h2", null, t("nav.learn")),
        h("a", { class: "wall-more", href: learnHref(locale, null), "data-nav": "learn" }, t("learn.hub.all")),
      ),
      h("div", { class: "tiles" },
        ...FEATURED_TUTORIALS.map((id) => learnTile(locale, id)),
      ),
    )
    : null;
  host.append(
    h("section", { class: "hero-band" },
      h("p", { class: "kicker" }, t("home.kicker")),
      h("h1", null, t("home.title")),
      h("p", { class: "lede" }, t("home.lead")),
    ),
    h("section", { class: "wall" },
      h("div", { class: "wall-h" },
        h("h2", null, t("nav.tools")),
      ),
      h("div", { class: "tiles" },
        ...TOOLS.map((id) => tile(locale, id)),
      ),
      h("div", { class: "wall-h" },
        h("h2", null, t("nav.device")),
        h("a", { class: "wall-more", href: deviceHref(locale, "hub"), "data-nav": "device" }, deviceMessages(locale).all),
      ),
      h("div", { class: "tiles" },
        ...DEVICE_CHILD_PAGES.map((id) => deviceTile(locale, id)),
      ),
    ),
    ...(learnWall ? [learnWall] : []),
    h("section", { class: "wall" },
      h("div", { class: "wall-h" },
        h("h2", null, t("nav.games")),
        h("a", { class: "wall-more", href: gamesHref(locale, null), "data-nav": "games" }, t("games.hub.all")),
      ),
      h("div", { class: "tiles" },
        ...GAMES.slice(0, 8).map((game) => gameTile(locale, game)),
      ),
    ),
    h("section", { class: "points" },
      point("local"),
      point("nodb"),
      point("i18n"),
    ),
  );
}

function deviceTile(locale: Locale, id: (typeof DEVICE_CHILD_PAGES)[number]): HTMLElement {
  const copy = devicePageCopy(locale, id);
  return h("a", { class: "tile", href: deviceHref(locale, id), "data-nav": `device-${id}` },
    h("div", { class: "tile-cover" },
      h("img", { src: DEVICE_COVER, alt: copy.name, width: "640", height: "360" }),
    ),
    h("div", { class: "tile-body" },
      h("h3", null, copy.name),
      h("p", null, copy.blurb),
    ),
  );
}

function tile(locale: Locale, id: ToolId): HTMLElement {
  return h("a", {
    class: "tile",
    href: appHref(locale, id),
    "data-nav": id,
  },
    h("div", { class: "tile-cover" },
      h("img", {
        src: COVER[id],
        alt: t(`tools.${id}.name`),
        width: "640",
        height: "360",
      }),
    ),
    h("div", { class: "tile-body" },
      h("h3", null, t(`tools.${id}.name`)),
      h("p", null, t(`tools.${id}.blurb`)),
    ),
  );
}

function point(id: "local" | "nodb" | "i18n"): HTMLElement {
  return h("article", { class: "point" },
    h("h2", null, t(`home.points.${id}.title`)),
    h("p", null, t(`home.points.${id}.body`)),
  );
}
