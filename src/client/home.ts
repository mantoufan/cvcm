import { COVER } from "./covers";
import { h } from "./dom";
import { t } from "./i18n";
import { learnTile } from "./learn/ui";
import type { Locale } from "../shared/locale";
import { TOOLS, FEATURED_TUTORIALS, appHref, learnHref, type ToolId } from "../shared/path";

export function mountHome(host: HTMLElement, locale: Locale): void {
  host.append(
    h("section", { class: "hero-band" },
      h("span", { class: "hero-ornament", "aria-hidden": "true" }, "୨୧"),
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
    ),
    h("section", { class: "wall" },
      h("div", { class: "wall-h" },
        h("h2", null, t("nav.learn")),
        h("a", { class: "wall-more", href: learnHref(locale, null), "data-nav": "learn" }, t("learn.hub.all")),
      ),
      h("div", { class: "tiles" },
        ...FEATURED_TUTORIALS.map((id) => learnTile(locale, id)),
      ),
    ),
    h("section", { class: "points" },
      point("local"),
      point("nodb"),
      point("i18n"),
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
