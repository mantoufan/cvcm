import { h } from "./dom";
import { t } from "./i18n";
import type { Locale } from "../shared/locale";
import { CATEGORIES, appHref, type ToolId } from "../shared/path";

const MARK: Record<ToolId, string> = {
  watermark: "印",
  collage: "拼",
  convert: "转",
  "image-pdf": "PDF",
};

const TONE: Record<ToolId, "pink" | "sky"> = {
  watermark: "pink",
  collage: "sky",
  convert: "pink",
  "image-pdf": "sky",
};

export function mountHome(host: HTMLElement, locale: Locale): void {
  host.append(
    h("section", { class: "hero-band" },
      h("p", { class: "kicker" }, t("home.kicker")),
      h("h1", null, t("home.title")),
      h("p", { class: "lede" }, t("home.lead")),
    ),
    ...CATEGORIES.map((cat) =>
      h("section", { class: "wall" },
        h("div", { class: "wall-h" },
          h("h2", null, t(`nav.${cat.id}`)),
        ),
        h("div", { class: "tiles" },
          ...cat.tools.map((id) => tile(locale, id)),
        ),
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
    h("div", { class: `tile-cover ${TONE[id]}`, "aria-hidden": "true" },
      h("span", { class: "tile-mark" }, MARK[id]),
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
