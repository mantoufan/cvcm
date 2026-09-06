import { h } from "./dom";
import { t } from "./i18n";
import type { Locale } from "../shared/locale";
import { appHref } from "../shared/path";

export function mountHome(host: HTMLElement, locale: Locale): void {
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
        tile(locale, "watermark", "pink"),
        tile(locale, "collage", "sky"),
      ),
    ),
    h("section", { class: "points" },
      point("local"),
      point("nodb"),
      point("i18n"),
    ),
  );
}

function tile(locale: Locale, id: "watermark" | "collage", tone: "pink" | "sky"): HTMLElement {
  return h("a", {
    class: "tile",
    href: appHref(locale, id),
    "data-nav": id,
  },
    h("div", { class: `tile-cover ${tone}`, "aria-hidden": "true" },
      h("span", { class: "tile-mark" }, id === "watermark" ? "印" : "拼"),
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
